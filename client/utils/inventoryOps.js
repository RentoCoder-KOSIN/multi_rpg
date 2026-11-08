/**
 * インベントリ操作の共通ヘルパー（インベントリUI・ショップUIで共有）。
 * インベントリは { id, count } の配列。装備品（武器/防具/宝具）は count:1 のエントリが個別に並ぶ。
 */
import { ITEMS } from '../data/items.js';
import { ECONOMY_CONFIG } from '../gameConstants.js';

export const MAX_STACK_ACTION = 999; // 1回の操作で扱える上限（表示の桁あふれ防止）

export function entryId(entry) {
    return (typeof entry === 'string') ? entry : entry?.id;
}

export function entryCount(entry) {
    return (typeof entry === 'string') ? 1 : (entry?.count || 1);
}

/** そのアイテムIDを合計いくつ持っているか */
export function totalOwned(player, itemId) {
    return (player.stats.inventory || []).reduce(
        (sum, e) => sum + (entryId(e) === itemId ? entryCount(e) : 0), 0
    );
}

function isEquippedId(player, itemId) {
    const eq = player.stats.equipment || {};
    return eq.weapon === itemId || eq.armor === itemId || eq.relic === itemId;
}

/**
 * 捨てる/売るとき、装備中の1個を手放してしまわないか。
 * 同じ装備を2個以上持っているなら、余った分は手放せる。
 * @returns {number} 手放せる個数の上限（装備品でなければ所持数そのまま）
 */
export function removableCount(player, entry) {
    const id = entryId(entry);
    const count = entryCount(entry);
    if (!isEquippedId(player, id)) return count;
    const item = ITEMS[id];
    const isGear = item && (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory');
    if (!isGear) return count;
    // 装備品は1エントリ=1個。同じIDをあと何個持っているか（装備中の1個を除く）
    const others = totalOwned(player, id) - 1;
    return others > 0 ? Math.min(count, others) : 0;
}

/** 売却額（1個あたり）。price が無いアイテムは 0 = 売れない */
export function unitSellPrice(item) {
    return Math.floor((item?.price || 0) * ECONOMY_CONFIG.SELL_RATE);
}

/** インベントリの index 番目のエントリから count 個取り除く（0になれば枠ごと削除）。 */
export function removeFromInventory(player, index, count) {
    const inv = player.stats.inventory;
    const entry = inv[index];
    if (!entry) return false;
    if (typeof entry === 'string' || (entry.count || 1) <= count) {
        inv.splice(index, 1);
    } else {
        entry.count -= count;
    }
    return true;
}
