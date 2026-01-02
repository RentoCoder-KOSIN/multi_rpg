import { SKILLS } from "../data/skills.js";
import { JOBS } from "../data/jobs.js";
import BaseWindowUI from "./BaseWindowUI.js";

export default class SkillManagerUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🔮 SKILL MANAGER',
            width: 700,
            height: 500,
            depth: 20000,
            themeColor: 0x4a90e2,
            overlayAlpha: 0.7
        });

        this.listItems = [];
        this.selectedIndex = 0;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // Job Exp Display
        this.jobExpText = this.scene.add.text(-panelWidth / 2 + 40, -panelHeight / 2 + 80, '', {
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#ffd700'
        });
        this.container.add(this.jobExpText);

        // Active Skills Display (Current Setup)
        this.activeSkillsContainer = this.scene.add.container(0, -panelHeight / 2 + 130);
        this.container.add(this.activeSkillsContainer);
        this.refreshActiveSkillsDisplay();

        // Scrollable List Area
        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        this.listContainer = this.scene.add.container(0, 50);
        const maskShape = this.scene.add.graphics();
        maskShape.setScrollFactor(0);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(sceneWidth / 2 - panelWidth / 2 + 20, sceneHeight / 2 - 150, panelWidth - 40, 320);
        const mask = maskShape.createGeometryMask();
        maskShape.setVisible(false);
        this.listContainer.setMask(mask);
        this.container.add(this.listContainer);

        // Guidance Text
        this.guidanceText = this.scene.add.text(0, panelHeight / 2 - 30, 'Arrows: Select | Enter: Unlock/Set | 1-3: Set to Slot', {
            fontSize: '12px', fontFamily: '"Press Start 2P"', color: '#888888', align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.guidanceText);

        // Input Handling (Number keys and Arrow keys)
        this.scene.input.keyboard.on('keydown', (event) => {
            if (!this.isOpen) return;
            if (event.code === 'ArrowDown') {
                this.selectedIndex = Math.min(this.listItems.length - 1, this.selectedIndex + 1);
                this.updateSelection();
            } else if (event.code === 'ArrowUp') {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.updateSelection();
            } else if (event.code === 'Enter') {
                this.handleAction();
            } else if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
                const slot = parseInt(event.key) - 1;
                this.handleSetSlot(slot);
            }
        });
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this.selectedIndex = 0;
        this.refreshList();
    }

    refreshActiveSkillsDisplay() {
        if (!this.activeSkillsContainer) return;
        this.activeSkillsContainer.removeAll(true);
        const player = this.scene.player;
        if (!player) return;

        const activeSkills = player.stats.activeSkills;
        const startX = -100;
        const spacing = 100;

        for (let i = 0; i < 3; i++) {
            const x = startX + (i * spacing);
            const skillId = activeSkills[i];
            const skillDef = SKILLS[skillId];

            const bg = this.scene.add.rectangle(x, 0, 80, 80, 0x222233).setStrokeStyle(2, 0x4a90e2);
            const label = this.scene.add.text(x - 30, -30, `${i + 1}`, { fontSize: '10px', color: '#888888' });

            this.activeSkillsContainer.add([bg, label]);

            if (skillDef) {
                const icon = this.scene.add.text(x, -10, skillDef.icon, { fontSize: '32px' }).setOrigin(0.5);
                const name = this.scene.add.text(x, 25, skillDef.name, { fontSize: '10px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
                this.activeSkillsContainer.add([icon, name]);
            } else {
                const empty = this.scene.add.text(x, 0, 'Empty', { fontSize: '12px', color: '#444455' }).setOrigin(0.5);
                this.activeSkillsContainer.add(empty);
            }
        }
    }

    refreshList() {
        this.listContainer.removeAll(true);
        this.listItems = [];

        const player = this.scene.player;
        if (!player) return;

        const currentJob = player.stats.job;
        const jobDef = JOBS[currentJob];
        const currentLevel = player.stats.level;
        const unlockedSkills = player.stats.unlockedSkills;

        // Gather all skills for current job
        let allSkills = [];
        if (jobDef && jobDef.skills) {
            Object.keys(jobDef.skills).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
                jobDef.skills[level].forEach(skillId => {
                    allSkills.push({ id: skillId, reqLevel: parseInt(level) });
                });
            });
        }

        const startY = -120;
        const itemHeight = 70;

        allSkills.forEach((skillInfo, index) => {
            const skillDef = SKILLS[skillInfo.id];
            if (!skillDef) return;

            const isUnlocked = unlockedSkills.includes(skillInfo.id);
            const reqMet = currentLevel >= skillInfo.reqLevel;
            const canUnlock = !isUnlocked && reqMet;
            const cost = skillDef.unlockCost || 0;
            const y = startY + (index * itemHeight);

            const container = this.scene.add.container(0, y);

            // Background
            const bg = this.scene.add.graphics();
            this.drawListItem(bg, 600, 60, 0x1a1a2e, 0.8, 0x444455, 0.5);
            container.add(bg);

            // Icon
            const icon = this.scene.add.text(-270, 0, skillDef.icon, { fontSize: '28px' }).setOrigin(0.5);
            container.add(icon);

            // Info
            const nameColor = isUnlocked ? '#ffffff' : (canUnlock ? '#ffffaa' : '#888888');
            const name = this.scene.add.text(-220, -10, skillDef.name, {
                fontSize: '16px', fontFamily: '"Press Start 2P"', color: nameColor
            });
            const desc = this.scene.add.text(-220, 15, skillDef.description, {
                fontSize: '10px', color: '#aaaaaa'
            });
            container.add([name, desc]);

            // Status / Cost
            let statusTextStr = '';
            let statusColor = '#ffffff';

            if (isUnlocked) {
                statusTextStr = '解放済み (Set with 1-3)';
                statusColor = '#00ff00';
            } else if (canUnlock) {
                statusTextStr = `Unlock [Enter]: ${cost} Job Exp`;
                statusColor = player.stats.jobExp >= cost ? '#ffff00' : '#ff5555';
            } else {
                statusTextStr = `Required Lv.${skillInfo.reqLevel}`;
                statusColor = '#ff5555';
            }

            const statusText = this.scene.add.text(280, 0, statusTextStr, {
                fontSize: '10px', fontFamily: '"Press Start 2P"', color: statusColor
            }).setOrigin(1, 0.5);
            container.add(statusText);

            this.listContainer.add(container);

            // インタラクティブ化 (タップ対応)
            container.setSize(600, 60);
            container.setInteractive({ useHandCursor: true });
            container.on('pointerdown', () => {
                this.selectedIndex = index;
                this.updateSelection();
                this.handleAction();
            });

            this.listItems.push({
                skillId: skillInfo.id,
                bg,
                container,
                isUnlocked,
                canUnlock,
                cost,
                skillDef
            });
        });

        this.updateSelection();
        this.jobExpText.setText(`Job Exp: ${player.stats.jobExp}`);
        this.refreshActiveSkillsDisplay();
    }

    drawListItem(gfx, w, h, fill, fillA, str, strA) {
        gfx.clear();
        gfx.fillStyle(fill, fillA);
        gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
        gfx.lineStyle(2, str, strA);
        gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    }

    updateSelection() {
        this.listItems.forEach((item, i) => {
            if (i === this.selectedIndex) {
                this.drawListItem(item.bg, 600, 60, 0x4a90e2, 0.3, 0xffffff, 1);
                item.container.setScale(1.02);

                // Scroll
                const targetY = -(Math.max(0, i - 2) * 70);
                this.listContainer.y = targetY;
            } else {
                this.drawListItem(item.bg, 600, 60, 0x1a1a2e, 0.8, 0x444455, 0.5);
                item.container.setScale(1);
            }
        });
    }

    handleAction() {
        const item = this.listItems[this.selectedIndex];
        if (!item) return;

        if (item.canUnlock) {
            this.scene.player.unlockSkill(item.skillId);
            this.refreshList();
        } else if (item.isUnlocked) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('数字キー(1-3)でセットしてください', 'info');
            }
        }
    }

    handleSetSlot(slot) {
        const item = this.listItems[this.selectedIndex];
        if (!item) return;

        if (item.isUnlocked) {
            this.scene.player.setActiveSkill(slot, item.skillId);
            this.refreshActiveSkillsDisplay();
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`スロット${slot + 1}にセットしました`, 'success');
            }
            if (this.scene.skillBarUI) {
                this.scene.skillBarUI.update(); // 即時反映
            }
        } else {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('未解放のスキルです', 'error');
            }
        }
    }
}
