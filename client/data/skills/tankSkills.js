/**
 * タンクスキル
 * 圧倒的な防御力と体力を誇る守りの要
 *
 * [役割と特徴]
 * - ヘイト挑発（ウォークライ）で敵を一手に引き寄せ、味方や後衛を守る
 * - ガード・鉄壁によるダメージ70%〜50%大幅カット
 * - 防御力（DEF）を攻撃力に変換して叩き込むシールドバッシュ
 * - 被弾時に自身のDEF比例で自動反撃するスパイクガード
 */
import { defineSkill } from '../schema.js';

export const TANK_SKILLS = {
    guard: defineSkill({
        id: 'guard', name: 'ガード', type: 'active',
        cd: 6000, mpCost: 5, unlockCost: 10,
        color: 0x4169e1, icon: '🛡️',
        description: '大盾を構えて5秒間、受けるダメージを70%軽減する。',
        effect: { buffType: 'damage_cut_buff', buffValue: 0.70, buffDuration: 5000 }
    }),
    war_cry: defineSkill({
        id: 'war_cry', name: 'ウォークライ', type: 'active',
        cd: 9000, mpCost: 12, unlockCost: 30,
        range: 350, rangeType: 'circle',
        color: 0xff4500, icon: '📢',
        description: '魂の咆哮で周囲350pxの敵全員を強制挑発（8秒間ヘイト集中）し自身へ引き寄せ、自身の防御力+50%。',
        effect: { taunt: true, tauntDuration: 8000, pullEnemies: true, buffType: 'defense_buff', buffValueMult: 0.5, buffDuration: 8000 }
    }),
    iron_defense: defineSkill({
        id: 'iron_defense', name: '鉄壁の守り', type: 'active',
        cd: 15000, mpCost: 20, unlockCost: 50,
        color: 0x708090, icon: '🏰',
        description: '10秒間、被ダメージ50%軽減＋防御力+100%の城塞を展開する。',
        effect: { buffType: 'damage_cut_buff', buffValue: 0.50, buffDuration: 10000, extraBuff: { type: 'defense_buff', mult: 1.0, duration: 10000 } }
    }),
    shield_bash: defineSkill({
        id: 'shield_bash', name: 'シールドバッシュ', type: 'active',
        cd: 4500, damageMult: 25, mpCost: 15, unlockCost: 100,
        range: 100, rangeType: 'circle',
        color: 0xcd853f, icon: '🛡️',
        description: '盾で敵を強打する。自身の防御力の350%が威力に上乗せされ、敵を高確率でスタンさせる。',
        defScaling: 3.5,
        hitType: 'single',
        effect: { statusEffect: 'paralyze', statusChance: 0.8, statusDuration: 2000 }
    }),
    spike_guard: defineSkill({
        id: 'spike_guard', name: 'スパイクガード', type: 'active',
        cd: 8000, damageMult: 30, mpCost: 18, unlockCost: 120,
        range: 120, rangeType: 'circle',
        color: 0x999999, icon: '⚙️',
        description: '棘の障壁を展開し周囲にダメージを与える。さらに8秒間、被弾時に自身のDEF120%の反撃ダメージを自動で返す。',
        effect: { buffType: 'spike_guard', buffValue: 1.2, buffDuration: 8000 }
    })
};
