const { lobbyPlayers, playerNames, players } = require("../state");

const registerLobbyHandlers = require("./lobby");
const registerPlayerHandlers = require("./player");
const registerMapHandlers = require("./map");
const registerEnemyHandlers = require("./enemy");
const registerPartyHandlers = require("./party");
const registerAIHandlers = require("./ai");

// 接続ごとに各イベントハンドラを登録する
function registerConnectionHandler(ctx) {
    const { io, partyService } = ctx;

    io.on("connection", socket => {
        const playerId = socket.handshake.auth?.playerId || socket.id;
        console.log("[connect]", socket.id, "playerId:", playerId);

        socket.data.playerId = playerId;
        socket.data.map = null;
        socket.data.inLobby = false;

        // マップへの参加は、クライアントからの lobbyJoin / newPlayer を待つ
        partyService.autoJoinDefaultParty(playerId);

        registerLobbyHandlers(socket, ctx);
        registerPlayerHandlers(socket, ctx);
        registerMapHandlers(socket, ctx);
        registerEnemyHandlers(socket, ctx);
        registerPartyHandlers(socket, ctx);
        registerAIHandlers(socket, ctx);

        socket.on("disconnect", () => {
            console.log("[disconnect]", socket.id, "playerId:", playerId);

            const mapKey = socket.data.map;
            delete players[playerId];

            if (lobbyPlayers[playerId]) {
                delete lobbyPlayers[playerId];
                delete playerNames[playerId];
                io.to("lobby").emit("lobbyPlayerLeft", { players: lobbyPlayers });
            }

            // マップに参加していた場合のみ通知
            if (mapKey) {
                socket.to(`map:${mapKey}`).emit("playerDisconnected", playerId);
            }
        });
    });
}

module.exports = { registerConnectionHandler };
