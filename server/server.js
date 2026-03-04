const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const { ENEMY_STATS, getEnemyStats } = require("./data/enemyStats");
const { ServerEnemyAIManager } = require("./ai/ServerEnemyAI");

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

//IDの生成
function generateId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/* =====================
   サーバー側 AI マネージャー（敵管理の前に定義）
===================== */
const aiManager = new ServerEnemyAIManager();
const aiDataPath = path.join(__dirname, 'data', 'sharedAI.json');

// 起動時に保存済み学習データをロード
try {
    if (fs.existsSync(aiDataPath)) {
        const raw = fs.readFileSync(aiDataPath, 'utf8');
        const parsed = JSON.parse(raw);
        aiManager.loadFromData(parsed);
        console.log('[ServerAI] Loaded AI models from disk:', Object.keys(parsed));
    }
} catch (e) {
    console.error('[ServerAI] Failed to load AI data:', e);
}

// 定期的に学習データを保存する関数
function saveAIData(data) {
    try {
        fs.writeFileSync(aiDataPath, JSON.stringify(data, null, 2), 'utf8');
        console.log('[ServerAI] AI models saved. Types:', Object.keys(data).join(', '));
    } catch (e) {
        console.error('[ServerAI] Failed to save AI data:', e);
    }
}

/* =====================
   敵管理
===================== */
function spawnEnemy(mapKey, spawn) {
    if (!enemies[mapKey]) enemies[mapKey] = {};
    const id = generateId(spawn.type);
    const stats = getEnemyStats(spawn.type);

    const enemy = {
        id,
        type: spawn.type,
        x: spawn.x,
        y: spawn.y,
        spawnX: spawn.x,
        spawnY: spawn.y,
        spawnId: spawn.id,
        respawnDelay: spawn.respawnDelay,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        exp: stats.exp,
        gold: stats.gold,
        drops: stats.drops
    };

    enemies[mapKey][id] = enemy;

    // AIマネージャーに登録（学習を開始）
    aiManager.registerEnemy(enemy);

    io.to(`map:${mapKey}`).emit("enemySpawned", enemy);
}

//敵ステータスの配列を返してる
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
    spawns.forEach(spawn => spawnEnemy(mapKey, spawn));
});

/* =====================
   サーバー側 AI 初期化
===================== */

// 起動時にスポーン済みの救数をAIマネージャーに一括登録
// (各 spawnEnemy 内で registerEnemy されるので、起動後にダブりないようログのみ)
console.log('[ServerAI] aiManager initialized. Initial enemies will be registered via spawnEnemy().');

/* =====================
   サーバー側 更新ループ（AI 駆動の救移動）
   ※ サーバーが稼働している限り学習し続ける
===================== */
const AI_UPDATE_INTERVAL = 150; // ms

setInterval(() => {
    knownMaps.forEach(mapKey => {
        const mapEnemies = enemies[mapKey];
        if (!mapEnemies) return;

        // このマップにいるプレイヤーを収集
        const mapPlayers = {};
        Object.entries(players).forEach(([pid, p]) => {
            if (p.map === mapKey && p.hp > 0) {
                mapPlayers[pid] = { ...p, id: pid };
            }
        });

        Object.values(mapEnemies).forEach(enemy => {
            if (enemy.type === 'boss') return;

            // AI による行動決定と移動
            const result = aiManager.updateEnemy(enemy.id, mapPlayers, mapEnemies);

            if (result) {
                // スポーン地点から 250px 以上離れたら戻す
                const distFromSpawn = Math.sqrt(
                    Math.pow(enemy.x - enemy.spawnX, 2) +
                    Math.pow(enemy.y - enemy.spawnY, 2)
                );

                if (distFromSpawn > 250) {
                    // スポーン地点へ強制帰還
                    const homeAngle = Math.atan2(enemy.spawnY - enemy.y, enemy.spawnX - enemy.x);
                    enemy.x += Math.cos(homeAngle) * 10;
                    enemy.y += Math.sin(homeAngle) * 10;
                } else {
                    // AI の行動に従って移動
                    // dx/dy は px/秒 なので、経過時間(秒)を掛けて実移動量に変換
                    // 例: approach 50px/s * 0.15s = 7.5px/tick
                    const MOVE_SCALE = AI_UPDATE_INTERVAL / 1000;
                    enemy.x += result.dx * MOVE_SCALE;
                    enemy.y += result.dy * MOVE_SCALE;
                }

                // サーバー側での攻撃判定
                if (result.shouldAttack && result.targetPlayerId) {
                    const target = mapPlayers[result.targetPlayerId];
                    if (target && target.hp > 0) {
                        const d = Math.sqrt(
                            Math.pow(enemy.x - target.x, 2) +
                            Math.pow(enemy.y - target.y, 2)
                        );
                        if (d < 80) { // 攻撃範囲チェック（サーバー側）
                            // AIに攻撃成功を通知（学習報酬）
                            aiManager.notifyAttackHit(enemy.id, enemy.atk);

                            // プレイヤーにダメージを通知
                            const targetSocket = [...io.sockets.sockets.values()]
                                .find(s => s.data.playerId === result.targetPlayerId);
                            if (targetSocket) {
                                targetSocket.emit('enemyAttack', {
                                    enemyId: enemy.id,
                                    enemyType: enemy.type,
                                    damage: enemy.atk
                                });
                            }
                        }
                    }
                }
            } else {
                // AI インスタンスがない（未登録など）はランダム移動にフォールバック
                const distFromSpawn = Math.sqrt(
                    Math.pow(enemy.x - enemy.spawnX, 2) +
                    Math.pow(enemy.y - enemy.spawnY, 2)
                );
                if (distFromSpawn > 250) {
                    const homeAngle = Math.atan2(enemy.spawnY - enemy.y, enemy.spawnX - enemy.x);
                    enemy.x += Math.cos(homeAngle) * 10;
                    enemy.y += Math.sin(homeAngle) * 10;
                } else {
                    enemy.x += (Math.random() - 0.5) * 4;
                    enemy.y += (Math.random() - 0.5) * 4;
                }
            }

            // 全プレイヤーに位置を同期
            io.to(`map:${mapKey}`).emit('enemyMoved', {
                id: enemy.id,
                x: enemy.x,
                y: enemy.y,
                action: result?.action || 'idle'
            });
        });
    });

    // 定期的にAIデータを自動保存
    aiManager.checkAutoSave(saveAIData);
}, AI_UPDATE_INTERVAL);

// 30秒ごとにAI統計をログ出力
setInterval(() => {
    const stats = aiManager.getAllStats();
    if (Object.keys(stats).length > 0) {
        console.log('[ServerAI] Learning Stats:');
        Object.entries(stats).forEach(([type, s]) => {
            console.log(`  [${type}] ε=${s.epsilon} updates=${s.updateCount} episodes=${s.episodeCount} qSize=${s.qTableSize} avgReward=${s.avgReward}`);
        });
    }
}, 30000);

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
        if (!parties[DEFAULT_PARTY_ID].members.includes(playerId)) {
            parties[DEFAULT_PARTY_ID].members.push(playerId);
        }
        playerToParty[playerId] = DEFAULT_PARTY_ID;
        console.log(`[AutoJoin] ${playerId} joined ${DEFAULT_PARTY_ID}`);
    } else {
        const currentPId = playerToParty[playerId];
        setTimeout(() => broadcastPartyUpdate(currentPId), 500);
    }

    // 他のメンバーにも更新通知
    setTimeout(() => broadcastPartyUpdate(DEFAULT_PARTY_ID), 500);

    /* ===== ロビー ===== */
    socket.on("lobbyJoin", () => {
        console.log("[lobbyJoin]", socket.id);
        socket.data.inLobby = true;
        socket.data.map = "lobby";
        socket.join("lobby");

        // プレイヤーデータを初期化（ロビー用）
        players[socket.data.playerId] = { x: 0, y: 0, map: "lobby", hp: 100, maxHp: 100, level: 1, summon: null };

        lobbyPlayers[socket.data.playerId] = {
            //name: `Player ${(socket.data.playerId).slice(0, 5)}`,
            name: `${(socket.data.playerId).slice(0, 5)}`,
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

    socket.on("playerStatsUpdate", ({ hp, maxHp, level, mp, maxMp }) => {
        if (!players[socket.data.playerId]) return;
        if (hp !== undefined) players[socket.data.playerId].hp = maxHp;
        if (maxHp !== undefined) players[socket.data.playerId].maxHp = maxHp;
        if (level !== undefined) players[socket.data.playerId].level = level;
        if (mp !== undefined) players[socket.data.playerId].mp = maxMp;
        if (maxMp !== undefined) players[socket.data.playerId].maxMp = maxMp;

        socket.to(`map:${socket.data.map}`).emit("playerStatUpdate", {
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

        socket.to(`map:${socket.data.map}`).emit("summonUpdate", {
            id: socket.data.playerId,
            ...data
        });
    });

    // === AI学習データ送受信 ===
    // クライアントからの学習データをサーバーのAIにマージ（集合知）
    socket.on('aiLearnSync', ({ enemyType, qTableData }) => {
        if (!enemyType || !qTableData) return;

        // サーバー側AIにマージ
        aiManager.mergeClientData(enemyType, qTableData);

        // サーバーの最新データを全クライアントに配信
        const serverData = aiManager.getAgent(enemyType).toJSON();
        io.emit('aiSharedUpdate', { enemyType, qTableData: serverData });

        // 非同期で保存（即時ではなくバッチ処理）
        // checkAutoSave が定期的に保存するため不要だが、確実にするなら以下：
        // saveAIData(aiManager.toSaveData());
    });

    socket.on('getSharedAI', ({ enemyType }) => {
        if (!enemyType) return;
        // サーバー側AIのデータをクライアントに送信
        const agent = aiManager.getAgent(enemyType);
        socket.emit('aiSharedUpdate', {
            enemyType,
            qTableData: agent.toJSON()
        });
    });

    // AI統計情報をリクエスト
    socket.on('getAIStats', () => {
        socket.emit('aiStats', aiManager.getAllStats());
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
            summon: null
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
        const enemy = enemies[mapKey]?.[id];    //なければundefinedにする
        if (!enemy) return;

        enemy.hp -= damage;

        if (enemy.hp <= 0) {
            // 撃破処理
            // AI に死亡を通知（学習反映）
            aiManager.unregisterEnemy(id);
            delete enemies[mapKey][id];

            const drops = [];
            if (enemy.drops) {
                enemy.drops.forEach(drop => {
                    if (Math.random() < drop.chance) {
                        drops.push(drop.id);
                    }
                });
            }


            // パーティー報酬の分配
            const partyId = playerToParty[socket.data.playerId];
            if (partyId && parties[partyId]) {
                const membersInMap = parties[partyId].members.filter(mId => players[mId]?.map === mapKey);
                const shareCount = membersInMap.length;

                membersInMap.forEach(mId => {
                    const mSocket = [...io.sockets.sockets.values()].find(s => s.data.playerId === mId);
                    if (mSocket) {
                        mSocket.emit("enemyDefeated", {
                            id,
                            type: enemy.type,
                            killedBy: socket.data.playerId,
                            exp: Math.ceil(enemy.exp / shareCount),
                            gold: Math.ceil(enemy.gold / shareCount),
                            drops: mId === socket.data.playerId ? drops : [] // ドロップはキラーのみ
                        });
                    }
                });
            } else {
                io.to(`map:${mapKey}`).emit("enemyDefeated", {
                    id,
                    type: enemy.type,
                    killedBy: socket.data.playerId,
                    exp: enemy.exp,
                    gold: enemy.gold,
                    drops: drops
                });
            }

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

    socket.on("playerSkill", (data) => {
        // 同じマップにいる他のプレイヤーにスキル使用を通知
        const mapKey = socket.data.map;
        if (mapKey) {
            socket.to(`map:${mapKey}`).emit("playerSkillUsed", {
                id: socket.data.playerId,
                skillId: data.skillId,
                x: data.x,
                y: data.y,
                direction: data.direction
            });
        }
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
