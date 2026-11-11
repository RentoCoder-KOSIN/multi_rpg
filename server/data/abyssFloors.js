/**
 * 無限の深淵: 階層ごとの敵編成・ステータス倍率・報酬（サーバー側 - Node.js CommonJS）
 *
 * 以前はクライアント（systems/abyssManager.js）がこれらを決めてローカルに敵を出していたが、
 * パーティーで同じ敵を共有して戦うため、敵の生成と報酬の抽選はサーバーで行う。
 */

const BOSS_FLOOR_INTERVAL = 5;
const ARENA_CENTER = { x: 640, y: 520 };

// 通常の敵が落とす装備（確率はまとめて ENEMY_EQUIP_DROP_RATE になるよう配分する）
const ENEMY_EQUIP_POOL = [
    "iron_sword", "steel_sword", "mythril_sword", "leather_armor",
    "iron_armor", "mythril_armor", "crystal_pendant", "warrior_ring",
];
const ENEMY_EQUIP_DROP_RATE = 0.18;

// 階層クリア報酬の装備
const CLEAR_EQUIP_POOL = [
    "mythril_sword", "dragon_scale_armor", "ancient_grimoire",
    "void_aegis", "genesis_bow", "titan_armor",
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function isBossFloor(floor) {
    return floor % BOSS_FLOOR_INTERVAL === 0;
}

function getEnemyListForFloor(floor) {
    if (isBossFloor(floor)) {
        if (floor >= 50) return ["chaos_emperor", "anubis_knight", "anubis_knight"];
        if (floor >= 30) return ["blizzard_dragon", "frost_golem", "frost_golem"];
        if (floor >= 20) return ["dragon_boss", "lava_golem", "lava_golem"];
        if (floor >= 10) return ["swamp_boss", "ruins_boss"];
        return ["forest_boss", "skeleton", "skeleton"];
    }

    let pool;
    if (floor >= 40) pool = ["anubis_knight", "mummy_lord", "desert_scorpion", "frost_golem"];
    else if (floor >= 25) pool = ["frost_golem", "yeti", "ice_wolf", "magma_slime"];
    else if (floor >= 15) pool = ["ruins_wolf", "ruins_gargoyle", "dire_wolf", "hell_hound"];
    else if (floor >= 8) pool = ["skeleton", "goblin", "swamp_viper", "red_slime"];
    else pool = ["slime", "forest_slime", "forest_wolf", "bat"];

    const count = Math.min(8, 3 + Math.floor(floor / 8));
    return Array.from({ length: count }, () => pick(pool));
}

// 敵の配置（広場の中央付近。ボス階の先頭の敵は中央に置く）
function buildSpawnPlan(floor) {
    const list = getEnemyListForFloor(floor);
    const bossFloor = isBossFloor(floor);
    return list.map((type, idx) => {
        const angle = (idx / list.length) * Math.PI * 2;
        const dist = bossFloor && idx === 0 ? 0 : 150 + Math.random() * 120;
        return {
            type,
            x: Math.round(ARENA_CENTER.x + Math.cos(angle) * dist),
            y: Math.round(ARENA_CENTER.y + Math.sin(angle) * dist),
        };
    });
}

// 階層が進むほど敵が強くなる（HP・攻撃力に掛ける倍率）
function getFloorStatMultiplier(floor) {
    return 1.0 + (floor - 1) * 0.08;
}

function getEnemyLevel(floor) {
    return 20 + floor * 2;
}

// 経験値は、フィールドの敵と同じ考え方（同レベルの敵を約11体で1レベル。レベル100以上の
// 敵経験値の基準は server/data/enemyStats.js 参照）で、敵レベルから決める。
// 以前は階層に対して指数（1.08^階 / 1.15^階）で増やしていたため、深い階層ほど
// 1回のクリアで何十〜何千レベルも上がってしまっていた。
function expForSameLevelKills(level, kills) {
    return Math.round((100 * level * level) / kills);
}

/**
 * 敵1体ぶんのステータス上書き。
 * partySize が多いほどHPを増やす（人数が増えても数秒で溶けないように）。
 * 経験値・ゴールドは人数を掛けておく。撃破時にサーバーが人数で等分するので、
 * 結果として1人あたりの報酬はソロと同じになる。
 */
function getEnemyOverrides(baseStats, floor, partySize) {
    const mult = getFloorStatMultiplier(floor);
    const hpPartyScale = 1 + (Math.max(1, partySize) - 1) * 0.6;
    const hp = Math.round(baseStats.hp * mult * hpPartyScale);
    const perDropChance = ENEMY_EQUIP_DROP_RATE / ENEMY_EQUIP_POOL.length;

    return {
        hp,
        maxHp: hp,
        atk: Math.round(baseStats.atk * mult),
        level: getEnemyLevel(floor),
        exp: expForSameLevelKills(getEnemyLevel(floor), 11) * Math.max(1, partySize),
        gold: Math.round(80 * Math.pow(1.06, floor)) * Math.max(1, partySize),
        drops: ENEMY_EQUIP_POOL.map(id => ({ id, chance: perDropChance })),
    };
}

/**
 * 階層クリア報酬。メンバーごとに別々に抽選する。
 * @returns {{exp:number, gold:number, magicStone:number, equip:{id:string, level:number}|null}}
 */
function rollClearRewards(floor) {
    const guaranteed = isBossFloor(floor);
    const equip = (guaranteed || Math.random() < 0.3)
        ? { id: pick(CLEAR_EQUIP_POOL), level: floor * 2 }
        : null;

    const level = getEnemyLevel(floor);
    return {
        // クライアントが gainExp(exp, level) に渡す。格下の階層を周回しても、レベル差補正で経験値が減る
        exp: Math.round(100 * level * level * 0.25),
        level,
        gold: Math.round(2000 * Math.pow(1.12, floor)),
        magicStone: Math.max(1, Math.floor(floor / 3)),
        equip,
    };
}

module.exports = {
    isBossFloor,
    getEnemyListForFloor,
    buildSpawnPlan,
    getFloorStatMultiplier,
    getEnemyLevel,
    getEnemyOverrides,
    rollClearRewards,
};
