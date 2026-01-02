export default class MapNameUI {
    constructor(scene, mapName) {
        if (!scene || !scene.add) {
            console.error('MapNameUI: Invalid scene provided');
            return;
        }

        this.scene = scene;
        this.mapName = mapName;

        const { width, height } = scene.scale;
        this.container = scene.add.container(width / 2, 80);
        this.container.setScrollFactor(0);
        this.container.setDepth(999);

        // 背景バー (ワイドなシネマティックバー)
        this.bgGfx = scene.add.graphics();
        this.drawBackground(width);
        this.container.add(this.bgGfx);

        // テキスト
        this.text = scene.add.text(0, 0, mapName, {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P"',
            stroke: '#4a90e2',
            strokeThickness: 5
        }).setOrigin(0.5);

        this.container.add(this.text);

        this.showAnimation();
    }

    drawBackground(width) {
        this.bgGfx.clear();
        // グラデーション風の黒
        this.bgGfx.fillStyle(0x000000, 0.6);
        this.bgGfx.fillRect(-width / 2, -25, width, 50);

        // 装飾ライン
        this.bgGfx.lineStyle(2, 0x4a90e2, 0.8);
        this.bgGfx.lineBetween(-width / 2, -25, width / 2, -25);
        this.bgGfx.lineBetween(-width / 2, 25, width / 2, 25);
    }

    showAnimation() {
        if (!this.scene || !this.container) return;

        this.container.setAlpha(0);
        this.container.setScale(1.2, 0); // 上下につぶれた状態から

        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            scaleY: 1,
            scaleX: 1,
            duration: 800,
            ease: 'Expo.easeOut'
        });

        this.scene.time.delayedCall(3000, () => {
            if (this.scene && this.scene.tweens && this.container) {
                this.scene.tweens.add({
                    targets: this.container,
                    alpha: 0,
                    scaleY: 0,
                    duration: 500,
                    onComplete: () => {
                        if (this.container) this.container.setVisible(false);
                    }
                });
            }
        });
    }

    updateMapName(mapName) {
        if (!this.scene || !this.container || !this.text) return;

        this.mapName = mapName;
        this.text.setText(mapName);
        this.container.setVisible(true);
        this.showAnimation();
    }
}
