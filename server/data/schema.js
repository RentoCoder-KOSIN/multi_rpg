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
    level = 1,
    hp,
    atk,
    def = 0,
    exp = 0,
    gold = 0,
    element = null,
    drops = [],
} = {}) {
    assert(id, 'enemy is missing an id');
    assert(name, `enemy "${id}": missing a name`);
    assert(Number.isFinite(hp) && hp > 0, `enemy "${id}": hp must be a positive number`);
    assert(Number.isFinite(atk) && atk >= 0, `enemy "${id}": atk must be a non-negative number`);
    assert(Number.isFinite(def) && def >= 0, `enemy "${id}": def must be a non-negative number`);

    // `displayName` is the field name existing client/server code already
    // reads over the wire; `name` is the schema-facing alias.
    return { id, name, displayName: name, level, hp, atk, def, exp, gold, element, drops };
}

module.exports = { defineEnemy };
