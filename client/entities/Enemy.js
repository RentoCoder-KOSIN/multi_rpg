import EnemyAI from '../ai/EnemyAI.js';

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

        // AI設定（全ての敵で有効化）
        this.useAI = serverData.useAI !== false;
        this.ai = null;

        // AI制御を使用（サーバー管理・非管理問わず）
        if (this.useAI) {
            this.ai = new EnemyAI(this, {
                isTraining: scene.aiTrainingEnabled !== undefined ? scene.aiTrainingEnabled : true,
                actionInterval: 200,      // 500ms -> 200ms (より頻繁に行動・学習)
                learningRate: 0.3,        // 0.1 -> 0.3 (一回の経験からの学習効率向上)
                epsilonDecay: 0.97,       // 0.995 -> 0.97 (より早くランダムを卒業)
                epsilon: 0.5              // 初期探索率も少し上げて、より多角的に試行
            });
        } else if (!this.isServerManaged) {
            // AIを使わない場合のみ従来のランダム移動（サーバー管理でない場合のみ）
            this.moveEvent = scene.time.addEvent({
                delay: 2000,
                callback: () => this.changeDirection(),
                loop: true
            });
        }

        // サーバー管理の敵の場合、AI制御の移動をサーバーに送信する間隔
        this.lastServerSync = 0;
        this.serverSyncInterval = 100; // 100msごとに同期

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
            console.log(`[Enemy] Sending enemyHit: id=${this.id}, damage=${amount}, hp=${this.hp}`);
            this.socket.emit('enemyHit', { id: this.id, damage: amount });
        } else {
            console.log(`[Enemy] Local enemy hit: type=${this.type}, damage=${amount}, hp=${this.hp}`);
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

    update(time, delta) {
        this.updateHealthBar();

        // AI制御（サーバー管理・非管理問わず）
        if (this.useAI && this.ai) {
            this.ai.update(time, delta);

            // サーバー管理の敵の場合、AI制御の位置をサーバーに送信
            if (this.isServerManaged && this.socket && this.id) {
                if (time - this.lastServerSync > this.serverSyncInterval) {
                    // AI制御による移動をサーバーに反映
                    // サーバーの位置補間を無効化し、クライアントAIの位置を優先
                    this.socket.emit('enemyAIMove', {
                        id: this.id,
                        x: this.x,
                        y: this.y
                    });
                    this.lastServerSync = time;
                }
            }
        } else if (this.isServerManaged) {
            // AIを使わないサーバー管理の敵は、サーバーからの位置更新を受け取る
            this.updateRemotePosition();
        } else {
            // クライアント側での移動（従来のランダム移動）
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

        // AIの学習終了処理
        if (this.ai) {
            this.ai.onDeath();
        }

        const socketToUse = socket || this.socket;


        // サーバー管理の敵の場合は、撃破報告はenemyHitで行われるため、ここでの明示的な報告は不要
        // if (this.isServerManaged && socketToUse && this.id) {
        //    socketToUse.emit('enemyDefeat', { id: this.id });
        // }

        if (this.moveEvent) this.moveEvent.remove();
        // クエスト進行はサーバーからの enemyDefeated イベントで行うため削除
        // if (this.scene.questManager) this.scene.questManager.onEnemyKilled(this.type);

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

    useSkill(skillType, state) {
        if (!this.active || this.hp <= 0) return;

        const now = this.scene.time.now;
        if (!this.skillCooldowns) this.skillCooldowns = {};
        if (this.skillCooldowns[skillType] && now < this.skillCooldowns[skillType]) return;

        const skillData = this.getSkillData(skillType);
        if (!skillData) return;

        if (skillType === 'attack') {
            console.log(`[Enemy] ${this.type} uses ${skillData.name}!`);
            this.shootProjectile(state, skillData);
            this.skillCooldowns[skillType] = now + (skillData.cooldown || 5000);
        } else if (skillType === 'heal') {
            console.log(`[Enemy] ${this.type} uses ${skillData.name}!`);
            this.healSelf(skillData);
            this.skillCooldowns[skillType] = now + (skillData.cooldown || 10000);
        } else if (skillType === 'buff') {
            console.log(`[Enemy] ${this.type} uses ${skillData.name}!`);
            this.applyBuff(skillData);
            this.skillCooldowns[skillType] = now + (skillData.cooldown || 15000);
        }
    }

    getSkillData(type) {
        const skills = {
            slime: {
                attack: { name: 'Sticky Shot', color: 0x00ff00, size: 6, speed: 180, damage: 10, bulletCount: 1 },
                heal: { name: 'Slime Regrow', color: 0x00ff00 },
                buff: { name: 'Stickiness', color: 0x00ff00, type: 'speed', mult: 1.5, duration: 5000 }
            },
            forest_slime: {
                attack: { name: 'Leaf Shot', color: 0x228b22, size: 5, speed: 220, damage: 12, bulletCount: 2, spread: 15 },
                heal: { name: 'Nature Grace', color: 0x228b22 },
                buff: { name: 'Forest Spirit', color: 0x228b22, type: 'speed', mult: 1.3, duration: 6000 }
            },
            red_slime: {
                attack: { name: 'Fire Burst', color: 0xff4400, size: 7, speed: 200, damage: 18, bulletCount: 3, spread: 20 },
                heal: { name: 'Lava Absorb', color: 0xff4400 },
                buff: { name: 'Heat Up', color: 0xff4400, type: 'atk', mult: 1.5, duration: 8000 }
            },
            bat: {
                attack: { name: 'Sonic Wave', color: 0xaaaaaa, size: 4, speed: 300, damage: 8, bulletCount: 1 },
                heal: { name: 'Vampiric Rest', color: 0x880000 },
                buff: { name: 'Echo Location', color: 0xaaaaaa, type: 'speed', mult: 1.8, duration: 4000 }
            },
            skeleton: {
                attack: { name: 'Bone Toss', color: 0xeeeeee, size: 8, speed: 150, damage: 25, bulletCount: 1 },
                heal: { name: 'Bone Reassemble', color: 0xeeeeee },
                buff: { name: 'Hard Bone', color: 0xeeeeee, type: 'atk', mult: 1.3, duration: 7000 }
            },
            ghost: {
                attack: { name: 'Cursed Souls', color: 0x9900ff, size: 6, speed: 120, damage: 20, bulletCount: 3, spread: 360 },
                heal: { name: 'Spirit Mend', color: 0x9900ff },
                buff: { name: 'Phase Shift', color: 0x9900ff, type: 'speed', mult: 2.0, duration: 3000 }
            },
            goblin: {
                attack: { name: 'Rock Throw', color: 0x888888, size: 7, speed: 200, damage: 15, bulletCount: 1 },
                heal: { name: 'Dirty Bandage', color: 0xaaaaaa },
                buff: { name: 'Goblin Rage', color: 0xff0000, type: 'atk', mult: 2.0, duration: 5000 }
            },
            boss: {
                attack: { name: 'Death Nova', color: 0x000000, size: 15, speed: 120, damage: 45, cooldown: 4000, bulletCount: 16, spread: 360 },
                heal: { name: 'Dark Regeneration', color: 0x330033, amount: 20000 },
                buff: { name: 'Abyssal Might', color: 0x660066, type: 'all', mult: 2.0, duration: 15000 }
            },
            dragon_boss: {
                attack: { name: 'Dragon Breath', color: 0xff4400, size: 20, speed: 300, damage: 60, cooldown: 5000, bulletCount: 7, spread: 45 },
                heal: { name: 'Ancient Vitality', color: 0x00ff88, amount: 50000 },
                buff: { name: 'Dragon Heart', color: 0xff8800, type: 'all', mult: 2.5, duration: 20000 }
            }
        };
        const defaultSkill = {
            attack: { name: 'Attack', color: 0xffffff, size: 6, speed: 200, damage: 10, bulletCount: 1 },
            heal: { name: 'Heal', color: 0x00ff00 },
            buff: { name: 'Power Up', color: 0xffff00, type: 'atk', mult: 1.2, duration: 5000 }
        };
        const category = skills[this.type] || defaultSkill;
        return category[type] || defaultSkill[type];
    }

    shootProjectile(state, data) {
        const bulletCount = data.bulletCount || 1;
        const spread = data.spread || 0;
        const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, state.playerX, state.playerY);

        for (let i = 0; i < bulletCount; i++) {
            let angle = baseAngle;
            if (bulletCount > 1) {
                if (spread >= 360) {
                    // 全方位
                    angle = baseAngle + (Math.PI * 2 * i) / bulletCount;
                } else {
                    // 扇形
                    const spreadRad = Phaser.Math.DegToRad(spread);
                    angle = baseAngle - spreadRad / 2 + (spreadRad * i) / (bulletCount - 1);
                }
            }

            const projectile = this.scene.add.circle(this.x, this.y, data.size, data.color);
            projectile.setDepth(5);
            this.scene.physics.add.existing(projectile);

            // バフ反映済みの攻撃力を使用（もし実装されていれば。今回は簡易的にそのまま）
            const finalDamage = Math.floor(data.damage * (this.atkMult || 1));

            projectile.body.setVelocity(Math.cos(angle) * data.speed, Math.sin(angle) * data.speed);

            if (this.type.includes('boss')) {
                this.scene.tweens.add({ targets: projectile, scale: 1.5, duration: 500, yoyo: true, repeat: -1 });
            }

            // 衝突判定
            const scene = this.scene;
            scene.physics.add.overlap(scene.player, projectile, (hitPlayer, proj) => {
                if (hitPlayer && hitPlayer.takeDamage) {
                    hitPlayer.takeDamage(finalDamage);
                    if (this.ai) this.ai.notifyDamageDealt(finalDamage);
                }
                proj.destroy();
            });

            this.scene.time.delayedCall(4000, () => { if (projectile.active) projectile.destroy(); });
        }
    }

    healSelf(data) {
        const healAmount = Math.floor(this.maxHp * 0.2);
        this.hp = Math.min(this.maxHp, this.hp + healAmount);
        this.updateHealthBar();

        // AIに回復を通知（報酬付与用）
        if (this.ai) {
            this.ai.notifyHeal(healAmount);
        }

        const fx = this.scene.add.circle(this.x, this.y, 15, data.color, 0.6);
        this.scene.tweens.add({ targets: fx, radius: 60, alpha: 0, duration: 1000, onComplete: () => fx.destroy() });
    }

    applyBuff(data) {
        const originalSpeed = this.speed;
        const originalAtkMult = this.atkMult || 1;

        if (data.type === 'speed' || data.type === 'all') {
            this.speed *= data.mult;
        }
        if (data.type === 'atk' || data.type === 'all') {
            this.atkMult = (this.atkMult || 1) * data.mult;
        }

        // バフエフェクト（オーラ）
        const fx = this.scene.add.circle(this.x, this.y, 30, data.color, 0.4);
        fx.setDepth(this.depth - 1).setBlendMode(Phaser.BlendModes.ADD);

        // パーティクル的な小さな光
        const particles = [];
        for (let i = 0; i < 5; i++) {
            const p = this.scene.add.circle(this.x, this.y, 4, data.color, 0.8);
            p.setDepth(this.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
            particles.push(p);

            this.scene.tweens.add({
                targets: p,
                x: { from: this.x - 20, to: this.x + 20 },
                y: { from: this.y + 20, to: this.y - 40 },
                alpha: 0,
                scale: 2,
                duration: 800 + Math.random() * 400,
                repeat: -1,
                delay: i * 200
            });
        }

        const followTimer = this.scene.time.addEvent({
            delay: 16,
            callback: () => {
                if (fx.active && this.active) {
                    fx.setPosition(this.x, this.y);
                    particles.forEach((p, idx) => {
                        // パーティクルは少し遅れて追従したり、相対位置で動く
                        if (p.active) {
                            const offsetX = Math.sin(this.scene.time.now / 200 + idx) * 20;
                            const offsetY = Math.cos(this.scene.time.now / 200 + idx) * 20;
                            p.setPosition(this.x + offsetX, this.y + offsetY);
                        }
                    });
                } else {
                    followTimer.remove();
                }
            },
            loop: true
        });

        this.scene.tweens.add({
            targets: fx,
            scale: 2.0,
            alpha: 0.1,
            duration: 600,
            yoyo: true,
            repeat: -1
        });

        // 効果終了
        this.scene.time.delayedCall(data.duration, () => {
            if (this.active) {
                if (data.type === 'speed' || data.type === 'all') this.speed = originalSpeed;
                if (data.type === 'atk' || data.type === 'all') this.atkMult = originalAtkMult;
            }
            if (fx.active) fx.destroy();
            particles.forEach(p => { if (p.active) p.destroy(); });
            followTimer.remove();
        });
    }
}

export function getRandomSpawnPosition(scene, map) {
    const width = map.widthInPixels;
    const height = map.heightInPixels;
    const x = Phaser.Math.Between(50, width - 50);
    const y = Phaser.Math.Between(50, height - 50);
    return { x, y };
}
