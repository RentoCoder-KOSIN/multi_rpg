/**
 * レンジャースキル
 * 素早い動きで敵を翻弄する遠距離職
 */

export const RANGER_SKILLS = {
    rapid_fire: {
        id: 'rapid_fire',
        name: 'ラピッドファイア',
        type: 'active',
        cd: 2000,
        damageMult: 5,
        mpCost: 12,
        unlockCost: 50,
        range: 250,
        rangeType: 'circle',
        color: 0x00ff00,
        icon: '🏹',
        description: '目にも止まぬ速射。'
    },
    arrow_rain: {
        id: 'arrow_rain',
        name: 'アローレイン',
        type: 'active',
        cd: 5000,
        damageMult: 10,
        mpCost: 20,
        unlockCost: 100,
        range: 300,
        rangeType: 'circle',
        color: 0x9acd32,
        icon: '🌧️',
        description: '矢の雨を降らせる。'
    },
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
