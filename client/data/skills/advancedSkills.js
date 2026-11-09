/**
 * 上位職スキル（レベル30以上）
 * ナイト、アークメイジ、パラディン、スナイパー、ハイサモナー、エクソシスト用
 * （常時発動のパッシブ側は passiveSkills.js にまとめてある）
 *
 * [バランス調整ログ]
 * - abyss_storm: cd 12000→15000、damageMult 45→42（範囲AoEとして適切な値に）
 * - judgment_cut: damageMult 35→38（単体最強スキルとして差別化）
 * - guardian_slash: damageMult 20→23、rangeType line→circle（使い勝手向上）
 * - holy_sanctuary: cd 20000→18000（タンク上位のサポートとして使いやすく）
 * - smite: damageMult 18→22（パラディンの攻撃力を少し強化）
 * - death_rain: cd 6000→5000、damageMult 22→25（レンジャー上位の範囲スキル強化）
 * - headshot: damageMult 26→30（単体高火力として強化）
 * - exorcism: damageMult 30→34（エクソシスト特化スキル強化）
 * - divine_judgment: damageMult 32→36（エクソシスト 2つ目も強化）
 * - demon_lord_summon: cd 60000→30000、mpCost 200→150（使える頻度を現実的に）
 * - arcane_barrage: damageMult 24→28（ハイサモナー火力スキル強化）
 */
import { defineSkill } from '../schema.js';

export const ADVANCED_SKILLS = {
    // --- ナイト (騎士 - ファイター上位職) ---
    judgment_cut: defineSkill({
        id: 'judgment_cut', vfx: 'slash', vfxOptions: { slashColor: 0x00ffff }, name: '絶・次元斬', type: 'active',
        cd: 4000, damageMult: 65, mpCost: 40, unlockCost: 500,
        range: 250, rangeType: 'line',
        color: 0x00ffff, icon: '💠',
        description: '空間を切り裂く超高速の一閃。単体に強烈なダメージ。',
        hitType: 'single',
    }),
    guardian_slash: defineSkill({
        id: 'guardian_slash', name: 'ガーディアンスラッシュ', type: 'active',
        cd: 5000, damageMult: 48, mpCost: 30, unlockCost: 500,
        range: 150, rangeType: 'circle',
        color: 0xb0c4de, icon: '⚔️',
        description: '守りの構えから繰り出す近接範囲の一撃。'
    }),

    // --- アークメイジ (メイジ上位職) ---
    abyss_storm: defineSkill({
        id: 'abyss_storm', vfx: 'blast', vfxOptions: { particleCount: 30, shake: true }, element: 'dark', name: 'アビスストーム', type: 'active',
        cd: 15000, damageMult: 80, mpCost: 100, unlockCost: 500,
        range: 350, rangeType: 'circle',
        color: 0x4b0082, icon: '🌀',
        description: '深淵の嵐を呼び寄せ、全てを飲み込む。'
    }),
    chain_lightning: defineSkill({
        id: 'chain_lightning', element: 'thunder', name: 'チェインライトニング', type: 'active',
        cd: 6000, damageMult: 52, mpCost: 45, unlockCost: 500,
        range: 220, rangeType: 'fan',
        color: 0xffff33, icon: '⚡',
        description: '雷撃が周囲の敵を連鎖して撃つ。',
        maxTargets: 4,
    }),

    // --- パラディン (タンク上位職) ---
    holy_sanctuary: defineSkill({
        id: 'holy_sanctuary', element: 'light', name: 'ホーリーサンクチュアリ', type: 'active',
        cd: 18000, damageMult: 45, mpCost: 80, unlockCost: 500,
        range: 300, rangeType: 'circle',
        color: 0xffff00, icon: '✝️',
        description: '神聖な領域を展開し、敵には裁きを、味方には加護を。'
    }),
    smite: defineSkill({
        id: 'smite', element: 'light', name: 'スマイト', type: 'active',
        cd: 5000, damageMult: 50, mpCost: 35, unlockCost: 500,
        range: 150, rangeType: 'circle',
        color: 0xfff2cc, icon: '⚡',
        description: '天罰を下す一撃。アンデッド系に1.5倍のダメージ。',
        effect: { vsUndead: 1.5 },
        hitType: 'single',
    }),

    // --- スナイパー (レンジャー上位職) ---
    death_rain: defineSkill({
        id: 'death_rain', name: 'デスレイン', type: 'active',
        cd: 5000, damageMult: 55, mpCost: 45, unlockCost: 500,
        range: 400, rangeType: 'circle',
        color: 0x00ff00, icon: '🏹',
        description: '空から無数の死の矢を降らせる。'
    }),
    headshot: defineSkill({
        id: 'headshot', name: 'ヘッドショット', type: 'active',
        cd: 4000, damageMult: 60, mpCost: 30, unlockCost: 500,
        range: 320, rangeType: 'line',
        color: 0xff4444, icon: '🎯',
        description: '急所を正確に撃ち抜く必殺の一射。',
        hitType: 'single',
    }),

    // --- エクソシスト (プリースト上位職) ---
    exorcism: defineSkill({
        id: 'exorcism', element: 'light', name: 'エクソシズム', type: 'active',
        cd: 8000, damageMult: 62, mpCost: 60, unlockCost: 500,
        range: 300, rangeType: 'line',
        color: 0xfff2cc, icon: '⛧',
        description: '邪悪なる存在を祓い清める神聖なる裁き。アンデッド系に2倍のダメージ。',
        effect: { vsUndead: 2.0 },
        hitType: 'single',
    }),
    divine_judgment: defineSkill({
        id: 'divine_judgment', element: 'light', name: 'ディヴァインジャッジメント', type: 'active',
        cd: 9000, damageMult: 68, mpCost: 65, unlockCost: 500,
        range: 280, rangeType: 'line',
        color: 0xffe4b5, icon: '⚡',
        description: '天より下る裁きの光。アンデッド系に1.5倍のダメージ。',
        effect: { vsUndead: 1.5 },
        hitType: 'single',
    }),

    // --- ハイサモナー (サモナー上位職) ---
    demon_lord_summon: defineSkill({
        id: 'demon_lord_summon', name: '魔王召喚', type: 'active',
        cd: 30000, mpCost: 150, unlockCost: 1000,
        color: 0xff0000, icon: '👑',
        description: '伝説の魔王を一時的に現世に呼び出す。'
    }),
    arcane_barrage: defineSkill({
        id: 'arcane_barrage', name: 'アルケインバラージ', type: 'active',
        cd: 7000, damageMult: 55, mpCost: 55, unlockCost: 500,
        range: 230, rangeType: 'circle',
        color: 0x9932cc, icon: '🔮',
        description: '無数の魔力弾を降らせる。'
    })
};
