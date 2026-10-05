# 装備ステータス一覧

`client/data/items.js` の `stats` に指定できる主な数値です。武器・防具・宝具で共通して使えます。

| キー | 内容 | 例 |
| --- | --- | --- |
| `attack` | 物理攻撃力（ATK） | `attack: 30` |
| `matk` | 魔法職が優先して使う魔法攻撃力（MATK） | `matk: 45` |
| `defense` | 防御力（DEF） | `defense: 20` |
| `critChance` | 会心率。0〜1で指定 | `critChance: 0.05`（5%） |
| `dodgeChance` | 回避率の固定加算。0〜1で指定 | `dodgeChance: 0.08` |
| `speedBonus` | 移動速度への加算 | `speedBonus: 10` |
| `lifesteal` | 与ダメージのHP吸収率。0〜1で指定 | `lifesteal: 0.03` |
| `expMultiplier` | 経験値倍率 | `expMultiplier: 1.2` |
| `attackMultiplier` | 攻撃力への倍率 | `attackMultiplier: 1.1` |
| `fireResist` / `waterResist` / `thunderResist` | 火・水・雷耐性（%） | `fireResist: 15` |
| `windResist` / `earthResist` | 風・土耐性（%） | `windResist: 10` |
| `lightResist` / `darkResist` | 光・闇耐性（%） | `darkResist: 20` |
| `iceResist` | 旧表記の水耐性。`waterResist` として集計 | `iceResist: 10` |
| `fireDamage` / `waterDamage` / `thunderDamage` | 属性の固定追加ダメージ | `fireDamage: 25` |
| `windDamage` / `earthDamage` | 属性の固定追加ダメージ | `windDamage: 20` |
| `lightDamage` / `darkDamage` | 属性の固定追加ダメージ | `lightDamage: 30` |
| `freezeChance` / `paralyzeChance` | 凍結・麻痺の発生率。0〜1 | `freezeChance: 0.15` |
| `poisonChance` / `poisonDamage` | 毒の発生率と1回あたりのダメージ | `poisonChance: 0.1` |
| `deathChance` | 即死効果の発生率。0〜1 | `deathChance: 0.05` |

## 装備区分

武器には `weaponClass` を設定できます。現在の対応値は `oneHandSword`（片手剣）、`twoHandSword`（両手剣）、`spear`（槍）、`staff`（杖）、`wand`（ワンド）、`tome`（魔導書）、`bow`（弓）、`mace`（メイス）です。職業適性外の武器は装備できません。既存の `weaponClass` 未設定装備は後方互換のため全職業で装備可能です。
