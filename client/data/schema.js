/**
 * Data schema for items, skills and jobs.
 *
 * Why this file exists:
 * Before this, every item/skill/job was a hand-written plain object.
 * That works, but nothing stopped a typo (`atk` vs `attack`, missing `id`,
 * a `rangeType` that doesn't exist) from silently doing nothing at runtime.
 *
 * These factory functions are the single place that:
 *  1) Fill in sane defaults, so a new entry only needs the fields that
 *     make it different from the norm.
 *  2) Validate required fields at load time (fails loudly on `npm start`
 *     instead of failing quietly mid-battle).
 *  3) Keep the shape consistent across every entry, so game logic can
 *     always assume `item.stats.attack`, `skill.effect`, etc. exist.
 *
 * To add new content, see the "How to add a new ___" comment above each
 * factory below.
 */

const VALID_RANGE_TYPES = ['circle', 'line', 'fan'];
const VALID_TARGET_TYPES = ['enemy', 'party'];
const VALID_ITEM_TYPES = ['weapon', 'armor', 'consumable'];
const VALID_SKILL_TYPES = ['active', 'passive'];
const VALID_JOB_TYPES = ['physical', 'magical'];

function assert(condition, message) {
    if (!condition) {
        throw new Error(`[data schema] ${message}`);
    }
}

/**
 * How to add a new skill:
 *
 *   export const MY_JOB_SKILLS = {
 *       my_skill: defineSkill({
 *           id: 'my_skill',
 *           name: 'My Skill',
 *           type: 'active',
 *           damageMult: 10,
 *           mpCost: 15,
 *           cd: 3000,
 *           range: 150,
 *           rangeType: 'circle',
 *           icon: '✨',
 *           description: 'What it does.',
 *       }),
 *   };
 *
 * Then register it in `skillRegistry.js` (spread it into SKILLS) and add
 * its id to the right level in the job's `skills` map in `jobs.js`.
 *
 * `effect` is the place for anything that isn't a core combat number
 * (heal power, bonus multipliers against a specific enemy type, etc.)
 * instead of inventing a new top-level field for every special case.
 * Example: `effect: { healPower: 50 }`, `effect: { vsUndead: 2.0 }`.
 */
export function defineSkill({
    id,
    name,
    type,
    description = '',
    icon = '❔',
    color = 0xffffff,
    cd = 0,
    mpCost = 0,
    unlockCost = 0,
    damageMult = 0,
    range = 0,
    rangeType = 'circle',
    targetType = 'enemy',
    effect = {},
} = {}) {
    assert(id, 'skill is missing an id');
    assert(name, `skill "${id}": missing a name`);
    assert(VALID_SKILL_TYPES.includes(type), `skill "${id}": type must be one of ${VALID_SKILL_TYPES.join(', ')}`);
    assert(VALID_RANGE_TYPES.includes(rangeType), `skill "${id}": rangeType must be one of ${VALID_RANGE_TYPES.join(', ')}`);
    assert(VALID_TARGET_TYPES.includes(targetType), `skill "${id}": targetType must be one of ${VALID_TARGET_TYPES.join(', ')}`);

    return { id, name, type, description, icon, color, cd, mpCost, unlockCost, damageMult, range, rangeType, targetType, effect };
}

/**
 * How to add a new job (class):
 *
 *   export const JOBS = {
 *       ...
 *       my_job: defineJob({
 *           id: 'my_job',
 *           type: 'physical',
 *           name: 'My Job',
 *           description: 'What it does.',
 *           atkBonus: 5, defBonus: 5, hpBonus: 20,
 *           skills: { 1: ['my_skill'], 5: ['another_skill'] },
 *           nextJob: 'my_advanced_job', // omit for a job with no promotion
 *       }),
 *   };
 *
 * Leave `reqLevel` unset for a starting (level 1) job — the job-select
 * dialogue finds starting jobs by checking that `reqLevel` is falsy.
 * Only advanced jobs (reached via promotion) should set `reqLevel`.
 */
export function defineJob({
    id,
    name,
    type,
    description = '',
    atkBonus = 0,
    defBonus = 0,
    hpBonus = 0,
    reqLevel = null,
    skills = {},
    nextJob = null,
} = {}) {
    assert(id, 'job is missing an id');
    assert(name, `job "${id}": missing a name`);
    assert(VALID_JOB_TYPES.includes(type), `job "${id}": type must be one of ${VALID_JOB_TYPES.join(', ')}`);

    const job = { id, type, name, description, atkBonus, defBonus, hpBonus, skills, nextJob };
    if (reqLevel) job.reqLevel = reqLevel;
    return job;
}

/**
 * How to add a new item:
 *
 *   export const ITEMS = {
 *       ...
 *       my_sword: defineItem({
 *           id: 'my_sword',
 *           name: 'My Sword',
 *           type: 'weapon',
 *           price: 500,
 *           level: 10,
 *           stats: { attack: 30, critChance: 0.05 },
 *           description: 'A sword.',
 *       }),
 *   };
 *
 * `stats` holds every number game logic actually reads (attack, defense,
 * matk, heal, healMp, critChance, speedBonus, lifesteal, ...) — see
 * existing items for the full vocabulary of keys in use.
 *
 * `effect` is for descriptive/special behaviour that doesn't reduce to a
 * plain stat bonus (e.g. `{ kind: 'lifesteal_on_kill' }`) — most items
 * won't need it.
 *
 * A weapon with damage logic that can't be expressed as a flat number
 * (random rolls, scaling off the target's HP, ...) can still pass a
 * `calculateAtk(baseAtk, player, target)` function — see `ganble_stick`
 * and `death_scythe` for examples.
 */
export function defineItem({
    id,
    name,
    type,
    description = '',
    price = 0,
    level = 1,
    stats = {},
    effect = {},
    calculateAtk = null,
} = {}) {
    assert(id, 'item is missing an id');
    assert(name, `item "${id}": missing a name`);
    assert(VALID_ITEM_TYPES.includes(type), `item "${id}": type must be one of ${VALID_ITEM_TYPES.join(', ')}`);
    assert(price >= 0, `item "${id}": price must not be negative`);

    // lvlReq is kept as the field name existing UI/equip-check code reads;
    // `level` is the schema-facing name requested for the struct.
    const item = { id, name, type, description, price, level, lvlReq: level, stats, effect };
    if (typeof calculateAtk === 'function') item.calculateAtk = calculateAtk;
    return item;
}
