import { UI_FONT } from '../fontConfig.js';
import { SKILLS } from '../data/skills.js';
import { areEffectsEnabled, isLowSpecMode } from '../utils/effectsSettings.js';

// 他プレイヤーが使ったスキルはパーティクル数を減らして負荷を下げる
const REMOTE_EFFECT_SCALE = 0.5;

/**
 * プロシージャル Canvas テクスチャの初期化（初回呼び出し時に自動生成）
 * 外部画像アセットに依存せず、常に鮮明で多彩なパーティクルと図形を提供する
 */
export function ensureVfxTextures(scene) {
    if (!scene || !scene.textures || scene.textures.exists('vfx_flare')) return;

    try {
        // 1. vfx_flare: 中心が純白で滑らかにフェードアウトする発光オーブ
        const flare = document.createElement('canvas');
        flare.width = 32; flare.height = 32;
        const fctx = flare.getContext('2d');
        const fgrad = fctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        fgrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        fgrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)');
        fgrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)');
        fgrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        fctx.fillStyle = fgrad;
        fctx.fillRect(0, 0, 32, 32);
        scene.textures.addCanvas('vfx_flare', flare);

        // 2. vfx_spark: 鋭く尖った四芒星（十字のスパーク火花・会心・電撃）
        const spark = document.createElement('canvas');
        spark.width = 32; spark.height = 32;
        const sctx = spark.getContext('2d');
        sctx.fillStyle = '#ffffff';
        sctx.beginPath();
        sctx.moveTo(16, 0);
        sctx.quadraticCurveTo(16, 16, 32, 16);
        sctx.quadraticCurveTo(16, 16, 16, 32);
        sctx.quadraticCurveTo(16, 16, 0, 16);
        sctx.quadraticCurveTo(16, 16, 16, 0);
        sctx.closePath();
        sctx.fill();
        scene.textures.addCanvas('vfx_spark', spark);

        // 3. vfx_crescent: 鋭い三日月形の弧（斬撃ブレード）
        const cres = document.createElement('canvas');
        cres.width = 64; cres.height = 64;
        const cctx = cres.getContext('2d');
        cctx.fillStyle = '#ffffff';
        cctx.beginPath();
        cctx.arc(32, 32, 28, -Math.PI * 0.45, Math.PI * 0.45, false);
        cctx.arc(22, 32, 24, Math.PI * 0.45, -Math.PI * 0.45, true);
        cctx.closePath();
        cctx.fill();
        scene.textures.addCanvas('vfx_crescent', cres);

        // 4. vfx_ring: 滑らかに光る衝撃波リング
        const ring = document.createElement('canvas');
        ring.width = 64; ring.height = 64;
        const rctx = ring.getContext('2d');
        rctx.strokeStyle = '#ffffff';
        rctx.lineWidth = 4;
        rctx.beginPath();
        rctx.arc(32, 32, 26, 0, Math.PI * 2);
        rctx.stroke();
        scene.textures.addCanvas('vfx_ring', ring);

        // 5. vfx_crystal: 鋭利な氷結晶（ダイアモンド）
        const crys = document.createElement('canvas');
        crys.width = 32; crys.height = 32;
        const crctx = crys.getContext('2d');
        crctx.fillStyle = '#ffffff';
        crctx.beginPath();
        crctx.moveTo(16, 2);
        crctx.lineTo(26, 16);
        crctx.lineTo(16, 30);
        crctx.lineTo(6, 16);
        crctx.closePath();
        crctx.fill();
        scene.textures.addCanvas('vfx_crystal', crys);

        // 6. vfx_smoke: ソフトな半透明煙
        const smk = document.createElement('canvas');
        smk.width = 48; smk.height = 48;
        const smctx = smk.getContext('2d');
        const smgrad = smctx.createRadialGradient(24, 24, 0, 24, 24, 24);
        smgrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        smgrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
        smgrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        smctx.fillStyle = smgrad;
        smctx.fillRect(0, 0, 48, 48);
        scene.textures.addCanvas('vfx_smoke', smk);

        // 7. vfx_magic_circle: 二重円と六芒星の幾何学魔法陣
        const mc = document.createElement('canvas');
        mc.width = 128; mc.height = 128;
        const mctx = mc.getContext('2d');
        mctx.strokeStyle = '#ffffff';
        mctx.lineWidth = 2;
        mctx.beginPath();
        mctx.arc(64, 64, 60, 0, Math.PI * 2);
        mctx.arc(64, 64, 52, 0, Math.PI * 2);
        mctx.stroke();
        const r = 48;
        mctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const a = (i * 2 * Math.PI / 3) - Math.PI / 2;
            const x = 64 + r * Math.cos(a);
            const y = 64 + r * Math.sin(a);
            if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
        }
        mctx.closePath();
        mctx.stroke();
        mctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const a = (i * 2 * Math.PI / 3) + Math.PI / 2;
            const x = 64 + r * Math.cos(a);
            const y = 64 + r * Math.sin(a);
            if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
        }
        mctx.closePath();
        mctx.stroke();
        scene.textures.addCanvas('vfx_magic_circle', mc);
    } catch (e) {
        // Fallback silently if canvas is not supported in test environment
    }
}

/**
 * 敵へのヒット演出（火花スプラッシュ＋微小フラッシュ）
 */
export function showHitEffect(scene, x, y, color = 0xffffff) {
    if (!areEffectsEnabled(scene)) return;
    ensureVfxTextures(scene);

    const hitTex = scene.textures.exists('vfx_spark') ? 'vfx_spark' : 'water';
    const hitEmitter = scene.add.particles(x, y, hitTex, {
        speed: { min: 60, max: 180 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 220,
        blendMode: 'ADD',
        tint: color,
        quantity: 4
    });
    scene.time.delayedCall(220, () => hitEmitter.destroy());

    // 中心の白光フラッシュ
    const flash = scene.add.circle(x, y, 12, 0xffffff, 0.9);
    scene.tweens.add({
        targets: flash,
        scale: 1.8,
        alpha: 0,
        duration: 120,
        onComplete: () => flash.destroy()
    });
}

/**
 * クリティカルヒット演出（特大火花＋黄金リング＋弾む文字）
 */
export function showCriticalEffect(scene, enemy) {
    if (!areEffectsEnabled(scene)) return;
    ensureVfxTextures(scene);

    const x = enemy.x;
    const y = enemy.y - 20;

    // 黄金の衝撃リング
    if (scene.textures.exists('vfx_ring')) {
        const ring = scene.add.image(x, y, 'vfx_ring').setTint(0xffd700).setAlpha(0.9).setScale(0.3);
        ring.setBlendMode('ADD');
        scene.tweens.add({
            targets: ring,
            scale: 1.4,
            alpha: 0,
            duration: 250,
            onComplete: () => ring.destroy()
        });
    }

    // 激しい火花バースト
    const hitTex = scene.textures.exists('vfx_spark') ? 'vfx_spark' : 'water';
    const critEmitter = scene.add.particles(x, y, hitTex, {
        speed: { min: 100, max: 280 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 350,
        blendMode: 'ADD',
        tint: 0xffd700,
        quantity: 8
    });
    scene.time.delayedCall(350, () => critEmitter.destroy());

    // 弾む「CRITICAL!」
    const critText = scene.add.text(x, y - 25, 'CRITICAL!', {
        fontSize: '18px',
        color: '#ffea00',
        fontFamily: UI_FONT,
        stroke: '#000000',
        strokeThickness: 5
    }).setOrigin(0.5).setScale(1.5);

    scene.tweens.add({
        targets: critText,
        scale: 1.0,
        duration: 120,
        ease: 'Back.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: critText,
                y: y - 75,
                alpha: 0,
                duration: 650,
                onComplete: () => critText.destroy()
            });
        }
    });
}

/**
 * スキル発動時のメイン演出
 */
export function applySkillEffect(scene, skillId, sourceUser, isRemote = false) {
    if (!areEffectsEnabled(scene)) return;
    ensureVfxTextures(scene);

    // 通常攻撃の簡易スラッシュエフェクト
    if (skillId === 'basic_attack') {
        const direction = sourceUser.facingDirection || 1;
        const cresTex = scene.textures.exists('vfx_crescent') ? 'vfx_crescent' : null;
        if (cresTex) {
            const slash = scene.add.image(sourceUser.x + direction * 28, sourceUser.y, 'vfx_crescent');
            slash.setTint(0xffffff).setAlpha(0.9).setScale(direction * 0.9, 0.9).setAngle(direction * -20);
            slash.setBlendMode('ADD');
            scene.tweens.add({
                targets: slash,
                scaleX: direction * 1.4,
                scaleY: 1.4,
                alpha: 0,
                duration: 150,
                onComplete: () => slash.destroy()
            });
        } else {
            const slash = scene.add.rectangle(sourceUser.x + direction * 22, sourceUser.y, 36, 6, 0xffffff, 0.7);
            scene.tweens.add({ targets: slash, scaleY: 3, alpha: 0, angle: direction * 45, duration: 140, onComplete: () => slash.destroy() });
        }
        return;
    }

    const skill = SKILLS[skillId];
    if (!skill) return;

    const lowSpec = isLowSpecMode(scene);
    const actualRange = skill.range || 80;
    const effectScale = actualRange / 80;

    // スキル名ポップアップ（属性に応じた文字色）
    const fontSize = isRemote ? '10px' : '13px';
    const textYOffset = isRemote ? -50 : -60;
    const skillColor = skill.color || 0xffffff;
    const hexColor = '#' + skillColor.toString(16).padStart(6, '0');

    const text = scene.add.text(sourceUser.x, sourceUser.y + textYOffset, skill.name, {
        fontSize: fontSize,
        color: hexColor,
        fontFamily: UI_FONT,
        stroke: '#000000',
        strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: sourceUser.y - 100, alpha: 0, duration: 900, onComplete: () => text.destroy() });

    const startX = sourceUser.x;
    const startY = sourceUser.y;
    const remoteScale = isRemote ? REMOTE_EFFECT_SCALE : 1;
    const lowSpecScale = lowSpec ? 0.35 : 1.0;
    const direction = sourceUser.facingDirection || 1;
    // 向いている方向（単位ベクトル。縦・斜めを含む）。無ければ左右(direction)から作る
    const fv = sourceUser.facingVec;
    const fl = fv ? Math.hypot(fv.x, fv.y) : 0;
    const vec = fl > 0 ? { x: fv.x / fl, y: fv.y / fl } : { x: direction, y: 0 };
    // 縦向きが優位なときだけ、斬撃・光線を回転させる（横向きは従来の見た目のまま）
    const vertical = Math.abs(vec.y) > Math.abs(vec.x);
    const rot = Math.atan2(vec.y, vec.x);

    const ctx = {
        scene, skill, skillId, isRemote, actualRange, effectScale, startX, startY, remoteScale,
        direction, vec, vertical, rot, lowSpec, lowSpecScale, skillColor
    };

    // 汎用パーティクル生成ヘルパー
    ctx.createBurst = (color, count = 10, speed = 100, tex = 'vfx_flare') => {
        const lifespan = lowSpec ? 250 : 450;
        const qty = Math.max(1, Math.ceil(count * effectScale * remoteScale * lowSpecScale));
        const usedTex = scene.textures.exists(tex) ? tex : 'water';
        const emitter = scene.add.particles(startX, startY, usedTex, {
            speed: { min: -speed * effectScale, max: speed * effectScale },
            scale: { start: 0.6 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan,
            blendMode: 'ADD',
            tint: color,
            quantity: qty
        });
        scene.time.delayedCall(lifespan, () => emitter.destroy());
    };

    // 演出タイプ（明示指定がなければスキルの性質から自動推定）
    let vfxType = skill.vfx;
    if (!vfxType) {
        if (skill.targetType === 'party' || skill.effect?.buffType || skill.effect?.healPower) {
            vfxType = 'support';
        } else if (skill.element || (skill.rangeType === 'circle' && skill.range > 120)) {
            vfxType = 'blast';
        } else if (skill.rangeType === 'fan' || (skill.rangeType === 'line' && skill.range > 200)) {
            vfxType = 'projectile';
        } else {
            vfxType = 'slash';
        }
    }
    const play = VFX_PLAYERS[vfxType];
    if (play) {
        play(ctx);
    } else {
        ctx.createBurst(skillColor, 15, 120);
    }
}

// ==========================================
// ⚔️ 1. 近接・剣撃・突進系エフェクト (slash)
// ==========================================
function playSlashEffect(ctx) {
    const { scene, skill, skillId, direction, vec, vertical, rot, startX, startY, actualRange, effectScale, lowSpec, skillColor } = ctx;
    const slashColor = skill.vfxOptions?.slashColor ?? skillColor;

    // A. 連撃技 / 乱舞技（blade_storm, rampage_slash 等）
    if (skillId === 'blade_storm' || skillId === 'rampage_slash') {
        const strikes = [
            { angle: -30, delay: 0, dy: -10 },
            { angle: 35, delay: 90, dy: 10 },
            { angle: -60, delay: 180, dy: 0 },
            { angle: 45, delay: 270, dy: -5 },
        ];
        strikes.forEach(({ angle, delay, dy }) => {
            scene.time.delayedCall(delay, () => {
                if (scene.textures.exists('vfx_crescent')) {
                    const slash = scene.add.image(startX + vec.x * (50 * effectScale), startY + vec.y * (50 * effectScale) + dy, 'vfx_crescent');
                    slash.setTint(slashColor).setScale(direction * 1.4 * effectScale, 1.4 * effectScale).setAngle(vertical ? Phaser.Math.RadToDeg(rot) + angle : direction * angle);
                    slash.setBlendMode('ADD');
                    scene.tweens.add({
                        targets: slash,
                        scaleX: direction * 2.2 * effectScale,
                        scaleY: 2.0 * effectScale,
                        alpha: 0,
                        duration: 180,
                        onComplete: () => slash.destroy()
                    });
                }
                ctx.createBurst(slashColor, 6, 140, 'vfx_spark');
            });
        });
        return;
    }

    // B. 超高速居合・突進一閃（iai_slash, judgment_cut, raiton_slash, dash_slash, dragon_thrust）
    if (skill.dashDist || skillId === 'iai_slash' || skillId === 'judgment_cut' || skillId === 'raiton_slash') {
        const hitX = startX + (vec.x * actualRange / 2);
        const hitY = startY + (vec.y * actualRange / 2);

        // 鋭い光の閃光ビームライン（縦・斜め向きなら進行方向へ回転）
        const flashLine = scene.add.rectangle(hitX, hitY, actualRange * 1.1, 4 * effectScale, 0xffffff).setOrigin(0.5);
        flashLine.setRotation(rot);
        flashLine.setBlendMode('ADD');
        scene.tweens.add({
            targets: flashLine,
            scaleY: 12 * effectScale,
            alpha: 0,
            duration: 220,
            onComplete: () => flashLine.destroy()
        });

        // 軌道上の三日月衝撃波
        if (scene.textures.exists('vfx_crescent')) {
            const crescent = scene.add.image(hitX, hitY, 'vfx_crescent');
            crescent.setTint(slashColor).setScale(direction * 1.8 * effectScale, 1.8 * effectScale).setAngle(vertical ? Phaser.Math.RadToDeg(rot) : direction * -15);
            crescent.setBlendMode('ADD');
            scene.tweens.add({
                targets: crescent,
                scaleX: direction * 2.6 * effectScale,
                scaleY: 2.6 * effectScale,
                alpha: 0,
                duration: 250,
                onComplete: () => crescent.destroy()
            });
        }

        // 雷属性（raiton_slash）なら放電スパーク、その他は火花
        const sparkTex = (skill.element === 'thunder') ? 'vfx_spark' : 'vfx_flare';
        ctx.createBurst(slashColor, 16, 200, sparkTex);

        // 画面揺れ（居合・絶影の重み）
        if (!ctx.isRemote) scene.cameras.main.shake(120, 0.006 * effectScale);
        return;
    }

    // C. 円範囲回転斬撃（whirlwind, spike_guard, guardian_slash 等）
    if (skill.rangeType === 'circle') {
        if (scene.textures.exists('vfx_ring')) {
            const ring = scene.add.image(startX, startY, 'vfx_ring').setTint(slashColor).setScale(0.3);
            ring.setBlendMode('ADD');
            scene.tweens.add({
                targets: ring,
                scale: (actualRange / 26),
                alpha: 0,
                duration: 320,
                onComplete: () => ring.destroy()
            });
        }

        if (scene.textures.exists('vfx_crescent')) {
            // 双刃の回転ブレード
            for (let i = 0; i < 2; i++) {
                const angle = i * 180;
                const blade = scene.add.image(startX, startY, 'vfx_crescent');
                blade.setTint(slashColor).setScale(1.6 * effectScale).setAngle(angle);
                blade.setBlendMode('ADD');
                scene.tweens.add({
                    targets: blade,
                    angle: angle + 360,
                    scale: 2.4 * effectScale,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => blade.destroy()
                });
            }
        }

        ctx.createBurst(slashColor, 15, 160, 'vfx_spark');
        return;
    }

    // D. 通常の単発・直線スラッシュ
    const hitX = startX + (vec.x * actualRange / 2);
    const hitY = startY + (vec.y * actualRange / 2);
    if (scene.textures.exists('vfx_crescent')) {
        const crescent = scene.add.image(hitX, hitY, 'vfx_crescent');
        crescent.setTint(slashColor).setScale(direction * 1.5 * effectScale, 1.5 * effectScale).setAngle(vertical ? Phaser.Math.RadToDeg(rot) : direction * -25);
        crescent.setBlendMode('ADD');
        scene.tweens.add({
            targets: crescent,
            scaleX: direction * 2.2 * effectScale,
            scaleY: 2.2 * effectScale,
            alpha: 0,
            duration: 200,
            onComplete: () => crescent.destroy()
        });
    } else {
        const slashLine = scene.add.rectangle(hitX, hitY, actualRange, 10 * effectScale, slashColor).setOrigin(0.5);
        slashLine.setRotation(rot);
        scene.tweens.add({ targets: slashLine, alpha: 0, scaleY: 8, duration: 200, onComplete: () => slashLine.destroy() });
    }
    ctx.createBurst(slashColor, 8, 120, 'vfx_spark');
}

// ==========================================
// 💥 2. 魔法範囲・爆発系エフェクト (blast)
// ==========================================
function playMagicBlastEffect(ctx) {
    const { scene, skill, skillId, isRemote, remoteScale, direction, startX, startY, actualRange, effectScale, skillColor } = ctx;
    const color = skill.color || 0xff4500;
    const targetX = (skill.rangeType === 'circle') ? startX : startX + (direction * 140 * effectScale);
    const element = skill.element;

    // --- A. 雷属性（落雷・チェインライトニング・サンダーストーム） ---
    if (element === 'thunder' || skillId.includes('thunder') || skillId === 'chain_lightning') {
        const boltGraphics = scene.add.graphics();
        boltGraphics.setBlendMode('ADD');

        // 上空から目標地点へジグザグの落雷を描画
        const topY = targetY(scene, startY) - 300;
        const steps = 6;
        let curX = targetX + Phaser.Math.Between(-30, 30);
        let curY = topY;

        boltGraphics.lineStyle(4 * effectScale, 0xffffff, 1.0);
        boltGraphics.beginPath();
        boltGraphics.moveTo(curX, curY);

        for (let i = 1; i <= steps; i++) {
            const nextY = topY + (startY - topY) * (i / steps);
            const nextX = (i === steps) ? targetX : targetX + Phaser.Math.Between(-40, 40);
            boltGraphics.lineTo(nextX, nextY);
            curX = nextX; curY = nextY;
        }
        boltGraphics.strokePath();

        // 外周の青白いグローライン
        boltGraphics.lineStyle(10 * effectScale, 0x00ffff, 0.6);
        boltGraphics.strokePath();

        scene.tweens.add({
            targets: boltGraphics,
            alpha: 0,
            duration: 250,
            onComplete: () => boltGraphics.destroy()
        });

        // 落雷着弾の地面フラッシュ＋火花
        if (scene.textures.exists('vfx_ring')) {
            const ring = scene.add.image(targetX, startY, 'vfx_ring').setTint(0x00ffff).setScale(0.2);
            ring.setBlendMode('ADD');
            scene.tweens.add({ targets: ring, scale: actualRange / 24, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
        }

        const emitter = scene.add.particles(targetX, startY, scene.textures.exists('vfx_spark') ? 'vfx_spark' : 'water', {
            speed: { min: 80 * effectScale, max: 260 * effectScale },
            scale: { start: 0.8 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 400,
            blendMode: 'ADD',
            tint: 0x00ffff,
            quantity: Math.max(1, Math.ceil(18 * effectScale * remoteScale))
        });
        scene.time.delayedCall(400, () => emitter.destroy());

        if (!isRemote) {
            scene.cameras.main.flash(70, 200, 240, 255);
            scene.cameras.main.shake(180, 0.008 * effectScale);
        }
        return;
    }

    // --- B. 闇属性・深淵（ブラックホール収縮 → 破滅爆散） ---
    if (element === 'dark' || skillId === 'abyss_storm' || skillId === 'dark_nova') {
        // 1. ブラックホール吸引オーブ
        const hole = scene.add.circle(targetX, startY, 40 * effectScale, 0x110022, 0.9);
        const holeAura = scene.add.circle(targetX, startY, 48 * effectScale, 0x7700aa, 0.6);
        holeAura.setBlendMode('ADD');

        scene.tweens.add({
            targets: [hole, holeAura],
            scale: 0.1,
            duration: 220,
            ease: 'Quad.easeIn',
            onComplete: () => {
                hole.destroy();
                holeAura.destroy();

                // 2. 収縮直後のド派手な暗黒爆散！
                if (scene.textures.exists('vfx_ring')) {
                    const darkRing = scene.add.image(targetX, startY, 'vfx_ring').setTint(0xaa00ff).setScale(0.2);
                    darkRing.setBlendMode('ADD');
                    scene.tweens.add({ targets: darkRing, scale: actualRange / 20, alpha: 0, duration: 450, onComplete: () => darkRing.destroy() });
                }

                const darkEmitter = scene.add.particles(targetX, startY, scene.textures.exists('vfx_flare') ? 'vfx_flare' : 'water', {
                    speed: { min: 60 * effectScale, max: 240 * effectScale },
                    scale: { start: 0.9 * effectScale, end: 0 },
                    alpha: { start: 1, end: 0 },
                    lifespan: 550,
                    blendMode: 'ADD',
                    tint: 0x8800ff,
                    quantity: Math.max(1, Math.ceil(20 * effectScale * remoteScale))
                });
                scene.time.delayedCall(550, () => darkEmitter.destroy());

                if (!isRemote) scene.cameras.main.shake(250, 0.01 * effectScale);
            }
        });
        return;
    }

    // --- C. 氷属性（氷柱隆起 → ダイヤモンドダスト粉砕） ---
    if (element === 'water' || skillId.includes('ice')) {
        const iceGfx = scene.add.graphics();
        iceGfx.fillStyle(0xdff9fb, 0.9);
        iceGfx.lineStyle(2, 0x38bdf8, 1);

        // 放射状の氷柱トゲを描画
        const spikeCount = 5;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i * (Math.PI * 2 / spikeCount)) + Phaser.Math.FloatBetween(-0.2, 0.2);
            const dist = 30 * effectScale;
            const sx = targetX + Math.cos(angle) * dist;
            const sy = startY + Math.sin(angle) * dist;

            iceGfx.beginPath();
            iceGfx.moveTo(targetX, startY);
            iceGfx.lineTo(sx - 10, sy);
            iceGfx.lineTo(sx, sy - 40 * effectScale);
            iceGfx.lineTo(sx + 10, sy);
            iceGfx.closePath();
            iceGfx.fillPath();
            iceGfx.strokePath();
        }

        scene.tweens.add({
            targets: iceGfx,
            alpha: 0,
            scaleY: 1.3,
            duration: 350,
            onComplete: () => iceGfx.destroy()
        });

        // ダイヤモンドダスト飛散
        const crysTex = scene.textures.exists('vfx_crystal') ? 'vfx_crystal' : 'water';
        const iceEmitter = scene.add.particles(targetX, startY, crysTex, {
            speed: { min: 40 * effectScale, max: 180 * effectScale },
            scale: { start: 0.7 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            blendMode: 'ADD',
            tint: 0x38bdf8,
            quantity: Math.max(1, Math.ceil(16 * effectScale * remoteScale))
        });
        scene.time.delayedCall(500, () => iceEmitter.destroy());
        return;
    }

    // --- D. 炎属性（火柱噴射・爆炎ドーム） ---
    if (element === 'fire' || skillId.includes('fire') || skillId === 'dragon_breath') {
        if (scene.textures.exists('vfx_magic_circle')) {
            const mc = scene.add.image(targetX, startY, 'vfx_magic_circle').setTint(0xff3300).setScale(actualRange / 130).setAlpha(0.8);
            mc.setBlendMode('ADD');
            scene.tweens.add({ targets: mc, angle: 90, alpha: 0, duration: 400, onComplete: () => mc.destroy() });
        }

        // 吹き上がる火炎ドーム
        const blastDome = scene.add.circle(targetX, startY, 15 * effectScale, 0xff5500, 0.85);
        blastDome.setBlendMode('ADD');
        scene.tweens.add({
            targets: blastDome,
            scale: actualRange / 12,
            alpha: 0,
            duration: 450,
            onComplete: () => blastDome.destroy()
        });

        // 上昇気流で舞い上がる火の粉パーティクル
        const fireEmitter = scene.add.particles(targetX, startY, scene.textures.exists('vfx_flare') ? 'vfx_flare' : 'water', {
            speedX: { min: -100 * effectScale, max: 100 * effectScale },
            speedY: { min: -240 * effectScale, max: -40 * effectScale },
            scale: { start: 0.9 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            blendMode: 'ADD',
            tint: [0xffffff, 0xffbb00, 0xff3300],
            quantity: Math.max(1, Math.ceil(22 * effectScale * remoteScale))
        });
        scene.time.delayedCall(600, () => fireEmitter.destroy());

        if (!isRemote) scene.cameras.main.shake(200, 0.007 * effectScale);
        return;
    }

    // --- E. 光属性（天より降り注ぐ聖なる光柱） ---
    if (element === 'light' || skillId === 'judgment_light') {
        const pillar = scene.add.rectangle(targetX, startY - 150, 45 * effectScale, 300, 0xfef08a, 0.85);
        pillar.setBlendMode('ADD');
        scene.tweens.add({
            targets: pillar,
            scaleX: 1.8,
            alpha: 0,
            duration: 500,
            onComplete: () => pillar.destroy()
        });

        if (scene.textures.exists('vfx_magic_circle')) {
            const mc = scene.add.image(targetX, startY, 'vfx_magic_circle').setTint(0xfacc15).setScale(actualRange / 120).setAlpha(0.9);
            mc.setBlendMode('ADD');
            scene.tweens.add({ targets: mc, angle: 120, alpha: 0, duration: 600, onComplete: () => mc.destroy() });
        }

        const lightEmitter = scene.add.particles(targetX, startY, scene.textures.exists('vfx_spark') ? 'vfx_spark' : 'water', {
            speedX: { min: -60 * effectScale, max: 60 * effectScale },
            speedY: { min: -180 * effectScale, max: -30 * effectScale },
            scale: { start: 0.7 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 600,
            blendMode: 'ADD',
            tint: 0xfef08a,
            quantity: Math.max(1, Math.ceil(15 * effectScale * remoteScale))
        });
        scene.time.delayedCall(600, () => lightEmitter.destroy());
        return;
    }

    // --- F. 汎用・物理衝撃波爆発 ---
    if (scene.textures.exists('vfx_ring')) {
        const ring = scene.add.image(targetX, startY, 'vfx_ring').setTint(color).setScale(0.2);
        ring.setBlendMode('ADD');
        scene.tweens.add({ targets: ring, scale: actualRange / 22, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
    }

    const emitter = scene.add.particles(targetX, startY, scene.textures.exists('vfx_flare') ? 'vfx_flare' : 'water', {
        speed: { min: 50 * effectScale, max: 200 * effectScale },
        scale: { start: 0.7 * effectScale, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 500,
        blendMode: 'ADD',
        tint: color,
        quantity: Math.max(1, Math.ceil(15 * effectScale * remoteScale))
    });
    scene.time.delayedCall(500, () => emitter.destroy());
}

// 画面上部座標ヘルパー
function targetY(scene, y) {
    return scene.cameras?.main?.scrollY || (y - 200);
}

// ==========================================
// 🏹 3. 遠距離射撃・弾幕・手裏剣 (projectile)
// ==========================================
function playProjectileEffect(ctx) {
    const { scene, skill, skillId, direction, vec, rot, startX, startY, actualRange, effectScale, remoteScale, skillColor } = ctx;
    const color = skillColor;
    const targetX = startX + (vec.x * actualRange);
    const aimTargetY = startY + (vec.y * actualRange);

    // A. ガンスリンガー銃弾（マズルフラッシュ＋超高速ビーム弾道＋火花着弾）
    if (skillId === 'quick_draw' || skillId === 'bullet_storm' || skillId === 'acrobatic_fire' || skillId === 'bullet_hell') {
        // マズルフラッシュ
        if (scene.textures.exists('vfx_spark')) {
            const muzz = scene.add.image(startX + vec.x * 16, startY + vec.y * 16, 'vfx_spark').setTint(0xffea00).setScale(0.8);
            muzz.setBlendMode('ADD');
            scene.tweens.add({ targets: muzz, scale: 1.4, alpha: 0, duration: 90, onComplete: () => muzz.destroy() });
        }

        // 高速ビーム光弾
        const bullet = scene.add.rectangle(startX + vec.x * 20, startY + vec.y * 20, 35 * effectScale, 4 * effectScale, 0xfff0aa);
        bullet.setRotation(rot);
        bullet.setBlendMode('ADD');
        scene.tweens.add({
            targets: bullet,
            x: targetX,
            y: aimTargetY,
            duration: 160,
            onComplete: () => {
                bullet.destroy();
                // 着弾火花
                showHitEffect(scene, targetX, aimTargetY, 0xffbb00);
            }
        });
        return;
    }

    // B. ニンジャ手裏剣乱舞（shuriken_storm）
    if (skillId === 'shuriken_storm') {
        const count = 5;
        for (let i = 0; i < count; i++) {
            const spreadAngle = (i - 2) * 12;
            const rad = rot + Phaser.Math.DegToRad(spreadAngle);
            const dist = actualRange * Phaser.Math.FloatBetween(0.85, 1.05);
            const destX = startX + Math.cos(rad) * dist;
            const destY = startY + Math.sin(rad) * dist;

            const shuriken = scene.add.image(startX, startY, scene.textures.exists('vfx_spark') ? 'vfx_spark' : 'water');
            shuriken.setTint(0xcccccc).setScale(0.7 * effectScale);
            scene.tweens.add({
                targets: shuriken,
                x: destX,
                y: destY,
                angle: 720,
                duration: 280,
                onComplete: () => shuriken.destroy()
            });
        }
        return;
    }

    // C. 弓矢・ボルト（arrow_rain, piercing_shot 等）
    const arrow = scene.add.rectangle(startX, startY, 32 * effectScale, 3 * effectScale, color).setOrigin(0.5);
    arrow.setRotation(rot);
    arrow.setBlendMode('ADD');

    // トレイルパーティクル
    const trail = scene.add.particles(startX, startY, scene.textures.exists('vfx_flare') ? 'vfx_flare' : 'water', {
        follow: arrow,
        speed: 10,
        scale: { start: 0.3 * effectScale, end: 0 },
        alpha: { start: 0.7, end: 0 },
        lifespan: 150,
        blendMode: 'ADD',
        tint: color
    });

    scene.tweens.add({
        targets: arrow,
        x: targetX,
        y: aimTargetY,
        duration: 350,
        onComplete: () => {
            arrow.destroy();
            trail.destroy();
            showHitEffect(scene, targetX, aimTargetY, color);
        }
    });
}

// ==========================================
// 🕊️ 4. 回復・聖域・バフ・結界系 (support)
// ==========================================
function playSupportEffect(ctx) {
    const { scene, skill, skillId, startX, startY, actualRange, effectScale, remoteScale, skillColor } = ctx;
    const color = skillColor;

    // A. 聖域結界（sanctuary, holy_sanctuary）: 地面に定着する神聖魔方陣＋光のドーム
    if (skillId === 'sanctuary' || skillId === 'holy_sanctuary') {
        if (scene.textures.exists('vfx_magic_circle')) {
            const mc = scene.add.image(startX, startY, 'vfx_magic_circle').setTint(0xa7f3d0).setScale(actualRange / 110).setAlpha(0.85);
            mc.setBlendMode('ADD');
            scene.tweens.add({
                targets: mc,
                angle: 360,
                alpha: 0,
                duration: 2500,
                onComplete: () => mc.destroy()
            });
        }

        // 光のドーム境界リング
        if (scene.textures.exists('vfx_ring')) {
            const ring = scene.add.image(startX, startY, 'vfx_ring').setTint(0x6ee7b7).setScale(actualRange / 28).setAlpha(0.7);
            ring.setBlendMode('ADD');
            scene.tweens.add({
                targets: ring,
                alpha: 0,
                duration: 2000,
                onComplete: () => ring.destroy()
            });
        }

        // 昇華する癒しの光粒
        const healParticles = scene.add.particles(startX, startY, scene.textures.exists('vfx_flare') ? 'vfx_flare' : 'water', {
            x: { min: -actualRange * 0.7, max: actualRange * 0.7 },
            speedY: { min: -100 * effectScale, max: -40 * effectScale },
            scale: { start: 0.5 * effectScale, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 900,
            blendMode: 'ADD',
            tint: [0xa7f3d0, 0x6ee7b7, 0xffffff],
            quantity: Math.max(1, Math.ceil(8 * effectScale * remoteScale))
        });
        scene.time.delayedCall(2000, () => healParticles.destroy());
        return;
    }

    // B. ブレスオーラ（blessing）: 黄金の神聖魔方陣＋きらめく星のシャワー
    if (skillId === 'blessing') {
        if (scene.textures.exists('vfx_magic_circle')) {
            const mc = scene.add.image(startX, startY, 'vfx_magic_circle').setTint(0xfacc15).setScale(actualRange / 120).setAlpha(0.9);
            mc.setBlendMode('ADD');
            scene.tweens.add({ targets: mc, angle: 180, alpha: 0, duration: 1500, onComplete: () => mc.destroy() });
        }

        const blessEmitter = scene.add.particles(startX, startY, scene.textures.exists('vfx_spark') ? 'vfx_spark' : 'water', {
            x: { min: -actualRange * 0.6, max: actualRange * 0.6 },
            speedY: { min: -80 * effectScale, max: 20 * effectScale },
            scale: { start: 0.7 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            blendMode: 'ADD',
            tint: 0xfacc15,
            quantity: Math.max(1, Math.ceil(12 * effectScale * remoteScale))
        });
        scene.time.delayedCall(1200, () => blessEmitter.destroy());
        return;
    }

    // C. マナシールド（mana_shield）: シアンブルーの六角バリアオーラ
    if (skillId === 'mana_shield') {
        const shieldRing = scene.add.circle(startX, startY, 32, 0x38bdf8, 0.4);
        shieldRing.setStrokeStyle(3, 0x00ffff, 0.9);
        shieldRing.setBlendMode('ADD');
        scene.tweens.add({
            targets: shieldRing,
            scale: 1.4,
            alpha: 0,
            duration: 600,
            onComplete: () => shieldRing.destroy()
        });
        ctx.createBurst(0x38bdf8, 10, 80, 'vfx_flare');
        return;
    }

    // D. 通常回復・バフ（heal 等）
    if (scene.textures.exists('vfx_ring')) {
        const ring = scene.add.image(startX, startY, 'vfx_ring').setTint(color).setScale(0.3);
        ring.setBlendMode('ADD');
        scene.tweens.add({ targets: ring, scale: actualRange / 24, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    }

    const emitter = scene.add.particles(startX, startY + 15, scene.textures.exists('vfx_flare') ? 'vfx_flare' : 'water', {
        speedY: { min: -140 * effectScale, max: -40 * effectScale },
        speedX: { min: -25 * effectScale, max: 25 * effectScale },
        scale: { start: 0.6 * effectScale, end: 0 },
        alpha: { start: 0.85, end: 0 },
        lifespan: 750,
        blendMode: 'ADD',
        tint: color,
        quantity: Math.max(1, Math.ceil(10 * effectScale * remoteScale))
    });
    scene.time.delayedCall(750, () => emitter.destroy());
}

// 演出タイプ名 → 再生関数対応表
const VFX_PLAYERS = {
    slash: playSlashEffect,
    blast: playMagicBlastEffect,
    projectile: playProjectileEffect,
    support: playSupportEffect,
};
