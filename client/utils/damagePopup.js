import { UI_FONT } from '../fontConfig.js';
/**
 * ダメージ数値のポップアップ表示。
 *
 * 属性が付いている場合はその属性の色で数字を表示し、相性によって
 * 数字の後ろに背景エフェクトを敷く:
 *   - 抜群 (super) : 鋭いギザギザの爆発（衝撃が強い）
 *   - いまひとつ (weak) : くすんだ、にじんだ塊（衝撃が弱い）
 *   - どちらでもない : 何も敷かない（従来通りの数字だけ）
 *
 * Enemy.js / Player.js の両方から使う共通ヘルパー。
 */

function toColorString(color) {
    return `#${(color >>> 0).toString(16).padStart(6, '0')}`;
}

// ギザギザの爆発形（効果は抜群）
function drawSpikeBurst(scene, x, y, color) {
    const g = scene.add.graphics({ x, y });
    const spikes = 10;
    const outerR = 24;
    const innerR = 10;
    const points = [];
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push(new Phaser.Geom.Point(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    g.fillStyle(color, 0.85);
    g.fillPoints(points, true);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokePoints(points, true);
    return g;
}

// にじんだ塊（いまひとつ）
function drawDullBlob(scene, x, y, color) {
    const g = scene.add.graphics({ x, y });
    g.fillStyle(color, 0.4);
    g.fillEllipse(0, 2, 34, 20);
    g.fillStyle(color, 0.25);
    g.fillEllipse(0, -4, 22, 14);
    return g;
}

/**
 * @param {Phaser.Scene} scene
 * @param {number} x
 * @param {number} y
 * @param {number} amount
 * @param {Object} [options]
 * @param {number|null} [options.color] - 0xRRGGBB。属性が付いている攻撃の場合に指定
 * @param {'super'|'weak'|null} [options.affinity] - 相性の結果
 */
export function showDamageNumber(scene, x, y, amount, options = {}) {
    const { color = null, affinity = null } = options;
    const textColor = color !== null ? toColorString(color) : '#ffffff';
    const isSuper = affinity === 'super';
    const isWeak = affinity === 'weak';

    let bg = null;
    if (isSuper) {
        bg = drawSpikeBurst(scene, x, y - 20, color ?? 0xff5533);
    } else if (isWeak) {
        bg = drawDullBlob(scene, x, y - 20, color ?? 0x8899aa);
    }
    if (bg) bg.setDepth(19);

    const text = scene.add.text(x, y - 20, `-${amount}`, {
        fontSize: isSuper ? '19px' : '14px',
        fontFamily: UI_FONT,
        color: textColor,
        stroke: '#000',
        strokeThickness: isSuper ? 4 : 2,
    }).setOrigin(0.5).setDepth(20);

    const riseDistance = isSuper ? 65 : (isWeak ? 45 : 60);
    const duration = isSuper ? 900 : (isWeak ? 650 : 800);
    const targets = bg ? [text, bg] : [text];

    scene.tweens.add({
        targets,
        y: `-=${riseDistance}`,
        alpha: 0,
        duration,
        onComplete: () => {
            text.destroy();
            if (bg) bg.destroy();
        }
    });

    if (isSuper) {
        text.setScale(0.5);
        bg.setScale(0.3);
        scene.tweens.add({ targets: text, scale: 1.3, duration: 180, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: bg, scale: 1, duration: 220, ease: 'Back.easeOut' });
    } else if (isWeak) {
        bg.setScale(1.2);
        scene.tweens.add({ targets: bg, scale: 0.7, duration: duration, ease: 'Sine.easeIn' });
    }
}
