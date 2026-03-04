/**
 * メイジスキル
 * 高い攻撃力を誇るが、防御力が低い魔法職
 */

export const MAGE_SKILLS = {
    fireball: {
        id: 'fireball',
        name: 'ファイアボール',
        type: 'active',
        cd: 3000,
        damageMult: 7.2,
        mpCost: 10,
        unlockCost: 10,
        range: 150,
        rangeType: 'circle',
        color: 0xff4500,
        icon: '🔥',
        description: '火球を放つ。'
    },
    ice_needle: {
        id: 'ice_needle',
        name: 'アイスニードル',
        type: 'active',
        cd: 4000,
        damageMult: 10,
        mpCost: 15,
        unlockCost: 30,
        range: 180,
        rangeType: 'fan',
        color: 0xadd8e6,
        icon: '❄️',
        description: '氷の針を扇状に放つ。'
    },
    big_fireball: {
        id: 'big_fireball',
        name: '爆裂魔法',
        type: 'active',
        cd: 5000,
        damageMult: 12,
        mpCost: 25,
        unlockCost: 50,
        range: 200,
        rangeType: 'circle',
        color: 0xff8c00,
        icon: '☄️',
        description: '巨大な爆発を引き起こす。'
    },
    dark_nova: {
        id: 'dark_nova',
        name: 'ダークノヴァ',
        type: 'active',
        cd: 8000,
        damageMult: 15,
        mpCost: 30,
        unlockCost: 80,
        range: 200,
        rangeType: 'circle',
        color: 0x4b0082,
        icon: '🌑',
        description: '闇の爆発を周囲に引き起こす。'
    },
    meteor_swarm: {
        id: 'meteor_swarm',
        name: 'メテオスウォーム',
        type: 'active',
        cd: 15000,
        damageMult: 25,
        mpCost: 60,
        unlockCost: 100,
        range: 250,
        rangeType: 'circle',
        color: 0xff0000,
        icon: '☄️',
        description: '隕石を降らせて広範囲を焼き払う。'
    },
    thunder_storm: {
        id: 'thunder_storm',
        name: 'サンダーストーム',
        type: 'active',
        cd: 12000,
        damageMult: 18,
        mpCost: 40,
        unlockCost: 80,
        range: 150,
        rangeType: 'circle',
        color: 0xffff00,
        icon: '⚡',
        description: '自身の周囲に雷を落とし続ける。'
    }
};
