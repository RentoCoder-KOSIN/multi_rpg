/**
 * Server-Side Enemy AI Manager
 * 各マップ・各敵タイプごとの強化学習AIを管理する
 * サーバーが起動している限り学習し続ける
 */
const ServerQLearning = require('./ServerQLearning');

// 敵の行動定数
const DETECT_RANGE = 300;
const ATTACK_RANGE = 60;
const SPEED = 50; // サーバー側の移動量（px/update）

/**
 * 2点間の距離
 */
function dist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 2点間の角度（ラジアン）
 */
function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

class EnemyAgentInstance {
    /**
     * @param {object} enemy     - サーバー内の敵オブジェクト
     * @param {ServerQLearning} agent - 敵タイプ共通のQ-Learningエージェント
     */
    constructor(enemy, agent) {
        this.enemy = enemy;
        this.agent = agent;

        this.lastState = null;
        this.lastAction = null;

        // パフォーマンス追跡
        this.damageDealt = 0;
        this.hpLoss = 0;
        this.lastHp = enemy.hp;
        this.lastDistance = Infinity;

        // 行動更新間隔（ms）
        this.actionInterval = 300;
        this.lastActionTime = Date.now();
    }

    /**
     * 状態を構築する
     * @param {object} players - マップ上の全プレイヤー { playerId: { x, y, hp, maxHp } }
     * @param {object} allies  - 同マップの他の敵    { enemyId: enemy }
     */
    buildState(players, allies) {
        // 最も近いプレイヤーを探す
        let nearestPlayer = null;
        let minDist = Infinity;

        Object.values(players).forEach(p => {
            if (!p || p.hp <= 0) return;
            const d = dist(this.enemy.x, this.enemy.y, p.x, p.y);
            if (d < minDist) {
                minDist = d;
                nearestPlayer = p;
            }
        });

        if (!nearestPlayer) return null;

        const a = angle(this.enemy.x, this.enemy.y, nearestPlayer.x, nearestPlayer.y);

        // 周囲の仲間数
        let nearbyAllies = 0;
        Object.values(allies).forEach(other => {
            if (!other || other.id === this.enemy.id) return;
            if (dist(this.enemy.x, this.enemy.y, other.x, other.y) < 150) nearbyAllies++;
        });

        const hpPercent = (this.enemy.hp / this.enemy.maxHp) * 100;
        const targetHpPercent = (nearestPlayer.hp / nearestPlayer.maxHp) * 100;

        return {
            distance: minDist,
            angle: a,
            hpPercent,
            targetHpPercent,
            nearbyAllies: Math.min(nearbyAllies, 3),
            detectRange: DETECT_RANGE,
            attackRange: ATTACK_RANGE,
            inDetectRange: minDist <= DETECT_RANGE,
            targetX: nearestPlayer.x,
            targetY: nearestPlayer.y,
            targetPlayerId: nearestPlayer.id
        };
    }

    /**
     * 行動を実行して dx, dy（px/秒）と attackフラグを返す
     * ※ 実際の移動量は呼び出し側で (actionInterval / 1000) を掛けること
     */
    executeAction(action, state) {
        const speed = SPEED; // px/秒
        let dx = 0, dy = 0;
        let shouldAttack = false;

        switch (action) {
            case 'approach':
                // 通常接近 (50 px/s)
                dx = Math.cos(state.angle) * speed;
                dy = Math.sin(state.angle) * speed;
                if (state.distance < ATTACK_RANGE) shouldAttack = true;
                break;

            case 'aggressive':
                // 積極的攻撃 (75 px/s)
                dx = Math.cos(state.angle) * speed * 1.5;
                dy = Math.sin(state.angle) * speed * 1.5;
                if (state.distance < ATTACK_RANGE) shouldAttack = true;
                break;

            case 'fast_approach':
                // 超高速接近 (100 px/s)
                dx = Math.cos(state.angle) * speed * 2.0;
                dy = Math.sin(state.angle) * speed * 2.0;
                if (state.distance < ATTACK_RANGE) shouldAttack = true;
                break;

            case 'attack_ready':
                if (state.distance > ATTACK_RANGE * 0.7) {
                    dx = Math.cos(state.angle) * speed * 0.8;
                    dy = Math.sin(state.angle) * speed * 0.8;
                } else {
                    shouldAttack = true;
                }
                break;

            case 'circle_left':
                dx = Math.cos(state.angle + Math.PI / 2) * speed;
                dy = Math.sin(state.angle + Math.PI / 2) * speed;
                break;

            case 'circle_right':
                dx = Math.cos(state.angle - Math.PI / 2) * speed;
                dy = Math.sin(state.angle - Math.PI / 2) * speed;
                break;

            case 'skill_attack':
                if (state.distance < ATTACK_RANGE * 2) shouldAttack = true;
                break;

            case 'skill_heal':
            case 'skill_buff':
            default:
                break;
        }

        return { dx, dy, shouldAttack, action };
    }

    /**
     * 1ステップ更新。移動差分と攻撃フラグを返す。
     * @param {object} players - マップ上の全プレイヤー
     * @param {object} allies  - 同マップの他の敵
     * @returns {{ dx, dy, shouldAttack, targetPlayerId } | null}
     */
    update(players, allies, isLearning = true) {
        const now = Date.now();
        if (now - this.lastActionTime < this.actionInterval) return null;
        this.lastActionTime = now;

        const state = this.buildState(players, allies);
        if (!state) {
            // プレイヤーがいない → スポーン地点に戻る (15 px/s)
            const homeAngle = angle(this.enemy.x, this.enemy.y, this.enemy.spawnX, this.enemy.spawnY);
            const d = dist(this.enemy.x, this.enemy.y, this.enemy.spawnX, this.enemy.spawnY);
            if (d > 10) {
                return {
                    dx: Math.cos(homeAngle) * SPEED * 0.3, // px/秒
                    dy: Math.sin(homeAngle) * SPEED * 0.3,
                    shouldAttack: false,
                    targetPlayerId: null
                };
            }
            return null;
        }

        // ----- 学習フェーズ（isLearning=false のときスキップ） -----
        if (isLearning && this.lastState && this.lastAction) {
            // HP変化を追跡
            this.hpLoss = Math.max(0, this.lastHp - this.enemy.hp);
            this.lastHp = this.enemy.hp;

            const reward = this.agent.calculateReward(
                this.lastState,
                this.lastAction,
                this.damageDealt,
                this.hpLoss
            );
            this.agent.update(this.lastState, this.lastAction, reward, state);
            this.damageDealt = 0;
        } else if (!isLearning) {
            // 学習OFF時もダメージカウンタはリセット（蓄積しない）
            this.damageDealt = 0;
            this.hpLoss = 0;
            this.lastHp = this.enemy.hp;
        }

        // ----- 行動選択 -----
        // 学習OFF時は ε=minEpsilon 固定（純粋な活用モード）
        const action = this.agent.selectAction(state, isLearning);

        // 検出範囲外ならゆっくりプレイヤーに接近 (15 px/s)
        let result;
        if (!state.inDetectRange) {
            result = {
                dx: Math.cos(state.angle) * SPEED * 0.3, // px/秒
                dy: Math.sin(state.angle) * SPEED * 0.3,
                shouldAttack: false,
                targetPlayerId: state.targetPlayerId,
                action: 'patrol'
            };
        } else {
            result = this.executeAction(action, state);
            result.targetPlayerId = state.targetPlayerId;
        }

        // ----- 状態記録 -----
        this.lastState = state;
        this.lastAction = action;
        this.lastDistance = state.distance;

        // ε減衰（学習ON時のみ適用）
        if (isLearning) {
            this.agent.epsilon = Math.max(this.agent.minEpsilon, this.agent.epsilon * 0.99999);
        }

        return result;
    }

    /**
     * 攻撃が当たったことを通知
     */
    notifyAttackHit(damage) {
        this.damageDealt += damage;
        this.agent.successCount++;
    }

    /**
     * 死亡時: 最後の負の報酬を与えてエピソード終了
     */
    onDeath() {
        if (this.lastState && this.lastAction) {
            this.agent.update(this.lastState, this.lastAction, -5, this.lastState);
            this.agent.endEpisode();
        }
    }
}

// ============================================================
// ServerEnemyAIManager
// 各マップの全敵インスタンスを管理し、学習を統括する
// ============================================================
class ServerEnemyAIManager {
    constructor() {
        // 敵タイプ別の共有エージェント
        this.agents = {};    // enemyType -> ServerQLearning

        // 敵インスタンス別のエージェントラッパー
        this.instances = {}; // enemyId -> EnemyAgentInstance

        // ===== 学習ON/OFFフラグ =====
        // true: 学習し続ける / false: 学習停止（既存Q-tableで行動のみ）
        this.isLearningEnabled = true;

        // 定期保存用
        this.lastSaveTime = Date.now();
        this.saveInterval = 10000; // 10秒ごと
    }

    /**
     * 敵タイプのエージェントを取得（なければ作成）
     */
    getAgent(enemyType) {
        if (!this.agents[enemyType]) {
            this.agents[enemyType] = new ServerQLearning({
                learningRate: 0.35,
                discountFactor: 0.99,
                epsilon: 0.4,
                epsilonDecay: 0.9995,
                minEpsilon: 0.08
            });
        }
        return this.agents[enemyType];
    }

    /**
     * 敵が生成されたときに登録
     */
    registerEnemy(enemy) {
        if (enemy.type === 'boss') return; // ボスは別ロジック
        const agent = this.getAgent(enemy.type);
        this.instances[enemy.id] = new EnemyAgentInstance(enemy, agent);
    }

    /**
     * 敵が削除されたときに登録解除
     */
    unregisterEnemy(enemyId) {
        if (this.instances[enemyId]) {
            this.instances[enemyId].onDeath();
            delete this.instances[enemyId];
        }
    }

    /**
     * 敵が攻撃ヒットしたことを通知
     */
    notifyAttackHit(enemyId, damage) {
        if (this.instances[enemyId]) {
            this.instances[enemyId].notifyAttackHit(damage);
        }
    }

    /**
     * 敵の1ステップ更新を実行し、移動差分を返す
     * @param {string} enemyId
     * @param {object} players  - { playerId: { x, y, hp, maxHp, id } }
     * @param {object} allies   - { enemyId: enemy }
     * @returns {{ dx, dy, shouldAttack, targetPlayerId } | null}
     */
    updateEnemy(enemyId, players, allies) {
        const inst = this.instances[enemyId];
        if (!inst) return null;
        return inst.update(players, allies);
    }

    /**
     * クライアントから受け取った学習データをマージ
     * （クライアント側でも学習している場合の集合知）
     */
    mergeClientData(enemyType, qTableData) {
        const agent = this.getAgent(enemyType);
        agent.mergeFrom(qTableData);
    }

    /**
     * 保存する学習データを返す
     * @returns {{ [enemyType]: { qTableData, timestamp } }}
     */
    toSaveData() {
        const result = {};
        Object.entries(this.agents).forEach(([type, agent]) => {
            result[type] = {
                qTableData: agent.toJSON(),
                timestamp: Date.now()
            };
        });
        return result;
    }

    /**
     * 保存済みデータからロード
     */
    loadFromData(savedData) {
        Object.entries(savedData).forEach(([type, entry]) => {
            const agent = this.getAgent(type);
            if (entry.qTableData) {
                const ok = agent.fromJSON(entry.qTableData);
                if (ok) {
                    console.log(`[ServerAI] Loaded agent for "${type}": qTableSize=${agent.qTable.size}, ε=${agent.epsilon.toFixed(4)}`);
                }
            }
        });
    }

    /**
     * 全エージェントの統計情報を返す
     */
    getAllStats() {
        const stats = {};
        Object.entries(this.agents).forEach(([type, agent]) => {
            stats[type] = agent.getStats();
        });
        return stats;
    }

    /**
     * 定期保存が必要かチェックし、必要なら保存コールバックを呼ぶ
     */
    checkAutoSave(saveFn) {
        const now = Date.now();
        if (now - this.lastSaveTime > this.saveInterval) {
            this.lastSaveTime = now;
            saveFn(this.toSaveData());
        }
    }
}

module.exports = { ServerEnemyAIManager, EnemyAgentInstance };
