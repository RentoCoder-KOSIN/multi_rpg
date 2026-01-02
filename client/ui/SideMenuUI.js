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

        // メインコンテナ（左端中央に配置）
        this.container = this.scene.add.container(20, height / 2).setScrollFactor(0).setDepth(150000);

        // トグルボタン（ハンバーガーメニュー風）
        this.toggleBtn = this.scene.add.container(0, 0);
        const toggleBg = this.scene.add.circle(0, 0, 25, 0x1a1a2e, 0.8).setStrokeStyle(2, 0x4a90e2);
        const toggleIcon = this.scene.add.text(0, 0, '☰', {
            fontSize: '24px', color: '#ffffff', fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.toggleBtn.add([toggleBg, toggleIcon]);
        this.toggleBtn.setSize(50, 50);
        this.toggleBtn.setInteractive({ useHandCursor: true });
        this.toggleBtn.on('pointerdown', () => this.toggle());
        this.toggleBtn.on('pointerover', () => toggleBg.setStrokeStyle(3, 0xffffff));
        this.toggleBtn.on('pointerout', () => toggleBg.setStrokeStyle(2, 0x4a90e2));

        this.container.add(this.toggleBtn);

        // ボタンリスト（最初は非表示）
        this.menuItems = this.scene.add.container(60, 0).setVisible(false);
        this.container.add(this.menuItems);

        const items = [
            { icon: '🎒', label: 'Inventory', color: '#e94560', action: () => this.scene.inventoryUI.toggle() },
            { icon: '🛡️', label: 'Equipment', color: '#4a90e2', action: () => this.scene.equipmentUI.toggle() },
            { icon: '📊', label: 'Stats', color: '#ffd700', action: () => this.scene.statAllocationUI.open() },
            { icon: '🔮', label: 'Skills', color: '#533483', action: () => this.scene.skillManagerUI.toggle() },
            { icon: '⚙️', label: 'Settings', color: '#aaaaaa', action: () => this.scene.settingsUI.toggle() }
        ];

        items.forEach((item, index) => {
            const spacing = 60;
            const y = (index - (items.length - 1) / 2) * spacing;

            const btn = this.scene.add.container(0, y);
            const bg = this.scene.add.circle(0, 0, 22, 0x1a1a2e, 0.9).setStrokeStyle(2, item.color);
            const icon = this.scene.add.text(0, 0, item.icon, { fontSize: '20px' }).setOrigin(0.5);

            btn.add([bg, icon]);
            btn.setSize(44, 44);
            btn.setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
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
