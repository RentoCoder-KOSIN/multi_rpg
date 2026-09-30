/**
 * 敵のステータスデータ（サーバー側 - Node.js CommonJS）
 */
const { ENEMY_ATK_SCALE, ENEMY_HP_SCALE } = require("../config");
const { defineEnemy } = require("./schema");

const ENEMY_STATS = {
    slime: defineEnemy({
        id: "slime",
        name: "スライム",
        sprite: "slime1.png",
        size: "small",
        level: 1,
        hp: 50,
        atk: 5,
        def: 1,
        exp: 80,
        gold: 50,
        element: "water",
        drops: [
            { id: "potion", chance: 0.05 },
            { id: "mp_potion", chance: 0.05 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    bat: defineEnemy({
        id: "bat",
        name: "コウモリ",
        sprite: "pipo-enemy001a.png",
        size: "small",
        level: 6,
        hp: 600,
        atk: 30,
        def: 5,
        exp: 240,
        gold: 70,
        element: "wind",
        drops: [
            { id: "potion", chance: 0.15 },
            { id: "mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    // 湿地に出る個体。チュートリアル相当の Lv.6 コウモリを高レベル帯に
    // 混在させないため、湿地専用の派生種として定義する。
    marsh_bat: defineEnemy({
        id: "marsh_bat",
        name: "湿地コウモリ",
        sprite: "pipo-enemy001a.png",
        size: "small",
        level: 38,
        hp: 3000,
        atk: 320,
        def: 45,
        exp: 7600,
        gold: 800,
        element: "wind",
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.08 },
        ],
    }),
    forest_slime: defineEnemy({
        id: "forest_slime",
        name: "森のスライム",
        sprite: "slime2.png",
        size: "small",
        level: 14,
        hp: 1200,
        atk: 75,
        def: 12,
        exp: 1500,
        gold: 250,
        element: "earth",
        drops: [
            { id: "potion", chance: 0.2 },
            { id: "mp_potion", chance: 0.15 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    skeleton: defineEnemy({
        id: "skeleton",
        name: "スケルトン",
        sprite: "pipo-enemy039.png",
        size: "medium",
        level: 24,
        hp: 2000,
        atk: 120,
        def: 20,
        exp: 3700,
        gold: 400,
        element: "dark",
        drops: [
            { id: "high_potion", chance: 0.05 },
            { id: "mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    red_slime: defineEnemy({
        id: "red_slime",
        name: "レッドスライム",
        sprite: "slime3.png",
        size: "small",
        level: 34,
        hp: 2800,
        atk: 350,
        def: 50,
        exp: 6800,
        gold: 600,
        element: "fire",
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.05 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    goblin: defineEnemy({
        id: "goblin",
        name: "ゴブリン",
        sprite: "pipo-enemy013.png",
        size: "medium",
        level: 42,
        hp: 3500,
        atk: 450,
        def: 60,
        exp: 9500,
        gold: 1200,
        element: "earth",
        // 毒の短剣を使う: 25%の確率で4秒間の毒(1tickにつき最大HPの約2%相当)を付与
        statusEffect: {
            type: "poison",
            chance: 0.25,
            duration: 4000,
            tickDamage: 25,
        },
        drops: [
            { id: "high_potion", chance: 0.15 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.02 },
        ],
    }),
    ghost: defineEnemy({
        id: "ghost",
        name: "ゴースト",
        sprite: "pipo-enemy010a.png",
        size: "medium",
        level: 58,
        hp: 35000,
        atk: 505,
        def: 80,
        exp: 20000,
        gold: 3200,
        element: "dark",
        // 冷気を帯びた恐怖で20%の確率で2.5秒間麻痺させる
        statusEffect: { type: "paralyze", chance: 0.2, duration: 2500 },
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    orc: defineEnemy({
        id: "orc",
        name: "オーク",
        sprite: "pipo-enemy015.png",
        size: "large",
        level: 70,
        hp: 50000,
        atk: 750,
        def: 100,
        exp: 36000,
        gold: 10000,
        element: "earth",
        drops: [
            { id: "high_potion", chance: 0.2 },
            { id: "high_mp_potion", chance: 0.2 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    dire_wolf: defineEnemy({
        id: "dire_wolf",
        name: "ダイアウルフ",
        sprite: "pipo-enemy002.png",
        size: "large",
        level: 88,
        hp: 75000,
        atk: 1900,
        def: 150,
        exp: 80000,
        gold: 14000,
        element: "wind",
        drops: [
            { id: "high_potion", chance: 0.3 },
            { id: "high_mp_potion", chance: 0.3 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    boss: defineEnemy({
        id: "boss",
        name: "森の守護者",
        sprite: "pipo-enemy043.png",
        size: "boss",
        // 最初のボスは操作確認の締め。通常マップのボスとは別に低く調整する。
        level: 5,
        hp: 550,
        atk: 12,
        def: 5,
        exp: 800,
        gold: 300,
        element: "light",
        drops: [
            { id: "hero_sword", chance: 0.1 },
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
        ],
    }),
    // --- マップボス ---
    // 各マップに1体ずつ常駐し、倒すとリスポーンまで時間が空く（respawnDelayはTiledの enemy_spawn 側で指定）。
    // size: 'boss' の敵は、Q学習AIではなく「近づいて攻撃」するボス専用ロジックで動く（server/services/enemyLoop.js）。
    // 森のマップボス（森ゾーンの敵 Lv14〜24 の上）
    forest_boss: defineEnemy({
        id: "forest_boss",
        name: "森の主トレント",
        sprite: "pipo-enemy006.png",
        size: "boss",
        level: 30,
        hp: 15000,
        atk: 220,
        def: 45,
        exp: 40000,
        gold: 8000,
        element: "earth",
        drops: [
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
            { id: "power_seed", chance: 0.3 },
        ],
    }),
    // 湿地のマップボス（湿地ゾーンの敵 Lv34〜42 の上）
    swamp_boss: defineEnemy({
        id: "swamp_boss",
        name: "沼の主ヌシ",
        sprite: "pipo-enemy042.png",
        size: "boss",
        level: 52,
        hp: 60000,
        atk: 520,
        def: 90,
        exp: 150000,
        gold: 30000,
        element: "water",
        // 毒をまとった牙: 30%の確率で5秒間の毒
        statusEffect: { type: "poison", chance: 0.3, duration: 5000, tickDamage: 40 },
        drops: [
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
            { id: "shield_seed", chance: 0.3 },
            { id: "magic_seed", chance: 0.1 },
        ],
    }),
    // 火山のマップボス（最終ボス）
    dragon_boss: defineEnemy({
        id: "dragon_boss",
        name: "エンシェントドラゴン",
        sprite: "pipo-enemy044d.png",
        size: "boss",
        level: 100,
        hp: 4000000,
        atk: 3500,
        def: 500,
        exp: 25000000,
        gold: 10000000,
        element: "fire", // 火属性: fireResist装備で被ダメージを軽減できる
        drops: [
            { id: "dragon_scale_armor", chance: 0.2 },
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
        ],
    }),
};

// ATK に ENEMY_ATK_SCALE を掛けて最終的な攻撃力を求める（最低1は保証する）
function scaledAtk(rawAtk) {
    return Math.max(1, Math.round(rawAtk * ENEMY_ATK_SCALE));
}

// HP に ENEMY_HP_SCALE を掛けて最終的な体力を求める（最低1は保証する）
function scaledHp(rawHp) {
    return Math.max(1, Math.round(rawHp * ENEMY_HP_SCALE));
}

/**
 * 敵タイプから統計情報を取得（atk は ENEMY_ATK_SCALE、hp は ENEMY_HP_SCALE 適用後の値）
 * @param {string} type - 敵のタイプ
 * @returns {Object} 敵の統計情報
 */
// size:'boss' の敵は、ボス専用ロジック（追跡して攻撃）で動かす。type名が 'boss' でなくても判定できる。
function isBossType(type) {
    return ENEMY_STATS[type]?.size === "boss";
}

function getEnemyStats(type) {
    const s = ENEMY_STATS[type] || ENEMY_STATS.slime;
    return { ...s, hp: scaledHp(s.hp), atk: scaledAtk(s.atk) };
}

/**
 * Stats that are safe to expose to clients (no drop tables).
 * @returns {Object} type -> { displayName, sprite, size, level, hp, atk, def, exp, gold, element }
 */
function getPublicEnemyStats() {
    const result = {};
    for (const [type, s] of Object.entries(ENEMY_STATS)) {
        result[type] = {
            displayName: s.displayName,
            sprite: s.sprite,
            size: s.size,
            level: s.level || 1,
            hp: scaledHp(s.hp),
            atk: scaledAtk(s.atk),
            def: s.def || 0,
            exp: s.exp,
            gold: s.gold,
            element: s.element || null,
        };
    }
    return result;
}

module.exports = { ENEMY_STATS, getEnemyStats, getPublicEnemyStats, isBossType };
