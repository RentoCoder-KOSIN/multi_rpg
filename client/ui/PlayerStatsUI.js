import { ITEMS } from "../data/items.js";
import { SKILLS } from "../data/skills.js";

export default class PlayerStatsUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.createUI();
    }

    createUI() {
        // メインコンテナ
        this.container = this.scene.add.container(15, 15).setScrollFactor(0).setDepth(2000);

        // 背景 (少し透明度を上げる)
        this.bg = this.scene.add.graphics();
        this.drawBackground();
        this.container.add(this.bg);

        // 名前とレベル
        this.nameLevelText = this.scene.add.text(12, 8, '', {
            fontSize: '12px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P"',
            stroke: '#000',
            strokeThickness: 2
        });
        this.container.add(this.nameLevelText);

        const barX = 12;
        const barWidth = 220;
        const barHeight = 6;
        const spacing = 18;

        // HP
        this.hpLabel = this.scene.add.text(barX, 32, 'HP', { fontSize: '8px', color: '#ff5e5e', fontFamily: '"Press Start 2P"' });
        this.hpBarBg = this.scene.add.rectangle(barX + 25, 36, barWidth - 25, barHeight, 0x222222).setOrigin(0, 0.5);
        this.hpBar = this.scene.add.rectangle(barX + 25, 36, barWidth - 25, barHeight, 0xff5e5e).setOrigin(0, 0.5);
        this.hpText = this.scene.add.text(barX + 25 + (barWidth - 25) / 2, 36, '0/0', { fontSize: '7px', color: '#ffffff', fontFamily: '"Press Start 2P"' }).setOrigin(0.5);
        this.container.add([this.hpLabel, this.hpBarBg, this.hpBar, this.hpText]);

        // MP
        this.mpLabel = this.scene.add.text(barX, 32 + spacing, 'MP', { fontSize: '8px', color: '#5e5eff', fontFamily: '"Press Start 2P"' });
        this.mpBarBg = this.scene.add.rectangle(barX + 25, 36 + spacing, barWidth - 25, barHeight, 0x222222).setOrigin(0, 0.5);
        this.mpBar = this.scene.add.rectangle(barX + 25, 36 + spacing, barWidth - 25, barHeight, 0x5e5eff).setOrigin(0, 0.5);
        this.mpText = this.scene.add.text(barX + 25 + (barWidth - 25) / 2, 36 + spacing, '0/0', { fontSize: '7px', color: '#ffffff', fontFamily: '"Press Start 2P"' }).setOrigin(0.5);
        this.container.add([this.mpLabel, this.mpBarBg, this.mpBar, this.mpText]);

        // XP
        this.expLabel = this.scene.add.text(barX, 32 + spacing * 2, 'XP', { fontSize: '8px', color: '#5eff5e', fontFamily: '"Press Start 2P"' });
        this.expBarBg = this.scene.add.rectangle(barX + 25, 36 + spacing * 2, barWidth - 25, 3, 0x222222).setOrigin(0, 0.5);
        this.expBar = this.scene.add.rectangle(barX + 25, 36 + spacing * 2, barWidth - 25, 3, 0x5eff5e).setOrigin(0, 0.5);
        this.container.add([this.expLabel, this.expBarBg, this.expBar]);

        // 下部エリア
        this.infoBg = this.scene.add.graphics();
        this.infoBg.fillStyle(0x000000, 0.3);
        this.infoBg.fillRoundedRect(8, 85, barWidth + 10, 60, 6);
        this.container.add(this.infoBg);

        this.weaponText = this.scene.add.text(15, 92, '⚔️ なし', { fontSize: '8px', color: '#e0e0e0', fontFamily: '"Press Start 2P"' });
        this.armorText = this.scene.add.text(125, 92, '🛡️ なし', { fontSize: '8px', color: '#e0e0e0', fontFamily: '"Press Start 2P"' });
        this.goldText = this.scene.add.text(15, 110, '🪙 0', { fontSize: '10px', color: '#ffd700', fontFamily: '"Press Start 2P"' });
        this.skillText = this.scene.add.text(15, 126, '🔮 なし', { fontSize: '8px', color: '#00ffff', fontFamily: '"Press Start 2P"' });
        this.statPointsText = this.scene.add.text(125, 110, '📊 SP: 0', { fontSize: '8px', color: '#ff00ff', fontFamily: '"Press Start 2P"' });
        this.container.add([this.weaponText, this.armorText, this.goldText, this.skillText, this.statPointsText]);

        // ステータス画面へのショートカット
        this.bg.setInteractive(new Phaser.Geom.RoundedRect(0, 0, 250, 155, 10), Phaser.Geom.RoundedRect.Contains);
        this.bg.on('pointerdown', () => {
            if (this.scene.statAllocationUI) this.scene.statAllocationUI.toggle();
        });

        this.update();
    }

    drawBackground() {
        this.bg.clear();
        const width = 250;
        const height = 155;
        this.bg.fillStyle(0x1a1a2e, 0.75); // 透明度アップ
        this.bg.fillRoundedRect(0, 0, width, height, 10);
        this.bg.lineStyle(2, 0x4a90e2, 0.8);
        this.bg.strokeRoundedRect(0, 0, width, height, 10);
        this.bg.fillStyle(0x4a90e2, 0.1);
        this.bg.fillRoundedRect(0, 0, width, 28, { tl: 10, tr: 10, bl: 0, br: 0 });
    }

    update() {
        if (!this.player || !this.player.stats) return;
        const stats = this.player.stats;
        const barAreaWidth = 220 - 25;

        const playerId = this.player.isServerManaged ? this.player.id : (this.scene.networkManager ? this.scene.networkManager.getPlayerId() : null);
        let name = this.scene.registry.get('playerNames')?.[playerId] || 'You';
        if (name.length > 8) name = name.substring(0, 6) + '..';

        this.nameLevelText.setText(`${name} Lv.${stats.level}`);

        const hpPercent = Math.max(0, stats.hp / stats.maxHp);
        this.hpBar.width = Math.max(0, barAreaWidth * hpPercent);
        this.hpText.setText(`${Math.ceil(stats.hp)}/${stats.maxHp}`);

        const mpPercent = Math.max(0, stats.mp / stats.maxMp);
        this.mpBar.width = Math.max(0, barAreaWidth * mpPercent);
        this.mpText.setText(`${Math.ceil(stats.mp)}/${stats.maxMp}`);

        const expPercent = Math.min(1, Math.max(0, stats.exp / stats.maxExp));
        this.expBar.width = Math.max(0, barAreaWidth * expPercent);

        if (this.goldText) this.goldText.setText(`🪙 ${stats.gold || 0}`);

        if (this.weaponText) {
            const weaponId = stats.equipment?.weapon;
            const wName = weaponId ? ITEMS[weaponId]?.name : 'なし';
            this.weaponText.setText(`⚔️ ${wName.substring(0, 8)}`);
        }
        if (this.armorText) {
            const armorId = stats.equipment?.armor;
            const aName = armorId ? ITEMS[armorId]?.name : 'なし';
            this.armorText.setText(`🛡️ ${aName.substring(0, 8)}`);
        }
        if (this.skillText) {
            const skillNames = (this.player.skills || []).map(id => SKILLS[id]?.name).filter(n => n).join(', ');
            this.skillText.setText(`🔮 ${skillNames.substring(0, 20) || 'なし'}`);
        }
        if (this.statPointsText) {
            this.statPointsText.setText(`📊 SP: ${stats.statPoints || 0}`);
        }
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
