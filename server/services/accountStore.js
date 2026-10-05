// アカウント(ユーザー登録/ログイン)とセーブデータの保存。
//
// - パスワードは scrypt + ソルトでハッシュ化して保存する（平文は保存しない）。
// - ログイン後に発行するトークンは、サーバーの秘密鍵(HMAC)で署名した自己完結型。
//   サーバーを再起動してもログイン状態が続き、セッション表は持たない。
// - 保存先は環境変数 DATABASE_URL があれば PostgreSQL、無ければ data/accounts.json。
//   （Renderのディスクは再デプロイで消えるため、公開時は必ずPostgreSQLを使う）
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { SECRET_PATH, AUTH } = require("../config");
const db = require("./db");

const scrypt = promisify(crypto.scrypt);
const repo = db.enabled() ? require("./accountRepoPg") : require("./accountRepoFile");

let secret = null;

// ---------- 初期化 ----------
async function loadSecret() {
    // 1) 環境変数  2) PostgreSQL(kv)  3) ファイル の順
    if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;

    if (db.enabled()) {
        // 再デプロイしても同じ鍵を使えるようDBに置く（鍵が変わると全員ログアウトになる）
        const stored = await db.kvSetIfAbsent("auth_secret", crypto.randomBytes(32).toString("hex"));
        return String(stored);
    }

    try {
        return fs.readFileSync(SECRET_PATH, "utf8").trim();
    } catch (_) {
        const s = crypto.randomBytes(32).toString("hex");
        fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
        fs.writeFileSync(SECRET_PATH, s, { mode: 0o600 });
        return s;
    }
}

async function load() {
    const count = await repo.init();
    secret = await loadSecret();
    console.log(`[accounts] storage=${repo.name}, ${count} account(s)`);
}

async function flush() { await repo.flush(); }

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

// scrypt は重い計算なので、非同期版を使ってゲームの処理(敵AIなど)を止めないようにする
async function hashPassword(password, salt) {
    return (await scrypt(password, salt, 64)).toString("hex");
}

async function verifyPassword(account, password) {
    const expected = Buffer.from(account.hash, "hex");
    const actual = Buffer.from(await hashPassword(password, account.salt), "hex");
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
async function verifyToken(token) {
    if (typeof token !== "string" || token.length > 600) return null;
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;

    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

    let data;
    try { data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch (_) { return null; }
    if (!data || !data.id || !(data.exp > Date.now())) return null;

    const account = await repo.getById(data.id);
    return account ? { id: account.id, username: account.username } : null;
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

// 古い記録がメモリに溜まり続けないよう、定期的に掃除する
setInterval(() => {
    const now = Date.now();
    for (const [k, f] of failures) if (f.lockedUntil < now && f.count === 0) failures.delete(k);
}, 10 * 60 * 1000).unref();

// ---------- 公開API ----------
function publicSession(account) {
    return {
        token: issueToken(account),
        username: account.username,
        playerId: account.id,
        save: account.save || null,
    };
}

// セーブデータとして受け付ける形かを確認する。サイズ上限もここで見る。
function sanitizeSave(save) {
    if (!save || typeof save !== "object") return null;
    const stats = save.stats && typeof save.stats === "object" ? save.stats : null;
    const quests = save.quests && typeof save.quests === "object" ? save.quests : {};
    if (!stats) return null;
    const json = JSON.stringify({ stats, quests });
    if (json.length > AUTH.MAX_SAVE_BYTES) return null;
    // PostgreSQL の jsonb は \u0000 を保存できないので弾く
    if (json.includes("\\u0000")) return null;
    return { stats, quests };
}

// legacySave: 以前この端末のlocalStorageに保存していたデータの引き継ぎ用（新規登録時のみ）
async function register(username, password, legacySave = null) {
    const uErr = validateUsername(username);
    if (uErr) return { error: uErr };
    const pErr = validatePassword(password);
    if (pErr) return { error: pErr };

    const salt = crypto.randomBytes(16).toString("hex");
    const account = {
        id: "u-" + crypto.randomBytes(8).toString("hex"),
        username,
        salt,
        hash: await hashPassword(password, salt),
        createdAt: Date.now(),
        save: null,
    };

    const clean = legacySave ? sanitizeSave(legacySave) : null;
    if (clean) account.save = { ...clean, updatedAt: Date.now() };

    const inserted = await repo.insert(account);
    if (!inserted) return { error: "そのユーザー名は既に使われています" };
    return { session: publicSession(account) };
}

async function login(username, password, ip = "") {
    const key = String(username || "").toLowerCase();
    const lockKey = `${ip}|${key}`;
    const wait = checkLock(lockKey);
    if (wait) return { error: `ログインに連続で失敗しました。${wait}秒後にもう一度お試しください` };

    const account = await repo.getByName(key);
    // アカウントが無い場合もハッシュ計算を行い、応答時間でユーザーの存在が分からないようにする
    const ok = account
        ? await verifyPassword(account, String(password || ""))
        : (await hashPassword(String(password || ""), "0".repeat(32)), false);

    if (!ok) {
        recordFailure(lockKey);
        return { error: "ユーザー名またはパスワードが違います" };
    }
    failures.delete(lockKey);
    return { session: publicSession(account) };
}

async function restore(token) {
    const who = await verifyToken(token);
    if (!who) return { error: "セッションの有効期限が切れました。もう一度ログインしてください" };
    const account = await repo.getById(who.id);
    if (!account) return { error: "セッションの有効期限が切れました。もう一度ログインしてください" };
    return { session: publicSession(account) };
}

async function changePassword(token, oldPassword, newPassword) {
    const who = await verifyToken(token);
    if (!who) return { error: "ログインが必要です" };
    const pErr = validatePassword(newPassword);
    if (pErr) return { error: pErr };

    const account = await repo.getById(who.id);
    if (!account) return { error: "アカウントが見つかりません" };
    if (!(await verifyPassword(account, String(oldPassword || "")))) return { error: "現在のパスワードが違います" };

    account.salt = crypto.randomBytes(16).toString("hex");
    account.hash = await hashPassword(newPassword, account.salt);
    await repo.updateCredentials(account.id, account.salt, account.hash);
    return { session: publicSession(account) };
}

async function setSave(id, save) {
    const clean = sanitizeSave(save);
    if (!clean) return { error: "セーブデータが不正、または大きすぎます" };
    const updatedAt = Date.now();
    const found = await repo.setSave(id, { ...clean, updatedAt });
    if (!found) return { error: "アカウントが見つかりません" };
    return { ok: true, updatedAt };
}

// 「最初から」を選んだとき用
async function clearSave(id) {
    const found = await repo.setSave(id, null);
    if (!found) return { error: "アカウントが見つかりません" };
    return { ok: true };
}

module.exports = {
    load, flush, register, login, restore, changePassword,
    verifyToken, setSave, clearSave,
};
