// Buff icon + particles shown above a buffed player.

const BUFF_ICONS = {
    attack_buff: { emoji: '⚔️', color: 0xff4444, name: '攻撃力UP' },
    defense_buff: { emoji: '🛡️', color: 0x4444ff, name: '防御力UP' },
    speed_buff: { emoji: '💨', color: 0x44ff44, name: '速度UP' },
    summon_power_up: { emoji: '🐲', color: 0xff44ff, name: '召喚強化' }
};

/**
 * Show a buff icon that follows `target` until `duration` (ms) has passed.
 * Visual only: the actual stat change is applied by target.applyBuff().
 */
export function applyBuffVisual(scene, target, buffType, buffValue, duration) {
    const buffInfo = BUFF_ICONS[buffType];
    if (!buffInfo) return;

    // Icon container above the target
    const buffIcon = scene.add.container(target.x, target.y - 60);
    const bg = scene.add.circle(0, 0, 18, buffInfo.color, 0.8);
    const bgStroke = scene.add.circle(0, 0, 18, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 1);
    const icon = scene.add.text(0, 0, buffInfo.emoji, { fontSize: '20px' }).setOrigin(0.5);
    buffIcon.add([bg, bgStroke, icon]);
    buffIcon.setDepth(1000);

    // Track icons on the target so several buffs sit side by side
    if (!target.buffIcons) target.buffIcons = [];
    target.buffIcons.push({ container: buffIcon, type: buffType });

    const updateIconPosition = () => {
        if (buffIcon.active && target.active) {
            const index = target.buffIcons.findIndex(b => b.container === buffIcon);
            buffIcon.setPosition(target.x + (index * 25) - 12, target.y - 60);
        }
    };
    scene.events.on('update', updateIconPosition);

    // Pop-in animation
    buffIcon.setScale(0);
    scene.tweens.add({ targets: buffIcon, scale: 1, duration: 300, ease: 'Back.easeOut' });

    // Pulse animation
    scene.tweens.add({
        targets: bg,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 0.8, to: 0.5 },
        duration: 800,
        yoyo: true,
        repeat: -1
    });

    // Light particles
    const particles = scene.add.particles(target.x, target.y - 40, 'water', {
        speed: { min: 20, max: 40 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 1000,
        blendMode: 'ADD',
        tint: buffInfo.color,
        frequency: 100,
        quantity: 2
    });
    particles.setDepth(999);

    if (scene.notificationUI) {
        scene.notificationUI.show(`${buffInfo.name} +${buffValue}`, 'success');
    }

    // Floating buff name
    const buffText = scene.add.text(target.x, target.y - 50, `${buffInfo.name}`, {
        fontSize: '12px',
        color: '#ffff00',
        fontFamily: '"Press Start 2P"',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5);
    buffText.setDepth(1001);
    scene.tweens.add({
        targets: buffText,
        y: target.y - 90,
        alpha: 0,
        duration: 1500,
        onComplete: () => buffText.destroy()
    });

    // Remove everything when the buff expires
    scene.time.delayedCall(duration, () => {
        if (target.buffIcons) {
            const index = target.buffIcons.findIndex(b => b.container === buffIcon);
            if (index !== -1) target.buffIcons.splice(index, 1);
        }

        scene.tweens.add({
            targets: buffIcon,
            alpha: 0,
            scale: 0,
            duration: 300,
            onComplete: () => {
                buffIcon.destroy();
                scene.events.off('update', updateIconPosition);
            }
        });

        particles.stop();
        scene.time.delayedCall(2000, () => particles.destroy());
    });
}
