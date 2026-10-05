import { ITEMS } from '../data/items.js';

// The status view deliberately lives in the DOM, beside the Phaser canvas.
// Keeping it outside the game renderer prevents it from dimming or clipping
// when an in-game window opens.
export default class PlayerStatsUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.createUI();
    }

    createUI() {
        this.sidebar = document.getElementById('game-sidebar');
        this.panel = document.getElementById('player-status-panel');
        this.sidebar?.classList.add('is-active');
        this.update();
    }

    update() {
        const stats = this.player?.stats;
        if (!stats || !this.panel) return;
        const playerId = this.player.isServerManaged ? this.player.id : this.scene.networkManager?.getPlayerId();
        const name = this.scene.registry.get('playerNames')?.[playerId] || 'You';
        const pct = value => `${Math.round((value || 0) * 100)}%`;
        const resist = stats.elementResist || {};
        const damage = stats.elementDamage || {};
        const names = { fire: '火', water: '水', thunder: '雷', wind: '風', earth: '土', light: '光', dark: '闇' };
        const resistance = ['fire', 'water', 'thunder', 'wind', 'earth', 'light', 'dark']
            .map(id => `${names[id]}${resist[id] || 0}%`).join(' ');
        const added = Object.entries(damage).filter(([, value]) => value)
            .map(([id, value]) => `${names[id] || id}+${value}`).join(' ') || 'なし';
        const weapon = ITEMS[stats.equipment?.weapon]?.name || 'なし';
        const armor = ITEMS[stats.equipment?.armor]?.name || 'なし';

        this.panel.innerHTML = `
            <h2 class="status-title">${name} Lv.${stats.level}</h2>
            <div class="status-bars">
                HP ${Math.ceil(stats.hp)}/${stats.maxHp}<br>
                MP ${Math.ceil(stats.mp)}/${stats.maxMp}<br>
                EXP ${Math.floor(stats.exp)}/${stats.maxExp}<br>
                GOLD ${stats.gold || 0}　SP ${stats.statPoints || 0}
            </div>
            <div class="status-detail">
                ATK ${stats.atk || 0}　DEF ${stats.def || 0}<br>
                会心 ${pct(stats.critChance)}　回避 ${pct(stats.dodgeChanceFlat)}<br>
                速度 ${this.player.speed || 0}　吸収 ${pct(stats.lifesteal)}<br>
                EXP x${(stats.expMultiplier || 1).toFixed(1)}<br>
                武器: ${weapon}<br>防具: ${armor}<br>
                武器属性: ${names[stats.weaponElement] || '無'}　防具属性: ${names[stats.armorElement] || '無'}<br>
                属性追加: ${added}<br>
                耐性: ${resistance}<br>
                STR ${stats.str || 0}　VIT ${stats.vit || 0}　INT ${stats.int || 0}<br>
                MEN ${stats.men || 0}　DEX ${stats.dex || 0}
            </div>`;
    }

    destroy() {
        if (this.panel) this.panel.textContent = '';
        this.sidebar?.classList.remove('is-active');
    }
}
