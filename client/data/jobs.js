export const JOBS = {
    fighter: {
        id: 'fighter',
        type: 'physical',
        name: 'ファイター',
        description: '攻撃力と防御力のバランスが良い近接職',
        atkBonus: 5,
        defBonus: 2,
        hpBonus: 20,
        skills: {
            1: ['slash'],
            3: ['whirlwind'],
            5: ['heavy_slash'],
            7: ['sonic_wave'],
            10: ['ground_smash'],
            15: ['fighting_spirit']
        },
        nextJob: 'knight'
    },
    mage: {
        id: 'mage',
        type: 'magical',
        name: 'メイジ',
        description: '高い攻撃力を誇るが、防御力が低い魔法職',
        atkBonus: 10,
        defBonus: 0,
        hpBonus: -10,
        skills: {
            1: ['fireball'],
            3: ['ice_needle'],
            5: ['big_fireball'],
            8: ['dark_nova'],
            10: ['meteor_swarm'],
            12: ['thunder_storm'],
            15: ['mana_well']
        },
        nextJob: 'archmage'
    },
    tank: {
        id: 'tank',
        type: 'physical',
        name: 'タンク',
        description: '圧倒的な防御力と体力を誇る守りの要',
        atkBonus: 2,
        defBonus: 10,
        hpBonus: 50,
        skills: {
            1: ['guard'],
            3: ['whirlwind'],
            5: ['iron_defense'],
            7: [],
            10: ['shield_bash'],
            15: ['immovable_body']
        },
        nextJob: 'paladin'
    },
    ranger: {
        id: 'ranger',
        type: 'physical',
        name: 'レンジャー',
        description: '素早い動きで敵を翻弄する遠距離職',
        atkBonus: 7,
        defBonus: 3,
        hpBonus: 5,
        skills: {
            1: ['slash'],
            3: ['sonic_wave'],
            5: ['rapid_fire'],
            7: ['ice_needle'],
            10: ['arrow_rain'],
            15: ['wind_walker']
        },
        nextJob: 'sniper'
    },
    summoner: {
        id: 'summoner',
        type: 'magical',
        name: 'サモナー',
        description: '召喚獣を操り戦場を支配する召喚術師',
        atkBonus: 3,
        defBonus: 2,
        hpBonus: 10,
        skills: {
            1: ['summon'],
            3: ['dark_nova'],
            5: ['mega_summon'],
            10: ['command_attack'],
            15: ['spirit_link']
        },
        nextJob: 'high_summoner'
    },
    // --- 上位職 (Level 30+) ---
    knight: {
        id: 'knight',
        type: 'physical',
        name: 'ナイト',
        description: '高潔なる騎士。攻守ともに極限まで高められている。',
        atkBonus: 15,
        defBonus: 10,
        hpBonus: 100,
        reqLevel: 30,
        skills: {
            30: ['judgment_cut'],
            35: ['ground_smash'],
            40: ['heavy_slash']
        }
    },
    archmage: {
        id: 'archmage',
        type: 'magical',
        name: 'アークメイジ',
        description: '深遠なる真理を極めた魔導師。広範囲を殲滅する力を持ち。',
        atkBonus: 25,
        defBonus: 5,
        hpBonus: 20,
        reqLevel: 30,
        skills: {
            30: ['abyss_storm'],
            35: ['meteor_swarm'],
            40: ['thunder_storm']
        }
    },
    paladin: {
        id: 'paladin',
        type: 'physical',
        name: 'パラディン',
        description: '聖なる盾。神聖な魔法と鉄壁の守りで仲間を守る。',
        atkBonus: 10,
        defBonus: 25,
        hpBonus: 200,
        reqLevel: 30,
        skills: {
            30: ['holy_sanctuary'],
            35: ['shield_bash'],
            40: ['iron_defense']
        }
    },
    sniper: {
        id: 'sniper',
        type: 'physical',
        name: 'スナイパー',
        description: '静かなる狙撃手。遠方から敵を一撃で射抜く。',
        atkBonus: 20,
        defBonus: 8,
        hpBonus: 50,
        reqLevel: 30,
        skills: {
            30: ['death_rain'],
            35: ['arrow_rain'],
            40: ['rapid_fire']
        }
    },
    high_summoner: {
        id: 'high_summoner',
        type: 'magical',
        name: 'ハイサモナー',
        description: '古の力を使役する召喚士。より強力な存在を呼び出す。',
        atkBonus: 15,
        defBonus: 12,
        hpBonus: 80,
        reqLevel: 30,
        skills: {
            30: ['demon_lord_summon'],
            35: ['mega_summon'],
            40: ['command_attack']
        }
    },
    priest: {
        id: 'priest',
        type: 'magical',
        name: 'プリースト',
        description: '神の祝福を授ける聖職者。仲間の能力を強化する。',
        atkBonus: 5,
        defBonus: 5,
        hpBonus: 30,
        skills: {
            1: ['heal', 'attack_buff'],
            3: ['holy_arrow'],
            5: ['defense_buff'],
            10: ['speed_buff'],
            15: ['summon_boost']
        },
        nextJob: 'high_priest' // 将来的な拡張用
    }
};
