/**
 * マップ上の施設（鍛冶屋・クエストボード・ギルドショップなど）の定義。
 *
 * ★新しい施設/場所を足すには、ここにエントリを足すだけ★（シーンのコードは触らなくてよい）
 *
 * 座標の決め方は2通り:
 *   1) Tiledのオブジェクトレイヤー「FacilityTrigger」に矩形を置き、カスタムプロパティ
 *      facility = <施設id> を付ける → マップ側の座標が優先される（推奨）
 *   2) 下の zone にワールドのピクセル座標を書く（Tiledを触れないときのフォールバック）
 *
 * 項目:
 *   id       施設id（Tiledのfacilityプロパティと一致させる）
 *   zone     { x, y, width, height } 判定エリア（左上基準・ピクセル）
 *   label    地面に出す看板テキスト（省略可。省略時は看板なし）
 *   prompt   近づいたときに出すメッセージ
 *   ui       開くUIのシーンプロパティ名（例: 'blacksmithUI'）
 *   method   UIに対して呼ぶメソッド（'toggle' | 'open'。既定 'toggle'）
 *   args     methodに渡す引数（例: ['guild_shop']）
 *   color    看板/枠の色（省略可）
 */
export const FACILITIES = {
    // 街: 武器屋の東隣の空き地に鍛冶屋
    city: [
        {
            id: 'blacksmith',
            zone: { x: 1520, y: 1058, width: 200, height: 154 },
            label: '⚒️ 鍛冶屋',
            prompt: '[E] 鍛冶屋を開く',
            ui: 'blacksmithUI',
            color: 0xff8844,
        },
    ],

    // ギルド1F: クエストボードとショップカウンター
    // （実際にタイル画像を描画して確認した座標。
    //   掲示板: (1-6, 10-11) / ショップカウンター: (23-25, 28-29)）
    guild1f: [
        {
            id: 'quest_board',
            zone: { x: 32, y: 384, width: 192, height: 56 },
            prompt: '[E] クエストボードを見る',
            ui: 'guildQuestBoardUI',
        },
        {
            id: 'guild_shop',
            zone: { x: 736, y: 832, width: 96, height: 64 },
            prompt: '[E] ギルドショップを開く',
            ui: 'shopUI',
            method: 'open',
            args: ['guild_shop'],
        },
    ],
};

export const FACILITY_INTERACT_KEY = 'E';
export const FACILITY_PROMPT_INTERVAL_MS = 3000;
