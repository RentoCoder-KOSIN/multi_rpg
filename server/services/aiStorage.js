const fs = require("fs");
const { ServerEnemyAIManager } = require("../ai/ServerEnemyAI");
const { AI_DATA_PATH } = require("../config");

const aiManager = new ServerEnemyAIManager();

// 起動時に保存済みの学習データを読み込む
function loadAIData() {
    try {
        if (!fs.existsSync(AI_DATA_PATH)) return;

        const parsed = JSON.parse(fs.readFileSync(AI_DATA_PATH, "utf8"));
        aiManager.loadFromData(parsed);
        console.log("[ServerAI] Loaded AI models from disk:", Object.keys(parsed));
    } catch (e) {
        console.error("[ServerAI] Failed to load AI data:", e);
    }
}

// 学習データを保存する（aiManager.checkAutoSave から定期的に呼ばれる）
function saveAIData(data) {
    try {
        fs.writeFileSync(AI_DATA_PATH, JSON.stringify(data, null, 2), "utf8");
        console.log("[ServerAI] AI models saved. Types:", Object.keys(data).join(", "));
    } catch (e) {
        console.error("[ServerAI] Failed to save AI data:", e);
    }
}

module.exports = { aiManager, loadAIData, saveAIData };
