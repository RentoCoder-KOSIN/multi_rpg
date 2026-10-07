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
        hp: 74,
        atk: 15,
        def: 1,
        exp: 80,
        gold: 50,
        element: "water",
        drops: [
            { id: "potion", chance: 0.05 },
            { id: "mp_potion", chance: 0.05 },
        ],
    }),
    bat: defineEnemy({
        id: "bat",
        name: "コウモリ",
        sprite: "pipo-enemy001a.png",
        size: "small",
        level: 6,
        hp: 280,
        atk: 60,
        def: 5,
        exp: 330,
        gold: 70,
        element: "wind",
        drops: [
            { id: "potion", chance: 0.15 },
            { id: "mp_potion", chance: 0.1 },
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
        hp: 3900,
        atk: 687,
        def: 45,
        exp: 13130,
        gold: 800,
        element: "wind",
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.08 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    forest_slime: defineEnemy({
        id: "forest_slime",
        name: "森のスライム",
        sprite: "slime2.png",
        size: "small",
        level: 14,
        hp: 710,
        atk: 139,
        def: 12,
        exp: 1780,
        gold: 250,
        element: "earth",
        drops: [
            { id: "potion", chance: 0.2 },
            { id: "mp_potion", chance: 0.15 },
        ],
    }),
    skeleton: defineEnemy({
        id: "skeleton",
        name: "スケルトン",
        sprite: "pipo-enemy039.png",
        size: "medium",
        level: 24,
        hp: 1900,
        atk: 309,
        def: 20,
        exp: 5240,
        gold: 400,
        element: "dark",
        drops: [
            { id: "high_potion", chance: 0.05 },
            { id: "mp_potion", chance: 0.1 },
        ],
    }),
    red_slime: defineEnemy({
        id: "red_slime",
        name: "レッドスライム",
        sprite: "slime3.png",
        size: "small",
        level: 34,
        hp: 3300,
        atk: 569,
        def: 50,
        exp: 10510,
        gold: 600,
        element: "fire",
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.05 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    goblin: defineEnemy({
        id: "goblin",
        name: "ゴブリン",
        sprite: "pipo-enemy013.png",
        size: "medium",
        level: 42,
        hp: 4400,
        atk: 819,
        def: 60,
        exp: 16040,
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
            { id: "holy_weapon", chance: 0.004 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    ghost: defineEnemy({
        id: "ghost",
        name: "ゴースト",
        sprite: "pipo-enemy010a.png",
        size: "medium",
        level: 58,
        hp: 8300,
        atk: 1526,
        def: 80,
        exp: 30580,
        gold: 3200,
        element: "dark",
        // 冷気を帯びた恐怖で20%の確率で2.5秒間麻痺させる
        statusEffect: { type: "paralyze", chance: 0.2, duration: 2500 },
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    orc: defineEnemy({
        id: "orc",
        name: "オーク",
        sprite: "pipo-enemy015.png",
        size: "large",
        level: 70,
        hp: 14000,
        atk: 2429,
        def: 100,
        exp: 44550,
        gold: 10000,
        element: "earth",
        drops: [
            { id: "high_potion", chance: 0.2 },
            { id: "high_mp_potion", chance: 0.2 },
            { id: "holy_weapon", chance: 0.002 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    dire_wolf: defineEnemy({
        id: "dire_wolf",
        name: "ダイアウルフ",
        sprite: "pipo-enemy002.png",
        size: "large",
        level: 88,
        hp: 25000,
        atk: 4152,
        def: 150,
        exp: 70400,
        gold: 14000,
        element: "wind",
        drops: [
            { id: "high_potion", chance: 0.3 },
            { id: "high_mp_potion", chance: 0.3 },
            { id: "holy_weapon", chance: 0.002 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    // --- 遺跡エリア（湿地と火山の間）---
    // 湿地(Lv34〜42, ボスLv52) → 遺跡(Lv46〜56, ボスLv66) → 火山(Lv58〜) と
    // 敵の強さが滑らかにつながるよう、ゴブリン(Lv42)〜ゴースト(Lv58)の間を補間した値。
    // 画像は client/assets/enemy/ の pipo-enemy025 / 011 / 023(ケルベロス) / 033(石のゴーレム) を使用。
    ruins_skeleton: defineEnemy({
        id: "ruins_skeleton",
        name: "遺跡の亡者",
        sprite: "pipo-enemy025.png",
        size: "medium",
        level: 46,
        hp: 5160,
        atk: 957,
        def: 65,
        exp: 18850,
        gold: 1700,
        element: "dark",
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    ruins_goblin: defineEnemy({
        id: "ruins_goblin",
        name: "盗掘ゴブリン",
        sprite: "pipo-enemy011.png",
        size: "medium",
        level: 51,
        hp: 6290,
        atk: 1163,
        def: 71,
        exp: 23060,
        gold: 2250,
        element: "earth",
        // 毒の短剣(強化版): 25%の確率で4秒間の毒
        statusEffect: { type: "poison", chance: 0.25, duration: 4000, tickDamage: 32 },
        drops: [
            { id: "high_potion", chance: 0.12 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
        ],
    }),
    ruins_wolf: defineEnemy({
        id: "ruins_wolf",
        name: "遺跡の番犬",
        sprite: "pipo-enemy023.png",
        size: "large",
        level: 56,
        hp: 7660,
        atk: 1412,
        def: 77,
        exp: 28200,
        gold: 2900,
        element: "thunder",
        // 帯電した牙: 20%の確率で2秒間の凍結(動けなくなる)
        statusEffect: { type: "freeze", chance: 0.2, duration: 2000 },
        drops: [
            { id: "high_potion", chance: 0.15 },
            { id: "high_mp_potion", chance: 0.15 },
            { id: "great_potion", chance: 0.1 },
            { id: "great_mp_potion", chance: 0.08 },
            { id: "thunder_spear", chance: 0.003 },
        ],
    }),
    boss: defineEnemy({
        id: "boss",
        name: "森の守護者",
        sprite: "pipo-enemy043.png",
        size: "boss",
        // 最初のボスは操作確認の締め。通常マップのボスとは別に低く調整する。
        level: 5,
        hp: 600,
        atk: 25,
        def: 5,
        exp: 800,
        gold: 300,
        element: "light",
        drops: [
            { id: "hero_sword", chance: 0.1 },
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
            { id: "elixir", chance: 0.5 },
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
        hp: 27000,
        atk: 795,
        def: 45,
        exp: 40000,
        gold: 8000,
        element: "earth",
        drops: [
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
            { id: "power_seed", chance: 0.3 },
            { id: "elixir", chance: 0.5 },
            { id: "seekers_monocle", chance: 0.2 },
            { id: "steel_claymore", chance: 0.12 },
        ],
    }),
    // 湿地のマップボス（湿地ゾーンの敵 Lv34〜42 の上）
    swamp_boss: defineEnemy({
        id: "swamp_boss",
        name: "沼の主ヌシ",
        sprite: "pipo-enemy042.png",
        size: "boss",
        level: 52,
        hp: 85000,
        atk: 2121,
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
            { id: "elixir", chance: 0.5 },
            { id: "crystal_staff", chance: 0.12 },
            { id: "hunter_longbow", chance: 0.12 },
        ],
    }),
    // 遺跡のマップボス（遺跡ゾーンの敵 Lv46〜56 の上。湿地ボスLv52と火山Lv58〜の橋渡し）
    ruins_boss: defineEnemy({
        id: "ruins_boss",
        name: "遺跡の守護者ゴーレム",
        sprite: "pipo-enemy033.png",
        size: "boss",
        level: 66,
        hp: 160000,
        atk: 3300,
        def: 120,
        exp: 230000,
        gold: 60000,
        element: "earth",
        // 石の拳: 20%の確率で2.5秒間の麻痺
        statusEffect: { type: "paralyze", chance: 0.2, duration: 2500 },
        drops: [
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
            { id: "magic_seed", chance: 0.3 },
            { id: "elixir", chance: 0.5 },
            { id: "thunder_spear", chance: 0.12 },
            { id: "moonlight_rapier", chance: 0.1 },
            { id: "orichalcum_plate", chance: 0.12 },
        ],
    }),
    // 火山のマップボス（最終ボス）
    dragon_boss: defineEnemy({
        id: "dragon_boss",
        name: "エンシェントドラゴン",
        sprite: "pipo-enemy044d.png",
        size: "boss",
        level: 100,
        hp: 1300000,
        atk: 10915,
        def: 500,
        exp: 25000000,
        gold: 10000000,
        element: "fire", // 火属性: fireResist装備で被ダメージを軽減できる
        drops: [
            { id: "dragon_scale_armor", chance: 0.2 },
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
            { id: "elixir", chance: 0.5 },
            { id: "dragon_heart", chance: 0.3 },
            { id: "galaxy_blade", chance: 0.15 },
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
