/**
 * Q-Learning Agent for Enemy AI
 * シンプルなQ-Learning実装で敵の行動を学習
 */
export default class QLearningAgent {
    constructor(config = {}) {
        // ハイパーパラメータ
        this.learningRate = config.learningRate || 0.1;  // 学習率
        this.discountFactor = config.discountFactor || 0.95;  // 割引率
        this.epsilon = config.epsilon || 0.3;  // 探索率（初期値）
        this.epsilonDecay = config.epsilonDecay || 0.995;  // 探索率の減衰
        this.minEpsilon = config.minEpsilon || 0.05;  // 最小探索率

        // Q-Table: state -> action -> value
        this.qTable = new Map();

        // 行動空間の定義
        this.actions = [
            'approach',      // プレイヤーに接近
            'retreat',       // プレイヤーから逃げる
            'circle_left',   // 左に回り込む
            'circle_right',  // 右に回り込む
            'wait',          // 待機
            'aggressive',    // 積極的攻撃
            'skill_attack',  // 攻撃スキル
            'skill_heal',    // 回復スキル
            'skill_buff'     // バフスキル
        ];

        // 統計情報
        this.totalReward = 0;
        this.episodeCount = 0;
    }

    /**
     * 状態を離散化してキーに変換
     */
    getStateKey(state) {
        // 距離を離散化 (0-50, 50-100, 100-200, 200+)
        const distBucket = state.distance < 50 ? 0 :
            state.distance < 100 ? 1 :
                state.distance < 200 ? 2 : 3;

        // HP割合を離散化 (0-25%, 25-50%, 50-75%, 75-100%)
        const hpBucket = Math.floor(state.hpPercent / 25);

        // プレイヤーのHP割合を離散化
        const playerHpBucket = Math.floor(state.playerHpPercent / 25);

        // 方向を離散化 (8方向)
        const angleBucket = Math.floor(((state.angle + Math.PI) / (2 * Math.PI)) * 8);

        // ターゲットがプレイヤーか (0 or 1)
        const targetType = state.isTargetPlayer ? 1 : 0;

        // 周囲の仲間の数 (0, 1, 2, 3+)
        const alliesBucket = state.nearbyAllies || 0;

        return `${distBucket}_${hpBucket}_${playerHpBucket}_${angleBucket}_${targetType}_${alliesBucket}`;
    }

    /**
     * Q値を取得
     */
    getQValue(state, action) {
        const stateKey = this.getStateKey(state);
        if (!this.qTable.has(stateKey)) {
            // 新しい状態の場合、全行動のQ値を0で初期化
            const actionValues = {};
            this.actions.forEach(a => actionValues[a] = 0);
            this.qTable.set(stateKey, actionValues);
        }
        return this.qTable.get(stateKey)[action];
    }

    /**
     * Q値を更新
     */
    setQValue(state, action, value) {
        const stateKey = this.getStateKey(state);
        if (!this.qTable.has(stateKey)) {
            const actionValues = {};
            this.actions.forEach(a => actionValues[a] = 0);
            this.qTable.set(stateKey, actionValues);
        }
        this.qTable.get(stateKey)[action] = value;
    }

    /**
     * 最適な行動を選択（ε-greedy法）
     */
    selectAction(state, isTraining = true) {
        // 探索 vs 活用
        if (isTraining && Math.random() < this.epsilon) {
            // ランダムに行動を選択（探索）
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        }

        // Q値が最大の行動を選択（活用）
        let bestAction = this.actions[0];
        let bestValue = this.getQValue(state, bestAction);

        for (let i = 1; i < this.actions.length; i++) {
            const action = this.actions[i];
            const value = this.getQValue(state, action);
            if (value > bestValue) {
                bestValue = value;
                bestAction = action;
            }
        }

        return bestAction;
    }

    /**
     * Q-Learningの更新
     */
    update(state, action, reward, nextState) {
        // 現在のQ値
        const currentQ = this.getQValue(state, action);

        // 次状態での最大Q値
        let maxNextQ = this.getQValue(nextState, this.actions[0]);
        for (let i = 1; i < this.actions.length; i++) {
            const nextQ = this.getQValue(nextState, this.actions[i]);
            if (nextQ > maxNextQ) {
                maxNextQ = nextQ;
            }
        }

        // Q値の更新: Q(s,a) = Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]
        const newQ = currentQ + this.learningRate * (reward + this.discountFactor * maxNextQ - currentQ);
        this.setQValue(state, action, newQ);

        // 統計更新
        this.totalReward += reward;
    }

    /**
     * エピソード終了時の処理
     */
    endEpisode() {
        // 探索率を減衰
        this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
        this.episodeCount++;
    }

    /**
     * 学習データを保存
     */
    save() {
        const data = {
            qTable: Array.from(this.qTable.entries()),
            epsilon: this.epsilon,
            totalReward: this.totalReward,
            episodeCount: this.episodeCount
        };
        return JSON.stringify(data);
    }

    /**
     * 学習データを読み込み
     */
    load(jsonString) {
        try {
            const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
            this.qTable = new Map(data.qTable);
            this.epsilon = data.epsilon;
            this.totalReward = data.totalReward;
            this.episodeCount = data.episodeCount;
            return true;
        } catch (e) {
            console.error('Failed to load Q-Learning data:', e);
            return false;
        }
    }

    /**
     * 外部データとマージして読み込み（共有学習用）
     */
    mergeLoad(data) {
        try {
            const remoteQTable = new Map(data.qTable);

            // リモートの知識を反映
            remoteQTable.forEach((actionValues, stateKey) => {
                if (this.qTable.has(stateKey)) {
                    // 両方にある状態は重み付け平均（リモートを少し優先）
                    const localActions = this.qTable.get(stateKey);
                    const mergedActions = {};

                    Object.keys(actionValues).forEach(action => {
                        const localQ = localActions[action] || 0;
                        const remoteQ = actionValues[action] || 0;
                        mergedActions[action] = localQ * 0.4 + remoteQ * 0.6;
                    });
                    this.qTable.set(stateKey, mergedActions);
                } else {
                    // 自分にない知識はそのまま採用
                    this.qTable.set(stateKey, actionValues);
                }
            });

            // 統計情報も適宜同期（最小Epsilonを採用）
            this.epsilon = Math.min(this.epsilon, data.epsilon);

            // Rewardなどは自分の累計に加算（平均統計用）
            // this.totalReward += data.totalReward;
            // this.episodeCount += data.episodeCount;

            return true;
        } catch (e) {
            console.error('Failed to merge Q-Learning data:', e);
            return false;
        }
    }

    /**
     * 統計情報を取得
     */
    getStats() {
        return {
            epsilon: this.epsilon.toFixed(3),
            episodeCount: this.episodeCount,
            avgReward: this.episodeCount > 0 ? (this.totalReward / this.episodeCount).toFixed(2) : 0,
            qTableSize: this.qTable.size
        };
    }
}
