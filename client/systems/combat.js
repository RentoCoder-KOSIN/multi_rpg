// Player combat: basic attack and active skills.
import Enemy from '../entities/Enemy.js';
import { SKILLS } from '../data/skills.js';
import { isAnyWindowOpen } from '../utils/uiState.js';
import { applySkillEffect, showHitEffect, showCriticalEffect } from './skillEffects.js';
import { applyBuffVisual } from './buffVisuals.js';
import { spawnSummon, destroySummon, isSummonSkill } from './summons.js';

const BASIC_ATTACK_RANGE = 80;
const BASIC_ATTACK_COOLDOWN_MS = 500;
const FREEZE_DURATION_MS = 3000;

// アンデブ系（エクソシズムなどの特効対象）。Enemy.type の文字列で判定する
const UNDEAD_ENEMY_TYPES = ['skeleton', 'ghost'];

function showExecuteEffect(scene, enemy, player) {
    if (scene.notificationUI) scene.notificationUI.show('即死効果発動！', 'warning');
    const text = scene.add.text(enemy.x, enemy.y - 40, '即死！', {
        fontSize: '14px', color: '#ff00ff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 80, alpha: 0, duration: 900, onComplete: () => text.destroy() });
}

function showFreezeEffect(scene, enemy) {
    const text = scene.add.text(enemy.x, enemy.y - 20, '❄️凍結', {
        fontSize: '12px', color: '#66ccff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 60, alpha: 0, duration: 800, onComplete: () => text.destroy() });
    if (enemy.setTint) {
        enemy.setTint(0x99ddff);
        scene.time.delayedCall(FREEZE_DURATION_MS, () => { if (enemy.active) enemy.clearTint(); });
    }
}

/**
 * SPACE attack: hits every server-managed enemy within range.
 */
export function performBasicAttack(scene) {
    if (!scene.player || !scene.player.active) return;

    const player = scene.player;
    const now = scene.time.now;

    if (player.lastAttackTime && now - player.lastAttackTime < BASIC_ATTACK_COOLDOWN_MS) {
        return;
    }

    const enemies = [];
    const allEnemies = scene.networkManager?.getEnemies() || {};

    Object.values(allEnemies).forEach(enemy => {
        if (!enemy || !enemy.active) return;

        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist < BASIC_ATTACK_RANGE) {
            enemies.push(enemy);
        }
    });

    if (enemies.length === 0) {
        if (scene.notificationUI) scene.notificationUI.show('攻撃範囲内に敵がいません', 'error');
        return;
    }

    // Face the nearest enemy
    const nearest = enemies.reduce((prev, curr) => {
        const prevDist = Math.hypot(prev.x - player.x, prev.y - player.y);
        const currDist = Math.hypot(curr.x - player.x, curr.y - player.y);
        return prevDist < currDist ? prev : curr;
    });
    player.facingDirection = (nearest.x < player.x) ? -1 : 1;

    enemies.forEach(enemy => {
        if (!enemy || !enemy.active) return;

        const damageData = player.getDamage(1, enemy);
        const damage = damageData.amount;

        const effects = damageData.isFreeze ? { freezeMs: FREEZE_DURATION_MS } : null;
        enemy.takeDamage(damage, player, effects);
        enemy.lastHitTime = now;

        if (damageData.isCrit) showCriticalEffect(scene, enemy);
        if (damageData.isExecute) showExecuteEffect(scene, enemy, player);
        if (damageData.isFreeze) showFreezeEffect(scene, enemy);

        scene.cameras.main.shake(100, 0.005);
    });

    player.lastAttackTime = now;
}

/**
 * Use an active skill: checks cooldown and MP, plays the effect, then applies the result.
 */
export function usePlayerSkill(scene, skillId) {
    const player = scene.player;
    const skill = SKILLS[skillId];
    if (!skill) return;

    if (isAnyWindowOpen(scene)) return;

    const now = Date.now();
    const lastUse = player.skillCooldowns[skillId] || 0;
    const hasHolyWeapon = player.stats.equipment.weapon === 'holy_weapon';

    // Holy weapon: half cooldown, zero MP cost
    let cdTime = skill.cd || 2000;
    if (hasHolyWeapon) cdTime = Math.floor(cdTime * 0.5);

    if (now - lastUse < cdTime) {
        if (scene.notificationUI) scene.notificationUI.show('クールダウン中...', 'error');
        return;
    }

    const mpCost = hasHolyWeapon ? 0 : (skill.mpCost || 0);
    if (player.stats.mp < mpCost) {
        if (scene.notificationUI) scene.notificationUI.show('MPが足りません！', 'error');
        return;
    }

    // Using a summon skill while a summon exists recalls it
    if (isSummonSkill(skillId) && scene.activeSummon && scene.activeSummon.active) {
        destroySummon(scene, scene.activeSummon);
        if (scene.notificationUI) scene.notificationUI.show('召喚獣を帰還させました', 'info');
        return;
    }

    player.stats.mp -= mpCost;

    // Summon skills start their cooldown when the summon disappears (see destroySummon)
    if (!isSummonSkill(skillId)) {
        player.skillCooldowns[skillId] = now;
    }

    player.saveStats();

    applySkillEffect(scene, skillId, player);

    if (isSummonSkill(skillId)) {
        spawnSummon(scene, player, skillId);
        return;
    }

    if (skillId === 'command_attack') {
        if (scene.activeSummon && scene.activeSummon.active) {
            scene.activeSummon.commandAttack();
            player.skillCooldowns[skillId] = now;
            if (scene.notificationUI) scene.notificationUI.show('召喚獣に突撃を命じた！', 'success');
        } else {
            if (scene.notificationUI) scene.notificationUI.show('召喚獣がいません！', 'error');
        }
        return;
    }

    // Skill level scaling: +15% effect and +10% range per level
    const skillLevel = player.stats.skillLevels?.[skillId] || 1;
    const levelBonus = 1 + (skillLevel - 1) * 0.15;
    const rangeBonus = 1 + (skillLevel - 1) * 0.1;

    const range = (skill.range || 80) * rangeBonus;
    const damageMultiplier = (skill.damageMult || 1) * levelBonus;
    const rangeType = skill.rangeType || 'circle';
    const enemies = scene.children.list.filter(child => child instanceof Enemy && child.active);

    // Auto-face the nearest enemy for fan / line skills
    if (rangeType === 'fan' || rangeType === 'line') {
        let nearest = null;
        let minDist = range * 1.5;
        enemies.forEach(e => {
            const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
            if (d < minDist) {
                minDist = d;
                nearest = e;
            }
        });
        if (nearest) {
            player.facingDirection = (nearest.x < player.x) ? -1 : 1;
        }
    }

    // Facing: right = 1, left = -1 (walk-left/right アニメーションを使うため flipX ではなく facingDirection を見る)
    const direction = player.facingDirection || 1;

    if (skill.targetType === 'party') {
        applyPartySkill(scene, skillId, skill, range);
    } else {
        applyDamageSkill(scene, skill, { enemies, range, rangeType, direction, damageMultiplier });
    }

    if (scene.notificationUI) {
        scene.notificationUI.show(`${skill.name}！`, 'warning');
    }
}

// Heal / buff the caster and party members within range
function applyPartySkill(scene, skillId, skill, range) {
    const player = scene.player;
    const myId = scene.networkManager.getPlayerId();
    const partyMemberIds = scene.networkManager.partyData?.members?.map(m => m.id) || [myId];
    const otherPlayers = scene.networkManager.getOtherPlayers();

    // The caster is always a target
    const targets = [{ player: player, id: myId, dist: 0 }];

    partyMemberIds.forEach(memberId => {
        if (memberId === myId) return;

        const remotePlayer = otherPlayers[memberId];
        if (!remotePlayer || !remotePlayer.active) return;

        const dist = Math.hypot(remotePlayer.x - player.x, remotePlayer.y - player.y);
        if (dist < range) {
            targets.push({ player: remotePlayer, id: memberId, dist });
        }
    });

    targets.forEach(({ player: target, id: targetId }) => {
        if (skillId === 'heal') {
            const skillLevel = player.stats.skillLevels?.[skillId] || 1;
            const int = player.stats.int || 5;
            const baseHeal = skill.heal || 50;
            const healAmount = Math.ceil(baseHeal * (1 + (int * 0.1)) * (1 + (skillLevel - 1) * 0.2));

            target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
            const healText = scene.add.text(target.x, target.y - 40, `+${healAmount}`, {
                fontSize: '16px', color: '#00ff00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
            scene.tweens.add({ targets: healText, y: target.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
            showHitEffect(scene, target.x, target.y, 0x00ff00);

            // Sync HP
            if (target === player) {
                scene.networkManager.sendPlayerStats(player.stats.hp, player.stats.maxHp);
            } else {
                scene.networkManager.healPlayer(targetId, healAmount);
            }
        } else if (skillId === 'attack_buff') {
            // 持続時間はクールタイム(30000ms)より短くし、常時バフ状態にならないようにする
            giveBuff(scene, target, targetId, 'attack_buff', Math.ceil(target.stats.atk * 0.5), 15000); // +50% ATK
        } else if (skillId === 'defense_buff') {
            giveBuff(scene, target, targetId, 'defense_buff', Math.ceil(target.stats.def * 0.5), 15000); // +50% DEF
        } else if (skillId === 'speed_buff') {
            giveBuff(scene, target, targetId, 'speed_buff', 50, 15000); // +50 speed
        } else if (skillId === 'summon_boost') {
            giveBuff(scene, target, targetId, 'summon_power_up', Math.ceil(player.stats.int * 2), 20000); // scales with INT
        }
    });
}

// Apply a buff locally, show it, and tell the server so the target's client applies it too
function giveBuff(scene, target, targetId, buffType, value, duration) {
    target.applyBuff(buffType, value, duration);
    applyBuffVisual(scene, target, buffType, value, duration);
    scene.networkManager.sendBuff(targetId, buffType, value, duration);
}

// Damage every enemy inside the skill's area (circle / line / fan)
function applyDamageSkill(scene, skill, { enemies, range, rangeType, direction, damageMultiplier }) {
    const player = scene.player;

    enemies.forEach(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - (player.y - 20); // measure from around the waist
        const dist = Math.sqrt(dx * dx + dy * dy);

        let isHit = false;
        const inFront = (direction > 0) ? dx > 0 : dx < 0;

        if (rangeType === 'circle') {
            isHit = dist < range;
        } else if (rangeType === 'line') {
            // Straight line ahead (about +-40 vertically)
            isHit = inFront && Math.abs(dx) < range && Math.abs(dy) < 40;
        } else if (rangeType === 'fan') {
            // Cone ahead (about 90 degrees)
            isHit = inFront && dist < range && Math.abs(dy) < Math.abs(dx) + 20;
        }

        if (!isHit) return;

        const damageData = player.getDamage(damageMultiplier, enemy);
        let damage = damageData.amount;

        // アンデッド特効（エクソシズムなど bonusVsUndead を持つスキル）
        if (skill.bonusVsUndead && UNDEAD_ENEMY_TYPES.includes(enemy.type)) {
            damage = Math.ceil(damage * skill.bonusVsUndead);
        }

        if (damageData.isCrit) showCriticalEffect(scene, enemy);
        if (damageData.isExecute) showExecuteEffect(scene, enemy, player);
        if (damageData.isFreeze) showFreezeEffect(scene, enemy);

        const effects = damageData.isFreeze ? { freezeMs: FREEZE_DURATION_MS } : null;
        enemy.takeDamage(damage, player, effects);

        // Lifesteal
        if (player.stats.lifesteal > 0) {
            const heal = Math.ceil(damage * player.stats.lifesteal);
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
            const healText = scene.add.text(player.x, player.y - 40, `+${heal}`, {
                fontSize: '12px', color: '#00ff00', fontFamily: '"Press Start 2P"'
            }).setOrigin(0.5);
            scene.tweens.add({ targets: healText, y: player.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
        }

        showHitEffect(scene, enemy.x, enemy.y, skill.color || 0xffffff);
    });
}
