import { ELEMENTS } from './elements.js';
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
// 命中方式: 'area' = 範囲内の敵すべて / 'single' = 範囲内で一番近い敵1体だけ
const VALID_HIT_TYPES = ['area', 'single'];
const VALID_ITEM_TYPES = ['weapon', 'armor', 'accessory', 'consumable', 'material'];
const VALID_SKILL_TYPES = ['active', 'passive'];
// スキル発動時の演出タイプ（systems/skillEffects.js の VFX_PLAYERS のキーと一致させる）
const VALID_VFX_TYPES = ['slash', 'blast', 'projectile', 'support'];
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
 *           hitType: 'single', // 'single'=一番近い1体 / 'area'=範囲内全員（省略時）
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
    // 単体スキルか範囲スキルか。'single' は range/rangeType の範囲内で一番近い1体だけに当たる。
    // 'area'（既定）は範囲内の全員。
    hitType = 'area',
    // hitType が 'area' のとき、当たる敵の数の上限（近い順）。null なら無制限。
    // 例: 3体まで貫通する連射スキル -> maxTargets: 3
    maxTargets = null,
    effect = {},
    // 魔法スキルの属性（'fire' など）。未設定なら武器に付与した属性が使われる
    element = null,
    // 演出タイプ（'slash' | 'blast' | 'projectile' | 'support'）。未設定なら targetType が party ならsupport、他は汎用バースト
    vfx = null,
    // 演出の細かい調整: { slashColor, particleCount, shake, projectile: 'arc'|'bolt' }
    vfxOptions = {},
} = {}) {
    assert(id, 'skill is missing an id');
    assert(name, `skill "${id}": missing a name`);
    assert(VALID_SKILL_TYPES.includes(type), `skill "${id}": type must be one of ${VALID_SKILL_TYPES.join(', ')}`);
    assert(VALID_RANGE_TYPES.includes(rangeType), `skill "${id}": rangeType must be one of ${VALID_RANGE_TYPES.join(', ')}`);
    assert(VALID_TARGET_TYPES.includes(targetType), `skill "${id}": targetType must be one of ${VALID_TARGET_TYPES.join(', ')}`);

    assert(VALID_HIT_TYPES.includes(hitType), `skill "${id}": hitType must be one of ${VALID_HIT_TYPES.join(', ')}`);
    assert(maxTargets === null || (Number.isInteger(maxTargets) && maxTargets >= 1), `skill "${id}": maxTargets must be a positive integer or null`);

    assert(vfx === null || VALID_VFX_TYPES.includes(vfx), `skill "${id}": vfx must be one of ${VALID_VFX_TYPES.join(', ')}`);
    assert(element === null || ELEMENTS.includes(element), `skill "${id}": unknown element "${element}"`);

    return { id, name, type, description, icon, color, cd, mpCost, unlockCost, damageMult, range, rangeType, targetType, hitType, maxTargets, effect, element, vfx, vfxOptions };
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
 *           nextJobs: ['my_advanced_job_a', 'my_advanced_job_b'], // 進める上位職（複数可）。無ければ省略
 *           // 上位職が1つだけなら nextJob: 'my_advanced_job' でも書ける（内部では nextJobs に統一される）
 *           atkMult: 1.0, defMult: 1.0, hpMult: 1.0, mpMult: 1.0, // ステータス倍率（省略時1.0）
 *           attackCooldownMult: 1.0, // 通常攻撃の間隔倍率（小さいほど速い）
 *           attackRange: 80,   // 通常攻撃の距離(px)
 *           attackHit: 'area', // 'area'=範囲内全員 / 'single'=一番近い1体
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
    nextJobs = null,
    // ステータス倍率（1.0 = 標準）。atkBonus等の固定値と違い、レベルが上がっても差が残る。
    // Player.applyEquipmentStats で基礎値に掛ける（パッシブ・装備の補正はその後に乗る）
    atkMult = 1,
    defMult = 1,
    hpMult = 1,
    mpMult = 1,
    // 通常攻撃の間隔にかける倍率（小さいほど速い。0.7=約1.4倍速、1.2=遅め）
    attackCooldownMult = 1,
    // 通常攻撃（SPACE）の届く距離(px)。近接職は短く、遠距離職は長くする
    attackRange = 80,
    // 通常攻撃の命中方式。'area' = 範囲内の全員 / 'single' = 一番近い1体だけ
    attackHit = 'area',
} = {}) {
    assert(id, 'job is missing an id');
    assert(name, `job "${id}": missing a name`);
    assert(VALID_JOB_TYPES.includes(type), `job "${id}": type must be one of ${VALID_JOB_TYPES.join(', ')}`);

    [['atkMult', atkMult], ['defMult', defMult], ['hpMult', hpMult], ['mpMult', mpMult], ['attackCooldownMult', attackCooldownMult]]
        .forEach(([key, value]) => assert(value > 0, `job "${id}": ${key} must be positive`));
    assert(attackRange > 0, `job "${id}": attackRange must be positive`);
    assert(VALID_HIT_TYPES.includes(attackHit), `job "${id}": attackHit must be one of ${VALID_HIT_TYPES.join(', ')}`);

    // 上位職の一覧。nextJobs を優先し、無ければ nextJob（単体指定）を配列にする。
    // 旧コード互換のため nextJob には先頭の1つも入れておく。
    const nexts = Array.isArray(nextJobs) ? nextJobs : (nextJob ? [nextJob] : []);
    const job = { id, type, name, description, atkBonus, defBonus, hpBonus, skills, nextJob: nexts[0] || null, nextJobs: nexts, atkMult, defMult, hpMult, mpMult, attackCooldownMult, attackRange, attackHit };
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
 * `type: 'accessory'` is the 宝具 (relic/treasure) slot: a third equip
 * slot alongside weapon/armor (see `equipment.relic` in Player.js). It
 * uses the same `stats` vocabulary as weapon/armor — there is no new
 * field to add, just give it whatever mix of bonuses fits the item.
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
    // Equipment category used by job compatibility checks. Legacy equipment
    // can omit it and remains universally usable.
    weaponClass = null,
} = {}) {
    assert(id, 'item is missing an id');
    assert(name, `item "${id}": missing a name`);
    assert(VALID_ITEM_TYPES.includes(type), `item "${id}": type must be one of ${VALID_ITEM_TYPES.join(', ')}`);
    assert(price >= 0, `item "${id}": price must not be negative`);

    // lvlReq is kept as the field name existing UI/equip-check code reads;
    // `level` is the schema-facing name requested for the struct.
    const item = { id, name, type, description, price, level, lvlReq: level, stats, effect, weaponClass };
    if (typeof calculateAtk === 'function') item.calculateAtk = calculateAtk;
    return item;
}
