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
    ...ADVANCED_SKILLS
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
 * 職業IDからその職業が習得可能なスキルのカテゴリを取得
 */
export const SKILLS_BY_JOB = {
    fighter: ['slash', 'whirlwind', 'heavy_slash', 'sonic_wave', 'ground_smash', 'fighting_spirit'],
    mage: ['fireball', 'ice_needle', 'big_fireball', 'dark_nova', 'meteor_swarm', 'thunder_storm', 'mana_well'],
    tank: ['guard', 'iron_defense', 'shield_bash', 'immovable_body'],
    ranger: ['rapid_fire', 'arrow_rain', 'holy_arrow', 'wind_walker'],
    summoner: ['summon', 'mega_summon', 'command_attack', 'spirit_link'],
    priest: ['heal', 'attack_buff', 'defense_buff', 'speed_buff', 'summon_boost', 'holy_arrow'],

    // 上位職
    knight: ['judgment_cut'],
    archmage: ['abyss_storm'],
    paladin: ['holy_sanctuary'],
    sniper: ['death_rain'],
    high_summoner: ['demon_lord_summon']
};

/**
 * 共通スキル（全職業が習得可能）
 */
export const COMMON_SKILLS = Object.keys(BUFF_SKILLS);
