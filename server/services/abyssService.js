// 無限の深淵（パーティー対応）の部屋管理。
//
// 流れ:
//   1. 誰かがゲートから enter() すると、パーティー（いなければ自分だけ）の部屋が「待機中」で作られ、
//      同じパーティーの他のメンバーに abyssPartyEntered（参加しますか？）が届く。
//   2. メンバーも enter() すると待機室に入れる。ホスト（最初に入った人。抜けたら次の人）が start() で開始。
//   3. 開始すると status が "started" になり、新しいメンバーは入れない（参加者本人の再接続だけ許可）。
//      敵はサーバーが abyss:<roomId> というインスタンスのマップに出し、部屋のメンバー全員で共有する。
//   4. 階層の敵を全滅させると abyssFloorCleared を送り、誰かがポータルに触れて advance() すると次の階へ。
const {
    players, playerNames, parties, playerToParty,
    abyssRooms, playerToAbyssRoom, enemies,
} = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");
const { getEnemyStats } = require("../data/enemyStats");
const floors = require("../data/abyssFloors");
const {
    ABYSS_LOBBY_MAP_KEY,
    isAbyssInstanceKey,
    abyssInstanceKey,
    abyssRoomIdOf,
} = require("../utils/mapKeys");

const MAX_MEMBERS = 8;
// 挑戦中の部屋から全員がいなくなっても、この時間は部屋を残す（回線切れからの再接続用）
const EMPTY_RUN_GRACE_MS = 90 * 1000;

function createAbyssService({ io, enemyService, partyService }) {
    // ---------- 小さな補助 ----------

    function roomOf(playerId) {
        return abyssRooms[playerToAbyssRoom[playerId]] || null;
    }

    // このプレイヤーが入るべき部屋ID。パーティーがあればそのパーティーの部屋、なければ個人の部屋
    function desiredRoomId(playerId) {
        const partyId = playerToParty[playerId];
        return partyId && parties[partyId] ? partyId : `solo-${playerId}`;
    }

    function memberInfo(room, id) {
        const p = players[id];
        return {
            id,
            name: playerNames[id] || "Unknown",
            level: p?.level || 1,
            job: p?.job || "none",
            isHost: room.hostId === id,
        };
    }

    function snapshot(room) {
        return {
            roomId: room.id,
            status: room.status,
            floor: room.floor,
            hostId: room.hostId,
            maxMembers: MAX_MEMBERS,
            networkMapKey: room.instanceKey,
            members: room.members.map(id => memberInfo(room, id)),
        };
    }

    function emitToMembers(room, event, payload) {
        room.members.forEach(id => {
            findSocketByPlayerId(io, id)?.emit(event, payload);
        });
    }

    function broadcastRoomUpdate(room, lastEvent = null) {
        emitToMembers(room, "abyssRoomUpdate", { ...snapshot(room), lastEvent });
    }

    // 同じパーティーで、まだこの部屋に入っていないメンバー
    // （部屋IDはパーティーIDと同じ。ソロの部屋 solo-xxx には該当するパーティーが無いので空になる）
    function partyMembersOutside(room, exceptId = null) {
        const party = parties[room.id];
        if (!party) return [];
        return party.members.filter(id => id !== exceptId && playerToAbyssRoom[id] !== room.id);
    }

    function closeInvites(room, reason) {
        partyMembersOutside(room).forEach(id => {
            findSocketByPlayerId(io, id)?.emit("abyssPartyClosed", { roomId: room.id, reason });
        });
    }

    // 待機室の「居場所」へ移す。マップの同期ルームからは抜けるので、元のマップの人からは見えなくなる。
    // 待機室はSocket.IOのマップルームには入らない（スプライトを出す先が無いため）
    function moveToLobbyPresence(socket) {
        const playerId = socket.data.playerId;
        const oldMap = socket.data.map;
        if (oldMap && oldMap !== ABYSS_LOBBY_MAP_KEY) {
            socket.leave(`map:${oldMap}`);
            socket.to(`map:${oldMap}`).emit("playerDisconnected", playerId);
        }
        socket.data.map = ABYSS_LOBBY_MAP_KEY;
        if (players[playerId]) players[playerId].map = ABYSS_LOBBY_MAP_KEY;
    }

    // パーティー画面の「現在地」を最新にする
    function refreshPartyView(playerId) {
        const partyId = playerToParty[playerId];
        if (partyId && parties[partyId]) partyService.broadcastPartyUpdate(partyId);
    }

    // ---------- 部屋の作成・破棄 ----------

    function createRoom(roomId, hostId) {
        const room = {
            id: roomId,
            instanceKey: abyssInstanceKey(roomId),
            hostId,
            status: "waiting",
            members: [],
            participants: [],   // 開始時点のメンバー。開始後は、この人たちだけが再入場できる
            floor: 1,
            cleared: false,
            emptyTimer: null,
            createdAt: Date.now(),
        };
        abyssRooms[roomId] = room;
        return room;
    }

    function destroyRoom(room) {
        if (room.emptyTimer) clearTimeout(room.emptyTimer);
        enemyService.clearEnemies(room.instanceKey);
        room.members.forEach(id => {
            if (playerToAbyssRoom[id] === room.id) delete playerToAbyssRoom[id];
        });
        if (abyssRooms[room.id] === room) delete abyssRooms[room.id];
    }

    // ---------- 階層 ----------

    function spawnFloor(room, floor) {
        const key = room.instanceKey;
        enemyService.clearEnemies(key);

        room.floor = floor;
        room.cleared = false;

        const partySize = Math.max(1, room.participants.length);
        floors.buildSpawnPlan(floor).forEach((spawn, idx) => {
            enemyService.spawnEnemy(key, {
                x: spawn.x,
                y: spawn.y,
                type: spawn.type,
                id: `abyss-${floor}-${idx}`,
                respawnDelay: 0,
                noAutoRespawn: true,
                noLeash: true,
                overrides: floors.getEnemyOverrides(getEnemyStats(spawn.type), floor, partySize),
            });
        });
    }

    // ---------- 公開API ----------

    /**
     * ゲートから待機室へ入る。部屋が無ければ作る（作った人がホスト）。
     * 既に開始済みの部屋には、開始時の参加者本人しか入れない。
     */
    function enter(socket) {
        const playerId = socket.data.playerId;
        const wantedId = desiredRoomId(playerId);

        // 別のパーティーの部屋に入ったままなら、先にそこを抜ける
        const current = roomOf(playerId);
        if (current && current.id !== wantedId) leave(playerId);

        let room = abyssRooms[wantedId];
        let created = false;

        if (!room) {
            room = createRoom(wantedId, playerId);
            created = true;
        } else if (!room.members.includes(playerId)) {
            if (room.status === "started") {
                if (!room.participants.includes(playerId)) {
                    return { ok: false, error: "このパーティーはすでに挑戦を開始しています。次の挑戦までお待ちください" };
                }
            } else if (room.members.length >= MAX_MEMBERS) {
                return { ok: false, error: "待機室が満員です" };
            }
        }

        const alreadyIn = room.members.includes(playerId);
        if (!alreadyIn) room.members.push(playerId);
        playerToAbyssRoom[playerId] = room.id;
        if (room.emptyTimer) {
            clearTimeout(room.emptyTimer);
            room.emptyTimer = null;
        }

        // 挑戦中の部屋への再入場: 待機室は経由せず、そのままダンジョンへ
        if (room.status === "started") {
            broadcastRoomUpdate(room, { type: "rejoined", name: playerNames[playerId] || "Unknown" });
            return { ok: true, status: "started", run: runInfo(room), room: snapshot(room) };
        }

        moveToLobbyPresence(socket);
        refreshPartyView(playerId);

        if (created) {
            // 「◯◯が無限の深淵に入りました。参加しますか？」を仲間に知らせる
            partyMembersOutside(room, playerId).forEach(id => {
                findSocketByPlayerId(io, id)?.emit("abyssPartyEntered", {
                    roomId: room.id,
                    fromId: playerId,
                    fromName: playerNames[playerId] || "Unknown",
                });
            });
        }

        if (!alreadyIn) {
            broadcastRoomUpdate(room, created ? null : { type: "joined", name: playerNames[playerId] || "Unknown" });
        }
        return { ok: true, status: "waiting", room: snapshot(room) };
    }

    /** 待機室・ダンジョンから抜ける（何度呼んでも安全） */
    function leave(playerId) {
        const room = roomOf(playerId);
        if (!room) return { ok: true };

        const name = playerNames[playerId] || "Unknown";
        delete playerToAbyssRoom[playerId];
        room.members = room.members.filter(id => id !== playerId);

        if (room.members.length === 0) {
            if (room.status === "waiting") {
                closeInvites(room, "cancelled");
                destroyRoom(room);
            } else {
                // 挑戦中: 回線切れからの再接続を待ってから片付ける
                room.emptyTimer = setTimeout(() => destroyRoom(room), EMPTY_RUN_GRACE_MS);
                if (room.emptyTimer.unref) room.emptyTimer.unref();
            }
            return { ok: true };
        }

        let lastEvent = { type: "left", name };
        if (room.hostId === playerId) {
            room.hostId = room.members[0];
            lastEvent = { type: "hostChanged", name, newHostName: playerNames[room.hostId] || "Unknown" };
        }
        broadcastRoomUpdate(room, lastEvent);
        return { ok: true };
    }

    /** ホストが開始する。以降は新しいメンバーを受け入れない */
    function start(playerId) {
        const room = roomOf(playerId);
        if (!room) return { ok: false, error: "待機室に入っていません" };
        if (room.status !== "waiting") return { ok: false, error: "すでに開始しています" };
        if (room.hostId !== playerId) return { ok: false, error: "開始できるのはホストだけです" };

        room.status = "started";
        room.participants = [...room.members];
        spawnFloor(room, 1);

        // まだ待機室に来ていない仲間には「締め切った」と伝える
        closeInvites(room, "started");
        emitToMembers(room, "abyssStarted", { ...runInfo(room), room: snapshot(room) });
        return { ok: true };
    }

    function runInfo(room) {
        return { roomId: room.id, networkMapKey: room.instanceKey, floor: room.floor };
    }

    /** 階層クリア後、ポータルに触れた人がいたら次の階へ（全員一緒に進む） */
    function advance(playerId, floor) {
        const room = roomOf(playerId);
        if (!room || room.status !== "started" || !room.cleared) return { ok: false };
        if (floor !== room.floor) return { ok: false };
        if (players[playerId]?.map !== room.instanceKey) return { ok: false };

        spawnFloor(room, room.floor + 1);
        io.to(`map:${room.instanceKey}`).emit("abyssFloorStarted", { floor: room.floor });
        return { ok: true };
    }

    /** シーン読み込み直後（死亡後の復帰を含む）に、今の階層の状態を渡す */
    function sync(playerId) {
        const room = roomOf(playerId);
        if (!room || room.status !== "started") return { ok: false };
        return {
            ok: true,
            floor: room.floor,
            cleared: room.cleared,
            remaining: Object.keys(enemies[room.instanceKey] || {}).length,
            room: snapshot(room),
        };
    }

    /** 敵が倒されるたびに呼ばれる。階層の敵が全滅していたらクリア報酬を配る */
    function onEnemyDefeated(mapKey) {
        if (!isAbyssInstanceKey(mapKey)) return;
        const room = abyssRooms[abyssRoomIdOf(mapKey)];
        if (!room || room.status !== "started" || room.cleared) return;
        if (Object.keys(enemies[mapKey] || {}).length > 0) return;

        room.cleared = true;
        room.members.forEach(id => {
            if (players[id]?.map !== mapKey) return;
            findSocketByPlayerId(io, id)?.emit("abyssFloorCleared", {
                floor: room.floor,
                rewards: floors.rollClearRewards(room.floor), // 報酬はメンバーごとに別々に抽選
            });
        });
    }

    /** 挑戦中のインスタンスには、その部屋の（開始済みの）メンバーしか入れない */
    function canEnterInstance(playerId, mapKey) {
        const room = abyssRooms[abyssRoomIdOf(mapKey)];
        return !!room && room.status === "started" && room.members.includes(playerId);
    }

    /** プレイヤーがどこかのマップに入ったとき。ダンジョン以外へ出たなら、部屋から抜けたことにする */
    function onMapEntered(playerId, mapKey) {
        const room = roomOf(playerId);
        if (!room) return;
        if (mapKey === room.instanceKey || mapKey === ABYSS_LOBBY_MAP_KEY) return;
        leave(playerId);
    }

    function onDisconnect(playerId) {
        leave(playerId);
    }

    return {
        enter, leave, start, advance, sync,
        onEnemyDefeated, canEnterInstance, onMapEntered, onDisconnect,
    };
}

module.exports = { createAbyssService, MAX_MEMBERS };
