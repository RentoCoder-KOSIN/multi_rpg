import { defineSkill } from '../schema.js';

function active(def) {
    return defineSkill({ ...def, type: 'active' });
}
function passive(def) {
    return defineSkill({ ...def, type: 'passive' });
}

export const ARTISAN_SKILLS = {
    // ===== 基本職: 職人 (Artisan) =====
    hammer_strike: active({
        id: 'hammer_strike',
        name: '鍛冶打撃',
        vfx: 'slash',
        vfxOptions: { slashColor: 0xffaa00 },
        cd: 3500,
        damageMult: 14,
        mpCost: 12,
        range: 100,
        rangeType: 'circle',
        color: 0xffaa00,
        icon: '🔨',
        description: '鍛冶槌で敵を力強く叩きつける。確率で敵を行動不能にする。',
        effect: { paralyzeChance: 0.35, paralyzeMs: 1800 }
    }),

    crafting_mastery: passive({
        id: 'crafting_mastery',
        name: '工匠の極意',
        icon: '⚒️',
        description: '生産技術の真髄。武具の扱いと手入れに習熟し、攻撃力・防御力+3%。',
        effect: { atkMult: 1.03, defMult: 1.03 }
    }),

    armor_reinforce: active({
        id: 'armor_reinforce',
        name: '防具補強',
        targetType: 'party',
        vfx: 'support',
        cd: 20000,
        mpCost: 30,
        range: 200,
        rangeType: 'circle',
        color: 0x4a90e2,
        icon: '🛡️',
        description: '一時的に自身の防具を締め直す。防御力+20%（15秒間）。',
        effect: { buffType: 'defense_buff', buffMult: 0.20, buffDuration: 15000 }
    }),

    metal_temper: passive({
        id: 'metal_temper',
        name: '焼入れの心得',
        icon: '🔥',
        description: '熱と金属への深い理解。攻撃力+4%、クリティカル率+3%。',
        effect: { atkMult: 1.04, critChanceFlat: 0.03 }
    }),

    explosive_flask: active({
        id: 'explosive_flask',
        name: '爆炎フラスコ',
        element: 'fire',
        vfx: 'blast',
        vfxOptions: { shake: true },
        cd: 6000,
        damageMult: 22,
        mpCost: 28,
        range: 220,
        rangeType: 'circle',
        color: 0xff4500,
        icon: '🧪',
        description: '調合した爆発性試薬を投げつけ、周囲の敵を吹き飛ばす火炎攻撃。',
        effect: { burnChance: 0.5, burnMs: 4000 }
    }),

    artisan_aura: passive({
        id: 'artisan_aura',
        name: '巨匠の息吹',
        icon: '✨',
        description: '熟練の職人が放つ集中力。最大HP+5%、スキルCD-5%。',
        effect: { maxHpMult: 1.05, cooldownMult: 0.95 }
    }),

    overclock_forge: active({
        id: 'overclock_forge',
        name: '限界鍛錬',
        vfx: 'support',
        cd: 25000,
        mpCost: 45,
        range: 0,
        rangeType: 'circle',
        color: 0xff6600,
        icon: '⚡',
        description: '工房の熱気を纏い、一時的に自身の攻撃速度と移動速度を大幅に引き上げる（12秒間）。',
        effect: { buffType: 'speed_buff', buffMult: 0.35, buffDuration: 12000 }
    }),

    // ===== 上位職: 名工 (Master Smith) =====
    grand_slam: active({
        id: 'grand_slam',
        name: '巨匠の剛撃',
        vfx: 'blast',
        vfxOptions: { shake: true },
        cd: 8000,
        damageMult: 45,
        mpCost: 40,
        range: 160,
        rangeType: 'circle',
        color: 0xff8800,
        icon: '💥',
        description: '鍛冶の大槌を全力で叩きつけ、大地を割る衝撃波で敵を一網打尽にする。'
    }),

    master_refine: passive({
        id: 'master_refine',
        name: '神器精錬',
        icon: '👑',
        description: '名工たる者の境地。全能力が向上する。攻撃力+5%、防御力+5%、HP+5%。',
        effect: { atkMult: 1.05, defMult: 1.05, maxHpMult: 1.05 }
    }),

    // ===== 上位職: 錬金術師 (Alchemist) =====
    acid_spray: active({
        id: 'acid_spray',
        name: 'アシッドスプレー',
        element: 'water',
        vfx: 'blast',
        cd: 7000,
        damageMult: 32,
        mpCost: 35,
        range: 240,
        rangeType: 'line',
        color: 0x00ff88,
        icon: '🧪',
        description: '強酸性の液体を直線上に放射し、敵の装甲を溶かしながら大ダメージを与える。'
    }),

    philosopher_stone: passive({
        id: 'philosopher_stone',
        name: '賢者の秘薬',
        icon: '💎',
        description: '錬金術の究極点。最大MP+6%、ライフスティール+2%、EXP獲得+5%。',
        effect: { maxMpMult: 1.06, lifestealFlat: 0.02, expMultBonus: 0.05 }
    }),

    // ===== 上位職: ルーンマスター (Runemaster) =====
    rune_shield: active({
        id: 'rune_shield',
        name: 'ルーンバリア',
        targetType: 'party',
        vfx: 'support',
        cd: 22000,
        mpCost: 50,
        range: 250,
        rangeType: 'circle',
        color: 0xaa44ff,
        icon: '🔮',
        description: '古代ルーンの結界を展開し、パーティ全体の受けるダメージを軽減する。',
        effect: { buffType: 'defense_buff', buffMult: 0.25, buffDuration: 15000 }
    }),

    enchanted_weapon: passive({
        id: 'enchanted_weapon',
        name: 'ルーンエンチャント',
        icon: '⚡',
        description: '武器に古代文字の魔力を刻み込む。会心率+4%、スキルCD-5%、攻撃力+5%。',
        effect: { critChanceFlat: 0.04, cooldownMult: 0.95, atkMult: 1.05 }
    })
};
