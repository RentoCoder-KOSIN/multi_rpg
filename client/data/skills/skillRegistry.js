/**
 * スキルレジストリ
 * すべてのスキルを統合・管理するメインファイル
 */

import { PASSIVE_SKILLS } from './passiveSkills.js';
import { BUFF_SKILLS } from './buffSkills.js';
import { FIGHTER_SKILLS } from './fighterSkills.js';
import { MAGE_SKILLS } from './mageSkills.js';
import { TANK_SKILLS } from './tankSkills.js';
import { RANGER_SKILLS } from './rangerSkills.js';
import { SUMMONER_SKILLS } from './summonerSkills.js';
import { ADVANCED_SKILLS } from './advancedSkills.js';
import { ADVANCED_SKILLS_EXTRA } from './advancedSkillsExtra.js';
import { PRIEST_SKILLS } from './priestSkills.js';

/**
 * すべてのスキルを統合したオブジェクト
 */
export const SKILLS = {
    // パッシブスキル
    ...PASSIVE_SKILLS,

    // 共通スキル（バフ・ヒール）
    ...BUFF_SKILLS,

    // 基本職スキル
    ...FIGHTER_SKILLS,
    ...MAGE_SKILLS,
    ...TANK_SKILLS,
    ...RANGER_SKILLS,
    ...SUMMONER_SKILLS,
    ...PRIEST_SKILLS,

    // 上位職スキル
    ...ADVANCED_SKILLS,
    ...ADVANCED_SKILLS_EXTRA
};

/**
 * スキルIDから定義を取得
 * @param {string} skillId - スキルID
 * @returns {Object|undefined} スキル定義
 */
export function getSkillData(skillId) {
    return SKILLS[skillId];
}

/**
 * 職業別スキルマップ
 *
 * 注: ゲーム内で実際に使われている習得可否・必要レベルの一次情報は
 * jobs.js の各職業の `skills: { レベル: [id] } ` マップ（SkillManagerUI.js
 * がここを見て職業の系譜を辿る）。このマップはあくまで「この職業に属する
 * スキル一覧」の参考情報として、jobs.js と内容を揃えて保持している。
 * 上位職は自分の代で新しく増えるスキルのみを載せ、継承元のスキルは
 * 基本職側の配列を参照すること。
 */
export const SKILLS_BY_JOB = {
    fighter: ['slash', 'whirlwind', 'heavy_slash', 'sonic_wave', 'ground_smash', 'fighting_spirit', 'counter_stance'],
    mage: ['fireball', 'ice_needle', 'big_fireball', 'dark_nova', 'meteor_swarm', 'thunder_storm', 'mana_well'],
    tank: ['guard', 'iron_defense', 'shield_bash', 'immovable_body', 'spike_guard', 'stalwart_heart', 'retaliate'],
    ranger: ['rapid_fire', 'arrow_rain', 'piercing_shot', 'multi_shot', 'wind_walker', 'explosive_arrow', 'hunters_focus'],
    summoner: ['summon', 'mega_summon', 'spirit_bolt', 'command_attack', 'familiar_speed', 'spirit_link', 'beast_bond'],
    priest: ['heal', 'attack_buff', 'holy_arrow', 'defense_buff', 'speed_buff', 'summon_boost', 'blessed_vitality'],

    // 上位職（継承元のスキルは含めず、その職業の代で新規に増える分だけ）
    knight: ['judgment_cut', 'guardian_slash', 'veteran_instinct', 'last_stand'],
    archmage: ['abyss_storm', 'chain_lightning', 'arcane_efficiency', 'mind_over_matter'],
    paladin: ['holy_sanctuary', 'smite', 'aegis_of_faith', 'retribution_aura'],
    sniper: ['death_rain', 'headshot', 'eagle_eye', 'swift_reload'],
    high_summoner: ['demon_lord_summon', 'arcane_barrage', 'overlords_pact', 'ancient_bond'],
    exorcist: ['exorcism', 'divine_judgment', 'sanctified_ground', 'unwavering_faith'],

    // 上位職（追加分。基本職ごとに4職になるよう増やした18職）
    berserker: ['rampage_slash', 'blood_frenzy', 'bloodlust', 'berserk_heart'],
    samurai: ['iai_slash', 'moonlit_blade', 'bushido', 'zanshin'],
    dragon_knight: ['dragon_thrust', 'dragon_breath', 'dragon_scale', 'dragon_soul'],
    elementalist: ['flame_lance', 'tempest_burst', 'elemental_mastery', 'prismatic_focus'],
    warlock: ['curse_bolt', 'soul_drain', 'dark_pact', 'forbidden_knowledge'],
    sage: ['thunder_judgment', 'arcane_ward', 'sages_wisdom', 'mana_flow'],
    warden: ['bulwark_bash', 'fortress_aura', 'ironwall', 'vital_bastion'],
    avenger: ['vengeful_strike', 'wrath_of_the_fallen', 'grudge', 'unyielding_wrath'],
    juggernaut: ['colossus_slam', 'earthquake', 'titan_hide', 'unstoppable'],
    ninja: ['shuriken_storm', 'shadow_assassinate', 'shadow_step', 'killer_instinct'],
    gunslinger: ['quick_draw', 'bullet_hell', 'sharpshooter', 'gun_kata'],
    wind_archer: ['gale_arrow', 'storm_volley', 'wind_veil', 'zephyr_focus'],
    necromancer: ['death_bolt', 'grave_call', 'undead_pact', 'soul_harvest'],
    beast_lord: ['primal_roar', 'wild_charge', 'pack_leader', 'wild_instinct'],
    spirit_master: ['spirit_lance', 'spirit_storm', 'spirit_communion', 'ethereal_veil'],
    saint: ['holy_radiance', 'benediction', 'divine_grace', 'saintly_aura'],
    war_priest: ['holy_smash', 'sanctified_strike', 'zealous_might', 'holy_resolve'],
    shadow_priest: ['shadow_bolt', 'void_prison', 'dark_devotion', 'twilight_veil']
};

/**
 * 共通スキル（全職業が習得可能）
 */
export const COMMON_SKILLS = Object.keys(BUFF_SKILLS);
