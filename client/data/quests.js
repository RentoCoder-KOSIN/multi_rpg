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
        area: 'forest',
        nextQuest: 'forest_skeleton_hunt'
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
        }
        // ボス戦マップ(battle)のクエスト。街への転移の解放条件（battle.json の Teleports.requiredQuest）
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
        area: 'wetland',
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
        area: 'forest',
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
        },
        area: 'forest'
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
        area: 'wetland',
        nextQuest: 'swamp_boss_quest'
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
        area: 'volcano',
        nextQuest: 'kill_dire_wolf'
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
        },
        area: 'volcano'
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
        area: 'volcano',
        nextQuest: 'kill_orc'
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
        area: 'volcano'
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
        },
        area: 'volcano'
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
        },
        area: 'volcano',
        nextQuest: 'dragon_slayer'
    },
    // ===== マップクエスト（そのマップの敵を倒す → マップボスを倒す）=====
    // 各マップの「MAP_CLEAR_QUESTS」を全て達成すると、次のマップへの転移が解放される（下部のヘルパー参照）。
    forest_skeleton_hunt: {
        id: 'forest_skeleton_hunt',
        title: '森の骸骨狩り',
        description: '森をさまようスケルトンを20体倒せ。',
        type: 'kill',
        target: 'skeleton',
        required: 20,
        reward: { exp: 3000, gold: 1500, item: 'high_potion' },
        area: 'forest',
        nextQuest: 'forest_boss_quest'
    },
    forest_boss_quest: {
        id: 'forest_boss_quest',
        title: '森の主トレント (Boss)',
        description: '森の奥に潜むマップボス「森の主トレント」を討伐せよ。',
        type: 'kill',
        target: 'forest_boss',
        required: 1,
        reward: { exp: 30000, gold: 8000, item: 'power_seed' },
        area: 'forest'
    },
    wetland_red_slime: {
        id: 'wetland_red_slime',
        title: '湿地の赤い脅威',
        description: 'レッドスライムを15体倒せ。',
        type: 'kill',
        target: 'red_slime',
        required: 15,
        reward: { exp: 8000, gold: 3000, item: 'high_potion' },
        area: 'wetland',
        nextQuest: 'kill_goblin'
    },
    swamp_boss_quest: {
        id: 'swamp_boss_quest',
        title: '沼の主ヌシ (Boss)',
        description: '湿地の底に棲むマップボス「沼の主ヌシ」を討伐せよ。',
        type: 'kill',
        target: 'swamp_boss',
        required: 1,
        reward: { exp: 120000, gold: 25000, item: 'shield_seed' },
        area: 'wetland'
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

// ===== マップの進行（クエストで次のマップへ進む仕組み）=====
//
// 街から先のマップは、下の順番で「そのマップのクエストを全て達成」すると次のマップへ進める。
//   forest（最初から行ける） → wetland → volcano
// 進行の解放は2か所で実現している:
//   1. 転移（街 → 次のマップ）: Tiled の Teleports の requiredQuest に、下の MAP_CLEAR_QUESTS をカンマ区切りで書く
//      （city.json に設定済み。全て達成しないと通れない。utils/questGate.js が判定する）
//   2. クエストの受注: quest.area が付いたクエストは、そのマップが解放されるまで受注できない
//      （ギルドの掲示板にも出ない。QuestManager.canStart / areaUnlocked）
//
// 新しいマップを足すときは、AREA_ORDER の末尾に足し、MAP_CLEAR_QUESTS にそのマップのクエストIDを並べ、
// 街の該当 Teleports の requiredQuest に「前のマップのMAP_CLEAR_QUESTS」を書けばよい。
export const AREA_ORDER = ['forest', 'wetland', 'volcano'];

// マップごとの「全部達成すると次のマップに進める」クエスト
export const MAP_CLEAR_QUESTS = {
    forest: ['kill_forest_slime', 'forest_skeleton_hunt', 'forest_boss_quest'],
    wetland: ['wetland_red_slime', 'kill_goblin', 'swamp_boss_quest'],
    volcano: ['kill_ghost', 'kill_orc', 'kill_dire_wolf', 'dragon_slayer'],
};

/** area の1つ前のマップ（最初のマップなら null） */
export function previousArea(area) {
    const i = AREA_ORDER.indexOf(area);
    return i > 0 ? AREA_ORDER[i - 1] : null;
}

