// 結界・聖域などの「円形の範囲スキル」。
// 発動地点に円を描画し、その円の中にいる間だけ効果を受けられる（出ると短時間で効果が切れる）。
//
// 判定は各クライアントが「自分自身」について行う（術者・パーティメンバーとも同じ処理）。
//   - 術者: usePlayerSkill から startSkillZone() を呼ぶ
//   - 仲間: playerSkillUsed を受け取ったとき（networkCallbacks.js）に startSkillZone() を呼ぶ
// これにより、サーバーを増やさずに「円の中にいる味方全員に効果」を実現している。
import { SKILLS } from '../data/skills.js';
import { SPEED_CONFIG } from '../gameConstants.js';
import { areEffectsEnabled, isLowSpecMode } from '../utils/effectsSettings.js';
import { applyBuffVisual } from './buffVisuals.js';
import { ensureVfxTextures } from './skillEffects.js';

// 円の中にいる間、この時間(ms)ごとにバフを延長する。外に出ると約この時間で切れる
const ZONE_CHECK_MS = 300;
const ZONE_BUFF_REFRESH_MS = 900;

/** スキルが円形ゾーン型か */
export function isZoneSkill(skillId) {
    return !!SKILLS[skillId]?.effect?.zone;
}

// ゾーンで付与するバフの値を、受ける本人のステータスから決める
function resolveZoneBuffs(skill, target) {
    const e = skill.effect;
    const list = [];
    const add = (type, mult, fixed, stats) => {
        if (!type) return;
        let value;
        if (mult !== undefined) {
            const base = type === 'defense_buff' ? (stats.def || 10)
                : type === 'speed_buff' ? SPEED_CONFIG.BASE_SPEED
                : (stats.atk || 10);
            value = Math.ceil(base * mult);
        } else {
            value = fixed ?? 1;
        }
        list.push({ type, value });
    };
    add(e.buffType, e.buffValueMult ?? e.buffMult, e.buffValue, target.stats || {});
    if (e.extraBuff) add(e.extraBuff.type, e.extraBuff.mult, undefined, target.stats || {});
    return list;
}

/**
 * ゾーンを発動地点 (x, y) に展開する。
 * @param {object} opts { visual: 円を描画するか（省略時は演出設定に従う） }
 */
export function startSkillZone(scene, skillId, x, y, opts = {}) {
    const skill = SKILLS[skillId];
    const zoneCfg = skill?.effect?.zone;
    if (!zoneCfg || !scene?.add) return;

    const radius = zoneCfg.radius || skill.range || 200;
    const duration = zoneCfg.duration || skill.effect.buffDuration || 10000;
    const color = skill.color || 0xffffff;
    const showVisual = (opts.visual ?? true) && areEffectsEnabled(scene);

    // ---- 描画: 円（塗り＋縁）＋ゆっくり回る魔法陣 ----
    const parts = [];
    if (showVisual) {
        const disc = scene.add.circle(x, y, radius, color, 0.13).setStrokeStyle(3, color, 0.75).setDepth(1);
        parts.push(disc);
        scene.tweens.add({ targets: disc, alpha: { from: 1, to: 0.55 }, yoyo: true, repeat: -1, duration: 800 });

        if (!isLowSpecMode(scene)) {
            ensureVfxTextures(scene);
            if (scene.textures.exists('vfx_magic_circle')) {
                const mc = scene.add.image(x, y, 'vfx_magic_circle').setTint(color)
                    .setScale((radius * 2) / 128).setAlpha(0.4).setDepth(1);
                mc.setBlendMode('ADD');
                parts.push(mc);
                scene.tweens.add({ targets: mc, angle: 360, duration: 9000, repeat: -1 });
            }
        }
        parts.forEach(p => { if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(p); });
        // 終了直前にフェードアウトして、切れることが分かるようにする
        scene.time.delayedCall(Math.max(0, duration - 600), () => {
            parts.forEach(p => { if (p.active) scene.tweens.add({ targets: p, alpha: 0, duration: 600 }); });
        });
    }

    // ---- 判定: 自分が円の中にいる間、バフを延長し続ける ----
    let wasInside = false;
    const endAt = Date.now() + duration;
    const timer = scene.time.addEvent({
        delay: ZONE_CHECK_MS,
        loop: true,
        callback: () => {
            const me = scene.player;
            if (Date.now() >= endAt || !me || !me.active || me.isDead || (me.stats && me.stats.hp <= 0)) {
                wasInside = false;
                return;
            }
            const inside = Math.hypot(me.x - x, me.y - y) <= radius;
            if (!inside) { wasInside = false; return; }

            resolveZoneBuffs(skill, me).forEach(({ type, value }) => {
                const fresh = me.refreshZoneBuff?.(type, value, ZONE_BUFF_REFRESH_MS);
                if (fresh) applyBuffVisual(scene, me, type, value, ZONE_BUFF_REFRESH_MS);
            });
            if (!wasInside) {
                wasInside = true;
                scene.notificationUI?.show(`${skill.name}の範囲内！`, 'info', 1500);
            }
        }
    });

    // 終了時に円と判定を片付ける
    scene.time.delayedCall(duration, () => {
        timer.remove(false);
        parts.forEach(p => { if (p.active) p.destroy(); });
    });
}
