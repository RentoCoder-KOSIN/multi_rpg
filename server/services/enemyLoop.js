const {
    KNOWN_MAPS,
    AI_UPDATE_INTERVAL,
    AI_STATS_LOG_INTERVAL,
    ENEMY_LEASH_RADIUS,
    ENEMY_HOME_SPEED,
    ENEMY_ATTACK_RANGE,
    ENEMY_WANDER_JITTER,
    ENEMY_ATTACK_COOLDOWN_MS
} = require("../config");
const { players, enemies } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");
const { getLevelDiffMultiplier } = require("../utils/levelScaling");
const { getEnemyStats, isBossType } = require("../data/enemyStats");

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
//
// 以前はここにクールダウンが無く、AIの行動ホールド(300ms)が空くたびに
// 攻撃可能になっていたため、敵が1秒に3回以上も攻撃してくる
// 「攻撃速度が速すぎる」状態になっていた。ENEMY_ATTACK_COOLDOWN_MS で
// 実際の攻撃間隔をAIの意思決定間隔から独立させる。
function tryAttack(io, aiManager, enemy, result, mapPlayers) {
    const target = mapPlayers[result.targetPlayerId];
    if (!target) return;

    const now = Date.now();
    if (enemy.lastAttackTime && now - enemy.lastAttackTime < ENEMY_ATTACK_COOLDOWN_MS) return;

    const distance = Math.hypot(enemy.x - target.x, enemy.y - target.y);
    if (distance < ENEMY_ATTACK_RANGE) {
        enemy.lastAttackTime = now;

        // レベル差補正: 敵とプレイヤーのレベル差が大きいほど、
        // レベルが高い側に有利になる（格上の攻撃はほぼ通らない）
        const levelMult = getLevelDiffMultiplier(enemy.level, target.level);
        const damage = Math.max(1, Math.ceil(enemy.atk * levelMult));

        aiManager.notifyAttackHit(enemy.id, damage);

        // 状態異常（凍結・麻痺・毒）: 敵定義に statusEffect があれば確率判定する
        const def = getEnemyStats(enemy.type);
        let statusEffect = null;
        if (def?.statusEffect && Math.random() < (def.statusEffect.chance || 0)) {
            const { type, duration, tickDamage } = def.statusEffect;
            statusEffect = { type, duration, tickDamage };
        }

        const targetSocket = findSocketByPlayerId(io, result.targetPlayerId);
        if (targetSocket) {
            targetSocket.emit("enemyAttack", {
                enemyId: enemy.id,
                enemyType: enemy.type,
                damage,
                statusEffect
            });
        }
    }
}

// クエスト用ボスは Q学習AIを使わず、単純な「近くのプレイヤーを追いかけて攻撃」で動かす。
// 以前はループ側でボスを丸ごとスキップしていたため、サーバー管理になったボスが
// 動かず攻撃もしてこなかった。
const BOSS_AGGRO_RADIUS = 450;   // px: この距離内のプレイヤーを追跡する
const BOSS_LEASH_RADIUS = 600;   // px: スポーン地点からこれ以上離れたら帰還する
const BOSS_MOVE_SPEED = 70;      // px/秒

function updateBoss(io, aiManager, enemy, mapPlayers) {
    // 最も近い生存プレイヤーを狙う
    let target = null;
    let nearest = Infinity;
    for (const p of Object.values(mapPlayers)) {
        const d = Math.hypot(enemy.x - p.x, enemy.y - p.y);
        if (d < nearest) { nearest = d; target = p; }
    }

    const tooFar = Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY) > BOSS_LEASH_RADIUS;

    if (tooFar || !target || nearest > BOSS_AGGRO_RADIUS) {
        // 誰も近くにいなければスポーン地点へ戻る（着いたらその場で待機）
        if (Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY) > 5) returnToSpawn(enemy);
        return "idle";
    }

    // 攻撃範囲の少し手前まで近づく（範囲内なら立ち止まって攻撃）
    if (nearest > ENEMY_ATTACK_RANGE * 0.8) {
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        enemy.x += Math.cos(angle) * BOSS_MOVE_SPEED * MOVE_SCALE;
        enemy.y += Math.sin(angle) * BOSS_MOVE_SPEED * MOVE_SCALE;
    }

    tryAttack(io, aiManager, enemy, { targetPlayerId: target.id }, mapPlayers);
    return "chase";
}

function updateMapEnemies(io, aiManager, mapKey) {
    const mapEnemies = enemies[mapKey];
    if (!mapEnemies) return;

    const mapPlayers = collectAlivePlayersOnMap(mapKey);

    for (const enemy of Object.values(mapEnemies)) {
        if (isBossType(enemy.type)) {
            const isFrozen = enemy.frozenUntil && Date.now() < enemy.frozenUntil;
            const isParalyzed = enemy.paralyzedUntil && Date.now() < enemy.paralyzedUntil;
            const action = (isFrozen || isParalyzed) ? "idle" : updateBoss(io, aiManager, enemy, mapPlayers);
            io.to(`map:${mapKey}`).emit("enemyMoved", { id: enemy.id, x: enemy.x, y: enemy.y, action });
            continue;
        }

        // AI による行動決定（未登録などで結果が無い場合は null）
        // ※ 学習自体は凍結中も止めない（isLearning計算やQ値更新は継続する）
        const result = aiManager.updateEnemy(enemy.id, mapPlayers, mapEnemies);
        const isFrozen = enemy.frozenUntil && Date.now() < enemy.frozenUntil;
        const isParalyzed = enemy.paralyzedUntil && Date.now() < enemy.paralyzedUntil;
        const isImmobilized = isFrozen || isParalyzed;

        if (isImmobilized) {
            // 凍結中・麻痺中は移動も攻撃も行わない
        } else if (isTooFarFromSpawn(enemy)) {
            returnToSpawn(enemy);
        } else if (result) {
            enemy.x += result.dx * MOVE_SCALE;
            enemy.y += result.dy * MOVE_SCALE;
        } else {
            wander(enemy);
        }

        if (!isImmobilized && result?.shouldAttack && result.targetPlayerId) {
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
