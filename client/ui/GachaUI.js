import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from './BaseWindowUI.js';
import { ITEMS } from '../data/items.js';
import { entryId, removeFromInventory, totalOwned, unitSellPrice } from '../utils/inventoryOps.js';

export const PRIZES = [
    // ---- C レア（よく出る消耗品・基本武器）----
    { id: 'potion',               weight: 20, rarity: 'C' },
    { id: 'high_potion',          weight: 15, rarity: 'C' },
    { id: 'magic_stone',          weight: 10, rarity: 'C' },
    { id: 'short_sword',          weight: 8,  rarity: 'C' },
    { id: 'short_bow',            weight: 8,  rarity: 'C' },
    { id: 'apprentice_staff',     weight: 8,  rarity: 'C' },
    { id: 'twin_daggers',         weight: 7,  rarity: 'C' },
    { id: 'training_katana',      weight: 7,  rarity: 'C' },
    { id: 'iron_mace',            weight: 7,  rarity: 'C' },

    // ---- R レア（中堅武器）----
    { id: 'starlight_blade',      weight: 7,  rarity: 'R' },
    { id: 'moon_guard',           weight: 6,  rarity: 'R' },
    { id: 'chaos_blades',         weight: 5,  rarity: 'R' },
    { id: 'composite_bow',        weight: 5,  rarity: 'R' },
    { id: 'flame_staff',          weight: 5,  rarity: 'R' },
    { id: 'steel_katana',         weight: 5,  rarity: 'R' },
    { id: 'war_hammer',           weight: 5,  rarity: 'R' },
    { id: 'chaos_wand',           weight: 4,  rarity: 'R' },
    { id: 'summoners_tome',       weight: 4,  rarity: 'R' },
    { id: 'knight_sword',         weight: 4,  rarity: 'R' },

    // ---- SR レア（高性能武器）----
    { id: 'comet_talisman',       weight: 3,  rarity: 'SR' },
    { id: 'tempest_staff',        weight: 2.5, rarity: 'SR' },
    { id: 'berserker_fangs',      weight: 2.5, rarity: 'SR' },
    { id: 'sniper_bow',           weight: 2.5, rarity: 'SR' },
    { id: 'dark_staff',           weight: 2.5, rarity: 'SR' },
    { id: 'moonblade_katana',     weight: 2,  rarity: 'SR' },
    { id: 'chaos_orb',            weight: 2,  rarity: 'SR' },
    { id: 'paladin_blade',        weight: 2,  rarity: 'SR' },
    { id: 'guardian_mace',        weight: 2,  rarity: 'SR' },
    { id: 'dark_tome',            weight: 2,  rarity: 'SR' },

    // ---- SSR レア（強力な武器・制限解除）----
    { id: 'aurora_mail',          weight: 1.5, rarity: 'SSR' },
    { id: 'limit_break_license_2', weight: 1.0, rarity: 'SSR' },
    { id: 'angel_staff',          weight: 1.0, rarity: 'SSR' },
    { id: 'sacred_twin_blades',   weight: 0.8, rarity: 'SSR' },
    { id: 'archmage_staff',       weight: 0.8, rarity: 'SSR' },
    { id: 'shadow_fangs',         weight: 0.8, rarity: 'SSR' },
    { id: 'dragon_katana',        weight: 0.8, rarity: 'SSR' },
    { id: 'divine_bow',           weight: 0.8, rarity: 'SSR' },
    { id: 'mjolnir',              weight: 0.8, rarity: 'SSR' },
    { id: 'ancient_grimoire',     weight: 0.8, rarity: 'SSR' },

    // ---- UR レア（伝説・制限解除III）----
    { id: 'limit_break_license_3', weight: 0.3, rarity: 'UR' },
    { id: 'chaos_katana_gacha',    weight: 0.25, rarity: 'UR' },
    { id: 'demon_scythe',          weight: 0.25, rarity: 'UR' },
    { id: 'genesis_bow',           weight: 0.25, rarity: 'UR' },
    { id: 'cosmos_orb',            weight: 0.2, rarity: 'UR' },
    { id: 'genesis_staff',         weight: 0.2, rarity: 'UR' },
    { id: 'soul_edge_katana',      weight: 0.2, rarity: 'UR' },
    { id: 'demon_twin_swords',     weight: 0.2, rarity: 'UR' },
];

export const PICKUP_ITEM_IDS = [
    'chaos_katana_gacha',
    'demon_scythe',
    'genesis_bow',
    'genesis_staff',
    'soul_edge_katana',
    'demon_twin_swords',
    'limit_break_license_3',
    'aurora_mail',
    'dragon_katana',
    'divine_bow',
    'ancient_grimoire'
];

export const RARITY_COLOR = {
    C: '#94a3b8',
    R: '#38bdf8',
    SR: '#c084fc',
    SSR: '#fbbf24',
    UR: '#f43f5e'
};

export const JOB_CATEGORIES = [
    { key: 'all',    label: '全職業' },
    { key: 'sword',  label: '片手剣' },
    { key: 'dual',   label: '双剣' },
    { key: 'katana', label: '刀' },
    { key: 'great',  label: '大剣/斧' },
    { key: 'blunt',  label: 'メイス' },
    { key: 'bow',    label: '弓/銃' },
    { key: 'magic',  label: '杖/魔書' },
    { key: 'other',  label: '防具/他' }
];

const TOTAL_WEIGHT = PRIZES.reduce((n, p) => n + p.weight, 0);

function getPrizeProbability(weight) {
    return ((weight / TOTAL_WEIGHT) * 100).toFixed(2) + '%';
}

function getPrizeJobCategory(item) {
    if (!item) return 'other';
    const wc = item.weaponClass;
    if (wc === 'oneHandSword') return 'sword';
    if (wc === 'dualSword') return 'dual';
    if (wc === 'katana') return 'katana';
    if (wc === 'twoHandSword' || wc === 'axe') return 'great';
    if (wc === 'mace' || wc === 'hammer' || wc === 'shield_sword') return 'blunt';
    if (wc === 'bow' || wc === 'crossbow') return 'bow';
    if (wc === 'staff' || wc === 'wand' || wc === 'tome' || wc === 'orb' || wc === 'scythe') return 'magic';
    return 'other';
}

function getWeaponClassLabel(wc, type) {
    if (type === 'armor') return '防具';
    if (type === 'accessory') return '宝具';
    if (type === 'consumable') return '消耗品';
    if (type === 'material') return '素材';
    const map = {
        oneHandSword: '片手剣', dualSword: '双剣', katana: '刀',
        twoHandSword: '両手剣', axe: '斧', mace: 'メイス',
        hammer: 'ハンマー', bow: '弓', crossbow: 'クロスボウ',
        staff: '杖', wand: 'ワンド', tome: '魔導書',
        orb: '魔導球', scythe: '大鎌'
    };
    return map[wc] || '武器';
}

function pickPrize() {
    let roll = Math.random() * TOTAL_WEIGHT;
    return PRIZES.find(p => (roll -= p.weight) <= 0) || PRIZES[0];
}

export default class GachaUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '💎 MAGIC STONE GACHA',
            width: 700,
            height: 520,
            depth: 125000,
            themeColor: 0x9b59ff
        });

        this.currentTab = 'draw'; // 'draw' | 'lineup'
        this.filterRarity = 'ALL';
        this.filterJob = 'all';
        this.filterPickupOnly = false;
        this.selectedLineupIndex = 0;
        this.filteredList = [];
        this.scrollOffset = 0;

        // 自動フィルター設定 (ローカルストレージで永続化)
        const savedFilters = (() => { try { return JSON.parse(localStorage.getItem('gachaAutoFilters') || '{}'); } catch (e) { return {}; } })();
        this.autoFilterC   = savedFilters.autoFilterC   ?? false;
        this.autoFilterR   = savedFilters.autoFilterR   ?? false;
        this.autoFilterSR  = savedFilters.autoFilterSR  ?? false;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        // タブボタンバーの設置
        this.createTabButtons();

        // 1. ガチャ引きコンテナ
        this.drawContainer = this.scene.add.container(0, 0);
        this.createDrawView();
        this.container.add(this.drawContainer);

        // 2. ピックアップ & 排出一覧コンテナ
        this.lineupContainer = this.scene.add.container(0, 0);
        this.createLineupView();
        this.container.add(this.lineupContainer);
        this.lineupContainer.setVisible(false);

        // キーバインド [G] で開閉
        this.scene.input.keyboard.on('keydown-G', () => {
            if (!this.scene.shopUI?.isOpen && !this.scene.inventoryUI?.isOpen) {
                this.toggle();
            }
        });
    }

    createTabButtons() {
        const y = -this.config.height / 2 + 65;
        this.tabBtns = [];

        const tabs = [
            { id: 'draw', label: '🎰 ガチャを引く' },
            { id: 'lineup', label: '⭐ ピックアップ・提供割合' }
        ];

        tabs.forEach((tab, idx) => {
            const x = -130 + idx * 260;
            const bg = this.scene.add.rectangle(x, y, 240, 32, 0x1f1936, 0.9)
                .setStrokeStyle(1, 0x8b5cf6)
                .setInteractive({ useHandCursor: true });

            const text = this.scene.add.text(x, y, tab.label, {
                fontSize: '13px',
                fontFamily: UI_FONT,
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            bg.on('pointerdown', () => this.switchTab(tab.id));
            this.container.add([bg, text]);
            this.tabBtns.push({ id: tab.id, bg, text });
        });

        this.updateTabStyles();
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        this.updateTabStyles();

        if (tabId === 'draw') {
            this.drawContainer.setVisible(true);
            this.lineupContainer.setVisible(false);
            this.refresh();
        } else {
            this.drawContainer.setVisible(false);
            this.lineupContainer.setVisible(true);
            this.refreshLineupList();
        }
    }

    updateTabStyles() {
        this.tabBtns.forEach(t => {
            const active = t.id === this.currentTab;
            t.bg.setFillStyle(active ? 0x7c3aed : 0x18142a, 0.95);
            t.bg.setStrokeStyle(active ? 2 : 1, active ? 0xd8b4fe : 0x4c1d95);
            t.text.setColor(active ? '#ffffff' : '#94a3b8');
        });
    }

    // ==========================================
    // ガチャを引く画面 (DRAW VIEW)
    // ==========================================
    createDrawView() {
        // ピックアップ告知バナー（上部）
        const bannerBg = this.scene.add.rectangle(0, -90, 620, 80, 0x1c1335, 0.9)
            .setStrokeStyle(2, 0xf59e0b, 0.8);

        const bannerTitle = this.scene.add.text(-290, -118, '⭐ 【超絶PICK UP!】 目玉限定装備 排出率大幅UP中！', {
            fontSize: '12px',
            fontFamily: UI_FONT,
            color: '#fbbf24',
            fontStyle: 'bold'
        });

        const pickupSamples = [
            '【混沌の魔刀 (UR)】',
            '【創世の神弓 (UR)】',
            '【冥王の大鎌 (UR)】',
            '【創世の神杖 (UR)】',
            '【オーロラメイル (SSR)】'
        ];
        const bannerDesc = this.scene.add.text(-290, -95, pickupSamples.join('  '), {
            fontSize: '11px',
            fontFamily: UI_FONT,
            color: '#e2e8f0'
        });

        // ピックアップ確認リンクボタン
        const checkBtnBg = this.scene.add.rectangle(230, -85, 130, 28, 0x7c3aed, 0.9)
            .setStrokeStyle(1, 0xc084fc)
            .setInteractive({ useHandCursor: true });
        const checkBtnText = this.scene.add.text(230, -85, '🔍 確率・一覧確認', {
            fontSize: '11px',
            fontFamily: UI_FONT,
            color: '#ffffff'
        }).setOrigin(0.5);
        checkBtnBg.on('pointerdown', () => this.switchTab('lineup'));

        // 所持魔石表示
        this.stoneText = this.scene.add.text(0, -30, '', {
            fontSize: '15px',
            fontFamily: UI_FONT,
            color: '#7ee7ff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // ガチャ結果表示領域
        const resultBoxBg = this.scene.add.rectangle(0, 45, 620, 105, 0x0c0a17, 0.8)
            .setStrokeStyle(1, 0x475569, 0.6);

        this.resultText = this.scene.add.text(0, 45, '魔石を消費して限定装備や超強力なUR武具を手に入れよう！\n「1回引く」または「10回引く」を選んでください。', {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: '#cbd5e1',
            align: 'center',
            wordWrap: { width: 580 },
            lineSpacing: 6
        }).setOrigin(0.5);

        // ガチャボタン
        this.createDrawButton(-150, 155, '1回召喚\n(魔石 x1)', 1);
        this.createDrawButton(150, 155, '10回連続召喚\n(魔石 x10)', 10);

        // 自動フィルターUI
        this.createAutoFilterUI();

        // ヒント
        this.hintText = this.scene.add.text(0, 220, '※ 魔石は無限の深淵クリア、実績解除、ダンジョンボス撃破などで獲得できます', {
            fontSize: '11px',
            fontFamily: UI_FONT,
            color: '#64748b'
        }).setOrigin(0.5);

        this.drawContainer.add([
            bannerBg, bannerTitle, bannerDesc, checkBtnBg, checkBtnText,
            this.stoneText, resultBoxBg, this.resultText, this.hintText
        ]);
    }

    createDrawButton(x, y, label, count) {
        const bg = this.scene.add.rectangle(x, y, 220, 56, 0x581c87, 0.95)
            .setStrokeStyle(2, 0xa855f7)
            .setInteractive({ useHandCursor: true });

        const text = this.scene.add.text(x, y, label, {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: '#ffffff',
            align: 'center',
            lineSpacing: 5,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        bg.on('pointerdown', () => this.draw(count));
        bg.on('pointerover', () => bg.setFillStyle(0x6b21a8));
        bg.on('pointerout', () => bg.setFillStyle(0x581c87));

        this.drawContainer.add([bg, text]);
    }

    // ==========================================
    // 自動フィルター UI (DRAW VIEW内)
    // ==========================================
    createAutoFilterUI() {
        // ラベル
        const label = this.scene.add.text(-300, 193, '🗑 自動売却フィルター:', {
            fontSize: '11px',
            fontFamily: UI_FONT,
            color: '#94a3b8'
        }).setOrigin(0, 0.5);
        this.drawContainer.add(label);

        const filters = [
            { key: 'autoFilterC',  label: 'Cランク', color: 0x64748b, activeColor: 0x94a3b8 },
            { key: 'autoFilterR',  label: 'Rランク', color: 0x0369a1, activeColor: 0x38bdf8 },
            { key: 'autoFilterSR', label: 'SRランク', color: 0x6b21a8, activeColor: 0xc084fc },
        ];

        this.autoFilterBtns = [];
        filters.forEach((f, i) => {
            const x = -100 + i * 110;
            const bg = this.scene.add.rectangle(x, 193, 100, 22, this[f.key] ? f.activeColor : f.color, 0.9)
                .setStrokeStyle(1, this[f.key] ? 0xffffff : 0x475569)
                .setInteractive({ useHandCursor: true });
            const txt = this.scene.add.text(x, 193, (this[f.key] ? '✓ ' : '') + f.label, {
                fontSize: '11px',
                fontFamily: UI_FONT,
                color: this[f.key] ? '#ffffff' : '#94a3b8'
            }).setOrigin(0.5);
            bg.on('pointerdown', () => {
                this[f.key] = !this[f.key];
                // 永続化
                const saved = { autoFilterC: this.autoFilterC, autoFilterR: this.autoFilterR, autoFilterSR: this.autoFilterSR };
                localStorage.setItem('gachaAutoFilters', JSON.stringify(saved));
                // 表示更新
                bg.setFillStyle(this[f.key] ? f.activeColor : f.color, 0.9);
                bg.setStrokeStyle(1, this[f.key] ? 0xffffff : 0x475569);
                txt.setText((this[f.key] ? '✓ ' : '') + f.label);
                txt.setColor(this[f.key] ? '#ffffff' : '#94a3b8');
            });
            this.drawContainer.add([bg, txt]);
            this.autoFilterBtns.push({ bg, txt, ...f });
        });

        // 説明
        const desc = this.scene.add.text(240, 193, '(ON=自動売却してGに)', {
            fontSize: '10px',
            fontFamily: UI_FONT,
            color: '#475569'
        }).setOrigin(1, 0.5);
        this.drawContainer.add(desc);
    }

    // ==========================================
    // ピックアップ & 提供割合一覧 (LINEUP VIEW)
    // ==========================================
    createLineupView() {
        // 1. ランクフィルターバー (UR, SSR, SR, R, C, ALL)
        this.createRarityFilterBar();

        // 2. 職業フィルターバー (全職, 片手剣, 双剣, 刀, 大剣/斧, メイス, 弓, 魔法, 防具/他)
        this.createJobFilterBar();

        // 3. アイテム一覧リスト（マスク付きスクロール）
        const sceneWidth = this.scene.scale.width;
        const sceneHeight = this.scene.scale.height;

        const maskShape = this.scene.add.graphics();
        maskShape.setScrollFactor(0);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(sceneWidth / 2 - 310, sceneHeight / 2 - 75, 620, 205);
        maskShape.setVisible(false);
        const mask = maskShape.createGeometryMask();

        this.listInnerContainer = this.scene.add.container(0, 0);
        this.listInnerContainer.setMask(mask);
        this.lineupContainer.add(this.listInnerContainer);

        // リスト枠線
        const listBorder = this.scene.add.rectangle(0, 27, 620, 205, 0x090714, 0.6)
            .setStrokeStyle(1, 0x334155, 0.8);
        this.lineupContainer.add(listBorder);
        this.lineupContainer.sendToBack(listBorder);

        // 4. 下部：選択アイテム詳細ステータスパネル
        const detailBg = this.scene.add.rectangle(0, 175, 620, 75, 0x0f172a, 0.95)
            .setStrokeStyle(1, 0x38bdf8, 0.8);

        this.detailTitle = this.scene.add.text(-295, 145, 'アイテムを選択すると詳細が表示されます', {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: '#f8fafc',
            fontStyle: 'bold'
        });

        this.detailDesc = this.scene.add.text(-295, 168, '', {
            fontSize: '11px',
            fontFamily: UI_FONT,
            color: '#94a3b8',
            wordWrap: { width: 590 },
            lineSpacing: 4
        });

        this.lineupContainer.add([detailBg, this.detailTitle, this.detailDesc]);

        // マウスホイール操作でリストをスクロール
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (!this.isOpen || this.currentTab !== 'lineup') return;
            this.handleListScroll(deltaY);
        });
    }

    createRarityFilterBar() {
        const rarities = ['ALL', 'UR', 'SSR', 'SR', 'R', 'C'];
        this.rarityBtns = [];
        const y = -118;
        const totalW = 620;
        const btnW = totalW / rarities.length - 4;

        rarities.forEach((r, idx) => {
            const x = -totalW / 2 + btnW / 2 + idx * (btnW + 4);
            const bg = this.scene.add.rectangle(x, y, btnW, 26, 0x1e1b4b, 0.9)
                .setStrokeStyle(1, 0x4f46e5)
                .setInteractive({ useHandCursor: true });

            const labelText = r === 'ALL' ? 'ランク: すべて' : `[${r}]`;
            const text = this.scene.add.text(x, y, labelText, {
                fontSize: '11px',
                fontFamily: UI_FONT,
                color: RARITY_COLOR[r] || '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            bg.on('pointerdown', () => {
                this.filterRarity = r;
                this.updateRarityFilterStyles();
                this.refreshLineupList();
            });

            this.lineupContainer.add([bg, text]);
            this.rarityBtns.push({ id: r, bg, text });
        });

        this.updateRarityFilterStyles();
    }

    updateRarityFilterStyles() {
        this.rarityBtns.forEach(b => {
            const active = b.id === this.filterRarity;
            b.bg.setFillStyle(active ? 0x4338ca : 0x110e26, active ? 1 : 0.7);
            b.bg.setStrokeStyle(active ? 2 : 1, active ? 0xa5b4fc : 0x312e81);
        });
    }

    createJobFilterBar() {
        this.jobBtns = [];
        const y = -88;
        const totalW = 620;
        const btnW = totalW / (JOB_CATEGORIES.length + 1) - 3;

        JOB_CATEGORIES.forEach((j, idx) => {
            const x = -totalW / 2 + btnW / 2 + idx * (btnW + 3);
            const bg = this.scene.add.rectangle(x, y, btnW, 24, 0x131d36, 0.9)
                .setStrokeStyle(1, 0x2563eb)
                .setInteractive({ useHandCursor: true });

            const text = this.scene.add.text(x, y, j.label, {
                fontSize: '10px',
                fontFamily: UI_FONT,
                color: '#93c5fd'
            }).setOrigin(0.5);

            bg.on('pointerdown', () => {
                this.filterJob = j.key;
                this.updateJobFilterStyles();
                this.refreshLineupList();
            });

            this.lineupContainer.add([bg, text]);
            this.jobBtns.push({ id: j.key, bg, text });
        });

        // ⭐ ピックアップのみ絞り込みボタン（一番右）
        const pickIdx = JOB_CATEGORIES.length;
        const px = -totalW / 2 + btnW / 2 + pickIdx * (btnW + 3);
        const pbg = this.scene.add.rectangle(px, y, btnW, 24, 0x3b1c08, 0.9)
            .setStrokeStyle(1, 0xd97706)
            .setInteractive({ useHandCursor: true });
        const ptext = this.scene.add.text(px, y, '⭐PU限定', {
            fontSize: '10px',
            fontFamily: UI_FONT,
            color: '#fcd34d',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        pbg.on('pointerdown', () => {
            this.filterPickupOnly = !this.filterPickupOnly;
            pbg.setFillStyle(this.filterPickupOnly ? 0xb45309 : 0x3b1c08);
            pbg.setStrokeStyle(this.filterPickupOnly ? 2 : 1, this.filterPickupOnly ? 0xfef08a : 0xd97706);
            this.refreshLineupList();
        });

        this.lineupContainer.add([pbg, ptext]);
        this.updateJobFilterStyles();
    }

    updateJobFilterStyles() {
        this.jobBtns.forEach(b => {
            const active = b.id === this.filterJob;
            b.bg.setFillStyle(active ? 0x2563eb : 0x0f172a, active ? 1 : 0.7);
            b.bg.setStrokeStyle(active ? 2 : 1, active ? 0x93c5fd : 0x1e3a8a);
            b.text.setColor(active ? '#ffffff' : '#94a3b8');
        });
    }

    handleListScroll(deltaY) {
        if (this.filteredList.length <= 5) return;
        const maxScroll = Math.max(0, (this.filteredList.length - 5) * 40);
        this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + (deltaY > 0 ? 40 : -40), 0, maxScroll);
        this.listInnerContainer.y = -this.scrollOffset;
    }

    refreshLineupList() {
        this.listInnerContainer.removeAll(true);
        this.scrollOffset = 0;
        this.listInnerContainer.y = 0;

        // フィルタリング処理
        this.filteredList = PRIZES.filter(p => {
            const item = ITEMS[p.id];
            if (!item) return false;

            // 1. ランクフィルター
            if (this.filterRarity !== 'ALL' && p.rarity !== this.filterRarity) {
                return false;
            }

            // 2. 職業フィルター
            if (this.filterJob !== 'all') {
                const jobCat = getPrizeJobCategory(item);
                if (jobCat !== this.filterJob) return false;
            }

            // 3. ピックアップのみフィルター
            if (this.filterPickupOnly && !PICKUP_ITEM_IDS.includes(p.id)) {
                return false;
            }

            return true;
        });

        if (this.filteredList.length === 0) {
            const emptyText = this.scene.add.text(0, 25, '条件に一致する排出アイテムがありません', {
                fontSize: '13px',
                fontFamily: UI_FONT,
                color: '#64748b'
            }).setOrigin(0.5);
            this.listInnerContainer.add(emptyText);
            this.showDetailForItem(null);
            return;
        }

        // リスト描画
        const rowH = 38;
        const startY = -55;

        this.filteredList.forEach((p, idx) => {
            const item = ITEMS[p.id];
            const y = startY + idx * rowH;
            const isPickup = PICKUP_ITEM_IDS.includes(p.id);

            const rowBg = this.scene.add.rectangle(0, y, 600, 34, isPickup ? 0x221c38 : 0x11162a, 0.85)
                .setStrokeStyle(1, isPickup ? 0xf59e0b : 0x334155, isPickup ? 0.9 : 0.5)
                .setInteractive({ useHandCursor: true });

            // レアリティバッジ
            const rarityColor = RARITY_COLOR[p.rarity] || '#ffffff';
            const rarityBadge = this.scene.add.text(-280, y, `[${p.rarity}]`, {
                fontSize: '12px',
                fontFamily: UI_FONT,
                color: rarityColor,
                fontStyle: 'bold'
            }).setOrigin(0, 0.5);

            // PICK UP バッジ
            let puBadge = null;
            if (isPickup) {
                puBadge = this.scene.add.text(-235, y, '⭐PICK UP', {
                    fontSize: '10px',
                    fontFamily: UI_FONT,
                    color: '#fbbf24',
                    fontStyle: 'bold'
                }).setOrigin(0, 0.5);
            }

            // アイテム名
            const nameX = isPickup ? -165 : -230;
            const nameText = this.scene.add.text(nameX, y, item.name, {
                fontSize: '12px',
                fontFamily: UI_FONT,
                color: isPickup ? '#fef08a' : '#ffffff'
            }).setOrigin(0, 0.5);

            // 武器種別 / カテゴリ
            const catLabel = getWeaponClassLabel(item.weaponClass, item.type);
            const catText = this.scene.add.text(60, y, `【${catLabel}】`, {
                fontSize: '11px',
                fontFamily: UI_FONT,
                color: '#94a3b8'
            }).setOrigin(0, 0.5);

            // 必要レベル
            const lvlText = this.scene.add.text(160, y, item.lvlReq ? `Lv.${item.lvlReq}` : '制限なし', {
                fontSize: '11px',
                fontFamily: UI_FONT,
                color: '#cbd5e1'
            }).setOrigin(0, 0.5);

            // 排出確率 (%)
            const prob = getPrizeProbability(p.weight);
            const probText = this.scene.add.text(285, y, prob, {
                fontSize: '12px',
                fontFamily: UI_FONT,
                color: '#7ee7ff',
                fontStyle: 'bold'
            }).setOrigin(1, 0.5);

            rowBg.on('pointerdown', () => {
                this.selectedLineupIndex = idx;
                this.showDetailForItem(item, p);
            });

            this.listInnerContainer.add([rowBg, rarityBadge, nameText, catText, lvlText, probText]);
            if (puBadge) this.listInnerContainer.add(puBadge);
        });

        // 初期選択アイテムを表示
        const first = this.filteredList[0];
        if (first) {
            this.showDetailForItem(ITEMS[first.id], first);
        }
    }

    showDetailForItem(item, prize = null) {
        if (!item) {
            this.detailTitle.setText('');
            this.detailDesc.setText('');
            return;
        }

        const isPickup = prize && PICKUP_ITEM_IDS.includes(prize.id);
        const puTag = isPickup ? ' ⭐【PICK UP! 目玉装備】' : '';
        const rarityTag = prize ? ` [${prize.rarity}] ` : ' ';
        this.detailTitle.setText(`${rarityTag}${item.name}${puTag}`);
        this.detailTitle.setColor(prize ? RARITY_COLOR[prize.rarity] : '#ffffff');

        // ステータス情報の整形
        const s = item.stats || {};
        const statParts = [];
        if (s.attack || item.atk) statParts.push(`ATK +${s.attack || item.atk}`);
        if (s.matk || item.matk) statParts.push(`MATK +${s.matk || item.matk}`);
        if (s.defense || item.def) statParts.push(`DEF +${s.defense || item.def}`);
        if (s.critChance) statParts.push(`会心 +${Math.round(s.critChance * 100)}%`);
        if (s.lifesteal) statParts.push(`吸収 +${Math.round(s.lifesteal * 100)}%`);
        if (s.speedBonus) statParts.push(`速度 +${s.speedBonus}`);
        if (s.multiHit && s.multiHit > 1) statParts.push(`${s.multiHit}連撃`);
        if (item.element) statParts.push(`属性:${item.element}`);

        const statStr = statParts.length > 0 ? `性能: ${statParts.join(' / ')}` : '';
        const probStr = prize ? `提供割合: ${getPrizeProbability(prize.weight)}` : '';
        const descStr = item.description || '';

        this.detailDesc.setText(`${statStr}   ${probStr}\n${descStr}`);
    }

    // ==========================================
    // ライフサイクル・ガチャ実行
    // ==========================================
    open() {
        super.open();
        this.switchTab('draw');
        this.refresh();
    }

    refresh() {
        const owned = totalOwned(this.scene.player, 'magic_stone');
        this.stoneText?.setText(`💎 所持魔石: ${owned} 個`);
    }

    draw(count) {
        const player = this.scene.player;
        const owned = totalOwned(player, 'magic_stone');
        if (owned < count) {
            this.scene.notificationUI?.show(`魔石が足りません（必要: ${count}個 / 所持: ${owned}個）`, 'error');
            return;
        }

        // 魔石消費
        for (let n = 0; n < count; n++) {
            const index = player.stats.inventory.findIndex(e => entryId(e) === 'magic_stone');
            if (index !== -1) {
                removeFromInventory(player, index, 1);
            }
        }

        // ガチャ抽選
        const results = Array.from({ length: count }, pickPrize);

        // 自動フィルター設定
        const autoSellMap = {
            C:  this.autoFilterC,
            R:  this.autoFilterR,
            SR: this.autoFilterSR,
        };

        // アイテム付与 / 自動売却
        let totalAutoGold = 0;
        const resultMeta = results.map(p => {
            const item = ITEMS[p.id];
            const doAutoSell = autoSellMap[p.rarity] ?? false;
            if (doAutoSell) {
                // 自動売却: インベントリに入れずゴールドへ
                const gold = unitSellPrice(item) || 50;
                player.gainGold(gold);
                totalAutoGold += gold;
                return { ...p, autoSold: true, gold };
            } else {
                player.addItem(p.id, 1);
                return { ...p, autoSold: false };
            }
        });
        player.saveStats();

        // 結果フォーマット
        const rank = { C: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
        // 最高ランクは「実際に獲得したもの」の中から決める（売却済みも含む）
        const top = results.reduce((best, p) => rank[p.rarity] > rank[best.rarity] ? p : best, results[0]);

        if (count === 1) {
            const p = resultMeta[0];
            const item = ITEMS[p.id];
            const pu = PICKUP_ITEM_IDS.includes(p.id) ? ' ⭐PICK UP!!' : '';
            if (p.autoSold) {
                this.resultText.setColor(RARITY_COLOR[p.rarity] || '#ffffff')
                    .setText(`💰 【自動売却】 [${p.rarity}] ${item.name}${pu}\n+${p.gold.toLocaleString()} G に換金しました`);
            } else {
                this.resultText.setColor(RARITY_COLOR[p.rarity] || '#ffffff')
                    .setText(`🎉 【獲得】 [${p.rarity}] ${item.name}${pu}\n${item.description || ''}`);
            }
        } else {
            const lines = resultMeta.map(p => {
                const pu = PICKUP_ITEM_IDS.includes(p.id) ? '⭐' : '';
                const suffix = p.autoSold ? `💰+${p.gold.toLocaleString()}G` : '';
                return `[${p.rarity}]${pu}${ITEMS[p.id].name}${suffix}`;
            });
            // 2列で表示
            const col1 = lines.slice(0, 5).join('\n');
            const col2 = lines.slice(5).join('\n');
            const goldMsg = totalAutoGold > 0 ? `\n💰 自動売却合計: +${totalAutoGold.toLocaleString()} G` : '';
            this.resultText.setColor(RARITY_COLOR[top.rarity] || '#ffffff')
                .setText(`🎉 【10連召喚結果 - 最高ランク: ${top.rarity}】${goldMsg}\n${col1}   ${col2}`);
        }

        if (top.rarity === 'UR' || top.rarity === 'SSR') {
            this.scene.notificationUI?.show(`✨ 超激レア [${top.rarity}] ${ITEMS[top.id].name} を引き当てました！`, 'warning', 5000);
        }

        this.refresh();
    }
}
