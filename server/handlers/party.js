const { playerNames, playerToParty } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

module.exports = function registerPartyHandlers(socket, { io, partyService }) {
    const playerId = socket.data.playerId;

    socket.on("partyInvite", ({ targetId }) => {
        const partyId = playerToParty[playerId];
        console.log(`[partyInvite] from: ${playerId} to: ${targetId}`);

        const targetSocket = findSocketByPlayerId(io, targetId);
        if (!targetSocket) return;

        targetSocket.emit("partyInvited", {
            fromId: playerId,
            fromName: playerNames[playerId] || "Unknown",
            partyId: partyId || `party-${playerId}`
        });
    });

    socket.on("partyJoin", ({ partyId }) => {
        console.log(`[partyJoin] player: ${playerId} join: ${partyId}`);
        partyService.joinParty(playerId, partyId);
    });

    socket.on("partyLeave", () => {
        console.log(`[partyLeave] player: ${playerId}`);
        partyService.leaveParty(playerId);
    });
};
