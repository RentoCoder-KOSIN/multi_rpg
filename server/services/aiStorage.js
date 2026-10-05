const fs = require("fs");
const { ServerEnemyAIManager } = require("../ai/ServerEnemyAI");
const { AI_DATA_PATH } = require("../config");
const db = require("./db");

const aiManager = new ServerEnemyAIManager();

const AI_KEY = "sharedAI";
// PostgreSQLへは、この間隔より頻繁には書かない。
// Neonなどは一定時間アクセスが無いとDBが自動で休止し、休止中は料金(無料枠)が減らない。
// 頻繁に書き続けると休止できず無料枠を使い切るので、間隔を空けて、変化が無いときは書かない。
const DB_WRITE_INTERVAL_MS = 5 * 60 * 1000;

let pendingData = null; // まだDBに書いていない最新の学習データ
let lastDbWrite = 0;
let lastWrittenJson = null; // 直近にDBへ書いた内容（同じ内容を書き直さないため）
let writing = false;

// 起動時に保存済みの学習データを読み込む
async function loadAIData() {
    try {
        let parsed = null;
        if (db.enabled()) {
            parsed = await db.kvGet(AI_KEY);
        } else if (fs.existsSync(AI_DATA_PATH)) {
            parsed = JSON.parse(fs.readFileSync(AI_DATA_PATH, "utf8"));
        }
        if (!parsed) return;

        aiManager.loadFromData(parsed);
        console.log(`[ServerAI] Loaded AI models from ${db.enabled() ? "database" : "disk"}:`, Object.keys(parsed));
    } catch (e) {
        console.error("[ServerAI] Failed to load AI data:", e);
    }
}

async function writeToDb() {
    if (writing || !pendingData) return;
    const data = pendingData;
    pendingData = null;
    const json = JSON.stringify(data);
    if (json === lastWrittenJson) { lastDbWrite = Date.now(); return; } // 変化なし
    writing = true;
    try {
        await db.kvSet(AI_KEY, data);
        lastWrittenJson = json;
        lastDbWrite = Date.now();
        console.log("[ServerAI] AI models saved to database. Types:", Object.keys(data).join(", "));
    } catch (e) {
        console.error("[ServerAI] Failed to save AI data:", e.message);
        if (!pendingData) pendingData = data; // 失敗した分は次回に回す
    } finally {
        writing = false;
    }
}

// 学習データを保存する（aiManager.checkAutoSave から定期的に呼ばれる）
function saveAIData(data) {
    if (db.enabled()) {
        pendingData = data;
        if (Date.now() - lastDbWrite >= DB_WRITE_INTERVAL_MS) writeToDb();
        return;
    }
    try {
        fs.writeFileSync(AI_DATA_PATH, JSON.stringify(data, null, 2), "utf8");
        console.log("[ServerAI] AI models saved. Types:", Object.keys(data).join(", "));
    } catch (e) {
        console.error("[ServerAI] Failed to save AI data:", e);
    }
}

// 終了時に、まだ書いていない学習データをDBへ
async function flushAIData() {
    if (db.enabled()) await writeToDb();
}

module.exports = { aiManager, loadAIData, saveAIData, flushAIData };
