import { UI_FONT } from '../fontConfig.js';
import { ITEMS } from "../data/items.js";
import BaseWindowUI from "./BaseWindowUI.js";
import { ELEMENT_INFO } from "../data/elements.js";

// weaponClass ごとのアイコンマッピング
const WEAPON_CLASS_ICONS = {
    dagger: '🗡️',
    oneHandSword: '⚔️',
    twoHandSword: '🗡️',
    dualSword: '🗡️',
    katana: '⚔️',
    axe: '🪓',
    bow: '🏹',
    staff: '🪄',
    spear: '🔱',
    // デフォルト武器
    default: '⚔️'
};

// アイテムの type ごとのアイコンマッピング
const ITEM_TYPE_ICONS = {
    weapon: '⚔️',
    armor: '🛡️',
    helmet: '⛑️',
    gloves: '🧤',
    boots: '👢',
    accessory: '💍',
    relic: '💎',
    consumable: '🧪',
    material: '📦',
    default: '📦'
};

/**
 * アイテムに対応するアイコン絵文字を返す。
 * weaponClass が設定されていればそれを優先し、なければ type で決定する。
 * @param {object|null} item
 * @returns {string} 絵文字
 */
function getItemIcon(item) {
    if (!item) return '📦';
    if (item.weaponClass && WEAPON_CLASS_ICONS[item.weaponClass]) {
        return WEAPON_CLASS_ICONS[item.weaponClass];
    }
    return ITEM_TYPE_ICONS[item.type] || '📦';
}

export default class EquipmentUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🛡️ EQUIPMENT',
            width: 400,
            height: 430, // 宝具(RELIC)スロット追加分だけ高さを拡張
            fullScreen: true,
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
        this.createSlot(0, -90, 'WEAPON', equipment.weapon, 'weapon');
        this.createSlot(0, 0, 'ARMOR', equipment.armor, 'armor');
        this.createSlot(0, 90, 'RELIC', equipment.relic, 'relic');

        const hint = this.scene.add.text(0, 130, '⚒ 街の鍛冶屋で武器/防具に属性を付与できる', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        this.slotContainer.add(hint);

        // ステータス表示
        const statsText = `ATK: ${player.stats.atk}  DEF: ${player.stats.def}`;
        const statsDisplay = this.scene.add.text(0, 155, statsText, {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffd700'
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
        if (s.multiHit && s.multiHit > 1) parts.push(`${s.multiHit}連撃`);
        if (s.attackSpeed) parts.push(`攻速×${s.attackSpeed}`);
        if (s.critChance) parts.push(`会心+${Math.round(s.critChance * 100)}%`);
        if (s.speedBonus) parts.push(`速度+${s.speedBonus}`);
        if (s.lifesteal) parts.push(`吸収${Math.round(s.lifesteal * 100)}%`);
        if (s.expMultiplier) parts.push(`EXP×${s.expMultiplier}`);
        // スロットが狭いので最大2項目まで
        return parts.slice(0, 2).join(' ');
    }

    createSlot(x, y, label, itemId, slotType = label.toLowerCase()) {
        const slot = this.scene.add.container(x, y);

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x1a1a2e, 0.6);
        bg.fillRoundedRect(-160, -35, 320, 70, 8);
        bg.lineStyle(2, 0x4a90e2, 0.5);
        bg.strokeRoundedRect(-160, -35, 320, 70, 8);
        slot.add(bg);

        const labelTxt = this.scene.add.text(-145, -20, label, {
            fontSize: '11px', fontFamily: UI_FONT, color: '#4a90e2'
        });
        slot.add(labelTxt);

        const item = ITEMS[itemId];
        const player = this.scene.player;
        const enhLv = player?.getEnhanceLevel ? player.getEnhanceLevel(slotType) : (player?.stats?.enhanceLevels?.[slotType] || 0);
        const enhTag = (item && enhLv > 0) ? ` +${enhLv}` : '';
        const itemName = item ? `${item.name}${enhTag}` : '--- なし ---';
        const itemColor = item ? (enhLv >= 15 ? '#ff44ff' : (enhLv >= 10 ? '#ffd700' : '#ffffff')) : '#666666';

        // アイテムアイコン（weaponClass 優先）
        const iconEmoji = getItemIcon(item);
        const iconTxt = this.scene.add.text(-155, 5, iconEmoji, { fontSize: '20px' }).setOrigin(0, 0.5);
        slot.add(iconTxt);

        const attachedElement = item ? this.scene.player?.stats?.itemElements?.[itemId] : null;
        const elementTag = attachedElement ? ` ${ELEMENT_INFO[attachedElement].icon}` : '';

        const weaponClassLabels = { dagger: '短刀', oneHandSword: '片手剣', twoHandSword: '両手剣', spear: '槍', staff: '杖', wand: 'ワンド', tome: '魔導書', bow: '弓', mace: 'メイス' };
        const classTag = item?.weaponClass ? ` [${weaponClassLabels[item.weaponClass] || item.weaponClass}]` : '';
        // アイコン分だけ名前テキストを右にずらす（-130 → アイコン幅 ~25px 分）
        const nameTxt = this.scene.add.text(-125, 4, `${itemName}${classTag}${elementTag}`, {
            fontSize: '14px', fontFamily: UI_FONT, color: itemColor,
            wordWrap: { width: 210 }, maxLines: 2
        });
        slot.add(nameTxt);

        if (item) {
            const power = this.scene.player?.getEquipmentPowerMultiplier?.(item) ?? 1;
            const powerTag = power < 1 ? ` ${Math.round(power * 100)}%` : '';
            const statTxt = this.scene.add.text(-125, 25, `${this.summarizeStats(item)}${powerTag}`, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#00ff00',
                wordWrap: { width: 205 }, maxLines: 1
            });
            slot.add(statTxt);

            // 装備品の直接改名ボタン
            const renameBtn = this.scene.add.text(145, -20, '✏️改名', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#88ffff', style: 'bold'
            }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
            renameBtn.on('pointerdown', (p, lx, ly, e) => {
                if (e) e.stopPropagation();
                const newName = prompt(`「${item.name}」の新しい名前を入力してください:`, item.name);
                if (newName !== null && newName.trim()) {
                    const trimmed = newName.trim();
                    item.name = trimmed;
                    if (ITEMS[itemId]) ITEMS[itemId].name = trimmed;
                    if (player.stats.customItems && player.stats.customItems[itemId]) {
                        player.stats.customItems[itemId].name = trimmed;
                    }
                    player.saveStats();
                    this.scene.notificationUI?.show(`✨ 「${trimmed}」に改名しました！`, 'success');
                    this.refresh();
                }
            });
            slot.add(renameBtn);
        }

        this.slotContainer.add(slot);
    }
}
