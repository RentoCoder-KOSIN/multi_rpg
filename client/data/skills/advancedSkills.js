/**
 * 上位職スキル（レベル30以上）
 * ナイト、アークメイジ、パラディン、スナイパー、ハイサモナー用
 */

export const ADVANCED_SKILLS = {
    // ナイト (騎士 - ファイター上位職)
    judgment_cut: {
        id: 'judgment_cut',
        name: '絶・次元斬',
        type: 'active',
        cd: 4000,
        damageMult: 35,
        mpCost: 40,
        unlockCost: 500,
        range: 250,
        rangeType: 'line',
        color: 0x00ffff,
        icon: '💠',
        description: '空間を切り裂く超高速の一閃。'
    },

    // アークメイジ (メイジ上位職)
    abyss_storm: {
        id: 'abyss_storm',
        name: 'アビスストーム',
        type: 'active',
        cd: 12000,
        damageMult: 45,
        mpCost: 100,
        unlockCost: 500,
        range: 350,
        rangeType: 'circle',
        color: 0x4b0082,
        icon: '🌀',
        description: '深淵の嵐を呼び寄せ、全てを飲み込む。'
    },

    // パラディン (タンク上位職)
    holy_sanctuary: {
        id: 'holy_sanctuary',
        name: 'ホーリーサンクチュアリ',
        type: 'active',
        cd: 20000,
        damageMult: 15,
        mpCost: 80,
        unlockCost: 500,
        range: 300,
        rangeType: 'circle',
        color: 0xffff00,
        icon: '✝️',
        description: '神聖な領域を展開し、敵には裁きを、味方には加護を。'
    },

    // スナイパー (レンジャー上位職)
    death_rain: {
        id: 'death_rain',
        name: 'デスレイン',
        type: 'active',
        cd: 6000,
        damageMult: 22,
        mpCost: 45,
        unlockCost: 500,
        range: 400,
        rangeType: 'circle',
        color: 0x00ff00,
        icon: '🏹',
        description: '空から無数の死の矢を降らせる。'
    },

    // ハイサモナー (サモナー上位職)
    demon_lord_summon: {
        id: 'demon_lord_summon',
        name: '魔王召喚',
        type: 'active',
        cd: 60000,
        mpCost: 200,
        unlockCost: 1000,
        color: 0xff0000,
        icon: '👑',
        description: '伝説の魔王を一時的に現世に呼び出す。'
    }
};
