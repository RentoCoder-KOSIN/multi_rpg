/**
 * パッシブスキル（常時発動）
 *
 * type: 'passive' のスキルは MP消費もクールタイムも無く、習得しているだけで
 * effect の内容が Player.js の applyEquipmentStats() で自動的に適用される。
 * 新しいパッシブを追加するときは、対応済みの effect キーを使うだけでよい
 * （Player.js 側にif文を増やす必要はない）:
 *
 *   atkMult, defMult, maxHpMult, maxHpFlat, maxMpFlat, maxMpMult,
 *   speedFlat, critChanceFlat, lifestealFlat, expMultBonus,
 *   cooldownMult, mpCostMult, healPowerMult, maxSummonsFlat
 */
import { defineSkill } from '../schema.js';

export const PASSIVE_SKILLS = {
    // --- ファイター系 ---
    fighting_spirit: defineSkill({
        id: 'fighting_spirit', name: '不屈の闘志', type: 'passive',
        unlockCost: 50, icon: '💪',
        description: '常時：攻撃力+10%',
        effect: { atkMult: 1.1 }
    }),
    counter_stance: defineSkill({
        id: 'counter_stance', name: '受け流しの構え', type: 'passive',
        unlockCost: 80, icon: '🥋',
        description: '常時：防御力+8%、会心率+3%',
        effect: { defMult: 1.08, critChanceFlat: 0.03 }
    }),

    // --- メイジ系 ---
    mana_well: defineSkill({
        id: 'mana_well', name: '魔力の源泉', type: 'passive',
        unlockCost: 50, icon: '💎',
        description: '常時：最大MP+50',
        effect: { maxMpFlat: 50 }
    }),

    // --- タンク系 ---
    immovable_body: defineSkill({
        id: 'immovable_body', name: '金剛の体', type: 'passive',
        unlockCost: 50, icon: '🗿',
        description: '常時：防御力+15%',
        effect: { defMult: 1.15 }
    }),
    stalwart_heart: defineSkill({
        id: 'stalwart_heart', name: '不撓の心', type: 'passive',
        unlockCost: 80, icon: '❤️',
        description: '常時：最大HP+20%',
        effect: { maxHpMult: 1.2 }
    }),
    retaliate: defineSkill({
        id: 'retaliate', name: '反撃の心得', type: 'passive',
        unlockCost: 80, icon: '🔁',
        description: '常時：与ダメージの3%を自身のHPとして吸収',
        effect: { lifestealFlat: 0.03 }
    }),

    // --- レンジャー系 ---
    wind_walker: defineSkill({
        id: 'wind_walker', name: '風の如く', type: 'passive',
        unlockCost: 50, icon: '🍃',
        description: '常時：移動速度+30',
        effect: { speedFlat: 30 }
    }),
    hunters_focus: defineSkill({
        id: 'hunters_focus', name: '狩人の集中', type: 'passive',
        unlockCost: 80, icon: '🎯',
        description: '常時：会心率+6%',
        effect: { critChanceFlat: 0.06 }
    }),

    // --- サモナー系 ---
    spirit_link: defineSkill({
        id: 'spirit_link', name: '精霊の共鳴', type: 'passive',
        unlockCost: 50, icon: '🔗',
        description: '常時：スキルのクールタイム-10%',
        effect: { cooldownMult: 0.9 }
    }),
    beast_bond: defineSkill({
        id: 'beast_bond', name: '獣との絆', type: 'passive',
        unlockCost: 80, icon: '🐾',
        description: '常時：獲得経験値+10%',
        effect: { expMultBonus: 0.1 }
    }),
    familiar_speed: defineSkill({
        id: 'familiar_speed', name: '精霊の加護', type: 'passive',
        unlockCost: 80, icon: '👻',
        description: '常時：移動速度+15',
        effect: { speedFlat: 15 }
    }),

    // --- プリースト系 ---
    blessed_vitality: defineSkill({
        id: 'blessed_vitality', name: '祝福の活力', type: 'passive',
        unlockCost: 50, icon: '🕊️',
        description: '常時：回復スキルの効果量+20%',
        effect: { healPowerMult: 1.2 }
    }),

    // --- 上位職: ナイト ---
    veteran_instinct: defineSkill({
        id: 'veteran_instinct', name: '歴戦の勘', type: 'passive',
        unlockCost: 200, icon: '🧭',
        description: '常時：攻撃力+8%、防御力+8%',
        effect: { atkMult: 1.08, defMult: 1.08 }
    }),
    last_stand: defineSkill({
        id: 'last_stand', name: '不退転', type: 'passive',
        unlockCost: 200, icon: '🛡️',
        description: '常時：最大HP+15%',
        effect: { maxHpMult: 1.15 }
    }),

    // --- 上位職: アークメイジ ---
    arcane_efficiency: defineSkill({
        id: 'arcane_efficiency', name: '魔力効率化', type: 'passive',
        unlockCost: 200, icon: '🔮',
        description: '常時：スキルのMP消費-15%',
        effect: { mpCostMult: 0.85 }
    }),
    mind_over_matter: defineSkill({
        id: 'mind_over_matter', name: '無限の魔力', type: 'passive',
        unlockCost: 200, icon: '🌌',
        description: '常時：最大MP+30%',
        effect: { maxMpMult: 1.3 }
    }),

    // --- 上位職: パラディン ---
    aegis_of_faith: defineSkill({
        id: 'aegis_of_faith', name: '信仰の守り', type: 'passive',
        unlockCost: 200, icon: '🔰',
        description: '常時：防御力+20%',
        effect: { defMult: 1.2 }
    }),
    retribution_aura: defineSkill({
        id: 'retribution_aura', name: '応報のオーラ', type: 'passive',
        unlockCost: 200, icon: '✨',
        description: '常時：与ダメージの4%を自身のHPとして吸収',
        effect: { lifestealFlat: 0.04 }
    }),

    // --- 上位職: スナイパー ---
    eagle_eye: defineSkill({
        id: 'eagle_eye', name: '鷹の眼', type: 'passive',
        unlockCost: 200, icon: '🦅',
        description: '常時：会心率+10%',
        effect: { critChanceFlat: 0.1 }
    }),
    swift_reload: defineSkill({
        id: 'swift_reload', name: '早撃ち', type: 'passive',
        unlockCost: 200, icon: '⏱️',
        description: '常時：スキルのクールタイム-15%',
        effect: { cooldownMult: 0.85 }
    }),

    // --- 上位職: ハイサモナー ---
    overlords_pact: defineSkill({
        id: 'overlords_pact', name: '魔王との盟約', type: 'passive',
        unlockCost: 200, icon: '📜',
        description: '常時：最大MP+25%、召喚獣を同時に2体まで呼び出せるようになる',
        effect: { maxMpMult: 1.25, maxSummonsFlat: 1 }
    }),
    ancient_bond: defineSkill({
        id: 'ancient_bond', name: '古の絆', type: 'passive',
        unlockCost: 200, icon: '🐉',
        description: '常時：獲得経験値+15%',
        effect: { expMultBonus: 0.15 }
    }),

    // --- 上位職: エクソシスト ---
    sanctified_ground: defineSkill({
        id: 'sanctified_ground', name: '聖別された地', type: 'passive',
        unlockCost: 200, icon: '⛪',
        description: '常時：回復スキルの効果量+30%',
        effect: { healPowerMult: 1.3 }
    }),
    unwavering_faith: defineSkill({
        id: 'unwavering_faith', name: '揺るがぬ信仰', type: 'passive',
        unlockCost: 200, icon: '🙏',
        description: '常時：防御力+15%',
        effect: { defMult: 1.15 }
    })
};
