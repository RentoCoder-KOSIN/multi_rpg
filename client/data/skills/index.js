/**
 * スキルモジュール（バレルエクスポート）
 * 後方互換性のためにメインの skills.js から skillRegistry.js を再エクスポート
 */

export { SKILLS, getSkillData, SKILLS_BY_JOB, COMMON_SKILLS } from './skillRegistry.js';
export { PASSIVE_SKILLS } from './passiveSkills.js';
export { BUFF_SKILLS } from './buffSkills.js';
export { FIGHTER_SKILLS } from './fighterSkills.js';
export { MAGE_SKILLS } from './mageSkills.js';
export { TANK_SKILLS } from './tankSkills.js';
export { RANGER_SKILLS } from './rangerSkills.js';
export { SUMMONER_SKILLS } from './summonerSkills.js';
export { ADVANCED_SKILLS } from './advancedSkills.js';
export { PRIEST_SKILLS } from './priestSkills.js';
