const path = require("path");

const CLIENT_DIR = path.join(__dirname, "..", "client");

module.exports = {
    // --- サーバー ---
    PORT: process.env.PORT || 3000,
    // 0.0.0.0 = accept connections from other PCs on the LAN (use HOST=127.0.0.1 for local-only)
    HOST: process.env.HOST || "0.0.0.0",

    // --- パス ---
    CLIENT_DIR,
    MAPS_DIR: path.join(CLIENT_DIR, "assets", "maps"),
    AI_DATA_PATH: path.join(__dirname, "data", "sharedAI.json"),

    // --- マップ ---
    KNOWN_MAPS: [
        "tutorial",
        "city",
        "battle",
        "forest",
        "guild1f",
        "guild2f",
        "wetland",
    ],

    // --- プレイヤー初期値 ---
    DEFAULT_HP: 100,
    DEFAULT_LEVEL: 1,

    // --- パーティー ---
    DEFAULT_PARTY_ID: "party-1",
    PARTY_BROADCAST_DELAY: 500, // ms

    // --- 敵AI更新ループ ---
    AI_UPDATE_INTERVAL: 150, // ms
    AI_STATS_LOG_INTERVAL: 30000, // ms
    ENEMY_LEASH_RADIUS: 150, // px: スポーン地点からこれ以上離れたら帰還
    ENEMY_HOME_SPEED: 10, // px/tick: 帰還時の移動量
    ENEMY_ATTACK_RANGE: 80, // px: サーバー側の攻撃判定距離
    ENEMY_WANDER_JITTER: 4, // px: AI未登録時のランダム移動幅

    // 敵の攻撃間隔（ms）。
    // 以前はAIの行動決定間隔(300ms)がそのまま攻撃間隔になっており、
    // 敵が1秒に3回以上も攻撃してくる「攻撃速度が速すぎる」状態になっていた。
    // 攻撃可否の判定とは独立したクールダウンとして明示的に管理する。
    ENEMY_ATTACK_COOLDOWN_MS: 1200,

    // 敵の攻撃力に掛ける調整係数（バランスを見て 0.0〜1.0 の間で変更可）。
    // ENEMY_STATS の atk 値自体は変えず、ここ一箇所だけ調整すれば
    // 全ての敵の攻撃力を一括で強め/弱めできる。
    ENEMY_ATK_SCALE: 0.6,
};
