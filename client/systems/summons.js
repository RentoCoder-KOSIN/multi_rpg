// Summoned beast lifecycle: own summons (spawn/destroy, up to player.stats.maxSummons at once)
// and other players' summons (network sync, keyed by a per-summon id so several can coexist).
import Enemy from '../entities/Enemy.js';
import SummonedBeast from '../entities/SummonedBeast.js';
import { applySkillEffect } from './skillEffects.js';
import { getLevelDiffMultiplier } from '../utils/levelScaling.js';

export function isSummonSkill(skillId) {
    return skillId === 'summon' || skillId === 'mega_summon' || skillId === 'demon_lord_summon';
}

let summonIdCounter = 0;
function nextSummonId() {
    // 同一プレイヤーの複数召喚獣を他クライアントで区別するための一意なID。
    summonIdCounter += 1;
    return `${Date.now()}_${summonIdCounter}`;
}

/**
 * Spawn the local player's summon and notify the server.
 * 同じ種類の召喚獣が既にいる場合はそれを呼び戻す（トグル）。
 * player.stats.maxSummons（通常1、上位職パッシブで2）に達している場合は
 * 一番古い召喚獣を帰してから新しく呼び出す。
 */
export function spawnSummon(scene, player, summonType = 'summon') {
    if (!scene.activeSummons) scene.activeSummons = [];

    const maxSummons = player.stats.maxSummons || 1;
    if (scene.activeSummons.length >= maxSummons) {
        const oldest = scene.activeSummons[0];
        destroySummon(scene, oldest);
    }

    // 既存の召喚獣と重ならないよう、召喚数に応じて少しずつ位置をずらす。
    const offsetIndex = scene.activeSummons.length;
    const baseOffset = player.facingDirection === -1 ? -50 : 50;
    const summonX = player.x + baseOffset + offsetIndex * (baseOffset > 0 ? 30 : -30);
    const summonY = player.y;

    const skillLevel = player.stats.skillLevels?.[summonType] || 1;
    const summon = new SummonedBeast(scene, summonX, summonY, player, summonType, skillLevel);
    summon.summonSkillId = summonType; // どのスキルで呼ばれたか（クールダウン管理・トグル判定用）
    summon._summonId = nextSummonId(); // 他クライアントへの同期用の一意なID
    scene.activeSummons.push(summon);

    // このSummonのために作ったColliderをここに集めておき、召喚獣が消滅するときに
    // 必ず破棄する（destroySummon参照）。
    // 修正前はここで敵ごとに登録したoverlapを一切破棄していなかったため、
    // 「召喚→消滅→再召喚」を繰り返すたびに古いColliderが物理ワールドに残り続け、
    // 敵を倒しても当たり判定コストが減らず、徐々に重くなるバグの原因になっていた。
    summon._colliders = [];

    // Contact damage from enemies that already exist (new enemies are handled in spawnEnemyFromServer)
    const enemies = scene.children.list.filter(child => child instanceof Enemy && child.active);
    enemies.forEach(enemy => {
        if (enemy.active) {
            const collider = scene.physics.add.overlap(summon, enemy, () => {
                const now = scene.time.now;
                if (!summon.lastHitTime || now - summon.lastHitTime > 1000) {
                    const levelMult = getLevelDiffMultiplier(enemy.level, summon.level ?? 1);
                    summon.takeDamage(Math.max(1, Math.ceil(enemy.atk * levelMult)));
                    if (summon) summon.lastHitTime = now;
                }
            });
            summon._colliders.push(collider);
        }
    });

    applySkillEffect(scene, 'summon', player);

    if (scene.notificationUI) {
        scene.notificationUI.show('召喚獣を呼び出した！', 'success');
    }

    if (scene.networkManager) {
        scene.networkManager.sendSummonUpdate({
            type: 'spawn',
            summonId: summon._summonId,
            summonType,
            isMega: summon.isMega,
            x: summon.x,
            y: summon.y
        });
    }
}

/**
 * Remove one of the local player's summons, start its skill's cooldown and notify the server.
 */
export function destroySummon(scene, summon) {
    if (!summon || !summon.active) return;

    // Cooldown starts when the summon disappears
    if (scene.player && scene.player.skillCooldowns) {
        const skillId = summon.summonSkillId || (summon.isMega ? 'mega_summon' : 'summon');
        scene.player.skillCooldowns[skillId] = Date.now();
    }

    const fadeCircle = scene.add.circle(summon.x, summon.y, 20, 0x9370db, 0.5);
    scene.tweens.add({
        targets: fadeCircle,
        scale: 2,
        alpha: 0,
        duration: 500,
        onComplete: () => fadeCircle.destroy()
    });

    // このSummonに紐づく全Colliderを破棄してから消す（物理ワールドへの残留を防ぐ）
    if (summon._colliders) {
        summon._colliders.forEach(c => { if (c && c.world) c.destroy(); });
        summon._colliders.length = 0;
    }

    if (summon.hpBar) summon.hpBar.destroy();
    if (summon.hpBarBg) summon.hpBarBg.destroy();
    if (summon.preDestroy) summon.preDestroy();
    summon.destroy();

    if (scene.activeSummons) {
        const idx = scene.activeSummons.indexOf(summon);
        if (idx !== -1) {
            scene.activeSummons.splice(idx, 1);
            if (scene.networkManager) {
                scene.networkManager.sendSummonUpdate({ type: 'despawn', summonId: summon._summonId });
            }
        }
    }
}

/**
 * Apply a summon event received from the server for another player.
 * 同じプレイヤーが同時に複数の召喚獣を出せるよう、summonId（プレイヤーIDとは別の
 * 召喚獣固有のID）ごとに管理する。summonIdが無い古い形式のデータは 'default' として扱う。
 * @param {{id: string, type: 'spawn'|'move'|'despawn', summonId?: string, summonType?: string, x?: number, y?: number, isMega?: boolean}} data
 */
export function handleSummonUpdate(scene, data) {
    if (data.id === scene.networkManager.getPlayerId()) return; // ignore our own echo

    if (!scene.otherSummons[data.id]) scene.otherSummons[data.id] = {};
    const ownerSummons = scene.otherSummons[data.id];
    const summonId = data.summonId || 'default';

    if (data.type === 'spawn') {
        const owner = scene.networkManager.getOtherPlayers()[data.id];
        if (owner) {
            if (ownerSummons[summonId]) {
                ownerSummons[summonId].destroy();
            }
            const type = data.summonType || (data.isMega ? 'mega' : 'normal');
            const summon = new SummonedBeast(scene, data.x, data.y, owner, type);
            ownerSummons[summonId] = summon;
        }
    } else if (data.type === 'move') {
        const summon = ownerSummons[summonId];
        if (summon && summon.active) {
            // Simple movement toward the reported position (no interpolation yet)
            scene.physics.moveTo(summon, data.x, data.y, 200);

            // Snap when close enough
            if (Phaser.Math.Distance.Between(summon.x, summon.y, data.x, data.y) < 10) {
                summon.body.reset(data.x, data.y);
            }
        }
    } else if (data.type === 'despawn') {
        const summon = ownerSummons[summonId];
        if (summon) {
            summon.destroy();
            delete ownerSummons[summonId];
        }
    }
}
