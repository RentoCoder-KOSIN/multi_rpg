import { ITEMS } from "../data/items.js";
import BaseWindowUI from "./BaseWindowUI.js";
import { ELEMENTS, ELEMENT_INFO, STRONG_AGAINST, getOrbItemId } from "../data/elements.js";
import { areEffectsEnabled } from "../utils/effectsSettings.js";

/**
 * 鍛冶屋UI。
 *  1) 属性の玉(6種)をゴールドで購入できる
 *  2) 所持している玉を1個消費して、装備中の武器/防具にその属性を付与できる
 *
 * 属性は武器なら敵への相性ダメージ(1.7倍/0.6倍)と一部の状態異常発生率、
 * 防具なら敵の攻撃属性への相性ダメージ軽減/増加に影響する（Player.jsで計算）。
 */
export default class BlacksmithUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '⚒️ 鍛冶屋',
            width: 640,
            height: 560,
            depth: 120000,
            themeColor: 0xff8844,
            titleStroke: 0xff8844,
        });
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
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#ffd700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.container.add(this.goldText);

        this.bodyContainer = this.scene.add.container(0, 0);
        this.container.add(this.bodyContainer);

        this.createHelpButton();
        this.createHelpOverlay();

        this.scene.input.keyboard.on('keydown-B', () => {
            const scene = this.scene;
            if (scene.inventoryUI?.isOpen || scene.shopUI?.isOpen || scene.equipmentUI?.isOpen) return;
            this.toggle();
        });
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        if (this.helpContainer) this.helpContainer.setVisible(false);
        this.refresh();
    }

    // タイトル横の「？」ボタン（属性相性の説明を開く）
    createHelpButton() {
        const x = this.config.width / 2 - 80;
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

    // 属性相性の説明パネル（五角形の相性図 + 一覧 + 倍率）
    createHelpOverlay() {
        const w = this.config.width;
        const h = this.config.height;
        const font = '"Press Start 2P"';
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

        hc.add(this.scene.add.text(0, -h / 2 + 45, '属性の相性', {
            fontSize: '18px', fontFamily: font, color: '#ffffff', stroke: '#ff8844', strokeThickness: 3
        }).setOrigin(0.5));

        // --- 五角形の相性図（矢印は「強い」方向 = 1.7倍） ---
        const cx = -150, cy = -10, R = 105, nodeR = 26;
        const order = ['fire', 'earth', 'wind', 'thunder', 'water']; // 強い順の輪
        const pos = order.map((el, i) => {
            const a = -Math.PI / 2 + (Math.PI * 2 * i) / order.length;
            return { el, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
        });

        const gfx = this.scene.add.graphics();
        hc.add(gfx);
        pos.forEach((from, i) => {
            const to = pos[(i + 1) % pos.length];
            const dx = to.x - from.x, dy = to.y - from.y;
            const len = Math.hypot(dx, dy);
            const ux = dx / len, uy = dy / len;
            const sx = from.x + ux * (nodeR + 3), sy = from.y + uy * (nodeR + 3);
            const ex = to.x - ux * (nodeR + 3), ey = to.y - uy * (nodeR + 3);
            gfx.lineStyle(3, 0xffaa44, 1);
            gfx.lineBetween(sx, sy, ex, ey);
            const px = -uy, py = ux;
            gfx.fillStyle(0xffaa44, 1);
            gfx.fillTriangle(
                ex, ey,
                ex - ux * 12 + px * 7, ey - uy * 12 + py * 7,
                ex - ux * 12 - px * 7, ey - uy * 12 - py * 7
            );
        });

        pos.forEach(({ el, x, y }) => {
            const info = ELEMENT_INFO[el];
            hc.add(this.scene.add.circle(x, y, nodeR, 0x1a1a2e, 1).setStrokeStyle(3, info.color));
            hc.add(this.scene.add.text(x, y - 5, info.icon, { fontSize: '18px' }).setOrigin(0.5));
            hc.add(this.scene.add.text(x, y + 14, info.name, {
                fontSize: '9px', fontFamily: font, color: '#ffffff', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5));
        });

        // 光 ⇔ 闇（互いに強い。五角形の輪とは無関係）
        const pairY = cy + R + 68;
        const lightPos = { x: cx - 48, y: pairY };
        const darkPos = { x: cx + 48, y: pairY };
        gfx.lineStyle(3, 0xffaa44, 1);
        gfx.lineBetween(lightPos.x + nodeR + 3, pairY, darkPos.x - nodeR - 3, pairY);
        gfx.fillStyle(0xffaa44, 1);
        gfx.fillTriangle(darkPos.x - nodeR - 3, pairY, darkPos.x - nodeR - 15, pairY - 7, darkPos.x - nodeR - 15, pairY + 7);
        gfx.fillTriangle(lightPos.x + nodeR + 3, pairY, lightPos.x + nodeR + 15, pairY - 7, lightPos.x + nodeR + 15, pairY + 7);
        [['light', lightPos], ['dark', darkPos]].forEach(([el, { x, y }]) => {
            const info = ELEMENT_INFO[el];
            hc.add(this.scene.add.circle(x, y, nodeR, 0x1a1a2e, 1).setStrokeStyle(3, info.color));
            hc.add(this.scene.add.text(x, y - 5, info.icon, { fontSize: '18px' }).setOrigin(0.5));
            hc.add(this.scene.add.text(x, y + 14, info.name, {
                fontSize: '9px', fontFamily: font, color: '#ffffff', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5));
        });

        hc.add(this.scene.add.text(cx, cy, '矢印は\n「強い」向き', {
            fontSize: '9px', fontFamily: font, color: '#ffaa44', align: 'center', lineSpacing: 6
        }).setOrigin(0.5));

        // --- 属性ごとの強み・弱み一覧 ---
        const weakOf = {};
        Object.entries(STRONG_AGAINST).forEach(([atk, def]) => { weakOf[def] = atk; });

        const lx = 5;
        let ly = -h / 2 + 100;
        ELEMENTS.forEach((el) => {
            const info = ELEMENT_INFO[el];
            const strong = ELEMENT_INFO[STRONG_AGAINST[el]];
            const weak = ELEMENT_INFO[weakOf[el]];
            hc.add(this.scene.add.text(lx, ly, `${info.icon} ${info.name}`, {
                fontSize: '13px', fontFamily: font, color: '#' + info.color.toString(16).padStart(6, '0'),
                stroke: '#000', strokeThickness: 2
            }).setOrigin(0, 0.5));
            hc.add(this.scene.add.text(lx + 85, ly, `強い:${strong.icon}${strong.name}`, {
                fontSize: '11px', fontFamily: font, color: '#ffaa44'
            }).setOrigin(0, 0.5));
            if (STRONG_AGAINST[STRONG_AGAINST[el]] === el) {
                // 光⇔闇のように互いに強い関係（弱点なし）
                hc.add(this.scene.add.text(lx + 85 + 120, ly, '(お互い)', {
                    fontSize: '11px', fontFamily: font, color: '#88aacc'
                }).setOrigin(0, 0.5));
            } else {
                hc.add(this.scene.add.text(lx + 85 + 120, ly, `弱い:${weak.icon}${weak.name}`, {
                    fontSize: '11px', fontFamily: font, color: '#88aacc'
                }).setOrigin(0, 0.5));
            }
            ly += 36;
        });

        // --- 倍率 ---
        ly += 8;
        hc.add(this.scene.add.text(lx, ly, '強い相手へ 1.7倍 / 普通 1.0倍 / 弱い相手へ 0.6倍', {
            fontSize: '10px', fontFamily: font, color: '#ffffff'
        }).setOrigin(0, 0.5));
        hc.add(this.scene.add.text(lx, ly + 22, '（武器=与ダメージ / 防具=被ダメージに適用）', {
            fontSize: '9px', fontFamily: font, color: '#8899aa'
        }).setOrigin(0, 0.5));

        // --- 状態異常のヒント ---
        hc.add(this.scene.add.text(0, h / 2 - 60, '武器に付与すると状態異常が出やすくなる', {
            fontSize: '10px', fontFamily: font, color: '#ffffff'
        }).setOrigin(0.5));
        hc.add(this.scene.add.text(0, h / 2 - 38, '💧水=凍結   ⚡雷=麻痺   🪨土=毒', {
            fontSize: '11px', fontFamily: font, color: '#ffdd88'
        }).setOrigin(0.5));

        // --- とじるボタン ---
        const close = this.scene.add.text(w / 2 - 40, -h / 2 + 40, '✕', {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        close.on('pointerdown', (p, lx2, ly2, event) => {
            if (event) event.stopPropagation();
            hc.setVisible(false);
        });
        close.on('pointerover', () => close.setColor('#ff4b2b'));
        close.on('pointerout', () => close.setColor('#ffffff'));
        hc.add(close);

        this.container.add(hc);
    }

    updateGold() {
        if (this.scene.player && this.goldText) {
            this.goldText.setText(`🪙 ${this.scene.player.stats.gold}`);
        }
    }

    getOwnedOrbCount(element) {
        const orbId = getOrbItemId(element);
        const player = this.scene.player;
        if (!player) return 0;
        const entry = (player.stats.inventory || []).find(i => (typeof i === 'string' ? i : i.id) === orbId);
        if (!entry) return 0;
        return typeof entry === 'string' ? 1 : (entry.count || 1);
    }

    refresh() {
        if (!this.bodyContainer) return;
        this.bodyContainer.removeAll(true);
        this.updateGold();

        const player = this.scene.player;
        if (!player) return;

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // --- セクション1: 玉を購入 ---
        const buyTitle = this.scene.add.text(-panelWidth / 2 + 30, -panelHeight / 2 + 100, '🔮 属性の玉を購入', {
            fontSize: '13px', fontFamily: '"Press Start 2P"', color: '#ff8844'
        }).setOrigin(0, 0.5);
        this.bodyContainer.add(buyTitle);

        const orbBoxW = 190;
        const orbBoxH = 64;
        const cols = 3;
        const startX = -panelWidth / 2 + 30 + orbBoxW / 2;
        const startY = -panelHeight / 2 + 140;

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

            const name = this.scene.add.text(-orbBoxW / 2 + 45, -14, `${info.name}の玉`, {
                fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#ffffff'
            }).setOrigin(0, 0.5);
            box.add(name);

            const owned = this.getOwnedOrbCount(element);
            const priceText = this.scene.add.text(-orbBoxW / 2 + 45, 10, `${orbItem.price}G (所持:${owned})`, {
                fontSize: '8px', fontFamily: '"Press Start 2P"', color: '#aaddff'
            }).setOrigin(0, 0.5);
            box.add(priceText);

            box.setSize(orbBoxW, orbBoxH);
            box.setInteractive({ useHandCursor: true });
            box.on('pointerdown', (p, lx, ly, event) => {
                if (event) event.stopPropagation();
                this.buyOrb(element);
            });
            box.on('pointerover', () => bg.lineStyle(3, 0xffffff, 1));

            this.bodyContainer.add(box);
        });

        // --- セクション2: 属性を付与 ---
        const craftY = startY + Math.ceil(ELEMENTS.length / cols) * (orbBoxH + 10) + 20;
        const craftTitle = this.scene.add.text(-panelWidth / 2 + 30, craftY, '⚒ 装備に属性を付与する', {
            fontSize: '13px', fontFamily: '"Press Start 2P"', color: '#ff8844'
        }).setOrigin(0, 0.5);
        this.bodyContainer.add(craftTitle);

        this.buildEquipRow('weapon', 'WEAPON', craftY + 45);
        this.buildEquipRow('armor', 'ARMOR', craftY + 130);
    }

    buildEquipRow(slot, label, y) {
        const panelWidth = this.config.width;
        const player = this.scene.player;
        const itemId = player.stats.equipment[slot];
        const item = itemId ? ITEMS[itemId] : null;
        const currentElement = itemId ? (player.stats.itemElements?.[itemId] || null) : null;

        const rowBg = this.scene.add.graphics();
        rowBg.fillStyle(0x000000, 0.3);
        rowBg.fillRoundedRect(-panelWidth / 2 + 20, y - 34, panelWidth - 40, 68, 10);
        this.bodyContainer.add(rowBg);

        const labelTxt = this.scene.add.text(-panelWidth / 2 + 35, y - 18, label, {
            fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#8899aa'
        }).setOrigin(0, 0.5);
        this.bodyContainer.add(labelTxt);

        const itemName = item ? item.name : '--- 未装備 ---';
        const elLabel = currentElement ? ` [${ELEMENT_INFO[currentElement].icon}${ELEMENT_INFO[currentElement].name}]` : '';
        const nameTxt = this.scene.add.text(-panelWidth / 2 + 35, y + 4, `${itemName}${elLabel}`, {
            fontSize: '11px', fontFamily: '"Press Start 2P"', color: item ? '#ffffff' : '#666666'
        }).setOrigin(0, 0.5);
        this.bodyContainer.add(nameTxt);

        if (!item) return;

        // 所持している玉のアイコンだけをボタンとして並べる（右側）
        let bx = panelWidth / 2 - 45;
        ELEMENTS.slice().reverse().forEach((element) => {
            const owned = this.getOwnedOrbCount(element);
            if (owned <= 0) return;
            const info = ELEMENT_INFO[element];

            const btn = this.scene.add.container(bx, y);
            const btnBg = this.scene.add.circle(0, 0, 18, 0x1a1a2e, 0.9).setStrokeStyle(2, info.color);
            const btnIcon = this.scene.add.text(0, 0, info.icon, { fontSize: '16px' }).setOrigin(0.5);
            btn.add([btnBg, btnIcon]);
            btn.setSize(40, 40);
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', (p, lx, ly, event) => {
                if (event) event.stopPropagation();
                this.attachElement(slot, element);
            });
            btn.on('pointerover', () => btnBg.setStrokeStyle(3, 0xffffff));
            btn.on('pointerout', () => btnBg.setStrokeStyle(2, info.color));

            this.bodyContainer.add(btn);
            bx -= 44;
        });
    }

    buyOrb(element) {
        const player = this.scene.player;
        const orbId = getOrbItemId(element);
        const price = ITEMS[orbId].price;

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

        // 玉を1個消費
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
