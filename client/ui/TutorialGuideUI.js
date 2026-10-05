import { UI_FONT } from '../fontConfig.js';
import { TUTORIAL_STEPS } from '../data/tutorialSteps.js';
import { isAnyWindowOpen } from '../utils/uiState.js';

// 初回プレイ中に、「次に何をするか」と「なぜそれをするのか」を手順ごとに案内する常駐ガイド。
// 手順の中身は data/tutorialSteps.js（ここは表示と達成判定の仕組みだけ）。
//
//  - 達成判定は毎回「今の状態」から行う（職業・割り振り・装備・クエスト進行など）ので、
//    セーブを読み込んだ後や別のPCで続けても、すでに済ませた手順は完了表示になる。
//  - 状態からは分からない操作（歩いた・攻撃した・画面を開いた）は player.stats.tutorialFlags に記録し、セーブに保存する。
//  - [H] で小さく/大きく切り替え。画面（持ち物など）を開いている間は邪魔にならないよう隠れる。
//  - 手順を終えるたびに通知を出す。

const PANEL_WIDTH = 410;
const PAD = 12;
const WINDOW_FLAGS = [
    // [scene上のUI名, 記録するフラグ]
    ['inventoryUI', 'openedInventory'],
    ['equipmentUI', 'openedEquip'],
    ['statAllocationUI', 'openedStats'],
    ['skillManagerUI', 'openedSkills'],
    ['questLogUI', 'openedQuests'],
    ['blacksmithUI', 'openedBlacksmith'],
    ['shopUI', 'openedShop'],
];

export default class TutorialGuideUI {
    constructor(scene) {
        this.scene = scene;
        this.minimized = false;
        this.doneIds = null; // 初回の描画では「完了通知」を出さないための比較用

        const { width } = scene.scale;
        this.panelWidth = Math.min(PANEL_WIDTH, width - 24);

        this.container = scene.add.container(width - this.panelWidth / 2 - 12, 98)
            .setScrollFactor(0)
            .setDepth(290000);

        this.bg = scene.add.graphics();
        const font = UI_FONT;
        const wrap = { width: this.panelWidth - PAD * 2, useAdvancedWrap: true };

        this.header = scene.add.text(0, 0, '', { fontSize: '11px', fontFamily: font, color: '#ffd700' });
        this.toggleHint = scene.add.text(0, 0, '[H] 小さく', { fontSize: '11px', fontFamily: font, color: '#8aa4c8' })
            .setOrigin(1, 0);
        this.stepTitle = scene.add.text(0, 0, '', { fontSize: '11px', fontFamily: font, color: '#ffffff', wordWrap: wrap });
        this.body = scene.add.text(0, 0, '', {
            fontSize: '11px', fontFamily: font, color: '#cfe3ff', lineSpacing: 6, wordWrap: wrap,
        });
        this.checklist = scene.add.text(0, 0, '', {
            fontSize: '11px', fontFamily: font, color: '#8aa4c8', lineSpacing: 5, wordWrap: wrap,
        });
        this.container.add([this.bg, this.header, this.toggleHint, this.stepTitle, this.body, this.checklist]);

        // ヘッダーのクリック（タップ）でも切り替えられる
        this.hit = scene.add.rectangle(0, 0, this.panelWidth, 24, 0x000000, 0).setOrigin(0.5, 0)
            .setInteractive({ useHandCursor: true });
        this.hit.on('pointerdown', (p, x, y, event) => { if (event) event.stopPropagation(); this.toggle(); });
        this.container.add(this.hit);

        // 操作の記録（キー入力）
        this.onSpace = () => {
            if (this.canRecordInput()) this.setFlag('attacked');
        };
        this.onKey = (event) => {
            if (!this.canRecordInput()) return;
            const m = /^(?:Digit|Numpad)([1-8])$/.exec(event.code || '');
            if (m && this.scene.player?.stats?.activeSkills?.[Number(m[1]) - 1]) this.setFlag('usedSkill');
        };
        this.onToggleKey = () => this.toggle();
        scene.input.keyboard.on('keydown-SPACE', this.onSpace);
        scene.input.keyboard.on('keydown', this.onKey);
        scene.input.keyboard.on('keydown-H', this.onToggleKey);

        this.refresh();
        this.timer = scene.time.addEvent({ delay: 300, loop: true, callback: () => this.refresh() });
        this.unsubscribe = scene.questManager?.onUpdate(() => this.refresh(), scene);
        scene.events.once('shutdown', () => this.destroy());
        scene.events.once('destroy', () => this.destroy());
    }

    canRecordInput() {
        return !this.scene.dialogue?.isTalking && !isAnyWindowOpen(this.scene);
    }

    get flags() {
        const stats = this.scene.player?.stats;
        if (!stats) return {};
        if (!stats.tutorialFlags) stats.tutorialFlags = {};
        return stats.tutorialFlags;
    }

    setFlag(name) {
        const player = this.scene.player;
        if (!player?.stats || this.flags[name]) return;
        this.flags[name] = true;
        player.saveStats(); // 別のPCでも続きから案内されるよう、セーブに残す
    }

    toggle() {
        this.minimized = !this.minimized;
        this.refresh();
    }

    // 画面に出さない操作の記録（移動・ウィンドウを開いた）
    recordPassiveFlags() {
        const scene = this.scene;
        const body = scene.player?.body;
        if (body && Math.hypot(body.velocity.x, body.velocity.y) > 10) this.setFlag('moved');
        WINDOW_FLAGS.forEach(([ui, flag]) => {
            if (scene[ui]?.isOpen) this.setFlag(flag);
        });
    }

    refresh() {
        const player = this.scene.player;
        if (!this.container || !player?.stats) return;

        this.recordPassiveFlags();

        const ctx = { player, stats: player.stats, flags: this.flags, qm: this.scene.questManager };
        const done = TUTORIAL_STEPS.map(step => !!step.done(ctx));
        const currentIndex = Math.max(0, done.indexOf(false));
        const current = TUTORIAL_STEPS[currentIndex];

        // 新しく完了した手順を通知（最初の描画では出さない）
        const nowDone = new Set(TUTORIAL_STEPS.filter((s, i) => done[i]).map(s => s.id));
        if (this.doneIds) {
            TUTORIAL_STEPS.forEach(step => {
                if (nowDone.has(step.id) && !this.doneIds.has(step.id)) {
                    this.scene.notificationUI?.show(`ガイド: 「${step.title}」完了！`, 'success', 2500);
                }
            });
        }
        this.doneIds = nowDone;

        // --- 表示内容 ---
        const doneCount = done.filter(Boolean).length;
        const total = TUTORIAL_STEPS.length;
        this.header.setText(`はじめてガイド  ${doneCount}/${total}`);
        this.toggleHint.setText(this.minimized ? '[H] 大きく' : '[H] 小さく');

        const keyLabel = current.key ? `[${current.key}] ` : '';
        this.stepTitle.setText(`▶ ${keyLabel}${current.title}`);
        this.body.setText(current.body);
        this.checklist.setText(
            TUTORIAL_STEPS.map((s, i) => `${done[i] ? '✔' : (i === currentIndex ? '▶' : '□')}${s.short || s.title}`).join('  ')
        );

        // --- レイアウト（文章の高さに合わせて枠を作り直す） ---
        const left = -this.panelWidth / 2 + PAD;
        let y = 8;
        this.header.setPosition(left, y);
        this.toggleHint.setPosition(this.panelWidth / 2 - PAD, y + 2);
        y += 20;
        this.stepTitle.setPosition(left, y);
        y += this.stepTitle.height + 8;

        this.body.setVisible(!this.minimized);
        this.checklist.setVisible(!this.minimized);
        if (!this.minimized) {
            this.body.setPosition(left, y);
            y += this.body.height + 10;
            this.checklist.setPosition(left, y);
            y += this.checklist.height;
        }
        const height = y + 10;

        this.bg.clear();
        this.bg.fillStyle(0x081225, 0.92);
        this.bg.fillRoundedRect(-this.panelWidth / 2, 0, this.panelWidth, height, 8);
        this.bg.lineStyle(2, 0x4a90e2, 0.9);
        this.bg.strokeRoundedRect(-this.panelWidth / 2, 0, this.panelWidth, height, 8);
        this.hit.setPosition(0, 0);

        // 持ち物などの画面を開いている間は隠す（重なって見づらくなるため）
        this.container.setVisible(!isAnyWindowOpen(this.scene));
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        const kb = this.scene.input?.keyboard;
        if (kb) {
            kb.off('keydown-SPACE', this.onSpace);
            kb.off('keydown', this.onKey);
            kb.off('keydown-H', this.onToggleKey);
        }
        if (this.timer) this.timer.remove(false);
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = null;
        if (this.container) this.container.destroy();
        this.container = null;
    }
}
