const path = require("path");

const fs = require("fs");

const CLIENT_DIR = path.join(__dirname, "..", "client");
const MAPS_DIR = path.join(CLIENT_DIR, "assets", "maps");

// MAPS_DIR 直下の *.json のファイル名(拡張子なし)をマップキーとして返す
function discoverMaps(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.toLowerCase().endsWith(".json"))
        .map(f => f.slice(0, -".json".length))
        .sort();
}

module.exports = {
    // --- サーバー ---
    PORT: process.env.PORT || 3000,
    // 0.0.0.0 = accept connections from other PCs on the LAN (use HOST=127.0.0.1 for local-only)
    HOST: process.env.HOST || "0.0.0.0",
    // 開発用admin操作を他プレイヤーへ中継するときの認証。公開運用では環境変数で必ず変更する。
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "mrpg-070208",

    // --- パス ---
    CLIENT_DIR,
    MAPS_DIR,
    AI_DATA_PATH: path.join(__dirname, "data", "sharedAI.json"),
    // アカウントとセーブデータ（パスワードはハッシュ化済み。Gitには含めないこと）
    ACCOUNTS_PATH: process.env.ACCOUNTS_PATH || path.join(__dirname, "data", "accounts.json"),
    // トークン署名用の秘密鍵（初回起動で自動生成。環境変数 AUTH_SECRET でも指定可）
    SECRET_PATH: path.join(__dirname, "data", "auth.secret"),

    // --- アカウント ---
    AUTH: {
        USERNAME_PATTERN: /^[A-Za-z0-9_-]{3,16}$/,
        USERNAME_MIN: 3,
        USERNAME_MAX: 16,
        PASSWORD_MIN: 6,
        PASSWORD_MAX: 64,
        TOKEN_TTL_MS: 30 * 24 * 60 * 60 * 1000, // ログイン状態を保つ期間（30日）
        MAX_FAILED_ATTEMPTS: 5, // この回数連続で失敗したら一定時間ロック
        LOCK_MS: 60 * 1000,
        MAX_SAVE_BYTES: 512 * 1024, // セーブデータ1件の上限
    },

    // --- マップ ---
    // assets/maps/ に置いたTiledのJSONを自動で検出する（マップ追加時にここを編集する必要は無い）
    KNOWN_MAPS: discoverMaps(MAPS_DIR),

    // --- プレイヤー初期値 ---
    DEFAULT_HP: 100,
    DEFAULT_LEVEL: 1,

    // --- パーティー ---

    // --- 敵AI更新ループ ---
    AI_UPDATE_INTERVAL: 150, // ms
    AI_STATS_LOG_INTERVAL: 30000, // ms
    ENEMY_LEASH_RADIUS: 100, // px: スポーン地点からこれ以上離れたら帰還
    ENEMY_HOME_SPEED: 10, // px/tick: 帰還時の移動量
    ENEMY_ATTACK_RANGE: 75, // px: サーバー側の攻撃判定距離
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

    ENEMY_HP_SCALE: 4,
};
