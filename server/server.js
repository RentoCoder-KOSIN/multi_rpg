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

// IPv4 addresses of this machine that other PCs on the LAN can use
function getLanAddresses() {
    return Object.values(os.networkInterfaces())
        .flat()
        .filter(i => i.family === "IPv4" && !i.internal)
        .map(i => i.address);
}

server.listen(PORT, HOST, () => {
    console.log(`Server running http://localhost:${PORT}`);
    if (HOST === "0.0.0.0") {
        getLanAddresses().forEach(ip => console.log(`  LAN: http://${ip}:${PORT}`));
    }
});
