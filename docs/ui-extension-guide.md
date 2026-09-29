# UI 拡張ガイド (multi-rpg)

HUD の配置まわりを拡張しやすくしました。「何をしたいか」から引けるようにまとめています。
コード例は全て英語で書いています。

## 0. ファイル構成

| ファイル | 役割 | 普段触る? |
|---|---|---|
| `client/ui/uiLayout.js` | 配置の**データ**(座標・サイズ・アンカー) | **よく触る** |
| `client/ui/UILayoutManager.js` | 配置の**ロジック**(計算・リサイズ追従) | 触らない |
| `client/ui/SideMenuUI.js` の `MENU_ITEMS` | メニューボタンの一覧 | ボタン追加時 |
| `client/gameConstants.js` | スキル枠数・クエスト表示件数など | 数値変更時 |

考え方: **「どこに置くか」はデータ、「置く処理」はマネージャ、UIクラスは `register()` するだけ。**

---

## 1. 位置・サイズを変えたい

`uiLayout.js` の該当エントリを編集するだけです。UIクラスは触りません。

```js
minimap: {
    anchor: 'top-right',
    margin: { x: 15, y: 15 },
    size: { w: 140, h: 140 }
}
```

### 各項目の意味

| 項目 | 意味 |
|---|---|
| `anchor` | 画面のどこに寄せるか。`top` / `middle` / `bottom` + `-` + `left` / `center` / `right` |
| `margin` | 寄せた辺からの距離(px)。`middle` / `center` の軸では「中央からのずれ」(符号あり)。**負の値 = 画面外へはみ出す** |
| `size` | 要素のサイズ `{w, h}` |
| `origin` | 要素内で、ゲームオブジェクトの (0,0) がある位置(0〜1の割合)。省略 = 左上 `{x:0,y:0}`、中心 = `{x:0.5,y:0.5}` |
| `relative` | 他のエントリの隣に置く。`{ to, side, gap }`。`side` は `below` / `above` / `left` / `right` |

### 例

```js
// Move the minimap to the bottom-left corner
minimap: { anchor: 'bottom-left', margin: { x: 15, y: 15 }, size: { w: 140, h: 140 } }

// Make the minimap bigger; the party list (relative: below minimap) follows automatically
minimap: { anchor: 'top-right', margin: { x: 15, y: 15 }, size: { w: 200, h: 200 } }
// NOTE: MinimapUI reads its size from here, so the circle grows too.

// Put the party list on the LEFT of the minimap instead of below it
party: {
    anchor: 'top-right', margin: { x: 0, y: 15 }, size: { w: 200, h: 55 },
    relative: { to: 'minimap', side: 'left', gap: 10 }
}
```

`relative` は**指定した軸だけ**を上書きします。`below` / `above` なら Y が、`left` / `right` なら X が、相手の位置から決まります。もう一方の軸は `anchor` と `margin` のままです。

---

## 2. 新しい HUD を追加したい (3ステップ)

例: 画面上中央に FPS を表示する `FpsUI`。

**Step 1. `uiLayout.js` にエントリを足す**

```js
fps: {
    anchor: 'top-center',
    margin: { x: 0, y: 6 },
    size: { w: 80, h: 12 },
    origin: { x: 0.5, y: 0.5 }   // the text below uses setOrigin(0.5)
},
```

**Step 2. UIクラスを作って `register()` する**

```js
// client/ui/FpsUI.js
import { getUILayout } from './UILayoutManager.js';

export default class FpsUI {
    constructor(scene) {
        this.scene = scene;
        this.text = scene.add.text(0, 0, '', { fontSize: '10px', color: '#ffffff' })
            .setOrigin(0.5)      // matches origin {0.5, 0.5} in uiLayout.js
            .setScrollFactor(0)  // fixed on screen
            .setDepth(2000);
        getUILayout(scene).register('fps', this.text);
    }

    update() {
        this.text.setText(`${Math.round(this.scene.game.loop.actualFps)} FPS`);
    }
}
```

**Step 3. シーンで生成する** (`client/scenes/base/ui.js` の `createGameUI` 内)

```js
import FpsUI from '../../ui/FpsUI.js';
// ...
scene.fpsUI = new FpsUI(scene);
```

`update()` を毎フレーム呼ぶ場合は `BaseGameScene.js` の update 部分(`this.skillBarUI.update()` の近く)に足します。

### `origin` の合わせ方 (ここでズレやすい)

`uiLayout.js` の `origin` と、ゲームオブジェクト側の原点が**一致**している必要があります。

| 作るもの | UI側 | `uiLayout.js` の `origin` |
|---|---|---|
| 左上が基準の `container` (既定) | そのまま | 省略 |
| 中心が基準の円形ボタンなど | 中心を (0,0) として描く | `{ x: 0.5, y: 0.5 }` |
| `setOrigin(0.5)` のテキスト | `setOrigin(0.5)` | `{ x: 0.5, y: 0.5 }` |

---

## 3. 実行中にサイズが変わる UI

サイズが変わるときは `setSize()` で伝えます。他のエントリの `relative` も自動で追従します。

```js
// QuestTrackerUI: the height depends on how many quests there are
this.layoutMgr = getUILayout(scene);
this.layoutMgr.register('quest', this.container);   // once
// ...every time the panel is redrawn:
this.layoutMgr.setSize('quest', width, height);      // re-centers vertically
```

同じサイズなら何もしません(無駄な再計算なし)。

---

## 4. `uiLayout.js` を触らずに一時的に追加したい

```js
const layout = getUILayout(scene);
layout.define('badge', { anchor: 'bottom-left', margin: { x: 10, y: 10 }, size: { w: 60, h: 20 } });
layout.register('badge', badgeObject);
```

`define()` はシーンごとのコピーに追加するだけで、共有データ (`UI_LAYOUT`) は書き換えません。

複数のオブジェクトを同じ位置に置きたいときは配列で渡します。

```js
// text and background move together
layout.register('interactPrompt', [scene.interactText, scene.interactBg]);
```

---

## 5. メニューにボタンを足したい

`client/ui/SideMenuUI.js` の `MENU_ITEMS` に**1行**足します。

```js
const MENU_ITEMS = [
    // ...
    { icon: '🗺️', label: 'Map', key: 'M2', color: '#ff9900', ui: 'worldMapUI' }
];
```

| 項目 | 意味 |
|---|---|
| `ui` | シーンのプロパティ名(`scene.worldMapUI`)。**`toggle()` メソッドが必要** |
| `color` | `'#rrggbb'` 形式 |
| `key` | ボタンに表示するショートカット文字(表示だけ。キー割り当ては別に `scenes/base/input.js` で行う) |

ボタンは上から順に縦に並びます。数を増やすと下に伸びます (1個あたり 68px)。
画面の高さ(600px)に収まる個数に注意してください。

---

## 6. 個別 UI のよく使う調整

| やりたいこと | 場所 |
|---|---|
| スキルの円の大きさ | `uiLayout.js` の `skillDial.radius` / `bgPadding` (サイズは自動計算) |
| 円をどれだけ画面外に切るか | `uiLayout.js` の `SKILL_DIAL_BOTTOM_CLIP` (大きいほど円が見える) |
| スキル枠の数 | `gameConstants.js` の `TOTAL_SKILL_SLOTS` |
| 何個先のスロットまで見せるか | `SkillBarUI.js` の `VISIBLE_ANGLE_LIMIT` / `FADE_START_ANGLE` |
| クエスト折りたたみ時の幅 | `QuestTrackerUI.js` の `TAB_WIDTH` |
| クエストの同時表示件数 | `gameConstants.js` の `QUEST_UI_CONFIG.TRACKER_MAX_VISIBLE` |
| クエストの縦位置 | `uiLayout.js` の `quest.margin.y` (`+` で下へ) |
| モバイル用ボタンの位置 | `uiLayout.js` の `virtualPad` (今はスキルの円の真上) |

---

## 7. ハマりやすい点

1. **登録したオブジェクトの位置を自分で `setPosition` しない。**
   リサイズのたびにマネージャが上書きします。動かしたいなら `uiLayout.js` を変えます。
2. **`setScrollFactor(0)` を忘れない。** 忘れるとカメラに追従して画面から流れます。
   `container` の場合は子要素にも効かせるため `pinToScreen(container)` も呼びます (`client/utils/screenFixed.js`)。
3. **`register()` の ID が `uiLayout.js` に無いと**、警告 `[UILayout] No layout entry for "xxx"` が出て配置されません(ゲームは落ちません)。
4. **`relative` の循環はエラー。** `a → b → a` のように参照し合うと `Circular layout reference` が出ます。
5. **`anchor` の綴り間違いはエラー。** `top-left` のように `縦-横` の順で書きます (`left-top` は不可)。
6. **作成順は気にしなくてよい。** 相手のエントリがまだ作られていなくても、`relative` は設定値から計算されます。
7. **シーンを再起動しても大丈夫。** シーン終了時にマネージャが自動で片付けられ、次回は新しく作られます。

## 8. まだ移行していないもの

`MapNameUI` と `NotificationUI` (画面上中央・アニメーションあり) は、まだ自前で位置を決めています。
移す場合は、この 2 つも上の手順 (エントリ追加 → `register`) と同じやり方で置き換えられます。

## 9. 配置ロジックをテストしたい

`resolveRect` は Phaser なしで動く純粋関数です。

```js
import { UI_LAYOUT } from './client/ui/uiLayout.js';
import { resolveRect } from './client/ui/UILayoutManager.js';

// game size 800x600 -> minimap top-left should be (645, 15)
console.log(resolveRect('minimap', UI_LAYOUT, { width: 800, height: 600 }));
// { x: 645, y: 15, w: 140, h: 140 }
```

(Node で実行するには `package.json` に `"type": "module"` が必要です。)
