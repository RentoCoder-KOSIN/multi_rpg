import { UI_FONT } from '../fontConfig.js';
// Player combat: basic attack and active skills.
import Enemy from '../entities/Enemy.js';
import { SKILLS } from '../data/skills.js';
import { isAnyWindowOpen } from '../utils/uiState.js';
import { applySkillEffect, showHitEffect, showCriticalEffect } from './skillEffects.js';
import { startSkillZone } from './zones.js';
import { applyBuffVisual } from './buffVisuals.js';
import { spawnSummon, destroySummon, isSummonSkill } from './summons.js';
import { areEffectsEnabled, isCameraShakeEnabled } from '../utils/effectsSettings.js';
import { getElementColor } from '../data/elements.js';
import { JOBS } from '../data/jobs.js';
import { isAdminFlag } from '../ui/AdminUI.js';
import { COMBAT_CONFIG, SPEED_CONFIG } from '../gameConstants.js';
import { executeFriendWarp } from '../ui/FriendWarpDialogUI.js';

// 職業が未設定（none）などのときに使う通常攻撃の既定値。職業ごとの値は data/jobs.js の attackRange / attackHit
const DEFAULT_BASIC_ATTACK_RANGE = 80;

// 通常攻撃の距離と命中方式を、現在の職業と装備から取得する
function getBasicAttackSpec(player) {
    const job = JOBS[player.stats?.job];
    const rangeBonus = player.stats?.attackRangeBonus || 0;
    const hitMode = (player.stats?.forceAreaAttack) ? 'area' : (job?.attackHit ?? 'area');
    const cdMult = (job?.attackCooldownMult ?? 1) * (player.stats?.attackCooldownMult ?? 1);
    return {
        range: Math.max(20, (job?.attackRange ?? DEFAULT_BASIC_ATTACK_RANGE) + rangeBonus),
        hit: hitMode,
        // 通常攻撃の間隔（職業と装備の attackCooldownMult で速さが変わる、下限50ms）
        cooldown: Math.max(50, Math.floor(BASIC_ATTACK_COOLDOWN_MS * cdMult))
    };
}

// HP吸収(lifesteal)、MP吸収(manaSteal)の共通処理（※ノックバックは廃止）
// extraLifesteal: スキル固有の吸収率（void_reaver の effect.lifestealOnHit など）を装備の吸収率に上乗せする
function applyCombatVampAndKnockback(scene, player, enemy, damage, extraLifesteal = 0) {
    if (!damage || damage <= 0) return;

    // HP吸収
    const lifestealRate = (player.stats?.lifesteal || 0) + extraLifesteal;
    if (lifestealRate > 0) {
        const heal = Math.ceil(damage * lifestealRate);
        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
        const healText = scene.add.text(player.x, player.y - 40, `+${heal}`, {
            fontSize: '12px', color: '#00ff00', fontFamily: UI_FONT
        }).setOrigin(0.5);
        scene.tweens.add({ targets: healText, y: player.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
    }

    // MP吸収
    if (player.stats?.manaSteal > 0) {
        const mpHeal = Math.ceil(damage * player.stats.manaSteal);
        player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + mpHeal);
        const mpText = scene.add.text(player.x, player.y - 55, `+${mpHeal} MP`, {
            fontSize: '12px', color: '#00ccff', fontFamily: UI_FONT
        }).setOrigin(0.5);
        scene.tweens.add({ targets: mpText, y: player.y - 95, alpha: 0, duration: 800, onComplete: () => mpText.destroy() });
    }
}

// スキルのバフ量を決める。定義側の書き方が複数あるため、ここで一本化する。
//   buffValueMult / buffMult : 対象のステータス（攻撃/防御/速度）に掛ける倍率（buffMult は後から増えた別名）
//   buffValue               : そのまま使う固定値
// 以前は buffMult を誰も読んでおらず、防具補強・ルーンバリア・フォートレスオーラ・ベネディクション等の
// バフが「説明の数値」ではなくほぼ+3程度の固定値になっていた（自分用の経路では undefined → NaN）。
function resolveBuffValue(effect, buffType, stats = {}) {
    const mult = effect.buffValueMult ?? effect.buffMult;
    if (mult !== undefined) {
        const base = buffType === 'defense_buff' ? (stats.def || 10)
            : buffType === 'speed_buff' ? SPEED_CONFIG.BASE_SPEED
            : (stats.atk || 10);
        return Math.ceil(base * mult);
    }
    if (effect.buffValue !== undefined) return effect.buffValue;
    return Math.ceil((stats[String(buffType).replace('_buff', '')] || 10) * 0.3);
}

// 移動系スキル（ダッシュ/ブリンク/バックステップ）の移動先を、壁にめり込まないよう手前で止める。
// 現在地から (targetX, targetY) へ直線で進み、衝突タイルに当たる直前の位置を返す。
// 衝突レイヤーが無いマップ（街など）では目標地点をそのまま返す。
function findSafeTarget(scene, player, targetX, targetY) {
    const layers = scene.collidableLayers || [];
    const total = Math.hypot(targetX - player.x, targetY - player.y);
    if (layers.length === 0 || total === 0) return { x: targetX, y: targetY };
    const ux = (targetX - player.x) / total, uy = (targetY - player.y) / total;

    const isBlocked = (x, y) => layers.some(layer => {
        try {
            const tile = layer.getTileAtWorldXY(x, y, true);
            return !!(tile && tile.collides);
        } catch (e) { return false; }
    });

    const step = 12;
    let safe = { x: player.x, y: player.y };
    for (let travelled = step; ; travelled += step) {
        const d = Math.min(travelled, total);
        const x = player.x + ux * d, y = player.y + uy * d;
        if (isBlocked(x, y)) break;
        safe = { x, y };
        if (d >= total) break;
    }
    return safe;
}

// 向いている方向（単位ベクトル）。縦・斜めも表せる。facingVec が無ければ左右(facingDirection)から作る
export function getFacingVec(player) {
    const v = player.facingVec;
    const len = v ? Math.hypot(v.x, v.y) : 0;
    if (len > 0) return { x: v.x / len, y: v.y / len };
    return { x: player.facingDirection || 1, y: 0 };
}

// 移動系スキルの移動先。dashDist=向いている方向へ / blinkDist=向いている方向へワープ / backstepDist=向きと逆へ。
// 該当しないスキルは null。ワールド境界・壁を考慮する（実際の発動と範囲プレビューで同じ結果にするためここに置く）。
export function getMovementDestination(scene, player, skill, vec) {
    let dist = 0, sign = 1, kind = null;
    if (skill.dashDist) { dist = skill.dashDist; kind = 'dash'; }
    else if (skill.blinkDist) { dist = skill.blinkDist; kind = 'blink'; }
    else if (skill.backstepDist) { dist = skill.backstepDist; sign = -1; kind = 'backstep'; }
    else return null;

    const bounds = scene.physics?.world?.bounds;
    const maxX = (bounds?.right ?? 3000) - 50;
    const maxY = (bounds?.bottom ?? 3000) - 50;
    const tx = Phaser.Math.Clamp(player.x + vec.x * sign * dist, 50, maxX);
    const ty = Phaser.Math.Clamp(player.y + vec.y * sign * dist, 50, maxY);
    return { ...findSafeTarget(scene, player, tx, ty), kind };
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

// 炎上（火属性）: 敵が激しく燃え上がり、火傷スリップダメージを与える
function applyBurnDot(scene, enemy, player, tickDamage) {
    if (!tickDamage || tickDamage <= 0 || !enemy || !enemy.active) return;
    const burnText = scene.add.text(enemy.x, enemy.y - 45, '🔥炎上', {
        fontSize: '13px', color: '#ff4400', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: burnText, y: enemy.y - 75, alpha: 0, duration: 900, onComplete: () => burnText.destroy() });

    // 炎の赤橙色フラッシュ
    scene.tweens.add({
        targets: enemy,
        tint: 0xff3300,
        yoyo: true,
        repeat: 3,
        duration: 200,
        onComplete: () => { if (enemy?.active) enemy.clearTint(); }
    });

    let ticksLeft = 4; // 4回スリップダメージ
    const timer = scene.time.addEvent({
        delay: 800,
        repeat: 3,
        callback: () => {
            ticksLeft--;
            if (!enemy || !enemy.active) {
                timer.remove();
                return;
            }
            enemy.takeDamage(tickDamage, player, null, { color: '#ff4400' });
            if (ticksLeft <= 0) timer.remove();
        }
    });
}

// アーマーブレイク（土属性: 防御崩し）: 5秒間敵の防御力を完全粉砕し、ダメージを爆増させる
function applyArmorBreak(scene, enemy) {
    if (!enemy || !enemy.active) return;
    enemy._armorBreakUntil = Date.now() + 5000;

    const breakText = scene.add.text(enemy.x, enemy.y - 45, '🛡️防崩！', {
        fontSize: '14px', color: '#cc9944', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: breakText, y: enemy.y - 85, scale: 1.2, alpha: 0, duration: 1000, onComplete: () => breakText.destroy() });

    // 土・岩のような色点滅
    scene.tweens.add({
        targets: enemy,
        tint: 0xaa7733,
        yoyo: true,
        repeat: 2,
        duration: 150,
        onComplete: () => { if (enemy?.active && !enemy.frozenUntil) enemy.clearTint(); }
    });
}

// 出血（物理・刃物系）: 敵から鮮血が吹き出し、継続ダメージ
function applyBleedDot(scene, enemy, player) {
    if (!enemy || !enemy.active) return;
    const txt = scene.add.text(enemy.x, enemy.y - 45, '🩸出血', {
        fontSize: '13px', color: '#ff0033', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 75, alpha: 0, duration: 900, onComplete: () => txt.destroy() });

    const tickDmg = Math.max(5, Math.ceil((player?.stats?.atk || 20) * 0.1));
    let ticksLeft = 4;
    const timer = scene.time.addEvent({
        delay: 700,
        repeat: 3,
        callback: () => {
            ticksLeft--;
            if (!enemy || !enemy.active) { timer.remove(); return; }
            enemy.takeDamage(tickDmg, player, null, { color: '#ff0033' });
            if (ticksLeft <= 0) timer.remove();
        }
    });
}

// 呪い: 被ダメージを1.3倍にし、紫のオーラを纏わせる
function applyCurse(scene, enemy) {
    if (!enemy || !enemy.active) return;
    enemy._armorBreakUntil = Math.max(enemy._armorBreakUntil || 0, Date.now() + 6000);
    const txt = scene.add.text(enemy.x, enemy.y - 50, '💀呪縛！', {
        fontSize: '14px', color: '#cc44ff', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 85, scale: 1.2, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
    scene.tweens.add({
        targets: enemy,
        tint: 0x8800cc,
        yoyo: true,
        repeat: 3,
        duration: 200,
        onComplete: () => { if (enemy?.active && !enemy.frozenUntil) enemy.clearTint(); }
    });
}

// スタン: 強烈な衝撃で一時行動停止
function applyStun(scene, enemy) {
    if (!enemy || !enemy.active) return;
    const txt = scene.add.text(enemy.x, enemy.y - 50, '💥スタン！', {
        fontSize: '14px', color: '#ffaa00', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 85, scale: 1.3, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
}

// 石化: 敵を完全硬直させて灰色にする
function applyPetrify(scene, enemy) {
    if (!enemy || !enemy.active) return;
    const txt = scene.add.text(enemy.x, enemy.y - 50, '🪨石化！', {
        fontSize: '14px', color: '#aaaaaa', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 85, scale: 1.2, alpha: 0, duration: 1200, onComplete: () => txt.destroy() });
    if (enemy.setTint) enemy.setTint(0x666666);
    scene.time.delayedCall(4000, () => {
        if (enemy?.active && !enemy.frozenUntil) enemy.clearTint();
    });
}

// 混乱: 敵の向きを狂わせる
function applyConfuse(scene, enemy) {
    if (!enemy || !enemy.active) return;
    const txt = scene.add.text(enemy.x, enemy.y - 45, '💫混乱', {
        fontSize: '13px', color: '#ff88ff', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 75, alpha: 0, duration: 900, onComplete: () => txt.destroy() });
    if (typeof enemy.changeDirection === 'function') enemy.changeDirection();
}

// 失明: 敵の視界を奪う
function applyBlind(scene, enemy) {
    if (!enemy || !enemy.active) return;
    const txt = scene.add.text(enemy.x, enemy.y - 45, '👁️失明', {
        fontSize: '13px', color: '#666666', fontFamily: UI_FONT, stroke: '#fff', strokeThickness: 1
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 75, alpha: 0, duration: 900, onComplete: () => txt.destroy() });
}

// 沈黙: スキル使用不可
function applySilence(scene, enemy) {
    if (!enemy || !enemy.active) return;
    const txt = scene.add.text(enemy.x, enemy.y - 45, '🔇沈黙', {
        fontSize: '13px', color: '#8888cc', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5);
    scene.tweens.add({ targets: txt, y: enemy.y - 75, alpha: 0, duration: 900, onComplete: () => txt.destroy() });
}

// 与ダメージ判定(getDamage結果)に応じて、クリティカル/即死/属性相性/状態異常の
// 演出とサーバーへの状態異常付与をまとめて行う。基本攻撃・スキル両方から呼ばれる。
function applyHitEffects(scene, enemy, player, damageData) {
    if (damageData.isCrit) showCriticalEffect(scene, enemy);
    if (damageData.isExecute) showExecuteEffect(scene, enemy, player);
    if (damageData.isFreeze) showFreezeEffect(scene, enemy);
    else if (damageData.isParalyze) showParalyzeEffect(scene, enemy);
    if (damageData.isPoison) applyPoisonDot(scene, enemy, player, damageData.poisonTick);
    if (damageData.isBurn) applyBurnDot(scene, enemy, player, damageData.burnTick);
    if (damageData.isArmorBreak) applyArmorBreak(scene, enemy);

    // 特殊状態異常（スタン、石化、呪い、出血、沈黙、失明、混乱等）
    if (Array.isArray(damageData.extraStatusHits)) {
        damageData.extraStatusHits.forEach(statusKey => {
            if (statusKey === 'stun') applyStun(scene, enemy);
            else if (statusKey === 'petrify') applyPetrify(scene, enemy);
            else if (statusKey === 'curse') applyCurse(scene, enemy);
            else if (statusKey === 'bleed') applyBleedDot(scene, enemy, player);
            else if (statusKey === 'confuse') applyConfuse(scene, enemy);
            else if (statusKey === 'blind') applyBlind(scene, enemy);
            else if (statusKey === 'silence') applySilence(scene, enemy);
        });
    }
}

// スキル固有の状態異常。装備由来の状態異常とは独立して抽選し、両方が発生した場合も
// 最も長い行動不能時間・最も高い毒ダメージを使う。
function getSkillStatusEffects(skill, player) {
    const effect = skill.effect || {};
    // 鍛冶打撃のような簡易記法（paralyzeChance / paralyzeMs）も statusEffect 記法に読み替える
    if (!effect.statusEffect && effect.paralyzeChance) {
        if (Math.random() >= Phaser.Math.Clamp(Number(effect.paralyzeChance), 0, 1)) return {};
        return { paralyzeMs: Math.max(0, Number(effect.paralyzeMs) || PARALYZE_DURATION_MS) };
    }
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
    const isPetrify = damageData.extraStatusHits?.includes('petrify');
    const isStun = damageData.extraStatusHits?.includes('stun');

    if (damageData.isFreeze || skillEffects.freezeMs || isPetrify) {
        effects.freezeMs = Math.max(skillEffects.freezeMs || 0, isPetrify ? 4000 : (damageData.isFreeze ? FREEZE_DURATION_MS : 0));
    }
    if (!effects.freezeMs && (damageData.isParalyze || skillEffects.paralyzeMs || isStun)) {
        effects.paralyzeMs = Math.max(skillEffects.paralyzeMs || 0, isStun ? 2500 : (damageData.isParalyze ? PARALYZE_DURATION_MS : 0));
    }
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
    const serverEnemies = Object.values(scene.networkManager?.getEnemies() || {});
    const allEnemies = [...serverEnemies];
    if (scene.children?.list) {
        scene.children.list.forEach(child => {
            if (child instanceof Enemy && child.active && !allEnemies.includes(child)) {
                allEnemies.push(child);
            }
        });
    }

    allEnemies.forEach(enemy => {
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

    // 死亡中は攻撃不可（移動も不可なのでここで止める）
    if (player.stats && player.stats.hp <= 0) return;

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

    // 同じマップのパーティメンバーへ通常攻撃エフェクトを共有
    if (scene.networkManager) {
        scene.networkManager.sendSkillUse('basic_attack', player.x, player.y, player.facingDirection || 1);
    }

    enemies.forEach(enemy => {
        if (!enemy || !enemy.active) return;

        const hits = Math.max(1, player.stats?.multiHit || 1);
        for (let hitIndex = 0; hitIndex < hits; hitIndex++) {
            const executeHit = () => {
                if (!enemy || !enemy.active) return;

                const damageData = player.getDamage(COMBAT_CONFIG.BASIC_ATTACK_MULT, enemy);
                const damage = damageData.amount;

                const effects = {};
                const isPetrify = damageData.extraStatusHits?.includes('petrify');
                const isStun = damageData.extraStatusHits?.includes('stun');

                if (damageData.isFreeze || isPetrify) {
                    effects.freezeMs = isPetrify ? 4000 : FREEZE_DURATION_MS;
                } else if (damageData.isParalyze || isStun) {
                    effects.paralyzeMs = isStun ? 2500 : PARALYZE_DURATION_MS;
                }
                enemy.takeDamage(damage, player, Object.keys(effects).length ? effects : null, buildHitInfo(damageData));
                enemy.lastHitTime = scene.time.now;

                applyHitEffects(scene, enemy, player, damageData);
                applyCombatVampAndKnockback(scene, player, enemy, damage);

                if (isCameraShakeEnabled(scene)) scene.cameras.main.shake(100, 0.005);
            };

            if (hitIndex === 0) {
                executeHit();
            } else {
                scene.time.delayedCall(hitIndex * 60, executeHit);
            }
        }
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
    return !isSummonSkill(skillId) && skillId !== 'command_attack' && skillId !== 'friend_warp';
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

// fan / line スキルの自動向き補正（ベクトル版）: 射程の1.5倍以内で一番近い敵へ向かう単位ベクトル。いなければnull。
// 敵の真正面を狙えるよう、縦方向の差も含める（判定の中心は腰あたり=player.y-20）
export function findNearestEnemyVec(player, enemies, range) {
    let nearest = null;
    let minDist = range * 1.5;
    enemies.forEach(e => {
        const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });
    if (!nearest) return null;
    const dx = nearest.x - player.x;
    const dy = nearest.y - (player.y - 20);
    const len = Math.hypot(dx, dy);
    return len > 1 ? { x: dx / len, y: dy / len } : null;
}

/**
 * スキル発動時の向き（単位ベクトル）を決める。fan / line は一番近い敵の方へ自動で向き、
 * それ以外（circle など）はプレイヤーの向き（最後に歩いた方向。縦・斜めを含む）を使う。
 * 実際の発動・範囲プレビュー・演出で同じ向きになるよう、決め方はここだけに置く。
 */
export function resolveSkillAimVec(player, enemies, range, rangeType) {
    if (rangeType === 'fan' || rangeType === 'line') {
        const toEnemy = findNearestEnemyVec(player, enemies, range);
        if (toEnemy) return toEnemy;
    }
    return getFacingVec(player);
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
// direction は 1 / -1（左右）か、{x, y} の単位ベクトル（縦・斜めを含む）のどちらでもよい。
export function selectSkillTargets(player, skill, { enemies, range, rangeType, direction }) {
    const v = (typeof direction === 'number') ? { x: direction >= 0 ? 1 : -1, y: 0 } : direction;
    const candidates = [];
    enemies.forEach(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - (player.y - 20); // measure from around the waist
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 向きベクトルに対する「前方への距離 f」と「横方向のずれ p」。
        // 左右向き(v=(±1,0))なら f=±dx, p=|dy| で、従来の判定と同じ結果になる。
        const f = dx * v.x + dy * v.y;
        const p = Math.abs(dx * v.y - dy * v.x);
        const inFront = f > 0;

        let isHit = false;
        if (rangeType === 'circle') {
            isHit = dist < range;
        } else if (rangeType === 'line') {
            // 向いている方向に伸びる帯（幅は左右に約40pxずつ）
            isHit = inFront && f < range && p < 40;
        } else if (rangeType === 'fan') {
            // 向いている方向の扇（約90度）
            isHit = inFront && dist < range && p < f + 20;
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

    // 死亡中はスキルも使用不可
    if (!player || !player.active || (player.stats && player.stats.hp <= 0)) return;

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

    // 向き（縦・斜めを含む単位ベクトル）を、演出・移動・命中判定より先に確定させる。
    // fan / line は一番近い敵の方へ自動で向き、それ以外はプレイヤーの向き（最後に歩いた方向）を使う。
    const aimEnemies = getSkillEnemyPool(scene);
    const aimVec = resolveSkillAimVec(player, aimEnemies, skill.range || 80, skill.rangeType || 'circle');
    player.facingVec = aimVec;
    if (Math.abs(aimVec.x) > 0.01) player.facingDirection = aimVec.x > 0 ? 1 : -1;

    applySkillEffect(scene, skillId, player);

    // 同じマップのパーティメンバーへスキル使用エフェクトを共有（向きも一緒に送る）
    if (scene.networkManager) {
        scene.networkManager.sendSkillUse(skillId, player.x, player.y, player.facingDirection || 1, aimVec.x, aimVec.y);
    }

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

    if (skillId === 'friend_warp') {
        const nm = scene.networkManager;
        const party = nm?.partyData;
        const myId = nm?.getPlayerId();
        const members = (party?.members || []).filter(m => m.id !== myId);

        if (!party || members.length === 0) {
            if (scene.notificationUI) scene.notificationUI.show('テレポート可能なパーティーメンバーがいません！', 'error');
            player.stats.mp += mpCost;
            delete player.skillCooldowns[skillId];
            player.saveStats();
            return;
        }

        if (members.length === 1) {
            executeFriendWarp(scene, members[0]);
        } else {
            if (scene.friendWarpDialogUI) {
                scene.friendWarpDialogUI.openWithMembers(members);
            } else {
                executeFriendWarp(scene, members[0]);
            }
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

    // Facing: 向きは上で確定済み（aimVec / player.facingVec）。direction は左右成分のみ（従来の ±1）
    const direction = player.facingDirection || 1;
    const vec = aimVec;

    // 移動系スキル（ダッシュ突進 / ブリンク / バックステップ）。向いている方向へ、縦・斜めにも動く。
    // 突進・ワープ系は「移動前の位置」から範囲判定する（進路上の敵にも当たるように）。
    const moveFrom = { x: player.x, y: player.y };
    const dest = getMovementDestination(scene, player, skill, vec);
    if (dest && dest.kind === 'dash') {
        for (let i = 1; i <= 3; i++) {
            const ghost = scene.add.sprite(
                player.x + (dest.x - player.x) * (i / 4),
                player.y + (dest.y - player.y) * (i / 4),
                player.texture?.key || 'player', player.frame?.name);
            ghost.setAlpha(0.45).setTint(0xffaa00);
            ghost.setFlipX(direction < 0);
            scene.tweens.add({
                targets: ghost,
                alpha: 0,
                duration: 250,
                onComplete: () => ghost.destroy()
            });
        }
        player.setPosition(dest.x, dest.y);
    } else if (dest && dest.kind === 'blink') {
        if (scene.add?.circle) {
            const warpOut = scene.add.circle(player.x, player.y, 25, 0x00ffff, 0.7);
            scene.tweens.add({ targets: warpOut, scale: 0.1, alpha: 0, duration: 200, onComplete: () => warpOut.destroy() });
            const warpIn = scene.add.circle(dest.x, dest.y, 10, 0x00ffff, 0.8);
            scene.tweens.add({ targets: warpIn, scale: 2.2, alpha: 0, duration: 300, onComplete: () => warpIn.destroy() });
        }
        player.setPosition(dest.x, dest.y);
    } else if (dest && dest.kind === 'backstep') {
        player.setPosition(dest.x, dest.y);
        // 後方宙返りの小さな跳ね（着地点を基準に上へ跳ねて戻る）
        scene.tweens.add({
            targets: player,
            y: dest.y - 25,
            yoyo: true,
            duration: 150,
            ease: 'Quad.easeOut'
        });
    }

    // 空蝉の術（身代わり回避スタック）
    if (skill.effect?.utsusemiStacks) {
        player.activeBuffs['utsusemi'] = { count: skill.effect.utsusemiStacks };
        if (scene.notificationUI) {
            scene.notificationUI.show(`🍃 空蝉の術発動！（${skill.effect.utsusemiStacks}回身代わり回避）`, 'success');
        }
    }

    // スモークボム: 周囲の敵の命中率を下げる（敵の攻撃判定はサーバー側なのでサーバーへ通知）
    if (skill.effect?.smoke && scene.networkManager && skill.effect.smokeEnemyMissChance) {
        scene.networkManager.sendAreaEffect({
            type: 'smoke',
            range: skill.range || 200,
            duration: skill.effect.buffDuration || 8000,
            missChance: skill.effect.smokeEnemyMissChance
        });
    }

    // スモークボム（煙幕演出）
    if (skill.effect?.smoke) {
        for (let i = 0; i < 7; i++) {
            const smoke = scene.add.circle(
                player.x + Phaser.Math.Between(-35, 35),
                player.y + Phaser.Math.Between(-25, 25),
                Phaser.Math.Between(20, 32),
                0x64748b,
                0.6
            );
            scene.tweens.add({
                targets: smoke,
                scale: 1.8,
                alpha: 0,
                duration: 1000 + Phaser.Math.Between(0, 300),
                onComplete: () => smoke.destroy()
            });
        }
    }

    // 挑発・集敵・タンク自己バフ等のスキル効果
    if (skill.effect?.taunt) {
        player.tauntEndTime = Date.now() + (skill.effect.tauntDuration || 8000);
        if (scene.notificationUI) {
            scene.notificationUI.show('📢 周囲の敵を挑発し、ターゲットを引きつけた！', 'warning', 3000);
        }
    }

    // 敵のAI・ターゲット選定・位置はサーバーが持っているため、挑発（ヘイト集中）と引き寄せは
    // サーバーへ通知して初めて効く。以前はクライアントのローカル変数(tauntEndTime)を立てて
    // 見た目だけ動かしており、サーバー管理の敵には何の効果も無かった。
    if (scene.networkManager && (skill.effect?.taunt || skill.effect?.pullEnemies)) {
        scene.networkManager.sendAreaEffect({
            type: 'provoke',
            range: skill.range || 350,
            duration: skill.effect.taunt ? (skill.effect.tauntDuration || 8000) : 0,
            pull: !!skill.effect.pullEnemies
        });
    }

    if (skill.effect?.pullEnemies) {
        const pullTargets = enemies.filter(enemy => {
            if (!enemy || !enemy.active) return false;
            return Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y) <= (skill.range || 350);
        });
        pullTargets.forEach(enemy => {
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
            const pullDist = 120;
            const targetX = enemy.x + Math.cos(angle) * pullDist;
            const targetY = enemy.y + Math.sin(angle) * pullDist;
            // サーバー管理の敵は位置の持ち主がサーバー。ここでtweenしても次の同期で戻される
            // （実際の引き寄せはサーバーが行い enemyMoved で届く）ので、ローカルの敵だけ動かす
            if (scene.tweens && !enemy.isServerManaged) {
                scene.tweens.add({
                    targets: enemy,
                    x: targetX,
                    y: targetY,
                    duration: 250,
                    ease: 'Power2'
                });
            }
            if (skill.effect?.taunt) {
                const mark = scene.add.text(enemy.x, enemy.y - 35, '💢 PROVOKED!', {
                    fontSize: '11px',
                    color: '#ff4444',
                    fontFamily: UI_FONT,
                    stroke: '#000',
                    strokeThickness: 2
                }).setOrigin(0.5);
                scene.tweens.add({ targets: mark, y: enemy.y - 65, alpha: 0, duration: 800, onComplete: () => mark.destroy() });
            }
        });
    }

    // 味方対象スキル(targetType:'party')は、術者も applyPartySkill の対象に含まれる。
    // ここで自分にも掛けると同じバフが2回スタックしてしまう（効果が倍になる）ので、party は除外する。
    const isPartySkill = skill.targetType === 'party';
    if (skill.effect?.buffType && !isPartySkill) {
        const dur = skill.effect.buffDuration || 10000;
        const val = resolveBuffValue(skill.effect, skill.effect.buffType, player.stats);
        player.applyBuff(skill.effect.buffType, val, dur);
        applyBuffVisual(scene, player, skill.effect.buffType, val, dur);
    }
    // スモークボム: 説明にある「移動速度+50」
    if (skill.effect?.moveSpeedBuff && !isPartySkill) {
        const dur = skill.effect.buffDuration || 8000;
        player.applyBuff('speed_buff', skill.effect.moveSpeedBuff, dur);
        applyBuffVisual(scene, player, 'speed_buff', skill.effect.moveSpeedBuff, dur);
    }
    if (skill.effect?.extraBuff && !isPartySkill) {
        const eb = skill.effect.extraBuff;
        const dur = eb.duration || 10000;
        const val = Math.ceil((player.stats?.def || 10) * (eb.mult || 1.0));
        player.applyBuff(eb.type, val, dur);
        applyBuffVisual(scene, player, eb.type, val, dur);
    }

    if (skill.targetType === 'party') {
        applyPartySkill(scene, skillId, skill, range);
    } else {
        applyDamageSkill(scene, skill, {
            enemies, range, rangeType, direction: vec, damageMultiplier,
            // 突進・ワープで動いた場合は、動く前の位置から判定する（進路上の敵にも当たる）
            origin: (dest && (dest.kind === 'dash' || dest.kind === 'blink')) ? moveFrom : null
        });
    }

    if (scene.notificationUI) {
        scene.notificationUI.show(`${skill.name}！`, 'warning');
    }
}

// 回復量: 術者（スキル使用者）のINT・スキルレベル・回復力補正に依存する
function calcHealAmount(caster, skillId, baseHeal) {
    const skillLevel = caster.stats.skillLevels?.[skillId] || 1;
    const int = caster.stats.int || 5;
    return Math.ceil(baseHeal * (1 + (int * 0.1)) * (1 + (skillLevel - 1) * 0.2) * (caster.stats.healPowerMult ?? 1));
}

// 対象（術者本人 or 味方）のHPを回復し、数値表示とHP同期を行う
function applyHealToTarget(scene, caster, target, targetId, healAmount) {
    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
    const healText = scene.add.text(target.x, target.y - 40, `+${healAmount}`, {
        fontSize: '16px', color: '#00ff00', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: healText, y: target.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
    showHitEffect(scene, target.x, target.y, 0x00ff00);

    if (target === caster) {
        scene.networkManager.sendPlayerStats(caster.stats.hp, caster.stats.maxHp);
    } else {
        scene.networkManager.healPlayer(targetId, healAmount);
    }
}

// 神聖領域（サンクチュアリ）: 発動地点に領域を張り、duration の間 1秒ごとに領域内の味方を回復する。
// 回復量は毎tick、術者のINT等から計算する（effect.healPerSec が基礎値）。
function startHealingZone(scene, caster, skillId, skill) {
    const { healPerSec, healDuration = 10000 } = skill.effect;
    const range = skill.range || 250;
    const cx = caster.x, cy = caster.y;
    const ticks = Math.max(1, Math.round(healDuration / 1000));

    // 円の描画と範囲内バフの判定は systems/zones.js（startSkillZone）が担当する。ここは回復だけ。

    const tick = () => {
        if (!caster.active || caster.stats.hp <= 0) return;
        const nm = scene.networkManager;
        const myId = nm.getPlayerId();
        const amount = calcHealAmount(caster, skillId, healPerSec);
        const targets = [];
        if (Math.hypot(caster.x - cx, caster.y - cy) < range) targets.push({ target: caster, id: myId });

        const memberIds = nm.partyData?.members?.map(m => m.id) || [];
        const others = nm.getOtherPlayers();
        memberIds.forEach(id => {
            if (id === myId) return;
            const other = others[id];
            if (other && other.active && Math.hypot(other.x - cx, other.y - cy) < range) targets.push({ target: other, id });
        });
        targets.forEach(({ target, id }) => applyHealToTarget(scene, caster, target, id, amount));
    };

    tick(); // 発動の瞬間に1回目
    if (ticks > 1) scene.time.addEvent({ delay: 1000, repeat: ticks - 2, callback: tick });
}

// Heal / buff the caster and party members within range
function applyPartySkill(scene, skillId, skill, range) {
    const player = scene.player;

    // 持続回復の領域スキル（サンクチュアリ）
    if (skill.effect?.healPerSec) startHealingZone(scene, player, skillId, skill);

    // 円形ゾーン型（結界など）: 発動地点に円を張り、円の中にいる間だけバフを受ける。
    // 即時バフは付けない（円に入っている味方が各自のクライアントで受け取る）。
    if (skill.effect?.zone) {
        startSkillZone(scene, skillId, player.x, player.y);
        return;
    }

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
        // 回復効果（回復量は常に術者のINT・スキルレベル・回復力補正で決まる）
        if (skillId === 'heal' || skill.effect?.healPower) {
            applyHealToTarget(scene, player, target, targetId, calcHealAmount(player, skillId, skill.effect?.healPower || 50));
        }

        // バフ付与
        if (skillId === 'attack_buff') {
            giveBuff(scene, target, targetId, 'attack_buff', Math.ceil(target.stats.atk * 0.5), 15000);
        } else if (skillId === 'defense_buff') {
            giveBuff(scene, target, targetId, 'defense_buff', Math.ceil(target.stats.def * 0.5), 15000);
        } else if (skillId === 'speed_buff') {
            giveBuff(scene, target, targetId, 'speed_buff', 50, 15000);
        } else if (skillId === 'summon_boost') {
            giveBuff(scene, target, targetId, 'summon_power_up', Math.ceil(player.stats.int * 2), 20000);
        } else if (skill.effect?.buffType) {
            const bt = skill.effect.buffType;
            const val = resolveBuffValue(skill.effect, bt, target.stats);
            giveBuff(scene, target, targetId, bt, val, skill.effect.buffDuration || 15000);
        }

        // 追加バフ付与（extraBuff: blessing 等で複数のバフを同時付与）
        if (skill.effect?.extraBuff) {
            const eb = skill.effect.extraBuff;
            const base = eb.type === 'defense_buff' ? (target.stats.def || 10) : (target.stats.atk || 10);
            const val = Math.ceil(base * (eb.mult || 0.3));
            giveBuff(scene, target, targetId, eb.type, val, eb.duration || 15000);
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
function applyDamageSkill(scene, skill, { enemies, range, rangeType, direction, damageMultiplier, origin = null }) {
    const player = scene.player;

    const targets = selectSkillTargets(origin || player, skill, { enemies, range, rangeType, direction });

    targets.forEach(enemy => {
        // 装備の multiHit（1ヒットごとに満額）に加え、スキル自体の連続ヒット数（ブレイドストーム等の skill.multiHits）。
        // skill.multiHits は「damageMult を N 回に分けて当てる」意味にする（同ティアのスキルと総威力を揃えるため）。
        const skillHits = Math.max(1, skill.multiHits || 1);
        const hits = Math.max(1, player.stats?.multiHit || 1) * skillHits;
        for (let hitIndex = 0; hitIndex < hits; hitIndex++) {
            const executeSkillHit = () => {
                if (!enemy || !enemy.active) return;

                const damageData = player.getDamage(damageMultiplier / skillHits, enemy, skill.element || null);
                let damage = damageData.amount;

                // タンク専用: 防御力(DEF)またはHPによる追加ダメージ加算
                if (skill.defScaling) {
                    const defBonus = Math.ceil((player.getDefense ? player.getDefense() : (player.stats?.def || 0)) * skill.defScaling);
                    damage += defBonus;
                }
                if (skill.hpScaling) {
                    const hpBonus = Math.ceil((player.stats?.maxHp || 100) * skill.hpScaling);
                    damage += hpBonus;
                }
                // アベンジャーの失ったHP比例（最大2倍）
                if (skill.id === 'vengeful_strike') {
                    const lostRatio = Math.max(0, 1 - (player.stats.hp / Math.max(1, player.stats.maxHp)));
                    damage = Math.ceil(damage * (1 + lostRatio));
                }

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

                // 爆炎フラスコ等: スキル固有の炎上（effect.burnChance / burnMs）
                if (skill.effect?.burnChance && Math.random() < skill.effect.burnChance) {
                    applyBurnDot(scene, enemy, player, Math.max(8, Math.ceil((player.stats?.atk || 20) * 0.12)));
                }

                // 虚無の刃: 与ダメージの一部を吸収（effect.lifestealOnHit）
                applyCombatVampAndKnockback(scene, player, enemy, damage, skill.effect?.lifestealOnHit || 0);
                showHitEffect(scene, enemy.x, enemy.y, skill.color || 0xffffff);
            };

            if (hitIndex === 0) {
                executeSkillHit();
            } else {
                scene.time.delayedCall(hitIndex * 60, executeSkillHit);
            }
        }
    });
}
