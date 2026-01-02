const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "..", "client")));
app.use(express.json());

/* =====================
   データ
===================== */
const players = {};          // socketId -> { x, y, map }
const enemies = {};          // mapKey -> { enemyId -> enemy }
const enemySpawnPoints = {}; // mapKey -> spawnPoints

const lobbyPlayers = {};     // socketId -> { name, ready }
const playerNames = {};     // socketId -> name

/* =====================
   敵スポーン読み込み
===================== */
function loadEnemySpawnPointsFromMap(mapKey) {
    const mapPath = path.join(__dirname, "..", "client", "assets", "maps", `${mapKey}.json`);
    if (!fs.existsSync(mapPath)) return [];

    const mapData = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const layer = mapData.layers?.find(l => l.name === "enemy_spawn");
    if (!layer) return [];

    return layer.objects.map(o => ({
        x: o.x,
        y: o.y,
        type: o.properties?.find(p => p.name === "type")?.value || "slime",
        respawnDelay: o.properties?.find(p => p.name === "respawnDelay")?.value || 5000,
        id: o.id
    }));
}

function generateId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* =====================
   敵ステータス
===================== */
const ENEMY_STATS = {
    slime: { hp: 30, atk: 5, exp: 12, gold: 5, drops: [{ id: 'potion', chance: 0.1 }, { id: 'mp_potion', chance: 0.1 }] },
    bat: { hp: 45, atk: 8, exp: 35, gold: 7, drops: [{ id: 'potion', chance: 0.15 }, { id: 'mp_potion', chance: 0.1 }] },
    forest_slime: { hp: 100, atk: 15, exp: 120, gold: 25, drops: [{ id: 'potion', chance: 0.2 }, { id: 'mp_potion', chance: 0.15 }] },
    skeleton: { hp: 150, atk: 25, exp: 250, gold: 40, drops: [{ id: 'high_potion', chance: 0.05 }, { id: 'mp_potion', chance: 0.1 }] },
    red_slime: { hp: 200, atk: 35, exp: 350, gold: 60, drops: [{ id: 'high_potion', chance: 0.1 }, { id: 'high_mp_potion', chance: 0.05 }] },
    goblin: { hp: 280, atk: 45, exp: 450, gold: 120, drops: [{ id: 'high_potion', chance: 0.15 }, { id: 'high_mp_potion', chance: 0.1 }] },
    ghost: { hp: 350, atk: 55, exp: 650, gold: 320, drops: [{ id: 'high_potion', chance: 0.1 }, { id: 'high_mp_potion', chance: 0.1 }] },
    orc: { hp: 500, atk: 75, exp: 1000, gold: 1000, drops: [{ id: 'high_potion', chance: 0.2 }, { id: 'high_mp_potion', chance: 0.2 }] },
    dire_wolf: { hp: 750, atk: 100, exp: 1800, gold: 1400, drops: [{ id: 'high_potion', chance: 0.3 }, { id: 'high_mp_potion', chance: 0.3 }] },
    boss: { hp: 3000, atk: 180, exp: 8000, gold: 25000, drops: [{ id: 'hero_sword', chance: 0.1 }, { id: 'high_potion', chance: 1.0 }, { id: 'high_mp_potion', chance: 1.0 }] },
    dragon_boss: { hp: 8000, atk: 350, exp: 25000, gold: 100000, drops: [{ id: 'dragon_scale_armor', chance: 0.2 }, { id: 'high_potion', chance: 1.0 }, { id: 'high_mp_potion', chance: 1.0 }] }
};

function getEnemyStats(type) {
    return ENEMY_STATS[type] || ENEMY_STATS.slime;
}

/* =====================
   敵管理
===================== */
function spawnEnemy(mapKey, sp) {
    if (!enemies[mapKey]) enemies[mapKey] = {};
    const id = generateId(sp.type);
    const stats = getEnemyStats(sp.type);

    const enemy = {
        id,
        type: sp.type,
        x: sp.x,
        y: sp.y,
        spawnX: sp.x,
        spawnY: sp.y,
        spawnId: sp.id,
        respawnDelay: sp.respawnDelay,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        exp: stats.exp,
        gold: stats.gold,
        drops: stats.drops
    };

    enemies[mapKey][id] = enemy;
    io.to(`map:${mapKey}`).emit("enemySpawned", enemy);
}

function getEnemiesOnMap(mapKey) {
    return Object.values(enemies[mapKey] || {});
}

/* =====================
   起動時 初期化
===================== */
const knownMaps = ["tutorial", "city", "battle", "forest", "guild1f", "guild2f", "wetland"];

knownMaps.forEach(mapKey => {
    const spawns = loadEnemySpawnPointsFromMap(mapKey);
    enemySpawnPoints[mapKey] = spawns;
    spawns.forEach(sp => spawnEnemy(mapKey, sp));
});

/* =====================
   サーバー側 更新ループ (敵の移動など)
===================== */
setInterval(() => {
    knownMaps.forEach(mapKey => {
        const mapEnemies = enemies[mapKey];
        if (!mapEnemies) return;

        Object.values(mapEnemies).forEach(enemy => {
            // ボスは移動させないか、別のロジックにする（今回は通常敵のみ移動）
            if (enemy.type === 'boss') return;

            // スポーン地点から離れすぎないように制限
            const dist = Math.sqrt(Math.pow(enemy.x - enemy.spawnX, 2) + Math.pow(enemy.y - enemy.spawnY, 2));
            if (dist > 150) {
                // スポーン地点の方へ戻る
                const angle = Math.atan2(enemy.spawnY - enemy.y, enemy.spawnX - enemy.x);
                enemy.x += Math.cos(angle) * 15;
                enemy.y += Math.sin(angle) * 15;
            } else {
                // ランダムに少し移動
                enemy.x += (Math.random() - 0.5) * 10;
                enemy.y += (Math.random() - 0.5) * 10;
            }

            // 全プレイヤーに位置を同期
            io.to(`map:${mapKey}`).emit("enemyMoved", {
                id: enemy.id,
                x: enemy.x,
                y: enemy.y
            });
        });
    });
}, 2000); // 2秒おきに移動方向などを更新（あるいは小刻みに移動）

/* =====================
   Socket.IO
===================== */
io.on("connection", socket => {
    const playerId = socket.handshake.auth?.playerId || socket.id;
    console.log("[connect]", socket.id, "playerId:", playerId);

    socket.data.playerId = playerId;
    socket.data.map = null;
    socket.data.inLobby = false;

    // 初回接続時はマップに参加せず、クライアントからのlobbyJoinまたはnewPlayerイベントを待つ

    /* ===== ロビー ===== */
    socket.on("lobbyJoin", () => {
        console.log("[lobbyJoin]", socket.id);
        socket.data.inLobby = true;
        socket.data.map = "lobby";
        socket.join("lobby");

        // プレイヤーデータを初期化（ロビー用）
        players[socket.data.playerId] = { x: 0, y: 0, map: "lobby", hp: 100, maxHp: 100, level: 1, summon: null };

        lobbyPlayers[socket.data.playerId] = {
            name: `Player ${(socket.data.playerId).slice(0, 5)}`,
            ready: false
        };
        playerNames[socket.data.playerId] = lobbyPlayers[socket.data.playerId].name;

        io.to("lobby").emit("lobbyInfo", {
            players: lobbyPlayers,
            playerNames,
            readyPlayers: Object.keys(lobbyPlayers).filter(id => lobbyPlayers[id].ready)
        });

        // 他のロビープレイヤーに新しいプレイヤーの参加を通知
        socket.to("lobby").emit("lobbyPlayerJoined", {
            socketId: socket.data.playerId,
            players: lobbyPlayers,
            playerNames
        });
    });

    socket.on("playerNameUpdate", ({ name }) => {
        if (!lobbyPlayers[socket.data.playerId]) return;
        lobbyPlayers[socket.data.playerId].name = name;
        playerNames[socket.data.playerId] = name;
        io.to("lobby").emit("lobbyPlayerNameUpdate", { socketId: socket.data.playerId, name });
    });

    socket.on("lobbyReady", ({ ready }) => {
        if (!lobbyPlayers[socket.data.playerId]) return;
        lobbyPlayers[socket.data.playerId].ready = ready;
        io.to("lobby").emit("lobbyPlayerReady", { socketId: socket.data.playerId, ready });
    });

    socket.on("lobbyKick", ({ targetId }) => {
        // 簡易的なホスト判定: 最小のIDを持つプレイヤーをホストとする
        const ids = Object.keys(lobbyPlayers).sort();
        if (ids[0] !== socket.data.playerId) {
            console.log("[lobbyKick] Denied: Only host can kick. Host:", ids[0], "Requester:", socket.data.playerId);
            return;
        }

        if (lobbyPlayers[targetId]) {
            console.log("[lobbyKick] Kicking:", targetId);
            const targetSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === targetId);
            if (targetSocket) {
                targetSocket.emit("lobbyKicked");
                targetSocket.leave("lobby");
                targetSocket.data.inLobby = false;
                delete lobbyPlayers[targetId];
                delete playerNames[targetId];
                io.to("lobby").emit("lobbyPlayerLeft", { players: lobbyPlayers });
            }
        }
    });

    socket.on("lobbyStartGame", () => {
        const ids = Object.keys(lobbyPlayers);
        if (ids.length === 0) return;

        const allReady = ids.every(id => lobbyPlayers[id].ready);
        if (!allReady) return;

        io.to("lobby").emit("lobbyGameStarted");

        ids.forEach(id => {
            const s = io.sockets.sockets.get(id);
            if (s) {
                s.leave("lobby");
                s.data.inLobby = false;
            }
            delete lobbyPlayers[id];
        });
    });

    /* ===== プレイヤー ===== */
    socket.on("playerMove", ({ x, y }) => {
        if (!players[socket.data.playerId]) return;
        players[socket.data.playerId].x = x;
        players[socket.data.playerId].y = y;

        socket.to(`map:${socket.data.map}`).emit("playerMoved", {
            id: socket.data.playerId,
            pos: { x, y }
        });
    });

    socket.on("playerStatsUpdate", ({ hp, maxHp, level }) => {
        if (!players[socket.data.playerId]) return;
        if (hp !== undefined) players[socket.data.playerId].hp = hp;
        if (maxHp !== undefined) players[socket.data.playerId].maxHp = maxHp;
        if (level !== undefined) players[socket.data.playerId].level = level;

        socket.to(`map:${socket.data.map}`).emit("playerStatUpdate", {
            id: socket.data.playerId,
            hp: players[socket.data.playerId].hp,
            maxHp: players[socket.data.playerId].maxHp,
            level: players[socket.data.playerId].level
        });
    });

    socket.on("summonUpdate", (data) => {
        const p = players[socket.data.playerId];
        if (!p) return;

        if (data.type === 'spawn') {
            p.summon = { active: true, isMega: data.isMega, x: data.x, y: data.y };
        } else if (data.type === 'move') {
            if (p.summon) {
                p.summon.x = data.x;
                p.summon.y = data.y;
            }
        } else if (data.type === 'despawn') {
            p.summon = null;
        }

        socket.to(`map:${socket.data.map}`).emit("summonUpdate", {
            id: socket.data.playerId,
            ...data
        });
    });

    socket.on("newPlayer", ({ x, y, mapKey, hp, maxHp, level }) => {
        console.log("[newPlayer]", socket.id, "playerId:", socket.data.playerId, "map:", mapKey);

        const oldMap = socket.data.map;
        if (oldMap && oldMap !== mapKey) {
            socket.leave(`map:${oldMap}`);
        }

        socket.data.map = mapKey;
        socket.join(`map:${mapKey}`);
        players[socket.data.playerId] = {
            x, y, map: mapKey,
            hp: hp || 100, maxHp: maxHp || 100,
            level: level || 1,
            summon: null // 新規参加時は召喚獣なし（あるいはクライアントから送ってもらうべきだが、一旦なしで）
        };

        // 最新の動的情報を送信
        socket.emit("currentPlayers", getPlayersOnMap(mapKey));
        socket.emit("currentEnemies", getEnemiesOnMap(mapKey));

        // 同じマップの他のプレイヤーに新しいプレイヤーを通知
        socket.to(`map:${mapKey}`).emit("newPlayer", {
            id: socket.data.playerId,
            x,
            y,
            hp: hp || 100,
            maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        });
    });

    socket.on("mapChange", ({ mapKey, x, y, hp, maxHp, level }) => {
        const oldMap = socket.data.map;
        if (oldMap === mapKey) return;

        socket.leave(`map:${oldMap}`);
        socket.to(`map:${oldMap}`).emit("playerDisconnected", socket.data.playerId);

        socket.data.map = mapKey;
        socket.join(`map:${mapKey}`);

        // マップ変更時、召喚獣は一旦リセットされることが多いが、維持するならクライアントがこのあと spawn を送る
        players[socket.data.playerId] = {
            x, y, map: mapKey,
            hp: hp || 100, maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        };

        socket.emit("currentPlayers", getPlayersOnMap(mapKey));
        socket.emit("currentEnemies", getEnemiesOnMap(mapKey));

        socket.to(`map:${mapKey}`).emit("newPlayer", {
            id: socket.data.playerId,
            x,
            y,
            hp: hp || 100,
            maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        });
    });

    /* ===== 敵関連 ===== */
    socket.on("enemyHit", ({ id, damage }) => {
        const mapKey = socket.data.map;
        const enemy = enemies[mapKey]?.[id];
        if (!enemy) return;

        enemy.hp -= damage;

        if (enemy.hp <= 0) {
            // 撃破処理
            // 撃破処理
            delete enemies[mapKey][id];

            const drops = [];
            if (enemy.drops) {
                enemy.drops.forEach(drop => {
                    if (Math.random() < drop.chance) {
                        drops.push(drop.id);
                    }
                });
            }

            io.to(`map:${mapKey}`).emit("enemyDefeated", {
                id,
                type: enemy.type,
                killedBy: socket.data.playerId,
                exp: enemy.exp,
                gold: enemy.gold,
                drops: drops
            });

            setTimeout(() => {
                spawnEnemy(mapKey, enemy);
            }, enemy.respawnDelay);
        } else {
            // HP更新の通知
            io.to(`map:${mapKey}`).emit("enemyStatUpdate", {
                id,
                hp: enemy.hp,
                maxHp: enemy.maxHp
            });
        }
    });

    /* ===== 敵撃破 ===== */
    socket.on("enemyDefeat", ({ id }) => {
        const mapKey = socket.data.map;
        const enemy = enemies[mapKey]?.[id];
        if (!enemy) return;

        delete enemies[mapKey][id];

        const drops = [];
        if (enemy.drops) {
            enemy.drops.forEach(drop => {
                if (Math.random() < drop.chance) {
                    drops.push(drop.id);
                }
            });
        }

        io.to(`map:${mapKey}`).emit("enemyDefeated", {
            id,
            type: enemy.type,
            killedBy: socket.data.playerId,
            exp: enemy.exp,
            gold: enemy.gold,
            drops: drops
        });

        setTimeout(() => {
            spawnEnemy(mapKey, enemy);
        }, enemy.respawnDelay);
    });

    /* ===== 切断 ===== */
    socket.on("disconnect", () => {
        console.log("[disconnect]", socket.id, "playerId:", socket.data.playerId);

        const mapKey = socket.data.map;
        delete players[socket.data.playerId];

        if (lobbyPlayers[socket.data.playerId]) {
            delete lobbyPlayers[socket.data.playerId];
            delete playerNames[socket.data.playerId];
            io.to("lobby").emit("lobbyPlayerLeft", { players: lobbyPlayers });
        }

        // マップに参加していた場合のみ通知
        if (mapKey) {
            socket.to(`map:${mapKey}`).emit("playerDisconnected", socket.data.playerId);
        }
    });
});

/* =====================
   util
===================== */
function getPlayersOnMap(mapKey) {
    const result = {};
    for (const id in players) {
        if (players[id].map === mapKey) {
            result[id] = players[id];
        }
    }
    return result;
}

/* ===================== */
server.listen(3000, () => {
    console.log("Server running http://localhost:3000");
});
