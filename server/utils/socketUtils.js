const { players, playerNames } = require("../state");

// playerId または username または 表示名 から接続中のソケットを探す（見つからなければ undefined）
function findSocketByPlayerId(io, identifier) {
    if (!identifier) return undefined;
    const query = String(identifier).trim().toLowerCase();

    for (const socket of io.sockets.sockets.values()) {
        const pId = socket.data.playerId ? String(socket.data.playerId).toLowerCase() : '';
        const uName = socket.data.username ? String(socket.data.username).toLowerCase() : '';
        const regName = playerNames[socket.data.playerId] ? String(playerNames[socket.data.playerId]).toLowerCase() : '';

        if (pId === query || uName === query || regName === query) {
            return socket;
        }
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
