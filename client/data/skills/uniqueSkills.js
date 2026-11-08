/**
 * ユニークスキル（特殊クエスト報酬専用）
 * 通常の職業進行では絶対に習得できない、クエスト報酬のみで手に入るレアスキル。
 * 全職業で使用可能（jobに縛られない）。
 */
import { defineSkill } from '../schema.js';

function active(def) {
    return defineSkill({ ...def, type: 'active', unlockCost: 0 });
}
function passive(def) {
    return defineSkill({ ...def, type: 'passive', unlockCost: 0 });
}

export const UNIQUE_SKILLS = {

    // ===== ドラゴン神の試練クエスト報酬 =====
    // dragon_god_trial: ドラゴンボスを10回倒す → 竜神斬を習得
    dragon_god_slash: active({
        id: 'dragon_god_slash',
        name: '竜神斬 【UNIQUE】',
        vfx: 'slash',
        vfxOptions: { slashColor: 0xff4400 },
        element: 'fire',
        cd: 20000,
        damageMult: 120,
        mpCost: 80,
        range: 400,
        rangeType: 'line',
        color: 0xff6600,
        icon: '🐉',
        description: '竜神の力を宿した究極の一閃。単体に絶大なダメージ。【クエスト限定スキル】',
        hitType: 'single',
    }),

    // ===== 千の屍の上に立つ者クエスト報酬 =====
    // ancient_hero_quest: 累計1000体倒す → 古の英雄の魂(パッシブ)
    ancient_hero_soul: passive({
        id: 'ancient_hero_soul',
        name: '古の英雄の魂 【UNIQUE】',
        icon: '👑',
        description: '幾多の戦いを経た英雄の魂が宿る。攻撃力+15%、防御力+15%、最大HP+15%、獲得EXP+10%。【クエスト限定スキル】',
        effect: { atkMult: 1.15, defMult: 1.15, maxHpMult: 1.15, expMultBonus: 0.10 }
    }),

    // ===== 虚無の探求者クエスト報酬（転生後限定）=====
    // void_walker_trial: 転生後に特殊敵を50体倒す → 虚無の刃
    void_reaver: active({
        id: 'void_reaver',
        name: '虚無の刃 【UNIQUE】',
        vfx: 'blast',
        element: 'dark',
        cd: 15000,
        damageMult: 80,
        mpCost: 60,
        range: 320,
        rangeType: 'circle',
        color: 0x220033,
        icon: '🌑',
        description: '虚無の力を解き放ち、周囲の敵の存在を削る。与ダメージの10%を吸収。【クエスト限定スキル】',
        effect: { lifestealOnHit: 0.10 },
    }),

    // ===== 永遠の狩人クエスト（リピートクエスト達成数報酬）=====
    // eternal_hunter_mastery: リピートクエストを50回こなす → 永遠の狩人の証（パッシブ）
    eternal_hunter_mark: passive({
        id: 'eternal_hunter_mark',
        name: '永遠の狩人の証 【UNIQUE】',
        icon: '🏹',
        description: '飽くなき狩りへの献身。スキルCT-15%、会心率+10%、移動速度+20。【クエスト限定スキル】',
        effect: { cooldownMult: 0.85, critChanceFlat: 0.10, speedFlat: 20 }
    }),

    // ===== 炎の守護者クエスト報酬 =====
    // flame_guardian_quest: 火山マップで火属性ボスを5回 → 炎の守護
    sacred_flame_ward: active({
        id: 'sacred_flame_ward',
        name: '聖炎の守護 【UNIQUE】',
        targetType: 'party',
        vfx: 'support',
        cd: 30000,
        mpCost: 70,
        range: 350,
        rangeType: 'circle',
        color: 0xff6600,
        icon: '🔥',
        description: '聖なる炎で味方を包み込む。攻撃力+50%・防御力+50%（20秒）。【クエスト限定スキル】',
        effect: { buffType: 'attack_buff', buffMult: 0.5, buffDuration: 20000 },
    }),

    // ===== 時空を超える絆クエスト報酬 =====
    // friend_warp_quest: 仲間と共に魔物を討伐 → フレンドワープ
    friend_warp: active({
        id: 'friend_warp',
        name: 'フレンドワープ 【UNIQUE】',
        targetType: 'party',
        vfx: 'support',
        cd: 8000,
        mpCost: 20,
        range: 0,
        rangeType: 'circle',
        color: 0x00ffff,
        icon: '🌀',
        description: '時空を超えてチーム内の任意のプレイヤーの元へ瞬時にテレポートする。【特殊クエスト限定スキル】',
        hitType: 'single',
    }),
};
