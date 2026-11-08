/**
 * 宝箱の定義。配置と中身の設定は Tiled で行う。
 *
 * ■ 宝箱を置く手順（Tiled）
 *   1. マップに オブジェクトレイヤー「Chests」を作る（グループの中でもOK）
 *   2. 「タイルオブジェクト」で宝箱の絵を置く（挿入 → タイル、タイルセットから宝箱のタイルを選ぶ）
 *   3. オブジェクトにカスタムプロパティを付ける（全て省略可。何も付けなければ空の宝箱になるので、items か gold か loot のどれかは付ける）
 *        loot       (string) 中身のテンプレート。下の CHEST_LOOTS のキー
 *        items      (string) 中身を直接書く。"potion:3,magic_stone:10" 形式（個数省略で1個）
 *        gold       (int)    もらえるゴールド（周回ボーナスが掛かる）
 *        openedGid  (int)    開けた後に表示するタイルの「gid」（タイルセットのfirstgid + タイル番号）。省略時は暗く表示
 *        solid      (bool)   false で通り抜け可能にする（既定は体当たりで通れない）
 *        chestId    (string) セーブ用のID。省略時は「マップ名:オブジェクトID」
 *        label      (string) 近づいたときに出す名前。省略時は「宝箱」
 *      loot と items / gold を両方書くと、どちらももらえる。
 *
 * ■ 注意
 *   ・開けたかどうかはプレイヤーのセーブ(stats.openedChests)に残る。1人1回だけ開けられる。
 *   ・Tiled上でオブジェクトを消して置き直すとIDが変わり、また開けられるようになる。
 *     置き直したくないときは chestId を付けておくと固定できる。
 */

export const CHEST_LAYER_NAME = 'Chests';
export const CHEST_INTERACT_KEY = 'E';
export const CHEST_INTERACT_DISTANCE = 56; // 宝箱の中心からこの距離以内で開けられる(px)
export const CHEST_PROMPT_INTERVAL_MS = 3000;

// 中身のテンプレート（Tiledの loot プロパティで指定）
export const CHEST_LOOTS = {
    // 序盤の小さな宝箱
    small: {
        gold: 100,
        items: [{ id: 'potion', count: 3 }],
    },
    // 中盤の宝箱
    medium: {
        gold: 500,
        items: [{ id: 'high_potion', count: 3 }, { id: 'high_mp_potion', count: 2 }],
    },
    // 終盤の宝箱
    large: {
        gold: 2000,
        items: [{ id: 'great_potion', count: 3 }, { id: 'great_mp_potion', count: 3 }, { id: 'magic_stone', count: 5 }],
    },
};
