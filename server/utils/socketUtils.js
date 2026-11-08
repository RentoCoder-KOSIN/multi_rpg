const { players } = require("../state");

// playerId から接続中のソケットを探す（見つからなければ undefined）
function findSocketByPlayerId(io, playerId) {
    for (const socket of io.sockets.sockets.values()) {
        if (socket.data.playerId === playerId) return socket;
    }
    return undefined;
}

// 指定マップにいるプレイヤーだけを返す
function getPlayersOnMap(mapKey) {
    const result = {};
    for (const id in players) {
        if (players[id].map === mapKey) {
            result[id] = players[id];
        }
    }
    return result;
}

module.exports = { findSocketByPlayerId, getPlayersOnMap };
