import { JOBS } from "../data/jobs.js";
import { ITEMS } from "../data/items.js";
import { SKILLS } from "../data/skills.js";

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, isLocal = false, socket = null) {
        super(scene, x, y, 'dude');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.isLocal = isLocal;
        this.socket = socket;
        this.speed = 150;
        this.setCollideWorldBounds(true);
        this.setOrigin(0.5, 1);

        this.body.setSize(this.width * 0.5, this.height * 0.6);
        this.body.setOffset(this.width * 0.25, this.height * 0.4);

        // ここで body を初期位置にリセット
        this.body.reset(x, y);

        if (!this.isLocal) {
            this.targetX = x;
            this.targetY = y;
            this.lerpSpeed = 0.2;
        }

        this.lastPositionSent = { x, y };
        this.positionUpdateInterval = 100;
        this.lastUpdateTime = 0;

        // スキルクールダウン管理用
        this.skillCooldowns = {};

        // ステータス初期化
        this.initializeStats();
    }

    initializeStats() {
        // localStorage または registry から読み込み
        const saved = JSON.parse(localStorage.getItem('playerStats')) || this.scene.registry.get('playerStats') || {};
        this.stats = {
            level: saved.level || 1,
            hp: saved.hp !== undefined ? saved.hp : 100,
            maxHp: saved.maxHp || 100,
            mp: saved.mp !== undefined ? saved.mp : 50,
            maxMp: saved.maxMp || 50,
            exp: saved.exp || 0,
            maxExp: saved.maxExp || 100,
            gold: saved.gold || 0,
            atk: saved.atk || 10,
            def: saved.def || 5,
            critChance: saved.critChance || 0,
            lifesteal: saved.lifesteal || 0,
            speedBonus: saved.speedBonus || 0,
            expMultiplier: saved.expMultiplier || 1.0,
            statPoints: saved.statPoints || 0,
            // 基本ステータス (Base Stats)
            str: saved.str || 5,  // Strength - 攻撃力に影響
            int: saved.int || 5,  // Intelligence - 魔法攻撃力に影響
            vit: saved.vit || 5,  // Vitality - HP最大値に影響
            men: saved.men || 5,  // Mental - MP最大値に影響
            dex: saved.dex || 5,  // Dexterity - クリティカル率・回避率に影響
            job: saved.job || 'none',
            inventory: saved.inventory || [],
            equipment: saved.equipment || { weapon: null, armor: null },
            jobExp: saved.jobExp || 0,
            unlockedSkills: saved.unlockedSkills || [],
            skillLevels: saved.skillLevels || {}, // { skillId: level }
            activeSkills: saved.activeSkills || [null, null, null]
        };

        this.applyEquipmentStats(); // 装備中のステータスを反映
        // this.updateSkillsByJob(); // 手動解放になったため廃止
        this.saveStats();
    }

    // updateSkillsByJob は廃止
    // this.skills = [...new Set(unlockedSkills)]; 処理も不要（unlockedSkillsで管理）
    updateSkillsByJob() {
        // 後方互換性のため空メソッドとして残すか、削除する
    }

    setJob(jobId) {
        if (!this.isLocal || !JOBS[jobId]) return;

        const newJob = JOBS[jobId];
        this.stats.job = jobId;

        this.applyEquipmentStats(); // ボーナスを含めて再計算
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;

        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`ジョブを${newJob.name}に変更しました！`, 'success');
        }
    }

    promoteJob(newJobId) {
        if (!this.isLocal || !JOBS[newJobId]) return false;
        const currentJobData = JOBS[this.stats.job];
        const newJobData = JOBS[newJobId];

        // 条件チェック
        if (this.stats.level < (newJobData.reqLevel || 30)) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`レベルが ${newJobData.reqLevel || 30} 足りません！`, 'error');
            return false;
        }

        if (currentJobData.nextJob !== newJobId) {
            return false;
        }

        this.stats.job = newJobId;

        // 転職ボーナス
        this.stats.statPoints += 20;

        this.applyEquipmentStats();
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`祝！上位職「${newJobData.name}」に転職しました！`, 'warning');
        }
        return true;
    }

    saveStats() {
        if (!this.isLocal) return;
        this.scene.registry.set('playerStats', this.stats);
        localStorage.setItem('playerStats', JSON.stringify(this.stats));

        if (this.scene.networkManager) {
            this.scene.networkManager.sendPlayerStats(this.stats.hp, this.stats.maxHp, this.stats.level, this.stats.mp, this.stats.maxMp);
        }
    }

    gainExp(amount) {
        if (!this.isLocal) return;

        // 経験値倍率を適用
        const finalAmount = Math.ceil(amount * (this.stats.expMultiplier || 1.0));

        if (this.stats.level < 100) { // レベルキャップ
            this.stats.exp += finalAmount;

            // ジョブ経験値も獲得 (現在は経験値と同量)
            this.stats.jobExp = (this.stats.jobExp || 0) + finalAmount;

            let leveledUp = false;
            // 複数レベルアップに対応 & 経験値を消費するように修正
            while (this.stats.exp >= this.stats.maxExp && this.stats.level < 100) {
                this.stats.exp -= this.stats.maxExp;
                this.levelUp();
                leveledUp = true;
            }

            // レベルアップしなかった場合でもUIを更新
            if (!leveledUp) {
                this.saveStats();
                if (this.scene.playerStatsUI) {
                    this.scene.playerStatsUI.update();
                }
            }
        }

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`EXP +${finalAmount}`, 'info');
        }
    }

    gainGold(amount) {
        if (!this.isLocal) return;
        this.stats.gold += amount;
        this.saveStats();
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`GOLD +${amount}`, 'warning');
        }
    }

    addItem(itemId) {
        if (!this.isLocal || !ITEMS[itemId]) return;
        this.stats.inventory.push(itemId);
        this.saveStats();
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`アイテム入手: ${ITEMS[itemId].name}`, 'success');
        }
    }

    unlockSkill(skillId) {
        if (!this.isLocal) return false;
        if (this.stats.unlockedSkills.includes(skillId)) return false; // 既に解放済み

        const skillDef = SKILLS[skillId];
        if (!skillDef) return false;

        const cost = skillDef.unlockCost || 10;
        if (this.stats.jobExp < cost) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`ジョブ経験値が足りません (必要: ${cost})`, 'error');
            }
            return false; // コスト不足
        }

        this.stats.jobExp -= cost;
        this.stats.unlockedSkills.push(skillId);
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`スキル「${skillDef.name}」を習得した！`, 'success');
        }

        // 初期レベルを1に設定
        this.stats.skillLevels[skillId] = 1;
        this.saveStats();

        return true;
    }

    levelUpSkill(skillId) {
        if (!this.isLocal) return false;
        if (!this.stats.unlockedSkills.includes(skillId)) return false;

        const currentLevel = this.stats.skillLevels[skillId] || 1;
        if (currentLevel >= 10) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('スキルレベルが最大です(Lv.10)', 'error');
            return false;
        }

        const skillDef = SKILLS[skillId];
        // コスト大幅引き上げ: (現在レベル * 100) Job Exp
        const cost = (currentLevel + 1) * 100;

        if (this.stats.jobExp < cost) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`Job EXPが足りません (必要: ${cost})`, 'error');
            return false;
        }

        this.stats.jobExp -= cost;
        this.stats.skillLevels[skillId] = currentLevel + 1;
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${skillDef.name} が Lv.${currentLevel + 1} に上がった！`, 'success');
        }
        return true;
    }

    setActiveSkill(slotIndex, skillId) {
        if (!this.isLocal) return;
        if (slotIndex < 0 || slotIndex >= 3) return;

        // スキル解放済みチェック
        if (skillId && !this.stats.unlockedSkills.includes(skillId)) return;

        this.stats.activeSkills[slotIndex] = skillId;
        this.saveStats();
    }

    hasSkill(skillId) {
        return this.stats.unlockedSkills.includes(skillId);
    }

    useSkill(slotIndex, target = null) {
        if (!this.isLocal) return;
        if (slotIndex < 0 || slotIndex >= 3) return;

        const skillId = this.stats.activeSkills[slotIndex];
        if (!skillId) return; // スキル未設定

        const skillDef = SKILLS[skillId];
        if (!skillDef) return;

        // 以下既存のuseSkillロジック（引数等調整が必要な場合あり、現状のコードベースに合わせて呼び出し）
        // 元のuseSkillメソッドはこのクラスにはなく、BaseGameSceneなどから呼ばれる想定か？
        // Playerクラスに `useSkill` 的なロジックがあるか確認したが、viewにはない。
        // おそらく BaseGameScene で `this.player.skills[index]` を参照している。
        // BaseGameScene側を変更して `this.player.stats.activeSkills[index]` を参照するようにする。
    }

    applyEquipmentStats() {
        // 基本ステータスから派生ステータスを計算
        const str = this.stats.str || 5;
        const int = this.stats.int || 5;
        const vit = this.stats.vit || 5;
        const men = this.stats.men || 5;
        const dex = this.stats.dex || 5;

        // 派生ステータスの基礎値を計算
        const jobDef = JOBS[this.stats.job];
        const jobAtkBonus = jobDef?.atkBonus || 0;
        const jobDefBonus = jobDef?.defBonus || 0;
        const jobHpBonus = jobDef?.hpBonus || 0;

        // 注: ここでジョブ固有のボーナス(jobDefBonus等)が加算されます
        if (jobDef && jobDef.type === 'magical') {
            this.stats.atk = 5 + (int * 2) + jobAtkBonus;  // INT 1 = ATK +2 + Job Bonus
        } else {
            this.stats.atk = 5 + (str * 2) + jobAtkBonus;  // STR 1 = ATK +2 + Job Bonus
        }
        this.stats.def = 3 + Math.floor(vit * 0.5) + jobDefBonus;
        this.stats.maxHp = 80 + (vit * 10) + jobHpBonus;
        this.stats.maxMp = 30 + (men * 5);

        // --- パッシブスキルの効果を適用 ---
        const unlocked = this.stats.unlockedSkills || [];

        // 不屈の闘志: 攻撃力+10%
        if (unlocked.includes('fighting_spirit')) {
            this.stats.atk = Math.ceil(this.stats.atk * 1.1);
        }
        // 魔力の源泉: 最大MP+50
        if (unlocked.includes('mana_well')) {
            this.stats.maxMp += 50;
        }
        // 金剛の体: 防御力+15%
        if (unlocked.includes('immovable_body')) {
            this.stats.def = Math.ceil(this.stats.def * 1.15);
        }
        // 風の如く: 移動速度+30
        const speedSkillBonus = unlocked.includes('wind_walker') ? 30 : 0;

        // 特殊ステータスの基礎値
        this.stats.critChance = dex * 0.01;
        this.stats.lifesteal = 0;
        this.stats.speedBonus = (dex * 2) + speedSkillBonus;
        this.stats.expMultiplier = 1.0;

        const weapon = ITEMS[this.stats.equipment.weapon];
        const armor = ITEMS[this.stats.equipment.armor];

        // 装備ボーナスを加算
        [weapon, armor].forEach(item => {
            if (!item) return;
            const s = item.stats || {};

            // 攻撃力・防御力 (関数なら実行、そうでなければ加算)
            const getVal = (val) => (typeof val === 'function' ? val(this) : (val || 0));

            this.stats.atk += getVal(item.atk || s.attack);
            this.stats.def += getVal(item.def || s.defense);

            // 特殊ステータス
            this.stats.critChance += getVal(item.critChance || s.critChance);
            this.stats.lifesteal += getVal(item.lifesteal || s.lifesteal);
            this.stats.speedBonus += getVal(item.speedBonus || s.speedBonus);

            // 経験値倍率は加算方式
            if (item.expMultiplier) this.stats.expMultiplier += (item.expMultiplier - 1.0);
            if (s.expMultiplier) this.stats.expMultiplier += (getVal(s.expMultiplier) - 1.0);
        });

        this.speed = 150 + this.stats.speedBonus;

        // HPとMPが最大値を超えないように調整
        this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
        this.stats.mp = Math.min(this.stats.mp, this.stats.maxMp);
    }

    /**
     * 最終的なダメージ計算
     * 武器の特殊効果などを反映可能にする
     */
    getDamage(multiplier = 1, target = null) {
        let atk = this.stats.atk;
        const weapon = ITEMS[this.stats.equipment.weapon];

        // 武器独自の威力計算ロジックがあれば上書き/追加
        if (weapon && typeof weapon.calculateAtk === 'function') {
            atk = weapon.calculateAtk(atk, this, target);
        }

        let amount = Math.ceil(atk * multiplier);

        // クリティカル判定
        const isCrit = Math.random() < (this.stats.critChance || 0);
        if (isCrit) {
            amount = Math.ceil(amount * 1.5);
        }

        return { amount, isCrit };
    }

    equipItem(itemId) {
        if (!this.isLocal || !ITEMS[itemId]) return;
        const item = ITEMS[itemId];

        // レベル制限チェック
        if (item.lvlReq && this.stats.level < item.lvlReq) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`レベルが足りません！ (必要Lv.${item.lvlReq})`, 'error');
            }
            return;
        }

        if (item.type === 'weapon') {
            this.stats.equipment.weapon = itemId;
        } else if (item.type === 'armor') {
            this.stats.equipment.armor = itemId;
        }

        this.applyEquipmentStats(); // すべてのステータスを再計算

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${item.name} を装備しました！`, 'info');
        }

        this.saveStats();
    }

    /**
     * 各種報酬を一括で付与する（拡張性）
     * @param {Object} reward 報酬オブジェクト { exp, gold, item, ... }
     */
    addReward(reward) {
        if (!this.isLocal || !reward) return;

        if (reward.exp) this.gainExp(reward.exp);
        if (reward.gold) this.gainGold(reward.gold);

        // 将来的にアイテムなどもここに追加可能
        if (reward.item) {
            this.addItem(reward.item);
        }
    }

    levelUp() {
        this.stats.level++;

        const jobDef = JOBS[this.stats.job];
        let statMsg = '';

        if (jobDef && jobDef.type === 'magical') {
            // 魔法職: INT重視
            this.stats.int += 2;
            this.stats.men += 1;
            this.stats.vit += 1; // 耐久も少し
            this.stats.dex += 1;
            // STRは上がらない
            statMsg = 'INT+2, MEN/VIT/DEX+1';
        } else if (jobDef && jobDef.type === 'physical') {
            // 物理職: STR重視
            this.stats.str += 2;
            this.stats.vit += 1;
            this.stats.dex += 1;
            this.stats.men += 1; // スキル用MP
            // INTは上がらない
            statMsg = 'STR+2, VIT/DEX/MEN+1';
        } else {
            // その他/初心者: バランス
            this.stats.str++;
            this.stats.int++;
            this.stats.vit++;
            this.stats.men++;
            this.stats.dex++;
            statMsg = '全ステータス+1';
        }

        this.stats.statPoints += 5; // レベルアップごとに5ポイント付与

        this.applyEquipmentStats(); // ステータス再計算

        this.updateSkillsByJob(); // 新スキルチェック

        this.stats.hp = this.stats.maxHp; // HP全回復
        this.stats.mp = this.stats.maxMp; // MP全回復
        this.stats.maxExp = Math.floor(this.stats.maxExp * 1.5);
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`レベルアップ！ Level ${this.stats.level} (${statMsg}, Pt+5)`, 'warning');
        }

        // 各種UIを更新
        if (this.scene.playerStatsUI) {
            this.scene.playerStatsUI.update();
        }
        if (this.scene.playerNameUI) {
            this.scene.playerNameUI.updateLevel(this.stats.level);
        }

        // レベルアップエフェクト（簡易）
        const circle = this.scene.add.circle(this.x, this.y, 10, 0xffff00, 0.5);
        this.scene.tweens.add({
            targets: circle,
            radius: 50,
            alpha: 0,
            duration: 500,
            onComplete: () => circle.destroy()
        });
    }

    /**
     * ステータスポイントを割り振る
     * @param {string} stat - 'str', 'int', 'vit', 'men', 'dex'
     * @param {number} points - 割り振るポイント数
     */
    allocateStatPoint(stat, points = 1) {
        if (!this.isLocal) return false;
        if (this.stats.statPoints < points) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('ステータスポイントが足りません', 'error');
            }
            return false;
        }

        const validStats = ['str', 'int', 'vit', 'men', 'dex'];
        if (!validStats.includes(stat)) {
            return false;
        }

        this.stats.statPoints -= points;
        this.stats[stat] += points;

        // 派生ステータスを再計算
        this.applyEquipmentStats();
        this.saveStats();

        const statNames = {
            str: 'STR (攻撃力)',
            int: 'INT (魔法)',
            vit: 'VIT (HP)',
            men: 'MEN (MP)',
            dex: 'DEX (クリティカル/速度)'
        };

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${statNames[stat]}に${points}ポイント割り振りました`, 'success');
        }
        return true;
    }

    takeDamage(amount) {
        this.stats.hp = Math.max(0, this.stats.hp - amount);
        this.saveStats();

        // ダメージ数値の表示
        const text = this.scene.add.text(this.x, this.y - 20, `-${amount}`, {
            fontSize: '16px',
            color: '#ff0000',
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

        if (this.stats.hp <= 0) {
            this.die();
        }
    }

    die() {
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show('力尽きました...', 'error');
        }
        // とりあえず初期位置にリセット
        this.stats.hp = this.stats.maxHp;
        this.saveStats();

        // マップの初期位置へ
        this.scene.scene.restart();
    }

    setStats(hp, maxHp, level, mp, maxMp) {
        if (hp !== undefined) this.stats.hp = hp;
        if (maxHp !== undefined) this.stats.maxHp = maxHp;
        if (level !== undefined) this.stats.level = level;
        if (mp !== undefined) this.stats.mp = mp;
        if (maxMp !== undefined) this.stats.maxMp = maxMp;

        // 名前表示UIの更新
        if (this.nameUI) {
            this.nameUI.updateLevel(this.stats.level);
        }
    }


    setPosition(x, y) {
        if (!this.isLocal) {
            // 他プレイヤーの位置補間用
            this.targetX = x;
            this.targetY = y;
        } else {
            // ローカルプレイヤーは単純に座標更新
            super.setPosition(x, y);
        }
    }


    moveTo(x, y) {
        if (!this.isLocal) return;
        this.moveTarget = { x, y };
    }

    update(cursors) {
        if (this.isLocal && cursors) { // Keep cursors check here
            const now = this.scene.time.now;
            const body = this.body;
            if (!body) return;

            // キー入力を優先
            let isMovingByKey = cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown;

            if (isMovingByKey) {
                this.moveTarget = null; // キー入力があったら自動移動解除
                body.setVelocity(0, 0);
                if (cursors.left.isDown) { body.setVelocityX(-this.speed); this.anims.play('walk-left', true); }
                else if (cursors.right.isDown) { body.setVelocityX(this.speed); this.anims.play('walk-right', true); }

                if (cursors.up.isDown) body.setVelocityY(-this.speed);
                else if (cursors.down.isDown) body.setVelocityY(this.speed);
            } else if (this.moveTarget) {
                // 自動移動 (moveTo)
                const distance = Phaser.Math.Distance.Between(this.x, this.y, this.moveTarget.x, this.moveTarget.y);

                if (distance < 5) {
                    this.moveTarget = null;
                    body.setVelocity(0, 0);
                    this.anims.play('idle', true);
                } else {
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.moveTarget.x, this.moveTarget.y);
                    const vx = Math.cos(angle) * this.speed;
                    const vy = Math.sin(angle) * this.speed;

                    body.setVelocity(vx, vy);

                    // アニメーション向き
                    if (Math.abs(vx) > Math.abs(vy)) {
                        this.anims.play(vx > 0 ? 'walk-right' : 'walk-left', true);
                    } else if (vy < 0) {
                        this.anims.play('walk-up', true); // walk-up があれば
                    } else {
                        this.anims.play('walk-down', true); // walk-down があれば
                    }
                    if (!this.anims.exists('walk-up')) this.anims.play(vx > 0 ? 'walk-right' : 'walk-left', true);
                }
            } else {
                body.setVelocity(0, 0);
                this.anims.play('idle', true);
            }

            // 自然回復 (2秒ごとにHP 1%, MP 2回復)
            if (this.isLocal && this.active && !this.stats.dead) {
                if (!this.lastRegenTime || now - this.lastRegenTime > 2000) {
                    // HP回復
                    if (this.stats.hp < this.stats.maxHp) {
                        this.stats.hp = Math.min(this.stats.hp + Math.ceil(this.stats.maxHp * 0.01), this.stats.maxHp);
                    }
                    // MP回復 (召喚獣がいない場合のみ)
                    const hasSummon = this.scene.activeSummon && this.scene.activeSummon.active;
                    if (!hasSummon && this.stats.mp < this.stats.maxMp) {
                        this.stats.mp = Math.min(this.stats.mp + 2, this.stats.maxMp);
                    }

                    this.lastRegenTime = now;
                    this.saveStats();
                }
            }
            const distance = Phaser.Math.Distance.Between(this.lastPositionSent.x, this.lastPositionSent.y, this.x, this.y);
            if (distance > 5 || (now - this.lastUpdateTime) > this.positionUpdateInterval) {
                if (this.socket) {
                    this.socket.emit('playerMove', { x: this.x, y: this.y });
                    this.lastPositionSent = { x: this.x, y: this.y };
                    this.lastUpdateTime = now;
                }
            }
        }
    }

    updateRemotePosition() {
        if (!this.isLocal && this.targetX !== undefined && this.targetY !== undefined) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            if (Math.abs(dx) > 50 || Math.abs(dy) > 50) super.setPosition(this.targetX, this.targetY);
            else { this.x += dx * this.lerpSpeed; this.y += dy * this.lerpSpeed; }

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                if (Math.abs(dx) > Math.abs(dy)) this.anims.play(dx > 0 ? 'walk-right' : 'walk-left', true);
                else this.anims.play('idle', true);
            } else this.anims.play('idle', true);
        }
    }
}
