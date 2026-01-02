export default class PlayerNameUI {
    constructor(scene, player, playerName = 'Player') {
        this.scene = scene;
        this.player = player;
        this.playerName = playerName;
        this.level = player.stats?.level || 1;

        // プレイヤー名表示（頭上）
        this.nameText = scene.add.text(0, 0, `Lv.${this.level} ${playerName}`, {
            fontSize: '10px',
            color: '#ffffff',
            fontFamily: 'Press Start 2P',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);

        // 背景（テキストの幅を取得してから作成）
        const textWidth = this.nameText.width || 50; // フォールバック値
        this.background = scene.add.rectangle(0, 0, textWidth + 8, 16, 0x000000, 0.6)
            .setOrigin(0.5, 1).setScrollFactor(0).setDepth(99);

        // HPバー背景 (黒/赤)
        this.hpBarBg = scene.add.rectangle(0, 0, 32, 4, 0x000000, 0.8)
            .setOrigin(0.5, 1).setScrollFactor(0).setDepth(99);
        // HPバー (緑)
        this.hpBar = scene.add.rectangle(0, 0, 30, 2, 0x00ff00, 1)
            .setOrigin(0, 1).setScrollFactor(0).setDepth(100); // Origin 0 (Left) for easy scaling

        // カメラが設定されるまで待つ
        if (scene.cameras && scene.cameras.main) {
            this.updatePosition();
        } else {
            // カメラがまだない場合は、次のフレームで更新
            scene.time.delayedCall(100, () => {
                if (this.player && this.player.active) {
                    this.updatePosition();
                }
            });
        }
    }

    updatePosition() {
        if (!this.player || !this.player.active || !this.scene || !this.scene.cameras) {
            this.setVisible(false);
            return;
        }

        const camera = this.scene.cameras.main;
        if (!camera) {
            this.setVisible(false);
            return;
        }

        const worldX = this.player.x;
        const worldY = this.player.y - this.player.height / 2 - 15;

        const screenX = worldX - camera.scrollX;
        const screenY = worldY - camera.scrollY;

        // カメラの範囲内かチェック
        if (screenX < -50 || screenX > this.scene.scale.width + 50 ||
            screenY < -50 || screenY > this.scene.scale.height + 50) {
            this.setVisible(false);
            return;
        }

        this.setVisible(true);

        // 名前と背景の位置
        // HPバーがあるため、少し上にずらす
        const nameOffsetY = -5;
        this.nameText.setPosition(screenX, screenY + nameOffsetY);
        this.background.setPosition(screenX, screenY + nameOffsetY);

        // HPバーの位置 (名前の下)
        this.hpBarBg.setPosition(screenX, screenY);
        // HPバーはLeft Originなので、中心から左にずらす
        this.hpBar.setPosition(screenX - 15, screenY - 1);

        // HP更新
        const hp = this.player.stats?.hp || 0;
        const maxHp = this.player.stats?.maxHp || 100;
        const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

        this.hpBar.width = 30 * hpRatio;

        // 色の変化 (任意: ピンチで赤くするなど)
        if (hpRatio < 0.3) {
            this.hpBar.fillColor = 0xff0000;
        } else {
            this.hpBar.fillColor = 0x00ff00;
        }
    }

    setVisible(visible) {
        if (this.nameText) this.nameText.setVisible(visible);
        if (this.background) this.background.setVisible(visible);
        if (this.hpBarBg) this.hpBarBg.setVisible(visible);
        if (this.hpBar) this.hpBar.setVisible(visible);
    }

    setName(name) {
        this.playerName = name;
        this.updateText();
    }

    updateLevel(level) {
        this.level = level;
        this.updateText();
    }

    updateText() {
        this.nameText.setText(`Lv.${this.level} ${this.playerName}`);
        this.background.setSize(this.nameText.width + 8, 16);
    }

    destroy() {
        try {
            if (this.nameText) this.nameText.destroy();
            this.nameText = null;
        } catch (e) { }

        try {
            if (this.background) this.background.destroy();
            this.background = null;
        } catch (e) { }

        try {
            if (this.hpBarBg) this.hpBarBg.destroy();
            this.hpBarBg = null;
        } catch (e) { }

        try {
            if (this.hpBar) this.hpBar.destroy();
            this.hpBar = null;
        } catch (e) { }

        this.scene = null;
        this.player = null;
    }
}
