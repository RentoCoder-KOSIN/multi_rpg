/**
 * レンジャースキル
 * 素早い動きで敵を翻弄する遠距離職
 */
import { defineSkill } from '../schema.js';

export const RANGER_SKILLS = {
    rapid_fire: defineSkill({
        id: 'rapid_fire', name: 'ラピッドファイア', type: 'active',
        cd: 2000, damageMult: 5, mpCost: 12, unlockCost: 10,
        range: 250, rangeType: 'circle',
        color: 0x00ff00, icon: '🏹',
        description: '目にも止まぬ速射。',
        hitType: 'single',
    }),
    arrow_rain: defineSkill({
        id: 'arrow_rain', name: 'アローレイン', type: 'active',
        cd: 5000, damageMult: 10, mpCost: 20, unlockCost: 50,
        range: 300, rangeType: 'circle',
        color: 0x9acd32, icon: '🌧️',
        description: '矢の雨を降らせる。'
    }),
    piercing_shot: defineSkill({
        id: 'piercing_shot', name: 'ピアシングショット', type: 'active',
        cd: 3000, damageMult: 13, mpCost: 15, unlockCost: 80,
        range: 260, rangeType: 'line',
        color: 0xc0c0c0, icon: '🎯',
        description: '直線状の敵を貫く強弓。25%で敵を麻痺させる。',
        effect: { statusEffect: 'paralyze', statusChance: 0.25, statusDuration: 1800 },
    }),
    multi_shot: defineSkill({
        id: 'multi_shot', name: 'マルチショット', type: 'active',
        cd: 4000, damageMult: 8, mpCost: 18, unlockCost: 100,
        range: 200, rangeType: 'fan',
        color: 0x7fff00, icon: '🏹',
        description: '扇状に矢をばらまく。',
        maxTargets: 3,
    }),
    explosive_arrow: defineSkill({
        id: 'explosive_arrow', name: 'エクスプロージョンアロー', type: 'active',
        cd: 8000, damageMult: 16, mpCost: 25, unlockCost: 150,
        range: 220, rangeType: 'circle',
        color: 0xff8c00, icon: '💥',
        description: '着弾地点で爆発する特殊矢。'
    })
};
