/**
 * ファイタースキル
 * 攻撃力と防御力のバランスが良い近接職
 */

export const FIGHTER_SKILLS = {
    slash: {
        id: 'slash',
        name: 'スラッシュ',
        type: 'active',
        cd: 1500,
        damageMult: 9.5,
        mpCost: 5,
        unlockCost: 10,
        range: 80,
        rangeType: 'circle',
        color: 0xffffff,
        icon: '⚔️',
        description: '力強く斬りつける。'
    },
    whirlwind: {
        id: 'whirlwind',
        name: 'ホイールウィンド',
        type: 'active',
        cd: 4000,
        damageMult: 12,
        mpCost: 15,
        unlockCost: 30,
        range: 120,
        rangeType: 'circle',
        color: 0x87ceeb,
        icon: '🌪️',
        description: '回転斬りで周囲をなぎ倒す。'
    },
    heavy_slash: {
        id: 'heavy_slash',
        name: 'ヘビースラッシュ',
        type: 'active',
        cd: 3000,
        damageMult: 15,
        mpCost: 15,
        unlockCost: 50,
        range: 100,
        rangeType: 'circle',
        color: 0xff0000,
        icon: '🗡️',
        description: '渾身の一撃。'
    },
    sonic_wave: {
        id: 'sonic_wave',
        name: 'ソニックウェーブ',
        type: 'active',
        cd: 3000,
        damageMult: 8,
        mpCost: 12,
        unlockCost: 30,
        range: 200,
        rangeType: 'line',
        color: 0x00ffff,
        icon: '🌊',
        description: '衝撃波を前方に飛ばす。'
    },
    ground_smash: {
        id: 'ground_smash',
        name: '地裂斬',
        type: 'active',
        cd: 8000,
        damageMult: 20,
        mpCost: 25,
        unlockCost: 100,
        range: 150,
        rangeType: 'circle',
        color: 0x8b4513,
        icon: '🔨',
        description: '地面を叩き割り、広範囲にダメージを与える。'
    }
};
