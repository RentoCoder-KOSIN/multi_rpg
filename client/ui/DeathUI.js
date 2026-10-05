import { pinToScreen } from '../utils/screenFixed.js';

export default class DeathUI {
    constructor(scene) {
        this.scene = scene;
        this.createUI();
    }

    createUI() {
        const { width, height } = this.scene.scale;
        this.container = this.scene.add.container(width / 2, height / 2)
            .setScrollFactor(0).setDepth(200000).setVisible(false);
        pinToScreen(this.container);

        // Keep danger circles and the surrounding battle readable while dead.
        const shade = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.22).setInteractive();
        const panel = this.scene.add.graphics();
        panel.fillStyle(0x190b14, 0.98);
        panel.fillRoundedRect(-220, -125, 440, 250, 16);
        panel.lineStyle(3, 0xe94560, 0.95);
        panel.strokeRoundedRect(-220, -125, 440, 250, 16);
        const title = this.scene.add.text(0, -60, 'YOU DIED', {
            fontSize: '30px', fontFamily: '"Press Start 2P"', color: '#ff6b7a', stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5);
        const message = this.scene.add.text(0, -10, '力尽きました\nリスポーンして冒険を再開します', {
            fontSize: '12px', fontFamily: '"Press Start 2P"', color: '#ffffff', align: 'center', lineSpacing: 10
        }).setOrigin(0.5);
        const button = this.scene.add.rectangle(0, 70, 250, 52, 0x4a90e2, 1)
            .setStrokeStyle(2, 0xffffff, 0.8).setInteractive({ useHandCursor: true });
        const label = this.scene.add.text(0, 70, 'リスポーン', {
            fontSize: '16px', fontFamily: '"Press Start 2P"', color: '#ffffff'
        }).setOrigin(0.5);
        button.on('pointerdown', () => this.scene.player?.respawn());
        button.on('pointerover', () => button.setFillStyle(0x5ba4f4));
        button.on('pointerout', () => button.setFillStyle(0x4a90e2));
        this.container.add([shade, panel, title, message, button, label]);
    }

    show() { this.container.setVisible(true); }
    hide() { this.container.setVisible(false); }
}
