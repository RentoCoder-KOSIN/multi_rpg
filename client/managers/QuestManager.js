import { QUESTS } from "../data/quests.js";

export default class QuestManager {
    constructor(scene) {
        this.scene = scene;
        // localStorage または registry から読み込み
        this.quests = JSON.parse(localStorage.getItem('playerQuests')) || this.scene.registry.get('playerQuests') || {};
        this.listeners = [];
        console.log('[QuestManager] Initialized with quests:', this.quests);
    }

    setScene(scene) {
        this.scene = scene;
    }

    saveQuests() {
        this.scene.registry.set('playerQuests', this.quests);
        localStorage.setItem('playerQuests', JSON.stringify(this.quests));
    }

    onUpdate(cb) {
        this.listeners.push(cb);
    }

    emitUpdate() {
        this.listeners.forEach(cb => cb(this.getActiveQuests()));
    }

    startQuest(id) {
        const def = QUESTS[id];
        if (!def || this.quests[id]) return;

        this.quests[id] = {
            ...def,
            progress: 0,
            status: 'active'
        };

        this.saveQuests();
        this.emitUpdate();
    }

    completeQuest(id) {
        const quest = this.quests[id];
        if (!quest || quest.status !== 'active') return;

        console.log("Quest condition met:", id);
        quest.status = 'completed'; // 達成済み（報告待ち）
        this.saveQuests();
        this.emitUpdate();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`クエスト「${quest.title}」達成！報告してください。`, 'warning');
        }
    }

    finishQuest(id) {
        const quest = this.quests[id];
        if (!quest || quest.status !== 'completed') return;

        console.log("Quest finished (reported):", id);
        quest.status = 'finished'; // 完了（報告済み）

        // 報酬
        if (quest.reward && this.scene.player && this.scene.player.addReward) {
            this.scene.player.addReward(quest.reward);
        }

        // NPCの状態を更新
        if (this.scene.npcs) {
            this.scene.npcs.forEach(npc => {
                if (String(npc.questId) === String(id)) {
                    npc.is_Complited = true;
                }
            });
        }

        // 次のクエストがあれば自動開始
        if (quest.nextQuest && QUESTS[quest.nextQuest]) {
            console.log("Starting next quest in chain:", quest.nextQuest);
            this.startQuest(quest.nextQuest);
        }

        this.saveQuests();
        this.emitUpdate();
    }

    onEnemyKilled(enemyType) {
        let updated = false;
        Object.values(this.quests).forEach(q => {
            if (q.status === 'active' && q.type === 'kill' && q.target === enemyType) {
                q.progress++;
                updated = true;
                if (q.progress >= q.required) {
                    this.completeQuest(q.id); // 条件達成でクリア
                } else {
                    // 進捗通知
                    if (this.scene.notificationUI) {
                        this.scene.notificationUI.show(`${q.title}: ${q.progress}/${q.required}`, 'info', 2000);
                    }
                }
            }
        });
        if (updated) {
            this.saveQuests();
            this.emitUpdate();
        }
    }

    isStarted(id) {
        return !!this.quests[id];
    }

    isCompleted(id) {
        return this.quests[id]?.status === 'completed';
    }

    isFinished(id) {
        return this.quests[id]?.status === 'finished';
    }

    getActiveQuests() {
        // 表示用に「報告済み」以外のクエスト、または全履歴を返す（現状は全件）
        return Object.values(this.quests).filter(q => q.status !== 'finished');
    }
}
