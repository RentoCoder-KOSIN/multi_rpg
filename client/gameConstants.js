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
};
