const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { PORT, CLIENT_DIR } = require("./config");
const { aiManager, loadAIData, saveAIData } = require("./services/aiStorage");
const { createEnemyService } = require("./services/enemyService");
const { createPartyService } = require("./services/partyService");
const { startEnemyLoop } = require("./services/enemyLoop");
const { registerConnectionHandler } = require("./handlers");
const { getPublicEnemyStats } = require("./data/enemyStats");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(CLIENT_DIR));
app.use(express.json());

// Enemy stats are owned by the server; the client fetches them at boot.
app.get("/api/enemy-stats", (req, res) => {
    res.json(getPublicEnemyStats());
});

// --- 起動時の初期化 ---
loadAIData();

const enemyService = createEnemyService({ io, aiManager });
const partyService = createPartyService({ io });

enemyService.spawnInitialEnemies();
startEnemyLoop({ io, aiManager, saveAIData });

registerConnectionHandler({ io, aiManager, enemyService, partyService });

server.listen(PORT, () => {
    console.log(`Server running http://localhost:${PORT}`);
});
