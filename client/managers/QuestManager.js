import { QUESTS } from "../data/quests.js";
import { isAreaUnlocked } from "../utils/questGate.js";
import { isTeleportUnlocked } from '../utils/questGate.js';
import { getMapDisplayName } from '../data/maps.js';
import { getSaved, setSaved } from '../utils/saveStore.js';

export default class QuestManager {
    constructor(scene) {
        this.scene = scene;
        // localStorage または registry から読み込み
        this.quests = getSaved('playerQuests') || this.scene.registry.get('playerQuests') || {};
        this.listeners = [];
        console.log('[QuestManager] Initialized with quests:', this.quests);
    }

    setScene(scene) {
        this.scene = scene;
    }

    saveQuests() {
        this.scene.registry.set('playerQuests', this.quests);
        setSaved('playerQuests', this.quests);
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
        if (!def) return false;
        // 既に受注中・完了済みなら受注不可
        if (this.quests[id]) return false;
        if (!this.canStart(id)) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`「${def.title}」は、前のマップのクエストを全て達成すると受けられます`, 'error');
            }
            return false;
        }

        this.quests[id] = {
            ...def,
            progress: 0,
            status: 'active',
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
            const nextTeleport = (this.scene.teleports || []).find(tp => tp.targetMap && isTeleportUnlocked(this, tp));
            if (nextTeleport) {
                const destination = getMapDisplayName(nextTeleport.targetMap);
                this.scene.notificationUI.show(`次は「${destination}」への転移陣へ！水色の矢印を追ってください。`, 'info', 5000);
            }
        }
    }

    finishQuest(id) {
        const quest = this.quests[id];
        if (!quest || quest.status !== 'completed') return;

        console.log("Quest finished (reported):", id);

        // 報酬（EXP・ゴールド・アイテム）
        if (quest.reward && this.scene.player && this.scene.player.addReward) {
            this.scene.player.addReward(quest.reward);
        }

        // ユニークスキル報酬（jobExp コスト不要の強制習得）
        if (quest.reward?.skill && this.scene.player?.forceUnlockSkill) {
            this.scene.player.forceUnlockSkill(quest.reward.skill);
        }

        // リピートクエストならステータスをリセットして再受注可能にする
        if (quest.repeatable) {
            quest.status = 'active';
            quest.progress = 0;
            quest.completedCount = (quest.completedCount || 0) + 1;
            console.log(`Repeatable quest reset: ${id} (count: ${quest.completedCount})`);
            // repeat_count 型クエスト（永遠の狩人等）の進捗を進める
            this.onRepeatQuestCompleted();
            this.saveQuests();
            this.emitUpdate();
            return; // nextQuest チェーンは実行しない
        }

        quest.status = 'finished'; // 完了（報告済み）

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

    /**
     * リピートクエスト報告時に「repeat_count」型クエストの進捗を更新する。
     * 例: 永遠の狩人への道（リピートを累計50回で達成）
     */
    onRepeatQuestCompleted() {
        let updated = false;
        Object.values(this.quests).forEach(q => {
            if (q.status === 'active' && q.type === 'repeat_count') {
                q.progress++;
                updated = true;
                if (q.progress >= q.required) {
                    this.completeQuest(q.id);
                } else {
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

    onEnemyKilled(enemyType) {
        let updated = false;
        Object.values(this.quests).forEach(q => {
            if (q.status === 'active' && q.type === 'kill') {
                // target が配列の場合は includes、文字列の場合は一致判定を行う
                const isTargetMatched = Array.isArray(q.target)
                    ? q.target.includes(enemyType)
                    : q.target === enemyType;

                if (isTargetMatched) {
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
