// サーバーが保持する共有状態（プロセス内で1つだけ）
module.exports = {
    players: {},        // playerId -> { x, y, map, hp, maxHp, level, summon, ... }
    enemies: {},        // mapKey -> { enemyId -> enemy }

    lobbyPlayers: {},   // playerId -> { name, ready }
    playerNames: {},    // playerId -> name
    gameSessionActive: false, // 最初のパーティーが出発後は、後発プレイヤーを受け入れる

    parties: {},        // partyId -> { leader: playerId, members: [playerId] }
    playerToParty: {}   // playerId -> partyId
};
