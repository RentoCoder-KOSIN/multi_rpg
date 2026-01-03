export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, type, id = null, spawnId = null, socket = null, serverData = {}) {
        super(scene, x, y, texture);

        this.type = type;
        this.id = id;
        this.spawnId = spawnId;
        this.socket = socket;
        this.isServerManaged = !!socket; // サーバー管理の敵かどうか

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true);
        this.speed = 50;
        this.direction = new Phaser.Math.Vector2(0, 0);

        // サーバー管理の敵用の位置補間
        if (this.isServerManaged) {
            this.targetX = x;
            this.targetY = y;
            this.lerpSpeed = 0.3;
        }

        // サーバー管理の敵の場合は、クライアント側のランダム移動を無効化
        // サーバー側で位置が管理されるため
        if (!this.isServerManaged) {
            this.moveEvent = scene.time.addEvent({
                delay: 2000,
                callback: () => this.changeDirection(),
                loop: true
            });
        }

        // 戦闘用ステータス (サーバーデータがあれば優先)
        const statsMap = {
            'slime': { hp: 30, atk: 5, exp: 20, gold: 5 },
            'forest_slime': { hp: 100, atk: 15, exp: 120, gold: 25 },
            'dire_wolf': { hp: 250, atk: 30, exp: 400, gold: 80 },
            'boss': { hp: 2000, atk: 100, exp: 5000, gold: 500 }
        };

        const defaultStats = statsMap[type] || statsMap.slime;
        this.maxHp = serverData.maxHp || serverData.hp || defaultStats.hp;
        this.hp = serverData.hp || this.maxHp;
        this.atk = serverData.atk || defaultStats.atk;
        this.expValue = serverData.exp || defaultStats.exp;
        this.goldValue = serverData.gold || defaultStats.gold;

        // 体力ゲージの作成
        this.createHealthBar();

        // 名前ラベルの作成
        this.createNameLabel();

        // 敵の種類に応じたサイズと当たり判定の調整
        this.adjustSizeAndHitbox();

        this.on('destroy', () => {
            if (this.hpBar) this.hpBar.destroy();
            if (this.hpBarBg) this.hpBarBg.destroy();
            if (this.nameText) this.nameText.destroy();
        });
    }

    createNameLabel() {
        const statsMap = {
            'slime': 'スライム',
            'forest_slime': '森のスライム',
            'dire_wolf': 'ダイアウルフ',
            'boss': '森の守護者',
            'red_slime': 'レッドスライム',
            'bat': 'コウモリ',
            'skeleton': 'スケルトン',
            'goblin': 'ゴブリン',
            'ghost': 'ゴースト',
            'orc': 'オーク',
            'dragon_boss': 'エンシェントドラゴン'
        };
        const displayName = statsMap[this.type] || this.type;

        this.nameText = this.scene.add.text(0, 0, displayName, {
            fontSize: '10px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P"',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(12);
    }

    adjustSizeAndHitbox() {
        // キャッシュされたテクスチャ情報から元のサイズを確実に取得
        const texture = this.scene.textures.get(this.texture.key);
        const source = texture.getSourceImage();
        const baseWidth = source ? source.width : 32;
        const baseHeight = source ? source.height : 32;

        // ワールド座標系（画面上のピクセル数）での目標サイズ
        let targetWidth = 32;
        let targetHeight = 32;
        let hitWidth = 28;
        let hitHeight = 28;

        switch (this.type) {
            case 'slime':
            case 'forest_slime':
            case 'red_slime':
            case 'bat':
                targetWidth = 40;
                targetHeight = 40;
                hitWidth = 32;
                hitHeight = 26;
                break;
            case 'skeleton':
            case 'goblin':
            case 'ghost':
                targetWidth = 48;
                targetHeight = 48;
                hitWidth = 34;
                hitHeight = 44;
                break;
            case 'orc':
            case 'dire_wolf':
                targetWidth = 60;
                targetHeight = 60;
                hitWidth = 50;
                hitHeight = 52;
                break;
            case 'boss':
            case 'dragon_boss':
                targetWidth = 80; // 威厳がありつつ、画面を覆わないサイズ
                targetHeight = 80;
                hitWidth = 64;
                hitHeight = 64;
                break;
        }

        // スケールを設定
        const scaleX = targetWidth / baseWidth;
        const scaleY = targetHeight / baseHeight;
        this.setScale(scaleX, scaleY);

        // 当たり判定（ボディ）の設定
        // setSizeはテクスチャ（スケール前）基準の解像度で指定
        const bodyWidth = hitWidth / scaleX;
        const bodyHeight = hitHeight / scaleY;

        this.body.setSize(bodyWidth, bodyHeight);

        // オフセットで中央に寄せる（テクスチャ基準）
        this.body.setOffset(
            (baseWidth - bodyWidth) / 2,
            (baseHeight - bodyHeight) / 2
        );
    }

    createHealthBar() {
        const barWidth = this.type === 'boss' ? 100 : 40;
        this.hpBarBg = this.scene.add.rectangle(0, 0, barWidth, 5, 0x000000);
        this.hpBarBg.setDepth(10);
        this.hpBar = this.scene.add.rectangle(0, 0, barWidth, 5, 0x00ff00);
        this.hpBar.setDepth(11);
    }

    updateHealthBar() {
        if (!this.hpBar || !this.hpBarBg) return;

        const x = this.x;
        const y = this.y - (this.height * this.scaleY) / 2 - 10;

        this.hpBarBg.setPosition(x, y);
        this.hpBar.setPosition(x, y);

        if (this.nameText) {
            this.nameText.setPosition(x, y - 12);
            this.nameText.setVisible(this.active);
        }

        const percent = Math.max(0, this.hp / this.maxHp);
        this.hpBar.width = (this.type === 'boss' ? 100 : 40) * percent;

        // 色を体力に合わせて変更
        if (percent < 0.3) this.hpBar.setFillStyle(0xff0000);
        else if (percent < 0.6) this.hpBar.setFillStyle(0xffff00);
        else this.hpBar.setFillStyle(0x00ff00);

        this.hpBarBg.setVisible(this.active);
        this.hpBar.setVisible(this.active);
    }

    takeDamage(amount, attacker) {
        if (!this.active) return;

        // ローカルでのHP変動（予測）
        this.hp -= amount;

        // サーバー管理の敵の場合は、サーバーに通知
        if (this.isServerManaged && this.socket && this.id) {
            this.socket.emit('enemyHit', { id: this.id, damage: amount });
        }

        // ダメージ数値の表示
        const text = this.scene.add.text(this.x, this.y - 20, `-${amount}`, {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: 'Press Start 2P',
            stroke: '#000',
            strokeThickness: 2
        });
        this.scene.tweens.add({
            targets: text,
            y: this.y - 60,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });

        // ノックバック効果
        if (attacker) {
            const angle = Phaser.Math.Angle.Between(attacker.x, attacker.y, this.x, this.y);
            this.x += Math.cos(angle) * 10;
            this.y += Math.sin(angle) * 10;
        }

        if (this.hp <= 0) {
            // ゴールドドロップのビジュアルエフェクトは維持したいが、
            // サーバーからの確定値（goldValue）を使用するように考慮
            this.die();
        }
    }

    changeDirection() {
        this.direction.x = Phaser.Math.Between(-1, 1);
        this.direction.y = Phaser.Math.Between(-1, 1);
        this.direction.normalize();
    }

    update() {
        this.updateHealthBar();
        // サーバー管理の敵の場合は、位置補間を更新
        if (this.isServerManaged) {
            this.updateRemotePosition();
        } else {
            // クライアント側での移動
            this.setVelocity(this.direction.x * this.speed, this.direction.y * this.speed);
        }
    }

    setPosition(x, y) {
        // サーバーからの位置更新（補間用にターゲット位置を設定）
        if (this.isServerManaged) {
            this.targetX = x;
            this.targetY = y;
        } else {
            super.setPosition(x, y);
        }
    }

    updateRemotePosition() {
        // サーバー管理の敵の位置を補間して更新
        if (this.isServerManaged && this.targetX !== undefined && this.targetY !== undefined) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;

            // 距離が大きい場合は即座に移動（ラグ補正）
            if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                super.setPosition(this.targetX, this.targetY);
            } else {
                // スムーズに補間
                this.x += dx * this.lerpSpeed;
                this.y += dy * this.lerpSpeed;
            }
        }
    }

    die(socket = null) {
        if (!this.active) return; // 二重破壊防止

        const socketToUse = socket || this.socket;

        // サーバー管理の敵の場合は、サーバーに撃破を通知
        if (this.isServerManaged && socketToUse && this.id) {
            socketToUse.emit('enemyDefeat', { id: this.id });
        }

        if (this.moveEvent) this.moveEvent.remove();
        if (this.scene.questManager) this.scene.questManager.onEnemyKilled(this.type);

        // サーバー管理の敵の場合は、removeEnemyByIdで削除されるため
        // ここでは配列操作を行わない
        if (!this.isServerManaged) {
            // 配列から削除（旧コードとの互換性のため）
            if (Array.isArray(this.scene.enemies)) {
                const index = this.scene.enemies.indexOf(this);
                if (index > -1) {
                    this.scene.enemies.splice(index, 1);
                }
            }
        }

        // 安全に破壊
        if (this.active && this.scene) {
            try {
                if (this.hpBar) this.hpBar.destroy();
                if (this.hpBarBg) this.hpBarBg.destroy();
                if (this.nameText) this.nameText.destroy();
                this.destroy();
            } catch (e) {
                console.warn('Enemy: Failed to destroy', e);
            }
        }
    }
}

export function getRandomSpawnPosition(scene, map) {
    const width = map.widthInPixels;
    const height = map.heightInPixels;
    const x = Phaser.Math.Between(50, width - 50);
    const y = Phaser.Math.Between(50, height - 50);
    return { x, y };
}
