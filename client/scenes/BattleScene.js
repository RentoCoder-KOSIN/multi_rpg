import BaseGameScene from './BaseGameScene.js';
import Enemy from '../entities/Enemy.js';
import AIStatsUI from '../ui/AIStatsUI.js';

export default class BattleScene extends BaseGameScene {
    constructor() {
        super('battle');
        this.player = null;
        this.cursors = null;
        this.boss = null;
        this.bossSpawned = false;
        this.bossDefeated = false;
    }

    getSceneConfig() {
        return {
            mapKey: 'battle',
            mapFile: 'assets/maps/battle.json',
            showQuestTracker: false,
            showDebugKey: false
        };
    }

    create(data) {
        // ベースクラスのcreateを呼び出し
        super.create(data);

        // BattleScene専用の初期化
        this.boss = null;
        this.bossSpawned = false;
        this.bossDefeated = false;

        // DialogueManagerのstartDialogueを拡張してボス召喚機能を追加
        const originalStartDialogue = this.dialogue.startDialogue.bind(this.dialogue);
        this.dialogue.startDialogue = (npc) => {
            // フラグを毎回リセット（UIバグ防止）
            this.dialogue.isTalking = false;
            this.dialogue.currentNPC = null;
            if (npc && npc.talking) npc.talking = false;
            console.log('[BattleScene] startDialogue called with NPC:', npc.name, 'bossNPC:', npc.bossNPC);
            console.log('[BattleScene] bossSpawned:', this.bossSpawned, 'bossDefeated:', this.bossDefeated);

            // ボス召喚NPCかどうかをチェック
            if (npc.bossNPC) {
                console.log('[BattleScene] Boss NPC detected!');

                // QuestManagerの状態を優先する
                // isCompleted（条件達成済み）か isFinished（報告済み）なら撃破済みとする
                const questCleared = this.questManager && (
                    this.questManager.isCompleted('brave_check') ||
                    this.questManager.isFinished('brave_check')
                );

                if (questCleared) {
                    this.bossDefeated = true;
                    this.bossSpawned = false;
                }


                // ボス未召喚の場合
                if (!this.bossSpawned && !this.bossDefeated) {
                    // クエストをまだ受けていない場合は、普通の会話（受注）を優先
                    if (this.questManager && !this.questManager.isStarted('brave_check')) {
                        console.log('[BattleScene] Quest not started, showing dialogue...');
                        originalStartDialogue(npc);
                        return;
                    }
                    console.log('[BattleScene] Spawning boss...');
                    this.spawnBoss();
                    return;
                }

                // ボス撃破後の報告処理
                if (this.bossDefeated && !this.bossSpawned) {
                    console.log('[BattleScene] Handling boss report...');
                    this.handleBossReport(npc);
                    return;
                }

                // ボス召喚中の場合
                if (this.bossSpawned && !this.bossDefeated) {
                    console.log('[BattleScene] Boss already spawned, showing message...');
                    this.dialogue.showSystemMessage('ボスを倒してください！');
                    return;
                }
            } else {
                console.log('[BattleScene] Not a boss NPC, using normal dialogue');
            }

            // 通常の対話処理
            originalStartDialogue(npc);
        };

        // NPCのbossNPCプロパティを確認
        console.log('[BattleScene] NPCs loaded:', this.npcs.map(npc => ({
            name: npc.name,
            bossNPC: npc.bossNPC
        })));

        // AI Stats UI
        this.aiStatsUI = new AIStatsUI(this);

        // 学習モード切り替え (Shift+T)
        this.input.keyboard.on('keydown-T', (event) => {
            if (event.shiftKey && this.boss && this.boss.ai) {
                this.boss.ai.setTrainingMode(!this.boss.ai.isTraining);
                const mode = this.boss.ai.isTraining ? 'ON' : 'OFF';
                if (this.notificationUI) {
                    this.notificationUI.show(`AI Training: ${mode}`, 'info');
                }
                console.log(`[BattleScene] AI Training mode: ${mode}`);
            }
        });
    }

    getBossSpawnPosition() {
        // boss_spawnレイヤーから位置を取得
        let bossSpawnLayer = null;
        let bossSpawnObjects = null;

        // 方法1: getObjectLayer を使用
        if (typeof this.map.getObjectLayer === 'function') {
            bossSpawnLayer = this.map.getObjectLayer('boss_spawn');
            if (bossSpawnLayer && bossSpawnLayer.objects) {
                bossSpawnObjects = bossSpawnLayer.objects;
            }
        }

        // 方法2: map.layers から直接検索
        if (!bossSpawnObjects && this.map.layers) {
            const layerData = this.map.layers.find(l => l.name === 'boss_spawn' && l.type === 'objectgroup');
            if (layerData && layerData.objects) {
                bossSpawnObjects = layerData.objects;
            }
        }

        // 方法3: objectsFromObjectLayer を使用
        if (!bossSpawnObjects && typeof this.map.objectsFromObjectLayer === 'function') {
            bossSpawnObjects = this.map.objectsFromObjectLayer('boss_spawn');
        }

        if (!bossSpawnObjects || !Array.isArray(bossSpawnObjects) || bossSpawnObjects.length === 0) {
            console.warn('[BattleScene] boss_spawn layer not found or empty! Using fallback position.');
            return { x: 400, y: 300 }; // フォールバック位置
        }

        // 最初のboss_spawnオブジェクトを使用
        const obj = bossSpawnObjects[0];
        // PlayerのsetOrigin(0.5, 1)を考慮して、中央下基準に補正
        const x = obj.x + (obj.width || 0) / 2;
        const y = obj.y + (obj.height || 0);

        console.log(`[BattleScene] Boss spawn position from boss_spawn: (${x}, ${y})`);
        return { x, y };
    }

    spawnBoss() {
        if (this.bossSpawned) {
            console.warn('[BattleScene] Boss already spawned, skipping...');
            return;
        }

        console.log('[BattleScene] spawnBoss() called');
        this.bossSpawned = true;

        // boss_spawnレイヤーから位置を取得
        const { x: bossX, y: bossY } = this.getBossSpawnPosition();
        console.log('[BattleScene] Boss spawn position:', bossX, bossY);

        try {
            // ボスを生成（Enemyクラスが自動的にサイズと当たり判定を調整する）
            this.boss = new Enemy(this, bossX, bossY, 'slime', 'boss', null, null, null);
            console.log('[BattleScene] Boss created successfully');


            // ボスが破壊された時の処理を追加
            this.boss.on('destroy', () => {
                if (this.boss && this.boss.hp <= 0) {
                    this.onBossDefeated();
                } else if (!this.bossDefeated) {
                    // 何らかの理由で撃破以外で消えた場合
                    this.bossSpawned = false;
                }
            });
        } catch (error) {
            console.error('[BattleScene] Error creating boss:', error);
            this.bossSpawned = false;
            return;
        }

        // マップとの衝突
        if (this.collidableLayers) {
            this.collidableLayers.forEach(layer => {
                this.physics.add.collider(this.boss, layer);
            });
        }

        // BattleScene.js
        this.physics.add.overlap(this.player, this.boss, () => {
            if (this.boss && this.boss.active && this.player.active) {
                const now = this.time.now;

                // 敵（ボス）がプレイヤーを攻撃
                if (!this.player.lastHitTime || now - this.player.lastHitTime > 1000) {
                    this.player.takeDamage(this.boss.atk);
                    this.player.lastHitTime = now;
                }
            }
        });

        // 通知
        if (this.notificationUI) {
            this.notificationUI.show('ボスが出現しました！', 'warning');
        }

        // ダイアログ表示
        this.dialogue.showSystemMessage('ボスが召喚されました！倒してください！');
    }

    onBossDefeated() {
        if (this.bossDefeated) return;

        this.bossDefeated = true;
        this.bossSpawned = false;
        this.boss = null;

        // クエスト進捗を更新
        if (this.questManager) {
            this.questManager.onEnemyKilled('boss');
        }

        // 通知
        if (this.notificationUI) {
            this.notificationUI.show('ボスを撃破しました！NPCに報告してください。', 'success');
        }

        // ダイアログ表示
        this.dialogue.showSystemMessage('ボスを撃破しました！NPCに報告してください。');
    }

    handleBossReport(npc) {
        // ボス撃破後の報告処理
        this.dialogue.chatText.setText('ボスを倒してくれてありがとう！これでテレポートが使えるようになりました。');
        this.dialogue.choiceText.setVisible(false);
        this.dialogue.continueText.setVisible(true);
        this.dialogue.showDialogueUI();
        this.dialogue.nameText.setText(npc.name || 'NPC');
        this.dialogue.nameText.setVisible(true);
        this.dialogue.nameBox.setVisible(true);

        // クエスト完了処理
        if (npc.questId && this.questManager) {
            // finishQuest を呼び出して報酬を付与し、状態を 'finished' にする
            if (this.questManager.isCompleted(npc.questId)) {
                this.questManager.finishQuest(npc.questId);
            }
            npc.is_Complited = true;
        }

        // テレポートを解除
        this.teleports.forEach(tp => {
            if (tp.requiredQuest === npc.questId || !tp.requiredQuest || tp.requiredQuest === 'false') {
                tp.unlocked = true;
            }
        });

        // 通知
        if (this.notificationUI) {
            this.notificationUI.show('テレポートが使えるようになりました！', 'success');
        }

        // 続けるボタンで閉じる
        const closeHandler = () => {
            this.dialogue.hideDialogueUI();
            this.dialogue.scene.input.keyboard.off('keydown-SPACE', closeHandler);
            this.dialogue.isTalking = false;
            npc.talking = false;
            this.dialogue.currentNPC = null;
        };
        this.dialogue.scene.input.keyboard.once('keydown-SPACE', closeHandler);
    }

    update(time, delta) {
        super.update(time, delta);

        // ボスの更新（ローカル管理の場合）
        if (this.boss && this.boss.active) {
            this.boss.update(time, delta);

            // スキル攻撃などでHPが0になった場合もチェック
            if (this.boss.hp <= 0) {
                this.onBossDefeated();
            }
        }
    }
}
