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

const lobbyPlayers = {};     // socketId -> { name, ready }
const playerNames = {};     // socketId -> name

/* =====================
   AI Q-Table ストレージ（全プレイヤー共有）
===================== */
const sharedQTables = {};   // enemyType -> { qTable: Map, epsilon, episodeCount, totalReward, lastUpdate }

// Q-Tableをマージする関数
function mergeQTable(enemyType, clientQTableData) {
    if (!sharedQTables[enemyType]) {
        // 初回の場合は、クライアントのデータをそのまま使用
        sharedQTables[enemyType] = {
            qTable: new Map(clientQTableData.qTable),
            epsilon: clientQTableData.epsilon,
            episodeCount: clientQTableData.episodeCount,
            totalReward: clientQTableData.totalReward,
            lastUpdate: Date.now()
        };
        console.log(`[AI] Initialized Q-Table for ${enemyType}`);
        return;
    }

    const shared = sharedQTables[enemyType];
    const clientQTable = new Map(clientQTableData.qTable);

    // Q値をマージ（平均を取る）
    clientQTable.forEach((actionValues, stateKey) => {
        if (shared.qTable.has(stateKey)) {
            // 既存の状態の場合、Q値を平均化
            const sharedActions = shared.qTable.get(stateKey);
            const mergedActions = {};

            Object.keys(actionValues).forEach(action => {
                const clientQ = actionValues[action] || 0;
                const sharedQ = sharedActions[action] || 0;
                // 新しいデータを重視（70%新、30%旧）
                mergedActions[action] = clientQ * 0.7 + sharedQ * 0.3;
            });

            shared.qTable.set(stateKey, mergedActions);
        } else {
            // 新しい状態の場合、そのまま追加
            shared.qTable.set(stateKey, actionValues);
        }
    });

    // Epsilonは最小値を採用（より学習が進んでいる方）
    shared.epsilon = Math.min(shared.epsilon, clientQTableData.epsilon);

    // エピソード数と報酬は加算
    shared.episodeCount += clientQTableData.episodeCount;
    shared.totalReward += clientQTableData.totalReward;
    shared.lastUpdate = Date.now();

    console.log(`[AI] Merged Q-Table for ${enemyType}: ${shared.qTable.size} states, epsilon: ${shared.epsilon.toFixed(3)}`);
}

// 共有Q-Tableを取得
function getSharedQTable(enemyType) {
    if (!sharedQTables[enemyType]) {
        return null;
    }

    return {
        qTable: Array.from(sharedQTables[enemyType].qTable.entries()),
        epsilon: sharedQTables[enemyType].epsilon,
        episodeCount: sharedQTables[enemyType].episodeCount,
        totalReward: sharedQTables[enemyType].totalReward
    };
}

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
    slime: { hp: 160, atk: 7, exp: 22, gold: 50, drops: [{ id: 'potion', chance: 0.05 }, { id: 'mp_potion', chance: 0.05 }, { id: 'holy_weapon', chance: 0.002 }] },
    bat: { hp: 330, atk: 30, exp: 45, gold: 70, drops: [{ id: 'potion', chance: 0.15 }, { id: 'mp_potion', chance: 0.1 }, { id: 'holy_weapon', chance: 0.002 }] },
    forest_slime: { hp: 400, atk: 75, exp: 120, gold: 250, drops: [{ id: 'potion', chance: 0.2 }, { id: 'mp_potion', chance: 0.15 }, { id: 'holy_weapon', chance: 0.002 }] },
    skeleton: { hp: 1300, atk: 120, exp: 450, gold: 400, drops: [{ id: 'high_potion', chance: 0.05 }, { id: 'mp_potion', chance: 0.1 }, { id: 'holy_weapon', chance: 0.002 }] },
    red_slime: { hp: 2000, atk: 350, exp: 650, gold: 600, drops: [{ id: 'high_potion', chance: 0.1 }, { id: 'high_mp_potion', chance: 0.05 }, { id: 'holy_weapon', chance: 0.002 }] },
    goblin: { hp: 2800, atk: 450, exp: 950, gold: 1200, drops: [{ id: 'high_potion', chance: 0.15 }, { id: 'high_mp_potion', chance: 0.1 }, { id: 'holy_weapon', chance: 0.02 }] },
    ghost: { hp: 35000, atk: 505, exp: 1250, gold: 3200, drops: [{ id: 'high_potion', chance: 0.1 }, { id: 'high_mp_potion', chance: 0.1 }, { id: 'holy_weapon', chance: 0.002 }] },
    orc: { hp: 50000, atk: 750, exp: 1500, gold: 10000, drops: [{ id: 'high_potion', chance: 0.2 }, { id: 'high_mp_potion', chance: 0.2 }, { id: 'holy_weapon', chance: 0.002 }] },
    dire_wolf: { hp: 75000, atk: 1900, exp: 80000, gold: 14000, drops: [{ id: 'high_potion', chance: 0.3 }, { id: 'high_mp_potion', chance: 0.3 }, { id: 'holy_weapon', chance: 0.002 }] },
    boss: { hp: 3000000, atk: 18000, exp: 800000, gold: 2500000, drops: [{ id: 'hero_sword', chance: 0.1 }, { id: 'high_potion', chance: 1.0 }, { id: 'high_mp_potion', chance: 1.0 }] },
    dragon_boss: { hp: 8000000, atk: 35000, exp: 25000000, gold: 10000000, drops: [{ id: 'dragon_scale_armor', chance: 0.2 }, { id: 'high_potion', chance: 1.0 }, { id: 'high_mp_potion', chance: 1.0 }] }
};

function getEnemyStats(type) {
    return ENEMY_STATS[type] || ENEMY_STATS.slime;
}

/* =====================
   敵管理
===================== */
const enemies = {}; // roomName -> { enemyId -> enemy }
const enemySpawnPoints = {}; // mapKey -> [spawnPoints]

// インスタンス化するマップのリスト
const INSTANCED_MAPS = ["wetland", "battle"];

function getRoomName(socket, mapKey) {
    const playerId = socket.data.playerId;
    const partyId = playerToParty[playerId];

    if (INSTANCED_MAPS.includes(mapKey)) {
        // パーティを組んでいればパーティ専用ルーム、いなければ個人専用ルーム
        return `map:${mapKey}:${partyId || playerId}`;
    }
    return `map:${mapKey}`;
}

function spawnEnemy(roomName, sp, mapKey) {
    if (!enemies[roomName]) enemies[roomName] = {};
    const id = generateId(sp.type);
    const stats = getEnemyStats(sp.type);

    const spawnX = sp.spawnX !== undefined ? sp.spawnX : sp.x;
    const spawnY = sp.spawnY !== undefined ? sp.spawnY : sp.y;

    const enemy = {
        id,
        type: sp.type,
        x: spawnX,
        y: spawnY,
        spawnX: spawnX,
        spawnY: spawnY,
        spawnId: sp.spawnId || sp.id,
        respawnDelay: sp.respawnDelay,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        exp: stats.exp,
        gold: stats.gold,
        drops: stats.drops
    };

    enemies[roomName][id] = enemy;
    io.to(roomName).emit("enemySpawned", enemy);
}

function ensureRoomEnemies(roomName, mapKey) {
    if (!enemies[roomName]) {
        enemies[roomName] = {};
        const spawns = enemySpawnPoints[mapKey] || [];
        spawns.forEach(sp => spawnEnemy(roomName, sp, mapKey));
    }
}

function getEnemiesOnMap(mapKey) {
    return Object.values(enemies[mapKey] || {});
}

/* =====================
   起動時 初期化
===================== */
const knownMaps = ["tutorial", "city", "battle", "forest", "guild1f", "guild2f", "wetland"];
const parties = {}; // partyId -> { leader: socketId, members: [socketId] }
const playerToParty = {}; // socketId -> partyId

knownMaps.forEach(mapKey => {
    const spawns = loadEnemySpawnPointsFromMap(mapKey);
    enemySpawnPoints[mapKey] = spawns;

    // インスタンス化されないマップだけ、あらかじめ敵を沸かせておく
    if (!INSTANCED_MAPS.includes(mapKey)) {
        const roomName = `map:${mapKey}`; // 非インスタンスマップのルーム名は単純
        spawns.forEach(sp => spawnEnemy(roomName, sp, mapKey));
    }
});

/* =====================
   サーバー側 更新ループ (敵の移動など)
   NOTE: AI制御の敵はクライアント側で制御されるため、このループは無効化
===================== */
/*
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
*/

/* =====================
   Socket.IO
===================== */
io.on("connection", socket => {
    const playerId = socket.handshake.auth?.playerId || socket.id;
    console.log("[connect]", socket.id, "playerId:", playerId);

    socket.data.playerId = playerId;
    socket.data.map = null;
    socket.data.inLobby = false;
    socket.data.room = null; // 新しくroom情報を追加

    // 初回接続時はマップに参加せず、クライアントからのlobbyJoinまたはnewPlayerイベントを待つ

    // --- Auto Join Party ---
    const DEFAULT_PARTY_ID = 'party-1';
    if (!parties[DEFAULT_PARTY_ID]) {
        parties[DEFAULT_PARTY_ID] = {
            leader: playerId,
            members: []
        };
    }

    // パーティーに参加していなければ追加
    if (!playerToParty[playerId]) {
        parties[DEFAULT_PARTY_ID].members.push(playerId);
        playerToParty[playerId] = DEFAULT_PARTY_ID;
        console.log(`[AutoJoin] ${playerId} joined ${DEFAULT_PARTY_ID}`);
    }

    broadcastPartyUpdate(DEFAULT_PARTY_ID);

    /* ===== ロビー ===== */
    socket.on("lobbyJoin", () => {
        console.log("[lobbyJoin]", socket.id);
        socket.data.inLobby = true;
        socket.data.map = "lobby";
        socket.data.room = "lobby"; // ロビーもルームとして扱う
        socket.join("lobby");

        // プレイヤーデータを初期化（ロビー用）
        players[socket.data.playerId] = { x: 0, y: 0, map: "lobby", room: "lobby", hp: 100, maxHp: 100, level: 1, summon: null };

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

        socket.to(socket.data.room).emit("playerMoved", {
            id: socket.data.playerId,
            pos: { x, y }
        });
    });

    socket.on("playerStatsUpdate", ({ hp, maxHp, level, mp, maxMp }) => {
        if (!players[socket.data.playerId]) return;
        if (hp !== undefined) players[socket.data.playerId].hp = hp;
        if (maxHp !== undefined) players[socket.data.playerId].maxHp = maxHp;
        if (level !== undefined) players[socket.data.playerId].level = level;
        if (mp !== undefined) players[socket.data.playerId].mp = mp;
        if (maxMp !== undefined) players[socket.data.playerId].maxMp = maxMp;

        socket.to(socket.data.room).emit("playerStatUpdate", {
            id: socket.data.playerId,
            hp: players[socket.data.playerId].hp,
            maxHp: players[socket.data.playerId].maxHp,
            level: players[socket.data.playerId].level,
            mp: players[socket.data.playerId].mp,
            maxMp: players[socket.data.playerId].maxMp
        });

        // パーティーメンバーにも通知
        const partyId = playerToParty[socket.data.playerId];
        if (partyId) {
            broadcastPartyUpdate(partyId);
        }
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

        socket.to(socket.data.room).emit("summonUpdate", {
            id: socket.data.playerId,
            ...data
        });
    });

    socket.on("newPlayer", ({ x, y, mapKey, hp, maxHp, level }) => {
        console.log("[newPlayer]", socket.id, "playerId:", socket.data.playerId, "map:", mapKey);

        const oldRoom = socket.data.room;
        const newRoom = getRoomName(socket, mapKey);

        if (oldRoom && oldRoom !== newRoom) {
            socket.leave(oldRoom);
        }

        socket.data.map = mapKey;
        socket.data.room = newRoom;
        socket.join(newRoom);

        ensureRoomEnemies(newRoom, mapKey);

        players[socket.data.playerId] = {
            x, y, map: mapKey, room: newRoom,
            hp: hp || 100, maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        };

        // ルーム内の動的情報
        const playersInRoom = Object.keys(players)
            .filter(id => players[id].room === newRoom)
            .map(id => ({ id, ...players[id] }));

        socket.emit("currentPlayers", playersInRoom);
        socket.emit("currentEnemies", Object.values(enemies[newRoom] || {}));

        socket.to(newRoom).emit("newPlayer", {
            id: socket.data.playerId,
            x, y,
            hp: hp || 100, maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        });
    });

    socket.on("mapChange", ({ mapKey, x, y, hp, maxHp, level }) => {
        const oldRoom = socket.data.room;
        const newRoom = getRoomName(socket, mapKey);

        if (oldRoom === newRoom) return;

        if (oldRoom) {
            socket.leave(oldRoom);
            socket.to(oldRoom).emit("playerDisconnected", socket.data.playerId);
        }

        socket.data.map = mapKey;
        socket.data.room = newRoom;
        socket.join(newRoom);

        ensureRoomEnemies(newRoom, mapKey);

        players[socket.data.playerId] = {
            x, y, map: mapKey, room: newRoom,
            hp: hp || 100, maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        };

        const playersInRoom = Object.keys(players)
            .filter(id => players[id].room === newRoom)
            .map(id => ({ id, ...players[id] }));

        socket.emit("currentPlayers", playersInRoom);
        socket.emit("currentEnemies", Object.values(enemies[newRoom] || {}));

        socket.to(newRoom).emit("newPlayer", {
            id: socket.data.playerId,
            x, y,
            hp: hp || 100, maxHp: maxHp || 100,
            level: level || 1,
            summon: null
        });
    });

    /* ===== 敵関連 ===== */
    socket.on("enemyHit", ({ id, damage }) => {
        const roomName = socket.data.room;
        const mapKey = socket.data.map;
        const enemy = enemies[roomName]?.[id];
        if (!enemy) {
            console.log(`[enemyHit] Enemy not found: id=${id}, room=${roomName}`);
            return;
        }

        enemy.hp -= damage;
        console.log(`[enemyHit] Enemy ${id} took ${damage} damage in ${roomName}, hp: ${enemy.hp}/${enemy.maxHp}`);

        if (enemy.hp <= 0) {
            console.log(`[enemyHit] Enemy ${id} defeated!`);
            delete enemies[roomName][id];

            const drops = [];
            if (enemy.drops) {
                enemy.drops.forEach(drop => {
                    if (Math.random() < drop.chance) drops.push(drop.id);
                });
            }

            // パーティー報酬の分配
            const partyId = playerToParty[socket.data.playerId];
            if (partyId && parties[partyId]) {
                // 同じルームにいるパーティーメンバーにのみ分配
                const membersInRoom = parties[partyId].members.filter(mId => players[mId]?.room === roomName);
                const shareCount = membersInRoom.length;

                membersInRoom.forEach(mId => {
                    const mSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === mId);
                    if (mSocket) {
                        mSocket.emit("enemyDefeated", {
                            id,
                            type: enemy.type,
                            killedBy: socket.data.playerId,
                            exp: Math.ceil(enemy.exp / shareCount),
                            gold: Math.ceil(enemy.gold / shareCount),
                            drops: mId === socket.data.playerId ? drops : []
                        });
                    }
                });
            } else {
                io.to(roomName).emit("enemyDefeated", {
                    id,
                    type: enemy.type,
                    killedBy: socket.data.playerId,
                    exp: enemy.exp,
                    gold: enemy.gold,
                    drops: drops
                });
            }

            setTimeout(() => {
                if (enemies[roomName]) { // ルームがまだ存在すればリスポーン
                    spawnEnemy(roomName, enemy, mapKey);
                }
            }, enemy.respawnDelay || 5000);
        } else {
            // HP更新の通知
            io.to(roomName).emit("enemyStatUpdate", {
                id,
                hp: enemy.hp,
                maxHp: enemy.maxHp
            });
        }
    });


    /* ===== AI制御の敵移動 ===== */
    socket.on("enemyAIMove", ({ id, x, y }) => {
        const roomName = socket.data.room;
        const enemy = enemies[roomName]?.[id];
        if (!enemy) return;

        enemy.x = x;
        enemy.y = y;

        socket.to(roomName).emit("enemyMoved", {
            id: enemy.id,
            x: enemy.x,
            y: enemy.y
        });
    });

    /* ===== AI学習データの同期（共有学習） ===== */
    socket.on("aiLearnSync", ({ enemyType, qTableData }) => {
        if (!enemyType || !qTableData) return;

        // サーバー側の共有Q-Tableにマージ
        mergeQTable(enemyType, qTableData);

        // 最新の共有データを取得
        const updatedSharedData = getSharedQTable(enemyType);

        // 全プレイヤーに最新の学習成果を配信
        io.emit("aiSharedUpdate", {
            enemyType,
            qTableData: updatedSharedData
        });
    });

    // 初回参加時に最新の共有Q-Tableを送信する処理も追加（必要に応じて）
    socket.on("getSharedAI", ({ enemyType }) => {
        const sharedData = getSharedQTable(enemyType);
        if (sharedData) {
            socket.emit("aiSharedUpdate", {
                enemyType,
                qTableData: sharedData
            });
        }
    });



    /* ===== パーティー関連 ===== */
    socket.on("partyInvite", ({ targetId }) => {
        const partyId = playerToParty[socket.data.playerId];
        console.log(`[partyInvite] from: ${socket.data.playerId} to: ${targetId}`);
        // ターゲットのスケットを取得
        const targetSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === targetId);
        if (!targetSocket) return;

        targetSocket.emit("partyInvited", {
            fromId: socket.data.playerId,
            fromName: playerNames[socket.data.playerId] || "Unknown",
            partyId: partyId || `party-${socket.data.playerId}`
        });
    });

    socket.on("partyJoin", ({ partyId }) => {
        console.log(`[partyJoin] player: ${socket.data.playerId} join: ${partyId}`);
        // 既に別のパーティーにいる場合は抜ける
        if (playerToParty[socket.data.playerId]) {
            leaveParty(socket);
        }

        if (!parties[partyId]) {
            // 新規パーティー作成
            parties[partyId] = {
                leader: partyId.replace("party-", ""),
                members: []
            };
        }

        // パーティーに参加（リーダーがまだ入っていない場合は追加）
        const leaderId = parties[partyId].leader;
        if (!parties[partyId].members.includes(leaderId)) {
            parties[partyId].members.push(leaderId);
            playerToParty[leaderId] = partyId;
        }

        if (!parties[partyId].members.includes(socket.data.playerId)) {
            parties[partyId].members.push(socket.data.playerId);
            playerToParty[socket.data.playerId] = partyId;
        }

        broadcastPartyUpdate(partyId);
    });

    socket.on("partyLeave", () => {
        console.log(`[partyLeave] player: ${socket.data.playerId}`);
        leaveParty(socket);
    });

    socket.on("playerHeal", ({ targetId, amount }) => {
        const targetSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === targetId);
        if (targetSocket) {
            targetSocket.emit("playerHealed", { amount, fromId: socket.data.playerId });
        }
    });

    socket.on("playerBuff", ({ targetId, type, value, duration }) => {
        const targetSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === targetId);
        if (targetSocket) {
            targetSocket.emit("playerBuffApplied", { type, value, duration, fromId: socket.data.playerId });
        }
    });

    socket.on("enemyAIAction", (data) => {
        socket.to(socket.data.room).emit("enemyAIAction", data);
    });

    socket.on("playerSkill", (data) => {
        const roomName = socket.data.room;
        if (roomName) {
            socket.to(roomName).emit("playerSkillUsed", {
                id: socket.data.playerId,
                skillId: data.skillId,
                x: data.x,
                y: data.y,
                direction: data.direction
            });
        }
    });

    socket.on("aiSharedUpdate", (data) => {
        socket.to(socket.data.room).emit("aiSharedUpdate", data);
    });

    /* ===== 切断 ===== */
    socket.on("disconnect", () => {
        console.log("[disconnect]", socket.id, "playerId:", socket.data.playerId);

        const roomName = socket.data.room;
        delete players[socket.data.playerId];

        if (lobbyPlayers[socket.data.playerId]) {
            delete lobbyPlayers[socket.data.playerId];
            io.to("lobby").emit("lobbyPlayerLeft", { players: lobbyPlayers });
        }
        delete playerNames[socket.data.playerId];

        // パーティーを抜ける
        leaveParty(socket);

        // マップ（ルーム）に参加していた場合のみ通知
        if (roomName) {
            socket.to(roomName).emit("playerDisconnected", socket.data.playerId);
        }
    });
});

function leaveParty(s) {
    const pId = playerToParty[s.data.playerId];
    if (!pId || !parties[pId]) return;

    parties[pId].members = parties[pId].members.filter(id => id !== s.data.playerId);
    delete playerToParty[s.data.playerId];

    if (parties[pId].members.length === 0) {
        delete parties[pId];
    } else {
        // リーダーが抜けた場合は次の人をリーダーに
        if (parties[pId].leader === s.data.playerId) {
            parties[pId].leader = parties[pId].members[0];
        }
        broadcastPartyUpdate(pId);
    }
}

function broadcastPartyUpdate(pId) {
    const party = parties[pId];
    if (!party) return;

    const memberData = party.members.map(mId => {
        const p = players[mId];
        return {
            id: mId,
            name: playerNames[mId] || "Unknown",
            hp: p?.hp || 0,
            maxHp: p?.maxHp || 0,
            mp: p?.mp || 0,
            maxMp: p?.maxMp || 0,
            level: p?.level || 1,
            map: p?.map || "unknown"
        };
    });

    party.members.forEach(mId => {
        const mSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === mId);
        if (mSocket) {
            mSocket.emit("partyUpdate", {
                partyId: pId,
                leader: party.leader,
                members: memberData
            });
        }
    });
}


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
