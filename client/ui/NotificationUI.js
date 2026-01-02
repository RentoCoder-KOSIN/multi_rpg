export default class NotificationUI {
    constructor(scene) {
        if (!scene || !scene.add) {
            console.error('NotificationUI: Invalid scene provided');
            return;
        }

        this.scene = scene;
        this.notifications = [];
        const gameWidth = scene.scale && scene.scale.gameSize ? scene.scale.gameSize.width : (scene.scale ? scene.scale.width : 400);
        const gameHeight = scene.scale && scene.scale.gameSize ? scene.scale.gameSize.height : (scene.scale ? scene.scale.height : 600);
        const centerX = gameWidth / 2;
        // UIの重なり・見切れを防ぐため、Y座標100→scene高さ*0.15 のような動的配置
        const yTop = Math.floor(gameHeight * 0.15);
        this.container = scene.add.container(centerX, yTop);
        this.container.setScrollFactor(0);
        this.container.setDepth(5000); // 常に最前面へ
    }

    show(message, type = 'info', duration = 3500) {
        // 設定チェック
        const settings = this.scene.registry.get('settings');
        if (settings && settings.showLog === false) return;

        if (!this.scene || !this.container) return;

        const notification = this.createNotification(message, type);
        if (!notification) return;

        this.notifications.unshift(notification); // 新しいものを上に追加
        this.container.add(notification.container);

        notification.container.setAlpha(0);
        notification.container.x += 100; // 右からスライドイン

        if (this.scene.tweens) {
            this.scene.tweens.add({
                targets: notification.container,
                alpha: 1,
                x: 0,
                duration: 300,
                ease: 'Back.easeOut'
            });
        } else {
            notification.container.setAlpha(1);
            notification.container.x = 0;
        }

        // 自動削除
        if (this.scene.time) {
            this.scene.time.delayedCall(duration, () => {
                this.removeNotification(notification);
            });
        }
        this.updatePositions();
    }

    createNotification(message, type) {
        if (!this.scene || !this.scene.add) return null;

        const config = {
            success: { bg: 0x2ecc40, glow: 0x27ae60, icon: '✅' },
            error: { bg: 0xe74c3c, glow: 0xc0392b, icon: '🚨' },
            info: { bg: 0x3498db, glow: 0x2980b9, icon: 'ℹ️' },
            warning: { bg: 0xf1c40f, glow: 0xf39c12, icon: '⚠️' }
        };
        const c = config[type] || config.info;
        const container = this.scene.add.container(0, 0);

        const width = 420;
        const height = 50;

        // 背景 (グラデーション風)
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);

        // アクセントバー
        bg.fillStyle(c.bg, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, 8, height, { tl: 8, bl: 8, tr: 0, br: 0 });

        // 枠線
        bg.lineStyle(1, 0xffffff, 0.2);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);

        // メッセージ
        const text = this.scene.add.text(-width / 2 + 50, 0, message, {
            fontSize: '12px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P"',
            wordWrap: { width: 340 }
        }).setOrigin(0, 0.5);

        // アイコン
        const icon = this.scene.add.text(-width / 2 + 25, 0, c.icon, {
            fontSize: '20px'
        }).setOrigin(0.5);

        container.add([bg, icon, text]);
        return { container, type, message, destroyed: false };
    }

    removeNotification(notification) {
        if (!this.scene || !notification || notification.destroyed) return;
        notification.destroyed = true;

        if (this.scene.tweens) {
            this.scene.tweens.add({
                targets: notification.container,
                alpha: 0,
                x: -50,
                duration: 200,
                onComplete: () => {
                    this.finalizeRemoval(notification);
                }
            });
        } else {
            this.finalizeRemoval(notification);
        }
    }

    finalizeRemoval(notification) {
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
            this.notifications.splice(index, 1);
            if (notification.container) notification.container.destroy();
            this.updatePositions();
        }
    }

    updatePositions() {
        if (!this.scene) return;
        let currentY = 0;
        const gap = 12;

        this.notifications.forEach((notif, i) => {
            if (this.scene.tweens) {
                this.scene.tweens.add({
                    targets: notif.container,
                    y: currentY,
                    duration: 250,
                    ease: 'Power2'
                });
            } else {
                notif.container.y = currentY;
            }
            currentY += 62; // height + gap
        });
    }
}