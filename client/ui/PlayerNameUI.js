export default class PlayerNameUI {
    constructor(scene, player, playerName = 'Player', playerId = '') {
        this.scene = scene;
        this.player = player;
        this.playerName = playerName;
        this.playerId = playerId;
        this.level = player.stats?.level || 1;

        // プレイヤー名表示（頭上）
        this.nameText = scene.add.text(0, 0, `Lv.${this.level} ${playerName}`, {
            fontSize: '10px',
            color: '#ffffff',
            fontFamily: 'Press Start 2P',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);

        // 背景
        this.background = scene.add.rectangle(0, 0, 50, 16, 0x000000, 0.6)
            .setOrigin(0.5, 1).setScrollFactor(0).setDepth(99);

        // HPバー背景
        this.hpBarBg = scene.add.rectangle(0, 0, 32, 4, 0x000000, 0.8)
            .setOrigin(0.5, 1).setScrollFactor(0).setDepth(99);
        // HPバー
        this.hpBar = scene.add.rectangle(0, 0, 30, 2, 0x00ff00, 1)
            .setOrigin(0, 1).setScrollFactor(0).setDepth(100);

        this.updateText();

        if (scene.cameras && scene.cameras.main) {
            this.updatePosition();
        } else {
            scene.time.delayedCall(100, () => {
                if (this.player && this.player.active) this.updatePosition();
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
        const worldY = this.player.y - (this.player.height || 48) / 2 - 15;

        const screenX = worldX - camera.scrollX;
        const screenY = worldY - camera.scrollY;

        if (screenX < -100 || screenX > this.scene.scale.width + 100 ||
            screenY < -100 || screenY > this.scene.scale.height + 100) {
            this.setVisible(false);
            return;
        }

        this.setVisible(true);

        const nameOffsetY = -5;
        this.nameText.setPosition(screenX, screenY + nameOffsetY);
        this.background.setPosition(screenX, screenY + nameOffsetY);
        this.hpBarBg.setPosition(screenX, screenY);
        this.hpBar.setPosition(screenX - 15, screenY - 1);

        const hp = this.player.stats?.hp || 0;
        const maxHp = this.player.stats?.maxHp || 100;
        const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
        this.hpBar.width = 30 * hpRatio;
        this.hpBar.fillColor = hpRatio < 0.3 ? 0xff0000 : 0x00ff00;
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
        let display = `Lv.${this.level} ${this.playerName}`;
        if (this.playerId) {
            display += `\n(${this.playerId.substring(0, 8)})`;
        }
        this.nameText.setText(display);
        this.background.setSize(this.nameText.width + 10, this.nameText.height + 4);
    }

    destroy() {
        [this.nameText, this.background, this.hpBarBg, this.hpBar].forEach(obj => {
            if (obj) obj.destroy();
        });
        this.scene = null;
        this.player = null;
    }
}
