/**
 * プリーストスキル
 * 聖なる祝福と治癒、そして邪悪を浄化する光の裁きを下す聖職者
 */
import { defineSkill } from '../schema.js';

export const PRIEST_SKILLS = {
    heal: defineSkill({
        id: 'heal', targetType: 'party', vfx: 'support',
        name: 'ヒール',
        type: 'active',
        cd: 3500,
        mpCost: 15,
        unlockCost: 10,
        range: 300,
        color: 0x22c55e,
        icon: '💚',
        description: '神聖な奇跡で自身と周囲のパーティメンバーのHPを大きく回復する。',
        effect: { healPower: 120 }
    }),
    blessing: defineSkill({
        id: 'blessing', targetType: 'party', vfx: 'support',
        name: 'ブレスオーラ',
        type: 'active',
        cd: 20000,
        mpCost: 30,
        unlockCost: 30,
        range: 350,
        color: 0xfacc15,
        icon: '✨',
        description: '聖なる祝福を与え、20秒間周囲の味方の攻撃力+30%＆防御力+30%。',
        effect: { buffType: 'attack_buff', buffValueMult: 0.3, buffDuration: 20000, extraBuff: { type: 'defense_buff', mult: 0.3, duration: 20000 } }
    }),
    holy_arrow: defineSkill({
        id: 'holy_arrow', vfx: 'projectile', vfxOptions: { projectile: 'bolt' }, element: 'light',
        name: 'ホーリーアロー',
        type: 'active',
        cd: 2000,
        damageMult: 24,
        mpCost: 8,
        unlockCost: 20,
        range: 270,
        rangeType: 'line',
        color: 0xffd700,
        icon: '🏹',
        description: '聖なる光の矢を放ち、邪悪を浄化する。アンデッド系に1.5倍ダメージ。',
        effect: { vsUndead: 1.5 },
        hitType: 'single',
    }),
    judgment_light: defineSkill({
        id: 'judgment_light', vfx: 'blast', element: 'light',
        name: 'ジャッジメントライト',
        type: 'active',
        cd: 6000,
        damageMult: 38,
        mpCost: 25,
        unlockCost: 60,
        range: 220,
        rangeType: 'circle',
        color: 0xfef08a,
        icon: '✝️',
        description: '天より光の柱を落として広範囲を焼き払う。アンデッド系に2倍ダメージ。',
        effect: { vsUndead: 2.0 },
    }),
    sanctuary: defineSkill({
        id: 'sanctuary', targetType: 'party', vfx: 'support',
        name: 'サンクチュアリ',
        type: 'active',
        cd: 15000,
        mpCost: 35,
        unlockCost: 80,
        range: 250,
        color: 0xa7f3d0,
        icon: '🕊️',
        description: '自身を中心に10秒間の神聖領域を展開。領域内の味方のHPを毎秒持続回復し、受ける被ダメージを30%軽減する。',
        effect: { healPower: 80, buffType: 'damage_cut_buff', buffValue: 0.3, buffDuration: 10000 }
    })
};
