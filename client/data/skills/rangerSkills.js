/**
 * レンジャースキル
 * 超遠距離射撃と身軽な回避・撹乱を併せ持つ曲射職
 */
import { defineSkill } from '../schema.js';

export const RANGER_SKILLS = {
    backstep_shot: defineSkill({
        id: 'backstep_shot', vfx: 'projectile', name: 'バックステップショット', type: 'active',
        cd: 3500, damageMult: 20, mpCost: 10, unlockCost: 20,
        range: 220, rangeType: 'line',
        color: 0x38bdf8, icon: '🔄',
        description: '後方へ素早く跳躍宙返り（緊急離脱）しながら前方の敵を撃ち抜く。接近された時の切り返し技。',
        backstepDist: 150,
    }),
    smoke_bomb: defineSkill({
        id: 'smoke_bomb', vfx: 'support', name: 'スモークボム', type: 'active',
        cd: 12000, mpCost: 15, unlockCost: 40,
        range: 200, rangeType: 'circle',
        color: 0x64748b, icon: '💨',
        description: '足元に煙幕を炸裂させる。周囲の敵の命中率を半減させ、自身の回避率+30%＆移動速度+50（8秒間）。',
        effect: { smoke: true, buffType: 'evasion_buff', buffValue: 0.30, buffDuration: 8000 }
    }),
    rapid_fire: defineSkill({
        id: 'rapid_fire', vfx: 'projectile', name: 'ラピッドファイア', type: 'active',
        cd: 2000, damageMult: 18, mpCost: 12, unlockCost: 10,
        range: 260, rangeType: 'circle',
        color: 0x00ff00, icon: '🏹',
        description: '目にも止まらぬ高速連射。',
        hitType: 'single',
    }),
    arrow_rain: defineSkill({
        id: 'arrow_rain', vfx: 'projectile', name: 'アローレイン', type: 'active',
        cd: 5000, damageMult: 32, mpCost: 20, unlockCost: 50,
        range: 320, rangeType: 'circle',
        color: 0x9acd32, icon: '🌧️',
        description: '上空へ矢の束を放ち、広範囲に死の雨を降らせる。'
    }),
    piercing_shot: defineSkill({
        id: 'piercing_shot', name: 'ピアシングショット', type: 'active',
        vfx: 'projectile', vfxOptions: { projectile: 'bolt' },
        cd: 3000, damageMult: 34, mpCost: 15, unlockCost: 80,
        range: 280, rangeType: 'line',
        color: 0xc0c0c0, icon: '🎯',
        description: '直線上の敵を貫通する強弓。30%で敵をスタン（麻痺）させる。',
        effect: { statusEffect: 'paralyze', statusChance: 0.3, statusDuration: 2000 },
    }),
    multi_shot: defineSkill({
        id: 'multi_shot', vfx: 'projectile', name: 'マルチショット', type: 'active',
        cd: 4000, damageMult: 25, mpCost: 18, unlockCost: 100,
        range: 220, rangeType: 'fan',
        color: 0x7fff00, icon: '🏹',
        description: '扇状に無数の矢を斉射し、正面の敵を一掃する。',
        maxTargets: 4,
    }),
    explosive_arrow: defineSkill({
        id: 'explosive_arrow', vfx: 'blast', element: 'fire', name: 'エクスプロージョンアロー', type: 'active',
        cd: 7500, damageMult: 45, mpCost: 25, unlockCost: 150,
        range: 250, rangeType: 'circle',
        color: 0xff8c00, icon: '💥',
        description: '着弾地点で大爆発を引き起こす特殊火薬矢。'
    })
};
