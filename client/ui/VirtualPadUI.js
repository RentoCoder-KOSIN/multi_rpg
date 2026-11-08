import { UI_FONT } from '../fontConfig.js';
import { pinToScreen } from '../utils/screenFixed.js';
import { getUILayout } from './UILayoutManager.js';
export default class VirtualPadUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.createUI();
    }

    createUI() {
        // Position is managed by UILayoutManager (bottom-right, stacked above the skill dial)
        this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(150000);
        pinToScreen(this.container);
        getUILayout(this.scene).register('virtualPad', this.container);

        // 会話ボタン (Cキー相当)
        this.createActionButton(-100, 0, '💬', '#ffff00', () => {
            this.scene.handleInteraction();
        }, 'Talk');

        // スキルボタン 1, 2, 3：押している間は範囲表示、離したら発動（指をボタンの外へ滑らせると中断）
        this.createSkillButton(0, -100, '1', 0);
        this.createSkillButton(60, -60, '2', 1);
        this.createSkillButton(100, 0, '3', 2);
    }

    createSkillButton(x, y, label, slotIndex) {
        const owner = `pad-skill-${slotIndex}`;
        this.createActionButton(x, y, label, '#5eff5e', () => this.scene.beginSkillAim(slotIndex, owner), `Skill ${slotIndex + 1}`, {
            onRelease: () => this.scene.releaseAim(owner),
            onCancel: () => this.scene.cancelAim(owner)
        });
    }

    // handlers.onRelease: ボタン上で指/マウスを離した時。handlers.onCancel: ボタンの外に出た時
    createActionButton(x, y, label, color, action, name, handlers = {}) {
        const btn = this.scene.add.container(x, y);
        const bg = this.scene.add.circle(0, 0, 35, 0x1a1a2e, 0.6).setStrokeStyle(3, color);
        const txt = this.scene.add.text(0, 0, label, {
            fontSize: '24px', color: '#ffffff', fontFamily: UI_FONT
        }).setOrigin(0.5);

        btn.add([bg, txt]);
        btn.setSize(70, 70);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => {
            bg.setFillStyle(color, 0.4);
            action();
        });
        btn.on('pointerup', () => {
            bg.setFillStyle(0x1a1a2e, 0.6);
            if (handlers.onRelease) handlers.onRelease();
        });
        btn.on('pointerout', (pointer) => {
            bg.setFillStyle(0x1a1a2e, 0.6);
            // 指を離した時にも pointerout が来るので、まだ押したまま外へ出た時だけ中断扱いにする
            if (handlers.onCancel && pointer && pointer.isDown) handlers.onCancel();
        });

        this.container.add(btn);
    }
}
