const { lobbyPlayers, playerNames, players } = require("../state");

const registerLobbyHandlers = require("./lobby");
const registerPlayerHandlers = require("./player");
const registerMapHandlers = require("./map");
const registerEnemyHandlers = require("./enemy");
const registerPartyHandlers = require("./party");
const registerAIHandlers = require("./ai");
const accounts = require("../services/accountStore");
const { findSocketByPlayerId } = require("../utils/socketUtils");

// 接続ごとに各イベントハンドラを登録する
function registerConnectionHandler(ctx) {
    const { io, partyService } = ctx;

    // 接続時にトークンを検証する。無効なら接続を拒否（クライアントはログイン画面へ戻る）。
    // playerId はアカウントIDになるので、別のPCからでも同じキャラクターとして扱われる。
    io.use(async (socket, next) => {
        let who = null;
        try {
            who = await accounts.verifyToken(socket.handshake.auth?.token);
        } catch (err) {
            console.error("[auth] verifyToken failed:", err.message);
            return next(new Error("server_error"));
        }
        if (!who) return next(new Error("unauthorized"));

        // 同じアカウントの多重ログインは、古い方を切断する（セーブの上書き事故を防ぐ）
        const old = findSocketByPlayerId(io, who.id);
        if (old) {
            old.emit("duplicateLogin");
            old.disconnect(true);
        }

        socket.data.playerId = who.id;
        socket.data.username = who.username;
        next();
    });

    io.on("connection", socket => {
        const playerId = socket.data.playerId;
        console.log("[connect]", socket.id, "playerId:", playerId);

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

            // 同じアカウントの新しい接続に置き換わった場合は、新しい側の状態を消さない
            const current = findSocketByPlayerId(io, playerId);
            if (current && current.id !== socket.id) return;

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
