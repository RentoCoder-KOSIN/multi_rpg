const { DEFAULT_HP, DEFAULT_LEVEL } = require("../config");
const { players } = require("../state");
const { getPlayersOnMap } = require("../utils/socketUtils");

module.exports = function registerMapHandlers(socket, { enemyService }) {
    const playerId = socket.data.playerId;

    // プレイヤーを指定マップに参加させ、現在の状況を本人に、参加を他の人に通知する
    function enterMap({ mapKey, x, y, hp, maxHp, level }) {
        const stats = {
            hp: hp || DEFAULT_HP,
            maxHp: maxHp || DEFAULT_HP,
            level: level || DEFAULT_LEVEL
        };

        socket.data.map = mapKey;
        socket.join(`map:${mapKey}`);
        players[playerId] = { x, y, map: mapKey, ...stats, summon: null };

        // 最新の動的情報を送信
        socket.emit("currentPlayers", getPlayersOnMap(mapKey));
        socket.emit("currentEnemies", enemyService.getEnemiesOnMap(mapKey));

        // 同じマップの他のプレイヤーに新しいプレイヤーを通知
        socket.to(`map:${mapKey}`).emit("newPlayer", { id: playerId, x, y, ...stats, summon: null });
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
