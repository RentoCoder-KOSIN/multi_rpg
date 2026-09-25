const { DEFAULT_HP, DEFAULT_LEVEL } = require("../config");
const { players, playerToParty } = require("../state");
const { getPlayersOnMap } = require("../utils/socketUtils");

module.exports = function registerMapHandlers(socket, { enemyService, partyService }) {
    const playerId = socket.data.playerId;

    // プレイヤーを指定マップに参加させ、現在の状況を本人に、参加を他の人に通知する
    function enterMap({ mapKey, x, y, hp, maxHp, level, mp, maxMp }) {
        // Values the client did not send fall back to what we already know, then to defaults
        const prev = players[playerId];
        const stats = {
            hp: hp ?? prev?.hp ?? DEFAULT_HP,
            maxHp: maxHp || prev?.maxHp || DEFAULT_HP,
            level: level || prev?.level || DEFAULT_LEVEL,
            mp: mp ?? prev?.mp ?? 0,
            maxMp: maxMp ?? prev?.maxMp ?? 0
        };

        socket.data.map = mapKey;
        socket.join(`map:${mapKey}`);
        players[playerId] = { x, y, map: mapKey, ...stats, summon: null };

        // 最新の動的情報を送信
        socket.emit("currentPlayers", getPlayersOnMap(mapKey));
        socket.emit("currentEnemies", enemyService.getEnemiesOnMap(mapKey));

        // 同じマップの他のプレイヤーに新しいプレイヤーを通知
        socket.to(`map:${mapKey}`).emit("newPlayer", { id: playerId, x, y, ...stats, summon: null });

        // Party members see the new map name and stats right away
        const partyId = playerToParty[playerId];
        if (partyId) partyService.broadcastPartyUpdate(partyId);
    }

    // 初回のマップ参加（シーン開始時）
    socket.on("newPlayer", (data) => {
        console.log("[newPlayer]", socket.id, "playerId:", playerId, "map:", data.mapKey);

        const oldMap = socket.data.map;
        if (oldMap && oldMap !== data.mapKey) {
            socket.leave(`map:${oldMap}`);
        }

        enterMap(data);
    });

    // マップ移動
    socket.on("mapChange", (data) => {
        const oldMap = socket.data.map;
        if (oldMap === data.mapKey) return;

        socket.leave(`map:${oldMap}`);
        socket.to(`map:${oldMap}`).emit("playerDisconnected", playerId);

        // 召喚獣は一旦リセットされる。維持する場合はクライアントがこのあと spawn を送る
        enterMap(data);
    });
};
