import { ITEMS } from "../data/items.js";
import { getShopLoadout, resolveShopItems } from "../data/shops.js";
import BaseWindowUI from "./BaseWindowUI.js";

export default class ShopUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🏪 SHOP',
            width: 600,
            height: 480,
            depth: 100000,
            themeColor: 0x4a90e2
        });

        this.selectedIndex = 0;
        this.items = [];
        this.itemBoxes = [];
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // ゴールド表示 (個別要素)
        const goldPanel = this.scene.add.graphics();
        goldPanel.fillStyle(0x000000, 0.4);
        goldPanel.fillRoundedRect(-panelWidth / 2 + 20, panelHeight / 2 - 45, 180, 30, 8);
        this.container.add(goldPanel);

        this.goldText = this.scene.add.text(-panelWidth / 2 + 30, panelHeight / 2 - 30, '🪙 0', {
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#ffd700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.container.add(this.goldText);

        // 説明文パネル
        const descPanel = this.scene.add.graphics();
        descPanel.fillStyle(0x000000, 0.3);
        descPanel.fillRoundedRect(-panelWidth / 2 + 20, panelHeight / 2 - 105, panelWidth - 40, 50, 8);
        this.container.add(descPanel);

        this.descText = this.scene.add.text(0, panelHeight / 2 - 80, '上下キーで選択、Enterで購入', {
            fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#aaaaaa',
            wordWrap: { width: panelWidth - 60 }, align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.descText);

        // マスクエリア
        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        const maskShape = this.scene.add.graphics();
        maskShape.setScrollFactor(0);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(sceneWidth / 2 - panelWidth / 2 + 20, sceneHeight / 2 - 165, panelWidth - 40, 290);
        maskShape.setVisible(false);
        const mask = maskShape.createGeometryMask();

        this.itemListContainer = this.scene.add.container(0, 0);
        this.itemListContainer.setMask(mask);
        this.container.add(this.itemListContainer);

        // キーボード登録
        this.scene.input.keyboard.on('keydown', (event) => {
            if (!this.isOpen || (this.scene.inventoryUI && this.scene.inventoryUI.isOpen)) return;

            if (event.code === 'ArrowDown') {
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
                this.updateSelection();
            } else if (event.code === 'ArrowUp') {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.updateSelection();
            } else if (event.code === 'Enter') {
                const item = this.items[this.selectedIndex];
                if (item) this.buyItem(item.id, item.price);
            }
        });
    }

    open(shopId, category = null) {
        if (!this.container) this.createUI();
        super.open();

        this.selectedIndex = 0;
        this.itemListContainer.y = 0;

        const loadout = getShopLoadout(shopId);
        // BaseWindowUIのタイトルを更新可能にするか、ここで直接弄る
        const titleText = this.container.list.find(obj => obj instanceof Phaser.GameObjects.Text && obj.y < -this.config.height / 2 + 50);
        if (titleText) titleText.setText(`🏪 ${loadout.title}`);

        this.refreshItemList(shopId, category);
        this.updateGold();
        this.updateSelection();
    }

    updateGold() {
        if (this.scene.player && this.goldText) {
            this.goldText.setText(`🪙 ${this.scene.player.stats.gold}`);
        }
    }

    refreshItemList(shopId, category = null) {
        this.itemListContainer.removeAll(true);
        this.itemBoxes = [];
        const loadout = getShopLoadout(shopId);
        this.items = resolveShopItems(loadout.items, category);

        const startY = -120;
        const spacing = 70;

        this.items.forEach((item, index) => {
            const y = startY + (index * spacing);
            const box = this.scene.add.container(0, y);

            const boxBg = this.scene.add.graphics();
            this.drawItemBox(boxBg, 540, 60, 0x0f3460, 0.5, 0x4a90e2, 0.3);
            box.add(boxBg);

            const name = this.scene.add.text(-250, 0, item.name, {
                fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#ffffff'
            }).setOrigin(0, 0.5);
            box.add(name);

            const price = this.scene.add.text(180, 0, `${item.price} G`, {
                fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#ffd700'
            }).setOrigin(1, 0.5);
            box.add(price);

            const buyHint = this.scene.add.text(230, 0, 'BUY', {
                fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#ffffff'
            }).setOrigin(0.5);
            box.add(buyHint);

            this.itemListContainer.add(box);

            // インタラクティブ化 (タップ対応)
            box.setSize(540, 60);
            box.setInteractive({ useHandCursor: true });
            box.on('pointerdown', () => {
                this.selectedIndex = index;
                this.updateSelection();
                this.buyItem(item.id, item.price);
            });

            this.itemBoxes.push({ bgGfx: boxBg, item: item, container: box });
        });
    }

    drawItemBox(gfx, width, height, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    }

    updateSelection() {
        this.itemBoxes.forEach((box, index) => {
            if (index === this.selectedIndex) {
                this.drawItemBox(box.bgGfx, 540, 60, 0x4a90e2, 0.4, 0xffffff, 1);
                if (this.descText) {
                    let desc = box.item.description || '説明なし';
                    if (box.item.lvlReq) {
                        const isOk = this.scene.player.stats.level >= box.item.lvlReq;
                        desc = `【必要Lv.${box.item.lvlReq} ${isOk ? '✔' : '❌'}】 ${desc}`;
                    }
                    this.descText.setText(desc);
                }
                const targetY = -(Math.max(0, index - 1) * 70);
                this.scene.tweens.add({
                    targets: this.itemListContainer,
                    y: targetY, duration: 150, ease: 'Power2'
                });
                box.container.setScale(1.02);
            } else {
                this.drawItemBox(box.bgGfx, 540, 60, 0x0f3460, 0.5, 0x4a90e2, 0.3);
                box.container.setScale(1);
            }
        });
    }

    buyItem(itemId, price) {
        const p = this.scene.player;
        if (!p || p.stats.gold < price) {
            if (this.scene.notificationUI) this.scene.notificationUI.show("ゴールドが足りません！", "error");
            return;
        }
        p.stats.gold -= price;
        p.addItem(itemId);
        p.saveStats();
        this.updateGold();
        if (this.scene.notificationUI) this.scene.notificationUI.show(`[${ITEMS[itemId].name}] を購入しました！`, "success");
        this.scene.cameras.main.shake(100, 0.002);
    }
}
