import BaseWindowUI from "./BaseWindowUI.js";
import { REINCARNATION_CONFIG } from "../gameConstants.js";

// 輪廻転生の確認ウィンドウ。Rキーで開閉する。
// Lv100未満のときは条件と現在のレベルを表示するだけで、実行はできない。
export default class ReincarnationUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🔄 輪廻転生',
            width: 480,
            height: 360,
            depth: 200000,
            themeColor: 0xffd700
        });
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const width = this.config.width;

        this.infoText = this.scene.add.text(0, -100, '', {
            fontSize: '11px',
            fontFamily: 'Press Start 2P',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: width - 60 },
            lineSpacing: 10
        }).setOrigin(0.5, 0);
        this.container.add(this.infoText);

        this.confirmBtn = this.scene.add.rectangle(0, 90, 300, 60, 0xaa0000)
            .setStrokeStyle(3, 0xffd700)
            .setInteractive({ useHandCursor: true });
        this.confirmText = this.scene.add.text(0, 90, '輪廻転生する', {
            fontSize: '14px', fontFamily: 'Press Start 2P', color: '#ffffff'
        }).setOrigin(0.5);

        this.confirmBtn.on('pointerover', () => this.confirmBtn.setFillStyle(0xff0000));
        this.confirmBtn.on('pointerout', () => this.confirmBtn.setFillStyle(0xaa0000));
        this.confirmBtn.on('pointerdown', (pointer, x, y, event) => {
            if (event) event.stopPropagation();
            this.doReincarnate();
        });

        this.container.add([this.confirmBtn, this.confirmText]);
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this.refresh();
    }

    refresh() {
        const player = this.scene.player;
        if (!player || !this.infoText) return;

        const stats = player.stats;
        const ready = player.canReincarnate();
        const cfg = REINCARNATION_CONFIG;

        const lines = [
            `現在: Lv.${stats.level} (輪廻${stats.reincarnationCount || 0}回目)`,
            '',
            `Lv${cfg.REQUIRED_LEVEL}に到達すると輪廻転生できます。`,
            'レベルが1に戻り、職業を選び直せますが、',
            '習得済みスキルはすべて持ち越せます。',
            `STR/INT/VIT/MEN/DEXが各+${cfg.BASE_STAT_BONUS}、`,
            `ステータスポイントが+${cfg.BONUS_STAT_POINTS}されます。`,
        ];
        this.infoText.setText(lines.join('\n'));

        if (this.confirmBtn) {
            this.confirmBtn.setVisible(ready);
            this.confirmText.setVisible(ready);
        }
    }

    doReincarnate() {
        const player = this.scene.player;
        if (!player) return;
        if (player.reincarnate()) {
            this.toggle();
        }
    }
}
