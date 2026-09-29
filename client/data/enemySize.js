/**
 * Enemy render size and hitbox (client-only, purely visual settings).
 *
 * The size class of each enemy (`size: 'small' | 'medium' | ...`) is defined once,
 * together with the rest of its data, in server/data/enemyStats.js and arrives via /api/enemy-stats.
 */
import { getEnemyStats } from './enemyStats.js';

export const SIZE_PRESETS = {
    small: { targetWidth: 40, targetHeight: 40, hitWidth: 32, hitHeight: 26 },
    medium: { targetWidth: 48, targetHeight: 48, hitWidth: 34, hitHeight: 44 },
    large: { targetWidth: 60, targetHeight: 60, hitWidth: 50, hitHeight: 52 },
    boss: { targetWidth: 80, targetHeight: 80, hitWidth: 64, hitHeight: 64 },
    huge: { targetWidth: 110, targetHeight: 110, hitWidth: 90, hitHeight: 90 }
};

/**
 * @param {string} type - enemy type
 * @returns {Object} size and hitbox settings
 */
export function getEnemySizeConfig(type) {
    return SIZE_PRESETS[getEnemyStats(type).size] || SIZE_PRESETS.small;
}
