import { ITEMS } from "../data/items.js";
import BaseWindowUI from "./BaseWindowUI.js";

export default class InventoryUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🎒 INVENTORY',
            width: 620,
            height: 480,
            depth: 110000,
            titleStroke: 0xe94560
        });

        this.selectedIndex = 0;
        this.inventory = [];
        this.slots = [];

        // 追加のセットアップは createWindow 内で行う
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // 下部詳細パネル (個別要素)
        const detailBg = this.scene.add.graphics();
        detailBg.fillStyle(0x000000, 0.4);
        detailBg.fillRoundedRect(-panelWidth / 2 + 20, panelHeight / 2 - 85, panelWidth - 40, 70, 10);
        this.container.add(detailBg);

        this.detailText = this.scene.add.text(0, panelHeight / 2 - 50, '十字キーで選択、Enterで装備/使用\nDeleteで捨てる', {
            fontSize: '11px', fontFamily: '"Press Start 2P"', color: '#e0e0e0',
            wordWrap: { width: panelWidth - 60 }, align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.detailText);

        // ゴミ箱ボタン
        this.trashBtn = this.scene.add.text(panelWidth / 2 - 40, panelHeight / 2 - 25, '🗑️', { fontSize: '24px' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        this.trashBtn.on('pointerdown', (e) => {
            if (e) e.stopPropagation();
            this.handleItemDiscard();
        });
        this.container.add(this.trashBtn);

        // マスクエリア
        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        const maskShape = this.scene.add.graphics();
        maskShape.setScrollFactor(0);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(sceneWidth / 2 - panelWidth / 2 + 20, sceneHeight / 2 - 165, panelWidth - 40, 310);
        maskShape.setVisible(false);
        const mask = maskShape.createGeometryMask();

        this.listContainer = this.scene.add.container(0, 0);
        this.listContainer.setMask(mask);
        this.container.add(this.listContainer);

        // キーボード登録 (BaseWindowUI の Esc 以外)
        this.scene.input.keyboard.on('keydown', (event) => {
            // Iキーは常に（閉じている時でも）反応するように
            if (event.code === 'KeyI') {
                if (!this.scene.shopUI?.isOpen) {
                    this.toggle();
                }
                return;
            }

            if (!this.isOpen || (this.scene.shopUI && this.scene.shopUI.isOpen)) return;

            const itemsPerRow = 5;
            if (event.code === 'ArrowRight') {
                this.selectedIndex = Math.min(this.inventory.length - 1, this.selectedIndex + 1);
            } else if (event.code === 'ArrowLeft') {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            } else if (event.code === 'ArrowDown') {
                if (this.selectedIndex + itemsPerRow < this.inventory.length) this.selectedIndex += itemsPerRow;
                else if (this.inventory.length > 0) this.selectedIndex = this.inventory.length - 1;
            } else if (event.code === 'ArrowUp') {
                if (this.selectedIndex - itemsPerRow >= 0) this.selectedIndex -= itemsPerRow;
            } else if (event.code === 'Enter') {
                const itemId = this.inventory[this.selectedIndex];
                if (itemId) this.handleItemClick(itemId);
            } else if (event.code === 'Delete' || event.code === 'Backspace') {
                this.handleItemDiscard();
            }
            this.updateSelection();
        });
    }

    open() {
        super.open();
        this.selectedIndex = 0;
        this.refreshList();
    }

    refreshList() {
        this.listContainer.removeAll(true);
        this.slots = [];
        if (!this.scene.player) return;

        this.inventory = this.scene.player.stats.inventory || [];
        const itemsPerRow = 5;
        const slotSize = 110;
        const startY = -110;

        if (this.inventory.length === 0) {
            const emptyText = this.scene.add.text(0, 0, 'アイテムがありません', {
                fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#666666'
            }).setOrigin(0.5);
            this.listContainer.add(emptyText);
            return;
        }

        this.inventory.forEach((itemId, index) => {
            const item = ITEMS[itemId];
            if (!item) return;

            const x = (index % itemsPerRow - (itemsPerRow / 2 - 0.5)) * slotSize;
            const y = startY + (Math.floor(index / itemsPerRow)) * slotSize;

            const slot = this.scene.add.container(x, y);

            // スロット背景
            const slotBg = this.scene.add.graphics();
            this.drawSlot(slotBg, 0x0f3460, 0.4, 0x533483, 0.3);

            // アイコン
            const itemIcon = this.scene.add.text(0, -10, this.getItemEmoji(item), { fontSize: '30px' }).setOrigin(0.5);

            // 名前
            const nameText = this.scene.add.text(0, 25, item.name.substring(0, 6), {
                fontSize: '9px', fontFamily: '"Press Start 2P"', color: '#ffffff'
            }).setOrigin(0.5);

            slot.add([slotBg, itemIcon, nameText]);
            this.listContainer.add(slot);

            // インタラクティブ化 (タップ対応)
            slot.setSize(96, 96);
            slot.setInteractive({ useHandCursor: true });
            slot.on('pointerdown', (p, x, y, event) => {
                if (event) event.stopPropagation();
                this.selectedIndex = index;
                this.updateSelection();
                this.handleItemClick(itemId);
            });

            this.slots.push({ bg: slotBg, item: item, container: slot });
        });
        this.updateSelection();
    }

    drawSlot(gfx, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(-48, -48, 96, 96, 12);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(-48, -48, 96, 96, 12);
    }

    getItemEmoji(item) {
        if (item.type === 'weapon') return '⚔️';
        if (item.type === 'armor') return '🛡️';
        if (item.id.includes('potion')) return '🧪';
        return '📦';
    }

    updateSelection() {
        if (this.slots.length === 0) return;

        this.slots.forEach((slot, index) => {
            const isEquipped = this.scene.player.stats.equipment.weapon === slot.item.id ||
                this.scene.player.stats.equipment.armor === slot.item.id;

            if (index === this.selectedIndex) {
                this.drawSlot(slot.bg, 0xe94560, 0.4, 0xffffff, 1);
                if (this.detailText) {
                    const typeStr = slot.item.type === 'weapon' ? '[武器]' : (slot.item.type === 'armor' ? '[防具]' : '[消耗品]');
                    let reqText = '';
                    if (slot.item.lvlReq) {
                        const isOk = this.scene.player.stats.level >= slot.item.lvlReq;
                        reqText = `\n必要Lv: ${slot.item.lvlReq} ${isOk ? '✔' : '❌'}`;
                    }
                    this.detailText.setText(`${typeStr} ${slot.item.name}${reqText}\n${slot.item.description}`);

                }
                // スクロール追従
                const targetY = -(Math.max(0, Math.floor(index / 5) - 1)) * 110;
                this.listContainer.y = targetY;
                slot.container.setScale(1.1);
            } else {
                this.drawSlot(slot.bg, 0x0f3460, 0.4, isEquipped ? 0x00ff00 : 0x533483, isEquipped ? 1 : 0.3);
                slot.container.setScale(1);
            }
        });
    }

    handleItemClick(itemId) {
        const item = ITEMS[itemId];
        if (!item || !this.scene.player) return;

        if (item.type === 'weapon' || item.type === 'armor') {
            this.scene.player.equipItem(itemId);
        } else {
            this.useItem(itemId);
        }
        this.refreshList();
    }

    useItem(itemId) {
        const item = ITEMS[itemId];
        const player = this.scene.player;
        if (!item || !player) return;

        const heal = item.heal || item.stats?.heal || 0;
        if (heal > 0) {
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`HPが ${heal} 回復した！`, "success");
        }

        const healMp = item.healMp || item.stats?.healMp || 0;
        if (healMp > 0) {
            player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + healMp);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`MPが ${healMp} 回復した！`, "success");
        }

        const idx = player.stats.inventory.indexOf(itemId);
        if (idx > -1) player.stats.inventory.splice(idx, 1);
        player.saveStats();
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
    }

    handleItemDiscard() {
        const itemId = this.inventory[this.selectedIndex];
        if (!itemId || !this.scene.player) return;

        const item = ITEMS[itemId];
        // 装備中のアイテムは捨てられないようにする
        if (this.scene.player.stats.equipment.weapon === itemId || this.scene.player.stats.equipment.armor === itemId) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('装備中のアイテムは捨てられません', 'error');
            return;
        }

        const confirmDiscard = confirm(`${item.name} を捨てますか？`);
        if (confirmDiscard) {
            const idx = this.scene.player.stats.inventory.indexOf(itemId);
            if (idx > -1) {
                this.scene.player.stats.inventory.splice(idx, 1);
                this.scene.player.saveStats();
                if (this.scene.notificationUI) this.scene.notificationUI.show(`${item.name} を捨てました`, 'info');
                this.refreshList();

                // 選択インデックス調整
                if (this.selectedIndex >= this.scene.player.stats.inventory.length) {
                    this.selectedIndex = Math.max(0, this.scene.player.stats.inventory.length - 1);
                }
                this.updateSelection();
            }
        }
    }
}
