const {
    KNOWN_MAPS,
    AI_UPDATE_INTERVAL,
    AI_STATS_LOG_INTERVAL,
    ENEMY_LEASH_RADIUS,
    ENEMY_HOME_SPEED,
    ENEMY_ATTACK_RANGE,
    ENEMY_WANDER_JITTER
} = require("../config");
const { players, enemies } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

// dx/dy は px/秒 なので、経過時間(秒)を掛けて1tickあたりの移動量に変換する
// 例: approach 50px/s * 0.15s = 7.5px/tick
const MOVE_SCALE = AI_UPDATE_INTERVAL / 1000;

function isTooFarFromSpawn(enemy) {
    return Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY) > ENEMY_LEASH_RADIUS;
}

function returnToSpawn(enemy) {
    const angle = Math.atan2(enemy.spawnY - enemy.y, enemy.spawnX - enemy.x);
    enemy.x += Math.cos(angle) * ENEMY_HOME_SPEED;
    enemy.y += Math.sin(angle) * ENEMY_HOME_SPEED;
}

function wander(enemy) {
    enemy.x += (Math.random() - 0.5) * ENEMY_WANDER_JITTER;
    enemy.y += (Math.random() - 0.5) * ENEMY_WANDER_JITTER;
}

// 指定マップにいる生存プレイヤーを { playerId -> player } で返す
function collectAlivePlayersOnMap(mapKey) {
    const result = {};
    for (const [playerId, p] of Object.entries(players)) {
        if (p.map === mapKey && p.hp > 0) {
            result[playerId] = { ...p, id: playerId };
        }
    }
    return result;
}

// AIが攻撃を選択した場合、射程内なら学習報酬を与えてプレイヤーにダメージを通知する
function tryAttack(io, aiManager, enemy, result, mapPlayers) {
    const target = mapPlayers[result.targetPlayerId];
    if (!target) return;

    const distance = Math.hypot(enemy.x - target.x, enemy.y - target.y);
    if (distance < ENEMY_ATTACK_RANGE) {
        aiManager.notifyAttackHit(enemy.id, enemy.atk);

        const targetSocket = findSocketByPlayerId(io, result.targetPlayerId);
        if (targetSocket) {
            targetSocket.emit("enemyAttack", {
                enemyId: enemy.id,
                enemyType: enemy.type,
                damage: enemy.atk
            });
        }
    }
}

function updateMapEnemies(io, aiManager, mapKey) {
    const mapEnemies = enemies[mapKey];
    if (!mapEnemies) return;

    const mapPlayers = collectAlivePlayersOnMap(mapKey);

    for (const enemy of Object.values(mapEnemies)) {
        if (enemy.type === "boss") continue;

        // AI による行動決定（未登録などで結果が無い場合は null）
        // ※ 学習自体は凍結中も止めない（isLearning計算やQ値更新は継続する）
        const result = aiManager.updateEnemy(enemy.id, mapPlayers, mapEnemies);
        const isFrozen = enemy.frozenUntil && Date.now() < enemy.frozenUntil;

        if (isFrozen) {
            // 凍結中は移動も攻撃も行わない
        } else if (isTooFarFromSpawn(enemy)) {
            returnToSpawn(enemy);
        } else if (result) {
            enemy.x += result.dx * MOVE_SCALE;
            enemy.y += result.dy * MOVE_SCALE;
        } else {
            wander(enemy);
        }

        if (!isFrozen && result?.shouldAttack && result.targetPlayerId) {
            tryAttack(io, aiManager, enemy, result, mapPlayers);
        }

        // 同じマップの全プレイヤーに位置を同期
        io.to(`map:${mapKey}`).emit("enemyMoved", {
            id: enemy.id,
            x: enemy.x,
            y: enemy.y,
            action: result?.action || "idle"
        });
    }
}

function logAIStats(aiManager) {
    const stats = aiManager.getAllStats();
    if (Object.keys(stats).length === 0) return;

    console.log("[ServerAI] Learning Stats:");
    for (const [type, s] of Object.entries(stats)) {
        console.log(`  [${type}] ε=${s.epsilon} updates=${s.updateCount} episodes=${s.episodeCount} qSize=${s.qTableSize} avgReward=${s.avgReward}`);
    }
}

// 敵のAI駆動ループを開始する（サーバーが稼働している限り学習し続ける）
function startEnemyLoop({ io, aiManager, saveAIData }) {
    setInterval(() => {
        KNOWN_MAPS.forEach(mapKey => updateMapEnemies(io, aiManager, mapKey));

        // 定期的にAIデータを自動保存
        aiManager.checkAutoSave(saveAIData);
    }, AI_UPDATE_INTERVAL);

    setInterval(() => logAIStats(aiManager), AI_STATS_LOG_INTERVAL);
}

module.exports = { startEnemyLoop };
