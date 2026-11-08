import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from './BaseWindowUI.js';
import { ITEMS } from '../data/items.js';
import { entryId, entryCount, removeFromInventory, totalOwned } from '../utils/inventoryOps.js';

const PRIZES = [
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
const RARITY_COLOR = { C: '#c9d1d9', R: '#58a6ff', SR: '#c678ff', SSR: '#ffd166', UR: '#ff5ea8' };

function pickPrize() {
    const total = PRIZES.reduce((n, p) => n + p.weight, 0);
    let roll = Math.random() * total;
    return PRIZES.find(p => (roll -= p.weight) <= 0) || PRIZES[0];
}

export default class GachaUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, { title: '💎 MAGIC STONE GACHA', width: 560, height: 410, depth: 125000, themeColor: 0x9b59ff });
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this.stoneText = this.scene.add.text(0, -125, '', { fontSize: '15px', fontFamily: UI_FONT, color: '#7ee7ff' }).setOrigin(0.5);
        this.resultText = this.scene.add.text(0, -5, '魔石を使って限定装備を手に入れよう', { fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff', align: 'center', wordWrap: { width: 460 } }).setOrigin(0.5);
        this.hint = this.scene.add.text(0, 125, '職業別限定武器・UR装備が手に入るかも！', { fontSize: '11px', fontFamily: UI_FONT, color: '#9da7b3' }).setOrigin(0.5);
        this.container.add([this.stoneText, this.resultText, this.hint]);
        this.createDrawButton(-115, '1回\n魔石 x1', 1);
        this.createDrawButton(115, '10回\n魔石 x10', 10);
        this.scene.input.keyboard.on('keydown-G', () => { if (!this.scene.shopUI?.isOpen && !this.scene.inventoryUI?.isOpen) this.toggle(); });
    }

    createDrawButton(x, label, count) {
        const bg = this.scene.add.rectangle(x, 75, 190, 75, 0x522b7a, 0.95).setStrokeStyle(2, 0xd8b4fe).setInteractive({ useHandCursor: true });
        const text = this.scene.add.text(x, 75, label, { fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff', align: 'center', lineSpacing: 7 }).setOrigin(0.5);
        bg.on('pointerdown', () => this.draw(count));
        this.container.add([bg, text]);
    }

    open() { super.open(); this.refresh(); }
    refresh() { this.stoneText?.setText(`所持魔石: ${totalOwned(this.scene.player, 'magic_stone')}`); }

    draw(count) {
        const player = this.scene.player;
        if (totalOwned(player, 'magic_stone') < count) { this.scene.notificationUI?.show(`魔石が${count}個必要です`, 'error'); return; }
        for (let n = 0; n < count; n++) {
            const index = player.stats.inventory.findIndex(e => entryId(e) === 'magic_stone');
            removeFromInventory(player, index, 1);
        }
        const results = Array.from({ length: count }, pickPrize);
        results.forEach(p => player.addItem(p.id));
        player.saveStats();
        const rank = { C: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
        const top = results.reduce((best, p) => rank[p.rarity] > rank[best.rarity] ? p : best, results[0]);
        const names = results.map(p => `[${p.rarity}] ${ITEMS[p.id].name}`).join('\n');
        this.resultText.setColor(RARITY_COLOR[top.rarity] || '#ffffff').setText(names);
        this.refresh();
    }
}
