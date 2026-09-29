// 「押している間は範囲を表示、離したら発動」の照準(aim)システム。
// 通常攻撃(SPACE)・スキル(数字キー / 仮想パッドのボタン)で共通。
//
// - 押す      : beginBasicAim / beginSkillAim  → 範囲を表示し、当たる敵を赤く光らせる
// - 離す      : releaseAim(owner)              → 攻撃/スキルを発動
// - 中断      : cancelAim                      → 何も発動せず表示だけ消す（ウィンドウを開いた時など）
//
// 対象の決め方は combat.js の findBasicAttackTargets / selectSkillTargets をそのまま使うので、
// 「赤く光っている敵 = 実際に当たる敵」になる。
import { SKILLS } from '../data/skills.js';
import { isAnyWindowOpen } from '../utils/uiState.js';
import { areEffectsEnabled } from '../utils/effectsSettings.js';
import {
    performBasicAttack,
    usePlayerSkill,
    findBasicAttackTargets,
    skillNeedsAim,
    getSkillAimSpec,
    getSkillEnemyPool,
    findNearestEnemyDirection,
    selectSkillTargets,
    isSkillReady
} from './combat.js';

const AIM_DEPTH = 20;                 // HPバー(10/11)より手前
const READY_COLOR = 0xffffff;
const NOT_READY_COLOR = 0x888888;     // クールダウン中・MP不足のときの範囲の色
const PARTY_COLOR = 0x66ff99;         // 味方対象(回復/バフ)スキルの範囲の色
const TARGET_COLOR = 0xff2222;        // 当たる敵の色
const FAN_SEGMENTS = 20;

/** シーンのcreate()内(入力登録時)で1回呼ぶ */
export function createAim(scene) {
    scene.aimState = null;
    scene.aimGfx = scene.add.graphics().setDepth(AIM_DEPTH).setVisible(false);
    if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(scene.aimGfx);
}

function canAim(scene) {
    return !!(scene.player && scene.player.active && scene.aimGfx && !isAnyWindowOpen(scene));
}

/**
 * 通常攻撃の範囲表示を開始する（SPACE押下）。
 * @param {string} owner   どの入力が照準中か（離した時に同じownerか確認する）
 * @param {Phaser.Input.Keyboard.Key} [keyObj] キー入力の場合。フォーカス喪失などでキーが押されたままになるのを検知する
 */
export function beginBasicAim(scene, owner, keyObj = null) {
    if (!canAim(scene)) return;
    scene.aimState = { owner, kind: 'basic', keyObj };
    scene.aimGfx.setVisible(true);
}

/**
 * スキルの範囲表示を開始する（数字キー / パッドのボタン押下）。
 * 召喚・突撃命令など範囲を持たないスキルは、押した瞬間に発動する。
 */
export function beginSkillAim(scene, skillId, owner, keyObj = null) {
    if (!canAim(scene) || !SKILLS[skillId]) return;

    if (!skillNeedsAim(skillId)) {
        usePlayerSkill(scene, skillId);
        return;
    }
    scene.aimState = { owner, kind: 'skill', skillId, keyObj };
    scene.aimGfx.setVisible(true);
}

/** キー/ボタンを離した：同じownerの照準中なら発動する */
export function releaseAim(scene, owner) {
    const state = scene.aimState;
    if (!state || state.owner !== owner) return;
    clearAim(scene);

    if (state.kind === 'basic') {
        performBasicAttack(scene);
    } else {
        usePlayerSkill(scene, state.skillId);
    }
}

/** 発動せずに範囲表示だけ消す */
export function cancelAim(scene, owner = null) {
    if (!scene.aimState) return;
    if (owner && scene.aimState.owner !== owner) return;
    clearAim(scene);
}

function clearAim(scene) {
    scene.aimState = null;
    if (scene.aimGfx) {
        scene.aimGfx.clear();
        scene.aimGfx.setVisible(false);
    }
}

/** 毎フレーム呼ぶ。範囲と当たる敵の赤ハイライトを描き直す */
export function updateAim(scene) {
    const state = scene.aimState;
    if (!state) return;

    const player = scene.player;
    // ウィンドウが開いた / プレイヤーがいなくなった / キーが押されたままの扱いになった → 中断
    if (!player || !player.active || isAnyWindowOpen(scene) || (state.keyObj && !state.keyObj.isDown)) {
        clearAim(scene);
        return;
    }

    const gfx = scene.aimGfx;
    gfx.clear();

    if (state.kind === 'basic') {
        drawBasicAim(scene, gfx, player);
    } else {
        drawSkillAim(scene, gfx, player, state.skillId);
    }
}

// ---- 通常攻撃 -------------------------------------------------------------

function drawBasicAim(scene, gfx, player) {
    const { range, cooldown, targets } = findBasicAttackTargets(scene, player);
    const onCooldown = !!player.lastAttackTime && (scene.time.now - player.lastAttackTime) < cooldown;

    // 判定の中心は (player.x, player.y)（combat.jsのfindBasicAttackTargetsと同じ）
    const color = onCooldown ? NOT_READY_COLOR : READY_COLOR;
    fillShape(gfx, color, () => gfx.fillCircle(player.x, player.y, range), () => gfx.strokeCircle(player.x, player.y, range));
    highlightTargets(scene, gfx, targets);
}

// ---- スキル ---------------------------------------------------------------

function drawSkillAim(scene, gfx, player, skillId) {
    const spec = getSkillAimSpec(player, skillId);
    if (!spec) return;
    const { skill, range, rangeType, isParty } = spec;

    // 味方対象(回復/バフ)：判定は player.x, player.y からの距離。敵はハイライトしない
    if (isParty) {
        const color = isSkillReady(player, skillId) ? PARTY_COLOR : NOT_READY_COLOR;
        fillShape(gfx, color, () => gfx.fillCircle(player.x, player.y, range), () => gfx.strokeCircle(player.x, player.y, range));
        return;
    }

    const enemies = getSkillEnemyPool(scene);

    // 発動時と同じ向きの決め方（fan/lineは一番近い敵の方を向く）
    let direction = player.facingDirection || 1;
    if (rangeType === 'fan' || rangeType === 'line') {
        direction = findNearestEnemyDirection(player, enemies, range) || direction;
    }

    const ox = player.x;
    const oy = player.y - 20; // 判定の中心は腰あたり（selectSkillTargetsと同じ）
    const base = isSkillReady(player, skillId) ? (skill.color ?? READY_COLOR) : NOT_READY_COLOR;

    if (rangeType === 'line') {
        // 正面に伸びる帯：|dx| < range, |dy| < 40
        const x = direction > 0 ? ox : ox - range;
        fillShape(gfx, base, () => gfx.fillRect(x, oy - 40, range, 80), () => gfx.strokeRect(x, oy - 40, range, 80));
    } else if (rangeType === 'fan') {
        drawFan(gfx, base, ox, oy, range, direction);
    } else {
        fillShape(gfx, base, () => gfx.fillCircle(ox, oy, range), () => gfx.strokeCircle(ox, oy, range));
    }

    const targets = selectSkillTargets(player, skill, { enemies, range, rangeType, direction });
    highlightTargets(scene, gfx, targets);
}

// fanの判定は「正面 かつ dist < range かつ |dy| < |dx| + 20」。その境界をそのまま多角形にする
function drawFan(gfx, color, ox, oy, range, direction) {
    const r = Math.max(range, 15);
    // 境界線 |dy| = dx + 20 と半径rの円の交点
    const ix = (-40 + Math.sqrt(Math.max(0, 8 * r * r - 1600))) / 4;
    const iy = ix + 20;
    const a = Math.atan2(iy, ix);

    const points = [{ x: ox, y: oy - 20 }];
    for (let i = 0; i <= FAN_SEGMENTS; i++) {
        const t = -a + (2 * a * i) / FAN_SEGMENTS;
        points.push({ x: ox + direction * r * Math.cos(t), y: oy + r * Math.sin(t) });
    }
    points.push({ x: ox, y: oy + 20 });

    fillShape(gfx, color, () => gfx.fillPoints(points, true), () => gfx.strokePoints(points, true));
}

// ---- 描画の共通処理 -------------------------------------------------------

function fillShape(gfx, color, fill, stroke) {
    gfx.fillStyle(color, 0.13);
    fill();
    gfx.lineStyle(2, color, 0.75);
    stroke();
}

// 当たる敵を赤く重ね塗りする（Enemy側のtintは触らないので、凍結/麻痺の色と干渉しない）
function highlightTargets(scene, gfx, targets) {
    if (!targets || targets.length === 0) return;
    // 軽く点滅させる。演出OFF設定のときは点滅なしの固定表示
    const pulse = areEffectsEnabled(scene) ? 0.5 + 0.5 * Math.sin(scene.time.now / 90) : 1;
    targets.forEach(enemy => {
        if (!enemy || !enemy.active) return;
        const radius = Math.max(16, Math.max(enemy.displayWidth || 0, enemy.displayHeight || 0) / 2 + 4);
        gfx.fillStyle(TARGET_COLOR, 0.30 + 0.20 * pulse);
        gfx.fillCircle(enemy.x, enemy.y, radius);
        gfx.lineStyle(3, TARGET_COLOR, 0.9);
        gfx.strokeCircle(enemy.x, enemy.y, radius);
    });
}
