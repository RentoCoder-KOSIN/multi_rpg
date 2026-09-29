// Player combat: basic attack and active skills.
import Enemy from '../entities/Enemy.js';
import { SKILLS } from '../data/skills.js';
import { isAnyWindowOpen } from '../utils/uiState.js';
import { applySkillEffect, showHitEffect, showCriticalEffect } from './skillEffects.js';
import { applyBuffVisual } from './buffVisuals.js';
import { spawnSummon, destroySummon, isSummonSkill } from './summons.js';
import { areEffectsEnabled } from '../utils/effectsSettings.js';
import { getElementColor } from '../data/elements.js';
import { JOBS } from '../data/jobs.js';

// 職業が未設定（none）などのときに使う通常攻撃の既定値。職業ごとの値は data/jobs.js の attackRange / attackHit
const DEFAULT_BASIC_ATTACK_RANGE = 80;

// 通常攻撃の距離と命中方式を、現在の職業から取得する
function getBasicAttackSpec(player) {
    const job = JOBS[player.stats?.job];
    return {
        range: job?.attackRange ?? DEFAULT_BASIC_ATTACK_RANGE,
        hit: job?.attackHit ?? 'area',
        // 通常攻撃の間隔（職業の attackCooldownMult で速さが変わる）
        cooldown: BASIC_ATTACK_COOLDOWN_MS * (job?.attackCooldownMult ?? 1)
    };
}

// 通常攻撃の届く範囲を一瞬だけ輪で見せる（職業ごとの射程の違いが分かるように）
function showAttackRangeRing(scene, player, range) {
    if (!areEffectsEnabled(scene)) return;
    const feetY = player.body ? player.body.bottom : player.y + 16;
    const ring = scene.add.circle(player.x, feetY, range, 0xffffff, 0.06)
        .setStrokeStyle(2, 0xffffff, 0.5).setDepth(9);
    if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(ring);
    scene.tweens.add({ targets: ring, alpha: 0, duration: 250, onComplete: () => ring.destroy() });
}
const BASIC_ATTACK_COOLDOWN_MS = 500;
const FREEZE_DURATION_MS = 3000;
const PARALYZE_DURATION_MS = 2500;
const POISON_TICK_MS = 1000;
const POISON_TICKS = 5;

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

function showParalyzeEffect(scene, enemy) {
    const text = scene.add.text(enemy.x, enemy.y - 20, '⚡麻痺', {
        fontSize: '12px', color: '#ffee55', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 60, alpha: 0, duration: 800, onComplete: () => text.destroy() });
    if (enemy.setTint) {
        enemy.setTint(0xffee55);
        scene.time.delayedCall(PARALYZE_DURATION_MS, () => { if (enemy.active) enemy.clearTint(); });
    }
}

function showPoisonEffect(scene, enemy) {
    const text = scene.add.text(enemy.x, enemy.y - 20, '☠️毒', {
        fontSize: '12px', color: '#aa66ff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 60, alpha: 0, duration: 800, onComplete: () => text.destroy() });
}

// getDamage()の結果から、ダメージ数値表示に渡す色/相性情報を組み立てる。
// 属性が付いていれば数字をその属性色で表示し、相性が良い/悪いときだけ
// 背景にギザギザ(抜群)/にじみ(いまひとつ)のエフェクトが付く(showDamageNumber側で処理)。
function buildHitInfo(damageData) {
    const affinity = damageData.isElementAdvantage ? 'super' : (damageData.isElementWeak ? 'weak' : null);
    const color = damageData.element ? getElementColor(damageData.element) : null;
    if (!affinity && color === null) return null;
    return { color, affinity };
}

// 毒: 1秒おきに数tickダメージを与え続ける（enemy.takeDamageと同じ経路を通すので
// サーバーへの反映・撃破処理・ドロップ等は通常の攻撃と同様に扱われる）
function applyPoisonDot(scene, enemy, player, tickDamage) {
    if (!tickDamage || tickDamage <= 0) return;
    showPoisonEffect(scene, enemy);

    let ticksLeft = POISON_TICKS;
    const timer = scene.time.addEvent({
        delay: POISON_TICK_MS,
        repeat: POISON_TICKS - 1,
        callback: () => {
            ticksLeft--;
            if (!enemy || !enemy.active) {
                timer.remove();
                return;
            }
            enemy.takeDamage(tickDamage, player, null);
            if (ticksLeft <= 0) timer.remove();
        }
    });
}

// 与ダメージ判定(getDamage結果)に応じて、クリティカル/即死/属性相性/状態異常の
// 演出とサーバーへの状態異常付与をまとめて行う。基本攻撃・スキル両方から呼ばれる。
function applyHitEffects(scene, enemy, player, damageData) {
    if (damageData.isCrit) showCriticalEffect(scene, enemy);
    if (damageData.isExecute) showExecuteEffect(scene, enemy, player);
    if (damageData.isFreeze) showFreezeEffect(scene, enemy);
    else if (damageData.isParalyze) showParalyzeEffect(scene, enemy);
    if (damageData.isPoison) applyPoisonDot(scene, enemy, player, damageData.poisonTick);
}

/**
 * SPACE attack: hits every server-managed enemy within range.
 */
export function performBasicAttack(scene) {
    if (!scene.player || !scene.player.active) return;

    const player = scene.player;
    const now = scene.time.now;

    if (player.isImmobilized && player.isImmobilized()) {
        if (scene.notificationUI) scene.notificationUI.show('状態異常で動けない！', 'error');
        return;
    }

    const { range: attackRange, hit: attackHit, cooldown: attackCooldown } = getBasicAttackSpec(player);

    if (player.lastAttackTime && now - player.lastAttackTime < attackCooldown) {
        return;
    }

    let enemies = [];
    const allEnemies = scene.networkManager?.getEnemies() || {};

    Object.values(allEnemies).forEach(enemy => {
        if (!enemy || !enemy.active) return;

        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist < attackRange) {
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

    // 単体攻撃の職業（遠距離職など）は、一番近い1体だけに当たる
    if (attackHit === 'single') enemies = [nearest];

    showAttackRangeRing(scene, player, attackRange);

    enemies.forEach(enemy => {
        if (!enemy || !enemy.active) return;

        const damageData = player.getDamage(1, enemy);
        const damage = damageData.amount;

        const effects = {};
        if (damageData.isFreeze) effects.freezeMs = FREEZE_DURATION_MS;
        else if (damageData.isParalyze) effects.paralyzeMs = PARALYZE_DURATION_MS;
        enemy.takeDamage(damage, player, Object.keys(effects).length ? effects : null, buildHitInfo(damageData));
        enemy.lastHitTime = now;

        applyHitEffects(scene, enemy, player, damageData);

        if (areEffectsEnabled(scene)) scene.cameras.main.shake(100, 0.005);
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

    if (player.isImmobilized && player.isImmobilized()) {
        if (scene.notificationUI) scene.notificationUI.show('状態異常で動けない！', 'error');
        return;
    }

    const now = Date.now();
    const lastUse = player.skillCooldowns[skillId] || 0;
    const hasHolyWeapon = player.stats.equipment.weapon === 'holy_weapon';

    // Holy weapon: half cooldown, zero MP cost。パッシブのcooldownMultも重ねて掛ける
    let cdTime = (skill.cd || 2000) * (player.stats.cooldownMult ?? 1);
    if (hasHolyWeapon) cdTime = Math.floor(cdTime * 0.5);

    if (now - lastUse < cdTime) {
        if (scene.notificationUI) scene.notificationUI.show('クールダウン中...', 'error');
        return;
    }

    const mpCost = hasHolyWeapon ? 0 : Math.ceil((skill.mpCost || 0) * (player.stats.mpCostMult ?? 1));
    if (player.stats.mp < mpCost) {
        if (scene.notificationUI) scene.notificationUI.show('MPが足りません！', 'error');
        return;
    }

    // Using a summon skill while that same summon type already exists recalls it（トグル）。
    // 上限数に達している場合に一番古い召喚獣を入れ替える処理はspawnSummon側が行う。
    if (isSummonSkill(skillId)) {
        const existingSameType = (scene.activeSummons || []).find(s => s.active && s.summonSkillId === skillId);
        if (existingSameType) {
            destroySummon(scene, existingSameType);
            if (scene.notificationUI) scene.notificationUI.show('召喚獣を帰還させました', 'info');
            return;
        }
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
        const summons = (scene.activeSummons || []).filter(s => s.active);
        if (summons.length > 0) {
            summons.forEach(s => s.commandAttack());
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
            const baseHeal = skill.effect?.healPower || 50;
            const healAmount = Math.ceil(baseHeal * (1 + (int * 0.1)) * (1 + (skillLevel - 1) * 0.2) * (player.stats.healPowerMult ?? 1));

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

// Damage the enemies inside the skill's area (circle / line / fan).
// skill.hitType === 'single' なら範囲内で一番近い1体だけ、'area' なら範囲内の全員
// （skill.maxTargets があれば近い順にその数まで）に当てる。
function applyDamageSkill(scene, skill, { enemies, range, rangeType, direction, damageMultiplier }) {
    const player = scene.player;

    const candidates = [];
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

        if (isHit) candidates.push({ enemy, dist });
    });

    // 近い順に並べ、単体スキルなら1体、上限付きならその数までに絞る
    candidates.sort((a, b) => a.dist - b.dist);
    const limit = skill.hitType === 'single' ? 1 : (skill.maxTargets || Infinity);
    const targets = candidates.slice(0, limit).map(c => c.enemy);

    targets.forEach(enemy => {
        const damageData = player.getDamage(damageMultiplier, enemy, skill.element || null);
        let damage = damageData.amount;

        // アンデッド特効（エクソシズムなど effect.vsUndead を持つスキル）
        if (skill.effect?.vsUndead && UNDEAD_ENEMY_TYPES.includes(enemy.type)) {
            damage = Math.ceil(damage * skill.effect.vsUndead);
        }

        const effects = {};
        if (damageData.isFreeze) effects.freezeMs = FREEZE_DURATION_MS;
        else if (damageData.isParalyze) effects.paralyzeMs = PARALYZE_DURATION_MS;
        enemy.takeDamage(damage, player, Object.keys(effects).length ? effects : null, buildHitInfo(damageData));

        applyHitEffects(scene, enemy, player, damageData);

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
