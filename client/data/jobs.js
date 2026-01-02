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
            10: ['ground_smash']
        }
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
            12: ['thunder_storm']
        }
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
            10: ['shield_bash']
        }
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
            10: ['arrow_rain']
        }
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
            10: ['command_attack']
        }
    }
};
