/**
 * 敵のステータスデータ（クライアント・サーバー共通）
 */

export const ENEMY_STATS = {
    slime: {
        displayName: 'スライム',
        hp: 150,
        atk: 5,
        exp: 22,
        gold: 50,
        drops: [
            { id: 'potion', chance: 0.05 },
            { id: 'mp_potion', chance: 0.05 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    bat: {
        displayName: 'コウモリ',
        hp: 330,
        atk: 30,
        exp: 45,
        gold: 70,
        drops: [
            { id: 'potion', chance: 0.15 },
            { id: 'mp_potion', chance: 0.1 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    forest_slime: {
        displayName: '森のスライム',
        hp: 400,
        atk: 75,
        exp: 120,
        gold: 250,
        drops: [
            { id: 'potion', chance: 0.2 },
            { id: 'mp_potion', chance: 0.15 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    skeleton: {
        displayName: 'スケルトン',
        hp: 1300,
        atk: 120,
        exp: 450,
        gold: 400,
        drops: [
            { id: 'high_potion', chance: 0.05 },
            { id: 'mp_potion', chance: 0.1 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    red_slime: {
        displayName: 'レッドスライム',
        hp: 2000,
        atk: 350,
        exp: 650,
        gold: 600,
        drops: [
            { id: 'high_potion', chance: 0.1 },
            { id: 'high_mp_potion', chance: 0.05 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    goblin: {
        displayName: 'ゴブリン',
        hp: 2800,
        atk: 450,
        exp: 950,
        gold: 1200,
        drops: [
            { id: 'high_potion', chance: 0.15 },
            { id: 'high_mp_potion', chance: 0.1 },
            { id: 'holy_weapon', chance: 0.02 }
        ]
    },
    ghost: {
        displayName: 'ゴースト',
        hp: 35000,
        atk: 505,
        exp: 1250,
        gold: 3200,
        drops: [
            { id: 'high_potion', chance: 0.1 },
            { id: 'high_mp_potion', chance: 0.1 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    orc: {
        displayName: 'オーク',
        hp: 50000,
        atk: 750,
        exp: 1500,
        gold: 10000,
        drops: [
            { id: 'high_potion', chance: 0.2 },
            { id: 'high_mp_potion', chance: 0.2 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    dire_wolf: {
        displayName: 'ダイアウルフ',
        hp: 75000,
        atk: 1900,
        exp: 80000,
        gold: 14000,
        drops: [
            { id: 'high_potion', chance: 0.3 },
            { id: 'high_mp_potion', chance: 0.3 },
            { id: 'holy_weapon', chance: 0.002 }
        ]
    },
    boss: {
        displayName: '森の守護者',
        hp: 3000,
        atk: 75,
        exp: 800,
        gold: 2500,
        drops: [
            { id: 'hero_sword', chance: 0.1 },
            { id: 'high_potion', chance: 1.0 },
            { id: 'high_mp_potion', chance: 1.0 }
        ]
    },
    dragon_boss: {
        displayName: 'エンシェントドラゴン',
        hp: 8000000,
        atk: 35000,
        exp: 25000000,
        gold: 10000000,
        drops: [
            { id: 'dragon_scale_armor', chance: 0.2 },
            { id: 'high_potion', chance: 1.0 },
            { id: 'high_mp_potion', chance: 1.0 }
        ]
    }
};

/**
 * 敵のサイズと当たり判定設定
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
 * 敵タイプから統計情報を取得
 * @param {string} type - 敵のタイプ
 * @returns {Object} 敵の統計情報
 */
export function getEnemyStats(type) {
    return ENEMY_STATS[type] || ENEMY_STATS.slime;
}

/**
 * 敵タイプの表示名を取得
 * @param {string} type - 敵のタイプ
 * @returns {string} 敵の表示名
 */
export function getEnemyDisplayName(type) {
    return ENEMY_STATS[type]?.displayName || type;
}

/**
 * 敵タイプのサイズ設定を取得
 * @param {string} type - 敵のタイプ
 * @returns {Object} サイズと当たり判定の設定
 */
export function getEnemySizeConfig(type) {
    return ENEMY_SIZE_CONFIG[type] || ENEMY_SIZE_CONFIG.slime;
}
