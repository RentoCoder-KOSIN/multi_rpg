const { lobbyPlayers, playerNames, players } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

module.exports = function registerLobbyHandlers(socket, { io }) {
    const playerId = socket.data.playerId;

    socket.on("lobbyJoin", () => {
        console.log("[lobbyJoin]", socket.id);
        socket.data.inLobby = true;
        socket.data.map = "lobby";
        socket.join("lobby");

        // プレイヤーデータを初期化（ロビー用）
        players[playerId] = { x: 0, y: 0, map: "lobby", hp: 100, maxHp: 100, level: 1, summon: null };

        lobbyPlayers[playerId] = {
            name: playerId.slice(0, 5),
            ready: false
        };
        playerNames[playerId] = lobbyPlayers[playerId].name;

        io.to("lobby").emit("lobbyInfo", {
            players: lobbyPlayers,
            playerNames,
            readyPlayers: Object.keys(lobbyPlayers).filter(id => lobbyPlayers[id].ready)
        });

        // 他のロビープレイヤーに新しいプレイヤーの参加を通知
        socket.to("lobby").emit("lobbyPlayerJoined", {
            socketId: playerId,
            players: lobbyPlayers,
            playerNames
        });
    });

    socket.on("playerNameUpdate", ({ name }) => {
        if (!lobbyPlayers[playerId]) return;
        lobbyPlayers[playerId].name = name;
        playerNames[playerId] = name;
        io.to("lobby").emit("lobbyPlayerNameUpdate", { socketId: playerId, name });
    });

    socket.on("lobbyReady", ({ ready }) => {
        if (!lobbyPlayers[playerId]) return;
        lobbyPlayers[playerId].ready = ready;
        io.to("lobby").emit("lobbyPlayerReady", { socketId: playerId, ready });
    });

    socket.on("lobbyKick", ({ targetId }) => {
        // 簡易的なホスト判定: 最小のIDを持つプレイヤーをホストとする
        const hostId = Object.keys(lobbyPlayers).sort()[0];
        if (hostId !== playerId) {
            console.log("[lobbyKick] Denied: Only host can kick. Host:", hostId, "Requester:", playerId);
            return;
        }

        if (!lobbyPlayers[targetId]) return;
        console.log("[lobbyKick] Kicking:", targetId);

        const targetSocket = findSocketByPlayerId(io, targetId);
        if (!targetSocket) return;

        targetSocket.emit("lobbyKicked");
        targetSocket.leave("lobby");
        targetSocket.data.inLobby = false;
        delete lobbyPlayers[targetId];
        delete playerNames[targetId];
        io.to("lobby").emit("lobbyPlayerLeft", { players: lobbyPlayers });
    });

    socket.on("lobbyStartGame", () => {
        const ids = Object.keys(lobbyPlayers);
        if (ids.length === 0) return;
        if (!ids.every(id => lobbyPlayers[id].ready)) return;

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
};
