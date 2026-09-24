/**
 * Enemy render size and hitbox (client-only, purely visual settings).
 */
export const ENEMY_SIZE_CONFIG = {
    slime: { targetWidth: 40, targetHeight: 40, hitWidth: 32, hitHeight: 26 },
    forest_slime: { targetWidth: 40, targetHeight: 40, hitWidth: 32, hitHeight: 26 },
    red_slime: { targetWidth: 40, targetHeight: 40, hitWidth: 32, hitHeight: 26 },
    bat: { targetWidth: 40, targetHeight: 40, hitWidth: 32, hitHeight: 26 },
    skeleton: { targetWidth: 48, targetHeight: 48, hitWidth: 34, hitHeight: 44 },
    goblin: { targetWidth: 48, targetHeight: 48, hitWidth: 34, hitHeight: 44 },
    ghost: { targetWidth: 48, targetHeight: 48, hitWidth: 34, hitHeight: 44 },
    orc: { targetWidth: 60, targetHeight: 60, hitWidth: 50, hitHeight: 52 },
    dire_wolf: { targetWidth: 60, targetHeight: 60, hitWidth: 50, hitHeight: 52 },
    boss: { targetWidth: 80, targetHeight: 80, hitWidth: 64, hitHeight: 64 },
    dragon_boss: { targetWidth: 80, targetHeight: 80, hitWidth: 64, hitHeight: 64 }
};

/**
 * @param {string} type - enemy type
 * @returns {Object} size and hitbox settings
 */
export function getEnemySizeConfig(type) {
    return ENEMY_SIZE_CONFIG[type] || ENEMY_SIZE_CONFIG.slime;
}
