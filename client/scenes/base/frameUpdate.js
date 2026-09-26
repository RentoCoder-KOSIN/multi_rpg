// Per-frame logic split out of BaseGameScene.update().
import PlayerNameUI from '../../ui/PlayerNameUI.js';
import { getLevelDiffMultiplier } from '../../utils/levelScaling.js';

const ENEMY_TOUCH_DISTANCE = 35;
const ENEMY_TOUCH_COOLDOWN_MS = 1000;
const MP_REGEN_INTERVAL_MS = 1000;
const SUMMON_POSITION_SYNC_MS = 100;
const STATS_SYNC_INTERVAL_MS = 500;

/**
 * Melee-range contact damage — LOCAL (non server-managed) enemies only.
 *
 * サーバー管理の敵（isServerManaged）は、サーバー側AIが別途 "enemyAttack" イベントで
 * 攻撃ダメージを送ってくる（server/services/enemyLoop.js の tryAttack、
 * ENEMY_ATTACK_COOLDOWN_MS=1200ms）。以前はここでも全ての敵に対して接触ダメージを
 * 与えていたため、近づいて棒立ちになっている間、同じ敵から
 * 「サーバーAIの攻撃」と「このクライアント側の接触ダメージ」の二重にダメージを受けてしまい、
 * 見た目上「敵の攻撃速度が速すぎる」状態になっていた
 * （entitySetup.js のオーバーラップ判定では既に同様の対応済みだったが、
 * こちらのフレーム毎ループには反映されていなかった）。
 * サーバー管理の敵については、ここでの接触ダメージを無効化する。
 */
export function updateEnemyContactDamage(scene) {
    const enemies = scene.networkManager?.getEnemies() || {};
    const now = scene.time.now;
    const player = scene.player;

    Object.values(enemies).forEach(enemy => {
        if (!enemy.active) return;
        if (!player || !player.active) return;
        if (enemy.isServerManaged) return; // サーバー側で"enemyAttack"として別途処理される

        const distance = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
        if (distance < ENEMY_TOUCH_DISTANCE) {
            if (!enemy.lastAttackTime || now - enemy.lastAttackTime > ENEMY_TOUCH_COOLDOWN_MS) {
                enemy.lastAttackTime = now;
                // レベル差補正を先にかけてから防御力で軽減する
                const levelMult = getLevelDiffMultiplier(enemy.level, player.stats?.level ?? 1);
                const scaledAtk = (enemy.atk || 10) * levelMult;
                const finalDamage = Math.max(1, scaledAtk - (player.getDefense ? player.getDefense() : 0));
                player.takeDamage(finalDamage);
                if (enemy.ai) enemy.ai.notifyDamageDealt(finalDamage);
            }
        }
    });
}

/**
 * Natural MP regeneration. Holy weapon keeps MP full.
 * @param {number} time - scene time in ms
 */
export function regenerateMp(scene, time) {
    const stats = scene.player?.stats;
    if (!stats) return;

    if (stats.equipment && stats.equipment.weapon === 'holy_weapon') {
        if (stats.mp < stats.maxMp) stats.mp = stats.maxMp;
        return;
    }

    // Once per second: 1% of max MP + MEN / 5
    if (!scene._lastMpRegen || time - scene._lastMpRegen > MP_REGEN_INTERVAL_MS) {
        const regenAmount = Math.max(1, Math.floor(stats.maxMp * 0.01) + Math.floor(stats.men / 5));
        if (stats.mp < stats.maxMp) {
            stats.mp = Math.min(stats.maxMp, stats.mp + regenAmount);
        }
        scene._lastMpRegen = time;
    }
}

/**
 * Push HP/MP changes to the server (and so to party members), at most twice a second.
 * @param {number} time - scene time in ms
 */
export function syncPlayerStats(scene, time) {
    if (scene._lastStatsSync && time - scene._lastStatsSync < STATS_SYNC_INTERVAL_MS) return;
    scene._lastStatsSync = time;
    scene.networkManager?.syncLocalPlayerStats();
}

/**
 * Create / update / remove the name tags above other players.
 */
export function updateRemotePlayerNameTags(scene) {
    const otherPlayers = scene.networkManager.getOtherPlayers();
    const playerNames = scene.registry.get('playerNames') || {};

    Object.keys(otherPlayers).forEach(id => {
        const op = otherPlayers[id];
        if (op && op.active) {
            const playerName = playerNames[id] || `Player ${id.substring(0, 6)}`;
            if (!op.nameUI) {
                op.nameUI = new PlayerNameUI(scene, op, playerName, id);
            } else {
                op.nameUI.updatePosition();
                if (op.nameUI.playerName !== playerName) {
                    op.nameUI.setName(playerName);
                }
            }
        } else if (op && op.nameUI) {
            try { op.nameUI.destroy(); } catch (e) { }
            op.nameUI = null;
        }
    });
}

/**
 * Update the local summon and send its position to the server (throttled).
 */
export function updateActiveSummon(scene) {
    const summon = scene.activeSummon;
    if (!summon || !summon.active) return;

    if (summon.updateSummon) summon.updateSummon();

    // updateSummon() may have removed the summon
    if (!scene.activeSummon || !scene.activeSummon.active) return;

    const now = scene.time.now;
    if (!summon.lastPosSent || now - summon.lastPosSent > SUMMON_POSITION_SYNC_MS) {
        if (summon.x !== summon.lastX || summon.y !== summon.lastY) {
            scene.networkManager.sendSummonUpdate({ type: 'move', x: summon.x, y: summon.y });
            summon.lastX = summon.x;
            summon.lastY = summon.y;
            summon.lastPosSent = now;
        }
    }
}
