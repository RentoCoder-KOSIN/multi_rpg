import QLearningAgent from './QLearningAgent.js';

/**
 * Enemy AI Controller
 * Q-Learningエージェントを使って敵の行動を制御
 */
export default class EnemyAI {
    constructor(enemy, config = {}) {
        this.enemy = enemy;
        this.scene = enemy.scene;

        // Q-Learningエージェント
        this.agent = new QLearningAgent({
            learningRate: config.learningRate || 0.3,
            discountFactor: config.discountFactor || 0.95,
            epsilon: config.epsilon || 0.5,
            epsilonDecay: config.epsilonDecay || 0.97,
            minEpsilon: config.minEpsilon || 0.05
        });

        // 学習モード（本番環境ではfalseに）
        this.isTraining = config.isTraining !== undefined ? config.isTraining : true;

        // 前回の状態と行動（学習用）
        this.lastState = null;
        this.lastAction = null;

        // 行動実行の間隔
        this.actionInterval = config.actionInterval || 500; // ms
        this.lastActionTime = 0;

        // パフォーマンス追跡
        this.startHp = enemy.hp;
        this.damageDealt = 0;
        this.hpHealed = 0;
        this.survivalTime = 0;

        // 保存されたモデルを読み込み（localStorage）
        this.loadModel();

        // 共有学習のセットアップ
        this.setupSharedLearning();
    }

    /**
     * 共有学習（サーバー同期）の設定
     */
    setupSharedLearning() {
        const socket = this.scene.networkManager?.getSocket();
        if (!socket) return;

        // サーバーからの共有データ更新を受け取る
        socket.on('aiSharedUpdate', (data) => {
            if (data.enemyType === this.enemy.type && data.qTableData) {
                // 自分以外からの学習結果を取り込む
                this.agent.mergeLoad(data.qTableData);
            }
        });

        // 初回ロード時にサーバーから最新データを取得
        socket.emit('getSharedAI', { enemyType: this.enemy.type });
    }

    /**
     * サーバー（共有学習）に学習データを送信
     */
    syncWithShared() {
        const socket = this.scene.networkManager?.getSocket();
        if (!socket) return;

        const data = JSON.parse(this.agent.save());
        socket.emit('aiLearnSync', {
            enemyType: this.enemy.type,
            qTableData: data
        });
    }

    /**
     * 現在の状態を取得
     */
    getState() {
        const player = this.scene.player;
        const activeSummon = this.scene.activeSummon;

        let nearestTarget = null;
        let minDistance = Infinity;

        // 1. プレイヤーを最優先
        if (player && player.active) {
            minDistance = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, player.x, player.y);
            nearestTarget = player;
        }

        // 2. 召喚獣がいれば、距離に応じてターゲットを切り替える可能性がある（任意）
        // ここでは単純に「一番近いもの」を狙う
        if (activeSummon && activeSummon.active) {
            const distToSummon = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, activeSummon.x, activeSummon.y);
            if (distToSummon < minDistance) {
                minDistance = distToSummon;
                nearestTarget = activeSummon;
            }
        }

        if (!nearestTarget) return null;

        const distance = minDistance;
        const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, nearestTarget.x, nearestTarget.y);
        const hpPercent = (this.enemy.hp / this.enemy.maxHp) * 100;

        // ターゲットのHP割合
        let targetHpPercent = 100;
        if (nearestTarget === player) {
            targetHpPercent = (player.hp / player.maxHp) * 100;
        } else {
            targetHpPercent = (nearestTarget.hp / nearestTarget.maxHp) * 100;
        }

        // 周囲の仲間の数（連携用）
        let nearbyAllies = 0;
        Object.values(enemies).forEach(other => {
            if (other !== this.enemy && other.active) {
                const d = Phaser.Math.Distance.Between(this.enemy.x, this.enemy.y, other.x, other.y);
                if (d < 150) nearbyAllies++;
            }
        });

        return {
            distance,
            angle,
            hpPercent,
            playerHpPercent: targetHpPercent, // 互換性のために名前は維持
            playerX: nearestTarget.x,
            playerY: nearestTarget.y,
            isTargetPlayer: (nearestTarget === player),
            nearbyAllies: Math.min(nearbyAllies, 3),
            canHeal: hpPercent < 50
        };
    }

    /**
     * 報酬を計算
     */
    calculateReward(state, action) {
        let reward = 0;

        // 【新】前回との距離の変化をチェック（逃走防止）
        if (this.lastDistance !== undefined) {
            const distChange = this.lastDistance - state.distance;
            if (distChange > 0) {
                // プレイヤーに近づいたら報酬
                reward += distChange * 0.1;
            } else if (distChange < 0) {
                // 逃げたら重いペナルティ
                reward -= Math.abs(distChange) * 0.3;
            }
        }
        this.lastDistance = state.distance;

        // 1. 距離に基づく報酬
        if (state.distance < 60) {
            reward += 1.5;
            if (action === 'wait') reward -= 2.0;
        } else if (state.distance > 300) {
            reward -= 1.0; // 離れすぎ
        }

        // 2. 攻撃成功報酬
        if (this.damageDealt > 0) {
            // プレイヤーへの攻撃は特大のご褒美 (10倍) 
            // 仲間（モンスター）への攻撃は「ペナルティ」にして禁止する
            let mult = state.isTargetPlayer ? 10.0 : -2.0;
            reward += this.damageDealt * mult;

            // 仲間がいれば連携ボーナス（プレイヤーを追っている時のみ）
            if (state.nearbyAllies > 0 && state.isTargetPlayer) {
                reward += 3.0;
            }

            this.damageDealt = 0;
        }

        // 3. スキル・回復報酬
        if (this.hpHealed > 0) {
            reward += this.hpHealed * 0.1; // 回復量に応じた報酬
            this.hpHealed = 0;
        }

        if (action === 'skill_heal') {
            if (state.hpPercent < 40) reward += 5.0; // ピンチでの回復を熱烈に推奨
            else if (state.hpPercent > 90) reward -= 3.0; // 満タンでの無駄遣いは厳禁
        }

        if (action === 'skill_buff') {
            if (state.distance < 300) reward += 2.0; // 敵が近い時のバフは評価
            else reward -= 1.0; // 誰もいない時のバフは無駄
        }

        // 4. 被ダメージペナルティ
        const hpLoss = this.startHp - this.enemy.hp;
        if (hpLoss > 0) {
            reward -= hpLoss * 0.01;
        }

        return reward;
    }

    /**
     * 行動を実行
     */
    executeAction(action, state) {
        if (!this.enemy.active || !state) return;

        const speed = this.enemy.speed || 50;
        let vx = 0;
        let vy = 0;

        switch (action) {
            case 'approach':
                // プレイヤーに接近
                vx = Math.cos(state.angle) * speed;
                vy = Math.sin(state.angle) * speed;
                break;

            case 'retreat':
                // プレイヤーから逃げる
                vx = -Math.cos(state.angle) * speed;
                vy = -Math.sin(state.angle) * speed;
                break;

            case 'circle_left':
                // 左に回り込む
                vx = Math.cos(state.angle + Math.PI / 2) * speed;
                vy = Math.sin(state.angle + Math.PI / 2) * speed;
                break;

            case 'circle_right':
                // 右に回り込む
                vx = Math.cos(state.angle - Math.PI / 2) * speed;
                vy = Math.sin(state.angle - Math.PI / 2) * speed;
                break;

            case 'aggressive':
                // 積極的攻撃（高速接近）
                vx = Math.cos(state.angle) * speed * 1.5;
                vy = Math.sin(state.angle) * speed * 1.5;
                break;

            case 'wait':
                vx = 0; vy = 0;
                break;

            case 'skill_attack':
                if (this.enemy.useSkill) this.enemy.useSkill('attack', state);
                vx = 0; vy = 0; // スキル詠唱中は足を止める
                break;

            case 'skill_heal':
                if (this.enemy.useSkill) this.enemy.useSkill('heal', state);
                vx = 0; vy = 0;
                break;

            case 'skill_buff':
                if (this.enemy.useSkill) this.enemy.useSkill('buff', state);
                vx = 0; vy = 0;
                break;
        }

        // 速度を設定
        if (this.enemy.body) {
            this.enemy.setVelocity(vx, vy);
        } else {
            console.warn(`[EnemyAI] No physics body for enemy ${this.enemy.type} at (${this.enemy.x}, ${this.enemy.y})`);
        }
    }

    /**
     * 死亡時の学習処理（即時実行）
     */
    onDeath() {
        if (this.lastState && this.lastAction) {
            // 逃げる癖を消すため、死の恐怖を大幅に減らす
            const reward = -3;
            const deathState = this.getState() || this.lastState;
            this.agent.update(this.lastState, this.lastAction, reward, deathState);
            this.agent.endEpisode();
            this.saveModel();

            this.lastState = null;
            this.lastAction = null;
        }
    }

    /**
     * ダメージを与えたことを通知
     */
    notifyDamageDealt(amount) {
        this.damageDealt += amount;
    }

    /**
     * 回復したことを通知
     */
    notifyHeal(amount) {
        this.hpHealed += amount;
    }

    /**
     * 更新処理（毎フレーム呼ばれる）
     */
    update(time, delta) {
        if (!this.enemy.active) return;

        // 生存時間を更新
        this.survivalTime += delta;

        // 行動実行の間隔チェック
        if (time - this.lastActionTime < this.actionInterval) {
            return;
        }
        this.lastActionTime = time;

        // 現在の状態を取得
        const currentState = this.getState();
        if (!currentState) return;

        // 前回の行動があれば学習
        if (this.lastState && this.lastAction && this.isTraining) {
            const reward = this.calculateReward(currentState, this.lastAction);
            this.agent.update(this.lastState, this.lastAction, reward, currentState);
        }

        // 次の行動を選択
        const action = this.agent.selectAction(currentState, this.isTraining);

        // 行動を実行
        this.executeAction(action, currentState);

        // 状態と行動を記録
        this.lastState = currentState;
        this.lastAction = action;
        this.startHp = this.enemy.hp;
    }

    /**
     * モデルを保存
     */
    saveModel() {
        if (typeof localStorage !== 'undefined') {
            const modelKey = `enemyAI_${this.enemy.type}`;
            const data = this.agent.save();
            localStorage.setItem(modelKey, data);

            // サーバー（共有学習）に同期
            this.syncWithShared();

            console.log(`[EnemyAI] Model saved and synced for ${this.enemy.type}`, this.agent.getStats());
        }
    }

    /**
     * モデルを読み込み
     */
    loadModel() {
        if (typeof localStorage !== 'undefined') {
            const modelKey = `enemyAI_${this.enemy.type}`;
            const data = localStorage.getItem(modelKey);
            if (data) {
                if (this.agent.load(data)) {
                    console.log(`[EnemyAI] Model loaded for ${this.enemy.type}`, this.agent.getStats());
                }
            }
        }
    }

    /**
     * 統計情報を取得
     */
    getStats() {
        return {
            ...this.agent.getStats(),
            survivalTime: (this.survivalTime / 1000).toFixed(1) + 's',
            isTraining: this.isTraining
        };
    }

    /**
     * 学習モードの切り替え
     */
    setTrainingMode(enabled) {
        this.isTraining = enabled;
    }
}
