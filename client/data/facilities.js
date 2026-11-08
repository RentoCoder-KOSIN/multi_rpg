/**
 * マップ上の施設（鍛冶屋・武器屋・防具屋・雑貨屋・クエストボードなど）の「種類」の定義。
 * 配置と設定は Tiled で行う。ここは「どんな種類の施設があるか」だけを持つ。
 *
 * ■ 施設を置く手順（Tiled）
 *   1. マップに オブジェクトレイヤー「FacilityTrigger」を作る（グループの中でもOK）
 *   2. 四角形オブジェクトを、施設の入口あたりに置く（プレイヤーが重なる範囲）
 *   3. オブジェクトにカスタムプロパティを付ける
 *        facility  (string) 必須  施設の種類。下の FACILITY_TYPES のキー
 *        shop      (string)       facility=shop のとき、data/shops.js の SHOP_LOADOUTS のキー
 *        category  (string)       facility=shop のとき weapon / armor / item で品揃えを絞る（省略可）
 *        label     (string)       地面に出す看板の文字。省略時はオブジェクト名 → 種類の既定名（shopは店名）
 *        icon      (string)       看板の絵文字。省略時は種類の既定。空文字で絵文字なし
 *        color     (string)       枠と看板の色 "#ff8844" 形式。省略時は種類の既定
 *        showLabel (bool)         false で看板と枠を非表示（判定だけ残す）
 *
 * ■ 新しい種類の施設を足す（コード側）
 *   FACILITY_TYPES に1エントリ足す。開くUIは scene[ui] のメソッド method(...args) を呼ぶ。
 *   そのUIをシーンがまだ持っていないときは scenes/base/facilities.js の UI_FACTORIES に生成方法を足す。
 */
import { getShopLoadout } from './shops.js';

export const FACILITY_LAYER_NAME = 'FacilityTrigger';
export const FACILITY_INTERACT_KEY = 'E';
export const FACILITY_PROMPT_INTERVAL_MS = 3000;

export const FACILITY_TYPES = {
    // 鍛冶屋: 武器/防具に属性を付与する
    blacksmith: {
        icon: '⚒️',
        color: 0xff8844,
        defaultLabel: '鍛冶屋',
        prompt: (label) => `[E] ${label}を開く`,
        ui: 'blacksmithUI',
        method: 'toggle',
    },

    // 店: 武器屋・防具屋・雑貨屋・ギルドショップなど。品揃えは shop プロパティ(SHOP_LOADOUTS)で決まる
    shop: {
        icon: '🛒',
        color: 0x44cc88,
        defaultLabel: (props) => getShopLoadout(props.shop).title,
        prompt: (label) => `[E] ${label}を開く`,
        ui: 'shopUI',
        method: 'open',
        args: (props) => [props.shop, props.category || null],
    },

    // クエストボード: クエストの受注・報告
    quest_board: {
        icon: '📜',
        color: 0x00ccaa,
        defaultLabel: 'クエストボード',
        prompt: (label) => `[E] ${label}を見る`,
        ui: 'guildQuestBoardUI',
        method: 'toggle',
    },
};
