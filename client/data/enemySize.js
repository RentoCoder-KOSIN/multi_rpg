/**
 * Enemy render size and hitbox (client-only, purely visual settings).
 *
 * The size class of each enemy (`size: 'small' | 'medium' | ...`) is defined once,
 * together with the rest of its data, in server/data/enemyStats.js and arrives via /api/enemy-stats.
 */
import { getEnemyStats } from './enemyStats.js';

// 各敵画像ファイルの実描画領域（余白を除いた実際のモンスター境界）
export const ENEMY_SPRITE_BOUNDS = {
    "pipo-enemy001a.png": { width: 480, height: 480, minX: 140, maxX: 340, minY: 139, maxY: 469, w: 201, h: 331 },
    "pipo-enemy002.png":  { width: 480, height: 480, minX: 125, maxX: 358, minY: 144, maxY: 460, w: 234, h: 317 },
    "pipo-enemy006.png":  { width: 480, height: 480, minX: 17,  maxX: 464, minY: 24,  maxY: 469, w: 448, h: 446 },
    "pipo-enemy008.png":  { width: 480, height: 480, minX: 115, maxX: 358, minY: 196, maxY: 465, w: 244, h: 270 },
    "pipo-enemy010a.png": { width: 480, height: 480, minX: 126, maxX: 356, minY: 106, maxY: 459, w: 231, h: 354 },
    "pipo-enemy011.png":  { width: 480, height: 480, minX: 115, maxX: 362, minY: 116, maxY: 468, w: 248, h: 353 },
    "pipo-enemy013.png":  { width: 480, height: 480, minX: 132, maxX: 351, minY: 197, maxY: 454, w: 220, h: 258 },
    "pipo-enemy015.png":  { width: 480, height: 480, minX: 17,  maxX: 452, minY: 73,  maxY: 469, w: 436, h: 397 },
    "pipo-enemy023.png":  { width: 480, height: 480, minX: 22,  maxX: 468, minY: 69,  maxY: 467, w: 447, h: 399 },
    "pipo-enemy025.png":  { width: 480, height: 480, minX: 11,  maxX: 474, minY: 99,  maxY: 463, w: 464, h: 365 },
    "pipo-enemy033.png":  { width: 480, height: 480, minX: 7,   maxX: 473, minY: 88,  maxY: 458, w: 467, h: 371 },
    "pipo-enemy039.png":  { width: 480, height: 480, minX: 77,  maxX: 403, minY: 153, maxY: 466, w: 327, h: 314 },
    "pipo-enemy042.png":  { width: 480, height: 480, minX: 6,   maxX: 473, minY: 182, maxY: 471, w: 468, h: 290 },
    "pipo-enemy043.png":  { width: 600, height: 600, minX: 4,   maxX: 596, minY: 54,  maxY: 588, w: 593, h: 535 },
    "pipo-enemy044d.png": { width: 600, height: 600, minX: 14,  maxX: 586, minY: 4,   maxY: 596, w: 573, h: 593 },
    "pipo-enemy046a.png": { width: 480, height: 480, minX: 123, maxX: 355, minY: 162, maxY: 447, w: 233, h: 286 },
    "pipo-enemy046b.png": { width: 480, height: 480, minX: 126, maxX: 357, minY: 162, maxY: 447, w: 232, h: 286 },
    "slime1.png":         { width: 480, height: 480, minX: 168, maxX: 310, minY: 324, maxY: 447, w: 143, h: 124 },
    "slime2.png":         { width: 480, height: 480, minX: 168, maxX: 310, minY: 324, maxY: 447, w: 143, h: 124 },
    "slime3.png":         { width: 480, height: 480, minX: 168, maxX: 310, minY: 324, maxY: 447, w: 143, h: 124 }
};

// 画面上に実際に表示される実コンテンツの目標高さ（px）
export const SIZE_PRESETS = {
    small:  { targetHeight: 40, attackRange: 60, barWidth: 44, barHeight: 4 },
    medium: { targetHeight: 56, attackRange: 75, barWidth: 54, barHeight: 5 },
    large:  { targetHeight: 90, attackRange: 100, barWidth: 80, barHeight: 6 },
    boss:   { targetHeight: 165, attackRange: 160, barWidth: 180, barHeight: 8 },
    huge:   { targetHeight: 210, attackRange: 200, barWidth: 220, barHeight: 10 }
};

/**
 * @param {string} type - enemy type
 * @returns {Object} size and hitbox settings
 */
export function getEnemySizeConfig(type) {
    const stats = getEnemyStats(type);
    return SIZE_PRESETS[stats?.size] || SIZE_PRESETS.small;
}

/**
 * 敵スプライトの実描画バウンディングボックスを取得
 */
export function getEnemySpriteBounds(spriteName) {
    return ENEMY_SPRITE_BOUNDS[spriteName] || null;
}
