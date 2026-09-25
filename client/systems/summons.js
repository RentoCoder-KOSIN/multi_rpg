// Summoned beast lifecycle: own summon (spawn/destroy) and other players' summons (network sync).
import Enemy from '../entities/Enemy.js';
import SummonedBeast from '../entities/SummonedBeast.js';
import { applySkillEffect } from './skillEffects.js';

export function isSummonSkill(skillId) {
    return skillId === 'summon' || skillId === 'mega_summon' || skillId === 'demon_lord_summon';
}

/**
 * Spawn the local player's summon (replacing any existing one) and notify the server.
 */
export function spawnSummon(scene, player, summonType = 'summon') {
    if (scene.activeSummon && scene.activeSummon.active) {
        destroySummon(scene, scene.activeSummon);
    }

    const summonX = player.x + (player.facingDirection === -1 ? -50 : 50);
    const summonY = player.y;

    const skillLevel = player.stats.skillLevels?.[summonType] || 1;
    const summon = new SummonedBeast(scene, summonX, summonY, player, summonType, skillLevel);
    scene.activeSummon = summon;

    // Contact damage from enemies that already exist (new enemies are handled in spawnEnemyFromServer)
    const enemies = scene.children.list.filter(child => child instanceof Enemy && child.active);
    enemies.forEach(enemy => {
        if (enemy.active) {
            scene.physics.add.overlap(summon, enemy, () => {
                const now = scene.time.now;
                if (!summon.lastHitTime || now - summon.lastHitTime > 1000) {
                    summon.takeDamage(enemy.atk);
                    if (summon) summon.lastHitTime = now;
                }
            });
        }
    });

    applySkillEffect(scene, 'summon', player);

    if (scene.notificationUI) {
        scene.notificationUI.show('召喚獣を呼び出した！', 'success');
    }

    if (scene.networkManager) {
        scene.networkManager.sendSummonUpdate({
            type: 'spawn',
            isMega: summon.isMega,
            x: summon.x,
            y: summon.y
        });
    }
}

/**
 * Remove the local player's summon, start the summon cooldown and notify the server.
 */
export function destroySummon(scene, summon) {
    if (!summon || !summon.active) return;

    // Cooldown starts when the summon disappears
    if (scene.player && scene.player.skillCooldowns) {
        const skillId = summon.isMega ? 'mega_summon' : 'summon';
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

    if (summon.hpBar) summon.hpBar.destroy();
    if (summon.hpBarBg) summon.hpBarBg.destroy();
    if (summon.preDestroy) summon.preDestroy();
    summon.destroy();

    if (scene.activeSummon === summon) {
        scene.activeSummon = null;
        if (scene.networkManager) {
            scene.networkManager.sendSummonUpdate({ type: 'despawn' });
        }
    }
}

/**
 * Apply a summon event received from the server for another player.
 * @param {{id: string, type: 'spawn'|'move'|'despawn', x?: number, y?: number, isMega?: boolean}} data
 */
export function handleSummonUpdate(scene, data) {
    if (data.id === scene.networkManager.getPlayerId()) return; // ignore our own echo

    if (data.type === 'spawn') {
        const owner = scene.networkManager.getOtherPlayers()[data.id];
        if (owner) {
            if (scene.otherSummons[data.id]) {
                scene.otherSummons[data.id].destroy();
            }
            const summon = new SummonedBeast(scene, data.x, data.y, owner, data.isMega);
            scene.otherSummons[data.id] = summon;
        }
    } else if (data.type === 'move') {
        const summon = scene.otherSummons[data.id];
        if (summon && summon.active) {
            // Simple movement toward the reported position (no interpolation yet)
            scene.physics.moveTo(summon, data.x, data.y, 200);

            // Snap when close enough
            if (Phaser.Math.Distance.Between(summon.x, summon.y, data.x, data.y) < 10) {
                summon.body.reset(data.x, data.y);
            }
        }
    } else if (data.type === 'despawn') {
        const summon = scene.otherSummons[data.id];
        if (summon) {
            summon.destroy();
            delete scene.otherSummons[data.id];
        }
    }
}
