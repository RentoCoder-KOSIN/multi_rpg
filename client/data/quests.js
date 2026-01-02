export const QUESTS = {
    choose_job: {
        id: 'choose_job',
        title: '職業の選択',
        description: '職業管理人と話し、自分の歩む道を選べ。',
        type: 'custom',
        target: 'choose_job',
        required: 1,
        reward: {
            exp: 50,
            gold: 100,
            item: 'potion'
        },
        nextQuest: 'kill_slime'
    },
    kill_slime: {
        id: 'kill_slime',
        title: 'スライム討伐の基礎',
        description: 'スライムを10体倒せ',
        type: 'kill',
        target: 'slime',
        required: 10,
        reward: {
            exp: 100,
            gold: 150,
            item: 'mp_potion'
        },

    },
    kill_forest_slime: {
        id: 'kill_forest_slime',
        title: '森の掃除屋',
        description: '森に生息する強化スライムを15体討伐せよ。',
        type: 'kill',
        target: 'forest_slime',
        required: 15,
        reward: {
            exp: 300,
            gold: 400,
            item: 'travel_cloak'
        },
        nextQuest: 'brave_check'
    },
    brave_check: {
        id: 'brave_check',
        title: '勇者の試練 (Boss)',
        description: '森の守護者であるボスを討伐せよ。',
        type: 'kill',
        target: 'boss',
        required: 1,
        reward: {
            exp: 10000,
            gold: 8000,
            item: 'iron_shield'
        },
        nextQuest: 'kill_orc'
    },
    kill_bat: {
        id: 'kill_bat',
        title: '不気味な羽音',
        description: '洞窟のコウモリを10体間引きせよ。',
        type: 'kill',
        target: 'bat',
        required: 10,
        reward: {
            exp: 150,
            gold: 200,
            item: 'heal_potion_small'
        },
        nextQuest: 'kill_skeleton'
    },
    kill_skeleton: {
        id: 'kill_skeleton',
        title: '動く骨の恐怖',
        description: 'スケルトンを12体浄化せよ。',
        type: 'kill',
        target: 'skeleton',
        required: 12,
        reward: {
            exp: 500,
            gold: 600,
            item: 'iron_sword'
        },
        nextQuest: 'skeleton_extermination'
    },
    skeleton_extermination: {
        id: 'skeleton_extermination',
        title: '死霊軍団の壊滅',
        description: 'スケルトンを50体倒し、地域の平和を取り戻せ。',
        type: 'kill',
        target: 'skeleton',
        required: 50,
        reward: {
            exp: 15000,
            gold: 20000,
            item: 'power_seed'
        }
    },
    kill_goblin: {
        id: 'kill_goblin',
        title: '小鬼の略奪',
        description: '村の食料を盗むゴブリンを20体討伐せよ。',
        type: 'kill',
        target: 'goblin',
        required: 20,
        reward: {
            exp: 800,
            gold: 1000,
            item: 'brass_knuckles'
        },
        nextQuest: 'kill_orc'
    },
    kill_orc: {
        id: 'kill_orc',
        title: '猪突猛進',
        description: '強力な力を持つオークを10体倒せ。',
        type: 'kill',
        target: 'orc',
        required: 10,
        reward: {
            exp: 2500,
            gold: 3000,
            item: 'plate_armor'
        },
        nextQuest: 'orc_hero'
    },
    orc_hero: {
        id: 'orc_hero',
        title: 'オークの王者',
        description: 'オークを30体倒し、その武勇を示せ。',
        type: 'kill',
        target: 'orc',
        required: 30,
        reward: {
            exp: 20000,
            gold: 50000,
            item: 'shield_seed'
        }
    },
    kill_ghost: {
        id: 'kill_ghost',
        title: '亡霊の密談',
        description: '森を彷徨うゴーストを8体退散させよ。',
        type: 'kill',
        target: 'ghost',
        required: 8,
        reward: {
            exp: 1200,
            gold: 1500,
            item: 'high_potion'
        },
        nextQuest: 'ghost_buster'
    },
    ghost_buster: {
        id: 'ghost_buster',
        title: 'ゴースト・バスター',
        description: 'ゴーストを40体退治し、夜の静寂を守れ。',
        type: 'kill',
        target: 'ghost',
        required: 40,
        reward: {
            exp: 20000,
            gold: 30000,
            item: 'magic_seed'
        },
        nextQuest: 'dragon_slayer'
    },
    dragon_slayer: {
        id: 'dragon_slayer',
        title: '古の竜との決戦 (Boss)',
        description: '世界を脅かすドラゴンボスを討伐せよ。',
        type: 'kill',
        target: 'dragon_boss',
        required: 1,
        reward: {
            exp: 50000,
            gold: 100000,
            item: 'hero_sword'
        }
    },
    kill_dire_wolf: {
        id: 'kill_dire_wolf',
        title: '銀翼の牙',
        description: '素早い動きのダイアウルフを10体狩れ。',
        type: 'kill',
        target: 'dire_wolf',
        required: 10,
        reward: {
            exp: 3500,
            gold: 5000,
            item: 'wooden_bow'
        }
    },
    slime_massacre: {
        id: 'slime_massacre',
        title: 'スライム100人斬り',
        description: 'スライムを累計100体倒す伝説を作れ。',
        type: 'kill',
        target: 'slime',
        required: 100,
        reward: {
            exp: 5000,
            gold: 10000,
            item: 'exp_weapon'
        }
    }
};
