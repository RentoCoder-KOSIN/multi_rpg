export default class SideMenuUI {
    constructor(scene) {
        this.scene = scene;
        this.isExpanded = false;
        this.container = null;
        this.buttons = [];
        this.createUI();
    }

    createUI() {
        const { width, height } = this.scene.scale;

        // メインコンテナ（少し右に寄せて安全圏へ）
        this.container = this.scene.add.container(50, height / 2).setScrollFactor(0).setDepth(300000);

        // トグルボタン（ハンバーガーメニュー風）
        this.toggleBtn = this.scene.add.container(0, 0);
        // ☰ボタンの背景を大きくする (モバイル対応を極端に強化)
        const toggleBg = this.scene.add.circle(0, 0, 45, 0x1a1a2e, 0.9).setStrokeStyle(4, 0x4a90e2);
        const toggleIcon = this.scene.add.text(0, -8, '☰', {
            fontSize: '40px', color: '#ffffff', fontFamily: 'Arial'
        }).setOrigin(0.5);

        const toggleLabel = this.scene.add.text(0, 22, '[M]', {
            fontSize: '12px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);

        this.toggleBtn.add([toggleBg, toggleIcon, toggleLabel]);

        // トグルボタンの当たり判定設定
        const toggleHitArea = this.scene.add.rectangle(0, 0, 90, 90, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        this.toggleBtn.add(toggleHitArea);
        this.toggleBtn.sendToBack(toggleHitArea);
        this.toggleBtn.sendToBack(toggleBg);

        toggleHitArea.on('pointerdown', (pointer, x, y, event) => {
            if (event) event.stopPropagation();
            this.toggle();
        });
        toggleHitArea.on('pointerover', () => toggleBg.setStrokeStyle(3, 0xffffff));
        toggleHitArea.on('pointerout', () => toggleBg.setStrokeStyle(2, 0x4a90e2));

        this.container.add(this.toggleBtn);

        // ボタンリスト（最初は非表示）
        this.menuItems = this.scene.add.container(60, 0).setVisible(false);
        this.container.add(this.menuItems);

        const items = [
            { icon: '🎒', label: 'Inv', key: 'I', color: '#e94560', action: () => this.scene.inventoryUI.toggle() },
            { icon: '🛡️', label: 'Equ', key: 'S', color: '#4a90e2', action: () => this.scene.equipmentUI.toggle() },
            { icon: '📊', label: 'Sta', key: 'P', color: '#ffd700', action: () => this.scene.statAllocationUI.toggle() },
            { icon: '🔮', label: 'Skl', key: 'K', color: '#533483', action: () => this.scene.skillManagerUI.toggle() },
            { icon: '👥', label: 'Pty', key: 'Y', color: '#00ff00', action: () => this.scene.partyUI.toggle() },
            { icon: '⚙️', label: 'Set', key: 'O', color: '#aaaaaa', action: () => this.scene.settingsUI.toggle() }
        ];

        items.forEach((item, index) => {
            const spacing = 75; // 間隔を広げる
            const y = (index - (items.length - 1) / 2) * spacing;

            const btn = this.scene.add.container(0, y);
            const bg = this.scene.add.circle(0, 0, 32, 0x1a1a2e, 0.9).setStrokeStyle(2, item.color);
            const icon = this.scene.add.text(0, -5, item.icon, { fontSize: '28px' }).setOrigin(0.5);

            // ショートカットキーのラベル追加
            const keyLabel = this.scene.add.text(0, 20, `[${item.key}]`, {
                fontSize: '10px',
                fontFamily: '"Press Start 2P"',
                color: '#ffffff'
            }).setOrigin(0.5);

            btn.add([bg, icon, keyLabel]);
            btn.setSize(64, 64); // 当たり判定を大きく
            btn.setInteractive({ useHandCursor: true });

            btn.on('pointerdown', (pointer, x, y, event) => {
                if (event) event.stopPropagation();
                item.action();
                this.toggle(); // メニューを閉じる
            });

            btn.on('pointerover', () => {
                bg.setStrokeStyle(3, 0xffffff);
                btn.setScale(1.1);
            });
            btn.on('pointerout', () => {
                bg.setStrokeStyle(2, item.color);
                btn.setScale(1);
            });

            this.menuItems.add(btn);
            this.buttons.push(btn);
        });
    }

    toggle() {
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            this.menuItems.setVisible(true);
            this.menuItems.setAlpha(0);
            this.menuItems.x = 40;

            this.scene.tweens.add({
                targets: this.menuItems,
                alpha: 1,
                x: 60,
                duration: 200,
                ease: 'Back.easeOut'
            });

            this.scene.tweens.add({
                targets: this.toggleBtn,
                angle: 90,
                duration: 200
            });
        } else {
            this.scene.tweens.add({
                targets: this.menuItems,
                alpha: 0,
                x: 40,
                duration: 150,
                ease: 'Power2.easeIn',
                onComplete: () => this.menuItems.setVisible(false)
            });

            this.scene.tweens.add({
                targets: this.toggleBtn,
                angle: 0,
                duration: 200
            });
        }
    }
}
