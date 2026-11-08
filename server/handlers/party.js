const { playerNames, playerToParty, parties } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

module.exports = function registerPartyHandlers(socket, { io, partyService }) {
    const playerId = socket.data.playerId;

    socket.on("partyInvite", ({ targetId }) => {
        console.log(`[partyInvite] from: ${playerId} to: ${targetId}`);
        const result = partyService.inviteToParty(playerId, targetId);
        if (!result.ok) socket.emit("partyError", result.error);
    });

    socket.on("partyCreate", ({ name, password }) => {
        const result = partyService.createParty(playerId, name, password);
        socket.emit("partyActionResult", { action: "create", ...result });
    });

    socket.on("partyListRequest", () => {
        socket.emit("partyList", partyService.listParties());
    });

    socket.on("partyJoin", ({ partyId, password }) => {
        console.log(`[partyJoin] player: ${playerId} join: ${partyId}`);
        const result = partyService.joinParty(playerId, partyId, password);
        socket.emit("partyActionResult", { action: "join", ...result });
    });

    socket.on("partyLeave", () => {
        console.log(`[partyLeave] player: ${playerId}`);
        const result = partyService.leaveParty(playerId);
        if (!result.ok) socket.emit("partyError", result.error);
    });

    socket.on("partyKick", ({ targetId }) => {
        const result = partyService.kickMember(playerId, targetId);
        if (!result.ok) socket.emit("partyError", result.error);
    });

    socket.on("chatMessage", ({ channel, text }) => {
        const message = String(text || "").trim().slice(0, 300);
        if (!message) return;
        const data = { channel: channel === "party" ? "party" : "global", text: message,
            fromId: playerId, fromName: playerNames[playerId] || "Unknown", sentAt: Date.now() };
        if (data.channel === "global") {
            io.emit("chatMessage", data);
            return;
        }
        const party = parties[playerToParty[playerId]];
        if (!party) {
            socket.emit("partyError", "パーティーチャットにはパーティー参加が必要です");
            return;
        }
        party.members.forEach(memberId => {
            const memberSocket = findSocketByPlayerId(io, memberId);
            if (memberSocket) memberSocket.emit("chatMessage", data);
        });
    });
};
