/**
 * Data schema for enemies (server-authoritative).
 *
 * Same idea as client/data/schema.js: one factory function so every enemy
 * has the same shape and gets validated at load time instead of failing
 * quietly (e.g. a missing `hp` silently becoming NaN mid-fight).
 */

function assert(condition, message) {
    if (!condition) {
        throw new Error(`[data schema] ${message}`);
    }
}

// 画面上の大きさのプリセット（client/data/enemySize.js の SIZE_PRESETS と対応）
const ENEMY_SIZES = ['small', 'medium', 'large', 'boss', 'huge'];

/**
 * How to add a new enemy:
 *
 *   const { defineEnemy } = require('./schema');
 *
 *   const ENEMY_STATS = {
 *       ...
 *       my_enemy: defineEnemy({
 *           id: 'my_enemy',
 *           name: 'My Enemy',
 *           sprite: 'pipo-enemy013.png',   // client/assets/enemy/ 内のファイル名
 *           size: 'medium',                // small / medium / large / boss / huge
 *           level: 10,
 *           hp: 1000,
 *           atk: 50,
 *           def: 10,
 *           exp: 500,
 *           gold: 100,
 *           drops: [{ id: 'potion', chance: 0.1 }],
 *       }),
 *   };
 *
 * `def` flatly reduces incoming player damage (see Player.getDamage on the
 * client) with a floor of 1 damage — it does not need to be huge to matter
 * against low-level attackers, and barely matters once a player's ATK is
 * much larger, which keeps the existing level curve close to how it felt
 * before `def` existed. Tune per-enemy as needed.
 */
function defineEnemy({
    id,
    name,
    // 見た目。sprite は client/assets/enemy/ 内のファイル名（省略時は `<id>.png`）、
    // size は画面上の大きさのプリセット
    sprite = null,
    size = 'medium',
    level = 1,
    hp,
    atk,
    def = 0,
    exp = 0,
    gold = 0,
    element = null,
    // 敵の攻撃がプレイヤーに状態異常を与える場合に設定する。
    // 例: { type: 'poison', chance: 0.25, duration: 4000, tickDamage: 20 }
    statusEffect = null,
    drops = [],
} = {}) {
    assert(id, 'enemy is missing an id');
    assert(name, `enemy "${id}": missing a name`);
    assert(ENEMY_SIZES.includes(size), `enemy "${id}": size must be one of ${ENEMY_SIZES.join(', ')} (got "${size}")`);
    assert(Number.isFinite(hp) && hp > 0, `enemy "${id}": hp must be a positive number`);
    assert(Number.isFinite(atk) && atk >= 0, `enemy "${id}": atk must be a non-negative number`);
    assert(Number.isFinite(def) && def >= 0, `enemy "${id}": def must be a non-negative number`);

    // `displayName` is the field name existing client/server code already
    // reads over the wire; `name` is the schema-facing alias.
    return { id, name, displayName: name, sprite: sprite || `${id}.png`, size, level, hp, atk, def, exp, gold, element, statusEffect, drops };
}

module.exports = { defineEnemy, ENEMY_SIZES };
