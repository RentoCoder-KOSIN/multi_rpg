// アカウント保存先: data/accounts.json（DATABASE_URL が無いときのローカル開発用）
// 書き込みは「一時ファイルに書いてからrename」で、途中で落ちてもファイルが壊れない。
const fs = require("fs");
const path = require("path");
const { ACCOUNTS_PATH } = require("../config");

let db = { accounts: {} }; // usernameLower -> account
let saveTimer = null;

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

function findById(id) {
    return Object.values(db.accounts).find(a => a.id === id) || null;
}

module.exports = {
    name: "file",

    async init() {
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
        return Object.keys(db.accounts).length;
    },

    async getByName(lower) { return db.accounts[lower] || null; },
    async getById(id) { return findById(id); },

    async insert(account) {
        const key = account.username.toLowerCase();
        if (db.accounts[key]) return false;
        db.accounts[key] = account;
        scheduleWrite(true);
        return true;
    },

    async updateCredentials(id, salt, hash) {
        const a = findById(id);
        if (!a) return;
        a.salt = salt;
        a.hash = hash;
        scheduleWrite(true);
    },

    async setSave(id, save) {
        const a = findById(id);
        if (!a) return false;
        a.save = save;
        // 「最初から」(save=null)は即時、通常のセーブはまとめて書く
        scheduleWrite(save === null);
        return true;
    },

    async flush() {
        if (saveTimer) { clearTimeout(saveTimer); writeNow(); }
    },
};
