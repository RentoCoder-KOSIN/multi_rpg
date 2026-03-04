/**
 * 共通スキル（全職業で使用可能）
 * ヒール、バフなど支援系スキル
 */

export const BUFF_SKILLS = {
    attack_buff: {
        id: 'attack_buff',
        name: 'アタックブースト',
        type: 'active',
        cd: 30000,
        mpCost: 30,
        unlockCost: 100,
        range: 300,
        rangeType: 'circle',
        targetType: 'party',
        color: 0xff4500,
        icon: '⚔️',
        description: '味方の攻撃力を一定時間上昇させる。'
    },
    defense_buff: {
        id: 'defense_buff',
        name: 'プロテクション',
        type: 'active',
        cd: 30000,
        mpCost: 30,
        unlockCost: 100,
        range: 300,
        rangeType: 'circle',
        targetType: 'party',
        color: 0x4169e1,
        icon: '🛡️',
        description: '味方の防御力を一定時間上昇させる。'
    },
    speed_buff: {
        id: 'speed_buff',
        name: 'ヘイスト',
        type: 'active',
        cd: 30000,
        mpCost: 25,
        unlockCost: 100,
        range: 300,
        rangeType: 'circle',
        targetType: 'party',
        color: 0x00ffff,
        icon: '👟',
        description: '味方の移動速度を一定時間上昇させる。'
    },
    summon_boost: {
        id: 'summon_boost',
        name: 'サモンブースト',
        type: 'active',
        cd: 45000,
        mpCost: 50,
        unlockCost: 200,
        range: 500,
        rangeType: 'circle',
        targetType: 'party',
        color: 0x9370db,
        icon: '🐲',
        description: '味方の召喚獣を大幅に強化する。'
    },
    heal: {
        id: 'heal',
        name: 'ヒール',
        type: 'active',
        cd: 3000,
        healPower: 50,
        mpCost: 15,
        unlockCost: 40,
        range: 150,
        rangeType: 'circle',
        targetType: 'party',
        color: 0x00ff00,
        icon: '💚',
        description: '自分と周囲の味方のHPを回復する。'
    }
};
