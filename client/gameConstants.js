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
