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
        description: '自身の足元に10秒間の神聖領域（円）を展開。円の中にいる味方のHPを毎秒持続回復し（回復量は術者のINTに依存）、受ける被ダメージを30%軽減する。円から出ると効果は切れる。',
        // healPerSec: 毎秒の基礎回復量（術者のINT・スキルレベル・回復力補正で伸びる）。healDuration の間、1秒ごとに回復する
        effect: { healPerSec: 15, healDuration: 10000, buffType: 'damage_cut_buff', buffValue: 0.3, buffDuration: 10000, zone: { duration: 10000 } }
    }),
    purifying_ward: defineSkill({
        id: 'purifying_ward', targetType: 'party', vfx: 'support',
        name: '浄化の結界',
        type: 'active',
        cd: 45000,
        mpCost: 45,
        unlockCost: 100,
        range: 200,
        color: 0xbae6fd,
        icon: '🔰',
        description: '足元に聖なる結界（円）を12秒間展開する。円の中にいる味方（自分を含む）は凍結・麻痺・毒などの状態異常を完全に防ぎ、入った時点でかかっている状態異常も浄化される。円から出ると効果は切れる。',
        // status_immunity_buff: 期間中は状態異常を一切受けず、発動時に現在の状態異常も解除する（重ねがけは時間の更新のみ）
        effect: { buffType: 'status_immunity_buff', buffValue: 1, buffDuration: 12000, zone: { duration: 12000 } }
    })
};
