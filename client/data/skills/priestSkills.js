/**
 * プリーストスキル
 * 神の祝福を授ける聖職者。仲間の能力を強化する。
 */

export const PRIEST_SKILLS = {
    holy_arrow: {
        id: 'holy_arrow',
        name: 'ホーリーアロー',
        type: 'active',
        cd: 2000,
        damageMult: 12,
        mpCost: 8,
        unlockCost: 20,
        range: 250,
        rangeType: 'line',
        color: 0xffd700,
        icon: '✨',
        description: '聖なる光の矢を放ち、邪悪を浄化する。'
    }
};
