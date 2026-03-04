/**
 * パッシブスキル（全職業共通）
 * 常時効果を持つスキル
 */

export const PASSIVE_SKILLS = {
    fighting_spirit: {
        id: 'fighting_spirit',
        name: '不屈の闘志',
        type: 'passive',
        unlockCost: 50,
        icon: '💪',
        description: '常時：攻撃力+10%'
    },
    mana_well: {
        id: 'mana_well',
        name: '魔力の源泉',
        type: 'passive',
        unlockCost: 50,
        icon: '💎',
        description: '常時：最大MP+50'
    },
    immovable_body: {
        id: 'immovable_body',
        name: '金剛の体',
        type: 'passive',
        unlockCost: 50,
        icon: '🗿',
        description: '常時：防御力+15%'
    },
    wind_walker: {
        id: 'wind_walker',
        name: '風の如く',
        type: 'passive',
        unlockCost: 50,
        icon: '🍃',
        description: '常時：移動速度+30'
    },
    spirit_link: {
        id: 'spirit_link',
        name: '精霊の共鳴',
        type: 'passive',
        unlockCost: 50,
        icon: '🔗',
        description: '常時：召喚維持コスト-50%'
    }
};
