/**
 * Q-Learning Agent for Enemy AI - 高性能版
 * より効率的な学習と強い敵の行動を実現
 */
export default class QLearningAgent {
    constructor(config = {}) {
        // 【高性能化】ハイパーパラメータを最適化
        this.learningRate = config.learningRate || 0.4;  // 学習率を上げる（0.1→0.4）  
        this.discountFactor = config.discountFactor || 0.99;  // 長期的報酬を重視（0.95→0.99）
        this.epsilon = config.epsilon || 0.2;  // 【改善】初期探索率: 0.4→0.2（より早く活用フェーズへ）
        this.epsilonDecay = config.epsilonDecay || 0.96;  // 【改善】探索率の減衰を速く: 0.992→0.96
        this.minEpsilon = config.minEpsilon || 0.05;  // 【改善】最小探索率を下げる: 0.15→0.05（活用フェーズで確定的）

        // Q-Table: state -> action -> value
        this.qTable = new Map();

        // 【改善】行動空間を最適化（逃げる・待つは削除、攻撃に特化）
        this.actions = [
            'approach',       // プレイヤーに接近
            'aggressive',     // 積極的攻撃（高速接近）
            'circle_left',    // 左に回り込む（フェイント）
            'circle_right',   // 右に回り込む（フェイント）
            'fast_approach',  // 超高速接近（体当たり）
            'attack_ready',   // 攻撃準備（距離調整）
            'skill_attack',   // 攻撃スキル
            'skill_heal',     // 回復スキル（ピンチのみ）
            'skill_buff'      // バフスキル
        ];

        // 統計情報【改善：フレームベースに変更】
        this.totalReward = 0;
        this.episodeCount = 0;
        this.updateCount = 0;  // 【新】学習フレーム数
        this.successCount = 0;  // 攻撃成功数
        this.lastSaveTime = Date.now();
        this.saveInterval = 5000;  // 5秒ごとにセーブ
    }

    /**
     * 状態を離散化してキーに変換【改善版：より精密】
     */
    getStateKey(state) {
        // 距離を細かく離散化 (0-30, 30-60, 60-100, 100-150, 150-250, 250+)
        const distBucket = state.distance < 30 ? 0 :
            state.distance < 60 ? 1 :
                state.distance < 100 ? 2 :
                    state.distance < 150 ? 3 :
                        state.distance < 250 ? 4 : 5;

        // HP割合を細かく離散化 (0-20%, 20-40%, 40-60%, 60-80%, 80-100%)
        const hpBucket = Math.floor(state.hpPercent / 20);

        // プレイヤーHP割合も細かく
        const playerHpBucket = Math.floor(state.playerHpPercent / 20);

        // 方向を離散化 (8方向)
        const angleBucket = Math.floor(((state.angle + Math.PI) / (2 * Math.PI)) * 8);

        // ターゲットがプレイヤーか (0 or 1)
        const targetType = state.isTargetPlayer ? 1 : 0;

        // 周囲の仲間の数
        const alliesBucket = Math.min(state.nearbyAllies || 0, 3);

        return `${distBucket}_${hpBucket}_${playerHpBucket}_${angleBucket}_${targetType}_${alliesBucket}`;
    }

    /**
     * Q値を取得【仕様変更：初期バイアスを戦略的に設定】
     */
    getQValue(state, action) {
        const stateKey = this.getStateKey(state);
        if (!this.qTable.has(stateKey)) {
            // 新しい状態の場合、行動ごとに異なる初期値を設定
            const actionValues = {};
            this.actions.forEach(a => {
                // 接近・攻撃系には正のバイアスを付ける（学習を加速）
                if (a === 'approach' || a === 'aggressive' || a === 'fast_approach' || a === 'attack_ready') {
                    actionValues[a] = 0.5;  // 攻撃系に+0.5のボーナス
                } else if (a === 'circle_left' || a === 'circle_right') {
                    actionValues[a] = 0.2;  // フェイントに+0.2
                } else {
                    actionValues[a] = 0;    // スキルは0
                }
            });
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
     * 最適な行動を選択（ε-greedy法）【改善版：複数最適行動の場合のハンドリング】
     */
    selectAction(state, isTraining = true) {
        // 探索 vs 活用
        if (isTraining && Math.random() < this.epsilon) {
            // ランダムに行動を選択（探索）
            // ただし接近系に重みを付ける
            const rand = Math.random();
            if (rand < 0.6) {
                // 60%の確率で接近/攻撃系を選ぶ
                const attackActions = ['approach', 'aggressive', 'fast_approach', 'attack_ready'];
                return attackActions[Math.floor(Math.random() * attackActions.length)];
            } else {
                // 40%の確率でランダム
                return this.actions[Math.floor(Math.random() * this.actions.length)];
            }
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

        // 【追加】プレイヤー検出範囲内で距離が攻撃レンジを超えている場合は
        //     よりアグレッシブな行動を強制するバイアス
        if (state && state.distance !== undefined &&
            state.detectRange !== undefined &&
            state.attackRange !== undefined &&
            state.distance < state.detectRange &&
            state.distance > state.attackRange) {
            const attackActions = ['approach', 'aggressive', 'fast_approach', 'attack_ready'];
            if (!attackActions.includes(bestAction)) {
                // Q値が他の行動を選んでも、強制的に接近アクションへ変換
                bestAction = 'approach';
            }
        }

        return bestAction;
    }

    /**
     * Q-Learningの更新【改善版：より大きな学習ステップ + updateCount追跡】
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

        // 統計更新【改善】
        this.totalReward += reward;
        this.updateCount++;  // 【新】学習フレーム数を増やす
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
     * 攻撃成功を記録
     */
    recordSuccess() {
        this.successCount++;
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
     * 統計情報を取得【改善版：リアルタイム統計】
     */
    getStats() {
        return {
            epsilon: this.epsilon.toFixed(3),
            episodeCount: this.episodeCount,
            updateCount: this.updateCount,  // 【新】学習フレーム数を表示
            avgReward: this.updateCount > 0 ? (this.totalReward / this.updateCount).toFixed(2) : 0,
            qTableSize: this.qTable.size,
            totalReward: this.totalReward.toFixed(2)  // 【新】累計報酬を表示
        };
    }
}
