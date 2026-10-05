import { UI_FONT } from '../fontConfig.js';
import { QUESTS } from "../data/quests.js";
import BaseWindowUI from "./BaseWindowUI.js";

// ギルドのクエストボード。
// 以前はQuestManagerにstartQuest/finishQuestがあるだけで、それを呼び出す
// UIがどこにも存在しなかった（quests.jsの nextQuest チェーンで自動的に
// 次のクエストが始まるだけ）。ここでプレイヤーが自分の意志で
// 「受注する／報告する」を選べるようにする。
export default class GuildQuestBoardUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '📜 クエストボード',
            width: 620,
            height: 480,
            depth: 100000,
            themeColor: 0xffd700
        });

        this.selectedIndex = 0;
        this.rows = []; // { id, mode: 'available' | 'active' | 'turnin', box }
        this.maskShape = null;
        this.keyHandler = null;
    }

    createUI() {
        if (this.container?.active) return;
        // A shutdown scene may leave a destroyed container reference behind.
        // Rebuild it instead of trying to attach a new mask/tween to it.
        if (this.container && !this.container.active) {
            this.container = null;
            this.overlay = null;
            this.maskShape = null;
        }
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        this.descText = this.scene.add.text(0, panelHeight / 2 - 30, '↑↓で選択 / Enterで受注・報告', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#aaaaaa'
        }).setOrigin(0.5);
        this.container.add(this.descText);

        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        this.maskShape = this.scene.add.graphics();
        this.maskShape.setScrollFactor(0);
        this.maskShape.fillStyle(0xffffff);
        this.maskShape.fillRect(sceneWidth / 2 - panelWidth / 2 + 20, sceneHeight / 2 - 170, panelWidth - 40, 320);
        this.maskShape.setVisible(false);
        const mask = this.maskShape.createGeometryMask();

        this.listContainer = this.scene.add.container(0, 0);
        this.listContainer.setMask(mask);
        this.container.add(this.listContainer);

        this.keyHandler = (event) => {
            if (!this.isOpen) return;
            if (event.code === 'ArrowDown') {
                this.selectedIndex = Math.min(this.rows.length - 1, this.selectedIndex + 1);
                this.updateSelection();
            } else if (event.code === 'ArrowUp') {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.updateSelection();
            } else if (event.code === 'Enter') {
                this.activateSelected();
            }
        };
        this.scene.input.keyboard.on('keydown', this.keyHandler);
        // マップ移動でUI本体はPhaserが破棄するが、キーボード監視とマスクの参照は
        // 明示的に解放しないと次回のギルド訪問時に古いUIを触ることがある。
        this.scene.events.once('shutdown', () => this.destroy());
    }

    open() {
        if (!this.scene?.sys?.isActive()) return;
        if (!this.container) this.createUI();
        if (!this.listContainer?.active) return;
        this.scene.tweens.killTweensOf(this.listContainer);
        super.open();
        this.selectedIndex = 0;
        this.listContainer.y = 0;
        this.refreshList();
        this.updateSelection();
    }

    // 表示対象のクエストを組み立てる:
    //  - turnin: 達成済みで報告待ち（優先的に上に出す）
    //  - active: 受注中で進行中
    //  - available: まだ受注していない、QUESTS内の全クエスト
    refreshList() {
        if (!this.listContainer?.active) return;
        this.scene.tweens.killTweensOf(this.listContainer);
        this.listContainer.removeAll(true);
        this.rows = [];

        const qm = this.scene.questManager;
        const turnin = [];
        const active = [];
        const available = [];

        Object.keys(QUESTS).forEach(id => {
            const def = QUESTS[id];
            if (qm.isFinished(id)) return; // 報告済みは一覧から消す
            // まだ解放されていないマップのクエストは、掲示板にも出さない（前のマップのクリアクエストを全て達成すると出る）
            if (!qm.isStarted(id) && !qm.canStart(id)) return;
            if (qm.isCompleted(id)) {
                turnin.push({ id, def });
            } else if (qm.isStarted(id)) {
                active.push({ id, def });
            } else {
                available.push({ id, def });
            }
        });

        [...turnin.map(q => ({ ...q, mode: 'turnin' })),
         ...active.map(q => ({ ...q, mode: 'active' })),
         ...available.map(q => ({ ...q, mode: 'available' }))]
            .forEach((row, index) => this.addRow(row, index));
    }

    addRow({ id, def, mode }, index) {
        const y = -180 + index * 80;
        const box = this.scene.add.container(0, y);

        const boxBg = this.scene.add.graphics();
        this.drawBox(boxBg, 0x0f3460, 0.5, 0x4a90e2, 0.3);
        box.add(boxBg);

        const modeLabel = { turnin: '【報告可】', active: '【進行中】', available: '【受注可】' }[mode];
        const modeColor = { turnin: '#ffd700', active: '#66ccff', available: '#ffffff' }[mode];

        const title = this.scene.add.text(-270, -22, `${modeLabel} ${def.title}`, {
            fontSize: '12px', fontFamily: UI_FONT, color: modeColor
        }).setOrigin(0, 0.5);
        box.add(title);

        const desc = this.scene.add.text(-270, 2, def.description, {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff',
            wordWrap: { width: 400 }
        }).setOrigin(0, 0.5);
        box.add(desc);

        let progressStr = '';
        if (mode === 'active') {
            const q = this.scene.questManager.quests[id];
            progressStr = `進捗 ${q.progress}/${q.required}`;
        } else if (mode === 'turnin') {
            progressStr = '達成！';
        }
        const rewardStr = `報酬: EXP${def.reward?.exp || 0} / ${def.reward?.gold || 0}G${def.reward?.item ? ' + アイテム' : ''}`;

        const info = this.scene.add.text(260, -10, progressStr, {
            fontSize: '11px', fontFamily: UI_FONT, color: '#ffff00'
        }).setOrigin(1, 0.5);
        box.add(info);

        const reward = this.scene.add.text(260, 14, rewardStr, {
            fontSize: '11px', fontFamily: UI_FONT, color: '#aaaaaa'
        }).setOrigin(1, 0.5);
        box.add(reward);

        box.setSize(560, 70);
        box.setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => {
            this.selectedIndex = index;
            this.updateSelection();
            this.activateSelected();
        });

        this.listContainer.add(box);
        this.rows.push({ id, def, mode, box, bgGfx: boxBg });
    }

    drawBox(gfx, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(-280, -35, 560, 70, 10);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(-280, -35, 560, 70, 10);
    }

    updateSelection() {
        if (!this.listContainer?.active) return;
        this.rows.forEach((row, index) => {
            if (index === this.selectedIndex) {
                this.drawBox(row.bgGfx, 0x4a90e2, 0.4, 0xffffff, 1);
                const targetY = -(Math.max(0, index - 2) * 80);
                this.scene.tweens.add({ targets: this.listContainer, y: targetY, duration: 150, ease: 'Power2' });
            } else {
                this.drawBox(row.bgGfx, 0x0f3460, 0.5, 0x4a90e2, 0.3);
            }
        });
    }

    activateSelected() {
        const row = this.rows[this.selectedIndex];
        if (!row) return;
        const qm = this.scene.questManager;

        if (row.mode === 'available') {
            qm.startQuest(row.id);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`クエスト「${row.def.title}」を受注した！`, 'success');
        } else if (row.mode === 'turnin') {
            qm.finishQuest(row.id);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`クエスト「${row.def.title}」を報告した！`, 'success');
        } else {
            return; // 進行中クエストは一覧確認のみ
        }

        this.refreshList();
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.rows.length - 1));
        this.updateSelection();
    }

    destroy() {
        if (this.keyHandler && this.scene?.input?.keyboard) {
            this.scene.input.keyboard.off('keydown', this.keyHandler);
        }
        this.keyHandler = null;
        if (this.listContainer && this.scene?.tweens) this.scene.tweens.killTweensOf(this.listContainer);
        if (this.listContainer?.clearMask) this.listContainer.clearMask(true);
        if (this.maskShape?.active) this.maskShape.destroy();
        this.maskShape = null;
        this.rows = [];
        super.destroy();
        this.container = null;
        this.overlay = null;
        this.listContainer = null;
    }
}
