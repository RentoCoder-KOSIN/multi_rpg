/**
 * ファイタースキル
 * 攻撃力と防御力のバランスが良い近接職
 *
 * [バランス調整ログ]
 * - slash: damageMult 10→18, cd 1500（序盤の主力。使いやすく）
 * - whirlwind: damageMult 14→26, cd 4000
 * - heavy_slash: damageMult 17→32, cd 3000（単体高火力として差別化）
 * - sonic_wave: damageMult 9→20, cd 2500（遠距離が弱かったので強化）
 * - ground_smash: damageMult 22→45, cd 7000（大技として強力に）
 */
import { defineSkill } from "../schema.js";

export const FIGHTER_SKILLS = {
    slash: defineSkill({
        id: "slash", vfx: 'slash',
        name: "スラッシュ",
        type: "active",
        cd: 1500,
        damageMult: 18,
        mpCost: 5,
        unlockCost: 10,
        range: 80,
        rangeType: "circle",
        color: 0xffffff,
        icon: "⚔️",
        description: "力強く斬りつける。",
        hitType: "single",
    }),
    whirlwind: defineSkill({
        id: "whirlwind", vfx: 'slash',
        name: "ホイールウィンド",
        type: "active",
        cd: 4000,
        damageMult: 26,
        mpCost: 15,
        unlockCost: 30,
        range: 120,
        rangeType: "circle",
        color: 0x87ceeb,
        icon: "🌪️",
        description: "回転斬りで周囲をなぎ倒す。",
    }),
    heavy_slash: defineSkill({
        id: "heavy_slash", vfx: 'slash', vfxOptions: { slashColor: 0xff0000 },
        name: "ヘビースラッシュ",
        type: "active",
        cd: 3000,
        damageMult: 32,
        mpCost: 15,
        unlockCost: 50,
        range: 100,
        rangeType: "circle",
        color: 0xff0000,
        icon: "🗡️",
        description: "渾身の一撃。30%で敵を麻痺させる。",
        hitType: "single",
        effect: { statusEffect: 'paralyze', statusChance: 0.3, statusDuration: 2500 },
    }),
    sonic_wave: defineSkill({
        id: "sonic_wave", vfx: 'projectile',
        name: "ソニックウェーブ",
        type: "active",
        cd: 2500,
        damageMult: 20,
        mpCost: 12,
        unlockCost: 30,
        range: 220,
        rangeType: "line",
        color: 0x00ffff,
        icon: "🌊",
        description: "衝撃波を前方に飛ばす。",
    }),
    ground_smash: defineSkill({
        id: "ground_smash",
        name: "地裂斬",
        type: "active",
        cd: 7000,
        damageMult: 45,
        mpCost: 25,
        unlockCost: 100,
        range: 160,
        rangeType: "circle",
        color: 0x8b4513,
        icon: "🔨",
        description: "地面を叩き割り、広範囲にダメージを与える。",
    }),
};
