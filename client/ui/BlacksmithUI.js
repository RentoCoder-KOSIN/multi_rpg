import { UI_FONT } from '../fontConfig.js';
import { ITEMS } from "../data/items.js";
import BaseWindowUI from "./BaseWindowUI.js";
import {
    ELEMENTS, ELEMENT_INFO, ELEMENT_RULES, STRONG_AGAINST, WEAK_TO, getOrbItemId,
    getElementGroups, getWeaponBonusSummary, getElementColorCss,
} from "../data/elements.js";
import { areEffectsEnabled } from "../utils/effectsSettings.js";

/**
 * 鍛冶屋UI。
 *  1) 属性の玉(6種)の購入 & 属性付与
 *  2) 装備強化 (+1〜+15) & 強化石購入
 */
export default class BlacksmithUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '⚒️ 鍛冶屋',
            width: 660,
            height: 560,
            depth: 120000,
            themeColor: 0xff8844,
            titleStroke: 0xff8844,
        });
        this._currentTab = 'enhance'; // 'enhance' | 'element'
        this._selectedSlot = 'weapon'; // 'weapon' | 'armor' | 'relic'
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // ゴールド表示
        const goldPanel = this.scene.add.graphics();
        goldPanel.fillStyle(0x000000, 0.4);
        goldPanel.fillRoundedRect(-panelWidth / 2 + 20, -panelHeight / 2 + 50, 180, 30, 8);
        this.container.add(goldPanel);

        this.goldText = this.scene.add.text(-panelWidth / 2 + 30, -panelHeight / 2 + 65, '🪙 0', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffd700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.container.add(this.goldText);

        // タブボタン（装備強化 / 属性付与）
        this._buildTabs();

        this.bodyContainer = this.scene.add.container(0, 0);
        this.container.add(this.bodyContainer);

        this.createHelpButton();
        this.createHelpOverlay();
    }

    _buildTabs() {
        const panelWidth = this.config.width;
        const panelHeight = this.config.height;
        const tabY = -panelHeight / 2 + 65;

        this._tabBtns = {};
        const tabs = [
            { key: 'enhance', label: '⚔️ 装備強化', x: -40 },
            { key: 'element', label: '🔮 属性付与', x: 90 },
            { key: 'craft',   label: '🔨 クラフト',   x: 220 },
        ];

        tabs.forEach(t => {
            const btn = this.scene.add.rectangle(t.x, tabY, 115, 28, 0x222244)
                .setInteractive({ useHandCursor: true });
            const lbl = this.scene.add.text(t.x, tabY, t.label, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                if (t.key === 'craft') {
                    this.close();
                    if (this.scene.craftingUI) this.scene.craftingUI.open();
                    return;
                }
                this._currentTab = t.key;
                this._updateTabStyles();
                this.refresh();
            });
            btn.on('pointerover', () => btn.setFillStyle(0x444477));
            btn.on('pointerout', () => this._updateTabStyles());

            this.container.add([btn, lbl]);
            this._tabBtns[t.key] = { btn, lbl };
        });
        this._updateTabStyles();
    }

    _updateTabStyles() {
        Object.entries(this._tabBtns).forEach(([k, { btn }]) => {
            btn.setFillStyle(this._currentTab === k ? 0xff8844 : 0x222244);
        });
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        if (this.helpContainer) this.helpContainer.setVisible(false);
        this.refresh();
    }

    createHelpButton() {
        const x = this.config.width / 2 - 40;
        const y = -this.config.height / 2 + 35;
        const btn = this.scene.add.container(x, y);
        const bg = this.scene.add.circle(0, 0, 16, 0x1a1a2e, 0.9).setStrokeStyle(2, 0xff8844);
        const q = this.scene.add.text(0, 0, '?', {
            fontSize: '18px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        btn.add([bg, q]);
        btn.setSize(36, 36);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', (p, lx, ly, event) => {
            if (event) event.stopPropagation();
            this.helpContainer.setVisible(!this.helpContainer.visible);
        });
        btn.on('pointerover', () => bg.setStrokeStyle(3, 0xffffff));
        btn.on('pointerout', () => bg.setStrokeStyle(2, 0xff8844));
        this.container.add(btn);
    }

    createHelpOverlay() {
        const w = this.config.width;
        const h = this.config.height;
        const font = UI_FONT;
        const hc = this.scene.add.container(0, 0);
        hc.setVisible(false);
        this.helpContainer = hc;

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x10182e, 0.98);
        bg.fillRoundedRect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30, 16);
        bg.lineStyle(2, 0xff8844, 0.8);
        bg.strokeRoundedRect(-w / 2 + 15, -h / 2 + 15, w - 30, h - 30, 16);
        hc.add(bg);

        const blocker = this.scene.add.rectangle(0, 0, w - 30, h - 30, 0x000000, 0).setInteractive();
        blocker.on('pointerdown', (p, lx, ly, event) => { if (event) event.stopPropagation(); });
        hc.add(blocker);

        hc.add(this.scene.add.text(0, -h / 2 + 45, '鍛冶屋ヘルプ & 強化システム', {
            fontSize: '16px', fontFamily: font, color: '#ffffff', stroke: '#ff8844', strokeThickness: 3
        }).setOrigin(0.5));

        const infoText = [
            '【装備強化システム】',
            '・装備のステータスが1レベルにつき +5% 強化されます（最大+15）。',
            '・強化にはゴールドと各ランクの「強化石」が必要です。',
            '  - 普通の強化石: +5まで強化可能 (成功率 100%)',
            '  - 上質な強化石: +10まで強化可能 (成功率 80%〜60%)',
            '  - 伝説の強化石: +15まで強化可能 (成功率 40%〜20%)',
            '・+6以降で失敗すると、強化値が1段階下がることがあります。',
            '',
            '【属性付与システム】',
            '・属性の玉を購入して装備に付与できます。',
            '・火・水・雷・風・土・光・闇の相性関係でダメージが大きく変動します。'
        ].join('\n');

        const info = this.scene.add.text(-w / 2 + 40, -h / 2 + 80, infoText, {
            fontSize: '12px', fontFamily: font, color: '#cccccc', lineSpacing: 4
        });
        hc.add(info);

        const closeBtn = this.scene.add.text(0, h / 2 - 40, '閉じる', {
            fontSize: '14px', fontFamily: font, color: '#ff8844', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => hc.setVisible(false));
        hc.add(closeBtn);

        this.container.add(hc);
    }

    updateGold() {
        if (this.scene.player && this.goldText) {
            this.goldText.setText(`🪙 ${this.scene.player.stats.gold}`);
        }
    }

    refresh() {
        if (!this.bodyContainer) return;
        this.bodyContainer.removeAll(true);
        this.updateGold();

        if (this._currentTab === 'enhance') {
            this._renderEnhanceTab();
        } else {
            this._renderElementTab();
        }
    }

    // ==========================================
    // ⚔️ 装備強化タブ
    // ==========================================
    _renderEnhanceTab() {
        const player = this.scene.player;
        if (!player) return;

        const W = this.config.width;
        const H = this.config.height;

        // 1. スロット選択ボタン (武器 / 防具 / 宝具)
        const slotY = -H / 2 + 105;
        const slots = [
            { key: 'weapon', label: '⚔️ 武器', x: -180 },
            { key: 'armor',  label: '🛡️ 防具', x: 0 },
            { key: 'relic',  label: '💍 宝具', x: 180 },
        ];

        slots.forEach(s => {
            const isSel = this._selectedSlot === s.key;
            const btn = this.scene.add.rectangle(s.x, slotY, 140, 32, isSel ? 0xff8844 : 0x1a2a3a)
                .setStrokeStyle(1, isSel ? 0xffffff : 0x446688)
                .setInteractive({ useHandCursor: true });
            const lbl = this.scene.add.text(s.x, slotY, s.label, {
                fontSize: '13px', fontFamily: UI_FONT, color: isSel ? '#ffffff' : '#aaaaaa'
            }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                this._selectedSlot = s.key;
                this.refresh();
            });
            this.bodyContainer.add([btn, lbl]);
        });

        // 2. 現在の装備品と強化状態
        const equippedId = player.stats.equipment[this._selectedSlot];
        const itemDef = ITEMS[equippedId];
        const curLv = player.getEnhanceLevel ? player.getEnhanceLevel(this._selectedSlot) : (player.stats.enhanceLevels?.[this._selectedSlot] || 0);

        const infoBox = this.scene.add.graphics();
        infoBox.fillStyle(0x121a2e, 0.9);
        infoBox.fillRoundedRect(-W / 2 + 30, slotY + 28, W - 60, 110, 10);
        infoBox.lineStyle(1, 0x4466aa, 0.6);
        infoBox.strokeRoundedRect(-W / 2 + 30, slotY + 28, W - 60, 110, 10);
        this.bodyContainer.add(infoBox);

        if (!itemDef) {
            const noItemText = this.scene.add.text(0, slotY + 83, '装備が装着されていません', {
                fontSize: '14px', fontFamily: UI_FONT, color: '#888888'
            }).setOrigin(0.5);
            this.bodyContainer.add(noItemText);
        } else {
            const icon = this.scene.add.text(-W / 2 + 60, slotY + 83, itemDef.icon || '📦', {
                fontSize: '32px'
            }).setOrigin(0.5);

            const nameStr = `${itemDef.name} ${curLv > 0 ? `+${curLv}` : ''}`;
            const name = this.scene.add.text(-W / 2 + 95, slotY + 50, nameStr, {
                fontSize: '16px', fontFamily: UI_FONT, color: curLv >= 15 ? '#ff44ff' : (curLv >= 10 ? '#ffd700' : '#ffffff')
            });

            const curBonusStr = `現在のボーナス: 全性能 +${curLv * 5}%`;
            const nextBonusStr = curLv < 15 ? ` → 次の強化後: +${(curLv + 1) * 5}%` : ' (最大強化)';
            const statsText = this.scene.add.text(-W / 2 + 95, slotY + 75, curBonusStr + nextBonusStr, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#88ffaa'
            });

            // 成功確率 & コスト計算
            let successRateText = '100%';
            let rateColor = '#00ff00';
            if (curLv >= 15) {
                successRateText = 'MAX';
                rateColor = '#ff44ff';
            } else if (curLv >= 13) {
                successRateText = '40% (失敗時 -1)';
                rateColor = '#ff5555';
            } else if (curLv >= 10) {
                successRateText = '60% (失敗時 -1)';
                rateColor = '#ffaa44';
            } else if (curLv >= 6) {
                successRateText = '80% (失敗時 -1)';
                rateColor = '#ffff44';
            }

            const goldCost = Math.pow(curLv + 1, 2) * 1000;
            const costStr = curLv < 15 ? `必要ゴールド: 🪙 ${goldCost}  |  成功確率: ${successRateText}` : 'これ以上強化できません';
            const costText = this.scene.add.text(-W / 2 + 95, slotY + 98, costStr, {
                fontSize: '12px', fontFamily: UI_FONT, color: rateColor
            });

            this.bodyContainer.add([icon, name, statsText, costText]);
        }

        // 3. 強化石選択 & 購入エリア
        const stonesHeader = this.scene.add.text(-W / 2 + 35, slotY + 155, '💎 強化石の選択 & ショップ', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffaa44'
        });
        this.bodyContainer.add(stonesHeader);

        const stoneData = [
            { id: 'enhance_stone_1', max: 5,  price: 500 },
            { id: 'enhance_stone_2', max: 10, price: 2000 },
            { id: 'enhance_stone_3', max: 15, price: 10000 },
        ];

        const stoneBoxW = 190;
        const stoneBoxH = 80;
        stoneData.forEach((st, idx) => {
            const def = ITEMS[st.id];
            if (!def) return;

            const sx = -W / 2 + 35 + stoneBoxW / 2 + idx * (stoneBoxW + 15);
            const sy = slotY + 215;

            // 所持数取得
            const entry = (player.stats.inventory || []).find(e => (typeof e === 'string' ? e : e.id) === st.id);
            const count = entry ? (typeof entry === 'string' ? 1 : (entry.count || 1)) : 0;

            const bg = this.scene.add.graphics();
            bg.fillStyle(0x1a243a, 0.9);
            bg.fillRoundedRect(-stoneBoxW / 2, -stoneBoxH / 2, stoneBoxW, stoneBoxH, 8);
            bg.lineStyle(1, 0x4a70aa, 0.7);
            bg.strokeRoundedRect(-stoneBoxW / 2, -stoneBoxH / 2, stoneBoxW, stoneBoxH, 8);

            const icon = this.scene.add.text(-stoneBoxW / 2 + 20, -10, def.icon, { fontSize: '24px' }).setOrigin(0.5);
            const title = this.scene.add.text(-stoneBoxW / 2 + 40, -22, def.name, {
                fontSize: '11px', fontFamily: UI_FONT, color: '#ffffff'
            });
            const limit = this.scene.add.text(-stoneBoxW / 2 + 40, -8, `+${st.max}まで対応`, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#aaaaaa'
            });
            const stock = this.scene.add.text(-stoneBoxW / 2 + 40, 6, `所持: ${count}個`, {
                fontSize: '11px', fontFamily: UI_FONT, color: count > 0 ? '#44ff44' : '#ff5555'
            });

            // 購入ボタン (小)
            const buyBtn = this.scene.add.rectangle(stoneBoxW / 2 - 35, 15, 60, 22, 0x00aa00)
                .setInteractive({ useHandCursor: true });
            const buyTxt = this.scene.add.text(stoneBoxW / 2 - 35, 15, `🪙${st.price}`, {
                fontSize: '9px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);

            buyBtn.on('pointerdown', () => {
                if (player.stats.gold < st.price) {
                    this.scene.notificationUI?.show('ゴールドが足りません！', 'error');
                    return;
                }
                player.stats.gold -= st.price;
                player.addItem(st.id, 1);
                player.saveStats();
                this.refresh();
            });

            // 強化実行ボタン (各石ごと)
            const canUseThisStone = curLv < st.max && count > 0 && itemDef && curLv < 15;
            const enhBtn = this.scene.add.rectangle(stoneBoxW / 2 - 35, -15, 60, 22, canUseThisStone ? 0xff6600 : 0x444444)
                .setInteractive({ useHandCursor: canUseThisStone });
            const enhTxt = this.scene.add.text(stoneBoxW / 2 - 35, -15, '強化！', {
                fontSize: '10px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);

            if (canUseThisStone) {
                enhBtn.on('pointerover', () => enhBtn.setFillStyle(0xff8833));
                enhBtn.on('pointerout', () => enhBtn.setFillStyle(0xff6600));
                enhBtn.on('pointerdown', () => {
                    const result = player.enhanceEquipment(this._selectedSlot, st.id);
                    if (areEffectsEnabled(this.scene)) {
                        this.scene.cameras.main.shake(120, result.success ? 0.005 : 0.002);
                    }
                    this.refresh();
                    if (this.scene.equipmentUI?.isOpen) this.scene.equipmentUI.refresh();
                });
            }

            const stoneBox = this.scene.add.container(sx, sy, [bg, icon, title, limit, stock, buyBtn, buyTxt, enhBtn, enhTxt]);
            this.bodyContainer.add(stoneBox);
        });
    }

    // ==========================================
    // 🔮 属性付与タブ (従来の動作)
    // ==========================================
    _renderElementTab() {
        const player = this.scene.player;
        if (!player) return;

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        const buyTitle = this.scene.add.text(-panelWidth / 2 + 30, -panelHeight / 2 + 105, '🔮 属性の玉を購入', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ff8844'
        }).setOrigin(0, 0.5);
        this.bodyContainer.add(buyTitle);

        const orbBoxW = 190;
        const orbBoxH = 60;
        const cols = 3;
        const startX = -panelWidth / 2 + 30 + orbBoxW / 2;
        const startY = -panelHeight / 2 + 145;

        ELEMENTS.forEach((element, index) => {
            const info = ELEMENT_INFO[element];
            const orbId = getOrbItemId(element);
            const orbItem = ITEMS[orbId];
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = startX + col * (orbBoxW + 10);
            const y = startY + row * (orbBoxH + 10);

            const box = this.scene.add.container(x, y);
            const bg = this.scene.add.graphics();
            bg.fillStyle(0x0f3460, 0.5);
            bg.fillRoundedRect(-orbBoxW / 2, -orbBoxH / 2, orbBoxW, orbBoxH, 8);
            bg.lineStyle(2, info.color, 0.6);
            bg.strokeRoundedRect(-orbBoxW / 2, -orbBoxH / 2, orbBoxW, orbBoxH, 8);
            box.add(bg);

            const icon = this.scene.add.text(-orbBoxW / 2 + 20, 0, info.icon, { fontSize: '22px' }).setOrigin(0.5);
            box.add(icon);

            const name = this.scene.add.text(-orbBoxW / 2 + 42, -12, info.name, {
                fontSize: '12px', fontFamily: UI_FONT, color: getElementColorCss(element),
                stroke: '#000', strokeThickness: 2
            });
            box.add(name);

            const owned = this.getOwnedOrbCount(element);
            const ownedText = this.scene.add.text(-orbBoxW / 2 + 42, 6, `所持: ${owned}個`, {
                fontSize: '10px', fontFamily: UI_FONT, color: owned > 0 ? '#44ff44' : '#aaaaaa'
            });
            box.add(ownedText);

            const price = orbItem?.price || 1000;
            const buyBtn = this.scene.add.container(orbBoxW / 2 - 36, 0);
            const buyBg = this.scene.add.rectangle(0, 0, 56, 26, 0x00aa00).setStrokeStyle(1, 0x00ff00);
            const buyText = this.scene.add.text(0, 0, `🪙${price}`, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);
            buyBtn.add([buyBg, buyText]);
            buyBtn.setSize(56, 26);
            buyBtn.setInteractive({ useHandCursor: true });
            buyBtn.on('pointerdown', (p, lx, ly, event) => {
                if (event) event.stopPropagation();
                this.buyOrb(element);
            });
            buyBtn.on('pointerover', () => buyBg.setFillStyle(0x00dd00));
            buyBtn.on('pointerout', () => buyBg.setFillStyle(0x00aa00));
            box.add(buyBtn);

            this.bodyContainer.add(box);
        });

        // 装備への属性付与
        const attachTitle = this.scene.add.text(-panelWidth / 2 + 30, -panelHeight / 2 + 300, '✨ 装備に属性を付与（玉を1個消費）', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ff8844'
        }).setOrigin(0, 0.5);
        this.bodyContainer.add(attachTitle);

        this.renderAttachRow('weapon', '⚔️ 武器', -panelHeight / 2 + 340);
        this.renderAttachRow('armor', '🛡️ 防具', -panelHeight / 2 + 425);
    }

    renderAttachRow(slot, label, y) {
        const player = this.scene.player;
        const panelWidth = this.config.width;
        const itemId = player.stats.equipment[slot];
        const item = itemId ? ITEMS[itemId] : null;
        const currentElement = player.stats.itemElements?.[itemId] || null;

        const rowBg = this.scene.add.graphics();
        rowBg.fillStyle(0x1a1a2e, 0.8);
        rowBg.fillRoundedRect(-panelWidth / 2 + 30, y - 25, panelWidth - 60, 68, 8);
        rowBg.lineStyle(1, 0x4a90e2, 0.4);
        rowBg.strokeRoundedRect(-panelWidth / 2 + 30, y - 25, panelWidth - 60, 68, 8);
        this.bodyContainer.add(rowBg);

        const slotText = this.scene.add.text(-panelWidth / 2 + 45, y - 10, label, {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffaa44'
        });
        this.bodyContainer.add(slotText);

        const itemName = item ? item.name : '（未装備）';
        const itemText = this.scene.add.text(-panelWidth / 2 + 45, y + 10, itemName, {
            fontSize: '11px', fontFamily: UI_FONT, color: item ? '#ffffff' : '#666666'
        });
        this.bodyContainer.add(itemText);

        if (currentElement) {
            const curInfo = ELEMENT_INFO[currentElement];
            const curText = this.scene.add.text(-panelWidth / 2 + 180, y, `${curInfo.icon}${curInfo.name}属性`, {
                fontSize: '12px', fontFamily: UI_FONT, color: getElementColorCss(currentElement),
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0, 0.5);
            this.bodyContainer.add(curText);
        }

        if (!item) return;

        let bx = panelWidth / 2 - 50;
        ELEMENTS.forEach(element => {
            const info = ELEMENT_INFO[element];
            const owned = this.getOwnedOrbCount(element);
            const isCurrent = currentElement === element;

            const btn = this.scene.add.container(bx, y);
            const btnBg = this.scene.add.circle(0, 0, 18, isCurrent ? info.color : 0x1a1a2e, 0.9)
                .setStrokeStyle(2, owned > 0 ? info.color : 0x555555);
            const btnIcon = this.scene.add.text(0, 0, info.icon, { fontSize: '15px' }).setOrigin(0.5);
            if (owned === 0 && !isCurrent) btnIcon.setAlpha(0.3);

            btn.add([btnBg, btnIcon]);
            btn.setSize(36, 36);
            btn.setInteractive({ useHandCursor: owned > 0 && !isCurrent });
            btn.on('pointerdown', (p, lx, ly, event) => {
                if (event) event.stopPropagation();
                if (owned > 0 && !isCurrent) this.attachElement(slot, element);
            });
            this.bodyContainer.add(btn);
            bx -= 42;
        });
    }

    getOwnedOrbCount(element) {
        const orbId = getOrbItemId(element);
        const player = this.scene.player;
        if (!player) return 0;
        const entry = (player.stats.inventory || []).find(i => (typeof i === 'string' ? i : i.id) === orbId);
        if (!entry) return 0;
        return typeof entry === 'string' ? 1 : (entry.count || 1);
    }

    buyOrb(element) {
        const player = this.scene.player;
        const orbId = getOrbItemId(element);
        const price = ITEMS[orbId]?.price || 1000;

        if (!player || player.stats.gold < price) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('ゴールドが足りません！', 'error');
            return;
        }

        player.stats.gold -= price;
        player.addItem(orbId);
        player.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${ITEMS[orbId].name} を購入しました！`, 'success');
        }
        if (areEffectsEnabled(this.scene)) this.scene.cameras.main.shake(80, 0.002);
        this.refresh();
    }

    attachElement(slot, element) {
        const player = this.scene.player;
        const itemId = player.stats.equipment[slot];
        if (!itemId) return;

        const orbId = getOrbItemId(element);
        const inventory = player.stats.inventory || [];
        const idx = inventory.findIndex(i => (typeof i === 'string' ? i : i.id) === orbId);
        if (idx === -1) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('その玉を持っていません！', 'error');
            return;
        }

        const entry = inventory[idx];
        if (typeof entry === 'object' && entry.count > 1) {
            entry.count -= 1;
        } else {
            inventory.splice(idx, 1);
        }

        player.stats.itemElements = player.stats.itemElements || {};
        player.stats.itemElements[itemId] = element;
        player.applyEquipmentStats();
        player.saveStats();

        const info = ELEMENT_INFO[element];
        const item = ITEMS[itemId];
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${item.name} に ${info.icon}${info.name}属性を付与した！`, 'success');
        }
        if (areEffectsEnabled(this.scene)) this.scene.cameras.main.shake(120, 0.004);

        this.refresh();
        if (this.scene.equipmentUI?.isOpen) this.scene.equipmentUI.refresh();
    }
}
