# 🤖 Enemy AI - サーバー側 強化学習システム

## 概要

サーバーが起動している**限り永続的に学習し続ける**強化学習（Q-Learning）AIシステム。
マルチプレイヤーゲームで「初回起動時から最終的に強くなる」ことを目指した集合知型AIです。

---

## アーキテクチャ

```
[クライアント]                     [サーバー]
Player.js ──攻撃ヒット→  enemyHit   → server.js
                           ↓
                  ServerEnemyAIManager
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         slimeAgent   batAgent    goblinAgent ...
          (QLearning)  (QLearning)   (QLearning)
             │
             ▼
     Q-Table（共有知識）
             │
             ▼
       sharedAI.json（永続化）
```

---

## ファイル構成

| ファイル | 役割 |
|----------|------|
| `server/ai/ServerQLearning.js` | Q-Learning エンジン（サーバー側・Node.js） |
| `server/ai/ServerEnemyAI.js` | AI管理クラス。敵インスタンス別の行動決定・学習 |
| `server/server.js` | AIを統合。更新ループで敵移動をAI駆動に変更 |
| `server/data/sharedAI.json` | 学習データの永続化ストレージ |
| `client/managers/NetworkManager.js` | `enemyAttack`イベント受信（サーバーAI攻撃をクライアントに反映） |

---

## 学習の仕組み

### Q-Learning（ベルマン方程式）
```
Q(s, a) ← Q(s, a) + α * [r + γ * max Q(s', a') - Q(s, a)]
```

- **α（学習率）**: 0.35 — 学習の速さ
- **γ（割引率）**: 0.99 — 長期的な報酬を重視
- **ε（探索率）**: 0.4 → 0.08 — Q値が多く集まるにつれて探索から活用へ自動移行

### 状態（State）
敵が判断に使う情報:
- 最近接プレイヤーまでの距離（6段階）
- 自分のHP割合（5段階）
- ターゲットのHP割合（5段階）
- ターゲットへの方向（8方向）
- 周囲の仲間数（0〜3）

### 行動（Action）
| 行動 | 説明 |
|------|------|
| `approach` | 通常速度で接近 |
| `aggressive` | 1.5倍速で攻撃的接近 |
| `fast_approach` | 2倍速で超高速接近 |
| `attack_ready` | 攻撃射程に入るよう位置調整 |
| `circle_left/right` | 左右に回り込む（フェイント） |
| `skill_attack` | スキル攻撃 |
| `skill_heal` | 回復（ピンチ時のみ有効） |
| `skill_buff` | バフ（接近時のみ有効） |

### 報酬（Reward）設計
| 状況 | 報酬 |
|------|------|
| 攻撃範囲内（距離 < 60px）| +5.0 |
| 攻撃成功 | ダメージ × 20.0 |
| 仲間と連携して攻撃 | +10.0 |
| 積極的な接近行動 | +6〜8 |
| 遠すぎる（距離 > 250px） | -3.0 |
| 逃げる行動（circle等） | -5.0 |
| ピンチ時の回復 | +8.0 |
| 被ダメージ | -ダメージ × 0.05 |
| 死亡 | -5.0（エピソード終了） |

---

## 永続学習フロー

```
サーバー起動
    │
    ├── sharedAI.json ロード（前回の学習結果）
    │
    ├── 全マップの敵をスポーン & AIManager に登録
    │
    └── setInterval(150ms) ← 永続ループ開始
            │
            ├── プレイヤー位置の収集
            ├── 各敵のAI行動決定（Q-Learningで選択）
            ├── 敵の移動（サーバー側で物理計算）
            ├── 攻撃判定（範囲内ならクライアントに通知）
            ├── 報酬計算 & Q値更新（学習）
            └── 10秒ごとに sharedAI.json へ保存
                （← サーバーを再起動しても継続学習！）
```

---

## 集合知（同タイプ敵が知識を共有）

同じ敵タイプ（例: スライム全員）は **同一のQ-Table** を参照します。
- あるスライムがプレイヤーを倒す行動を学習 → 全スライムがそれを活用
- クライアント側でも学習 → `aiLearnSync` でサーバーにマージ → サーバーが全クライアントに配信

---

## 設定・チューニング

`server/ai/ServerEnemyAI.js` の `getAgent()`:
```js
new ServerQLearning({
    learningRate:   0.35,  // 学習率（大きいほど速く学習、不安定になりやすい）
    discountFactor: 0.99,  // 割引率（大きいほど長期的な戦略）
    epsilon:        0.4,   // 初期探索率（ランダム行動の割合）
    epsilonDecay:   0.9995,// εの減衰率/ステップ（1.0に近いほどゆっくり収束）
    minEpsilon:     0.08   // 最小探索率（完全に確定的にはならない）
})
```

`server/server.js`:
```js
const AI_UPDATE_INTERVAL = 150; // ms ← AI更新頻度（小さいほど反応が速くなる）
```

---

## ログ出力

### 30秒ごとの学習統計
```
[ServerAI] Learning Stats:
  [slime] ε=0.3200 updates=1500 episodes=23 qSize=48 avgReward=4.230
  [bat]   ε=0.3800 updates=800  episodes=12 qSize=30 avgReward=3.510
```

### 保存ログ（10秒ごと）
```
[ServerAI] AI models saved. Types: slime, bat, skeleton, ...
```

---

## クライアント↔サーバー の Socket イベント

| イベント | 方向 | 説明 |
|---------|------|------|
| `aiLearnSync` | Client → Server | クライアントの学習データをサーバーにマージ |
| `aiSharedUpdate` | Server → Client | サーバーの最新Q-tableをクライアントに配信 |
| `getSharedAI` | Client → Server | 最新モデルをリクエスト |
| `getAIStats` | Client → Server | 学習統計をリクエスト |
| `aiStats` | Server → Client | 統計情報を返す |
| `enemyAttack` | Server → Client | サーバーAIの攻撃をクライアントに通知 |
| `enemyMoved` | Server → Client | AI決定による位置更新 |
