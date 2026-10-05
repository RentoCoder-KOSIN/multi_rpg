const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const os = require("os");
const { PORT, HOST, CLIENT_DIR } = require("./config");
const { aiManager, loadAIData, saveAIData, flushAIData } = require("./services/aiStorage");
const { createEnemyService } = require("./services/enemyService");
const { createPartyService } = require("./services/partyService");
const { startEnemyLoop } = require("./services/enemyLoop");
const { registerConnectionHandler } = require("./handlers");
const { getPublicEnemyStats } = require("./data/enemyStats");
const { getPublicMaps } = require("./data/maps");
const { warnAboutContent } = require("./utils/validateContent");
const accounts = require("./services/accountStore");
const db = require("./services/db");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Render などのリバースプロキシの内側で動くので、実際のクライアントIPを req.ip に入れる
// （ログイン失敗のロックがプロキシのIP1つに集中しないようにするため）
app.set("trust proxy", 1);

// Render のヘルスチェック用（DBに触れないので軽い）
app.get("/healthz", (req, res) => res.send("ok"));

app.use(express.static(CLIENT_DIR));
app.use(express.json({ limit: "1mb" }));

// Enemy stats are owned by the server; the client fetches them at boot.
app.get("/api/enemy-stats", (req, res) => {
    res.json(getPublicEnemyStats());
});

// The map list is discovered from assets/maps/*.json; the client builds its scenes from it at boot.
app.get("/api/maps", (req, res) => {
    res.json(getPublicMaps());
});

// --- アカウント / セーブ API ---
// トークンは Authorization: Bearer <token>（ページを閉じる直前の送信用に body.token も許可）
function tokenOf(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) return h.slice(7);
    return req.body && req.body.token;
}

function sendResult(res, result, failStatus = 400) {
    if (result.error) return res.status(failStatus).json({ error: result.error });
    res.json(result.session || result);
}

app.post("/api/register", async (req, res) => {
    const { username, password, legacySave } = req.body || {};
    sendResult(res, await accounts.register(username, password, legacySave));
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body || {};
    sendResult(res, await accounts.login(username, password, req.ip), 401);
});

// 保存済みトークンでの自動ログイン
app.post("/api/session", async (req, res) => {
    sendResult(res, await accounts.restore(tokenOf(req)), 401);
});

app.post("/api/change-password", async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    sendResult(res, await accounts.changePassword(tokenOf(req), oldPassword, newPassword));
});

// セーブの保存（PUT: 通常 / POST: sendBeacon 等）
async function handleSave(req, res) {
    const who = await accounts.verifyToken(tokenOf(req));
    if (!who) return res.status(401).json({ error: "ログインが必要です" });
    const { stats, quests } = req.body || {};
    sendResult(res, await accounts.setSave(who.id, { stats, quests }));
}
app.put("/api/save", handleSave);
app.post("/api/save", handleSave);

// 「最初から」を選んだとき
app.delete("/api/save", async (req, res) => {
    const who = await accounts.verifyToken(tokenOf(req));
    if (!who) return res.status(401).json({ error: "ログインが必要です" });
    sendResult(res, await accounts.clearSave(who.id));
});

// API内で想定外のエラー(DB障害など)が起きたとき、JSONで返す（クライアントはメッセージを表示できる）
app.use((err, req, res, next) => {
    console.error("[api error]", err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: "サーバーでエラーが発生しました。しばらくしてからもう一度お試しください" });
});

// --- 起動時の初期化 ---
async function main() {
    warnAboutContent();
    await accounts.load();   // DBへの接続とテーブル作成。失敗したら起動を止める
    await loadAIData();

    const enemyService = createEnemyService({ io, aiManager });
    const partyService = createPartyService({ io });

    enemyService.spawnInitialEnemies();
    startEnemyLoop({ io, aiManager, saveAIData });

    registerConnectionHandler({ io, aiManager, enemyService, partyService });

    server.listen(PORT, HOST, () => {
        console.log(`Server running http://localhost:${PORT}`);
        if (HOST === "0.0.0.0" && !process.env.RENDER) {
            getLanAddresses().forEach(ip => console.log(`  LAN: http://${ip}:${PORT}`));
        }
    });
}

// IPv4 addresses of this machine that other PCs on the LAN can use
function getLanAddresses() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter(i => i.family === "IPv4" && !i.internal)
        .map(i => i.address);
}

// 終了時に、まだ書き込んでいないセーブ・学習データを保存してから閉じる
// （Renderは再デプロイ時に SIGTERM を送る）
let shuttingDown = false;
async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
        await accounts.flush();
        await flushAIData();
        await db.close();
    } catch (err) {
        console.error("[shutdown]", err.message);
    }
    process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// 予期しないエラーでサーバー全体が落ちないようにログだけ残す
process.on("unhandledRejection", err => console.error("[unhandledRejection]", err));

main().catch(err => {
    console.error("[startup] failed:", err);
    process.exit(1);
});
