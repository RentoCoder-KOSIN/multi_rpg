// 既存の data/accounts.json（ローカルで作ったアカウントとセーブ）を PostgreSQL に取り込む。
//
//   DATABASE_URL="postgres://..." npm run import-accounts            # data/accounts.json を取り込む
//   DATABASE_URL="postgres://..." node tools/importAccounts.js 別のパス.json
//
// - 同じユーザー名が既にDBにある場合は上書きせずスキップする（何度実行しても安全）。
// - パスワードはハッシュのまま移行するので、ユーザーは今までのパスワードでログインできる。
const fs = require("fs");
const path = require("path");
const db = require("../services/db");

async function main() {
    if (!db.enabled()) {
        console.error("DATABASE_URL が設定されていません。");
        process.exit(1);
    }

    const file = process.argv[2] || path.join(__dirname, "..", "data", "accounts.json");
    if (!fs.existsSync(file)) {
        console.error("ファイルが見つかりません:", file);
        process.exit(1);
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = Object.values((parsed && parsed.accounts) || {});

    await db.migrate();

    let added = 0, skipped = 0;
    for (const a of list) {
        const r = await db.query(
            `INSERT INTO accounts (id, username, username_lower, salt, hash, created_at, save)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
             ON CONFLICT DO NOTHING`,
            [a.id, a.username, a.username.toLowerCase(), a.salt, a.hash, a.createdAt || Date.now(),
             a.save ? JSON.stringify(a.save) : null]
        );
        if (r.rowCount === 1) added++; else skipped++;
    }
    console.log(`取り込み完了: 追加 ${added} 件 / スキップ(既存) ${skipped} 件 (合計 ${list.length} 件)`);
    await db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
