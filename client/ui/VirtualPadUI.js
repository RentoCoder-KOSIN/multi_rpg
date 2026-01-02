export default class VirtualPadUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.createUI();
    }

    createUI() {
        const { width, height } = this.scene.scale;

        // 右下に配置
        this.container = this.scene.add.container(width - 80, height - 80).setScrollFactor(0).setDepth(150000);

        // 会話ボタン (Cキー相当)
        this.createActionButton(-100, 0, '💬', '#ffff00', () => {
            this.scene.handleInteraction();
        }, 'Talk');

        // スキルボタン 1, 2, 3
        this.createActionButton(0, -100, '1', '#5eff5e', () => this.scene.handleSkillUse(0), 'Skill 1');
        this.createActionButton(60, -60, '2', '#5eff5e', () => this.scene.handleSkillUse(1), 'Skill 2');
        this.createActionButton(100, 0, '3', '#5eff5e', () => this.scene.handleSkillUse(2), 'Skill 3');
    }

    createActionButton(x, y, label, color, action, name) {
        const btn = this.scene.add.container(x, y);
        const bg = this.scene.add.circle(0, 0, 35, 0x1a1a2e, 0.6).setStrokeStyle(3, color);
        const txt = this.scene.add.text(0, 0, label, {
            fontSize: '24px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);

        btn.add([bg, txt]);
        btn.setSize(70, 70);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
            bg.setFillStyle(color, 0.4);
            action();
        });
        btn.on('pointerup', () => bg.setFillStyle(0x1a1a2e, 0.6));
        btn.on('pointerout', () => bg.setFillStyle(0x1a1a2e, 0.6));

        this.container.add(btn);
    }
}
