import { SKILLS } from "../data/skills.js";
import { JOBS } from "../data/jobs.js";
import { TOTAL_SKILL_SLOTS } from "../gameConstants.js";

const SLOT_SIZE = 60;
// 中央(角度0)から見た円周上の広がり。横方向は大きめ・縦方向は小さめにして、
// 画面下端で見切れないようゆるいアーチ状の「円」に配置する。
const WHEEL_RADIUS_X = 140;
const WHEEL_RADIUS_Y = 50;
const ANGLE_STEP = 360 / TOTAL_SKILL_SLOTS; // スロット1個あたりの角度
const FADE_START_ANGLE = 40;   // これを超えた角度から縮小・フェードを開始
const VISIBLE_ANGLE_LIMIT = 100; // これを超えたら完全に非表示（負荷軽減）

export default class SkillBarUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.slots = [];
        // 現在ホイールがどれだけ回転しているか（度）。0の時はスロット0が中央。
        this.rotationState = { angle: 0 };
        this.createUI();
    }

    createUI() {
        const gameWidth = this.scene.scale.gameSize ? this.scene.scale.gameSize.width : this.scene.scale.width;
        const gameHeight = this.scene.scale.gameSize ? this.scene.scale.gameSize.height : this.scene.scale.height;

        // バーのコンテナ（画面下中央）
        this.container = this.scene.add.container(gameWidth / 2, gameHeight - 50).setScrollFactor(0).setDepth(2000);

        // メイン背景（中央付近のスロットだけを収める控えめなパネル）
        const bgWidth = 240;
        const bgHeight = 110;
        const mainBg = this.scene.add.graphics();
        mainBg.fillStyle(0x000000, 0.35);
        mainBg.fillRoundedRect(-bgWidth / 2, -bgHeight / 2 - 5, bgWidth, bgHeight, 20);
        mainBg.lineStyle(2, 0xffffff, 0.08);
        mainBg.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2 - 5, bgWidth, bgHeight, 20);
        this.container.add(mainBg);

        // スロットをTOTAL_SKILL_SLOTS個、仮想の円周上に均等配置する。
        // 中央付近の3〜4個だけがはっきり見え、外側は縮小・フェードして隠れる。
        // 左右の矢印ボタンでホイールを回転させると、隠れているスロットが中央に呼び出される。
        for (let i = 0; i < TOTAL_SKILL_SLOTS; i++) {
            const slotContainer = this.scene.add.container(0, 0);
            this.container.add(slotContainer);

            // スロットベース
            const slotGfx = this.scene.add.graphics();
            this.drawSlot(slotGfx, 0x1a1a2e, 0.8, 0x4a90e2, 0.5);
            slotContainer.add(slotGfx);

            // 光彩用 (準備完了時)
            const glowGfx = this.scene.add.graphics();
            glowGfx.setVisible(false);
            slotContainer.add(glowGfx);

            // クールダウン表示用
            const cdOverlay = this.scene.add.graphics();
            slotContainer.add(cdOverlay);

            // キーラベル (左上)
            const keyLabel = this.scene.add.text(-SLOT_SIZE / 2 + 6, -SLOT_SIZE / 2 + 6, `${i + 1}`, {
                fontSize: '10px', color: '#ffffff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 2
            });
            slotContainer.add(keyLabel);

            // スキルアイコン
            const iconText = this.scene.add.text(0, -5, '', { fontSize: '28px' }).setOrigin(0.5);
            slotContainer.add(iconText);

            // スキル名 (下部)
            const skillNameText = this.scene.add.text(0, SLOT_SIZE / 2 + 8, '', {
                fontSize: '8px', color: '#ffffff', fontFamily: '"Press Start 2P"', align: 'center', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 0);
            slotContainer.add(skillNameText);

            // MP消費量
            const mpCostText = this.scene.add.text(0, SLOT_SIZE / 2 + 20, '', {
                fontSize: '8px', color: '#66ccff', fontFamily: '"Press Start 2P"', align: 'center', stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5, 0);
            slotContainer.add(mpCostText);

            // ロック表示用テキスト
            const lockText = this.scene.add.text(0, 0, '', {
                fontSize: '10px', color: '#ff5555', fontFamily: '"Press Start 2P"', align: 'center', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5).setVisible(false);
            slotContainer.add(lockText);

            this.slots.push({
                baseAngle: i * ANGLE_STEP,
                slotContainer,
                slotGfx,
                glowGfx,
                cdOverlay,
                iconText,
                skillNameText,
                mpCostText,
                lockText,
                keyLabel,
                isReady: true
            });
        }

        this.createRotateButtons(bgWidth);
    }

    createRotateButtons(bgWidth) {
        this.leftArrow = this.createArrowButton(-bgWidth / 2 - 24, -8, '◀', () => this.rotate(-1));
        this.rightArrow = this.createArrowButton(bgWidth / 2 + 24, -8, '▶', () => this.rotate(1));
    }

    createArrowButton(x, y, label, onClick) {
        const btn = this.scene.add.container(x, y);
        const bg = this.scene.add.circle(0, 0, 18, 0x1a1a2e, 0.7).setStrokeStyle(2, 0x4a90e2, 0.8);
        const txt = this.scene.add.text(0, 0, label, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
        btn.add([bg, txt]);
        btn.setSize(36, 36);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', () => {
            bg.setFillStyle(0x4a90e2, 0.6);
            onClick();
        });
        btn.on('pointerup', () => bg.setFillStyle(0x1a1a2e, 0.7));
        btn.on('pointerout', () => bg.setFillStyle(0x1a1a2e, 0.7));
        this.container.add(btn);
        return btn;
    }

    // ホイールを1スロット分回転させる (dir: -1=左隣を呼ぶ, 1=右隣を呼ぶ)
    rotate(dir) {
        this.scene.tweens.killTweensOf(this.rotationState);
        this.scene.tweens.add({
            targets: this.rotationState,
            angle: this.rotationState.angle + dir * ANGLE_STEP,
            duration: 220,
            ease: 'Cubic.easeOut'
        });
    }

    drawSlot(gfx, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(-SLOT_SIZE / 2, -SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 10);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(-SLOT_SIZE / 2, -SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE, 10);
    }

    drawGlow(gfx) {
        gfx.clear();
        gfx.lineStyle(3, 0x00ffff, 0.6);
        gfx.strokeRoundedRect(-SLOT_SIZE / 2 - 2, -SLOT_SIZE / 2 - 2, SLOT_SIZE + 4, SLOT_SIZE + 4, 12);
        gfx.lineStyle(1, 0x00ffff, 0.3);
        gfx.strokeRoundedRect(-SLOT_SIZE / 2 - 5, -SLOT_SIZE / 2 - 5, SLOT_SIZE + 10, SLOT_SIZE + 10, 15);
    }

    // 角度を (-180, 180] の範囲に正規化
    normalizeAngle(angle) {
        let a = angle % 360;
        if (a > 180) a -= 360;
        if (a <= -180) a += 360;
        return a;
    }

    update() {
        if (!this.player || !this.player.stats) return;

        const now = Date.now();
        const activeSkills = this.player.stats.activeSkills || [];
        const wheelAngle = this.rotationState.angle;

        this.slots.forEach((slot, i) => {
            const relativeAngle = this.normalizeAngle(slot.baseAngle - wheelAngle);
            const absAngle = Math.abs(relativeAngle);

            // 円の裏側まで回ったスロットは非表示にして負荷を抑える
            if (absAngle > VISIBLE_ANGLE_LIMIT) {
                slot.slotContainer.setVisible(false);
                return;
            }
            slot.slotContainer.setVisible(true);

            // 円周上の位置（中央=真上、外側にいくほど下に沈んで隠れていく）
            const rad = Phaser.Math.DegToRad(relativeAngle);
            const px = WHEEL_RADIUS_X * Math.sin(rad);
            const py = WHEEL_RADIUS_Y * (1 - Math.cos(rad));

            // 中央から離れるほど縮小・フェードして「回転して奥に隠れる」見た目にする
            const fade = Phaser.Math.Clamp(
                1 - Math.max(0, absAngle - FADE_START_ANGLE) / (VISIBLE_ANGLE_LIMIT - FADE_START_ANGLE),
                0.15, 1
            );

            slot.slotContainer.setPosition(px, py);
            slot.slotContainer.setScale(fade);
            slot.slotContainer.setAlpha(Phaser.Math.Clamp(fade + 0.2, 0, 1));

            const skillId = activeSkills[i];

            if (skillId) {
                const skillDef = SKILLS[skillId];

                slot.iconText.setVisible(true);
                slot.skillNameText.setVisible(true);
                slot.mpCostText.setVisible(true);

                if (skillDef) {
                    slot.skillNameText.setText(skillDef.name);
                    slot.iconText.setText(skillDef.icon || '❓');

                    // MPが足りない時は赤字で警告表示
                    const mpCost = skillDef.mpCost || 0;
                    const hasHolyWeapon = this.player.stats.equipment && this.player.stats.equipment.weapon === 'holy_weapon';
                    const actualCost = hasHolyWeapon ? 0 : mpCost;
                    const enoughMp = this.player.stats.mp >= actualCost;
                    slot.mpCostText.setText(`MP${actualCost}`);
                    slot.mpCostText.setColor(enoughMp ? '#66ccff' : '#ff5555');
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
                        this.drawSlot(slot.slotGfx, 0x1a1a2e, 0.6, 0x4a90e2, 0.2);
                    }

                    const h = SLOT_SIZE * (1 - progress);
                    slot.cdOverlay.fillStyle(0x000000, 0.6);
                    slot.cdOverlay.fillRect(-SLOT_SIZE / 2, SLOT_SIZE / 2 - h, SLOT_SIZE, h);
                    slot.iconText.setAlpha(0.4);
                } else {
                    if (!slot.isReady) {
                        slot.isReady = true;
                        slot.iconText.setAlpha(1);
                        slot.glowGfx.setVisible(true);
                        this.drawGlow(slot.glowGfx);
                        this.drawSlot(slot.slotGfx, 0x1a1a2e, 0.9, 0x00ffff, 0.8);

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
                slot.mpCostText.setVisible(false);
                slot.cdOverlay.clear();
                slot.glowGfx.setVisible(false);
                this.drawSlot(slot.slotGfx, 0x1a1a2e, 0.3, 0x4a90e2, 0.2);
            }
        });
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
