# データ構造ガイド（アイテム・スキル・職業・敵）

このリファクタリングで、アイテム／スキル／職業／敵の定義はすべて
「ファクトリ関数」経由で作るようになりました。

- クライアント側: `client/data/schema.js` → `defineItem` / `defineSkill` / `defineJob`
- サーバー側: `server/data/schema.js` → `defineEnemy`

目的は3つです。

1. **必須項目の抜け漏れを起動時に検出する**（今まではタイポや項目漏れが
   バトル中に静かに無視されるだけだった）
2. **どのエントリも同じ形にする**（`item.atk` だったり `item.stats.attack`
   だったりが混在しない）
3. **追加コストを下げる**（違いのあるフィールドだけ書けばよい）

## 見つかった既存バグ（今回ついでに修正）

- `heal` スキル: `healPower: 50` を定義していたのに、実際のコードは
  存在しない `skill.heal` を読んでいたため、設定値は常に無視されて
  デフォルトの50が使われ続けていた。→ `effect.healPower` に統一して修正。
- `holy_weapon`: `speed: 5` というフィールドを持っていたが、移動速度に
  実際に反映されるのは `speedBonus` というキーだけだったため、この
  ボーナスは一度も適用されていなかった。→ `speedBonus` にリネーム。
- 魔法職の武器攻撃力計算が `item.matk`（トップレベル）しか見ておらず、
  `stats.matk` を見ていなかった。→ フォールバックを追加。

## 敵に `def`（防御力）を追加

以前は敵に防御力の概念自体が存在せず、プレイヤーの攻撃は常に防御力
無視でした（プレイヤー側が受けるダメージだけは `player.getDefense()`
でフラット減算されていました）。今回、敵にも `def` を追加し、
`Player.getDamage()` で同じ「フラット減算・最低1ダメージ保証」の
計算式を敵側にも適用しました。

```js
// client/entities/Player.js の getDamage() 内
const targetDef = target ? (target.def ?? target.stats?.def ?? 0) : 0;
if (targetDef > 0) {
    amount = Math.max(1, amount - targetDef);
}
```

既存の敵の `def` 値は「大体 ATK の1〜2割」くらいを目安にした暫定値です。
実際に遊んでみて、弱すぎる／強すぎると感じたら遠慮なく
`server/data/enemyStats.js` の数値だけ調整してください
（`def` を上げれば防御力が上がり、下げれば下がります。ロジック自体は
変更不要です）。

## 追加方法

### 敵を追加する（`server/data/enemyStats.js`）

```js
const { defineEnemy } = require("./schema");

const ENEMY_STATS = {
    // ...既存の敵...
    new_enemy: defineEnemy({
        id: "new_enemy",
        name: "新しい敵",
        level: 10,
        hp: 1000,
        atk: 50,
        def: 10,
        exp: 500,
        gold: 100,
        drops: [{ id: "potion", chance: 0.1 }],
    }),
};
```

`id` / `name` / `hp` / `atk` が無いか、数値であるべき所が数値でないと
サーバー起動時に例外で気づけます。あとはマップの `enemy_spawn` レイヤーで
`type: "new_enemy"` を指定すればスポーンします。

### アイテムを追加する（`client/data/items.js`）

```js
import { defineItem } from './schema.js';

export const ITEMS = {
    // ...既存のアイテム...
    my_sword: defineItem({
        id: "my_sword",
        name: "新しい剣",
        type: "weapon",       // 'weapon' | 'armor' | 'consumable'
        price: 500,
        level: 10,             // 装備/使用に必要なレベル
        stats: { attack: 30, critChance: 0.05 },
        description: "新しい剣。",
    }),
};
```

`stats` に入れられる主なキー: `attack`, `matk`, `defense`, `critChance`,
`speedBonus`, `heal`, `healMp`, `healAll`, `attackBoost`, `defenseBoost`,
`expMultiplier`, `lifesteal`, `deathChance`, `fireDamage`, `iceDamage`,
`fireResist`, `iceResist`, `freezeChance`, `attackMultiplier`, `poison`,
`revive`。既存アイテムを検索すればだいたいの使用例が見つかります。

ランダム性やターゲット依存など、単純な数値では表現できない攻撃力計算が
必要な場合は `calculateAtk(baseAtk, player, target)` 関数を渡せます
（`ganble_stick` や `death_scythe` が実例）。

追加したら、売ってほしい店の `client/data/shops.js` の `items` 配列に
`id` を足すのを忘れずに。

### スキルを追加する（`client/data/skills/` 配下）

```js
import { defineSkill } from '../schema.js';

export const MY_JOB_SKILLS = {
    my_skill: defineSkill({
        id: 'my_skill',
        name: '新しいスキル',
        type: 'active',        // 'active' | 'passive'
        damageMult: 10,
        mpCost: 15,
        cd: 3000,
        range: 150,
        rangeType: 'circle',    // 'circle' | 'line' | 'fan'
        icon: '✨',
        description: '新しいスキルの説明。',
    }),
};
```

- `range` / `rangeType` / `damageMult` / `mpCost` / `cd` などコア戦闘値は
  トップレベルのまま。
- ヒール量や特定敵への特効倍率など「特殊な効果」は `effect` に入れる。
  例: `effect: { healPower: 50 }`、`effect: { vsUndead: 2.0 }`。

作ったら:
1. `client/data/skills/skillRegistry.js` の `SKILLS` に spread で追加
2. 同ファイルの `SKILLS_BY_JOB` に、そのスキルを使える職業IDを追加
3. `client/data/jobs.js` の該当職業の `skills: { レベル: [id] }` に追加

### 職業を追加する（`client/data/jobs.js`）

```js
import { defineJob } from './schema.js';

export const JOBS = {
    // ...既存の職業...
    my_job: defineJob({
        id: 'my_job',
        type: 'physical',        // 'physical' | 'magical'
        name: '新しい職業',
        description: '説明。',
        atkBonus: 5, defBonus: 5, hpBonus: 20,
        skills: { 1: ['my_skill'] },
        nextJob: 'my_advanced_job', // 上位職が無ければ省略
    }),
};
```

**注意**: 初期職業（レベル1から選べる職業）は `reqLevel` を絶対に
指定しないでください。職業選択ダイアログ（`DialogueManager.js`）は
`!job.reqLevel` で初期職業だけを絞り込んでいるため、うっかり
`reqLevel: 1` を書くと初期職業が選択肢から消えてしまいます。
上位職（転職先）だけ `reqLevel: 30` のように指定してください。

---

## 追記: バランス調整・戦闘バグ修正・スキル大幅改訂

### プレイヤーのHP成長率を調整可能にした

`client/gameConstants.js` の `GROWTH_CONFIG` に以下を追加した。

```js
HP_BASE: 80,
HP_PER_VIT: 10,
HP_GROWTH_MULTIPLIER: 1.5, // ここだけ変えればHPの伸びを一括調整できる
```

`Player.js` の `maxHp` 計算式はこれを参照するようになっている
（`HP_BASE + round(VIT * HP_PER_VIT * HP_GROWTH_MULTIPLIER) + 職業のHPボーナス`）。

なお、当初の依頼は「`config.js` で倍率を変えられるように」だったが、
`client/config.js` は Scene クラス群を import しており、そこから
`Player.js` が `config.js` を参照すると循環import
（`Cannot access '...' before initialization`）を起こす。
`gameConstants.js` は元々「Sceneに依存しない軽量な定数専用ファイル」として
用意されていたため、同じ目的でここに置いている。

### バグ修正: ボスに通常攻撃（SPACE）が当たらない

`performBasicAttack()`（`client/systems/combat.js`）が、対象の敵を
`scene.networkManager.getEnemies()`（サーバー管理の敵の一覧）からしか
探していなかった。ローカル限定で生成されるボス（`socket: null` で
生成される）はこの一覧に登録されないため、通常攻撃の対象に一切
含まれなかった。スキルは別ロジック（`scene.children.list` から
`Enemy` インスタンスを全て探す）だったため、スキルだけはボスに当たっていた。

通常攻撃もスキルと同じ探し方（`scene.children.list` を `Enemy` で
フィルタ）に統一して修正。今後、敵の当たり判定に関わるロジックを
書くときは、`scene.networkManager.getEnemies()` だけでなく、
ローカル限定の敵（ボスなど）が漏れていないか必ず確認すること。

### 敵の攻撃間合いの可視化

`client/utils/enemyDebug.js` に既に `drawEnemyDetectionRanges()` という
関数が定義されていたが、どこからも呼ばれていない **デッドコード** だった
（Dキーのデバッグ表示は別のテキストパネルのみで、輪の描画は一度も
呼ばれていなかった）。

新たに `drawEnemyAttackRanges(scene)` を追加し、`BaseGameScene.update()`
から毎フレーム呼ぶようにした。サーバー管理の敵は `client/config.js` の
`ENEMY_ATTACK_RANGE`（サーバー側 `server/config.js` の値をミラーしたもの。
値を変えたら両方揃えること）を、ローカル限定の敵（ボスなど）は各自の
`attackRange` を使って、敵の周囲に薄い赤の輪を常時表示する。

Dキーのデバッグテキストパネルとは独立して常時ONになっている。
もし通常プレイ中は表示したくない場合は、`BaseGameScene.js` の
`drawEnemyAttackRanges(this);` の呼び出しを
`if (this.showEnemyDebug) { drawEnemyAttackRanges(this); }` に変えれば、
Dキーを押したときだけ表示される。

### スキルの大幅改訂（職業間の重複解消・パッシブ拡充）

**変更前の問題点**
- `slash` / `sonic_wave` / `ice_needle` / `dark_nova` / `whirlwind` が、
  無関係な職業間（例: ファイターとレンジャー）でそのまま重複して
  使われていた。
- 基本職ごとにスキル数がバラバラ（4〜7個）で、上位職は新規スキルが
  1個だけしか増えなかった。
- ほとんどのスキルが「攻撃」か「バフ」で、常時発動のパッシブは
  4種類しかなかった。

**変更後**
- 職業間のスキルID重複はゼロ（Node上で全職業・全スキルを実際に
  読み込んで機械的に検証済み。合計66種のユニークなスキル、重複なし）。
- 基本職6職業（ファイター/メイジ/タンク/レンジャー/サモナー/プリースト）は
  全て「合計7スキル」に統一。
- 上位職6職業（ナイト/アークメイジ/パラディン/スナイパー/ハイサモナー/
  エクソシスト）は、それぞれ「新規に増える4スキル」で統一
  （継承元のスキルは`SkillManagerUI.js`が職業の系譜を自動で辿って
  引き継ぐので、上位職側の定義に再度書く必要はない）。
- パッシブスキルを4種類→24種類に拡充。全職業に最低1〜2個配置。

**パッシブの仕組みを汎用化**

以前は `fighting_spirit` など4つのパッシブが `Player.js` に
個別のif文でハードコードされていた。新しいパッシブを追加するたびに
このif文を増やす必要があり、スケールしない書き方だった。

`defineSkill()` の `effect` フィールドに以下のキーを書くと、
`Player.js` の `applyEquipmentStats()` が自動で適用する
（新しいif文を増やす必要はない）:

| キー | 効果 |
|---|---|
| `atkMult` | 攻撃力に倍率 |
| `defMult` | 防御力に倍率 |
| `maxHpMult` / `maxHpFlat` | 最大HPに倍率／固定加算 |
| `maxMpFlat` / `maxMpMult` | 最大MPに固定加算／倍率 |
| `speedFlat` | 移動速度に固定加算 |
| `critChanceFlat` | 会心率に固定加算 |
| `lifestealFlat` | 与ダメージの一部を自分のHPとして吸収 |
| `expMultBonus` | 獲得経験値の倍率に加算（例: 0.1 → +10%） |
| `cooldownMult` | スキルのクールタイムに倍率（combat.js側で消費） |
| `mpCostMult` | スキルのMP消費に倍率（combat.js側で消費） |
| `healPowerMult` | 回復スキルの効果量に倍率（combat.js側で消費） |

例:
```js
my_new_passive: defineSkill({
    id: 'my_new_passive',
    name: '新しいパッシブ',
    type: 'passive',
    unlockCost: 100,
    icon: '✨',
    description: '常時：攻撃力+12%',
    effect: { atkMult: 1.12 }
}),
```

これで十分。`Player.js` を触る必要はない。

---

## 追記2: 突撃命令のテコ入れ・レベルアップ計算の確認・HP成長カーブの再調整

### 突撃命令（サモナーの`command_attack`）が機能してるように見えなかった件

実際には動いていましたが、効果が弱すぎて体感できなかった、というのが実態でした。
`SummonedBeast.commandAttack()` は元々「攻撃クールダウンのリセット」と
「3秒間だけ移動速度2倍」しかしておらず、召喚獣は元々0.8秒間隔で自動攻撃する
上に、射程(50px)内に既にいないと何も見た目上の変化が起きません。プレイヤーが
少し離れた場所からこのスキルを押しても、画面上は何も起きたように見えない
状況になっていました。

「命令」らしく、押した瞬間に必ず効果が見える即時ダメージ（`atk × 2.2`、
レベル差補正込み）を追加しました。距離に関わらず現在のターゲットに直撃し、
ダメージ数値と「命令実行！」の文字が出ます。従来の速度アップ効果もそのまま
残しています。

### レベルアップ計算について

`Player.gainExp()` は既に正しく実装されていました。大量の経験値が一度に
入った場合、`while (this.stats.exp >= this.stats.maxExp)` のループで
毎回 `levelUp()` を呼び、`levelUp()` の中で `this.stats.level++` した
**後**に `this.stats.maxExp = calcMaxExp(this.stats.level)` を再計算して
いるため、2段以上レベルアップする場合も、常に「レベルアップ後の新しい
次のレベルに必要な経験値」を基準に消費されます。古い（レベルアップ前の）
`maxExp` を使い続けてしまうバグではありませんでした。

### HP成長カーブの再調整（Lv100・VIT無振りで概ね1万）

以前は `maxHp = HP_BASE + round(VIT * HP_PER_VIT * HP_GROWTH_MULTIPLIER) + 職業ボーナス`
というVIT一次関数だった。VITはレベルごとに自動で+1しか増えないため、
「Lv100でVITを振らずに1万」を狙って倍率を上げると、Lv1のHPまで
一緒に跳ね上がってしまう問題があった。

そこでレベル自体のべき乗成分を別に加えたカーブに変更した
（`client/gameConstants.js` の `GROWTH_CONFIG`）:

```js
maxHp = HP_BASE
      + round( (level^HP_LEVEL_EXPONENT * HP_LEVEL_SCALE + VIT * HP_PER_VIT) * HP_GROWTH_MULTIPLIER )
      + 職業のHPボーナス
```

デフォルト値（`HP_LEVEL_EXPONENT: 2`, `HP_LEVEL_SCALE: 0.88`）で、
VITを一切振らずレベルだけ上げた場合のHPは概ね:

| レベル | HP（目安） |
|---|---|
| 1 | 約120〜330 |
| 30 | 約1200〜1400 |
| 50 | 約2800〜3000 |
| 70 | 約5100〜5300 |
| 100 | 約9900〜10100 |

`HP_GROWTH_MULTIPLIER` は変わらず「このカーブ全体を一括で何倍にもする」
ための倍率として残してある（1.0 = このバランス）。
