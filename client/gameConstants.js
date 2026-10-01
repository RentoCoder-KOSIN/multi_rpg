// 他のモジュールをimportしない、依存関係のない定数専用ファイル。
// config.js は Scene クラス群をimportしており、Scene側からさかのぼって
// config.js の値を参照するモジュール（SkillBarUI.js など）があると循環importになり、
// 「Cannot access '...' before initialization」エラーの原因になる。
// 複数箇所から参照する軽量な定数はこちらに置く。

// スキルスロット数（アクティブスキルバー / スキルマネージャー / キー入力で共有）
export const TOTAL_SKILL_SLOTS = 8;

// 経験値・成長関連の調整値
export const GROWTH_CONFIG = {
    // 装備の「経験値2倍」等の効果は、このレベル以下でのみ発動する
    EXP_MULTIPLIER_LEVEL_CAP: 25,
    // ジョブ経験値は、通常の経験値のこの割合だけ獲得する（1.0=同量、簡単に貯まりすぎるため抑制）
    JOB_EXP_RATE: 0.15,

    // プレイヤーの最大HPの伸び方（Player.js の applyEquipmentStats で使用）。
    //
    //   maxHp = HP_BASE
    //         + round( (level^HP_LEVEL_EXPONENT * HP_LEVEL_SCALE + VIT * HP_PER_VIT)
    //                  * HP_GROWTH_MULTIPLIER )
    //         + 職業のHPボーナス
    //
    // VITだけの一次関数だと、Lv100付近を大きくするために倍率を上げると
    // Lv1のHPまで一緒に跳ね上がってしまう（VITはレベル毎に自動で+1しか
    // 増えないため、終盤の伸びを確保しようとすると序盤が過剰になる）。
    // そこでレベル自体のべき乗成分(HP_LEVEL_EXPONENT/HP_LEVEL_SCALE)を
    // 別に持たせ、「序盤は緩やか、終盤にしっかり伸びる」カーブにしている。
    // 目安: VITを一切振らずレベルだけ上げた場合、Lv100で概ねHP1万前後になる値。
    // HP_GROWTH_MULTIPLIER だけ変えれば、このカーブ全体を一括で何倍にもできる
    // （1.0 = このバランス、2.0 = 全レベルで2倍のHP、というように）。
    HP_BASE: 80,
    HP_PER_VIT: 10,
    HP_LEVEL_EXPONENT: 2,
    HP_LEVEL_SCALE: 0.88,
    HP_GROWTH_MULTIPLIER: 1.0,
};

// 戦闘・経済まわりの調整値
export const COMBAT_CONFIG = {
    CRIT_MULTIPLIER: 1.5, // 会心時のダメージ倍率
};
export const ECONOMY_CONFIG = {
    SELL_RATE: 0.6, // 売却額 = 購入価格 × この割合
};

// クエストUIの表示件数
export const QUEST_UI_CONFIG = {
    TRACKER_MAX_VISIBLE: 3, // 画面右上のトラッカーに同時表示する最大件数
    LOG_PER_PAGE: 4, // クエストウィンドウの1ページあたり件数
};

// 輪廻転生まわりの調整値
export const REINCARNATION_CONFIG = {
    REQUIRED_LEVEL: 100, // 輪廻転生に必要なレベル
    BASE_STAT_BONUS: 15, // 転生1回ごとにSTR/INT/VIT/MEN/DEXそれぞれへ永続加算される値
    BONUS_STAT_POINTS: 30, // 転生1回ごとに追加で貰える自由配分ステータスポイント
    // レベルアップの自然成長分（割り振り以外で増えた分）の合計に掛けてポイントへ換算する割合。
    // 残りは転生で捨てられる。0.1 = 合計の10分の1。
    NATURAL_GROWTH_REFUND_RATE: 0.1,
};

// adminモード（開発・動作確認用。ui/AdminUI.js 参照）
// Shift+@（または Ctrl+Alt+A）でパスワード入力 → 正しければ操作パネルが開く。
// ※ このパスワードはクライアントのJSに載るので、本格的な防御ではない。他の人に配るときは必ず変えること。
export const ADMIN_CONFIG = {
    PASSWORD: "mrpg-070208",
};

// AGI（敏捷性）: 敵の攻撃を一定確率で回避する。
// 回避率 = MAX_DODGE_CHANCE * agi / (agi + HALF_POINT) + パッシブ等の固定加算、を MAX_DODGE_CHANCE で頭打ちにする。
// 逓減カーブなので、振れば振るほど伸びるが上限（既定45%）を超えて敵の攻撃が全く当たらなくなることはない。
//   AGI 5 -> 約0.6%   AGI 100 -> 約10%   AGI 250 -> 約19%   AGI 500 -> 約27%   AGI 1000 -> 約33%（実測: test で確認済み）
// 上限そのものを変えたいときは MAX_DODGE_CHANCE だけ、伸び方（上限への近づきやすさ）は HALF_POINT を変える。
export const AGI_CONFIG = {
    BASE_AGI: 5, // 初期値（他の基本ステータスと同じ）
    MAX_DODGE_CHANCE: 0.45, // 回避率の絶対上限（ゲームバランスが崩れないよう、40〜50%を目安に）
    HALF_POINT: 350, // 回避率が上限の半分に達するAGI値
};

// ステータス/職業リセットアイテムの設定
export const RESET_CONFIG = {
    STAT_KEYS: ["str", "int", "vit", "men", "dex", "agi"], // 割り振り対象の基本ステータス
    BASE_VALUE: 5, // 各ステータスの初期値
};
