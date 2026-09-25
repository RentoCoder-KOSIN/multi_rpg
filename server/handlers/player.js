const { players, playerToParty } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

module.exports = function registerPlayerHandlers(socket, { io, partyService }) {
    const playerId = socket.data.playerId;

    // 同じマップの他プレイヤーへ送る
    const toOthersOnMap = () => socket.to(`map:${socket.data.map}`);

    socket.on("playerMove", ({ x, y }) => {
        const player = players[playerId];
        if (!player) return;

        player.x = x;
        player.y = y;

        toOthersOnMap().emit("playerMoved", { id: playerId, pos: { x, y } });
    });

    socket.on("playerStatsUpdate", ({ hp, maxHp, level, mp, maxMp }) => {
        const player = players[playerId];
        if (!player) return;

        if (hp !== undefined) player.hp = hp;
        if (maxHp !== undefined) player.maxHp = maxHp;
        if (level !== undefined) player.level = level;
        if (mp !== undefined) player.mp = mp;
        if (maxMp !== undefined) player.maxMp = maxMp;

        toOthersOnMap().emit("playerStatUpdate", {
            id: playerId,
            hp: player.hp,
            maxHp: player.maxHp,
            level: player.level,
            mp: player.mp,
            maxMp: player.maxMp
        });

        // パーティーメンバーにも通知
        const partyId = playerToParty[playerId];
        if (partyId) {
            partyService.broadcastPartyUpdate(partyId);
        }
    });

    socket.on("summonUpdate", (data) => {
        const player = players[playerId];
        if (!player) return;

        if (data.type === "spawn") {
            player.summon = { active: true, isMega: data.isMega, x: data.x, y: data.y };
        } else if (data.type === "move") {
            if (player.summon) {
                player.summon.x = data.x;
                player.summon.y = data.y;
            }
        } else if (data.type === "despawn") {
            player.summon = null;
        }

        toOthersOnMap().emit("summonUpdate", { id: playerId, ...data });
    });

    socket.on("playerHeal", ({ targetId, amount }) => {
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) {
            targetSocket.emit("playerHealed", { amount, fromId: playerId });
        }
    });

    socket.on("playerBuff", ({ targetId, type, value, duration }) => {
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) {
            targetSocket.emit("playerBuffApplied", { type, value, duration, fromId: playerId });
        }
    });

    // 同じマップにいる他のプレイヤーにスキル使用を通知
    socket.on("playerSkill", (data) => {
        if (!socket.data.map) return;

        toOthersOnMap().emit("playerSkillUsed", {
            id: playerId,
            skillId: data.skillId,
            x: data.x,
            y: data.y,
            direction: data.direction
        });
    });
};
