import { SKILLS } from "../data/skills.js";
import { JOBS } from "../data/jobs.js";

export default class SkillBarUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.slots = [];
        this.createUI();
    }

    createUI() {
        const gameWidth = this.scene.scale.gameSize ? this.scene.scale.gameSize.width : this.scene.scale.width;
        const gameHeight = this.scene.scale.gameSize ? this.scene.scale.gameSize.height : this.scene.scale.height;

        // バーのコンテナ（画面下中央）
        this.container = this.scene.add.container(gameWidth / 2, gameHeight - 50).setScrollFactor(0).setDepth(2000);

        // スロットの作成 (最大3つ)
        const slotSize = 60;
        const spacing = 15;
        const totalWidth = (slotSize * 3) + (spacing * 2);

        // メイン背景 (フロート感のあるパネル)
        const mainBg = this.scene.add.graphics();
        mainBg.fillStyle(0x000000, 0.4);
        mainBg.fillRoundedRect(-totalWidth / 2 - 15, -slotSize / 2 - 15, totalWidth + 30, slotSize + 30, 15);
        mainBg.lineStyle(2, 0xffffff, 0.1);
        mainBg.strokeRoundedRect(-totalWidth / 2 - 15, -slotSize / 2 - 15, totalWidth + 30, slotSize + 30, 15);
        this.container.add(mainBg);

        for (let i = 0; i < 3; i++) {
            const x = (i - 1) * (slotSize + spacing);

            // スロットベース
            const slotGfx = this.scene.add.graphics();
            this.drawSlot(slotGfx, x, slotSize, 0x1a1a2e, 0.8, 0x4a90e2, 0.5);
            this.container.add(slotGfx);

            // 光彩用 (準備完了時)
            const glowGfx = this.scene.add.graphics();
            glowGfx.setVisible(false);
            this.container.add(glowGfx);

            // クールダウン表示用
            const cdOverlay = this.scene.add.graphics();
            this.container.add(cdOverlay);

            // キーラベル (左上)
            const keyLabel = this.scene.add.text(x - slotSize / 2 + 6, -slotSize / 2 + 6, `${i + 1}`, {
                fontSize: '10px', color: '#ffffff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 2
            });
            this.container.add(keyLabel);

            // スキルアイコン
            const iconText = this.scene.add.text(x, -5, '', {
                fontSize: '28px'
            }).setOrigin(0.5);
            this.container.add(iconText);

            // スキル名 (下部)
            const skillNameText = this.scene.add.text(x, slotSize / 2 + 8, '', {
                fontSize: '8px', color: '#ffffff', fontFamily: '"Press Start 2P"', align: 'center', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 0);
            this.container.add(skillNameText);

            // ロック表示用テキスト
            const lockText = this.scene.add.text(x, 0, '', {
                fontSize: '10px', color: '#ff5555', fontFamily: '"Press Start 2P"', align: 'center', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setVisible(false);
            this.container.add(lockText);

            this.slots.push({
                x,
                slotGfx,
                glowGfx,
                cdOverlay,
                iconText,
                skillNameText,
                lockText,
                slotSize,
                isReady: true
            });
        }
    }

    drawSlot(gfx, x, size, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(x - size / 2, -size / 2, size, size, 10);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(x - size / 2, -size / 2, size, size, 10);
    }

    drawGlow(gfx, x, size) {
        gfx.clear();
        gfx.lineStyle(3, 0x00ffff, 0.6);
        gfx.strokeRoundedRect(x - size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 12);
        gfx.lineStyle(1, 0x00ffff, 0.3);
        gfx.strokeRoundedRect(x - size / 2 - 5, -size / 2 - 5, size + 10, size + 10, 15);
    }

    update() {
        if (!this.player || !this.player.stats) return;

        const jobId = this.player.stats.job;
        const jobDef = JOBS[jobId];
        const now = Date.now();
        const currentLevel = this.player.stats.level;

        const activeSkills = this.player.stats.activeSkills || [null, null, null];

        this.slots.forEach((slot, i) => {
            const skillId = activeSkills[i];

            if (skillId) {
                const skillDef = SKILLS[skillId];

                slot.iconText.setVisible(true);
                slot.skillNameText.setVisible(true);

                if (skillDef) {
                    slot.skillNameText.setText(skillDef.name);
                    slot.iconText.setText(skillDef.icon || '❓');
                }

                // 解放済み
                slot.lockText.setVisible(false);
                slot.skillNameText.setAlpha(1);

                const lastUse = this.player.skillCooldowns[skillId] || 0;
                let cdTime = skillDef ? (skillDef.cd || 2000) : 2000;

                // 聖なる武器装備時はクールダウン半減
                if (this.player.stats.equipment && this.player.stats.equipment.weapon === 'holy_weapon') {
                    cdTime = Math.floor(cdTime * 0.5);
                }

                const elapsed = now - lastUse;
                const progress = Phaser.Math.Clamp(elapsed / cdTime, 0, 1);

                slot.cdOverlay.clear();
                if (progress < 1) {
                    if (slot.isReady) {
                        slot.isReady = false;
                        slot.glowGfx.setVisible(false);
                        this.drawSlot(slot.slotGfx, slot.x, slot.slotSize, 0x1a1a2e, 0.6, 0x4a90e2, 0.2);
                    }

                    const h = slot.slotSize * (1 - progress);
                    slot.cdOverlay.fillStyle(0x000000, 0.6);
                    slot.cdOverlay.fillRect(slot.x - slot.slotSize / 2, slot.slotSize / 2 - h, slot.slotSize, h);
                    slot.iconText.setAlpha(0.4);
                } else {
                    if (!slot.isReady) {
                        slot.isReady = true;
                        slot.iconText.setAlpha(1);
                        slot.glowGfx.setVisible(true);
                        this.drawGlow(slot.glowGfx, slot.x, slot.slotSize);
                        this.drawSlot(slot.slotGfx, slot.x, slot.slotSize, 0x1a1a2e, 0.9, 0x00ffff, 0.8);

                        // 準備完了アニメーション
                        this.scene.tweens.add({
                            targets: slot.iconText,
                            scale: { from: 1.3, to: 1 },
                            duration: 200,
                            ease: 'Back.easeOut'
                        });
                    }
                }
            } else {
                // スキルなし
                slot.skillNameText.setVisible(false);
                slot.iconText.setVisible(false);
                slot.lockText.setVisible(false);
                slot.cdOverlay.clear();
                slot.glowGfx.setVisible(false);
                this.drawSlot(slot.slotGfx, slot.x, slot.slotSize, 0x1a1a2e, 0.3, 0x4a90e2, 0.2);
            }
        });
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
