/**
 * タンクスキル
 * 圧倒的な防御力と体力を誇る守りの要
 */
import { defineSkill } from '../schema.js';

export const TANK_SKILLS = {
    guard: defineSkill({
        id: 'guard', name: 'ガード', type: 'active',
        cd: 5000, mpCost: 2, unlockCost: 10,
        color: 0x4169e1, icon: '🛡️',
        description: '身を守り、次のダメージを軽減する。'
    }),
    iron_defense: defineSkill({
        id: 'iron_defense', name: '鉄壁の守り', type: 'active',
        cd: 10000, mpCost: 10, unlockCost: 50,
        color: 0x708090, icon: '🏰',
        description: '防御力を極限まで高める。'
    }),
    shield_bash: defineSkill({
        id: 'shield_bash', name: 'シールドバッシュ', type: 'active',
        cd: 6000, damageMult: 8, mpCost: 15, unlockCost: 100,
        range: 90, rangeType: 'circle',
        color: 0xcd853f, icon: '🛡️',
        description: '盾で殴りつける。'
    }),
    spike_guard: defineSkill({
        id: 'spike_guard', name: 'スパイクガード', type: 'active',
        cd: 7000, damageMult: 10, mpCost: 15, unlockCost: 120,
        range: 90, rangeType: 'circle',
        color: 0x999999, icon: '⚙️',
        description: '棘の生えた盾を構え、近づく敵に反撃ダメージを与える。'
    })
};
