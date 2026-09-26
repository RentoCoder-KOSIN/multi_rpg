/**
 * Enemy stats cache.
 * The server owns the data (server/data/enemyStats.js);
 * the client fetches it once at boot via loadEnemyStats().
 */

let enemyStats = {};

const FALLBACK_STATS = { displayName: '???', hp: 1, atk: 0, def: 0, exp: 0, gold: 0 };

/**
 * Fetch enemy stats from the server. Call once before starting Phaser.
 */
export async function loadEnemyStats() {
    const res = await fetch('/api/enemy-stats');
    if (!res.ok) throw new Error(`Failed to load enemy stats: HTTP ${res.status}`);
    enemyStats = await res.json();
}

/**
 * @param {string} type - enemy type
 * @returns {Object} stats for the type (safe fallback if unknown)
 */
export function getEnemyStats(type) {
    return enemyStats[type] || enemyStats.slime || FALLBACK_STATS;
}

/**
 * @param {string} type - enemy type
 * @returns {string} display name
 */
export function getEnemyDisplayName(type) {
    return enemyStats[type]?.displayName || type;
}
