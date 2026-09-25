const { enemies, parties, playerToParty, players } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

// ドロップ抽選（当たったアイテムIDの配列を返す）
function rollDrops(enemy) {
    return (enemy.drops || [])
        .filter(drop => Math.random() < drop.chance)
        .map(drop => drop.id);
}

module.exports = function registerEnemyHandlers(socket, { io, aiManager, enemyService }) {
    const playerId = socket.data.playerId;

    // 撃破通知を送る。パーティーがある場合は同じマップのメンバーで経験値・ゴールドを等分する
    function notifyDefeat(mapKey, enemy, drops) {
        const payload = (exp, gold, dropList) => ({
            id: enemy.id,
            type: enemy.type,
            killedBy: playerId,
            exp,
            gold,
            drops: dropList
        });

        const partyId = playerToParty[playerId];
        if (!(partyId && parties[partyId])) {
            io.to(`map:${mapKey}`).emit("enemyDefeated", payload(enemy.exp, enemy.gold, drops));
            return;
        }

        const membersInMap = parties[partyId].members.filter(id => players[id]?.map === mapKey);
        const shareCount = membersInMap.length;

        membersInMap.forEach(memberId => {
            const memberSocket = findSocketByPlayerId(io, memberId);
            if (!memberSocket) return;

            memberSocket.emit("enemyDefeated", payload(
                Math.ceil(enemy.exp / shareCount),
                Math.ceil(enemy.gold / shareCount),
                memberId === playerId ? drops : [] // ドロップはキラーのみ
            ));
        });
    }

    socket.on("enemyHit", ({ id, damage }) => {
        const mapKey = socket.data.map;
        const enemy = enemies[mapKey]?.[id];
        if (!enemy) return;

        enemy.hp -= damage;

        if (enemy.hp <= 0) {
            // AI に死亡を通知（学習反映）
            aiManager.unregisterEnemy(id);
            delete enemies[mapKey][id];

            notifyDefeat(mapKey, enemy, rollDrops(enemy));

            setTimeout(() => enemyService.respawnEnemy(mapKey, enemy), enemy.respawnDelay);
        } else {
            io.to(`map:${mapKey}`).emit("enemyStatUpdate", {
                id,
                hp: enemy.hp,
                maxHp: enemy.maxHp
            });
        }
    });
};
