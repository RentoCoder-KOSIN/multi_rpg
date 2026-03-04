/**
 * Server-Side Q-Learning Agent
 * Node.js (CommonJS) 用の強化学習エンジン
 * サーバーが稼働している間ずっと学習し続ける
 */
class ServerQLearning {
    constructor(config = {}) {
        this.learningRate = config.learningRate || 0.35;
        this.discountFactor = config.discountFactor || 0.99;
        this.epsilon = config.epsilon || 0.4;
        this.epsilonDecay = config.epsilonDecay || 0.9995; // サーバー側はゆっくり収束
        this.minEpsilon = config.minEpsilon || 0.08;

        // Q-Table: stateKey -> { action -> qValue }
        this.qTable = new Map();

        // 行動空間（クライアント側と同じ）
        this.actions = [
            'approach',       // 通常接近
            'aggressive',     // 積極的攻撃（1.5倍速）
            'fast_approach',  // 超高速接近（2倍速）
            'attack_ready',   // 攻撃準備（射程調整）
            'circle_left',    // 左に回り込む
            'circle_right',   // 右に回り込む
            'skill_attack',   // 攻撃スキル
            'skill_heal',     // 回復スキル
            'skill_buff'      // バフスキル
        ];

        // 統計
        this.totalReward = 0;
        this.episodeCount = 0;
        this.updateCount = 0;
        this.successCount = 0; // 攻撃ヒット数
    }

    /**
     * 状態を離散キーに変換（クライアントと同じロジック）
     */
    getStateKey(state) {
        // 距離バケット (0-30, 30-60, 60-100, 100-150, 150-250, 250+)
        const distBucket =
            state.distance < 30 ? 0 :
                state.distance < 60 ? 1 :
                    state.distance < 100 ? 2 :
                        state.distance < 150 ? 3 :
                            state.distance < 250 ? 4 : 5;

        // 自分のHP割合バケット (20%区切り)
        const hpBucket = Math.min(4, Math.floor(state.hpPercent / 20));

        // ターゲットのHP割合バケット
        const targetHpBucket = Math.min(4, Math.floor(state.targetHpPercent / 20));

        // 方向バケット (8方向)
        const angleBucket = Math.floor(((state.angle + Math.PI) / (2 * Math.PI)) * 8) % 8;

        // 周囲の仲間の数 (max 3)
        const alliesBucket = Math.min(state.nearbyAllies || 0, 3);

        return `${distBucket}_${hpBucket}_${targetHpBucket}_${angleBucket}_${alliesBucket}`;
    }

    /**
     * Q値を取得（初回は初期バイアスを設定）
     */
    getQValue(state, action) {
        const key = this.getStateKey(state);
        if (!this.qTable.has(key)) {
            const vals = {};
            this.actions.forEach(a => {
                if (['approach', 'aggressive', 'fast_approach', 'attack_ready'].includes(a)) {
                    vals[a] = 0.5; // 攻撃系に初期バイアス
                } else if (['circle_left', 'circle_right'].includes(a)) {
                    vals[a] = 0.2;
                } else {
                    vals[a] = 0.0;
                }
            });
            this.qTable.set(key, vals);
        }
        return this.qTable.get(key)[action] ?? 0;
    }

    /**
     * Q値を設定
     */
    setQValue(state, action, value) {
        const key = this.getStateKey(state);
        if (!this.qTable.has(key)) {
            const vals = {};
            this.actions.forEach(a => vals[a] = 0);
            this.qTable.set(key, vals);
        }
        this.qTable.get(key)[action] = value;
    }

    /**
     * ε-greedy 行動選択
     */
    selectAction(state) {
        if (Math.random() < this.epsilon) {
            // 探索フェーズ：接近行動を重点的に探索
            const rand = Math.random();
            if (rand < 0.6) {
                const attackActions = ['approach', 'aggressive', 'fast_approach', 'attack_ready'];
                return attackActions[Math.floor(Math.random() * attackActions.length)];
            }
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }

        // 活用フェーズ：最大Q値の行動を選択
        let bestAction = this.actions[0];
        let bestValue = this.getQValue(state, bestAction);
        for (let i = 1; i < this.actions.length; i++) {
            const v = this.getQValue(state, this.actions[i]);
            if (v > bestValue) {
                bestValue = v;
                bestAction = this.actions[i];
            }
        }

        // 視野内でまだ射程外の場合は接近行動を強制
        if (state.distance !== undefined &&
            state.distance < state.detectRange &&
            state.distance > state.attackRange) {
            const aggActions = ['approach', 'aggressive', 'fast_approach', 'attack_ready'];
            if (!aggActions.includes(bestAction)) {
                bestAction = 'approach';
            }
        }

        return bestAction;
    }

    /**
     * Q値更新（Q-Learning ベルマン方程式）
     */
    update(state, action, reward, nextState) {
        const currentQ = this.getQValue(state, action);

        // 次状態の最大Q値
        let maxNextQ = this.getQValue(nextState, this.actions[0]);
        for (let i = 1; i < this.actions.length; i++) {
            const v = this.getQValue(nextState, this.actions[i]);
            if (v > maxNextQ) maxNextQ = v;
        }

        // Q(s,a) ← Q(s,a) + α[r + γ·maxQ(s',a') - Q(s,a)]
        const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
        this.setQValue(state, action, newQ);

        this.totalReward += reward;
        this.updateCount++;
    }

    /**
     * エピソード終了（敵の死亡など）
     */
    endEpisode() {
        this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
        this.episodeCount++;
    }

    /**
     * 報酬計算
     */
    calculateReward(state, action, damageDealt, hpLoss) {
        let reward = 0;

        // 距離に基づく報酬
        if (state.distance < 60) {
            reward += 5.0;
            if (['approach', 'aggressive', 'fast_approach'].includes(action)) reward += 8.0;
            else if (action === 'attack_ready') reward += 6.0;
            else if (action === 'skill_attack') reward += 10.0;
        } else if (state.distance < 100) {
            reward += 2.0;
            if (['approach', 'aggressive'].includes(action)) reward += 4.0;
            else if (action === 'fast_approach') reward += 6.0;
        } else if (state.distance < 150) {
            reward += 1.0;
            if (['aggressive', 'fast_approach'].includes(action)) reward += 2.0;
        } else if (state.distance > 250) {
            reward -= 3.0;
        }

        // 攻撃成功時の報酬
        if (damageDealt > 0) {
            reward += damageDealt * 20.0;
            if (state.nearbyAllies > 0) reward += 10.0; // 連携ボーナス
        }

        // 視野内で逃げる行動にペナルティ
        if (state.distance < state.detectRange && state.distance > state.attackRange) {
            if (['approach', 'aggressive', 'fast_approach', 'attack_ready'].includes(action)) {
                reward += 5.0;
            } else {
                reward -= 3.0;
            }
        }

        // 回避行動（circle）に追加ペナルティ
        if (['circle_left', 'circle_right'].includes(action) && state.distance > 100) {
            reward -= 5.0;
        }

        // スキル回復はピンチ時のみ許容
        if (action === 'skill_heal') {
            if (state.hpPercent < 30) reward += 8.0;
            else if (state.hpPercent > 70) reward -= 8.0;
        }

        // バフスキルは接近時のみ許容
        if (action === 'skill_buff') {
            if (state.distance < 200) reward += 5.0;
            else reward -= 5.0;
        }

        // 被ダメージペナルティ
        if (hpLoss > 0) reward -= hpLoss * 0.05;

        return reward;
    }

    /**
     * 別エージェントのQ-tableをマージ（共有学習用）
     */
    mergeFrom(otherData) {
        try {
            const remoteQTable = new Map(otherData.qTable);
            remoteQTable.forEach((actionValues, key) => {
                if (this.qTable.has(key)) {
                    const local = this.qTable.get(key);
                    const merged = {};
                    Object.keys(actionValues).forEach(a => {
                        merged[a] = (local[a] || 0) * 0.4 + (actionValues[a] || 0) * 0.6;
                    });
                    this.qTable.set(key, merged);
                } else {
                    this.qTable.set(key, actionValues);
                }
            });
            // 共有元の方が学習が進んでいればεを採用
            if (otherData.epsilon < this.epsilon) {
                this.epsilon = otherData.epsilon;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 保存用JSONオブジェクトを生成
     */
    toJSON() {
        return {
            qTable: Array.from(this.qTable.entries()),
            epsilon: this.epsilon,
            totalReward: this.totalReward,
            episodeCount: this.episodeCount,
            updateCount: this.updateCount
        };
    }

    /**
     * JSONオブジェクトからロード
     */
    fromJSON(data) {
        try {
            this.qTable = new Map(data.qTable || []);
            this.epsilon = data.epsilon ?? this.epsilon;
            this.totalReward = data.totalReward ?? 0;
            this.episodeCount = data.episodeCount ?? 0;
            this.updateCount = data.updateCount ?? 0;
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 統計情報を取得
     */
    getStats() {
        return {
            epsilon: this.epsilon.toFixed(4),
            episodeCount: this.episodeCount,
            updateCount: this.updateCount,
            qTableSize: this.qTable.size,
            totalReward: this.totalReward.toFixed(2),
            avgReward: this.updateCount > 0
                ? (this.totalReward / this.updateCount).toFixed(3)
                : '0.000'
        };
    }
}

module.exports = ServerQLearning;
