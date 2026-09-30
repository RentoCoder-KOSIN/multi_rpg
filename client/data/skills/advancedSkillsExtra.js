/**
 * 上位職スキル（追加分）
 *
 * 基本職ごとに上位職を4つずつにするため追加した18職（各4スキル＝72スキル）。
 * 既存6職（ナイト/アークメイジ/パラディン/スナイパー/ハイサモナー/エクソシスト）の分は advancedSkills.js / passiveSkills.js。
 *
 * 各上位職は「アクティブ2つ + パッシブ2つ」（サポート型は味方対象スキル + パッシブ）。
 * 習得レベルは jobs.js 側（50 / 55 / 60 / 65）で決まる。
 *
 * 味方対象スキル（targetType: 'party'）は effect で挙動を決める（combat.js の applyPartySkill）:
 *   effect.healPower                       範囲内の味方を回復（INT・スキルレベル・healPowerMult で伸びる）
 *   effect.buffType / buffMult / buffDuration
 *                                          'attack_buff' | 'defense_buff' を、対象の現在ATK/DEFの buffMult 倍ぶん buffDuration(ms) のあいだ付与
 * 回避率を上げるパッシブは effect.dodgeChanceFlat（0.05 = +5%。合計は AGI_CONFIG.MAX_DODGE_CHANCE で頭打ち）。
 */
import { defineSkill } from '../schema.js';

const active = (def) => defineSkill({ type: 'active', unlockCost: 500, ...def });
const passive = (def) => defineSkill({ type: 'passive', unlockCost: 200, ...def });

export const ADVANCED_SKILLS_EXTRA = {

    // --- バーサーカー (fighterの上位職) ---
    rampage_slash: active({
        id: 'rampage_slash',
        name: '狂乱斬り',
        vfx: 'slash',
        cd: 5000,
        damageMult: 30,
        mpCost: 35,
        range: 200,
        rangeType: 'fan',
        color: 0xff3333,
        icon: '🪓',
        description: '理性を捨てた連続斬りで、前方の敵をまとめて薙ぎ払う。',
        maxTargets: 5
    }),
    blood_frenzy: active({
        id: 'blood_frenzy',
        name: '血の狂宴',
        vfx: 'blast',
        cd: 9000,
        damageMult: 38,
        mpCost: 50,
        range: 180,
        rangeType: 'circle',
        color: 0xaa0000,
        icon: '🩸',
        description: '自らを中心に猛り狂い、周囲の敵を切り刻む。'
    }),
    bloodlust: passive({
        id: 'bloodlust',
        name: '血の渇き',
        icon: '🧛',
        description: '常時：与ダメージの5%を吸収、攻撃力+6%',
        effect: {"lifestealFlat": 0.05, "atkMult": 1.06}
    }),
    berserk_heart: passive({
        id: 'berserk_heart',
        name: '狂戦士の心臓',
        icon: '❤️‍🔥',
        description: '常時：攻撃力+12%、防御力-5%',
        effect: {"atkMult": 1.12, "defMult": 0.95}
    }),

    // --- サムライ (fighterの上位職) ---
    iai_slash: active({
        id: 'iai_slash',
        name: '居合斬り',
        vfx: 'slash',
        cd: 4000,
        damageMult: 32,
        mpCost: 30,
        range: 260,
        rangeType: 'line',
        color: 0xe0e0ff,
        icon: '🗡️',
        description: '鞘走りの一閃。一瞬で間合いを詰め、直線上の敵を斬る。',
        hitType: 'single'
    }),
    moonlit_blade: active({
        id: 'moonlit_blade',
        name: '月影一閃',
        vfx: 'slash',
        element: 'wind',
        cd: 7000,
        damageMult: 26,
        mpCost: 40,
        range: 200,
        rangeType: 'fan',
        color: 0x99ccff,
        icon: '🌙',
        description: '月光のような弧を描く斬撃で、前方の敵を切り裂く。',
        maxTargets: 5
    }),
    bushido: passive({
        id: 'bushido',
        name: '武士道',
        icon: '🎌',
        description: '常時：会心率+8%、攻撃力+5%',
        effect: {"critChanceFlat": 0.08, "atkMult": 1.05}
    }),
    zanshin: passive({
        id: 'zanshin',
        name: '残心',
        icon: '🧘',
        description: '常時：スキルCT-10%、回避率+3%',
        effect: {"cooldownMult": 0.9, "dodgeChanceFlat": 0.03}
    }),

    // --- ドラゴンナイト (fighterの上位職) ---
    dragon_thrust: active({
        id: 'dragon_thrust',
        name: '竜牙突',
        vfx: 'slash',
        element: 'fire',
        cd: 5000,
        damageMult: 34,
        mpCost: 40,
        range: 300,
        rangeType: 'line',
        color: 0xff6633,
        icon: '🐉',
        description: '竜の牙のような一突き。直線上の敵を貫く。',
        hitType: 'single'
    }),
    dragon_breath: active({
        id: 'dragon_breath',
        name: '竜の息吹',
        vfx: 'blast',
        element: 'fire',
        cd: 10000,
        damageMult: 40,
        mpCost: 60,
        range: 260,
        rangeType: 'fan',
        color: 0xff4400,
        icon: '🔥',
        description: '竜の吐息を放ち、前方の敵を焼き尽くす。',
        maxTargets: 6
    }),
    dragon_scale: passive({
        id: 'dragon_scale',
        name: '竜鱗',
        icon: '🛡️',
        description: '常時：防御力+12%、最大HP+8%',
        effect: {"defMult": 1.12, "maxHpMult": 1.08}
    }),
    dragon_soul: passive({
        id: 'dragon_soul',
        name: '竜の魂',
        icon: '💠',
        description: '常時：攻撃力+10%、与ダメージの2%を吸収',
        effect: {"atkMult": 1.1, "lifestealFlat": 0.02}
    }),

    // --- エレメンタリスト (mageの上位職) ---
    flame_lance: active({
        id: 'flame_lance',
        name: 'フレイムランス',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'fire',
        cd: 4500,
        damageMult: 30,
        mpCost: 40,
        range: 280,
        rangeType: 'line',
        color: 0xff5533,
        icon: '🔥',
        description: '炎の槍を放ち、直線上の敵を貫く。',
        hitType: 'single'
    }),
    tempest_burst: active({
        id: 'tempest_burst',
        name: 'テンペストバースト',
        vfx: 'blast',
        element: 'wind',
        cd: 11000,
        damageMult: 42,
        mpCost: 80,
        range: 300,
        rangeType: 'circle',
        color: 0x66ffcc,
        icon: '🌪️',
        description: '嵐を爆発させ、周囲の敵を吹き飛ばす。'
    }),
    elemental_mastery: passive({
        id: 'elemental_mastery',
        name: '属性の極み',
        icon: '🌈',
        description: '常時：攻撃力+10%、MP消費-8%',
        effect: {"atkMult": 1.1, "mpCostMult": 0.92}
    }),
    prismatic_focus: passive({
        id: 'prismatic_focus',
        name: '虹色の集中',
        icon: '🔮',
        description: '常時：スキルCT-10%、会心率+4%',
        effect: {"cooldownMult": 0.9, "critChanceFlat": 0.04}
    }),

    // --- ウォーロック (mageの上位職) ---
    curse_bolt: active({
        id: 'curse_bolt',
        name: 'カースボルト',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'dark',
        cd: 4000,
        damageMult: 28,
        mpCost: 35,
        range: 260,
        rangeType: 'line',
        color: 0x9955cc,
        icon: '☠️',
        description: '呪いの弾を撃ち出し、直線上の敵を蝕む。',
        hitType: 'single'
    }),
    soul_drain: active({
        id: 'soul_drain',
        name: 'ソウルドレイン',
        vfx: 'blast',
        element: 'dark',
        cd: 8000,
        damageMult: 30,
        mpCost: 55,
        range: 200,
        rangeType: 'circle',
        color: 0x7733aa,
        icon: '👻',
        description: '周囲の敵の魂を削り取る。',
        maxTargets: 4
    }),
    dark_pact: passive({
        id: 'dark_pact',
        name: '闇の契約',
        icon: '📜',
        description: '常時：攻撃力+12%、与ダメージの3%を吸収',
        effect: {"atkMult": 1.12, "lifestealFlat": 0.03}
    }),
    forbidden_knowledge: passive({
        id: 'forbidden_knowledge',
        name: '禁断の知識',
        icon: '📕',
        description: '常時：最大MP+20%、MP消費-8%',
        effect: {"maxMpMult": 1.2, "mpCostMult": 0.92}
    }),

    // --- セージ (mageの上位職) ---
    thunder_judgment: active({
        id: 'thunder_judgment',
        name: 'サンダージャッジメント',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'thunder',
        cd: 6000,
        damageMult: 34,
        mpCost: 50,
        range: 300,
        rangeType: 'line',
        color: 0xffdd33,
        icon: '⚡',
        description: '天より雷を落とし、直線上の敵を撃つ。',
        hitType: 'single'
    }),
    arcane_ward: active({
        id: 'arcane_ward',
        name: 'アルケインウォード',
        targetType: 'party',
        vfx: 'support',
        cd: 25000,
        mpCost: 70,
        range: 320,
        rangeType: 'circle',
        color: 0x66aaff,
        icon: '🔰',
        description: '範囲内の味方に魔力の結界を張る。防御力+60%（18秒）。',
        effect: {"buffType": "defense_buff", "buffMult": 0.6, "buffDuration": 18000}
    }),
    sages_wisdom: passive({
        id: 'sages_wisdom',
        name: '賢者の知恵',
        icon: '📖',
        description: '常時：最大MP+25%、獲得経験値+5%',
        effect: {"maxMpMult": 1.25, "expMultBonus": 0.05}
    }),
    mana_flow: passive({
        id: 'mana_flow',
        name: '魔力の奔流',
        icon: '🌊',
        description: '常時：MP消費-20%',
        effect: {"mpCostMult": 0.8}
    }),

    // --- ウォーデン (tankの上位職) ---
    bulwark_bash: active({
        id: 'bulwark_bash',
        name: 'ブルワークバッシュ',
        vfx: 'blast',
        element: 'earth',
        cd: 6000,
        damageMult: 20,
        mpCost: 30,
        range: 140,
        rangeType: 'circle',
        color: 0xb0a080,
        icon: '🛡️',
        description: '大盾で周囲を殴りつけ、敵を押し返す。'
    }),
    fortress_aura: active({
        id: 'fortress_aura',
        name: 'フォートレスオーラ',
        targetType: 'party',
        vfx: 'support',
        cd: 30000,
        mpCost: 80,
        range: 350,
        rangeType: 'circle',
        color: 0xd4c090,
        icon: '🏰',
        description: '範囲内の味方の防御力を大きく高める。防御力+80%（20秒）。',
        effect: {"buffType": "defense_buff", "buffMult": 0.8, "buffDuration": 20000}
    }),
    ironwall: passive({
        id: 'ironwall',
        name: '鉄壁',
        icon: '🧱',
        description: '常時：防御力+20%',
        effect: {"defMult": 1.2}
    }),
    vital_bastion: passive({
        id: 'vital_bastion',
        name: '不落の砦',
        icon: '🏯',
        description: '常時：最大HP+20%、最大HP+100',
        effect: {"maxHpMult": 1.2, "maxHpFlat": 100}
    }),

    // --- アベンジャー (tankの上位職) ---
    vengeful_strike: active({
        id: 'vengeful_strike',
        name: 'ヴェンジフルストライク',
        vfx: 'slash',
        element: 'light',
        cd: 5000,
        damageMult: 26,
        mpCost: 35,
        range: 150,
        rangeType: 'circle',
        color: 0xffe066,
        icon: '⚔️',
        description: '怒りを込めた一撃を叩き込む。',
        hitType: 'single'
    }),
    wrath_of_the_fallen: active({
        id: 'wrath_of_the_fallen',
        name: '亡き者の怒り',
        vfx: 'blast',
        element: 'dark',
        cd: 12000,
        damageMult: 36,
        mpCost: 60,
        range: 220,
        rangeType: 'circle',
        color: 0x9955cc,
        icon: '💢',
        description: '倒れた者たちの怒りを解き放ち、周囲を薙ぎ払う。'
    }),
    grudge: passive({
        id: 'grudge',
        name: '怨恨',
        icon: '😠',
        description: '常時：与ダメージの5%を吸収',
        effect: {"lifestealFlat": 0.05}
    }),
    unyielding_wrath: passive({
        id: 'unyielding_wrath',
        name: '不屈の憤怒',
        icon: '🔥',
        description: '常時：攻撃力+10%、最大HP+10%',
        effect: {"atkMult": 1.1, "maxHpMult": 1.1}
    }),

    // --- ジャガーノート (tankの上位職) ---
    colossus_slam: active({
        id: 'colossus_slam',
        name: 'コロッサススラム',
        vfx: 'blast',
        element: 'earth',
        cd: 9000,
        damageMult: 38,
        mpCost: 50,
        range: 200,
        rangeType: 'circle',
        color: 0xcc9944,
        icon: '🦣',
        description: '巨体を叩きつけ、周囲の敵を粉砕する。'
    }),
    earthquake: active({
        id: 'earthquake',
        name: 'アースクエイク',
        vfx: 'blast',
        element: 'earth',
        cd: 14000,
        damageMult: 30,
        mpCost: 70,
        range: 320,
        rangeType: 'circle',
        color: 0xaa7733,
        icon: '🌋',
        description: '大地を揺らして広範囲の敵にダメージを与える。'
    }),
    titan_hide: passive({
        id: 'titan_hide',
        name: '巨人の皮膚',
        icon: '🦏',
        description: '常時：防御力+15%、最大HP+12%',
        effect: {"defMult": 1.15, "maxHpMult": 1.12}
    }),
    unstoppable: passive({
        id: 'unstoppable',
        name: '不動の進撃',
        icon: '🚂',
        description: '常時：最大HP+200、移動速度+10',
        effect: {"maxHpFlat": 200, "speedFlat": 10}
    }),

    // --- ニンジャ (rangerの上位職) ---
    shuriken_storm: active({
        id: 'shuriken_storm',
        name: '手裏剣乱舞',
        vfx: 'projectile',
        vfxOptions: {"projectile": "arc"},
        element: 'wind',
        cd: 4000,
        damageMult: 20,
        mpCost: 30,
        range: 240,
        rangeType: 'fan',
        color: 0xcccccc,
        icon: '🌀',
        description: '無数の手裏剣を投げ放つ。',
        maxTargets: 5
    }),
    shadow_assassinate: active({
        id: 'shadow_assassinate',
        name: '影討ち',
        vfx: 'slash',
        element: 'dark',
        cd: 6000,
        damageMult: 40,
        mpCost: 45,
        range: 220,
        rangeType: 'line',
        color: 0x442266,
        icon: '🥷',
        description: '影から飛び出し、直線上の敵を一撃で仕留める。',
        hitType: 'single'
    }),
    shadow_step: passive({
        id: 'shadow_step',
        name: '影歩き',
        icon: '👣',
        description: '常時：移動速度+30、回避率+5%',
        effect: {"speedFlat": 30, "dodgeChanceFlat": 0.05}
    }),
    killer_instinct: passive({
        id: 'killer_instinct',
        name: '殺気',
        icon: '🩸',
        description: '常時：会心率+10%',
        effect: {"critChanceFlat": 0.1}
    }),

    // --- ガンスリンガー (rangerの上位職) ---
    quick_draw: active({
        id: 'quick_draw',
        name: 'クイックドロウ',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        cd: 3000,
        damageMult: 24,
        mpCost: 25,
        range: 340,
        rangeType: 'line',
        color: 0xffcc66,
        icon: '🔫',
        description: '抜き撃ちで直線上の敵を撃ち抜く。',
        hitType: 'single'
    }),
    bullet_hell: active({
        id: 'bullet_hell',
        name: 'バレットヘル',
        vfx: 'projectile',
        vfxOptions: {"projectile": "arc"},
        cd: 8000,
        damageMult: 22,
        mpCost: 55,
        range: 300,
        rangeType: 'fan',
        color: 0xff9933,
        icon: '💥',
        description: '弾幕を張り、前方の敵を蜂の巣にする。',
        maxTargets: 6
    }),
    sharpshooter: passive({
        id: 'sharpshooter',
        name: '狙撃手の眼',
        icon: '👁️',
        description: '常時：会心率+8%、攻撃力+5%',
        effect: {"critChanceFlat": 0.08, "atkMult": 1.05}
    }),
    gun_kata: passive({
        id: 'gun_kata',
        name: 'ガンカタ',
        icon: '🎯',
        description: '常時：スキルCT-12%',
        effect: {"cooldownMult": 0.88}
    }),

    // --- ウィンドアーチャー (rangerの上位職) ---
    gale_arrow: active({
        id: 'gale_arrow',
        name: 'ゲイルアロー',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'wind',
        cd: 4000,
        damageMult: 28,
        mpCost: 35,
        range: 380,
        rangeType: 'line',
        color: 0x66ffcc,
        icon: '🏹',
        description: '風を纏った矢で、直線上の敵を射抜く。',
        hitType: 'single'
    }),
    storm_volley: active({
        id: 'storm_volley',
        name: 'ストームボレー',
        vfx: 'blast',
        element: 'wind',
        cd: 10000,
        damageMult: 30,
        mpCost: 65,
        range: 380,
        rangeType: 'circle',
        color: 0x33ddaa,
        icon: '🌪️',
        description: '嵐のような矢の雨を降らせる。'
    }),
    wind_veil: passive({
        id: 'wind_veil',
        name: '風の帳',
        icon: '🍃',
        description: '常時：回避率+6%、移動速度+25',
        effect: {"dodgeChanceFlat": 0.06, "speedFlat": 25}
    }),
    zephyr_focus: passive({
        id: 'zephyr_focus',
        name: '微風の集中',
        icon: '💨',
        description: '常時：会心率+6%、スキルCT-8%',
        effect: {"critChanceFlat": 0.06, "cooldownMult": 0.92}
    }),

    // --- ネクロマンサー (summonerの上位職) ---
    death_bolt: active({
        id: 'death_bolt',
        name: 'デスボルト',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'dark',
        cd: 4000,
        damageMult: 28,
        mpCost: 35,
        range: 280,
        rangeType: 'line',
        color: 0x9955cc,
        icon: '💀',
        description: '死の魔弾を放つ。',
        hitType: 'single'
    }),
    grave_call: active({
        id: 'grave_call',
        name: 'グレイヴコール',
        vfx: 'blast',
        element: 'dark',
        cd: 10000,
        damageMult: 34,
        mpCost: 65,
        range: 260,
        rangeType: 'circle',
        color: 0x664488,
        icon: '⚰️',
        description: '墓場から亡者の手を呼び出し、周囲の敵を掴み引きずる。'
    }),
    undead_pact: passive({
        id: 'undead_pact',
        name: '死者の盟約',
        icon: '🦴',
        description: '常時：同時召喚数+1、最大MP+10%',
        effect: {"maxSummonsFlat": 1, "maxMpMult": 1.1}
    }),
    soul_harvest: passive({
        id: 'soul_harvest',
        name: '魂の収穫',
        icon: '🌾',
        description: '常時：与ダメージの3%を吸収、攻撃力+8%',
        effect: {"lifestealFlat": 0.03, "atkMult": 1.08}
    }),

    // --- ビーストロード (summonerの上位職) ---
    primal_roar: active({
        id: 'primal_roar',
        name: 'プライマルロア',
        vfx: 'blast',
        element: 'earth',
        cd: 8000,
        damageMult: 26,
        mpCost: 50,
        range: 260,
        rangeType: 'circle',
        color: 0xcc9944,
        icon: '🦁',
        description: '原初の咆哮で周囲の敵を怯ませる。'
    }),
    wild_charge: active({
        id: 'wild_charge',
        name: 'ワイルドチャージ',
        vfx: 'slash',
        cd: 5000,
        damageMult: 32,
        mpCost: 40,
        range: 300,
        rangeType: 'line',
        color: 0xaa7733,
        icon: '🐗',
        description: '獣の突進力を借りて直線上の敵を突き飛ばす。',
        hitType: 'single'
    }),
    pack_leader: passive({
        id: 'pack_leader',
        name: '群れの長',
        icon: '🐺',
        description: '常時：同時召喚数+1、防御力+8%',
        effect: {"maxSummonsFlat": 1, "defMult": 1.08}
    }),
    wild_instinct: passive({
        id: 'wild_instinct',
        name: '野生の勘',
        icon: '🐾',
        description: '常時：獲得経験値+10%、最大HP+8%',
        effect: {"expMultBonus": 0.1, "maxHpMult": 1.08}
    }),

    // --- スピリットマスター (summonerの上位職) ---
    spirit_lance: active({
        id: 'spirit_lance',
        name: 'スピリットランス',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'light',
        cd: 4500,
        damageMult: 30,
        mpCost: 40,
        range: 300,
        rangeType: 'line',
        color: 0xfff2cc,
        icon: '🕊️',
        description: '光の精霊が槍となって敵を貫く。',
        hitType: 'single'
    }),
    spirit_storm: active({
        id: 'spirit_storm',
        name: 'スピリットストーム',
        vfx: 'blast',
        element: 'water',
        cd: 11000,
        damageMult: 38,
        mpCost: 75,
        range: 300,
        rangeType: 'circle',
        color: 0x3399ff,
        icon: '🌊',
        description: '水の精霊たちが渦を巻き、周囲の敵を飲み込む。'
    }),
    spirit_communion: passive({
        id: 'spirit_communion',
        name: '精霊との交信',
        icon: '🔔',
        description: '常時：スキルCT-12%、MP消費-10%',
        effect: {"cooldownMult": 0.88, "mpCostMult": 0.9}
    }),
    ethereal_veil: passive({
        id: 'ethereal_veil',
        name: '霊体の帳',
        icon: '👼',
        description: '常時：回避率+4%、最大MP+15%',
        effect: {"dodgeChanceFlat": 0.04, "maxMpMult": 1.15}
    }),

    // --- セイント (priestの上位職) ---
    holy_radiance: active({
        id: 'holy_radiance',
        name: 'ホーリーラディアンス',
        targetType: 'party',
        vfx: 'support',
        cd: 12000,
        mpCost: 70,
        range: 350,
        rangeType: 'circle',
        color: 0xffffaa,
        icon: '🌟',
        description: '聖なる光で範囲内の味方を大きく回復する。',
        effect: {"healPower": 180}
    }),
    benediction: active({
        id: 'benediction',
        name: 'ベネディクション',
        targetType: 'party',
        vfx: 'support',
        cd: 30000,
        mpCost: 90,
        range: 350,
        rangeType: 'circle',
        color: 0xffd700,
        icon: '🙏',
        description: '範囲内の味方に祝福を授ける。攻撃力+70%（18秒）。',
        effect: {"buffType": "attack_buff", "buffMult": 0.7, "buffDuration": 18000}
    }),
    divine_grace: passive({
        id: 'divine_grace',
        name: '神の恩寵',
        icon: '✨',
        description: '常時：回復量+35%',
        effect: {"healPowerMult": 1.35}
    }),
    saintly_aura: passive({
        id: 'saintly_aura',
        name: '聖者のオーラ',
        icon: '😇',
        description: '常時：最大HP+12%、最大MP+10%',
        effect: {"maxHpMult": 1.12, "maxMpMult": 1.1}
    }),

    // --- ウォープリースト (priestの上位職) ---
    holy_smash: active({
        id: 'holy_smash',
        name: 'ホーリースマッシュ',
        vfx: 'slash',
        element: 'light',
        cd: 5000,
        damageMult: 30,
        mpCost: 40,
        range: 130,
        rangeType: 'circle',
        color: 0xffee99,
        icon: '🔨',
        description: '聖なる力を込めたメイスの一撃。',
        hitType: 'single'
    }),
    sanctified_strike: active({
        id: 'sanctified_strike',
        name: 'サンクティファイドストライク',
        vfx: 'slash',
        element: 'light',
        cd: 8000,
        damageMult: 36,
        mpCost: 55,
        range: 200,
        rangeType: 'line',
        color: 0xfff2cc,
        icon: '⚜️',
        description: '聖別された衝撃波を放つ。アンデッド系に1.5倍のダメージ。',
        hitType: 'single',
        effect: {"vsUndead": 1.5}
    }),
    zealous_might: passive({
        id: 'zealous_might',
        name: '熱狂の力',
        icon: '💪',
        description: '常時：攻撃力+10%、防御力+8%',
        effect: {"atkMult": 1.1, "defMult": 1.08}
    }),
    holy_resolve: passive({
        id: 'holy_resolve',
        name: '聖なる決意',
        icon: '🕯️',
        description: '常時：最大HP+10%、与ダメージの2%を吸収',
        effect: {"maxHpMult": 1.1, "lifestealFlat": 0.02}
    }),

    // --- シャドウプリースト (priestの上位職) ---
    shadow_bolt: active({
        id: 'shadow_bolt',
        name: 'シャドウボルト',
        vfx: 'projectile',
        vfxOptions: {"projectile": "bolt"},
        element: 'dark',
        cd: 4000,
        damageMult: 30,
        mpCost: 38,
        range: 280,
        rangeType: 'line',
        color: 0x9955cc,
        icon: '🌑',
        description: '影の魔弾で直線上の敵を撃つ。',
        hitType: 'single'
    }),
    void_prison: active({
        id: 'void_prison',
        name: 'ヴォイドプリズン',
        vfx: 'blast',
        element: 'dark',
        cd: 11000,
        damageMult: 36,
        mpCost: 70,
        range: 260,
        rangeType: 'circle',
        color: 0x442266,
        icon: '🕳️',
        description: '虚無の檻を作り出し、周囲の敵を閉じ込めて蝕む。'
    }),
    dark_devotion: passive({
        id: 'dark_devotion',
        name: '闇への献身',
        icon: '🖤',
        description: '常時：攻撃力+12%、MP消費-8%',
        effect: {"atkMult": 1.12, "mpCostMult": 0.92}
    }),
    twilight_veil: passive({
        id: 'twilight_veil',
        name: '黄昏の帳',
        icon: '🌒',
        description: '常時：回避率+4%、会心率+5%',
        effect: {"dodgeChanceFlat": 0.04, "critChanceFlat": 0.05}
    }),
};
