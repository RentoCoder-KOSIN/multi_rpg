# Render + Neon へのデプロイ手順

- Webサーバー（ゲーム本体）: **Render**
- データベース（アカウント・セーブ・敵AIの学習データ）: **Neon**（PostgreSQL。無料プランに期限なし）

環境変数 `DATABASE_URL` があるときだけ PostgreSQL を使い、無いとき（ローカル開発）は従来どおり `server/data/accounts.json` を使います。

## 1. GitHub に push する前に

- `client/assets/`（画像・マップJSON）も **必ずリポジトリに含める**（含まれていないと敵やマップが表示されません）
- `server/data/accounts.json` と `server/data/auth.secret` は **push しない**（`.gitignore` 済み。ハッシュ化されたパスワードと署名用の鍵が入っています）
- `server/config.js` の `ADMIN_PASSWORD` の初期値はソースに書かれているので、公開リポジトリにする場合は Render の環境変数で必ず別の値を設定する

## 2. Neon でデータベースを作る

1. [neon.com](https://neon.com) でアカウントを作り、**Create project**（リージョンは Render のサービスに近い所。Renderを Oregon にするなら AWS US West など）
2. プロジェクトの **Connect** から接続文字列（`postgres://ユーザー:パスワード@ep-xxxx.../neondb?sslmode=require`）をコピーする
   - 「Pooled connection」（ホスト名に `-pooler` が付く方）でも、付かない方でも動きます
3. テーブルは Render 初回起動時に自動で作られます（`accounts` と `kv`）

## 3. Render でサービスを作る

1. Render ダッシュボード → **New +** → **Blueprint** → このリポジトリを選択（`render.yaml` を読み込みます）
2. 入力を求められる環境変数:
   - `DATABASE_URL` … 手順2でコピーした Neon の接続文字列
   - `ADMIN_PASSWORD` … 自分で決めた値
3. デプロイ完了後、表示された `https://multi-rpg-xxxx.onrender.com` を開く → ユーザー登録してログイン

手動で作る場合: Web Service を作成（Root Directory: `server`、Build: `npm install`、Start: `node server.js`、Health Check: `/healthz`）→ 環境変数に `DATABASE_URL` と `ADMIN_PASSWORD` を設定。

## 4. 今まで作ったアカウント/セーブを移す（任意）

ローカルの `server/data/accounts.json` を DB に取り込めます（パスワードはハッシュのまま移るので、今までのパスワードでログイン可能）。

```
cd server
npm install
DATABASE_URL="Neonの接続文字列" npm run import-accounts
```
（Windows PowerShell: `$env:DATABASE_URL="Neonの接続文字列"; npm run import-accounts`）

同じユーザー名が既にDBにある場合はスキップされるので、何度実行しても安全です。

## 5. ローカルで PostgreSQL を使って試す場合

```
cd server
npm install
DATABASE_URL="postgres://ユーザー:パスワード@localhost:5432/DB名" npm start
```

## 注意点（2026年10月時点で確認した内容。変わることがあるので公開前に各公式サイトで最新を確認してください）

- **Neon 無料プラン**: 期限なし。容量は 1プロジェクト 0.5GB、計算時間は月 100 CU-hours。5分アクセスが無いと自動で休止し、次のアクセスで自動復帰します（最初の1回だけ少し遅い）。
  - 敵AIの学習データのDB保存は「5分に1回、内容が変わったときだけ」にしてあります。頻繁に書き続けると休止できず、無料の計算時間を使い切るためです。
  - 容量が足りなくなったら有料のLaunchプラン（使った分だけ課金）に変更できます。
- **Render 無料Webサービス**: 15分アクセスが無いとスリープし、復帰に1分ほどかかります。スリープ中は敵AIも止まり、WebSocket接続も切れます。常時動かしたい場合はこのサービスだけ有料プランにしてください。
- Renderのディスクは再デプロイで消えますが、データは全部Neonにあるので影響しません。
