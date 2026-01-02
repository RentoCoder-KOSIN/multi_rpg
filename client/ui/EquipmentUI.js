import { ITEMS } from "../data/items.js";
import BaseWindowUI from "./BaseWindowUI.js";

export default class EquipmentUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🛡️ EQUIPMENT',
            width: 400,
            height: 350,
            depth: 115000,
            themeColor: 0x4a90e2
        });
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        // スロット表示エリア
        this.slotContainer = this.scene.add.container(0, 20);
        this.container.add(this.slotContainer);

        // キーボード操作 (Sキー)
        this.scene.input.keyboard.on('keydown-S', () => {
            if (this.scene.inventoryUI?.isOpen || this.scene.shopUI?.isOpen) return;
            this.toggle();
        });
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this.refresh();
    }

    refresh() {
        if (!this.slotContainer) return;
        this.slotContainer.removeAll(true);

        const player = this.scene.player;
        if (!player) return;

        const equipment = player.stats.equipment;
        this.createSlot(0, -60, 'WEAPON', equipment.weapon);
        this.createSlot(0, 60, 'ARMOR', equipment.armor);

        // ステータス表示
        const statsText = `ATK: ${player.stats.atk}  DEF: ${player.stats.def}`;
        const statsDisplay = this.scene.add.text(0, 130, statsText, {
            fontSize: '12px', fontFamily: '"Press Start 2P"', color: '#ffd700'
        }).setOrigin(0.5);
        this.slotContainer.add(statsDisplay);
    }

    createSlot(x, y, label, itemId) {
        const slot = this.scene.add.container(x, y);

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1a1a2e, 0.6);
        bg.fillRoundedRect(-160, -35, 320, 70, 8);
        bg.lineStyle(2, 0x4a90e2, 0.5);
        bg.strokeRoundedRect(-160, -35, 320, 70, 8);
        slot.add(bg);

        const labelTxt = this.scene.add.text(-145, -20, label, {
            fontSize: '9px', fontFamily: '"Press Start 2P"', color: '#4a90e2'
        });
        slot.add(labelTxt);

        const item = ITEMS[itemId];
        const itemName = item ? item.name : '--- なし ---';
        const itemColor = item ? '#ffffff' : '#666666';

        const nameTxt = this.scene.add.text(-145, 5, itemName, {
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: itemColor
        });
        slot.add(nameTxt);

        if (item) {
            const stats = item.atk ? `ATK+${item.atk}` : (item.stats?.attack ? `ATK+${item.stats.attack}` : '');
            const defStats = item.def ? `DEF+${item.def}` : (item.stats?.defense ? `DEF+${item.stats.defense}` : '');
            const statTxt = this.scene.add.text(145, 5, stats || defStats, {
                fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#00ff00'
            }).setOrigin(1, 0);
            slot.add(statTxt);
        }

        this.slotContainer.add(slot);
    }
}
