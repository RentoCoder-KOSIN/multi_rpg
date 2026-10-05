// PostgreSQL への接続とテーブル作成。
// 環境変数 DATABASE_URL があるときだけ有効になる（Renderでは自動で設定される）。
// 無いとき(ローカル開発など)は、従来どおり data/ 以下のJSONファイルに保存する。
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "";
let pool = null;

function enabled() {
    return !!DATABASE_URL;
}

// ローカルのDBや PGSSLMODE=disable のときはSSLなし、それ以外(Renderの外部接続など)はSSLありで接続する
function sslOption() {
    if (process.env.PGSSLMODE === "disable") return false;
    try {
        const host = new URL(DATABASE_URL).hostname;
        if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    } catch (_) { /* URLとして読めない場合はSSLありにする */ }
    return { rejectUnauthorized: false };
}

function getPool() {
    if (!pool) {
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: sslOption(),
            max: Number(process.env.PG_POOL_MAX) || 5,
            idleTimeoutMillis: 10000, // 休止したDBに切られた古い接続を持ち続けないよう、早めに閉じる
            connectionTimeoutMillis: 10000,
        });
        // 接続が切れてもプロセスごと落ちないようにする
        pool.on("error", err => console.error("[db] pool error:", err.message));
    }
    return pool;
}

// 接続まわりの一時的なエラー（休止からの復帰中・接続切れ）かどうか
function isTransient(err) {
    const code = err && err.code;
    return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "57P03", "08006", "08003", "08001"].includes(code)
        || /Connection terminated|timeout exceeded when trying to connect/i.test((err && err.message) || "");
}

// 休止中のDBを起こす1回目だけ失敗することがあるので、一時的なエラーなら1回だけやり直す
async function query(text, params) {
    try {
        return await getPool().query(text, params);
    } catch (err) {
        if (!isTransient(err)) throw err;
        await new Promise(r => setTimeout(r, 1000));
        return getPool().query(text, params);
    }
}

// 起動時にテーブルを（無ければ）作る。何度実行しても安全。
async function migrate() {
    await query(`
        CREATE TABLE IF NOT EXISTS accounts (
            id             TEXT PRIMARY KEY,
            username       TEXT NOT NULL,
            username_lower TEXT NOT NULL UNIQUE,
            salt           TEXT NOT NULL,
            hash           TEXT NOT NULL,
            created_at     BIGINT NOT NULL,
            save           JSONB
        )
    `);
    // 敵AIの学習データやトークン署名用の秘密鍵など、小さな設定値の置き場
    await query(`
        CREATE TABLE IF NOT EXISTS kv (
            key        TEXT PRIMARY KEY,
            value      JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
}

async function kvGet(key) {
    const r = await query("SELECT value FROM kv WHERE key = $1", [key]);
    return r.rows[0] ? r.rows[0].value : null;
}

async function kvSet(key, value) {
    await query(
        `INSERT INTO kv (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)]
    );
}

// 無ければ作る（同時起動しても先に入った方が勝つ）。常に保存されている値を返す。
async function kvSetIfAbsent(key, value) {
    await query(
        "INSERT INTO kv (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING",
        [key, JSON.stringify(value)]
    );
    return kvGet(key);
}

async function close() {
    if (pool) { const p = pool; pool = null; await p.end(); }
}

module.exports = { enabled, query, migrate, kvGet, kvSet, kvSetIfAbsent, close };
