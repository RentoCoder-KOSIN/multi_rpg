const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const os = require("os");
const { PORT, HOST, CLIENT_DIR } = require("./config");
const { aiManager, loadAIData, saveAIData } = require("./services/aiStorage");
const { createEnemyService } = require("./services/enemyService");
const { createPartyService } = require("./services/partyService");
const { startEnemyLoop } = require("./services/enemyLoop");
const { registerConnectionHandler } = require("./handlers");
const { getPublicEnemyStats } = require("./data/enemyStats");
const { getPublicMaps } = require("./data/maps");
const { warnAboutContent } = require("./utils/validateContent");
const accounts = require("./services/accountStore");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

app.post("/api/register", (req, res) => {
    const { username, password, legacySave } = req.body || {};
    sendResult(res, accounts.register(username, password, legacySave));
});

app.post("/api/login", (req, res) => {
    const { username, password } = req.body || {};
    sendResult(res, accounts.login(username, password, req.ip), 401);
});

// 保存済みトークンでの自動ログイン
app.post("/api/session", (req, res) => {
    sendResult(res, accounts.restore(tokenOf(req)), 401);
});

app.post("/api/change-password", (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    sendResult(res, accounts.changePassword(tokenOf(req), oldPassword, newPassword));
});

// セーブの保存（PUT: 通常 / POST: sendBeacon 等）
function handleSave(req, res) {
    const who = accounts.verifyToken(tokenOf(req));
    if (!who) return res.status(401).json({ error: "ログインが必要です" });
    const { stats, quests } = req.body || {};
    sendResult(res, accounts.setSave(who.id, { stats, quests }));
}
app.put("/api/save", handleSave);
app.post("/api/save", handleSave);

// 「最初から」を選んだとき
app.delete("/api/save", (req, res) => {
    const who = accounts.verifyToken(tokenOf(req));
    if (!who) return res.status(401).json({ error: "ログインが必要です" });
    sendResult(res, accounts.clearSave(who.id));
});

// --- 起動時の初期化 ---
warnAboutContent();
accounts.load();
loadAIData();

const enemyService = createEnemyService({ io, aiManager });
const partyService = createPartyService({ io });

enemyService.spawnInitialEnemies();
startEnemyLoop({ io, aiManager, saveAIData });

registerConnectionHandler({ io, aiManager, enemyService, partyService });

// IPv4 addresses of this machine that other PCs on the LAN can use
function getLanAddresses() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter(i => i.family === "IPv4" && !i.internal)
        .map(i => i.address);
}

// 終了時に、まだ書き込んでいないセーブをディスクへ
function shutdown() { accounts.flush(); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, HOST, () => {
    console.log(`Server running http://localhost:${PORT}`);
    if (HOST === "0.0.0.0") {
        getLanAddresses().forEach(ip => console.log(`  LAN: http://${ip}:${PORT}`));
    }
});
