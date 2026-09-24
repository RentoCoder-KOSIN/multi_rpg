const path = require("path");

const CLIENT_DIR = path.join(__dirname, "..", "client");

module.exports = {
    // --- サーバー ---
    PORT: process.env.PORT || 3000,

    // --- パス ---
    CLIENT_DIR,
    MAPS_DIR: path.join(CLIENT_DIR, "assets", "maps"),
    AI_DATA_PATH: path.join(__dirname, "data", "sharedAI.json"),

    // --- マップ ---
    KNOWN_MAPS: ["tutorial", "city", "battle", "forest", "guild1f", "guild2f", "wetland"],

    // --- プレイヤー初期値 ---
    DEFAULT_HP: 100,
    DEFAULT_LEVEL: 1,

    // --- パーティー ---
    DEFAULT_PARTY_ID: "party-1",
    PARTY_BROADCAST_DELAY: 500, // ms

    // --- 敵AI更新ループ ---
    AI_UPDATE_INTERVAL: 150,       // ms
    AI_STATS_LOG_INTERVAL: 30000,  // ms
    ENEMY_LEASH_RADIUS: 250,       // px: スポーン地点からこれ以上離れたら帰還
    ENEMY_HOME_SPEED: 10,          // px/tick: 帰還時の移動量
    ENEMY_ATTACK_RANGE: 80,        // px: サーバー側の攻撃判定距離
    ENEMY_WANDER_JITTER: 4         // px: AI未登録時のランダム移動幅
};
