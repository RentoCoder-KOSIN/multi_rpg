import { UI_FONT } from '../fontConfig.js';

export default class PlayerNameUI {
    constructor(scene, player, playerName = 'Player', playerId = '', title = null, titleColor = '#ffff00') {
        this.scene = scene;
        this.player = player;
        this.playerName = playerName;
        this.playerId = playerId;
        this.level = player.stats?.level || 1;
        this.title = title !== undefined && title !== null ? title : (player.isLocal ? player.stats?.activeTitle || null : null);
        this.titleColor = titleColor || (player.isLocal ? player.stats?.activeTitleColor || '#ffff00' : '#ffff00');

        // 称号背景
        this.titleBg = scene.add.rectangle(0, 0, 40, 14, 0x000000, 0.7)
            .setOrigin(0.5, 1).setScrollFactor(0).setDepth(100);
        this.titleBg.setVisible(!!this.title);

        // 称号表示（名前のさらに上）
        this.titleText = scene.add.text(0, 0, this.title || '', {
            fontSize: '10px',
            color: this.titleColor,
            fontFamily: UI_FONT,
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center'
        }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(101);
        this.titleText.setVisible(!!this.title);

        // プレイヤー名表示（頭上）
        this.nameText = scene.add.text(0, 0, `Lv.${this.level} ${playerName}`, {
            fontSize: '11px',
            color: '#ffffff',
            fontFamily: UI_FONT,
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

        // 称号のリアルタイム変更を同期
        if (this.player.isLocal) {
            const currentTitle = this.player.stats?.activeTitle || null;
            const currentColor = this.player.stats?.activeTitleColor || '#ffff00';
            if (currentTitle !== this.title || currentColor !== this.titleColor) {
                this.setTitle(currentTitle, currentColor);
            }
        } else {
            // リモートプレイヤーの場合
            const remoteTitle = this.player.activeTitle !== undefined ? this.player.activeTitle : (this.player.stats?.activeTitle || null);
            const remoteColor = this.player.activeTitleColor || this.player.stats?.activeTitleColor || '#ffff00';
            if (remoteTitle !== this.title || remoteColor !== this.titleColor) {
                this.setTitle(remoteTitle, remoteColor);
            }
        }

        const camera = this.scene.cameras.main;
        if (!camera) {
            this.setVisible(false);
            return;
        }

        const worldX = this.player.x;
        const worldY = this.player.y - (this.player.height || 48) / 2 - 15;

        const zoom = camera.zoom || 1;
        const halfW = camera.width / 2;
        const halfH = camera.height / 2;
        const screenX = halfW + (worldX - (camera.scrollX + halfW)) * zoom;
        const screenY = halfH + (worldY - (camera.scrollY + halfH)) * zoom;

        if (screenX < -100 || screenX > this.scene.scale.width + 100 ||
            screenY < -100 || screenY > this.scene.scale.height + 100) {
            this.setVisible(false);
            return;
        }

        this.setVisible(true);

        const nameOffsetY = -5;
        this.nameText.setPosition(screenX, screenY + nameOffsetY);
        this.background.setPosition(screenX, screenY + nameOffsetY);

        if (this.titleText && this.title) {
            const titleOffsetY = nameOffsetY - this.nameText.height - 3;
            this.titleText.setPosition(screenX, screenY + titleOffsetY);
            if (this.titleBg) {
                this.titleBg.setPosition(screenX, screenY + titleOffsetY);
                this.titleBg.setSize(this.titleText.width + 8, this.titleText.height + 2);
            }
        }

        this.hpBarBg.setPosition(screenX, screenY);
        this.hpBar.setPosition(screenX - 15, screenY - 1);

        const hp = this.player.stats?.hp || 0;
        const maxHp = this.player.stats?.maxHp || 100;
        const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
        this.hpBar.width = 30 * hpRatio;
        this.hpBar.fillColor = hpRatio < 0.3 ? 0xff0000 : 0x00ff00;
    }

    setVisible(visible) {
        const hasTitle = !!this.title;
        if (this.titleBg) this.titleBg.setVisible(visible && hasTitle);
        if (this.titleText) this.titleText.setVisible(visible && hasTitle);
        if (this.nameText) this.nameText.setVisible(visible);
        if (this.background) this.background.setVisible(visible);
        if (this.hpBarBg) this.hpBarBg.setVisible(visible);
        if (this.hpBar) this.hpBar.setVisible(visible);
    }

    setTitle(title, color = '#ffff00') {
        this.title = title;
        this.titleColor = color;
        const hasTitle = !!title;
        if (this.titleText) {
            this.titleText.setText(title || '');
            if (color) this.titleText.setColor(color);
            this.titleText.setVisible(hasTitle);
        }
        if (this.titleBg) {
            this.titleBg.setVisible(hasTitle);
            if (hasTitle && this.titleText) {
                this.titleBg.setSize(this.titleText.width + 8, this.titleText.height + 2);
            }
        }
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

        if (this.player.isLocal && this.player.stats?.activeTitle) {
            this.setTitle(this.player.stats.activeTitle, this.player.stats.activeTitleColor);
        }
    }

    destroy() {
        [this.titleBg, this.titleText, this.nameText, this.background, this.hpBarBg, this.hpBar].forEach(obj => {
            if (obj) obj.destroy();
        });
        this.scene = null;
        this.player = null;
    }
}
