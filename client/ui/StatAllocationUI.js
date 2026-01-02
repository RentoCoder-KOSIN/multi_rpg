import BaseWindowUI from "./BaseWindowUI.js";

export default class StatAllocationUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '📊 STATS ALLOCATION',
            width: 480,
            height: 480,
            depth: 1000,
            themeColor: 0x4a90e2
        });
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const height = this.config.height;
        const width = this.config.width;

        // 残りポイント表示
        this.pointsText = this.scene.add.text(0, -height / 2 + 60, '残りポイント: 0', {
            fontSize: '14px',
            fontFamily: 'Press Start 2P',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(this.pointsText);

        // ステータス項目
        const stats = [
            { key: 'str', label: 'STR', desc: '物理攻撃', effect: 'Phy ATK', y: -120 },
            { key: 'int', label: 'INT', desc: '魔法攻撃', effect: 'Mag ATK', y: -60 },
            { key: 'vit', label: 'VIT', desc: 'HP', effect: 'HP +10', y: 0 },
            { key: 'men', label: 'MEN', desc: 'MP', effect: 'MP +5', y: 60 },
            { key: 'dex', label: 'DEX', desc: 'クリ/速度', effect: 'Crit +1%', y: 120 }
        ];

        this.statTexts = {};

        stats.forEach(stat => {
            // ステータス名と現在値
            const statText = this.scene.add.text(-width / 2 + 40, stat.y, `${stat.label}: 5`, {
                fontSize: '12px',
                fontFamily: 'Press Start 2P',
                color: '#ffffff'
            });
            this.statTexts[stat.key] = statText;

            // 説明テキスト
            const descText = this.scene.add.text(-width / 2 + 120, stat.y, stat.desc, {
                fontSize: '9px',
                fontFamily: 'Press Start 2P',
                color: '#aaaaaa'
            });

            // 効果表示
            const effectText = this.scene.add.text(-width / 2 + 40, stat.y + 12, stat.effect, {
                fontSize: '8px',
                fontFamily: 'Press Start 2P',
                color: '#00ff00'
            });

            // +ボタン
            const plusBtn = this.scene.add.rectangle(width / 2 - 80, stat.y, 30, 25, 0x00aa00)
                .setStrokeStyle(2, 0x00ff00)
                .setInteractive({ useHandCursor: true });

            const plusText = this.scene.add.text(width / 2 - 80, stat.y, '+', {
                fontSize: '16px',
                fontFamily: 'Press Start 2P',
                color: '#ffffff'
            }).setOrigin(0.5);

            plusBtn.on('pointerover', () => plusBtn.setFillStyle(0x00ff00));
            plusBtn.on('pointerout', () => plusBtn.setFillStyle(0x00aa00));
            plusBtn.on('pointerdown', () => {
                if (this.scene.player.allocateStatPoint(stat.key, 1)) {
                    this.refresh();
                }
            });

            // +5ボタン
            const plus5Btn = this.scene.add.rectangle(width / 2 - 40, stat.y, 40, 25, 0x0088aa)
                .setStrokeStyle(2, 0x00aaff)
                .setInteractive({ useHandCursor: true });

            const plus5Text = this.scene.add.text(width / 2 - 40, stat.y, '+5', {
                fontSize: '12px',
                fontFamily: 'Press Start 2P',
                color: '#ffffff'
            }).setOrigin(0.5);

            plus5Btn.on('pointerover', () => plus5Btn.setFillStyle(0x00aaff));
            plus5Btn.on('pointerout', () => plus5Btn.setFillStyle(0x0088aa));
            plus5Btn.on('pointerdown', () => {
                if (this.scene.player.allocateStatPoint(stat.key, 5)) {
                    this.refresh();
                }
            });

            this.container.add([
                statText, descText, effectText,
                plusBtn, plusText,
                plus5Btn, plus5Text
            ]);
        });

        // キーボード操作 (Pキー)
        this.scene.input.keyboard.on('keydown-P', () => {
            if (!this.scene.inventoryUI?.isOpen && !this.scene.shopUI?.isOpen && !this.scene.equipmentUI?.isOpen) {
                this.toggle();
            }
        });
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this.refresh();
    }

    refresh() {
        const player = this.scene.player;
        if (!player) return;

        if (this.pointsText) this.pointsText.setText(`残りポイント: ${player.stats.statPoints}`);

        this.statTexts.str?.setText(`STR: ${player.stats.str || 5}`);
        this.statTexts.int?.setText(`INT: ${player.stats.int || 5}`);
        this.statTexts.vit?.setText(`VIT: ${player.stats.vit || 5}`);
        this.statTexts.men?.setText(`MEN: ${player.stats.men || 5}`);
        this.statTexts.dex?.setText(`DEX: ${player.stats.dex || 5}`);

        // PlayerStatsUIも更新
        if (this.scene.playerStatsUI) {
            this.scene.playerStatsUI.update();
        }
    }
}
