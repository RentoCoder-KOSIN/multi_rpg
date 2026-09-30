/**
 * クエストによる進行の解放判定（転移・クエスト受注で共通）。
 *
 * Tiled の Teleports の requiredQuest には、クエストIDを1つ、またはカンマ区切りで複数書ける。
 * 複数の場合は「全て」達成（達成済み=報告待ち、または報告済み）しないと通れない。
 *   例: "kill_forest_slime,forest_skeleton_hunt,forest_boss_quest"
 */
import { QUESTS, MAP_CLEAR_QUESTS, previousArea } from '../data/quests.js';

/** requiredQuest の文字列 → クエストIDの配列（空・'false' は「条件なし」= 空配列） */
export function parseRequiredQuests(value) {
    if (!value || value === 'false') return [];
    return String(value).split(',').map(s => s.trim()).filter(Boolean);
}

function isDone(qm, id) {
    return qm.isFinished(id) || qm.isCompleted(id);
}

/** requiredQuest のうち、まだ達成していないクエストID */
export function getMissingQuests(qm, requiredQuest) {
    return parseRequiredQuests(requiredQuest).filter(id => !isDone(qm, id));
}

/** その転移が今通れるか（unlocked が true、または必要クエストを全て達成） */
export function isTeleportUnlocked(qm, tp) {
    if (tp.unlocked) return true;
    if (!tp.requiredQuest) return true;
    if (!qm) return false;
    return getMissingQuests(qm, tp.requiredQuest).length === 0;
}

/** 通れない理由を人が読める短文にする（未達成クエストのタイトルを並べる） */
export function describeMissingQuests(qm, requiredQuest) {
    const titles = getMissingQuests(qm, requiredQuest).map(id => QUESTS[id]?.title || id);
    return titles.length ? `未達成: ${titles.join(' / ')}` : '';
}

/** そのマップ（area）のクエストを受注できるか。前のマップのクリアクエストを全て達成していれば true */
export function isAreaUnlocked(qm, area) {
    const prev = previousArea(area);
    if (!prev) return true;
    return (MAP_CLEAR_QUESTS[prev] || []).every(id => isDone(qm, id));
}
