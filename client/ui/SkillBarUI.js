import { SKILLS } from "../data/skills.js";
import { JOBS } from "../data/jobs.js";
import { TOTAL_SKILL_SLOTS } from "../gameConstants.js";
import { pinToScreen } from "../utils/screenFixed.js";
import { UI_LAYOUT } from "./uiLayout.js";
import { getUILayout } from "./UILayoutManager.js";
import { ITEMS } from "../data/items.js";

const SLOT_SIZE = 60;
// The skill slots sit on a real circle (the dial). The container origin is the dial center,
// so the active slot (angle 0) is at (0, -DIAL_RADIUS), i.e. the top of the circle.
const DIAL_RADIUS = UI_LAYOUT.skillDial.radius;
const DIAL_BG_RADIUS = DIAL_RADIUS + UI_LAYOUT.skillDial.bgPadding; // = half of the layout size
const ANGLE_STEP = 360 / TOTAL_SKILL_SLOTS; // スロット1個あたりの角度
const FADE_START_ANGLE = 40;   // これを超えた角度から縮小・フェードを開始
const VISIBLE_ANGLE_LIMIT = 85;  // beyond this angle the slot is hidden (keeps the arrow buttons clear)

export default class SkillBarUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.slots = [];
        // 現在ホイールがどれだけ回転しているか（度）。0の時はスロット0が中央。
        // 表示方式と回転位置はプレイヤーのセーブに持たせる。マップ切替でUIは作り直されるが、
        // ここを読むことで「回転式にしたのに2段表示へ戻る」ことがない。
        this.rotationState = { angle: Number(player.stats.skillBarRotation) || 0 };
        this.layoutMode = player.stats.skillBarLayout === 'grid' ? 'grid' : 'dial';
        this.createUI();
    }

    createUI() {
        // Container origin = dial center. Position is managed by UILayoutManager (bottom-right corner).
        this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(2000);
        // Note: setScrollFactor(0) on a container does not reach its children, so their hit areas
        // drift with the camera. pinToScreen() also pins children added later.
        pinToScreen(this.container);
        getUILayout(this.scene).register('skillDial', this.container);

        // Round background
        const mainBg = this.scene.add.graphics();
        mainBg.fillStyle(0x000000, 0.35);
        mainBg.fillCircle(0, 0, DIAL_BG_RADIUS);
        mainBg.lineStyle(2, 0xffffff, 0.12);
        mainBg.strokeCircle(0, 0, DIAL_BG_RADIUS);
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

        this.createRotateButtons();
        // 画面外へ切れない右上に、表示方式を切り替えるボタンを置く。
        this.layoutButton = this.createArrowButton(DIAL_RADIUS + 28, -DIAL_RADIUS - 25, '▦', () => this.toggleLayout());
    }

    // Arrows sit on both sides of the dial center, inside the round background
    createRotateButtons() {
        const arrowX = DIAL_RADIUS + 18;
        this.leftArrow = this.createArrowButton(-arrowX, 0, '◀', () => this.rotate(-1));
        this.rightArrow = this.createArrowButton(arrowX, 0, '▶', () => this.rotate(1));
    }

    createArrowButton(x, y, label, onClick) {
        const btn = this.scene.add.container(x, y);
        const bg = this.scene.add.circle(0, 0, 18, 0x1a1a2e, 0.7).setStrokeStyle(2, 0x4a90e2, 0.8);
        const txt = this.scene.add.text(0, 0, label, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
        btn.add([bg, txt]);

        // 注意: Containerは setSize()+setInteractive({...}) だけだとヒットエリアが
        // ローカル座標(0,0)〜(width,height)、つまり見た目の円(中心が(0,0))の右下1/4しか
        // 反応しない状態になり、「ボタンが押せない」原因になる。
        // 見た目の円と同じ中心のRectangleを明示的に指定して確実にクリック判定を合わせる。
        const hitSize = 44;
        btn.setSize(hitSize, hitSize);
        btn.setInteractive(new Phaser.Geom.Rectangle(-hitSize / 2, -hitSize / 2, hitSize, hitSize), Phaser.Geom.Rectangle.Contains);
        btn.input.cursor = 'pointer';

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
            ease: 'Cubic.easeOut',
            onComplete: () => this.saveLayoutState(),
        });
    }

    saveLayoutState() {
        this.player.stats.skillBarLayout = this.layoutMode;
        // 何周回しても同じ状態として復元できるよう、角度を1周分に正規化して保存する。
        this.player.stats.skillBarRotation = this.normalizeAngle(this.rotationState.angle);
        this.player.saveStats();
    }

    toggleLayout() {
        this.layoutMode = this.layoutMode === 'grid' ? 'dial' : 'grid';
        this.saveLayoutState();
        this.scene.notificationUI?.show(this.layoutMode === 'grid' ? 'スキルバー: 全表示（2段）' : 'スキルバー: 回転式', 'info');
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

        if (this.leftArrow) this.leftArrow.setVisible(this.layoutMode === 'dial');
        if (this.rightArrow) this.rightArrow.setVisible(this.layoutMode === 'dial');

        this.slots.forEach((slot, i) => {
            const relativeAngle = this.normalizeAngle(slot.baseAngle - wheelAngle);
            const absAngle = Math.abs(relativeAngle);

            // 回転式では円の裏側を隠す。全表示モードでは4列x2段に並べる。
            if (this.layoutMode === 'dial' && absAngle > VISIBLE_ANGLE_LIMIT) {
                slot.slotContainer.setVisible(false);
                return;
            }
            slot.slotContainer.setVisible(true);

            let px, py, fade;
            if (this.layoutMode === 'grid') {
                px = (i % 4 - 1.5) * 70;
                // skillDial は下端に少し沈む配置なので、2段とも画面内に収める。
                py = Math.floor(i / 4) === 0 ? -90 : -12;
                fade = 1;
            } else {
                const rad = Phaser.Math.DegToRad(relativeAngle);
                px = DIAL_RADIUS * Math.sin(rad);
                py = -DIAL_RADIUS * Math.cos(rad);
                fade = Phaser.Math.Clamp(1 - Math.max(0, absAngle - FADE_START_ANGLE) / (VISIBLE_ANGLE_LIMIT - FADE_START_ANGLE), 0.15, 1);
            }

            slot.slotContainer.setPosition(px, py);
            slot.slotContainer.setScale(fade);
            slot.slotContainer.setAlpha(Phaser.Math.Clamp(fade + 0.2, 0, 1));

            const skillId = activeSkills[i];

            if (skillId) {
                const quickItemId = typeof skillId === 'string' && skillId.startsWith('item:') ? skillId.slice(5) : null;
                const quickItem = quickItemId ? ITEMS[quickItemId] : null;
                const skillDef = quickItem ? null : SKILLS[skillId];

                slot.iconText.setVisible(true);
                slot.skillNameText.setVisible(true);
                slot.mpCostText.setVisible(true);

                if (quickItem) {
                    const count = (this.player.stats.inventory || []).reduce((n, e) => n + ((typeof e === 'string' ? e : e.id) === quickItemId ? (typeof e === 'string' ? 1 : e.count || 1) : 0), 0);
                    slot.skillNameText.setText(`${quickItem.name} x${count}`);
                    slot.iconText.setText(quickItem.stats?.healMp ? '🔷' : '🧪');
                    slot.mpCostText.setText('ITEM');
                    slot.mpCostText.setColor(count > 0 ? '#8dffb3' : '#ff5555');
                } else if (skillDef) {
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
                let cdTime = quickItem ? 700 : (skillDef ? (skillDef.cd || 2000) : 2000);

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
