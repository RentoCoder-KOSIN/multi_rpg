// アカウント(ユーザー登録/ログイン)とセーブデータの保存。
//
// - パスワードは scrypt + ソルトでハッシュ化して保存する（平文は保存しない）。
// - ログイン後に発行するトークンは、サーバーの秘密鍵(HMAC)で署名した自己完結型。
//   サーバーを再起動してもログイン状態が続き、セッション表は持たない。
// - アカウントもセーブデータも data/accounts.json 1ファイルに保存する（小規模・LAN/少人数向け）。
//   書き込みは「一時ファイルに書いてからrename」で、途中で落ちてもファイルが壊れない。
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ACCOUNTS_PATH, SECRET_PATH, AUTH } = require("../config");

let db = { accounts: {} }; // usernameLower -> { id, username, salt, hash, createdAt, save }
let secret = null;
let saveTimer = null;

// ---------- 永続化 ----------
function load() {
    try {
        if (fs.existsSync(ACCOUNTS_PATH)) {
            const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_PATH, "utf8"));
            if (parsed && parsed.accounts) db = parsed;
        }
    } catch (err) {
        // 壊れたファイルを上書きして全アカウントを失わないよう、退避してから空で開始する
        console.error("[accounts] load failed:", err.message);
        try { fs.copyFileSync(ACCOUNTS_PATH, ACCOUNTS_PATH + ".broken-" + Date.now()); } catch (_) { /* ignore */ }
    }

    if (process.env.AUTH_SECRET) {
        secret = process.env.AUTH_SECRET;
    } else {
        try {
            secret = fs.readFileSync(SECRET_PATH, "utf8").trim();
        } catch (_) {
            secret = crypto.randomBytes(32).toString("hex");
            fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
            fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
        }
    }
    console.log(`[accounts] loaded ${Object.keys(db.accounts).length} account(s)`);
}

function writeNow() {
    saveTimer = null;
    const tmp = ACCOUNTS_PATH + ".tmp";
    try {
        fs.mkdirSync(path.dirname(ACCOUNTS_PATH), { recursive: true });
        fs.writeFileSync(tmp, JSON.stringify(db));
        fs.renameSync(tmp, ACCOUNTS_PATH);
    } catch (err) {
        console.error("[accounts] write failed:", err.message);
    }
}

// セーブは頻繁に来るので、少しまとめてから書く
function scheduleWrite(immediate = false) {
    if (immediate) {
        if (saveTimer) clearTimeout(saveTimer);
        writeNow();
        return;
    }
    if (!saveTimer) saveTimer = setTimeout(writeNow, 1500);
}

function flush() {
    if (saveTimer) { clearTimeout(saveTimer); writeNow(); }
}

// ---------- 検証 ----------
function validateUsername(username) {
    if (typeof username !== "string") return "ユーザー名を入力してください";
    if (!AUTH.USERNAME_PATTERN.test(username)) {
        return `ユーザー名は半角英数字・_・- の ${AUTH.USERNAME_MIN}〜${AUTH.USERNAME_MAX} 文字にしてください`;
    }
    return null;
}

function validatePassword(password) {
    if (typeof password !== "string") return "パスワードを入力してください";
    if (password.length < AUTH.PASSWORD_MIN || password.length > AUTH.PASSWORD_MAX) {
        return `パスワードは ${AUTH.PASSWORD_MIN}〜${AUTH.PASSWORD_MAX} 文字にしてください`;
    }
    return null;
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(account, password) {
    const expected = Buffer.from(account.hash, "hex");
    const actual = Buffer.from(hashPassword(password, account.salt), "hex");
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ---------- トークン ----------
function sign(payloadB64) {
    return crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function issueToken(account) {
    const payload = Buffer.from(JSON.stringify({
        id: account.id,
        exp: Date.now() + AUTH.TOKEN_TTL_MS,
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
}

// トークンから { id, username } を返す。無効・期限切れ・存在しないアカウントは null
function verifyToken(token) {
    if (typeof token !== "string" || token.length > 600) return null;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;

    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

    let data;
    try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch (_) { return null; }
    if (!data || !data.id || !(data.exp > Date.now())) return null;

    const account = findById(data.id);
    return account ? { id: account.id, username: account.username } : null;
}

function findById(id) {
    return Object.values(db.accounts).find(a => a.id === id) || null;
}

// ---------- ログイン試行の制限（総当たり対策） ----------
const failures = new Map(); // key -> { count, lockedUntil }

function checkLock(key) {
    const f = failures.get(key);
    if (f && f.lockedUntil > Date.now()) {
        return Math.ceil((f.lockedUntil - Date.now()) / 1000);
    }
    return 0;
}

function recordFailure(key) {
    const f = failures.get(key) || { count: 0, lockedUntil: 0 };
    f.count += 1;
    if (f.count >= AUTH.MAX_FAILED_ATTEMPTS) {
        f.lockedUntil = Date.now() + AUTH.LOCK_MS;
        f.count = 0;
    }
    failures.set(key, f);
}

// ---------- 公開API ----------
function publicSession(account) {
    return {
        token: issueToken(account),
        username: account.username,
        playerId: account.id,
        save: account.save || null,
    };
}

// legacySave: 以前この端末のlocalStorageに保存していたデータの引き継ぎ用（新規登録時のみ）
function register(username, password, legacySave = null) {
    const uErr = validateUsername(username);
    if (uErr) return { error: uErr };
    const pErr = validatePassword(password);
    if (pErr) return { error: pErr };

    const key = username.toLowerCase();
    if (db.accounts[key]) return { error: "そのユーザー名は既に使われています" };

    const salt = crypto.randomBytes(16).toString("hex");
    const account = {
        id: "u-" + crypto.randomBytes(8).toString("hex"),
        username,
        salt,
        hash: hashPassword(password, salt),
        createdAt: Date.now(),
        save: null,
    };

    if (legacySave && sanitizeSave(legacySave)) {
        account.save = { ...sanitizeSave(legacySave), updatedAt: Date.now() };
    }

    db.accounts[key] = account;
    scheduleWrite(true);
    return { session: publicSession(account) };
}

function login(username, password, ip = "") {
    const key = String(username || "").toLowerCase();
    const lockKey = `${ip}|${key}`;
    const wait = checkLock(lockKey);
    if (wait) return { error: `ログインに連続で失敗しました。${wait}秒後にもう一度お試しください` };

    const account = db.accounts[key];
    // アカウントが無い場合もハッシュ計算を行い、応答時間でユーザーの存在が分からないようにする
    const ok = account
        ? verifyPassword(account, String(password || ""))
        : (hashPassword(String(password || ""), "0".repeat(32)), false);

    if (!ok) {
        recordFailure(lockKey);
        return { error: "ユーザー名またはパスワードが違います" };
    }
    failures.delete(lockKey);
    return { session: publicSession(account) };
}

function restore(token) {
    const who = verifyToken(token);
    if (!who) return { error: "セッションの有効期限が切れました。もう一度ログインしてください" };
    const account = findById(who.id);
    return { session: publicSession(account) };
}

function changePassword(token, oldPassword, newPassword) {
    const who = verifyToken(token);
    if (!who) return { error: "ログインが必要です" };
    const pErr = validatePassword(newPassword);
    if (pErr) return { error: pErr };

    const account = findById(who.id);
    if (!verifyPassword(account, String(oldPassword || ""))) return { error: "現在のパスワードが違います" };

    account.salt = crypto.randomBytes(16).toString("hex");
    account.hash = hashPassword(newPassword, account.salt);
    scheduleWrite(true);
    return { session: publicSession(account) };
}

// セーブデータとして受け付ける形かを確認する。サイズ上限もここで見る。
function sanitizeSave(save) {
    if (!save || typeof save !== "object") return null;
    const stats = save.stats && typeof save.stats === "object" ? save.stats : null;
    const quests = save.quests && typeof save.quests === "object" ? save.quests : {};
    if (!stats) return null;
    if (JSON.stringify({ stats, quests }).length > AUTH.MAX_SAVE_BYTES) return null;
    return { stats, quests };
}

function setSave(id, save) {
    const account = findById(id);
    if (!account) return { error: "アカウントが見つかりません" };
    const clean = sanitizeSave(save);
    if (!clean) return { error: "セーブデータが不正、または大きすぎます" };
    account.save = { ...clean, updatedAt: Date.now() };
    scheduleWrite();
    return { ok: true, updatedAt: account.save.updatedAt };
}

// 「最初から」を選んだとき用
function clearSave(id) {
    const account = findById(id);
    if (!account) return { error: "アカウントが見つかりません" };
    account.save = null;
    scheduleWrite(true);
    return { ok: true };
}

module.exports = {
    load, flush, register, login, restore, changePassword,
    verifyToken, setSave, clearSave,
};
