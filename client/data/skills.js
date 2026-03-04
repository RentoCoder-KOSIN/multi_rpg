/**
 * スキルデータ（従来のインターフェース用）
 * 
 * 注: スキルは skills/ ディレクトリ内に職業別・カテゴリ別に分類されています
 * 新しいスキル追加時は skills/skillRegistry.js を参照してください
 */

// 新しい構造からすべてのスキルをインポート
export { SKILLS, getSkillData, SKILLS_BY_JOB, COMMON_SKILLS } from './skills/skillRegistry.js';
