import { UI_FONT } from '../fontConfig.js';

/**
 * 画面上部に邪魔にならず配置される「[📖 操作ガイド H]」ヘルプボタン
 */
export default class KeyHelpBarUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.createUI();
    }

    createUI() {
        if (this.container) return;

        const { width } = this.scene.scale;
        // 画面上部右寄り（ミニマップやHUDと重ならない上部バー）
        const posX = width - 110;
        const posY = 35;

        this.container = this.scene.add.container(posX, posY)
            .setScrollFactor(0)
            .setDepth(250000);

        const btnBg = this.scene.add.rectangle(0, 0, 115, 28, 0x1a2e4a, 0.85)
            .setStrokeStyle(1, 0x4a90e2, 0.9)
            .setInteractive({ useHandCursor: true });

        const btnTxt = this.scene.add.text(0, 0, '📖 操作ガイド [H]', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#ffd700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);

        btnBg.on('pointerdown', (p, x, y, event) => {
            if (event) event.stopPropagation();
            this.scene.keyGuideWindowUI?.toggle();
        });
        btnBg.on('pointerover', () => btnBg.setFillStyle(0x2a446c));
        btnBg.on('pointerout', () => btnBg.setFillStyle(0x1a2e4a));

        this.container.add([btnBg, btnTxt]);

        this.scene.scale.on('resize', this.onResize, this);
    }

    onResize(gameSize) {
        if (this.container) {
            this.container.setPosition(gameSize.width - 110, 35);
        }
    }

    destroy() {
        if (this.scene?.scale) {
            this.scene.scale.off('resize', this.onResize, this);
        }
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
    }
}
