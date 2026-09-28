import { ITEMS } from "../data/items.js";
import BaseWindowUI from "./BaseWindowUI.js";
import { ELEMENT_INFO } from "../data/elements.js";

export default class EquipmentUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🛡️ EQUIPMENT',
            width: 400,
            height: 430, // 宝具(RELIC)スロット追加分だけ高さを拡張
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
            if (this.scene.inventoryUI?.isOpen || this.scene.shopUI?.isOpen || this.scene.blacksmithUI?.isOpen) return;
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
        this.createSlot(0, -90, 'WEAPON', equipment.weapon);
        this.createSlot(0, 0, 'ARMOR', equipment.armor);
        this.createSlot(0, 90, 'RELIC', equipment.relic);

        const hint = this.scene.add.text(0, 130, '⚒ 街の鍛冶屋で武器/防具に属性を付与できる', {
            fontSize: '8px', fontFamily: '"Press Start 2P"', color: '#888888'
        }).setOrigin(0.5);
        this.slotContainer.add(hint);

        // ステータス表示
        const statsText = `ATK: ${player.stats.atk}  DEF: ${player.stats.def}`;
        const statsDisplay = this.scene.add.text(0, 155, statsText, {
            fontSize: '12px', fontFamily: '"Press Start 2P"', color: '#ffd700'
        }).setOrigin(0.5);
        this.slotContainer.add(statsDisplay);
    }

    // 装備スロットの右側に出す短いステータス要約。
    // 武器/防具は ATK/DEF が中心だが、宝具(accessory)は会心率・速度・吸収など
    // ATK/DEFを持たないことも多いため、値が入っている項目を優先順に拾って表示する。
    summarizeStats(item) {
        const s = item.stats || {};
        const atk = item.atk ?? s.attack;
        const def = item.def ?? s.defense;
        const parts = [];
        if (atk) parts.push(`ATK+${atk}`);
        if (def) parts.push(`DEF+${def}`);
        if (s.critChance) parts.push(`会心+${Math.round(s.critChance * 100)}%`);
        if (s.speedBonus) parts.push(`速度+${s.speedBonus}`);
        if (s.lifesteal) parts.push(`吸収${Math.round(s.lifesteal * 100)}%`);
        if (s.expMultiplier) parts.push(`EXP×${s.expMultiplier}`);
        // スロットが狭いので最大2項目まで
        return parts.slice(0, 2).join(' ');
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

        const attachedElement = item ? this.scene.player?.stats?.itemElements?.[itemId] : null;
        const elementTag = attachedElement ? ` ${ELEMENT_INFO[attachedElement].icon}` : '';

        const nameTxt = this.scene.add.text(-145, 5, `${itemName}${elementTag}`, {
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: itemColor
        });
        slot.add(nameTxt);

        if (item) {
            const statTxt = this.scene.add.text(145, 5, this.summarizeStats(item), {
                fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#00ff00'
            }).setOrigin(1, 0);
            slot.add(statTxt);
        }

        this.slotContainer.add(slot);
    }
}
