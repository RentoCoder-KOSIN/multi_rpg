// 他のモジュールをimportしない、依存関係のない定数専用ファイル。
// config.js は Scene クラス群をimportしており、Scene側からさかのぼって
// config.js の値を参照するモジュール（SkillBarUI.js など）があると循環importになり、
// 「Cannot access '...' before initialization」エラーの原因になる。
// 複数箇所から参照する軽量な定数はこちらに置く。

// スキルスロット数（アクティブスキルバー / スキルマネージャー / キー入力で共有）
export const TOTAL_SKILL_SLOTS = 8;

// 移動速度（speed）の調整値
// 転生や高DEXによる過度なインフレ（画面外飛び・操作不能・燃え尽き）を防ぐ上限設定
export const SPEED_CONFIG = {
    BASE_SPEED: 150,          // 基礎移動速度
    MAX_SPEED_BONUS: 200,     // DEX・パッシブ・装備によるボーナスの合計上限 (150 + 200 = 350)
    MAX_TOTAL_SPEED: 400,     // バフ等を含めた最終移動速度の絶対上限
};

// レベル・成長上限
export const LEVEL_CONFIG = {
    MAX_LEVEL: 200,           // レベルキャップ (100 -> 200)
    REINCARNATION_MIN_LEVEL: 100, // 輪廻転生可能になる最低レベル
};

// 経験値・成長関連の調整値
export const GROWTH_CONFIG = {
    // 装備の「経験値2倍」等の効果は、このレベル以下でのみ発動する
    EXP_MULTIPLIER_LEVEL_CAP: 25,
    // ジョブ経験値は、通常の経験値のこの割合だけ獲得する（1.0=同量、簡単に貯まりすぎるため抑制）
    JOB_EXP_RATE: 0.15,
    // 敵を倒した時のEXPは控えめにし、成長の主な報酬をクエストに寄せる。
    ENEMY_EXP_MULTIPLIER: 0.35,
    QUEST_EXP_MULTIPLIER: 10,
    // レベル不足の装備でも最低限は性能を発揮する割合。
    UNDERLEVEL_EQUIPMENT_MIN_POWER: 0.20,

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

    // --- 火力バランスのつまみ（全職業・全スキルにまとめて効く） ---
    // 通常攻撃に比べてスキルが強すぎた（約5倍）ため、スキル全体を少し下げ、通常攻撃を少し上げている。
    // 1.0 = 各スキルの damageMult どおり。バランスを見て 0.5〜1.2 くらいの範囲で調整する。
    SKILL_DAMAGE_SCALE: 0.85,
    // 通常攻撃（Space）のダメージ倍率。MPを使わない攻撃にも「使う価値」を残すため。
    BASIC_ATTACK_MULT: 1.4,
    // スキルレベル1つごとの威力アップ割合（以前は 0.15。Lv10で2.35倍→1.9倍）。召喚獣のレベル補正も同じ値を使う。
    SKILL_LEVEL_BONUS: 0.08,
    // 会心率の上限。DEXは自然成長でも増えるため、上限が無いとLv60台で会心率が常時100%近くになる。
    CRIT_CHANCE_CAP: 0.75,
};

// 「種」による永続ステータスアップの上限。
// 上限が無いと、ゴールドを稼ぐほど無限に強くなって、終盤のバランスが成り立たない。
// 上限に達すると、それ以上は使えない（消費もしない）。
export const SEED_CONFIG = {
    MAX_BONUS_ATK: 300,
    MAX_BONUS_DEF: 150,
};
export const ECONOMY_CONFIG = {
    SELL_RATE: 0.6, // 売却額 = 購入価格 × この割合
};

// クエストUIの表示件数
export const QUEST_UI_CONFIG = {
    TRACKER_MAX_VISIBLE: 3, // 画面右上のトラッカーに同時表示する最大件数
    LOG_PER_PAGE: 4, // クエストウィンドウの1ページあたり件数
};

// 輪廻転生まわりの調整値（アヴァベルオンライン・イザナギオンライン参考の育成設計）
export const REINCARNATION_CONFIG = {
    REQUIRED_LEVEL: 100, // 輪廻転生に必要なレベル
    BASE_STAT_BONUS: 3,  // 転生1回ごとに全基礎ステータスへ永続加算（過剰なインフレを防ぐ適正値）
    BONUS_STAT_POINTS: 20, // 転生1回ごとに獲得できる永続ボーナスポイント（転生ポイント）
    
    // ステータス割り振り上限（ステータスカウンター）
    STAT_CAP_BASE: 120, // 未転生時の各ステータス割り振り上限
    STAT_CAP_PER_COUNT: 15, // 転生1回ごとに開放される割り振り上限（特化ビルドの幅が広がる）
    
    MAX_SCALED_COUNT: 10, // 転生ボーナス・周回スケーリングの上限回数（際限のないインフレを防止）
    
    // --- 周回補正（敵の手応えと報酬のバランス）---
    ENEMY_DAMAGE_PER_COUNT: 0.05, // 1回転生するごとに、被ダメージ +5% (最大 +50%)
    REWARD_BONUS_PER_COUNT: 0.10, // 1回転生するごとに、経験値・ゴールド +10% (最大 +100%)
    
    NATURAL_GROWTH_REFUND_RATE: 0, // レベルアップ自然成長の返還によるポイント膨張は廃止
};

// 転生回数に応じた倍率（Player.js から使う）
export function getRebirthDamageTakenMult(count = 0) {
    return 1 + Math.min(count, REINCARNATION_CONFIG.MAX_SCALED_COUNT) * REINCARNATION_CONFIG.ENEMY_DAMAGE_PER_COUNT;
}
export function getRebirthRewardMult(count = 0) {
    return 1 + Math.min(count, REINCARNATION_CONFIG.MAX_SCALED_COUNT) * REINCARNATION_CONFIG.REWARD_BONUS_PER_COUNT;
}

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
