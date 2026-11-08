import BaseGameScene from './BaseGameScene.js';
import AIStatsUI from '../ui/AIStatsUI.js';

export default class BattleScene extends BaseGameScene {
    constructor() {
        super('battle');
        this.player = null;
        this.cursors = null;
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
        this.bossSpawned = false;
        this.bossDefeated = false;

        // ボスはサーバー管理の敵として出現させる（spawnBoss参照）。
        // これにより、同じマップにいる全員に同じ個体が見え、撃破もパーティー内で共有される
        // （以前はクライアントローカルにEnemyを生成していたため、マルチプレイに対応しておらず、
        // 独自のdestroyイベント処理などが原因で撃破直後にフリーズすることがあった）。
        // 撃破通知はサーバーから "enemyDefeated" として全員にブロードキャストされるので、
        // ここで直接socketを購読して bossDefeated フラグを更新する。
        const socket = this.networkManager?.getSocket();
        this.onServerBossDefeated = (data) => {
            if (data.type !== 'boss') return;
            this.bossSpawned = false;
            this.bossDefeated = true;

            if (this.notificationUI) {
                this.notificationUI.show('ボスを撃破しました！NPCに報告してください。', 'success');
            }
            if (this.dialogue) {
                this.dialogue.showSystemMessage('ボスを撃破しました！NPCに報告してください。');
            }
        };
        if (socket) {
            socket.on('enemyDefeated', this.onServerBossDefeated);
            this.events.once('shutdown', () => socket.off('enemyDefeated', this.onServerBossDefeated));
            this.events.once('destroy', () => socket.off('enemyDefeated', this.onServerBossDefeated));
        }

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
    }

    spawnBoss() {
        if (this.bossSpawned) {
            console.warn('[BattleScene] Boss already spawned, skipping...');
            return;
        }

        console.log('[BattleScene] Requesting boss spawn from server...');
        this.bossSpawned = true;

        // サーバーにボスの出現を要求する。実際の生成・座標決定(boss_spawnレイヤー読込)・
        // 全員への同期は server/services/enemyService.js の spawnBossOnDemand が行う。
        // 通常の敵と同じ経路(enemySpawnedイベント)でクライアントに届くため、
        // entitySetup.js の spawnEnemyFromServer が衝突判定やサーバーAIの攻撃受信を
        // 自動的にセットアップしてくれる。
        this.networkManager.requestBossSpawn();

        // 通知
        if (this.notificationUI) {
            this.notificationUI.show('ボスが出現しました！', 'warning');
        }

        // ダイアログ表示
        this.dialogue.showSystemMessage('ボスが召喚されました！倒してください！');
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
        // ボスはサーバー管理の敵になったため、ここでの更新・HPチェックは不要
        // （撃破判定は create() で購読している "enemyDefeated" ソケットイベントで行う）。
    }
}
