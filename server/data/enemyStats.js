/**
 * 敵のステータスデータ（サーバー側 - Node.js CommonJS）
 */
const { ENEMY_ATK_SCALE } = require("../config");
const { defineEnemy } = require("./schema");

const ENEMY_STATS = {
    slime: defineEnemy({
        id: "slime",
        name: "スライム",
        level: 1,
        hp: 150,
        atk: 5,
        def: 1,
        exp: 60,
        gold: 50,
        drops: [
            { id: "potion", chance: 0.05 },
            { id: "mp_potion", chance: 0.05 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    bat: defineEnemy({
        id: "bat",
        name: "コウモリ",
        level: 6,
        hp: 600,
        atk: 30,
        def: 5,
        exp: 240,
        gold: 70,
        drops: [
            { id: "potion", chance: 0.15 },
            { id: "mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    forest_slime: defineEnemy({
        id: "forest_slime",
        name: "森のスライム",
        level: 14,
        hp: 1200,
        atk: 75,
        def: 12,
        exp: 1500,
        gold: 250,
        drops: [
            { id: "potion", chance: 0.2 },
            { id: "mp_potion", chance: 0.15 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    skeleton: defineEnemy({
        id: "skeleton",
        name: "スケルトン",
        level: 24,
        hp: 2000,
        atk: 120,
        def: 20,
        exp: 3700,
        gold: 400,
        drops: [
            { id: "high_potion", chance: 0.05 },
            { id: "mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    red_slime: defineEnemy({
        id: "red_slime",
        name: "レッドスライム",
        level: 34,
        hp: 2800,
        atk: 350,
        def: 50,
        exp: 6800,
        gold: 600,
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.05 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    goblin: defineEnemy({
        id: "goblin",
        name: "ゴブリン",
        level: 42,
        hp: 3500,
        atk: 450,
        def: 60,
        exp: 9500,
        gold: 1200,
        drops: [
            { id: "high_potion", chance: 0.15 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.02 },
        ],
    }),
    ghost: defineEnemy({
        id: "ghost",
        name: "ゴースト",
        level: 58,
        hp: 35000,
        atk: 505,
        def: 80,
        exp: 20000,
        gold: 3200,
        drops: [
            { id: "high_potion", chance: 0.1 },
            { id: "high_mp_potion", chance: 0.1 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    orc: defineEnemy({
        id: "orc",
        name: "オーク",
        level: 70,
        hp: 50000,
        atk: 750,
        def: 100,
        exp: 26000,
        gold: 10000,
        drops: [
            { id: "high_potion", chance: 0.2 },
            { id: "high_mp_potion", chance: 0.2 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    dire_wolf: defineEnemy({
        id: "dire_wolf",
        name: "ダイアウルフ",
        level: 88,
        hp: 75000,
        atk: 1900,
        def: 150,
        exp: 80000,
        gold: 14000,
        drops: [
            { id: "high_potion", chance: 0.3 },
            { id: "high_mp_potion", chance: 0.3 },
            { id: "holy_weapon", chance: 0.002 },
        ],
    }),
    boss: defineEnemy({
        id: "boss",
        name: "森の守護者",
        level: 20,
        hp: 3000,
        atk: 70,
        def: 40,
        exp: 25000,
        gold: 2500,
        drops: [
            { id: "hero_sword", chance: 0.1 },
            { id: "high_potion", chance: 1.0 },
            { id: "high_mp_potion", chance: 1.0 },
        ],
    }),
    dragon_boss: defineEnemy({
        id: "dragon_boss",
        name: "エンシェントドラゴン",
        level: 100,
        hp: 8000000,
        atk: 35000,
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

/**
 * 敵タイプから統計情報を取得（atk は ENEMY_ATK_SCALE 適用後の値）
 * @param {string} type - 敵のタイプ
 * @returns {Object} 敵の統計情報
 */
function getEnemyStats(type) {
    const s = ENEMY_STATS[type] || ENEMY_STATS.slime;
    return { ...s, atk: scaledAtk(s.atk) };
}

/**
 * Stats that are safe to expose to clients (no drop tables).
 * @returns {Object} type -> { displayName, level, hp, atk, def, exp, gold }
 */
function getPublicEnemyStats() {
    const result = {};
    for (const [type, s] of Object.entries(ENEMY_STATS)) {
        result[type] = {
            displayName: s.displayName,
            level: s.level || 1,
            hp: s.hp,
            atk: scaledAtk(s.atk),
            def: s.def || 0,
            exp: s.exp,
            gold: s.gold,
            element: s.element || null,
        };
    }
    return result;
}

module.exports = { ENEMY_STATS, getEnemyStats, getPublicEnemyStats };
