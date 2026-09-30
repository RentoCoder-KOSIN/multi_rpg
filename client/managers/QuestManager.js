import { QUESTS } from "../data/quests.js";
import { isAreaUnlocked } from "../utils/questGate.js";

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

    // ownerScene を渡すと、そのシーンが shutdown/destroy された時点でリスナーを自動解除する。
    // （プレイヤー死亡時の scene.restart() などで古いUIのリスナーが残り続け、
    //  破棄済みの Phaser オブジェクトを触って例外→後続の処理が止まるバグの対策）
    onUpdate(cb, ownerScene = null) {
        this.listeners.push(cb);
        const off = () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
        if (ownerScene && ownerScene.events) {
            ownerScene.events.once('shutdown', off);
            ownerScene.events.once('destroy', off);
        }
        return off;
    }

    emitUpdate() {
        const quests = this.getActiveQuests();
        // 1つのリスナーが例外を投げても、他のリスナーと呼び出し元（クエスト進行・報告処理）を止めない。
        // 例外を出したリスナーは壊れている（破棄済みUI）可能性が高いので外す。
        [...this.listeners].forEach(cb => {
            try {
                cb(quests);
            } catch (e) {
                console.warn('[QuestManager] listener failed, removing it:', e);
                this.listeners = this.listeners.filter(l => l !== cb);
            }
        });
    }

    // マップ（area）付きのクエストは、前のマップのクエストを全て達成するまで受注できない
    canStart(id) {
        const def = QUESTS[id];
        if (!def) return false;
        return !def.area || isAreaUnlocked(this, def.area);
    }

    startQuest(id) {
        const def = QUESTS[id];
        if (!def || this.quests[id]) return false;
        if (!this.canStart(id)) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`「${def.title}」は、前のマップのクエストを全て達成すると受けられます`, 'error');
            }
            return false;
        }

        this.quests[id] = {
            ...def,
            progress: 0,
            status: 'active'
        };

        this.saveQuests();
        this.emitUpdate();
        return true;
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
