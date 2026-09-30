import { QUESTS } from '../data/quests.js';
import { isTeleportUnlocked } from '../utils/questGate.js';
import { getMapDisplayName } from '../data/maps.js';

const RECOMPUTE_INTERVAL_MS = 500;
const ARROW_RADIUS = 26;      // プレイヤーの足元を中心に、矢印を置く半径(px)
const LABEL_LINE_HEIGHT = 12; // ラベル1行ぶんの高さ

// 「次に何をすればいいか／どこに行けばいいか」を示すコンパス型インジケーター。
// 画面固定のHUDではなく、プレイヤーの足元（ワールド座標）に表示する。
//   金色の矢印: 目的（クエスト・NPC・討伐対象）
//   水色の矢印: 次に使える転移場所（行き先つき）
//
// 目的の優先順位:
//   1. 職業が未選択 (輪廻転生直後を含む) -> 職業選択NPCへ誘導
//   2. 報告待ち(達成済み)のクエストがあるNPC -> そこへ誘導
//   3. まだ受けていないクエストがあるNPC -> そこへ誘導
//   4. 進行中の討伐クエストの対象が近くにいる -> その敵へ誘導
//   該当なしなら非表示。
export default class ObjectiveIndicatorUI {
    constructor(scene) {
        this.scene = scene;

        this.objective = this.createMarker(0xffd700, '#ffffff');
        this.teleport = this.createMarker(0x00e5ff, '#9ff4ff');

        this._lastCompute = 0;
        this._objectiveTarget = null;
        this._teleportTarget = null;
    }

    // 矢印＋ラベルを1組作る（どちらもワールド座標で動かす）
    createMarker(color, textColor) {
        const scene = this.scene;
        const arrow = scene.add.triangle(0, 0, 0, -9, -7, 7, 7, 7, color, 1)
            .setStrokeStyle(2, 0x000000, 1)
            .setDepth(13)
            .setVisible(false);
        const label = scene.add.text(0, 0, '', {
            fontSize: '8px',
            fontFamily: '"Press Start 2P"',
            color: textColor,
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5, 0).setDepth(13).setVisible(false);

        // ミニマップには映さない
        if (scene.minimapCameraIgnore) scene.minimapCameraIgnore([arrow, label]);
        return { arrow, label };
    }

    update(time) {
        if (!this._lastCompute || time - this._lastCompute > RECOMPUTE_INTERVAL_MS) {
            this._lastCompute = time;
            this._objectiveTarget = this.findTarget();
            this._teleportTarget = this.findTeleportTarget();
        }

        const player = this.scene.player;
        if (!player || !player.active) {
            this.hideMarker(this.objective);
            this.hideMarker(this.teleport);
            return;
        }

        // プレイヤーの足元（当たり判定の下端）
        const feetX = player.x;
        const feetY = player.body ? player.body.bottom : player.y + 16;

        // ラベルは足元より下に縦積みする（矢印は足元を中心とした円周上）
        let labelRow = 0;
        labelRow = this.placeMarker(this.objective, this._objectiveTarget, feetX, feetY, labelRow);
        this.placeMarker(this.teleport, this._teleportTarget, feetX, feetY, labelRow);
    }

    hideMarker(marker) {
        marker.arrow.setVisible(false);
        marker.label.setVisible(false);
    }

    // 戻り値: 次のマーカーが使うラベル行番号
    placeMarker(marker, target, feetX, feetY, labelRow) {
        if (!target) {
            this.hideMarker(marker);
            return labelRow;
        }

        const dx = target.x - feetX;
        const dy = target.y - feetY;
        const angle = Math.atan2(dy, dx);
        const distance = Math.round(Math.hypot(dx, dy) / 32); // タイル数の目安

        marker.arrow
            .setPosition(feetX + Math.cos(angle) * ARROW_RADIUS, feetY + Math.sin(angle) * ARROW_RADIUS)
            .setRotation(angle + Math.PI / 2)
            .setVisible(true);

        marker.label
            .setPosition(feetX, feetY + 30 + labelRow * LABEL_LINE_HEIGHT)
            .setText(`${target.label} (${distance}m)`)
            .setVisible(true);

        return labelRow + 1;
    }

    // 次に使える転移場所（解放済みで、今いるマップ以外へ行けるもの）のうち一番近いもの
    findTeleportTarget() {
        const scene = this.scene;
        const player = scene.player;
        const qm = scene.questManager;
        const teleports = scene.teleports || [];
        if (!player || !qm) return null;

        let best = null;
        let bestDist = Infinity;
        teleports.forEach(tp => {
            if (!tp.targetMap) return;

            if (!isTeleportUnlocked(qm, tp)) return;

            // ローカルの座標系はTiledのオブジェクト左上なので、中心に補正して距離を測る
            const cx = tp.x + (tp.width || 32) / 2;
            const cy = tp.y + (tp.height || 32) / 2;
            const d = Phaser.Math.Distance.Between(player.x, player.y, cx, cy);
            if (d < bestDist) {
                bestDist = d;
                const name = getMapDisplayName(tp.targetMap); // 表示名はサーバーのマップ情報（Tiledの displayName）から
                // 単なる行き先表示ではなく、進行後に何をすべきかが分かる文言にする。
                best = { x: cx, y: cy, label: `次は ${name}へ: 転移陣` };
            }
        });
        return best;
    }

    findTarget() {
        const scene = this.scene;
        const player = scene.player;
        const qm = scene.questManager;
        if (!player || !player.stats || !qm) return null;

        const npcs = scene.npcs || [];

        // 1. 職業未選択なら、職業選択NPCへ誘導（初回選択・輪廻転生後の再選択どちらもカバー）
        if (player.stats.job === 'none') {
            const jobNpc = npcs.find(n => n.jobs || n.jobQuest);
            if (jobNpc) return { x: jobNpc.x, y: jobNpc.y, label: `${jobNpc.name || 'NPC'}: 職業を選ぼう` };
        }

        // 2. 報告待ち（達成済み）のクエストを優先
        for (const npc of npcs) {
            const qid = this.resolveQuestChain(npc.questId);
            if (qid && qm.isCompleted(qid)) {
                const title = qm.quests[qid]?.title || qid;
                return { x: npc.x, y: npc.y, label: `${npc.name || 'NPC'}: ${title}を報告` };
            }
        }

        // 3. まだ受けていないクエストがあるNPC
        for (const npc of npcs) {
            const qid = this.resolveQuestChain(npc.questId);
            if (qid && !qm.isStarted(qid) && !qm.isCompleted(qid) && !qm.isFinished(qid)) {
                const def = QUESTS[qid];
                return { x: npc.x, y: npc.y, label: `${npc.name || 'NPC'}: ${def?.title || qid}を受注` };
            }
        }

        // 4. 進行中の討伐クエストがあれば、対象がこのマップ上にいないか探す
        const activeKillQuest = Object.values(qm.quests).find(q => q.status === 'active' && q.type === 'kill');
        if (activeKillQuest) {
            const enemies = scene.networkManager?.getEnemies() || {};
            let nearest = null;
            let nearestDist = Infinity;
            Object.values(enemies).forEach(enemy => {
                if (!enemy || !enemy.active || enemy.type !== activeKillQuest.target) return;
                const d = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = enemy;
                }
            });
            if (nearest) {
                return {
                    x: nearest.x,
                    y: nearest.y,
                    label: `${activeKillQuest.title}: ${activeKillQuest.progress}/${activeKillQuest.required}`
                };
            }
        }

        return null;
    }

    // NPCのquestIdが既に報告済みなら、次のクエストへ辿る（DialogueManagerと同じロジック）
    resolveQuestChain(questId) {
        if (!questId) return null;
        const qm = this.scene.questManager;
        let qid = String(questId).trim();
        while (qm.isFinished(qid) && QUESTS[qid]?.nextQuest) {
            qid = QUESTS[qid].nextQuest;
        }
        return qid;
    }

    destroy() {
        [this.objective, this.teleport].forEach(m => {
            if (m && m.arrow) m.arrow.destroy();
            if (m && m.label) m.label.destroy();
        });
    }
}
