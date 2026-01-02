export const ITEMS = {
    // --- 武器 ---
    beginner_sword: {
        id: 'beginner_sword',
        name: '初心者の剣',
        type: 'weapon',
        atk: 5,
        lvlReq: 1,
        price: 150,
        description: '駆け出しの冒険者が使う剣。'
    },
    beginner_staff: {
        id: 'beginner_staff',
        name: '初心者の杖',
        type: 'weapon',
        atk: 3,
        matk: 5,
        lvlReq: 1,
        price: 200,
        description: '魔法の初歩を学ぶための杖。'
    },
    wooden_bow: {
        id: 'wooden_bow',
        name: '木の弓',
        type: 'weapon',
        atk: 4,
        lvlReq: 1,
        price: 180,
        description: '狩猟用のシンプルな弓。'
    },

    exp_weapon: {
        id: 'exp_weapon',
        name: '経験値増加の武器',
        type: 'weapon',
        atk: 3,
        lvlReq: 1,
        price: 750,
        expMultiplier: 2,
        description: '獲得経験値を2倍にする初心者に優しい武器。'
    },

    hero_sword: {
        id: 'hero_sword',
        name: '勇者の剣',
        type: 'weapon',
        atk: 50,
        lvlReq: 50,
        price: 2500,
        description: '伝説の輝きを放つ聖剣。会心率+10%',
        critChance: 0.1
    },

    // --- 防具 ---
    iron_shield: {
        id: 'iron_shield',
        name: '鉄の盾',
        type: 'armor',
        def: 5,
        lvlReq: 5,
        price: 300,
        description: '頑丈な鉄の盾。'
    },
    plate_armor: {
        id: 'plate_armor',
        name: 'プレートメイル',
        type: 'armor',
        def: 12,
        lvlReq: 25,
        price: 800,
        description: '全身を保護する重厚な鎧。'
    },

    // --- 消耗品 ---
    potion: {
        id: 'potion',
        name: 'ポーション',
        type: 'item',
        heal: 50,
        price: 50,
        description: 'HPを50回復する魔法の薬。'
    },
    high_potion: {
        id: 'high_potion',
        name: 'ハイポーション',
        type: 'item',
        heal: 200,
        price: 250,
        description: 'HPを200回復する強力な薬。'
    },
    mp_potion: {
        id: 'mp_potion',
        name: 'MPポーション',
        type: 'consumable',
        healMp: 50,
        price: 50,
        description: 'MPを50回復する魔法の薬。'
    },
    high_mp_potion: {
        id: 'high_mp_potion',
        name: 'ハイMPポーション',
        type: 'consumable',
        healMp: 200,
        price: 250,
        description: 'MPを200回復する強力な魔法の薬。'
    },

    wood_sword: {
        id: "wood_sword",
        name: "木の剣",
        description: "扱いやすい入門用の剣。",
        price: 60,
        type: "weapon",
        lvlReq: 1,
        stats: { attack: 4 }
    },
    iron_sword: {
        id: "iron_sword",
        name: "鉄の剣",
        description: "しっかり鍛えられた鋼の剣。",
        price: 120,
        type: "weapon",
        lvlReq: 10,
        stats: { attack: 15 }
    },
    bronze_spear: {
        id: "bronze_spear",
        name: "ブロンズスピア",
        description: "間合いを活かせる槍。",
        price: 150,
        type: "weapon",
        lvlReq: 15,
        stats: { attack: 22 }
    },
    travel_cloak: {
        id: "travel_cloak",
        name: "旅人のマント",
        description: "砂ぼこりから身を守るマント。",
        price: 90,
        type: "armor",
        lvlReq: 5,
        stats: { defense: 5 }
    },
    menno_kayaku: {
        id: "menno_kayaku",
        name: "めんのかやく",
        description: "スタミナ全快の予感。",
        price: 250,
        type: "consumable",
        stats: { heal: 500 }
    },
    "eatable_negi": {
        id: "eatable_negi",
        name: "食べられるねぎ",
        description: "健康に良いねぎ。",
        price: 150,
        type: "consumable",
        stats: { heal: 250 }
    },
    "heal_potion_small": {
        id: "heal_potion_small",
        name: "回復薬",
        description: "小さな回復薬。",
        price: 50,
        type: "consumable",
        stats: { heal: 70 }
    },
    "heal_potion_large": {
        id: "heal_potion_large",
        name: "万能薬",
        description: "よく効く傷薬。",
        price: 400,
        type: "consumable",
        stats: { heal: 700 }
    },
    "heal_izumi": {
        id: "heal_izumi",
        name: "回復の泉",
        description: "味方全員HP200回復",
        price: 500,
        type: "consumable",
        stats: { healAll: 200 },
    },
    "power_seed": {
        id: "power_seed",
        name: "攻撃力の種",
        description: "攻撃力を永久に+5する魔法の種。",
        price: 1000,
        type: "consumable",
        stats: { attackBoost: 5 },
    },
    "shield_seed": {
        id: "shield_seed",
        name: "防御力の種",
        description: "防御力を永久に+3する魔法の種。",
        price: 1000,
        type: "consumable",
        stats: { defenseBoost: 3 },
    },
    "magic_seed": {
        id: "magic_seed",
        name: "魔法の種",
        description: "攻撃&防御力大幅アップ",
        price: 4000,
        type: "consumable",
        stats: { attackBoost: 15, defenseBoost: 10 },
    },
    "negi_sword": {
        id: "negi_sword",
        name: "真・ネギ丸",
        description: "鋭利な野菜。移動速度+20",
        price: 2000,
        type: "weapon",
        lvlReq: 40,
        stats: { attack: 85, speedBonus: 20 }
    },
    "wood_stick": {
        id: "wood_stick",
        name: "木の棒",
        description: "その辺に落ちていた棒。",
        price: 10,
        type: "weapon",
        lvlReq: 1,
        stats: { attack: 2 },
    },
    "ice_wings": {
        id: "ice_wings",
        name: "氷の翼",
        description: "絶対零度の魔力を秘めた翼。移動速度+40",
        price: 15000,
        type: "weapon",
        lvlReq: 65,
        stats: { attack: 280, iceDamage: 50, freezeChance: 0.1, speedBonus: 40 },
    },
    "fire_sword": {
        id: "fire_sword",
        name: "炎の剣・プロメテウス",
        description: "獄炎の剣。会心率+15%",
        price: 25000,
        type: "weapon",
        lvlReq: 75,
        stats: { attack: 450, fireDamage: 30, critChance: 0.15 },
    },
    "cheat_sword": {
        id: "cheat_sword",
        name: "世界を穿つ審判の剣",
        description: "理（ことわり）を破壊する最強の剣。唯一無二。",
        price: 9999999999,
        type: "weapon",
        lvlReq: 100,
        stats: { attack: 99999 },
    },
    "brass_knuckles": {
        id: "brass_knuckles",
        name: "メリケンサック",
        description: "武闘家のための鉄拳。",
        price: 500,
        type: "weapon",
        lvlReq: 20,
        stats: { attack: 110 },
    },
    "ganble_stick": {
        id: "ganble_stick",
        name: "運否天賦の杖",
        description: "使い手の運次第で威力が激変する。 (ATK 1~150変動)",
        price: 20,
        type: "weapon",
        lvlReq: 10,
        stats: { attack: 20 },
        calculateAtk: (baseAtk, player) => {
            // ベース攻撃力に関わらず 1~150 の間で変動
            return Math.floor(Math.random() * 150) + 1;
        }
    },
    "dragon_bow": {
        id: "dragon_bow",
        name: "ドラゴンスレイヤーの弓",
        description: "竜の骨を削り出した巨大な剛弓。",
        price: 45000,
        type: "weapon",
        lvlReq: 85,
        stats: { attack: 720 },
    },
    "leather_armor": {
        id: "leather_armor",
        name: "革の軽鎧",
        description: "動きやすさを重視した防具。",
        price: 200,
        type: "armor",
        lvlReq: 5,
        stats: { defense: 10 },
    },
    "fire_armor": {
        id: "fire_armor",
        name: "ファイア・プレート",
        description: "火炎耐性を持つ灼熱の金属鎧。",
        price: 6000,
        type: "armor",
        lvlReq: 45,
        stats: { defense: 45, fireResist: 20 },
    },
    "ice_armor": {
        id: "ice_armor",
        name: "フロスト・メイル",
        description: "冷気を纏う美しい防具。",
        price: 5500,
        type: "armor",
        lvlReq: 40,
        stats: { defense: 40, iceResist: 25 },
    },
    "cheat_armor": {
        id: "cheat_armor",
        name: "悠久の守護神鎧",
        description: "あらゆる攻撃を無効化する神の鎧。",
        price: 9999999999,
        type: "armor",
        lvlReq: 100,
        stats: { defense: 99999 },
    },
    "dragon_scale_armor": {
        id: "dragon_scale_armor",
        name: "ドラゴンスケールアーマー",
        description: "竜の鱗を用いた最強に近い防具。",
        price: 80000,
        type: "armor",
        lvlReq: 90,
        stats: { defense: 150, fireResist: 50, iceResist: 50 },
    },

    // --- 死のショップ用 ---
    "death_scythe": {
        id: "death_scythe",
        name: "死神の鎌",
        description: "魂を刈り取る魔具。HPが低い敵ほど威力が上がる。",
        price: 150000,
        type: "weapon",
        lvlReq: 70,
        stats: { attack: 300, deathChance: 0.1, lifesteal: 0.05 },
        calculateAtk: (baseAtk, player, target) => {
            if (!target) return baseAtk;
            // 相手の残りHP割合に応じてダメージ上昇 (最大2倍)
            const hpRatio = target.hp / target.maxHp;
            const multiplier = 1 + (1 - hpRatio);
            return Math.ceil(baseAtk * multiplier);
        }
    },
    "resurrection_scroll": {
        id: "resurrection_scroll",
        name: "復活の秘巻物",
        description: "一度きり、死の淵から帰還できる。",
        price: 5000,
        type: "consumable",
        stats: { revive: true }
    },
    "cursed_ring": {
        id: "cursed_ring",
        name: "破滅と再生の指輪",
        description: "力と引き換えに命を削る呪いの装備。",
        price: 30000,
        type: "armor",
        lvlReq: 50,
        stats: { attackMultiplier: 2.0, poison: true }
    }
};

