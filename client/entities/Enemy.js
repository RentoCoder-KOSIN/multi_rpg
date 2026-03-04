import { getEnemyStats, getEnemyDisplayName, getEnemySizeConfig } from '../data/enemyStats.js';
import EnemyAI from '../ai/EnemyAI.js';
import { ENEMY_AI_CONFIG } from '../config.js';

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

        // 敵のステータスデータを取得
        const stats = getEnemyStats(type);
        this.maxHp = serverData.maxHp || serverData.hp || stats.hp;
        this.hp = serverData.hp || this.maxHp;
        this.atk = serverData.atk || stats.atk;
        this.expValue = serverData.exp || stats.exp;
        this.goldValue = serverData.gold || stats.gold;

        // 敵AI設定
        this.detectRange = 300; // プレイヤー検出範囲
        this.attackRange = 60; // 攻撃範囲
        this.attackCooldown = 1000; // 攻撃クールダウン（ms）
        this.lastAttackTime = 0;
        this.isAIEnabled = ENEMY_AI_CONFIG.enabled; // グローバルAI設定から初期化

        // AIが有効な場合は初期化
        if (this.isAIEnabled) {
            this.ai = new EnemyAI(this, {
                enabled: true,
                isTraining: ENEMY_AI_CONFIG.trainingEnabled,
                actionInterval: 200 // より頻繁に行動選択（AI学習を加速）
            });
            console.log(`✅ [Enemy AI] ${type} 敵生成 - AI有効`);
            console.log(`   検出範囲: ${this.detectRange}px | 攻撃範囲: ${this.attackRange}px`);
            console.log(`   学習モード: ${ENEMY_AI_CONFIG.trainingEnabled ? 'ON' : 'OFF'}`);
        } else {
            console.log(`⚠️  [Enemy] ${type} 敵生成 - デフォルト動作（AI無効）`);
        }

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
        const displayName = getEnemyDisplayName(this.type);

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

        // 敵タイプのサイズ設定を取得
        const sizeConfig = getEnemySizeConfig(this.type);
        const { targetWidth, targetHeight, hitWidth, hitHeight } = sizeConfig;

        // スケールを設定
        const scaleX = targetWidth / baseWidth;
        const scaleY = targetHeight / baseHeight;
        this.setScale(scaleX, scaleY);

        // 当たり判定（ボディ）の設定
        // setSizeはテクスチャ（スケール前）基準の解像度で指定
        const bodyWidth = hitWidth / scaleX;
        const bodyHeight = hitHeight / scaleY;

        this.body.setSize(bodyWidth, bodyHeight);

        this.body.setOffset(
            (baseWidth - bodyWidth) / 2,
            (baseHeight - bodyHeight) / 2 + bodyHeight * 0.3
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

    update(time = this.scene.time.now) {
        this.updateHealthBar();

        // サーバー管理の敵の場合は、位置補間を更新
        if (this.isServerManaged) {
            this.updateRemotePosition();
            return;
        }

        // この時刻がない場合（Phaser の update 呼び出しでない）、時刻を取得
        if (typeof time !== 'number' || !time) {
            time = this.scene.time.now;
        }

        // AIが有効な場合はAIを更新
        if (this.ai && this.isAIEnabled) {
            this.ai.update(time, 0);
        } else {
            // AIが無効な場合は単純な追跡ロジック
            this.defaultBehavior(time);
        }
    }

    /**
     * AIが無効な場合のデフォルト動作：プレイヤーを追跡して攻撃【改善版：より攻撃的】
     */
    defaultBehavior(time) {
        const player = this.scene.player;
        
        if (!player || !player.active) {
            // プレイヤーがいない場合はランダム移動
            this.setVelocity(this.direction.x * this.speed, this.direction.y * this.speed);
            return;
        }

        // プレイヤーとの距離を計算
        const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

        if (distance < this.detectRange) {
            // 検出範囲内：プレイヤーに向かって移動（高速）
            const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const moveSpeed = distance < 100 ? this.speed * 1.5 : this.speed;  // 接近時は加速
            const vx = Math.cos(angle) * moveSpeed;
            const vy = Math.sin(angle) * moveSpeed;
            this.setVelocity(vx, vy);

            // 攻撃範囲内で攻撃
            if (distance < this.attackRange) {
                this.attemptAttack(time, player);
            }

            // デバッグ：敵が追跡中であることを示す
            if (false) { // 本番時は false にしておく
                console.log(`[${this.type}] Chasing player at ${distance.toFixed(0)}px`);
            }
        } else {
            // 検出範囲外：ランダム移動
            this.setVelocity(this.direction.x * this.speed, this.direction.y * this.speed);
        }
    }

    /**
     * プレイヤーへの攻撃を試みる
     */
    attemptAttack(time, player) {
        // クールダウンをチェック
        if (time - this.lastAttackTime < this.attackCooldown) return;

        this.lastAttackTime = time;

        // プレイヤーがいて、アクティブであれば、ダメージを与える
        if (player && player.active) {
            // 移動を停止
            this.setVelocity(0, 0);

            // プレイヤーにダメージを与える
            if (player.takeDamage) {
                player.takeDamage(this.atk, this);
            }

            // AI の報酬計算（敵AIが有効な場合）
            if (this.ai && this.ai.notifyDamageDealt) {
                this.ai.notifyDamageDealt(this.atk);
            }

            // ビジュアル・オーディオフィードバック
            this.scene.cameras.main.shake(50, 0.002);

            console.log(`[Enemy] ${this.type} attacked player for ${this.atk} damage!`);
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

        // 敵AIの学習を確定させる（死ぬときに学習）
        if (this.ai && this.ai.onDeath) {
            this.ai.onDeath();
            console.log(`[Enemy] ${this.type} died - AI learning finalized`);
        }

        if (this.moveEvent) this.moveEvent.remove();

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
