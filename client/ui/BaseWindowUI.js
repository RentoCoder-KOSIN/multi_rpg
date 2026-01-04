export default class BaseWindowUI {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            width: 600,
            height: 480,
            title: 'WINDOW',
            depth: 100000,
            overlayAlpha: 0.4,
            themeColor: 0x4a90e2,
            titleColor: '#ffffff',
            titleStroke: 0xe94560,
            ...config
        };

        this.isOpen = false;
        this.container = null;
        this.overlay = null;
        this.bgGfx = null;
    }

    createWindow() {
        if (this.container) return;

        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        const { width, height, depth, overlayAlpha, title, titleColor, titleStroke } = this.config;

        // 1. Overlay
        this.overlay = this.scene.add.rectangle(0, 0, sceneWidth, sceneHeight, 0x000000, overlayAlpha)
            .setOrigin(0).setScrollFactor(0).setDepth(depth - 1).setInteractive().setVisible(false);
        // Removed: this.overlay.on('pointerdown', () => this.toggle()); (User wants to stop accidental closes)

        // 2. Main Container
        this.container = this.scene.add.container(sceneWidth / 2, sceneHeight / 2);
        this.container.setScrollFactor(0).setDepth(depth).setVisible(false);

        // 3. Background
        this.bgGfx = this.scene.add.graphics();
        this.drawBackground(width, height);
        this.container.add(this.bgGfx);

        // 3.1. Hit Blocking Area (invisible rectangle at the back of container)
        // This prevents clicks on the window from reaching the map, but allows clicks on internal buttons.
        this.blocker = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
            .setInteractive()
            .on('pointerdown', (pointer, x, y, event) => {
                if (event) event.stopPropagation();
            });
        this.container.add(this.blocker);
        this.container.sendToBack(this.blocker);
        this.container.sendToBack(this.bgGfx);

        // 4. Header / Title
        const titleText = this.scene.add.text(0, -height / 2 + 35, title, {
            fontSize: '22px', fontFamily: '"Press Start 2P"', color: titleColor,
            stroke: '#' + titleStroke.toString(16).padStart(6, '0'), strokeThickness: 4
        }).setOrigin(0.5);
        this.container.add(titleText);

        // 5. Close Button
        const closeBtn = this.scene.add.text(width / 2 - 35, -height / 2 + 35, '✕', {
            fontSize: '24px', fontFamily: 'Arial', color: '#ffffff', style: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.toggle());
        closeBtn.on('pointerover', () => closeBtn.setScale(1.2).setColor('#ff4b2b'));
        closeBtn.on('pointerout', () => closeBtn.setScale(1).setColor('#ffffff'));
        this.container.add(closeBtn);

        // 6. Common Keyboard Input
        this.scene.input.keyboard.on('keydown', (event) => {
            if (this.isOpen && event.code === 'Escape') {
                this.toggle();
            }
        });
    }

    drawBackground(width, height) {
        if (!this.bgGfx) return;
        this.bgGfx.clear();

        const themeColor = this.config.themeColor;

        // Pseudo Glow
        this.bgGfx.lineStyle(6, themeColor, 0.2);
        this.bgGfx.strokeRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, 20);

        // Main Panel
        this.bgGfx.fillStyle(0x16213e, 0.95);
        this.bgGfx.fillRoundedRect(-width / 2, -height / 2, width, height, 20);

        // Border
        this.bgGfx.lineStyle(3, 0x0f3460, 1);
        this.bgGfx.strokeRoundedRect(-width / 2, -height / 2, width, height, 20);

        // Header Decor Line
        this.bgGfx.lineStyle(2, themeColor, 0.5);
        this.bgGfx.lineBetween(-width / 2 + 40, -height / 2 + 70, width / 2 - 40, -height / 2 + 70);
    }

    toggle() {
        if (!this.container) {
            if (typeof this.createUI === 'function') {
                this.createUI();
            } else {
                this.createWindow();
            }
        }
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        this.isOpen = true;
        this.container.setVisible(true);
        if (this.overlay) this.overlay.setVisible(true);

        if (this.scene.player?.body) this.scene.player.setVelocity(0, 0);

        // Open Animation
        this.container.setScale(0.8);
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Ensure scale is exactly 1.0 to prevent hit area offset
                this.container.setScale(1.0);
                this.updateInteractiveAreas();
            }
        });
    }

    updateInteractiveAreas() {
        // Override this in child classes if needed to refresh interactive areas
        // This ensures hit areas are correctly positioned after container transformations
    }

    close() {
        this.isOpen = false;
        // Animation before hide
        this.scene.tweens.add({
            targets: this.container,
            scale: 0.9,
            alpha: 0,
            duration: 150,
            ease: 'Power2.easeIn',
            onComplete: () => {
                if (!this.isOpen) {
                    this.container.setVisible(false);
                    if (this.overlay) this.overlay.setVisible(false);
                }
            }
        });
    }

    destroy() {
        if (this.container) this.container.destroy();
        if (this.overlay) this.overlay.destroy();
    }
}
