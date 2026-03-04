import QLearningAgent from './QLearningAgent.js';
import { ENEMY_AI_CONFIG, PEER_LEARNING_CONFIG } from '../config.js';

/**
 * Enemy AI Controller
 * Q-Learningエージェントを使って敵の行動を制御
 */
export default class EnemyAI {
    constructor(enemy, config = {}) {
        this.enemy = enemy;
        this.scene = enemy.scene;

        // AI有効フラグ
        this.enabled = config.enabled !== undefined ? config.enabled : true;

        // Q-Learningエージェント
        this.agent = new QLearningAgent({
            learningRate: config.learningRate || 0.4,
            discountFactor: config.discountFactor || 0.99,
            epsilon: config.epsilon || 0.4,
            epsilonDecay: config.epsilonDecay || 0.992,
            minEpsilon: config.minEpsilon || 0.15
        });

        // 学習モード（本番環境ではfalseに）
        this.isTraining = config.isTraining !== undefined ? config.isTraining : true;

        // 前回の状態と行動（学習用）
        this.lastState = null;
        this.lastAction = null;

        // 行動実行の間隔（より頻繁に判断）
        this.actionInterval = config.actionInterval || 200; // 200ms ごとに行動判断
        this.lastActionTime = 0;

        // パフォーマンス追跡
        this.startHp = enemy.hp;
        this.damageDealt = 0;
        this.hpHealed = 0;
        this.survivalTime = 0;

        // 学習データの自動保存設定
        this.saveInterval = 3000;  // 3秒ごとに保存
        this.lastSaveTime = Date.now();

        // フレーム更新數を追跡（デバッグ用）
        this.frameCount = 0;
        // ピア学習設定【新】
        this.peerLearningEnabled = PEER_LEARNING_CONFIG.enabled;
        this.lastPeerShareTime = Date.now();
        this.sharedWithPeers = new Set(); // 共有した敵ID
        this.peersCount = 0; // 周囲の敵の数
        
        // 【改善】古い学習データをクリア（新しいEpsilon設定で再学習させる）
        // コメント解除してローカルストレージをリセットしたい場合は以下を有効化：
        // const modelKey = `enemyAI_${enemy.type}`;
        // if (typeof localStorage !== 'undefined' && localStorage.getItem(modelKey)) {
        //     console.log(`[EnemyAI] Clearing old model for ${enemy.type} - restarting with optimized epsilon`);
        //     localStorage.removeItem(modelKey);
        // }
        
        // 保存されたモデルを読み込み（localStorage）
        this.loadModel();

        // 共有学習のセットアップ
        this.setupSharedLearning();

        console.log(`[EnemyAI Init] ${enemy.type} AI initialized - actionInterval=${this.actionInterval}ms, training=${this.isTraining}`);
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
                // サーバーから受け取った内容はローカルにも保存しておく
                if (typeof localStorage !== 'undefined') {
                    const modelKey = `enemyAI_${this.enemy.type}`;
                    localStorage.setItem(modelKey, JSON.stringify(data.qTableData));
                }
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

        // ターゲットが見つからない場合は null を返す（例: プレイヤー非存在）
        if (!nearestTarget) {
            return null;
        }

        const distance = minDistance;
        const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, nearestTarget.x, nearestTarget.y);
        const inDetectRange = distance <= this.enemy.detectRange; // 視認内かどうか
        const hpPercent = (this.enemy.hp / this.enemy.maxHp) * 100;

        // ターゲットのHP割合
        let targetHpPercent = 100;
        if (nearestTarget === player) {
            targetHpPercent = (player.hp / player.maxHp) * 100;
        } else {
            targetHpPercent = (nearestTarget.hp / nearestTarget.maxHp) * 100;
        }

        // 周囲の仲間の数（連携用）
        const enemies = this.scene.networkManager?.getEnemies() || {};
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
            canHeal: hpPercent < 50,
            detectRange: this.enemy.detectRange,
            attackRange: this.enemy.attackRange,
            inDetectRange,
        };
    }

    /**
     * 報酬を計算【高性能版：より積極的な攻撃を学習】
     */
    calculateReward(state, action) {
        let reward = 0;

        // 【最重要】距離に基づく報酬（攻撃範囲内なら特に褒める）
        if (state.distance < 60) {
            // 攻撃範囲内
            reward += 5.0; // 大きな報酬
            
            // 攻撃系の行動をさらに褒める
            if (action === 'approach' || action === 'aggressive' || action === 'fast_approach') {
                reward += 8.0; // 攻撃系行動は特に褒める
            } else if (action === 'attack_ready') {
                reward += 6.0; // 攻撃準備も褒める
            } else if (action === 'skill_attack') {
                reward += 10.0; // スキル攻撃は最高報酬
            }
        } else if (state.distance < 100) {
            // 接近中
            reward += 2.0;
            if (action === 'approach' || action === 'aggressive') {
                reward += 4.0;
            } else if (action === 'fast_approach') {
                reward += 6.0; // 高速接近を特に推奨
            }
        } else if (state.distance < 150) {
            reward += 1.0; // 中距離もまあまあ
            
            if (action === 'aggressive' || action === 'fast_approach') {
                reward += 2.0;
            }
        } else if (state.distance > 250) {
            // 遠い場合はペナルティ
            reward -= 3.0;
        }

        // 【攻撃成功時は大報酬】
        if (this.damageDealt > 0) {
            let attackReward = 0;
            
            // プレイヤーへの攻撃は特大報酬
            if (state.isTargetPlayer) {
                attackReward = this.damageDealt * 20.0; // 20倍報酬
            } else {
                attackReward = -10; // 味方への攻撃は厳禁
            }
            
            reward += attackReward;

            // 連携ボーナス（仲間がいる時）
            if (state.nearbyAllies > 0 && state.isTargetPlayer) {
                reward += 10.0;
            }

            this.damageDealt = 0;
        }

        // 【距離の変化を追跡】プレイヤーに近づくことを徹底的に褒める
        if (this.lastDistance !== undefined) {
            const distChange = this.lastDistance - state.distance;
            
            if (distChange > 0) {
                // プレイヤーに近づいた
                reward += distChange * 0.5; // 近づきに応じた報酬
                
                // 特に接近系の行動を褒める
                if (action === 'approach' || action === 'aggressive' || action === 'fast_approach') {
                    reward += distChange * 1.0; // さらに加算
                }
            } else if (distChange < 0) {
                // プレイヤーから遠ざかった
                reward -= Math.abs(distChange) * 1.0; // 離れたときは厳しくペナルティ
                
                // 逃げるような行動をした場合は特に厳しく
                if (action === 'circle_left' || action === 'circle_right') {
                    reward -= 5.0;
                }
            }
        }
        this.lastDistance = state.distance;

        // 【追加】ターゲットが視界内にいるのに消極的な行動をとった場合はペナルティ
        if (state.distance < this.enemy.detectRange && state.distance > this.enemy.attackRange) {
            const aggressiveActions = ['approach', 'aggressive', 'fast_approach', 'attack_ready'];
            if (aggressiveActions.includes(action)) {
                reward += 5.0; // 明確に近づく行動は追加報酬
            } else {
                reward -= 3.0; // それ以外の行動（回り込み等）は減点
            }
        }

        // 【回復スキル】ピンチの時だけ推奨
        if (action === 'skill_heal') {
            if (state.hpPercent < 30) {
                reward += 8.0; // 危機的状況での回復は高く評価
            } else if (state.hpPercent > 70) {
                reward -= 8.0; // 元気な状態での回復は無駄
            }
            
            if (this.hpHealed > 0) {
                reward += this.hpHealed * 0.2;
                this.hpHealed = 0;
            }
        }

        // 【バフスキル】効果的なときだけ推奨
        if (action === 'skill_buff') {
            if (state.distance < 200 && state.isTargetPlayer) {
                reward += 5.0; // 敵が近い時は効果的
            } else {
                reward -= 5.0; // 遠すぎる時は無駄
            }
        }

        // 【被ダメージペナルティ】
        const hpLoss = this.startHp - this.enemy.hp;
        if (hpLoss > 0) {
            reward -= hpLoss * 0.05; // 受けたダメージは避けるべき
        }

        return reward;
    }

    /**
     * 行動を実行【高性能版：新しい行動タイプを追加】
     */
    executeAction(action, state) {
        if (!this.enemy.active || !state) return;

        const speed = this.enemy.speed || 50;
        let vx = 0;
        let vy = 0;
        const player = this.scene.player;

        switch (action) {
            case 'approach':
                // 通常接近
                vx = Math.cos(state.angle) * speed;
                vy = Math.sin(state.angle) * speed;
                
                // 攻撃範囲内なら攻撃
                if (state.distance < this.enemy.attackRange && player && player.active) {
                    this.enemy.attemptAttack(this.scene.time.now, player);
                }
                break;

            case 'aggressive':
                // 積極的攻撃（1.5倍速）
                vx = Math.cos(state.angle) * speed * 1.5;
                vy = Math.sin(state.angle) * speed * 1.5;
                
                // 攻撃範囲内なら攻撃
                if (state.distance < this.enemy.attackRange && player && player.active) {
                    this.enemy.attemptAttack(this.scene.time.now, player);
                }
                break;

            case 'fast_approach':
                // 【新】超高速接近（2倍速）
                vx = Math.cos(state.angle) * speed * 2.0;
                vy = Math.sin(state.angle) * speed * 2.0;
                
                // 攻撃範囲内なら即座に攻撃
                if (state.distance < this.enemy.attackRange && player && player.active) {
                    this.enemy.attemptAttack(this.scene.time.now, player);
                }
                break;

            case 'attack_ready':
                // 【新】攻撃準備（プレイヤーを狙うように位置調整）
                if (state.distance > this.enemy.attackRange * 0.8) {
                    // 攻撃範囲の手前で止まる
                    const adjustAngle = state.angle;
                    const targetDist = this.enemy.attackRange * 0.7;
                    const targetX = player.x - Math.cos(adjustAngle) * targetDist;
                    const targetY = player.y - Math.sin(adjustAngle) * targetDist;
                    
                    const dx = targetX - this.enemy.x;
                    const dy = targetY - this.enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 1) {
                        vx = (dx / dist) * speed * 0.8;
                        vy = (dy / dist) * speed * 0.8;
                    }
                } else {
                    // 既に攻撃範囲内なら停止して攻撃
                    vx = 0;
                    vy = 0;
                    if (player && player.active) {
                        this.enemy.attemptAttack(this.scene.time.now, player);
                    }
                }
                break;

            case 'circle_left':
                // 左に回り込み
                vx = Math.cos(state.angle + Math.PI / 2) * speed;
                vy = Math.sin(state.angle + Math.PI / 2) * speed;
                break;

            case 'circle_right':
                // 右に回り込み
                vx = Math.cos(state.angle - Math.PI / 2) * speed;
                vy = Math.sin(state.angle - Math.PI / 2) * speed;
                break;

            case 'skill_attack':
                if (this.enemy.useSkill) this.enemy.useSkill('attack', state);
                vx = 0; vy = 0;
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
            
            // 【デバッグ】移動コマンドが正しく実行されているか確認（50フレームごと）
            if (this.frameCount % 50 === 0) {
                console.log(`[Execute Action] ${this.enemy.type}: action=${action}, velocity=(${vx.toFixed(1)}, ${vy.toFixed(1)}), distance=${state.distance?.toFixed(0) || 'N/A:'}`);
            }
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
     * 更新処理（毎フレーム呼ばれる）【改善版：学習データを常に記録 + ピア学習】
     */
    update(time, delta) {
        if (!this.enemy.active) return;

        // AIが無効な場合は敵を停止させる
        if (!this.enabled) {
            if (this.enemy.body) {
                this.enemy.setVelocity(0, 0);
            }
            return;
        }

        // フレームカウントを増加
        this.frameCount++;

        // 生存時間を更新
        this.survivalTime += delta;

        // 【新】敵同士の学習共有（ピア学習）
        if (this.peerLearningEnabled && PEER_LEARNING_CONFIG.enabled) {
            this.shareLearningWithPeers(time);
        }

        // 行動実行の間隔チェック
        if (time - this.lastActionTime < this.actionInterval) {
            // フレーム間隔の際中も、定期的に学習データを自動保存
            this.autoSaveModel(time);
            return;
        }
        this.lastActionTime = time;

        // 現在の状態を取得（プレイヤーがいれば距離は問わない）
        const currentState = this.getState();
        
        // プレイヤーが全く存在しない場合は何もしない
        if (!currentState) {
            this.autoSaveModel(time);
            return;
        }

        // プレイヤー検出範囲外でも学習対象とするため、
        // default movement は状態がある限り報酬計算内で扱う。
        if (!currentState.inDetectRange) {
            // 検出範囲外ならゆっくりプレイヤーに近づく
            const player = this.scene.player;
            if (player && player.active) {
                const angle = Phaser.Math.Angle.Between(this.enemy.x, this.enemy.y, player.x, player.y);
                const speed = this.enemy.speed || 50;
                this.enemy.setVelocity(
                    Math.cos(angle) * speed * 0.3,
                    Math.sin(angle) * speed * 0.3
                );
            }
            // ここでも学習は続けるため return しない
        }

        // 前回の行動があれば学習
        if (this.lastState && this.lastAction && this.isTraining) {
            const reward = this.calculateReward(currentState, this.lastAction);
            this.agent.update(this.lastState, this.lastAction, reward, currentState);
            
            // 【デバッグ】学習が実際に行われているか確認
            if (this.frameCount % 50 === 0) { // 約50フレームごとにログ出力
                const stats = this.agent.getStats();
                console.log(`[EnemyAI Learning] ${this.enemy.type}: frames=${this.frameCount}, learning=${this.agent.updateCount}, reward=${reward.toFixed(2)}, action=${this.lastAction}, ε=${stats.epsilon.toFixed(3)}, qTableSize=${stats.qTableSize}`);
            }
        }

        // 次の行動を選択
        const action = this.agent.selectAction(currentState, this.isTraining);

        // 行動を実行
        this.executeAction(action, currentState);

        // 状態と行動を記録
        this.lastState = currentState;
        this.lastAction = action;
        this.startHp = this.enemy.hp;

        // 定期的に学習データを自動保存
        this.autoSaveModel(time);

        // ε（探索率）を行動ごとに少し減衰させる（連続学習でも収束しやすく）
        if (this.isTraining) {
            this.agent.epsilon = Math.max(this.agent.minEpsilon, this.agent.epsilon * this.agent.epsilonDecay);
        }
    }

    /**
     * 敵同士の学習共有（ピア学習）【新規メソッド】
     */
    shareLearningWithPeers(time) {
        if (time - this.lastPeerShareTime < PEER_LEARNING_CONFIG.dataShareInterval) {
            return; // 一定間隔でのみ共有
        }
        this.lastPeerShareTime = time;

        const enemies = this.scene.networkManager?.getEnemies() || {};
        const detectionRange = PEER_LEARNING_CONFIG.detectionRange;
        
        let nearbyEnemies = 0;

        // 近い敵を検出して学習データを共有
        Object.values(enemies).forEach(otherEnemy => {
            if (!otherEnemy || !otherEnemy.active || otherEnemy === this.enemy) {
                return; // 自分と死んだ敵は除外
            }

            const distance = Phaser.Math.Distance.Between(
                this.enemy.x, this.enemy.y,
                otherEnemy.x, otherEnemy.y
            );

            // 検出範囲内の敵と学習データを共有
            if (distance < detectionRange && otherEnemy.ai && otherEnemy.ai.agent) {
                nearbyEnemies++;

                // 相手の敵のデータをマージ
                const peerData = JSON.parse(otherEnemy.ai.agent.save());
                this.agent.mergeLoad(peerData);

                // 自分のデータも相手に送る（相互学習）
                const myData = JSON.parse(this.agent.save());
                otherEnemy.ai.agent.mergeLoad(myData);

                // ボーナス報酬を追加（連携しているため学習効率が上がる）
                if (this.lastState && this.lastAction) {
                    const bonusReward = PEER_LEARNING_CONFIG.rewardBonus;
                    this.agent.totalReward += bonusReward;
                    this.agent.updateCount++;
                }

                // デバッグログ
                if (Math.random() < 0.05) { // 5%の確率でログ出力
                    console.log(`[Peer Learning] ${this.enemy.type} ↔ ${otherEnemy.type}: distance=${distance.toFixed(0)}px, qTableSize=${this.agent.qTable.size}`);
                }
            }
        });

        this.peersCount = nearbyEnemies;
    }

    /**
     * 学習データを定期的に自動保存【新規メソッド】
     */
    autoSaveModel(time) {
        // 常にlocalStorageにも保存しつつ、サーバーにも同期
        // これでAIStatsUIがローカルの統計情報を読める
        if (time - this.lastSaveTime > this.saveInterval) {
            this.lastSaveTime = time;
            const modelKey = `enemyAI_${this.enemy.type}`;
            const data = this.agent.save();

            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(modelKey, data);
            }

            // サーバーに同期
            this.syncWithShared();
        }
    }

    /**
     * モデルを保存
     */
    saveModel() {
        const data = this.agent.save();
        const modelKey = `enemyAI_${this.enemy.type}`;

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(modelKey, data);
        }

        // 必ずサーバーに同期（serverSync=trueの場合は保存先になる）
        this.syncWithShared();

        const stats = this.agent.getStats();
        console.log(`[EnemyAI Model Saved] ${this.enemy.type}:`, {
            epsilon: stats.epsilon,
            qTableSize: stats.qTableSize,
            episodeCount: stats.episodeCount,
            avgReward: stats.avgReward
        });
    }

    /**
     * モデルを読み込み
     */
    loadModel() {
        // ローカル保存は常に読み込む（サーバー同期有効時でも補助的に使用）
        if (typeof localStorage !== 'undefined') {
            const modelKey = `enemyAI_${this.enemy.type}`;
            const data = localStorage.getItem(modelKey);
            if (data) {
                if (this.agent.load(data)) {
                    const stats = this.agent.getStats();
                    console.log(`[EnemyAI Model Loaded] ${this.enemy.type}:`, {
                        epsilon: stats.epsilon,
                        qTableSize: stats.qTableSize,
                        episodeCount: stats.episodeCount,
                        avgReward: stats.avgReward
                    });
                } else {
                    console.warn(`[EnemyAI] Failed to load model for ${this.enemy.type}`);
                }
            } else {
                console.log(`[EnemyAI] No saved model for ${this.enemy.type}, starting fresh`);
                // 空データを書き出しておく（統計表示のため）
                this.saveModel();
            }
        }
    }

    /**
     * 統計情報を取得【改善版：frameCount + peersCount を含める】
     */
    getStats() {
        return {
            ...this.agent.getStats(),
            survivalTime: (this.survivalTime / 1000).toFixed(1) + 's',
            frameCount: this.frameCount,  // 【新】フレーム数を表示
            peersCount: this.peersCount,  // 【新】ピア学習中の敵の数
            isTraining: this.isTraining
        };
    }

    /**
     * 学習モードの切り替え
     */
    setTrainingMode(enabled) {
        this.isTraining = enabled;
    }

    /**
     * AI有効/無効の切り替え
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        // 無効化時は敵を停止
        if (!enabled && this.enemy.body) {
            this.enemy.setVelocity(0, 0);
        }
    }
}
