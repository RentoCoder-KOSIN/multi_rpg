import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from "./BaseWindowUI.js";
import { ITEMS } from "../data/items.js";
import { defineItem } from "../data/schema.js";

// クラフト構成データ定義
export const CRAFT_CONFIG = {
    categories: [
        { key: 'weapon', label: '⚔️ 武器', icon: '⚔️' },
        { key: 'armor',  label: '🛡️ 防具', icon: '🛡️' },
        { key: 'relic',  label: '💎 宝具', icon: '💎' },
    ],

    baseTypes: {
        weapon: [
            { key: 'oneHandSword', label: '片手剣', icon: '⚔️', atkMult: 1.0, defMult: 0, hpBonus: 0, mpBonus: 0, speedBonus: 0, critBonus: 0.05, desc: '攻守バランスの取れた標準的な剣' },
            { key: 'twoHandSword', label: '大剣',   icon: '🗡️', atkMult: 1.35, defMult: 0, hpBonus: 40, mpBonus: 0, speedBonus: -5, critBonus: 0.08, desc: '圧倒的な威力を誇る大型両手剣' },
            { key: 'bow',          label: '長弓',   icon: '🏹', atkMult: 0.95, defMult: 0, hpBonus: 0, mpBonus: 20, speedBonus: 10, critBonus: 0.12, desc: '身軽に遠くの標的を射抜く弓' },
            { key: 'staff',        label: '魔導杖', icon: '🪄', atkMult: 0.85, defMult: 0, hpBonus: 0, mpBonus: 120, speedBonus: 0, critBonus: 0.04, desc: '高い魔力を宿した魔導師の杖' },
            { key: 'axe',          label: '戦斧',   icon: '🪓', atkMult: 1.25, defMult: 5, hpBonus: 20, mpBonus: 0, speedBonus: 0, critBonus: 0.15, desc: '会心の一撃を繰り出す重厚な斧' },
            { key: 'spear',        label: '長槍',   icon: '🔱', atkMult: 1.10, defMult: 2, hpBonus: 10, mpBonus: 0, speedBonus: 5, critBonus: 0.07, desc: 'リーチの長い突き刺し型の長槍' },
        ],
        armor: [
            { key: 'plate',   label: '重装甲冑', icon: '🛡️', atkMult: 0, defMult: 1.3, hpBonus: 180, mpBonus: 0, speedBonus: -5, critBonus: 0, desc: '強固な鋼鉄で身を固める重鎧' },
            { key: 'leather', label: '軽装道着', icon: '🥋', atkMult: 0.05, defMult: 0.95, hpBonus: 80, mpBonus: 30, speedBonus: 15, critBonus: 0.05, desc: '俊敏な動きを妨げない軽装鎧' },
            { key: 'robe',    label: '魔導法衣', icon: '🥻', atkMult: 0, defMult: 0.85, hpBonus: 50, mpBonus: 150, speedBonus: 5, critBonus: 0.03, desc: '魔力循環を高める神秘のローブ' },
        ],
        relic: [
            { key: 'ring',   label: '覇者の指輪',  icon: '💍', atkMult: 0.15, defMult: 0, hpBonus: 40, mpBonus: 30, speedBonus: 0, critBonus: 0.10, desc: '攻撃力と会心率を高める指輪' },
            { key: 'amulet', label: '守護の首飾り',icon: '📿', atkMult: 0, defMult: 0.15, hpBonus: 160, mpBonus: 40, speedBonus: 0, critBonus: 0, desc: '生命力と防御力を高める首飾り' },
            { key: 'orb',    label: '賢者の宝珠',  icon: '🔮', atkMult: 0.05, defMult: 0.05, hpBonus: 0, mpBonus: 180, speedBonus: 0, critBonus: 0.05, desc: 'MPと魔法力を極限まで高める宝珠' },
            { key: 'charm',  label: '神速の護符',  icon: '👟', atkMult: 0.08, defMult: 0, hpBonus: 50, mpBonus: 20, speedBonus: 25, critBonus: 0.08, desc: '疾風の如き速度を授ける護符' },
        ]
    },

    grades: [
        { key: 'iron',       label: '鉄製 (アイアン)',     tier: 1, baseAtk: 12,  baseDef: 8,  costGold: 600,   color: '#cccccc', reqItems: [{ id: 'enhance_stone_1', count: 1 }],  desc: '標準的な鉄製素材' },
        { key: 'steel',      label: '鋼製 (スティール)',   tier: 2, baseAtk: 25,  baseDef: 18, costGold: 2400,  color: '#88bbff', reqItems: [{ id: 'enhance_stone_1', count: 3 }],  desc: '鍛え抜かれた鋼鉄' },
        { key: 'mithril',    label: '銀製 (ミスリル)',     tier: 3, baseAtk: 48,  baseDef: 34, costGold: 8500,  color: '#aa88ff', reqItems: [{ id: 'enhance_stone_2', count: 2 }],  desc: '魔力を帯びた希少金属' },
        { key: 'orichalcum', label: '神金 (オリハルコン)', tier: 4, baseAtk: 85,  baseDef: 60, costGold: 28000, color: '#ffd700', reqItems: [{ id: 'enhance_stone_2', count: 5 }],  desc: '神話に語られる最高峰の金属' },
        { key: 'astral',     label: '星辰 (竜骨・星屑)',   tier: 5, baseAtk: 140, baseDef: 95, costGold: 80000, color: '#ff3388', reqItems: [{ id: 'enhance_stone_2', count: 10 }], desc: '宇宙の星屑と古竜の骨から成る奇跡の結晶' }
    ],

    // 属性コア（複数選択可能、無属性は単独のみ）
    elements: [
        { key: 'none',    label: '無属性', icon: '⚪', color: '#ffffff', reqOrb: null,           exclusive: true, desc: '属性のない純粋な力' },
        { key: 'fire',    label: '火炎',   icon: '🔥', color: '#ff4400', reqOrb: 'fire_orb',    exclusive: false, desc: '炎の追加ダメージ' },
        { key: 'ice',     label: '氷結',   icon: '❄️', color: '#00ccff', reqOrb: 'ice_orb',     exclusive: false, desc: '氷の凍てつく力' },
        { key: 'thunder', label: '雷光',   icon: '⚡', color: '#ffcc00', reqOrb: 'thunder_orb', exclusive: false, desc: '雷の電撃と高会心' },
        { key: 'light',   label: '聖光',   icon: '🌟', color: '#ffffaa', reqOrb: 'light_orb',   exclusive: false, desc: '聖なる光の加護' },
        { key: 'dark',    label: '暗黒',   icon: '🌑', color: '#aa44ff', reqOrb: 'dark_orb',    exclusive: false, desc: '闇の力と吸収' },
        { key: 'wind',    label: '風嵐',   icon: '🌀', color: '#aaffee', reqOrb: 'wind_orb',    exclusive: false, desc: '嵐の速度と連続攻撃' },
        { key: 'earth',   label: '大地',   icon: '🪨', color: '#cc8844', reqOrb: 'earth_orb',   exclusive: false, desc: '大地の守護と重撃' },
        { key: 'holy',    label: '神聖',   icon: '✨', color: '#ffffff', reqOrb: 'holy_orb',    exclusive: false, desc: '神の加護・アンデッド特攻' },
        { key: 'chaos',   label: '混沌',   icon: '☠️', color: '#ff33ff', reqOrb: 'chaos_orb',   exclusive: false, desc: '全属性をランダムに発動' },
    ],

    // 状態異常（確率調整可能: 最大20%）
    statusEffects: [
        { key: 'poison',   label: '毒',     icon: '☠️', color: '#44ff44', defaultChance: 10, costPerPct: 200, desc: '毎秒HPを削るスリップダメージ' },
        { key: 'paralyze', label: '麻痺',   icon: '⚡', color: '#ffff00', defaultChance: 10, costPerPct: 350, desc: '敵の動きと攻撃を封じる' },
        { key: 'burn',     label: '燃焼',   icon: '🔥', color: '#ff6600', defaultChance: 10, costPerPct: 200, desc: '継続炎上大ダメージ' },
        { key: 'freeze',   label: '凍結',   icon: '❄️', color: '#00ffff', defaultChance: 8,  costPerPct: 450, desc: '敵を完全に氷結・行動不能' },
        { key: 'stun',     label: 'スタン', icon: '💥', color: '#ffaa00', defaultChance: 8,  costPerPct: 500, desc: '強烈な衝撃で行動を即時中断' },
        { key: 'petrify',  label: '石化',   icon: '🪨', color: '#888855', defaultChance: 5,  costPerPct: 600, desc: '敵を完全に石化硬直させる' },
        { key: 'curse',    label: '呪い',   icon: '💀', color: '#aa00ff', defaultChance: 8,  costPerPct: 400, desc: '敵の受ける全ダメージを1.3倍に増加' },
        { key: 'bleed',    label: '出血',   icon: '🩸', color: '#ff0033', defaultChance: 12, costPerPct: 220, desc: '移動・行動時に激しいスリップダメージ' },
        { key: 'confuse',  label: '混乱',   icon: '💫', color: '#ff88ff', defaultChance: 10, costPerPct: 300, desc: '敵の向き・行動がランダム化' },
        { key: 'blind',    label: '失明',   icon: '👁️', color: '#888888', defaultChance: 15, costPerPct: 180, desc: '敵の命中率・索敵を大幅低下' },
        { key: 'silence',  label: '沈黙',   icon: '🔇', color: '#8888aa', defaultChance: 10, costPerPct: 250, desc: '敵の特殊攻撃・スキルを封じる' },
    ],

    traits: [
        { key: 'none',     label: 'なし',       costMult: 1.0,  stats: {}, desc: '標準的な仕上がり' },
        { key: 'might',    label: '剛力の印',   costMult: 1.25, stats: { attackBonus: 15 }, desc: '攻撃力 +15' },
        { key: 'guardian', label: '鉄壁の印',   costMult: 1.25, stats: { defenseBonus: 12, maxHpBonus: 100 }, desc: '防御力 +12, 最大HP +100' },
        { key: 'fatal',    label: '必殺の印',   costMult: 1.30, stats: { critBonus: 0.12 }, desc: '会心率 +12%' },
        { key: 'vampiric', label: '吸血の刻印', costMult: 1.35, stats: { lifestealBonus: 0.06 }, desc: 'ライフスティール +6%' },
        { key: 'gale',     label: '疾風の印',   costMult: 1.30, stats: { speedBonus: 20 }, desc: '移動速度 +20' },
        { key: 'supreme',  label: '覇道の刻印', costMult: 1.60, stats: { attackBonus: 25, defenseBonus: 20, maxHpBonus: 150, critBonus: 0.08 }, desc: '全性能が飛躍的に向上' },
        { key: 'berserker',label: '狂戦士の刻印',costMult: 1.50, stats: { attackBonus: 40, defenseBonus: -15 }, desc: '攻撃力 +40 / 防御力 -15' },
        { key: 'sage',     label: '賢者の刻印', costMult: 1.45, stats: { maxMpBonus: 200, critBonus: 0.05 }, desc: '最大MP +200 / 会心率 +5%' },
    ],

    // ステータス自由振り分け設定（1ポイントあたりのコスト）
    statAllocation: [
        { key: 'attack',    label: '攻撃力 (ATK)',   color: '#ff7777', costPerPoint: 100,  max: 500 },
        { key: 'defense',   label: '防御力 (DEF)',   color: '#77aaff', costPerPoint: 100,  max: 500 },
        { key: 'maxHp',     label: '最大HP',         color: '#77ff77', costPerPoint: 20,   max: 5000 },
        { key: 'maxMp',     label: '最大MP',         color: '#dd77ff', costPerPoint: 30,   max: 2000 },
        { key: 'speed',     label: '移動速度',       color: '#ffff77', costPerPoint: 200,  max: 100 },
        { key: 'critChance',label: '会心率 (%)',     color: '#ffaa44', costPerPoint: 2000, max: 50,  isPercent: true },
    ],
};

// Lv100 + 生産職の必要条件確認
export function checkCraftRequirements(player) {
    const job = player?.stats?.job;
    const isArtisan = job === 'artisan' || job === 'master_smith' || job === 'alchemist' || job === 'runemaster';
    const level = player?.stats?.level || 0;
    const isLevel100 = level >= 100;
    return { isArtisan, isLevel100, canCraft: isArtisan && isLevel100 };
}

export default class CraftingUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🔨 工房・オリジナル装備生成 (Lv100 / 生産職専用)',
            width: 820,
            height: 640,
            depth: 125000,
            themeColor: 0xffaa00,
            titleStroke: 0x884400,
        });

        // 選択中のクラフトオプション
        this.selectedCategory = 'weapon';
        this.selectedBaseTypeIndex = 0;
        this.selectedGradeIndex = 0;
        // 複合属性: 配列で管理（'none' が含まれる場合は排他）
        this.selectedElements = ['none'];
        // 状態異常付与率 (key → 0〜20%)
        this.statusRates = {
            poison: 0, paralyze: 0, burn: 0, freeze: 0,
            stun: 0, petrify: 0, curse: 0, bleed: 0,
            confuse: 0, blind: 0, silence: 0
        };
        this.selectedTraitIndex = 0;
        this.customName = '';
        // ステータス自由振り分け (key → 数値)
        this.statPoints = {
            attack: 0, defense: 0, maxHp: 0, maxMp: 0, speed: 0, critChance: 0
        };
        // UIタブ管理: 'config' | 'status' | 'stats'
        this._activeTab = 'config';
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        this.bodyContainer = this.scene.add.container(0, 0);
        this.container.add(this.bodyContainer);
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this.refresh();
    }

    isArtisanClass() {
        const job = this.scene.player?.stats?.job;
        return job === 'artisan' || job === 'master_smith' || job === 'alchemist' || job === 'runemaster';
    }

    isLevel100() {
        return (this.scene.player?.stats?.level || 0) >= 100;
    }

    // 状態異常ON/OFF切り替え（デフォルト確率を設定または0に）
    toggleStatusEffect(key) {
        const seDef = CRAFT_CONFIG.statusEffects.find(s => s.key === key);
        if (!seDef) return;
        if ((this.statusRates[key] || 0) > 0) {
            this.statusRates[key] = 0;
        } else {
            this.statusRates[key] = Math.min(20, seDef.defaultChance || 10);
        }
    }

    // 状態異常確率設定（0〜20%）
    setStatusEffectRate(key, rate) {
        const parsed = Math.max(0, Math.min(20, Math.round(rate)));
        this.statusRates[key] = parsed;
    }

    // 属性選択トグル（'none'は排他・他属性複数選択可）
    toggleElement(key) {
        const elDef = CRAFT_CONFIG.elements.find(e => e.key === key);
        if (!elDef) return;
        if (key === 'none') {
            this.selectedElements = ['none'];
            return;
        }
        // noneを外す
        this.selectedElements = this.selectedElements.filter(k => k !== 'none');
        const idx = this.selectedElements.indexOf(key);
        if (idx >= 0) {
            this.selectedElements.splice(idx, 1);
            if (this.selectedElements.length === 0) this.selectedElements = ['none'];
        } else {
            this.selectedElements.push(key);
        }
    }

    // 状態異常コスト合計計算
    calcStatusEffectsCost() {
        let total = 0;
        CRAFT_CONFIG.statusEffects.forEach(se => {
            const pct = Math.min(20, this.statusRates[se.key] || 0);
            if (pct > 0) total += pct * se.costPerPct;
        });
        return total;
    }

    // ステータス振り分けコスト計算
    calcStatAllocationCost() {
        let total = 0;
        CRAFT_CONFIG.statAllocation.forEach(sa => {
            const val = this.statPoints[sa.key] || 0;
            if (val > 0) total += val * sa.costPerPoint;
        });
        return total;
    }

    calculateCraftResult() {
        const cat = this.selectedCategory;
        const baseTypes = CRAFT_CONFIG.baseTypes[cat] || [];
        const base = baseTypes[this.selectedBaseTypeIndex] || baseTypes[0];
        const grade = CRAFT_CONFIG.grades[this.selectedGradeIndex];
        const elements = this.selectedElements.map(k => CRAFT_CONFIG.elements.find(e => e.key === k)).filter(Boolean);
        const trait = CRAFT_CONFIG.traits[this.selectedTraitIndex];

        // 状態異常一覧（確率 > 0 のもの）
        const activeStatusEffects = CRAFT_CONFIG.statusEffects
            .filter(se => (this.statusRates[se.key] || 0) > 0)
            .map(se => {
                const pct = Math.min(20, this.statusRates[se.key]);
                return {
                    key: se.key,
                    label: se.label,
                    icon: se.icon,
                    chance: pct / 100,
                    percent: pct,
                    cost: pct * se.costPerPct
                };
            });

        const isArtisan = this.isArtisanClass();
        const artisanMult = isArtisan ? 1.15 : 1.0;
        const costDiscount = isArtisan ? 0.70 : 1.0;
        const materialDiscount = isArtisan ? 0.75 : 1.0;

        let finalAtk = 0;
        let finalDef = 0;

        if (cat === 'weapon') {
            finalAtk = Math.round(grade.baseAtk * base.atkMult * artisanMult) + (trait.stats.attackBonus || 0);
            finalDef = Math.round(base.defMult * grade.baseDef * artisanMult) + (trait.stats.defenseBonus || 0);
        } else if (cat === 'armor') {
            finalDef = Math.round(grade.baseDef * base.defMult * artisanMult) + (trait.stats.defenseBonus || 0);
            finalAtk = Math.round(base.atkMult * grade.baseAtk * artisanMult) + (trait.stats.attackBonus || 0);
        } else {
            finalAtk = Math.round(grade.baseAtk * base.atkMult * artisanMult) + (trait.stats.attackBonus || 0);
            finalDef = Math.round(grade.baseDef * base.defMult * artisanMult) + (trait.stats.defenseBonus || 0);
        }

        // ステータス振り分けを加算
        finalAtk  += (this.statPoints.attack  || 0);
        finalDef  += (this.statPoints.defense  || 0);
        const finalHp    = (base.hpBonus  || 0) + (trait.stats.maxHpBonus   || 0) + (this.statPoints.maxHp   || 0);
        const finalMp    = (base.mpBonus  || 0) + (trait.stats.maxMpBonus   || 0) + (this.statPoints.maxMp   || 0);
        const finalSpeed = (base.speedBonus || 0) + (trait.stats.speedBonus  || 0) + (this.statPoints.speed   || 0);
        const finalCrit  = (base.critBonus || 0) + (trait.stats.critBonus    || 0) + ((this.statPoints.critChance || 0) / 100);
        const finalLifesteal = trait.stats.lifestealBonus || 0;

        // 費用計算（素材品質 × 刻印倍率 + 属性オーブ追加 + 状態異常追加 + ステータス振り分けコスト）
        let totalGold = Math.round(grade.costGold * trait.costMult * costDiscount);

        // 複合属性追加コスト（2つ目以降は50%割増）
        const nonNoneElements = elements.filter(e => e.key !== 'none');
        nonNoneElements.forEach((el, i) => {
            const addCost = i === 0 ? 1000 : 2000;
            totalGold += addCost;
        });

        // 状態異常追加コスト
        totalGold += this.calcStatusEffectsCost();

        // ステータス振り分けコスト
        totalGold += this.calcStatAllocationCost();

        // 必要素材
        const requiredItems = [];
        (grade.reqItems || []).forEach(req => {
            const count = Math.max(1, Math.round(req.count * materialDiscount));
            requiredItems.push({ id: req.id, count });
        });
        // 属性オーブ（選択された属性の数だけ）
        nonNoneElements.forEach(el => {
            if (el.reqOrb) requiredItems.push({ id: el.reqOrb, count: 1 });
        });

        // 属性ラベル（複合）
        const elementLabel = nonNoneElements.length > 0
            ? nonNoneElements.map(e => `${e.icon}${e.label}`).join('・')
            : '無属性';
        const elementKeys = nonNoneElements.map(e => e.key);

        // 状態異常ラベル
        const statusLabel = activeStatusEffects.length > 0
            ? activeStatusEffects.map(s => `${s.icon}${s.label}(${s.percent}%)`).join(' ')
            : 'なし';

        // デフォルト名
        const elemPart = nonNoneElements.length > 0 ? nonNoneElements.map(e => e.label).join('・') + 'の' : '';
        const defaultName = `${grade.label.split(' ')[0]}の${elemPart}${base.label}`;

        return {
            name: this.customName.trim() || defaultName,
            category: cat,
            weaponClass: cat === 'weapon' ? base.key : (cat === 'armor' ? 'armor' : 'relic'),
            elements: elementKeys,
            elementLabel,
            statusEffects: activeStatusEffects.map(s => ({ key: s.key, chance: s.chance })),
            statusLabel,
            tier: grade.tier,
            color: nonNoneElements.length > 0 ? nonNoneElements[0].color : grade.color,
            icon: base.icon,
            gold: totalGold,
            requiredItems,
            stats: {
                attack: finalAtk,
                defense: finalDef,
                maxHp: finalHp,
                maxMp: finalMp,
                speed: finalSpeed,
                critChance: finalCrit,
                lifesteal: finalLifesteal
            },
            traitDesc: trait.desc,
            baseDesc: base.desc,
            gradeLabel: grade.label
        };
    }

    refresh() {
        if (!this.bodyContainer?.active) return;
        this.bodyContainer.removeAll(true);

        const w = this.config.width;
        const h = this.config.height;
        const player = this.scene.player;
        if (!player) return;

        const isArtisan = this.isArtisanClass();
        const isLv100   = this.isLevel100();
        const canCraftClass = isArtisan && isLv100;

        // ===== 要件バナー =====
        {
            const bannerBg = this.scene.add.graphics();
            const bannerColor = canCraftClass ? 0xff8800 : 0xaa2222;
            const bannerBorderColor = canCraftClass ? 0xffaa00 : 0xff4444;
            bannerBg.fillStyle(bannerColor, 0.25);
            bannerBg.fillRoundedRect(-w / 2 + 25, -h / 2 + 45, w - 50, 24, 6);
            bannerBg.lineStyle(1.5, bannerBorderColor, 0.8);
            bannerBg.strokeRoundedRect(-w / 2 + 25, -h / 2 + 45, w - 50, 24, 6);
            this.bodyContainer.add(bannerBg);

            let bannerMsg = '';
            const playerLv = player.stats?.level || 0;
            if (canCraftClass) {
                bannerMsg = `🌟 職人ボーナス適用中！ (費用30%OFF / 素材25%OFF / 性能+15%) | 現在Lv: ${playerLv}`;
            } else {
                const reasons = [];
                if (!isArtisan) reasons.push('生産職（職人系）への転職が必要');
                if (!isLv100) reasons.push(`Lv100以上が必要 (現在Lv${playerLv})`);
                bannerMsg = `🔒 制作条件未達成: ${reasons.join(' / ')}`;
            }
            this.bodyContainer.add(this.scene.add.text(0, -h / 2 + 57, bannerMsg, {
                fontSize: '11px', fontFamily: UI_FONT,
                color: canCraftClass ? '#ffd700' : '#ff7777', style: 'bold'
            }).setOrigin(0.5));
        }

        // ===== メインタブ切り替え (3タブ) =====
        const tabY = -h / 2 + 78;
        const tabs = [
            { key: 'config', label: '🔧 装備設定',            width: 135 },
            { key: 'status', label: '☣️ 状態異常 (Max20%)',  width: 155 },
            { key: 'stats',  label: '📊 ステータス振り分け', width: 155 },
        ];
        let tabStartX = -w / 2 + 30;
        tabs.forEach((tab) => {
            const isSel = this._activeTab === tab.key;
            const tWidth = tab.width;
            const tx = tabStartX + tWidth / 2;
            const tbg = this.scene.add.rectangle(tx, tabY, tWidth, 24, isSel ? 0xffaa00 : 0x1f2e42)
                .setStrokeStyle(1.5, isSel ? 0xffffff : 0x4a90e2)
                .setInteractive({ useHandCursor: true });
            const ttxt = this.scene.add.text(tx, tabY, tab.label, {
                fontSize: '11px', fontFamily: UI_FONT, color: isSel ? '#000000' : '#aaaaaa', style: 'bold'
            }).setOrigin(0.5);
            tbg.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this._activeTab = tab.key;
                this.refresh();
            });
            this.bodyContainer.add([tbg, ttxt]);
            tabStartX += tWidth + 8;
        });

        // ===== プレビュー (右カラム・常時表示) =====
        this._buildPreview(canCraftClass, isArtisan);

        // ===== メインコンテンツ =====
        if (this._activeTab === 'config') {
            this._buildConfigTab();
        } else if (this._activeTab === 'status') {
            this._buildStatusTab();
        } else {
            this._buildStatsTab();
        }
    }

    _buildConfigTab() {
        const w = this.config.width;
        const h = this.config.height;
        const leftX = -w / 2 + 30;
        let curY = -h / 2 + 100;

        // 1. カテゴリ
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '① カテゴリ:', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', style: 'bold'
        }));
        curY += 15;
        const catCont = this.scene.add.container(leftX, curY);
        CRAFT_CONFIG.categories.forEach((cat, idx) => {
            const isSel = this.selectedCategory === cat.key;
            const btn = this.scene.add.rectangle(idx * 110 + 50, 12, 102, 24, isSel ? 0xffaa00 : 0x1f2e42)
                .setStrokeStyle(1.5, isSel ? 0xffffff : 0x4a90e2)
                .setInteractive({ useHandCursor: true });
            const txt = this.scene.add.text(idx * 110 + 50, 12, cat.label, {
                fontSize: '11px', fontFamily: UI_FONT, color: isSel ? '#000000' : '#ffffff', style: 'bold'
            }).setOrigin(0.5);
            btn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.selectedCategory = cat.key;
                this.selectedBaseTypeIndex = 0;
                this.refresh();
            });
            catCont.add([btn, txt]);
        });
        this.bodyContainer.add(catCont);
        curY += 32;

        // 2. ベースタイプ
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '② 形状・種別:', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', style: 'bold'
        }));
        curY += 15;
        const baseTypes = CRAFT_CONFIG.baseTypes[this.selectedCategory] || [];
        const baseCont = this.scene.add.container(leftX, curY);
        baseTypes.forEach((b, idx) => {
            const isSel = this.selectedBaseTypeIndex === idx;
            const bx = (idx % 4) * 100 + 45;
            const by = Math.floor(idx / 4) * 26 + 11;
            const btn = this.scene.add.rectangle(bx, by, 94, 22, isSel ? 0x2288ee : 0x162233)
                .setStrokeStyle(1, isSel ? 0x88ffff : 0x335577)
                .setInteractive({ useHandCursor: true });
            const txt = this.scene.add.text(bx, by, `${b.icon} ${b.label}`, {
                fontSize: '10px', fontFamily: UI_FONT, color: isSel ? '#ffffff' : '#aaaaaa'
            }).setOrigin(0.5);
            btn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.selectedBaseTypeIndex = idx;
                this.refresh();
            });
            baseCont.add([btn, txt]);
        });
        this.bodyContainer.add(baseCont);
        curY += (Math.ceil(baseTypes.length / 4) * 26) + 4;

        // 3. 素材品質
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '③ 素材品質:', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', style: 'bold'
        }));
        curY += 15;
        const gradeCont = this.scene.add.container(leftX, curY);
        CRAFT_CONFIG.grades.forEach((g, idx) => {
            const isSel = this.selectedGradeIndex === idx;
            const gy = idx * 24 + 10;
            const btn = this.scene.add.rectangle(165, gy, 330, 20, isSel ? 0x443322 : 0x121a28)
                .setStrokeStyle(1, isSel ? 0xffaa00 : 0x2a3e55)
                .setInteractive({ useHandCursor: true });
            const txt = this.scene.add.text(8, gy, g.label, {
                fontSize: '10px', fontFamily: UI_FONT, color: g.color, style: isSel ? 'bold' : 'normal'
            }).setOrigin(0, 0.5);
            const costTxt = this.scene.add.text(322, gy, `${g.costGold.toLocaleString()}G`, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#ffd700'
            }).setOrigin(1, 0.5);
            btn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.selectedGradeIndex = idx;
                this.refresh();
            });
            gradeCont.add([btn, txt, costTxt]);
        });
        this.bodyContainer.add(gradeCont);
        curY += CRAFT_CONFIG.grades.length * 24 + 4;

        // 4. 複合属性コア（複数選択可）
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '④ 属性コア（複数選択可・無属性は排他）:', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', style: 'bold'
        }));
        curY += 15;
        const elemCont = this.scene.add.container(leftX, curY);
        CRAFT_CONFIG.elements.forEach((el, idx) => {
            const isSel = this.selectedElements.includes(el.key);
            const ex = (idx % 5) * 82 + 38;
            const ey = Math.floor(idx / 5) * 24 + 10;
            const btn = this.scene.add.rectangle(ex, ey, 76, 20, isSel ? 0x332255 : 0x141a24)
                .setStrokeStyle(1.5, isSel ? 0xcc88ff : 0x2c3b4d)
                .setInteractive({ useHandCursor: true });
            const txt = this.scene.add.text(ex, ey, `${el.icon}${el.label}`, {
                fontSize: '10px', fontFamily: UI_FONT, color: isSel ? '#ffffff' : el.color
            }).setOrigin(0.5);
            btn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.toggleElement(el.key);
                this.refresh();
            });
            elemCont.add([btn, txt]);
        });
        this.bodyContainer.add(elemCont);
        curY += (Math.ceil(CRAFT_CONFIG.elements.length / 5) * 24) + 4;

        // 5. 状態異常クイックトグル ＋ 確率調整タブ誘導
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '⑤ 状態異常付与 (クイック切替 / 確率調整: Max20%):', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', style: 'bold'
        }));
        // 詳細調整タブへのリンク
        const detailTabBtn = this.scene.add.text(leftX + 415, curY, '👉 確率調整タブを開く [Max20%]', {
            fontSize: '10px', fontFamily: UI_FONT, color: '#ffd700', style: 'bold'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        detailTabBtn.on('pointerdown', (p, lx, ly, e) => {
            if (e) e.stopPropagation();
            this._activeTab = 'status';
            this.refresh();
        });
        this.bodyContainer.add(detailTabBtn);

        curY += 15;
        const seCont = this.scene.add.container(leftX, curY);
        CRAFT_CONFIG.statusEffects.forEach((se, idx) => {
            const currentPct = this.statusRates[se.key] || 0;
            const isSel = currentPct > 0;
            const sx = (idx % 6) * 69 + 32;
            const sy = Math.floor(idx / 6) * 24 + 10;
            const btn = this.scene.add.rectangle(sx, sy, 65, 20, isSel ? 0x224433 : 0x141a24)
                .setStrokeStyle(1.5, isSel ? 0x55ffaa : 0x2c3b4d)
                .setInteractive({ useHandCursor: true });
            const lbl = isSel ? `${se.icon}${currentPct}%` : `${se.icon}${se.label}`;
            const txt = this.scene.add.text(sx, sy, lbl, {
                fontSize: '10px', fontFamily: UI_FONT, color: isSel ? '#ffffff' : se.color
            }).setOrigin(0.5);
            btn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.toggleStatusEffect(se.key);
                this.refresh();
            });
            seCont.add([btn, txt]);
        });
        this.bodyContainer.add(seCont);
        curY += (Math.ceil(CRAFT_CONFIG.statusEffects.length / 6) * 24) + 4;

        // 6. 特殊刻印
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '⑥ 特殊刻印:', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', style: 'bold'
        }));
        curY += 15;
        const traitCont = this.scene.add.container(leftX, curY);
        CRAFT_CONFIG.traits.forEach((tr, idx) => {
            const isSel = this.selectedTraitIndex === idx;
            const tx2 = (idx % 5) * 82 + 38;
            const ty2 = Math.floor(idx / 5) * 24 + 10;
            const btn = this.scene.add.rectangle(tx2, ty2, 76, 20, isSel ? 0x224433 : 0x141a24)
                .setStrokeStyle(1, isSel ? 0x55ffaa : 0x2c3b4d)
                .setInteractive({ useHandCursor: true });
            const txt = this.scene.add.text(tx2, ty2, tr.label, {
                fontSize: '10px', fontFamily: UI_FONT, color: isSel ? '#ffffff' : '#aaaaaa'
            }).setOrigin(0.5);
            btn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.selectedTraitIndex = idx;
                this.refresh();
            });
            traitCont.add([btn, txt]);
        });
        this.bodyContainer.add(traitCont);
    }

    // ===== 状態異常付与・確率操作タブ (最大20%) =====
    _buildStatusTab() {
        const w = this.config.width;
        const h = this.config.height;
        const leftX = -w / 2 + 30;
        let curY = -h / 2 + 105;

        this.bodyContainer.add(this.scene.add.text(leftX, curY, '☣️ 状態異常付与・発動率操作 (最大 20% まで自由に設定可能)', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffd700', style: 'bold'
        }));
        curY += 18;
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '攻撃ヒット時に発動する確率です。[−][+]で微調整、[✏️]で直接入力 (0〜20%) できます。', {
            fontSize: '10px', fontFamily: UI_FONT, color: '#888888'
        }));
        curY += 20;

        // 状態異常費用合計
        const totalStatusCost = this.calcStatusEffectsCost();
        this.bodyContainer.add(this.scene.add.text(leftX, curY, `💰 状態異常付与コスト合計: ${totalStatusCost.toLocaleString()} G`, {
            fontSize: '11px', fontFamily: UI_FONT, color: '#ffd700', style: 'bold'
        }));
        curY += 24;

        // 11種類の状態異常を一覧表示
        CRAFT_CONFIG.statusEffects.forEach(se => {
            const currentPct = Math.min(20, this.statusRates[se.key] || 0);
            const cost = currentPct * se.costPerPct;
            const isEnabled = currentPct > 0;

            // ON/OFF トグルボタン
            const onOffBtn = this.scene.add.rectangle(leftX + 24, curY + 7, 44, 20, isEnabled ? 0x225533 : 0x222222)
                .setStrokeStyle(1, isEnabled ? 0x55ffaa : 0x555555).setInteractive({ useHandCursor: true });
            const onOffTxt = this.scene.add.text(leftX + 24, curY + 7, isEnabled ? 'ON' : 'OFF', {
                fontSize: '10px', fontFamily: UI_FONT, color: isEnabled ? '#55ffaa' : '#888888', style: 'bold'
            }).setOrigin(0.5);
            onOffBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.toggleStatusEffect(se.key);
                this.refresh();
            });

            // ラベル + アイコン
            this.bodyContainer.add(this.scene.add.text(leftX + 54, curY + 7, `${se.icon} ${se.label}`, {
                fontSize: '11px', fontFamily: UI_FONT, color: isEnabled ? se.color : '#888888', style: 'bold'
            }).setOrigin(0, 0.5));

            // 説明文
            this.bodyContainer.add(this.scene.add.text(leftX + 130, curY + 7, se.desc, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#666666'
            }).setOrigin(0, 0.5));

            // [−] ボタン
            const minusBtn = this.scene.add.rectangle(leftX + 300, curY + 7, 20, 18, 0x332222)
                .setStrokeStyle(1, 0xff5555).setInteractive({ useHandCursor: true });
            const minusTxt = this.scene.add.text(leftX + 300, curY + 7, '−', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#ff5555'
            }).setOrigin(0.5);
            minusBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.setStatusEffectRate(se.key, currentPct - 1);
                this.refresh();
            });

            // 現在確率表示 (Max 20%)
            const pctTxt = this.scene.add.text(leftX + 332, curY + 7, `${currentPct}%`, {
                fontSize: '11px', fontFamily: UI_FONT, color: isEnabled ? '#ffffff' : '#555555', style: 'bold'
            }).setOrigin(0.5);

            // [+] ボタン
            const plusBtn = this.scene.add.rectangle(leftX + 365, curY + 7, 20, 18, 0x223322)
                .setStrokeStyle(1, 0x55ff55).setInteractive({ useHandCursor: true });
            const plusTxt = this.scene.add.text(leftX + 365, curY + 7, '+', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#55ff55'
            }).setOrigin(0.5);
            plusBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.setStatusEffectRate(se.key, currentPct + 1);
                this.refresh();
            });

            // [✏️] 直接入力ボタン
            const editBtn = this.scene.add.text(leftX + 386, curY + 7, '✏️', {
                fontSize: '12px', fontFamily: UI_FONT
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
            editBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                const input = prompt(`${se.label}の発動確率を入力してください (0〜20%)\n1%あたり ${se.costPerPct.toLocaleString()}G`, String(currentPct));
                if (input !== null) {
                    const parsed = parseInt(input, 10);
                    if (!isNaN(parsed)) {
                        this.setStatusEffectRate(se.key, parsed);
                        this.refresh();
                    }
                }
            });

            // コスト表示
            const costTxt = this.scene.add.text(leftX + 412, curY + 7, cost > 0 ? `= ${cost.toLocaleString()}G` : '', {
                fontSize: '10px', fontFamily: UI_FONT, color: '#ffd700'
            }).setOrigin(0, 0.5);

            this.bodyContainer.add([onOffBtn, onOffTxt, minusBtn, minusTxt, pctTxt, plusBtn, plusTxt, editBtn, costTxt]);
            curY += 28;
        });

        // 全リセットボタン
        curY += 6;
        const resetAllBtn = this.scene.add.rectangle(leftX + 180, curY + 12, 180, 24, 0x332222)
            .setStrokeStyle(1.5, 0xff5555).setInteractive({ useHandCursor: true });
        const resetAllTxt = this.scene.add.text(leftX + 180, curY + 12, '↺ 全状態異常をリセット', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#ff5555'
        }).setOrigin(0.5);
        resetAllBtn.on('pointerdown', (p, lx, ly, e) => {
            if (e) e.stopPropagation();
            Object.keys(this.statusRates).forEach(k => { this.statusRates[k] = 0; });
            this.refresh();
        });
        this.bodyContainer.add([resetAllBtn, resetAllTxt]);
    }

    _buildStatsTab() {
        const w = this.config.width;
        const h = this.config.height;
        const leftX = -w / 2 + 30;
        let curY = -h / 2 + 108;

        this.bodyContainer.add(this.scene.add.text(leftX, curY, '📊 ステータス自由振り分け (ゴールドを消費して数値を直接入力)', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffd700', style: 'bold'
        }));
        curY += 20;
        this.bodyContainer.add(this.scene.add.text(leftX, curY, '入力した数値がそのまま装備ステータスに加算されます。値が大きいほど費用が増加します。', {
            fontSize: '10px', fontFamily: UI_FONT, color: '#888888'
        }));
        curY += 22;

        // 合計コスト表示
        const totalStatCost = this.calcStatAllocationCost();
        const player = this.scene.player;
        const hasGoldForStats = (player?.stats?.gold || 0) >= totalStatCost;
        this.bodyContainer.add(this.scene.add.text(leftX, curY, `💰 ステータス振り分けコスト合計: ${totalStatCost.toLocaleString()} G`, {
            fontSize: '12px', fontFamily: UI_FONT, color: hasGoldForStats ? '#ffd700' : '#ff4444', style: 'bold'
        }));
        curY += 26;

        CRAFT_CONFIG.statAllocation.forEach(sa => {
            const val = this.statPoints[sa.key] || 0;
            const cost = val * sa.costPerPoint;
            const unitLabel = sa.isPercent ? '%' : '';

            // ラベル
            this.bodyContainer.add(this.scene.add.text(leftX, curY, sa.label, {
                fontSize: '11px', fontFamily: UI_FONT, color: sa.color, style: 'bold'
            }));

            // コスト/ポイント表示
            this.bodyContainer.add(this.scene.add.text(leftX + 155, curY, `(${sa.costPerPoint.toLocaleString()}G / 1${unitLabel}  最大: ${sa.max}${unitLabel})`, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#666666'
            }));

            // [-] ボタン
            const minusBtn = this.scene.add.rectangle(leftX + 310, curY + 7, 22, 20, 0x332222)
                .setStrokeStyle(1, 0xff5555).setInteractive({ useHandCursor: true });
            const minusTxt = this.scene.add.text(leftX + 310, curY + 7, '−', {
                fontSize: '14px', fontFamily: UI_FONT, color: '#ff5555'
            }).setOrigin(0.5);
            minusBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                const step = sa.isPercent ? 1 : (sa.key === 'maxHp' ? 50 : sa.key === 'maxMp' ? 20 : 1);
                this.statPoints[sa.key] = Math.max(0, (this.statPoints[sa.key] || 0) - step);
                this.refresh();
            });

            // 現在値表示
            const valTxt = this.scene.add.text(leftX + 355, curY + 7, `${val}${unitLabel}`, {
                fontSize: '13px', fontFamily: UI_FONT, color: val > 0 ? '#ffffff' : '#555555', style: 'bold'
            }).setOrigin(0.5);

            // [+] ボタン
            const plusBtn = this.scene.add.rectangle(leftX + 400, curY + 7, 22, 20, 0x223322)
                .setStrokeStyle(1, 0x55ff55).setInteractive({ useHandCursor: true });
            const plusTxt = this.scene.add.text(leftX + 400, curY + 7, '+', {
                fontSize: '14px', fontFamily: UI_FONT, color: '#55ff55'
            }).setOrigin(0.5);
            plusBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                const step = sa.isPercent ? 1 : (sa.key === 'maxHp' ? 50 : sa.key === 'maxMp' ? 20 : 1);
                this.statPoints[sa.key] = Math.min(sa.max, (this.statPoints[sa.key] || 0) + step);
                this.refresh();
            });

            // [直接入力] ボタン
            const inputBtn = this.scene.add.text(leftX + 430, curY + 7, '✏️', {
                fontSize: '14px', fontFamily: UI_FONT
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
            inputBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                const step = sa.isPercent ? 1 : (sa.key === 'maxHp' ? 50 : sa.key === 'maxMp' ? 20 : 1);
                const input = prompt(`${sa.label}に振り分ける量を入力 (0〜${sa.max}${unitLabel}、${step}刻み)\n1${unitLabel}あたり${sa.costPerPoint.toLocaleString()}G`, String(val));
                if (input !== null) {
                    const parsed = parseInt(input, 10);
                    if (!isNaN(parsed)) {
                        const snapped = Math.round(parsed / step) * step;
                        this.statPoints[sa.key] = Math.max(0, Math.min(sa.max, snapped));
                        this.refresh();
                    }
                }
            });

            // コスト
            const costTxt2 = this.scene.add.text(leftX + 460, curY + 7, cost > 0 ? `= ${cost.toLocaleString()}G` : '', {
                fontSize: '10px', fontFamily: UI_FONT, color: '#ffd700'
            }).setOrigin(0, 0.5);

            // [リセット]
            const resetBtn = this.scene.add.text(-w / 2 + 390, curY + 7, '↺', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            resetBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.statPoints[sa.key] = 0;
                this.refresh();
            });

            this.bodyContainer.add([minusBtn, minusTxt, valTxt, plusBtn, plusTxt, inputBtn, costTxt2, resetBtn]);
            curY += 42;
        });

        // 全リセットボタン
        curY += 8;
        const resetAllBtn = this.scene.add.rectangle(leftX + 200, curY + 15, 200, 28, 0x332222)
            .setStrokeStyle(1.5, 0xff5555).setInteractive({ useHandCursor: true });
        const resetAllTxt = this.scene.add.text(leftX + 200, curY + 15, '↺ 全ステータス振り分けをリセット', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#ff5555'
        }).setOrigin(0.5);
        resetAllBtn.on('pointerdown', (p, lx, ly, e) => {
            if (e) e.stopPropagation();
            Object.keys(this.statPoints).forEach(k => { this.statPoints[k] = 0; });
            this.refresh();
        });
        this.bodyContainer.add([resetAllBtn, resetAllTxt]);
    }

    _buildPreview(canCraftClass, isArtisan) {
        const w = this.config.width;
        const h = this.config.height;
        const craft = this.calculateCraftResult();
        const player = this.scene.player;

        const rightX = w / 2 - 310;
        const previewY = -h / 2 + 95;

        // プレビュー枠
        const previewBox = this.scene.add.graphics();
        previewBox.fillStyle(0x0e1726, 0.9);
        previewBox.fillRoundedRect(rightX, previewY, 295, 265, 10);
        previewBox.lineStyle(2, Phaser.Display.Color.HexStringToColor(craft.color.replace('#', '') || 'ffffff').color || 0x4a90e2, 0.8);
        previewBox.strokeRoundedRect(rightX, previewY, 295, 265, 10);
        this.bodyContainer.add(previewBox);

        // アイコン & 名前
        this.bodyContainer.add(this.scene.add.text(rightX + 22, previewY + 28, craft.icon, { fontSize: '26px' }).setOrigin(0.5));
        this.bodyContainer.add(this.scene.add.text(rightX + 46, previewY + 14, craft.name, {
            fontSize: '13px', fontFamily: UI_FONT, color: craft.color, style: 'bold', wordWrap: { width: 200 }
        }));

        // 名前変更ボタン
        const editNameBtn = this.scene.add.text(rightX + 285, previewY + 14, '✏️名変', {
            fontSize: '10px', fontFamily: UI_FONT, color: '#88ffff'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        editNameBtn.on('pointerdown', (p, lx, ly, e) => {
            if (e) e.stopPropagation();
            const input = prompt('装備の名前を入力:', craft.name);
            if (input !== null) { this.customName = input.trim(); this.refresh(); }
        });
        this.bodyContainer.add(editNameBtn);

        // 属性・状態異常
        this.bodyContainer.add(this.scene.add.text(rightX + 12, previewY + 42, `属性: ${craft.elementLabel}`, {
            fontSize: '10px', fontFamily: UI_FONT, color: '#888888'
        }));
        this.bodyContainer.add(this.scene.add.text(rightX + 12, previewY + 56, `状態異常: ${craft.statusLabel}`, {
            fontSize: '10px', fontFamily: UI_FONT, color: '#ff88cc', wordWrap: { width: 270 }
        }));

        // ステータス
        let sY = previewY + 76;
        const addStat = (label, val, suffix = '', color = '#ffffff') => {
            if (val === 0 || val === null || val === undefined) return;
            this.bodyContainer.add(this.scene.add.text(rightX + 14, sY, label, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#aaaaaa'
            }));
            this.bodyContainer.add(this.scene.add.text(rightX + 281, sY, `${val > 0 ? '+' : ''}${val}${suffix}`, {
                fontSize: '10px', fontFamily: UI_FONT, color, style: 'bold'
            }).setOrigin(1, 0));
            sY += 17;
        };

        if (craft.stats.attack)   addStat('攻撃力 (ATK)',     craft.stats.attack,   '', '#ff7777');
        if (craft.stats.defense)  addStat('防御力 (DEF)',     craft.stats.defense,  '', '#77aaff');
        if (craft.stats.maxHp)    addStat('最大HP',           craft.stats.maxHp,    '', '#77ff77');
        if (craft.stats.maxMp)    addStat('最大MP',           craft.stats.maxMp,    '', '#dd77ff');
        if (craft.stats.critChance) addStat('会心率 (CRIT)',  Math.round(craft.stats.critChance * 100), '%', '#ffaa44');
        if (craft.stats.speed)    addStat('移動速度',         craft.stats.speed,    '', '#ffff77');
        if (craft.stats.lifesteal) addStat('吸血 (Lifesteal)', Math.round(craft.stats.lifesteal * 100), '%', '#ff55aa');

        // 刻印テキスト
        sY = Math.max(sY, previewY + 190);
        this.bodyContainer.add(this.scene.add.text(rightX + 14, sY, `刻印: ${craft.traitDesc}`, {
            fontSize: '10px', fontFamily: UI_FONT, color: '#88ffcc', wordWrap: { width: 265 }
        }));

        // ===== コスト・素材パネル =====
        const costY = previewY + 275;
        const costBox = this.scene.add.graphics();
        costBox.fillStyle(0x0e1726, 0.7);
        costBox.fillRoundedRect(rightX, costY, 295, 130, 8);
        costBox.lineStyle(1, 0x4a90e2, 0.4);
        costBox.strokeRoundedRect(rightX, costY, 295, 130, 8);
        this.bodyContainer.add(costBox);

        this.bodyContainer.add(this.scene.add.text(rightX + 12, costY + 8, '【必要素材・費用】', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#ffd700', style: 'bold'
        }));

        const hasGold = (player?.stats?.gold || 0) >= craft.gold;
        this.bodyContainer.add(this.scene.add.text(rightX + 14, costY + 26, `🪙 費用: ${craft.gold.toLocaleString()} G`, {
            fontSize: '11px', fontFamily: UI_FONT, color: hasGold ? '#ffd700' : '#ff4444'
        }));
        this.bodyContainer.add(this.scene.add.text(rightX + 281, costY + 26, `(所持: ${(player?.stats?.gold || 0).toLocaleString()}G)`, {
            fontSize: '10px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(1, 0));

        let hasAllItems = true;
        let itemY = costY + 46;
        craft.requiredItems.forEach(req => {
            const itemDef = ITEMS[req.id];
            const invEntry = (player?.stats?.inventory || []).find(i => (typeof i === 'string' ? i : i.id) === req.id);
            const count = typeof invEntry === 'object' ? (invEntry.count || 1) : (invEntry ? 1 : 0);
            const ok = count >= req.count;
            if (!ok) hasAllItems = false;
            const name = itemDef?.name || req.id;
            this.bodyContainer.add(this.scene.add.text(rightX + 14, itemY, `📦 ${name}: ${req.count}個`, {
                fontSize: '10px', fontFamily: UI_FONT, color: ok ? '#ffffff' : '#ff5555'
            }));
            this.bodyContainer.add(this.scene.add.text(rightX + 281, itemY, `(${count})`, {
                fontSize: '10px', fontFamily: UI_FONT, color: ok ? '#88ff88' : '#ff5555'
            }).setOrigin(1, 0));
            itemY += 17;
        });

        // ===== 制作ボタン =====
        const canCraft = canCraftClass && hasGold && hasAllItems;
        const btnY = costY + 150;
        const craftBtn = this.scene.add.rectangle(rightX + 148, btnY, 275, 36, canCraft ? 0xffaa00 : 0x334455)
            .setStrokeStyle(2, canCraft ? 0xffffff : 0x556677)
            .setInteractive({ useHandCursor: canCraft });

        let btnLabel = '🔨 制作する (Craft Item)';
        if (!isArtisan) {
            btnLabel = '🔒 生産職（職人）への転職が必要';
        } else if (!this.isLevel100()) {
            btnLabel = `🔒 Lv100以上が必要 (現在Lv${player?.stats?.level || 0})`;
        } else if (!hasGold) {
            btnLabel = '💰 ゴールドが不足しています';
        } else if (!hasAllItems) {
            btnLabel = '📦 必要素材が不足しています';
        }

        const craftBtnTxt = this.scene.add.text(rightX + 148, btnY, btnLabel, {
            fontSize: '11px', fontFamily: UI_FONT, color: canCraft ? '#000000' : '#888888', style: 'bold'
        }).setOrigin(0.5);

        if (canCraft) {
            craftBtn.on('pointerover', () => craftBtn.setFillStyle(0xffbb22));
            craftBtn.on('pointerout',  () => craftBtn.setFillStyle(0xffaa00));
            craftBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                this.executeCraft(craft);
            });
        }
        this.bodyContainer.add([craftBtn, craftBtnTxt]);
    }

    executeCraft(craft) {
        const player = this.scene.player;
        if (!player) return;

        // Lv100 + 生産職の二重チェック
        if (!this.isArtisanClass()) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('クラフトは「職人（生産職）」のみ可能です！', 'error');
            return;
        }
        if (!this.isLevel100()) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`クラフトはLv100以上が必要です！ (現在Lv${player.stats?.level || 0})`, 'error');
            return;
        }

        // コスト消費
        player.stats.gold -= craft.gold;
        craft.requiredItems.forEach(req => {
            player.removeItem(req.id, req.count);
        });

        // カスタムアイテムID生成
        const customId = `craft_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // アイテム定義を作成
        const newItem = defineItem({
            id: customId,
            name: craft.name,
            type: craft.category,
            weaponClass: craft.weaponClass,
            elements: craft.elements.length > 0 ? craft.elements : null,
            element: craft.elements[0] || null,
            statusEffects: craft.statusEffects.length > 0 ? craft.statusEffects : null,
            level: craft.tier * 10,
            price: Math.round(craft.gold * 0.4),
            icon: craft.icon,
            stats: craft.stats,
            description: `【オリジナル製作装備】${craft.traitDesc} / 品質: ${craft.gradeLabel} / 属性: ${craft.elementLabel} / 状態異常: ${craft.statusLabel}`
        });

        // ITEMS辞書に動的登録
        ITEMS[customId] = newItem;

        // セーブデータへの永続化
        if (!player.stats.customItems) player.stats.customItems = {};
        player.stats.customItems[customId] = newItem;

        // インベントリに追加
        player.addItem(customId);

        // 振り分け・状態異常リセット
        Object.keys(this.statPoints).forEach(k => { this.statPoints[k] = 0; });
        Object.keys(this.statusRates).forEach(k => { this.statusRates[k] = 0; });

        // 鍛冶エフェクト演出
        if (this.scene.cameras?.main) {
            this.scene.cameras.main.flash(300, 255, 200, 50);
        }
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`🎉 オリジナル装備「${craft.name}」を制作しました！`, 'success', 5000);
        }

        player.saveStats();
        this.refresh();
    }
}
