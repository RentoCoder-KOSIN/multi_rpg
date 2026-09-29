# マップと敵の追加ガイド

マップは `client/assets/maps/*.json` を置くだけで自動登録されます。
敵は `server/data/enemyStats.js` に1か所書けば、画像・大きさ・配置まで反映されます。

## マップを追加する

1. Tiledでマップを作り、`client/assets/maps/<マップキー>.json` に保存する
   （ファイル名がそのままマップキー。半角英数字と `_` 推奨。例: `cave.json`）
2. Tiledの「マップ → マップのプロパティ」にカスタムプロパティを付ける（全部省略可）

   | プロパティ | 型 | 意味 |
   |---|---|---|
   | `displayName` | string | 画面に出る名前（省略するとマップキー） |
   | `showQuestTracker` | bool | クエストトラッカーを出すか（省略時 true） |
   | `showDebugKey` | bool | Dキーのデバッグ表示（省略時 true） |

3. オブジェクトレイヤーを置く

   | レイヤー | 用途 |
   |---|---|
   | `PlayerSpawn` | 入った時の出現位置。複数置く場合は `name` を付ける |
   | `Teleports` | 他マップへの転移 |
   | `enemy_spawn` | 敵の出現位置。`type` に敵のID、`respawnDelay`(ms) |
   | `NPCs` / `FacilityTrigger` | NPC・ショップなどの施設 |

4. `Teleports` のプロパティ

   | プロパティ | 意味 |
   |---|---|
   | `targetMap` | 行き先のマップキー（必須） |
   | `targetSpawn` | 行き先の `PlayerSpawn` の `name`（座標より優先） |
   | `destX` / `destY` | 行き先の出現座標（`targetSpawn` が無い時） |
   | `requiredQuest` | このクエストを達成するまで通れない |
   | `unlocked` | true ならいつでも通れる |

   行き先のマップにも、戻り用の `Teleports` を置くのを忘れずに。
5. サーバーを再起動し、ブラウザを再読み込みする（マップ一覧は起動時に読み込む）

特別な処理が要るマップ（ボス戦など）だけ、`client/scenes/` に専用クラスを作り、
`client/scenes/mapScenes.js` の `CUSTOM_SCENES` に登録します。普通のマップはコード不要です。

## 敵を追加する

1. 画像を `client/assets/enemy/` に置く（`art-source/pipo-enemy/` からコピーでOK）
2. `server/data/enemyStats.js` に1エントリ足す

   ```js
   cave_bat: defineEnemy({
       id: "cave_bat",
       name: "洞窟コウモリ",
       sprite: "pipo-enemy001b.png",   // client/assets/enemy/ 内のファイル名
       size: "small",                  // small / medium / large / boss / huge
       level: 30, hp: 3000, atk: 120, def: 20, exp: 900, gold: 150,
       drops: [{ id: "potion", chance: 0.2 }],
   }),
   ```
3. マップの `enemy_spawn` の `type` に `"cave_bat"` と書く

## 追加したら点検する

```bash
cd server
npm run check
```

マップのつながり、各マップの敵の数、敵の一覧を表示し、次のミスを警告します。
サーバー起動時にも同じ点検が走り、問題があれば警告だけ出します（止まりはしません）。

- 転移先のマップ名・スポーン名のタイプミス
- `enemy_spawn` の `type` が敵データに無い
- 敵の画像ファイルが無い
- どこからも転移で辿り着けないマップ
