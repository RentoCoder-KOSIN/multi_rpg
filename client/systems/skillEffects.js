// Visual effects for skills and hits. Pure presentation: no damage or state changes here.
import { SKILLS } from '../data/skills.js';
import { areEffectsEnabled } from '../utils/effectsSettings.js';

// 他プレイヤーが使ったスキルはパーティクル数を減らして負荷を下げる
const REMOTE_EFFECT_SCALE = 0.5;

/**
 * Small star flash at a hit position.
 */
export function showHitEffect(scene, x, y, color) {
    if (!areEffectsEnabled(scene)) return;
    const flash = scene.add.star(x, y, 5, 5, 15, color, 1);
    scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        rotation: 1,
        duration: 200,
        onComplete: () => flash.destroy()
    });
}

/**
 * Yellow flash plus floating "CRITICAL!" text above an enemy.
 */
export function showCriticalEffect(scene, enemy) {
    if (!areEffectsEnabled(scene)) return;
    showHitEffect(scene, enemy.x, enemy.y - 20, 0xffff00);
    const critText = scene.add.text(enemy.x, enemy.y - 40, 'CRITICAL!', {
        fontSize: '16px', color: '#ffff00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);
    scene.tweens.add({ targets: critText, y: enemy.y - 80, alpha: 0, duration: 800, onComplete: () => critText.destroy() });
}

/**
 * Play the effect for a skill at the position of `sourceUser`.
 * @param {Phaser.Scene} scene
 * @param {string} skillId
 * @param {Phaser.GameObjects.Sprite} sourceUser - local player or a remote player
 * @param {boolean} isRemote - true when another player used the skill (smaller text, less shake)
 */
export function applySkillEffect(scene, skillId, sourceUser, isRemote = false) {
    const skill = SKILLS[skillId];
    if (!skill) return;
    if (!areEffectsEnabled(scene)) return; // パーティクル演出をまるごとスキップして負荷を下げる

    // Effect size scales with the (level-boosted) skill range; base range 80 = scale 1.0
    const skillLevel = sourceUser.stats?.skillLevels?.[skillId] || 1;
    const rangeBonus = 1 + (skillLevel - 1) * 0.1;
    const actualRange = (skill.range || 80) * rangeBonus;
    const effectScale = actualRange / 80;

    // Skill name popup
    const fontSize = isRemote ? '10px' : '12px';
    const textYOffset = isRemote ? -50 : -60;
    const text = scene.add.text(sourceUser.x, sourceUser.y + textYOffset, skill.name, {
        fontSize: fontSize,
        color: '#fffff0',
        fontFamily: '"Press Start 2P"',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: sourceUser.y - 100, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

    const startX = sourceUser.x;
    const startY = sourceUser.y;
    const remoteScale = isRemote ? REMOTE_EFFECT_SCALE : 1;
    const ctx = {
        scene, skill, skillId, isRemote, actualRange, effectScale, startX, startY, remoteScale,
        direction: sourceUser.facingDirection || 1
    };

    // Generic particle burst, scaled by range and (for other players) reduced further
    ctx.createBurst = (color, count = 10, speed = 100) => {
        const emitter = scene.add.particles(startX, startY, 'water', {
            speed: { min: -speed * effectScale, max: speed * effectScale },
            scale: { start: 0.4 * effectScale, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            blendMode: 'ADD',
            tint: color,
            quantity: Math.max(1, Math.ceil(count * effectScale * remoteScale))
        });
        scene.time.delayedCall(500, () => emitter.destroy());
    };

    if (['slash', 'heavy_slash', 'whirlwind', 'judgment_cut'].includes(skillId)) {
        playSlashEffect(ctx);
    } else if (['fireball', 'big_fireball', 'meteor_swarm', 'abyss_storm', 'dark_nova'].includes(skillId)) {
        playMagicBlastEffect(ctx);
    } else if (skill.targetType === 'party') {
        playSupportEffect(ctx);
    } else if (['sonic_wave', 'ice_needle', 'holy_arrow'].includes(skillId)) {
        playProjectileEffect(ctx);
    } else {
        ctx.createBurst(skill.color || 0xffffff, 15, 100);
    }
}

// Melee slash: expanding ring for circle skills, diagonal line for the rest
function playSlashEffect({ scene, skill, skillId, direction, startX, startY, actualRange, effectScale, createBurst }) {
    const slashColor = (skillId === 'heavy_slash') ? 0xff0000 : (skillId === 'judgment_cut' ? 0x00ffff : 0xffffff);

    if (skill.rangeType === 'circle') {
        const circle = scene.add.circle(startX, startY, 5 * effectScale, slashColor, 0.6);
        scene.tweens.add({ targets: circle, radius: actualRange, alpha: 0, duration: 300, onComplete: () => circle.destroy() });
        const ring = scene.add.circle(startX, startY, actualRange, slashColor, 0);
        ring.setStrokeStyle(4 * effectScale, slashColor, 0.8);
        scene.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 300, onComplete: () => ring.destroy() });

        createBurst(slashColor, 20, 150);
    } else {
        const hitX = startX + (direction * actualRange / 2);
        const slashLine = scene.add.rectangle(hitX, startY, actualRange, 10 * effectScale, slashColor).setOrigin(0.5);
        scene.tweens.add({
            targets: slashLine,
            alpha: 0,
            scaleY: 8,
            angle: direction * 45, // cut diagonally
            duration: 200,
            onComplete: () => slashLine.destroy()
        });
        createBurst(slashColor, 10, 100);
    }
}

// Magic explosion: expanding circle + particles, camera shake for big spells
function playMagicBlastEffect({ scene, skill, skillId, isRemote, remoteScale, direction, startX, startY, actualRange, effectScale }) {
    const color = skill.color || 0xff4500;

    // Circle skills explode on the caster, others a fixed distance in front
    const targetX = (skill.rangeType === 'circle') ? startX : startX + (direction * 150 * effectScale);

    const circle = scene.add.circle(targetX, startY, 10 * effectScale, color, 0.8);
    scene.tweens.add({
        targets: circle,
        scale: actualRange / 10, // grow to the real range
        alpha: 0,
        duration: 500,
        onComplete: () => circle.destroy()
    });

    const baseQuantity = (skillId === 'meteor_swarm' || skillId === 'abyss_storm') ? 30 : 15;
    const emitter = scene.add.particles(targetX, startY, 'water', {
        speed: { min: 50 * effectScale, max: 200 * effectScale },
        scale: { start: 0.6 * effectScale, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 600,
        blendMode: 'ADD',
        tint: color,
        quantity: Math.max(1, Math.ceil(baseQuantity * effectScale * remoteScale))
    });
    scene.time.delayedCall(600, () => emitter.destroy());

    // Shake only for own casts or casts near the local player
    if (!isRemote || Phaser.Math.Distance.Between(scene.player.x, scene.player.y, startX, startY) < 400) {
        if (skillId === 'meteor_swarm' || skillId === 'abyss_storm' || skillId === 'big_fireball') {
            scene.cameras.main.shake(200, 0.005 * effectScale);
        }
    }
}

// Buff / heal: ring on the ground + rising light particles
function playSupportEffect({ scene, skill, startX, startY, actualRange, effectScale, remoteScale }) {
    const color = skill.color || 0x00ff00;
    const ring = scene.add.circle(startX, startY, actualRange, color, 0.1);
    ring.setStrokeStyle(2 * effectScale, color, 0.5);
    scene.tweens.add({
        targets: ring,
        scale: 1.1,
        alpha: 0,
        duration: 1000,
        onComplete: () => ring.destroy()
    });

    const emitter = scene.add.particles(startX, startY + 20, 'water', {
        speedY: { min: -150 * effectScale, max: -50 * effectScale },
        speedX: { min: -20 * effectScale, max: 20 * effectScale },
        scale: { start: 0.4 * effectScale, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 800,
        blendMode: 'ADD',
        tint: color,
        quantity: Math.max(1, Math.ceil(10 * effectScale * remoteScale))
    });
    scene.time.delayedCall(800, () => emitter.destroy());
}

// Projectile: particle burst + a shape flying forward
function playProjectileEffect({ scene, skill, skillId, direction, startX, startY, actualRange, effectScale, remoteScale }) {
    const color = skill.color || 0x00ffff;
    const emitter = scene.add.particles(startX, startY, 'water', {
        speedX: (direction * 300 * effectScale),
        scale: { start: 0.5 * effectScale, end: 0 },
        lifespan: 500,
        blendMode: 'ADD',
        tint: color,
        quantity: Math.max(1, Math.ceil(8 * effectScale * remoteScale)),
        emitting: false
    });
    emitter.explode(Math.max(1, Math.ceil(8 * effectScale * remoteScale)), startX, startY);

    let projectile;
    if (skillId === 'holy_arrow') {
        projectile = scene.add.rectangle(startX, startY, 40 * effectScale, 4 * effectScale, color, 1);
    } else {
        projectile = scene.add.arc(startX, startY, 30 * effectScale, -30, 30, false, color, 0.8);
    }

    projectile.setAngle(direction === 1 ? 0 : 180);
    scene.tweens.add({
        targets: projectile,
        x: startX + (direction * actualRange),
        scale: 1.5,
        alpha: 0,
        duration: 500,
        onComplete: () => projectile.destroy()
    });
}
