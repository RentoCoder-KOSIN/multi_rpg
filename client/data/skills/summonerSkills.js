/**
 * サモナースキル
 * 召喚獣を操り戦場を支配する召喚術師
 */

export const SUMMONER_SKILLS = {
    summon: {
        id: 'summon',
        name: 'サモン',
        type: 'active',
        cd: 15000,
        mpCost: 20,
        unlockCost: 10,
        color: 0x9370db,
        icon: '👻',
        description: '召喚獣を呼び出して戦わせる。'
    },
    mega_summon: {
        id: 'mega_summon',
        name: 'メガサモン',
        type: 'active',
        cd: 30000,
        mpCost: 50,
        unlockCost: 50,
        color: 0x800080,
        icon: '👿',
        description: '強力な召喚獣を呼び出す。'
    },
    command_attack: {
        id: 'command_attack',
        name: '突撃命令',
        type: 'active',
        cd: 10000,
        mpCost: 30,
        unlockCost: 100,
        color: 0xffd700,
        icon: '🚩',
        description: '召喚獣に突撃させる。'
    }
};
