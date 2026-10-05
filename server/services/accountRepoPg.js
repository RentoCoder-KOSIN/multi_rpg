// アカウント保存先: PostgreSQL
const db = require("./db");

function toAccount(r) {
    if (!r) return null;
    return {
        id: r.id,
        username: r.username,
        salt: r.salt,
        hash: r.hash,
        createdAt: Number(r.created_at),
        save: r.save || null,
    };
}

module.exports = {
    name: "postgres",

    async init() {
        await db.migrate();
        const r = await db.query("SELECT count(*)::int AS n FROM accounts");
        return r.rows[0].n;
    },

    async getByName(lower) {
        const r = await db.query("SELECT * FROM accounts WHERE username_lower = $1", [lower]);
        return toAccount(r.rows[0]);
    },

    async getById(id) {
        const r = await db.query("SELECT * FROM accounts WHERE id = $1", [id]);
        return toAccount(r.rows[0]);
    },

    // 同じユーザー名が既にあれば false（同時登録でも二重にならない）
    async insert(account) {
        const r = await db.query(
            `INSERT INTO accounts (id, username, username_lower, salt, hash, created_at, save)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
             ON CONFLICT DO NOTHING`,
            [
                account.id, account.username, account.username.toLowerCase(),
                account.salt, account.hash, account.createdAt,
                account.save ? JSON.stringify(account.save) : null,
            ]
        );
        return r.rowCount === 1;
    },

    async updateCredentials(id, salt, hash) {
        await db.query("UPDATE accounts SET salt = $2, hash = $3 WHERE id = $1", [id, salt, hash]);
    },

    // save が null ならセーブ削除
    async setSave(id, save) {
        const r = await db.query(
            "UPDATE accounts SET save = $2::jsonb WHERE id = $1",
            [id, save ? JSON.stringify(save) : null]
        );
        return r.rowCount === 1;
    },

    async flush() { /* 即時書き込みなので不要 */ },
};
