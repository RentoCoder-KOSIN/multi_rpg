import Enemy from './Enemy.js';

export default class SummonedBeast extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, owner, type = 'normal') {
        // type: 'normal', 'mega', 'demon_lord'
        let texture = 'slime';
        if (type === 'mega' || type === 'mega_summon') texture = 'dragon_boss';
        if (type === 'demon_lord' || type === 'demon_lord_summon') texture = 'demon_boss'; // demon_boss がある前提 or ドラゴンを赤くする

        super(scene, x, y, texture);
        this.owner = owner;
        this.isSummon = true;
        this.summonType = type;
        this.isMega = (type === 'mega' || type === 'mega_summon' || type === 'demon_lord' || type === 'demon_lord_summon');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        if (type === 'normal') {
            this.setTint(0x9370db);
            this.setScale(0.8);
        } else if (type === 'mega' || type === 'mega_summon') {
            this.setTint(0xff00ff);
            this.setScale(1.2);
        } else if (type === 'demon_lord' || type === 'demon_lord_summon') {
            this.setTint(0xff5555); // 禍々しい赤
            this.setScale(1.8); // さらに大きく
        }

        // ステータス設定
        let baseHp = 50000;
        let atkMultiplier = 0.8;
        let speedBonus = 0;
        let atkBaseMult = 2;

        if (type === 'mega' || type === 'mega_summon') {
            baseHp = 150000;
            atkMultiplier = 1.5;
            speedBonus = 50;
            atkBaseMult = 3;
        } else if (type === 'demon_lord' || type === 'demon_lord_summon') {
            baseHp = 500000; // 圧倒的タフネス
            atkMultiplier = 3.0; // 圧倒的攻撃力
            speedBonus = 100;
            atkBaseMult = 5;
        }

        this.maxHp = baseHp;
        this.hp = baseHp;
        this.atk = Math.ceil(owner.stats.int * atkBaseMult + owner.stats.atk * atkMultiplier);
        this.speed = 120 + (owner.stats.dex * 2) + speedBonus;
        this.searchRange = (350 + (owner.stats.int * 15)) * (type !== 'normal' ? 1.5 : 1);

        // クールダウン用
        this.lastAttackTime = 0;
        this.lastMpDrainTime = 0;
        this.target = null;

        // HPバー
        this.hpBarBg = scene.add.rectangle(0, 0, 30, 4, 0x000000).setDepth(10);
        let barColor = 0x9370db;
        if (type === 'mega' || type === 'mega_summon') barColor = 0xff00ff;
        if (type === 'demon_lord' || type === 'demon_lord_summon') barColor = 0xff0000;
        this.hpBar = scene.add.rectangle(0, 0, 30, 4, barColor).setDepth(11);

        // パーティクルエフェクト
        let pScale = 0.1;
        let pTint = 0x9370db;
        if (type !== 'normal') {
            pScale = 0.3;
            pTint = (type === 'demon_lord' || type === 'demon_lord_summon') ? 0xff0000 : 0xff00ff;
        }

        this.emitter = scene.add.particles(0, 0, 'water', {
            speed: { min: -20, max: 20 },
            scale: { start: pScale, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: 500,
            blendMode: 'ADD',
            tint: pTint,
            frequency: 100,
            follow: this
        });
    }

    updateSummon() {
        if (!this.active) return;

        // リモートプレイヤーの召喚獣はAIで動かない（位置同期のみ）
        if (this.owner && !this.owner.isLocal) {
            // HPバーのみ更新
            const hpPercent = Math.max(0, this.hp / this.maxHp);
            this.hpBar.width = 30 * hpPercent;
            this.hpBarBg.setPosition(this.x, this.y - 25);
            this.hpBar.setPosition(this.x, this.y - 25);
            return;
        }

        const now = this.scene.time.now;

        // HPバー更新
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        this.hpBar.width = 30 * hpPercent;
        this.hpBarBg.setPosition(this.x, this.y - 25);
        this.hpBar.setPosition(this.x, this.y - 25);

        // MP維持コスト (1秒ごとに消費)
        if (!this.lastMpDrainTime || now - this.lastMpDrainTime > 1000) {
            let upkeepCost = 2;
            if (this.summonType === 'mega' || this.summonType === 'mega_summon') upkeepCost = 5;
            if (this.summonType === 'demon_lord' || this.summonType === 'demon_lord_summon') upkeepCost = 15; // 魔王はコストが膨大

            // 精霊の共鳴 (パッシブ): 維持コスト-50%
            if (this.owner.stats.unlockedSkills?.includes('spirit_link')) {
                upkeepCost = Math.ceil(upkeepCost * 0.5);
            }

            if (this.owner && this.owner.stats) {
                // MPを減らす
                this.owner.stats.mp = Math.max(0, this.owner.stats.mp - upkeepCost);
                this.owner.saveStats(); // UI更新のため保存

                // 消費エフェクト (プレイヤーの頭上)
                const drainText = this.scene.add.text(this.owner.x, this.owner.y - 40, `-${upkeepCost} MP`, {
                    fontSize: '10px', color: '#5e5eff', fontFamily: '"Press Start 2P"'
                }).setOrigin(0.5);
                this.scene.tweens.add({
                    targets: drainText, y: this.owner.y - 70, alpha: 0, duration: 800,
                    onComplete: () => drainText.destroy()
                });

                // MPが切れたら消滅
                if (this.owner.stats.mp <= 0) {
                    if (this.scene.notificationUI) {
                        this.scene.notificationUI.show('MPが尽きたため召喚獣が帰還しました', 'warning');
                    }
                    this.scene.destroySummon(this);
                    return;
                }
            }
            this.lastMpDrainTime = now;
        }

        // ターゲットが有効かチェック
        if (this.target && (!this.target.active || Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y) > this.searchRange * 1.5)) {
            this.target = null;
        }

        // ターゲットがいない場合は新しいターゲットを探す
        if (!this.target) {
            this.findNewTarget();
        }

        if (this.target) {
            // ターゲットに向かって移動
            this.scene.physics.moveToObject(this, this.target, this.speed);
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);

            // 攻撃
            if (dist < 50) {
                if (now - this.lastAttackTime > 800) { // 攻撃速度も少し向上
                    let damage = this.atk;
                    let isCrit = false;

                    // クリティカル判定 (プレイヤーのクリティカル率を参照)
                    const critChance = (this.owner && this.owner.stats) ? (this.owner.stats.critChance || 0) : 0;
                    // 上位召喚ならさらにクリティカル率アップ
                    let netCritChance = critChance;
                    if (this.summonType !== 'normal') netCritChance += 0.1;
                    if (this.summonType === 'demon_lord' || this.summonType === 'demon_lord_summon') netCritChance += 0.1;

                    if (Math.random() < netCritChance) {
                        damage = Math.ceil(damage * 1.5);
                        isCrit = true;
                    }

                    this.target.takeDamage(damage, this.owner);

                    // クリティカル演出
                    if (isCrit) {
                        if (this.scene && this.scene.showHitEffect) {
                            this.scene.showHitEffect(this.target.x, this.target.y - 20, 0xffff00);
                        }
                        const critText = this.scene.add.text(this.target.x, this.target.y - 40, 'CRITICAL!', {
                            fontSize: '12px', color: '#ffff00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3
                        }).setOrigin(0.5);
                        this.scene.tweens.add({ targets: critText, y: this.target.y - 80, alpha: 0, duration: 800, onComplete: () => critText.destroy() });
                    }

                    this.lastAttackTime = now;

                    // ジャンピングアタック風エフェクト
                    this.scene.tweens.add({
                        targets: this,
                        y: this.y - 10,
                        duration: 100,
                        yoyo: true
                    });
                }
                this.setVelocity(0, 0);
            }
        } else {
            // 敵がいない場合はプレイヤーを追尾
            const distToOwner = Phaser.Math.Distance.Between(this.x, this.y, this.owner.x, this.owner.y);
            if (distToOwner > 60) {
                this.scene.physics.moveToObject(this, this.owner, this.speed);
            } else {
                this.setVelocity(0, 0);
            }
        }
    }

    findNewTarget() {
        if (!this.scene) return;
        const enemies = this.scene.children.list.filter(child => child instanceof Enemy && child.active);
        let nearest = null;
        let minDist = this.searchRange;

        enemies.forEach(enemy => {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        });

        this.target = nearest;
    }

    takeDamage(amount) {
        if (!this.active) return;
        this.hp -= amount;

        // ダメージ表示
        const damageText = this.scene.add.text(this.x, this.y - 30, `-${amount}`, {
            fontSize: '10px',
            color: '#9370db',
            fontFamily: 'Press Start 2P',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: damageText,
            y: this.y - 60,
            alpha: 0,
            duration: 800,
            onComplete: () => damageText.destroy()
        });

        if (this.hp <= 0) {
            this.scene.destroySummon(this);
        }
    }

    commandAttack() {
        if (!this.active) return;

        // 攻撃クールダウンをリセット
        this.lastAttackTime = 0;

        // ターゲット再検索
        if (!this.target) this.findNewTarget();

        if (this.target) {
            // 一時的にスピードアップ
            const originalSpeed = this.speed;
            this.speed *= 2;

            this.scene.time.delayedCall(3000, () => {
                if (this.active) this.speed = originalSpeed;
            });

            // エフェクト
            const text = this.scene.add.text(this.x, this.y - 40, '突撃！', {
                fontSize: '12px', color: '#ff0000', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
            this.scene.tweens.add({ targets: text, y: this.y - 80, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

            // ターゲットに向かって突進 (物理挙動があればベロシティ適用だが、moveToObjectで制御されているのでspeed変更で十分)
        }
    }

    preDestroy() {
        if (this.hpBar) this.hpBar.destroy();
        if (this.hpBarBg) this.hpBarBg.destroy();
        if (this.emitter) this.emitter.destroy();
    }
}
