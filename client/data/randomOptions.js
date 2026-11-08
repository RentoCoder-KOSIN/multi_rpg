/**
 * 装備のランダムOP（ハクスラ・エンチャント厳選システム）
 * ドロップした装備品にランダムでレアリティと追加オプション（神OP）が付与される。
 */

export const OPTION_RARITIES = {
    normal: { name: '一般', color: '#ffffff', slots: 0, prefix: '' },
    magic: { name: 'マジック', color: '#2ecc71', slots: 1, prefix: '【精巧な】' },
    rare: { name: 'レア', color: '#3498db', slots: 2, prefix: '【歴戦の】' },
    epic: { name: 'エピック', color: '#9b59b6', slots: 3, prefix: '【至高の】' },
    legendary: { name: 'レジェンダリー', color: '#f39c12', slots: 3, prefix: '【神話の】' }
};

// オプションのプール（追加能力）
export const OPTION_POOL = [
    {
        id: 'atk_pct',
        name: '攻撃力',
        unit: '%',
        prefix: '【剛力の】',
        min: 3,
        max: 15,
        type: ['weapon', 'relic'],
        apply: (stats, val) => { stats.atkMult = (stats.atkMult || 1) + val / 100; }
    },
    {
        id: 'def_pct',
        name: '防御力',
        unit: '%',
        prefix: '【鉄壁の】',
        min: 3,
        max: 15,
        type: ['armor', 'relic'],
        apply: (stats, val) => { stats.defMult = (stats.defMult || 1) + val / 100; }
    },
    {
        id: 'crit_chance',
        name: '会心率',
        unit: '%',
        prefix: '【必殺の】',
        min: 2,
        max: 10,
        type: ['weapon', 'relic'],
        apply: (stats, val) => { stats.critChance = (stats.critChance || 0) + val / 100; }
    },
    {
        id: 'max_hp',
        name: '最大HP',
        unit: '',
        prefix: '【壮健の】',
        min: 80,
        max: 800,
        type: ['armor', 'relic', 'weapon'],
        apply: (stats, val) => { stats.bonusMaxHp = (stats.bonusMaxHp || 0) + val; }
    },
    {
        id: 'max_mp',
        name: '最大MP',
        unit: '',
        prefix: '【智慧の】',
        min: 40,
        max: 400,
        type: ['weapon', 'relic', 'armor'],
        apply: (stats, val) => { stats.bonusMaxMp = (stats.bonusMaxMp || 0) + val; }
    },
    {
        id: 'speed_bonus',
        name: '移動速度',
        unit: '',
        prefix: '【疾風の】',
        min: 5,
        max: 20,
        type: ['armor', 'relic'],
        apply: (stats, val) => { stats.speedBonus = (stats.speedBonus || 0) + val; }
    },
    {
        id: 'lifesteal',
        name: 'HP吸収',
        unit: '%',
        prefix: '【吸血の】',
        min: 1,
        max: 4,
        type: ['weapon', 'relic'],
        apply: (stats, val) => { stats.lifesteal = (stats.lifesteal || 0) + val / 100; }
    },
    {
        id: 'cooldown_reduction',
        name: 'スキルCT短縮',
        unit: '%',
        prefix: '【神速の】',
        min: 3,
        max: 10,
        type: ['weapon', 'armor', 'relic'],
        apply: (stats, val) => { stats.cooldownReduction = (stats.cooldownReduction || 0) + val / 100; }
    },
    {
        id: 'all_resist',
        name: '全属性耐性',
        unit: '%',
        prefix: '【守護の】',
        min: 3,
        max: 12,
        type: ['armor', 'relic'],
        apply: (stats, val) => { stats.allStatusResist = (stats.allStatusResist || 0) + val; }
    }
];

/**
 * 敵のレベルやドロップ状況に応じたランダムオプションを生成する。
 * @param {string} itemType - 'weapon' | 'armor' | 'relic'
 * @param {number} monsterLevel - 倒したモンスターのレベル (1〜200+)
 * @returns {object|null} { rarity, prefix, displayName, options: [{ id, name, value, unit }] }
 */
export function rollRandomOptions(itemType, monsterLevel = 1) {
    if (itemType !== 'weapon' && itemType !== 'armor' && itemType !== 'relic') {
        return null;
    }

    // モンスターレベルが高いほど上位レアリティが出やすい
    // Lv1: normal 75%, magic 20%, rare 4.5%, epic 0.5%
    // Lv100+: normal 40%, magic 35%, rare 18%, epic 5%, legendary 2%
    // Lv150+: normal 25%, magic 35%, rare 25%, epic 11%, legendary 4%
    const roll = Math.random() * 100;
    let rarity = 'normal';

    const legChance = Math.min(5, 0.5 + (monsterLevel / 200) * 4.5);
    const epicChance = Math.min(12, 1.0 + (monsterLevel / 200) * 11.0);
    const rareChance = Math.min(25, 4.0 + (monsterLevel / 200) * 21.0);
    const magicChance = Math.min(40, 20.0 + (monsterLevel / 200) * 20.0);

    if (roll < legChance) rarity = 'legendary';
    else if (roll < legChance + epicChance) rarity = 'epic';
    else if (roll < legChance + epicChance + rareChance) rarity = 'rare';
    else if (roll < legChance + epicChance + rareChance + magicChance) rarity = 'magic';
    else rarity = 'normal';

    const rarityDef = OPTION_RARITIES[rarity];
    const slotCount = rarityDef.slots;
    if (slotCount === 0) return null;

    // タイプに合うOP候補を抽出
    const candidates = OPTION_POOL.filter(op => op.type.includes(itemType));
    Phaser.Utils.Array.Shuffle(candidates);

    const picked = candidates.slice(0, slotCount);
    // レアリティ倍率 (legendary は上限値近くが出やすい)
    const powerMult = rarity === 'legendary' ? 1.0 : (rarity === 'epic' ? 0.85 : (rarity === 'rare' ? 0.7 : 0.55));

    const options = picked.map(op => {
        const valRange = op.max - op.min;
        const baseVal = op.min + Math.round(valRange * (powerMult * 0.5 + Math.random() * powerMult * 0.5));
        const val = Math.max(op.min, Math.min(op.max, baseVal));
        return {
            id: op.id,
            name: op.name,
            value: val,
            unit: op.unit
        };
    });

    // メインOPのプレフィックスを採用
    const mainOpDef = OPTION_POOL.find(o => o.id === options[0]?.id);
    const prefix = mainOpDef ? mainOpDef.prefix : rarityDef.prefix;

    return {
        rarity,
        rarityName: rarityDef.name,
        color: rarityDef.color,
        prefix,
        options
    };
}
