import { UI_FONT } from '../fontConfig.js';
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
import { isAdminFlag } from '../ui/AdminUI.js';
import { COMBAT_CONFIG } from '../gameConstants.js';

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
    // 命中判定(findBasicAttackTargets)と同じ中心に描く（押下中の範囲表示aim.jsとも一致させる）
    const ring = scene.add.circle(player.x, player.y, range, 0xffffff, 0.06)
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
        fontSize: '14px', color: '#ff00ff', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 80, alpha: 0, duration: 900, onComplete: () => text.destroy() });
}

function showFreezeEffect(scene, enemy) {
    const text = scene.add.text(enemy.x, enemy.y - 20, '❄️凍結', {
        fontSize: '12px', color: '#66ccff', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 60, alpha: 0, duration: 800, onComplete: () => text.destroy() });
    if (enemy.setTint) {
        enemy.setTint(0x99ddff);
        scene.time.delayedCall(FREEZE_DURATION_MS, () => { if (enemy.active) enemy.clearTint(); });
    }
}

function showParalyzeEffect(scene, enemy) {
    const text = scene.add.text(enemy.x, enemy.y - 20, '⚡麻痺', {
        fontSize: '12px', color: '#ffee55', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: enemy.y - 60, alpha: 0, duration: 800, onComplete: () => text.destroy() });
    if (enemy.setTint) {
        enemy.setTint(0xffee55);
        scene.time.delayedCall(PARALYZE_DURATION_MS, () => { if (enemy.active) enemy.clearTint(); });
    }
}

function showPoisonEffect(scene, enemy) {
    const text = scene.add.text(enemy.x, enemy.y - 20, '☠️毒', {
        fontSize: '12px', color: '#aa66ff', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
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

// スキル固有の状態異常。装備由来の状態異常とは独立して抽選し、両方が発生した場合も
// 最も長い行動不能時間・最も高い毒ダメージを使う。
function getSkillStatusEffects(skill, player) {
    const effect = skill.effect || {};
    const type = effect.statusEffect;
    if (!['freeze', 'paralyze', 'poison'].includes(type)) return {};
    const chance = Phaser.Math.Clamp(Number(effect.statusChance ?? 1), 0, 1);
    if (Math.random() >= chance) return {};

    const duration = Math.max(0, Number(effect.statusDuration) || (
        type === 'freeze' ? FREEZE_DURATION_MS : type === 'paralyze' ? PARALYZE_DURATION_MS : POISON_TICK_MS * POISON_TICKS
    ));
    if (type === 'freeze') return { freezeMs: duration };
    if (type === 'paralyze') return { paralyzeMs: duration };

    const ratio = Number(effect.poisonAtkRatio) || 0;
    const tickDamage = Math.max(1, Number(effect.poisonTickDamage) || Math.ceil((player.stats.atk || 1) * ratio));
    return { poisonMs: duration, poisonTick: tickDamage };
}

function mergeStatusEffects(damageData, skillEffects) {
    const effects = {};
    if (damageData.isFreeze || skillEffects.freezeMs) effects.freezeMs = Math.max(skillEffects.freezeMs || 0, damageData.isFreeze ? FREEZE_DURATION_MS : 0);
    if (!effects.freezeMs && (damageData.isParalyze || skillEffects.paralyzeMs)) effects.paralyzeMs = Math.max(skillEffects.paralyzeMs || 0, damageData.isParalyze ? PARALYZE_DURATION_MS : 0);
    if (damageData.isPoison || skillEffects.poisonMs) {
        effects.poisonMs = Math.max(skillEffects.poisonMs || 0, damageData.isPoison ? POISON_TICK_MS * POISON_TICKS : 0);
        effects.poisonTick = Math.max(skillEffects.poisonTick || 0, damageData.isPoison ? damageData.poisonTick || 0 : 0);
    }
    return effects;
}

/**
 * 通常攻撃の対象を決める（実際の攻撃と、SPACE押下中の範囲プレビューの両方で使う）。
 * @returns {{range:number, hit:string, cooldown:number, inRange:Array, nearest:object|null, targets:Array}}
 */
export function findBasicAttackTargets(scene, player) {
    const { range, hit, cooldown } = getBasicAttackSpec(player);
    const inRange = [];
    const allEnemies = scene.networkManager?.getEnemies() || {};

    Object.values(allEnemies).forEach(enemy => {
        if (!enemy || !enemy.active) return;
        if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < range) inRange.push(enemy);
    });

    if (inRange.length === 0) return { range, hit, cooldown, inRange, nearest: null, targets: [] };

    const nearest = inRange.reduce((prev, curr) => {
        const prevDist = Math.hypot(prev.x - player.x, prev.y - player.y);
        const currDist = Math.hypot(curr.x - player.x, curr.y - player.y);
        return prevDist < currDist ? prev : curr;
    });
    // 単体攻撃の職業（遠距離職など）は、一番近い1体だけに当たる
    const targets = hit === 'single' ? [nearest] : inRange;
    return { range, hit, cooldown, inRange, nearest, targets };
}

/**
 * SPACE attack (キーを離した時に呼ばれる): hits every server-managed enemy within range.
 */
export function performBasicAttack(scene) {
    if (!scene.player || !scene.player.active) return;

    const player = scene.player;
    const now = scene.time.now;

    if (player.isImmobilized && player.isImmobilized()) {
        if (scene.notificationUI) scene.notificationUI.show('状態異常で動けない！', 'error');
        return;
    }

    const { range: attackRange, cooldown: attackCooldown, nearest, targets: enemies } = findBasicAttackTargets(scene, player);

    if (player.lastAttackTime && now - player.lastAttackTime < attackCooldown) {
        return;
    }

    if (!nearest) {
        if (scene.notificationUI) scene.notificationUI.show('攻撃範囲内に敵がいません', 'error');
        return;
    }

    // Face the nearest enemy
    player.facingDirection = (nearest.x < player.x) ? -1 : 1;

    showAttackRangeRing(scene, player, attackRange);

    enemies.forEach(enemy => {
        if (!enemy || !enemy.active) return;

        const damageData = player.getDamage(COMBAT_CONFIG.BASIC_ATTACK_MULT, enemy);
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

// --- スキルの共通計算（実行時と、ボタン押下中の範囲プレビューの両方で使う） ---

// Holy weapon: half cooldown, zero MP cost。パッシブのcooldownMult/mpCostMultも重ねて掛ける
export function getSkillCooldownMs(player, skill) {
    if (isAdminFlag('free')) return 0; // adminモード: クールダウンなし
    const hasHolyWeapon = player.stats.equipment?.weapon === 'holy_weapon';
    let cdTime = (skill.cd || 2000) * (player.stats.cooldownMult ?? 1);
    if (hasHolyWeapon) cdTime = Math.floor(cdTime * 0.5);
    return cdTime;
}

export function getSkillMpCost(player, skill) {
    if (isAdminFlag('free')) return 0; // adminモード: MP消費なし
    const hasHolyWeapon = player.stats.equipment?.weapon === 'holy_weapon';
    return hasHolyWeapon ? 0 : Math.ceil((skill.mpCost || 0) * (player.stats.mpCostMult ?? 1));
}

/** クールダウンとMPの両方が満たされていて、今すぐ撃てるか */
export function isSkillReady(player, skillId) {
    const skill = SKILLS[skillId];
    if (!skill) return false;
    const lastUse = player.skillCooldowns[skillId] || 0;
    return Date.now() - lastUse >= getSkillCooldownMs(player, skill) &&
        player.stats.mp >= getSkillMpCost(player, skill);
}

/**
 * 「押して範囲表示→離して発動」にするスキルか。
 * 召喚・突撃命令は範囲を持たないので、押した瞬間に即発動する（false）。
 */
export function skillNeedsAim(skillId) {
    if (!SKILLS[skillId]) return false;
    return !isSummonSkill(skillId) && skillId !== 'command_attack';
}

/** スキル射程はスキル定義値で固定。レベルは威力だけを上げる。 */
export function getSkillAimSpec(player, skillId) {
    const skill = SKILLS[skillId];
    if (!skill) return null;
    return {
        skill,
        range: skill.range || 80,
        rangeType: skill.rangeType || 'circle',
        isParty: skill.targetType === 'party'
    };
}

/** スキルの判定対象になる敵一覧 */
export function getSkillEnemyPool(scene) {
    return scene.children.list.filter(child => child instanceof Enemy && child.active);
}

// fan / line スキルの自動向き補正: 射程の1.5倍以内で一番近い敵の方向（-1 / 1）。いなければnull
export function findNearestEnemyDirection(player, enemies, range) {
    let nearest = null;
    let minDist = range * 1.5;
    enemies.forEach(e => {
        const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });
    return nearest ? ((nearest.x < player.x) ? -1 : 1) : null;
}

/**
 * ダメージスキルの命中対象を決める（circle / line / fan、近い順、単体・maxTargets対応）。
 * 実際の攻撃と範囲プレビューで同じ結果になるよう、判定はここだけに置く。
 * 判定の中心は腰あたり(player.y - 20)。
 */
export function selectSkillTargets(player, skill, { enemies, range, rangeType, direction }) {
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
    return candidates.slice(0, limit).map(c => c.enemy);
}

/**
 * Use an active skill: checks cooldown and MP, plays the effect, then applies the result.
 * （ボタン/キーを離した時に呼ばれる。召喚・突撃命令だけは押した瞬間に呼ばれる）
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
    const cdTime = getSkillCooldownMs(player, skill);

    if (now - lastUse < cdTime) {
        if (scene.notificationUI) scene.notificationUI.show('クールダウン中...', 'error');
        return;
    }

    const mpCost = getSkillMpCost(player, skill);
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

    // Skill level scaling: damage only. Range remains the skill definition's base range.
    const skillLevel = player.stats.skillLevels?.[skillId] || 1;
    const levelBonus = 1 + (skillLevel - 1) * COMBAT_CONFIG.SKILL_LEVEL_BONUS;

    const { range, rangeType } = getSkillAimSpec(player, skillId);
    // SKILL_DAMAGE_SCALE: 全スキルの威力をまとめて調整するつまみ
    const damageMultiplier = (skill.damageMult || 1) * levelBonus * COMBAT_CONFIG.SKILL_DAMAGE_SCALE;
    const enemies = getSkillEnemyPool(scene);

    // Auto-face the nearest enemy for fan / line skills
    if (rangeType === 'fan' || rangeType === 'line') {
        const autoDir = findNearestEnemyDirection(player, enemies, range);
        if (autoDir) player.facingDirection = autoDir;
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
        // 専用処理のある heal / *_buff 以外の味方スキル（上位職の回復・バフ）は effect の内容で汎用的に処理する
        const isGenericHeal = skillId !== 'heal' && skill.effect?.healPower && !skill.effect?.buffType;
        const genericBuff = skill.effect?.buffType && !['attack_buff', 'defense_buff', 'speed_buff', 'summon_boost'].includes(skillId)
            ? skill.effect : null;

        if (skillId === 'heal' || isGenericHeal) {
            const skillLevel = player.stats.skillLevels?.[skillId] || 1;
            const int = player.stats.int || 5;
            const baseHeal = skill.effect?.healPower || 50;
            const healAmount = Math.ceil(baseHeal * (1 + (int * 0.1)) * (1 + (skillLevel - 1) * 0.2) * (player.stats.healPowerMult ?? 1));

            target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
            const healText = scene.add.text(target.x, target.y - 40, `+${healAmount}`, {
                fontSize: '16px', color: '#00ff00', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
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
        } else if (genericBuff) {
            // effect.buffType = 'attack_buff' | 'defense_buff'。現在のATK/DEFの buffMult 倍を buffDuration(ms) のあいだ加算する
            const baseValue = genericBuff.buffType === 'defense_buff' ? target.stats.def : target.stats.atk;
            giveBuff(scene, target, targetId, genericBuff.buffType, Math.ceil(baseValue * (genericBuff.buffMult || 0.5)), genericBuff.buffDuration || 15000);
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

    const targets = selectSkillTargets(player, skill, { enemies, range, rangeType, direction });

    targets.forEach(enemy => {
        const damageData = player.getDamage(damageMultiplier, enemy, skill.element || null);
        let damage = damageData.amount;
        const statusEffects = mergeStatusEffects(damageData, getSkillStatusEffects(skill, player));

        // アンデッド特効（エクソシズムなど effect.vsUndead を持つスキル）
        if (skill.effect?.vsUndead && UNDEAD_ENEMY_TYPES.includes(enemy.type)) {
            damage = Math.ceil(damage * skill.effect.vsUndead);
        }

        enemy.takeDamage(damage, player, Object.keys(statusEffects).length ? statusEffects : null, buildHitInfo(damageData));

        applyHitEffects(scene, enemy, player, {
            ...damageData,
            isFreeze: !!statusEffects.freezeMs,
            isParalyze: !!statusEffects.paralyzeMs,
            isPoison: !!statusEffects.poisonMs,
            poisonTick: statusEffects.poisonTick || damageData.poisonTick,
        });

        // Lifesteal
        if (player.stats.lifesteal > 0) {
            const heal = Math.ceil(damage * player.stats.lifesteal);
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
            const healText = scene.add.text(player.x, player.y - 40, `+${heal}`, {
                fontSize: '12px', color: '#00ff00', fontFamily: UI_FONT
            }).setOrigin(0.5);
            scene.tweens.add({ targets: healText, y: player.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
        }

        showHitEffect(scene, enemy.x, enemy.y, skill.color || 0xffffff);
    });
}
