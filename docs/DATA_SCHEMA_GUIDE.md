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
