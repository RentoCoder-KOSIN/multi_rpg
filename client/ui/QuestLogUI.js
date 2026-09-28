import BaseWindowUI from "./BaseWindowUI.js";
import { QUEST_UI_CONFIG } from "../gameConstants.js";

const PER_PAGE = QUEST_UI_CONFIG.LOG_PER_PAGE;

/**
 * クエスト専用ウィンドウ（ステータス画面などと同じ、ボタン/Qキーで開閉）。
 * 受注中・達成済み(報告待ち)のクエストを一覧表示し、多いときはページ送りで見る。
 * 画面右上のQuestTrackerUIは要約表示に絞り、詳細はここで確認する。
 */
export default class QuestLogUI extends BaseWindowUI {
    constructor(scene, questManager) {
        super(scene, {
            title: '📜 クエスト',
            width: 560,
            height: 520,
            depth: 120000,
            themeColor: 0x00ccaa,
            titleStroke: 0x00ccaa,
        });
        this.questManager = questManager;
        this.page = 0;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        this.bodyContainer = this.scene.add.container(0, 0);
        this.container.add(this.bodyContainer);

        this.scene.input.keyboard.on('keydown-Q', () => {
            const s = this.scene;
            if (s.inventoryUI?.isOpen || s.shopUI?.isOpen || s.equipmentUI?.isOpen ||
                s.statAllocationUI?.isOpen || s.skillManagerUI?.isOpen || s.blacksmithUI?.isOpen ||
                s.guildQuestBoardUI?.isOpen) return;
            this.toggle();
        });

        // クエストが更新されたとき、開いていれば表示を更新する
        this.questManager.onUpdate(() => {
            if (this.isOpen && this.container?.active) this.refresh();
        });
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this.page = 0;
        this.refresh();
    }

    refresh() {
        if (!this.bodyContainer?.active) return;
        this.bodyContainer.removeAll(true);

        const font = '"Press Start 2P"';
        const w = this.config.width;
        const h = this.config.height;
        const quests = this.questManager.getActiveQuests();
        const pageCount = Math.max(1, Math.ceil(quests.length / PER_PAGE));
        this.page = Math.min(this.page, pageCount - 1);

        if (!quests.length) {
            this.bodyContainer.add(this.scene.add.text(0, 0, '受注中のクエストはありません', {
                fontSize: '12px', fontFamily: font, color: '#aaaaaa'
            }).setOrigin(0.5));
            return;
        }

        const top = -h / 2 + 95;
        const itemH = 90;
        quests.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((q, i) => {
            const y = top + i * (itemH + 8);
            const done = q.status === 'completed';
            const accent = done ? 0x00ffcc : 0x4a90e2;

            const bg = this.scene.add.graphics();
            bg.fillStyle(0x000000, 0.3);
            bg.fillRoundedRect(-w / 2 + 30, y, w - 60, itemH, 10);
            bg.lineStyle(1, accent, 0.5);
            bg.strokeRoundedRect(-w / 2 + 30, y, w - 60, itemH, 10);
            this.bodyContainer.add(bg);

            this.bodyContainer.add(this.scene.add.text(-w / 2 + 45, y + 10, `${done ? '✅' : '🎯'} ${q.title}`, {
                fontSize: '11px', fontFamily: font, color: done ? '#00ffcc' : '#ffffff'
            }));
            this.bodyContainer.add(this.scene.add.text(-w / 2 + 45, y + 34, q.description || '', {
                fontSize: '9px', fontFamily: font, color: '#cccccc',
                wordWrap: { width: w - 120 }, lineSpacing: 4
            }));

            const barW = w - 200;
            const ratio = Math.min((q.progress || 0) / (q.required || 1), 1);
            this.bodyContainer.add(this.scene.add.rectangle(-w / 2 + 45, y + itemH - 18, barW, 6, 0x222222).setOrigin(0, 0));
            this.bodyContainer.add(this.scene.add.rectangle(-w / 2 + 45, y + itemH - 18, barW * ratio, 6, accent).setOrigin(0, 0));
            this.bodyContainer.add(this.scene.add.text(w / 2 - 45, y + itemH - 22,
                done ? '報告待ち' : `${q.progress || 0}/${q.required}`, {
                    fontSize: '9px', fontFamily: font, color: done ? '#00ffcc' : '#aaaaaa'
                }).setOrigin(1, 0));
        });

        // ページ送り（2ページ以上あるときだけ）
        if (pageCount > 1) {
            const py = h / 2 - 32;
            const mkBtn = (x, label, delta) => {
                const t = this.scene.add.text(x, py, label, {
                    fontSize: '18px', fontFamily: 'Arial', color: '#ffffff'
                }).setOrigin(0.5).setInteractive({ useHandCursor: true });
                t.on('pointerdown', (p, lx, ly, event) => {
                    if (event) event.stopPropagation();
                    this.page = (this.page + delta + pageCount) % pageCount;
                    this.refresh();
                });
                this.bodyContainer.add(t);
            };
            mkBtn(-80, '◀', -1);
            mkBtn(80, '▶', 1);
            this.bodyContainer.add(this.scene.add.text(0, py, `${this.page + 1} / ${pageCount}`, {
                fontSize: '11px', fontFamily: font, color: '#ffffff'
            }).setOrigin(0.5));
        }
    }
}
