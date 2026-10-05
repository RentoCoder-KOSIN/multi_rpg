import { UI_FONT } from '../fontConfig.js';
import { getUILayout } from './UILayoutManager.js';
import { getJobLabel } from '../utils/jobLabel.js';

export default class PartyHUDUI {
    constructor(scene) {
        this.scene = scene;
        // Position is managed by UILayoutManager (right side, under the minimap).
        this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(1500);
        getUILayout(this.scene).register('party', this.container);
        this.partyData = null;
    }

    updatePartyData(data) {
        this.partyData = data;
        this.refresh();
    }

    refresh() {
        this.container.removeAll(true);

        if (!this.partyData || !this.partyData.members || this.partyData.members.length <= 1) {
            return;
        }

        const myId = this.scene.networkManager.getPlayerId();
        const otherMembers = this.partyData.members.filter(m => m.id !== myId);

        // タイトル
        const title = this.scene.add.text(0, -20, 'PARTY MEMBERS', {
            fontSize: '11px', color: '#4a90e2', fontFamily: UI_FONT,
            stroke: '#000', strokeThickness: 2
        });
        this.container.add(title);

        otherMembers.forEach((member, index) => {
            const y = index * 65;
            const memberContainer = this.scene.add.container(0, y);

            // 背景
            const bg = this.scene.add.graphics();
            bg.fillStyle(0x1a1a2e, 0.6);
            bg.fillRoundedRect(0, 0, 200, 60, 5);
            bg.lineStyle(2, 0x4a90e2, 0.4);
            bg.strokeRoundedRect(0, 0, 200, 60, 5);
            memberContainer.add(bg);

            // 名前
            let displayName = member.name;
            if (displayName.length > 10) displayName = displayName.substring(0, 8) + '..';
            const nameText = this.scene.add.text(8, 6, `${displayName} Lv.${member.level}`, {
                fontSize: '11px', color: '#ffffff', fontFamily: UI_FONT
            });
            memberContainer.add(nameText);

            // HP Bar
            const hpWidth = 180;
            const hpX = 10;
            const hpY = 24;
            const hpRatio = Phaser.Math.Clamp(member.hp / member.maxHp, 0, 1);
            const hpBg = this.scene.add.rectangle(hpX, hpY, hpWidth, 6, 0x222222).setOrigin(0, 0);
            const hpBar = this.scene.add.rectangle(hpX, hpY, hpWidth * hpRatio, 6, 0xff5e5e).setOrigin(0, 0);
            memberContainer.add([hpBg, hpBar]);

            // MP Bar
            const mpWidth = 180;
            const mpX = 10;
            const mpY = 34;
            const mpRatio = Phaser.Math.Clamp((member.mp || 0) / (member.maxMp || 1), 0, 1);
            const mpBg = this.scene.add.rectangle(mpX, mpY, mpWidth, 4, 0x222222).setOrigin(0, 0);
            const mpBar = this.scene.add.rectangle(mpX, mpY, mpWidth * mpRatio, 4, 0x5e5eff).setOrigin(0, 0);
            memberContainer.add([mpBg, mpBar]);

            // 職業
            const jobText = this.scene.add.text(10, 45, getJobLabel(member.job), {
                fontSize: '11px', color: '#ffd700', fontFamily: UI_FONT
            });
            memberContainer.add(jobText);

            // 位置情報 (MAP)
            const mapText = this.scene.add.text(195, 6, member.map, {
                fontSize: '11px', color: '#aaaaaa', fontFamily: UI_FONT
            }).setOrigin(1, 0);
            memberContainer.add(mapText);

            this.container.add(memberContainer);
        });
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
