import { pinToScreen } from '../utils/screenFixed.js';
import { QUEST_UI_CONFIG } from '../gameConstants.js';

const MAX_VISIBLE = QUEST_UI_CONFIG.TRACKER_MAX_VISIBLE; // 残りは「他N件」、詳細はクエストウィンドウで

export default class QuestTrackerUI {
    constructor(scene, questManager) {
        this.scene = scene;
        this.questManager = questManager;
        this.questItems = [];
        this.collapsed = false; // ヘッダーをクリックで折りたたみ/展開
        this.lastQuests = [];

        const gameWidth = scene.scale.gameSize ? scene.scale.gameSize.width : scene.scale.width;
        const panelWidth = 280;
        const margin = 20;

        const safeX = gameWidth - panelWidth - margin;
        const safeY = margin;
        this.container = scene.add.container(safeX, safeY).setScrollFactor(0).setDepth(1000);
        pinToScreen(this.container);

        if (scene.scale) {
            scene.scale.on('resize', () => {
                const newWidth = scene.scale.gameSize ? scene.scale.gameSize.width : scene.scale.width;
                this.container.setPosition(newWidth - panelWidth - margin, margin);
            });
        }

        // 背景パネル (ガラス効果)
        this.bgGfx = scene.add.graphics();
        this.container.add(this.bgGfx);

        // タイトル
        this.title = scene.add.text(15, 12, '📜 QUESTS', {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: '"Press Start 2P"',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.container.add(this.title);

        // ヘッダー全体をクリックすると折りたたみ/展開
        this.toggleIcon = scene.add.text(panelWidth - 20, 12, '▼', {
            fontSize: '12px', color: '#ffffff', fontFamily: 'Arial'
        }).setOrigin(1, 0);
        this.container.add(this.toggleIcon);
        const headerHit = scene.add.rectangle(0, 0, panelWidth, 35, 0x000000, 0)
            .setOrigin(0).setInteractive({ useHandCursor: true });
        headerHit.on('pointerdown', (pointer, x, y, event) => {
            if (event) event.stopPropagation();
            this.collapsed = !this.collapsed;
            this.update(this.lastQuests);
        });
        this.container.add(headerHit);

        this.questContainer = scene.add.container(0, 40);
        this.container.add(this.questContainer);

        questManager.onUpdate(quests => {
            this.update(quests);
        });

        this.update(questManager.getActiveQuests());
    }

    drawBackground(width, height) {
        this.bgGfx.clear();
        this.bgGfx.fillStyle(0x1a1a2e, 0.85);
        this.bgGfx.fillRoundedRect(0, 0, width, height, 12);
        this.bgGfx.lineStyle(2, 0x4a90e2, 0.8);
        this.bgGfx.strokeRoundedRect(0, 0, width, height, 12);

        // ヘッダー線
        this.bgGfx.lineStyle(2, 0x4a90e2, 0.3);
        this.bgGfx.lineBetween(10, 35, width - 10, 35);
    }

    update(quests) {
        this.lastQuests = quests || [];

        // 全要素を一括削除
        if (this.questContainer && this.questContainer.active) {
            this.questContainer.removeAll(true);
        }

        // 個別の参照リストもクリア
        this.questItems = [];

        const total = this.lastQuests.length;
        this.title.setText(total ? `📜 QUESTS (${total})` : '📜 QUESTS');
        this.toggleIcon.setText(this.collapsed ? '▶' : '▼');

        // 折りたたみ中、またはクエスト無しはヘッダーだけ表示
        if (this.collapsed || !total) {
            this.drawBackground(280, 50);
            return;
        }

        // 達成済み(報告待ち)を先頭に、最大MAX_VISIBLE件だけ表示
        const sorted = [...this.lastQuests].sort(
            (a, b) => (b.status === 'completed') - (a.status === 'completed'));
        const shown = sorted.slice(0, MAX_VISIBLE);

        let yOffset = 0;
        shown.forEach((q) => {
            const questItem = this.createQuestItem(q, yOffset);
            this.questItems.push(questItem);
            this.questContainer.add(questItem.container);
            yOffset += questItem.height + 10;
        });

        const hidden = total - shown.length;
        if (hidden > 0) {
            const more = this.scene.add.text(140, yOffset - 2, `他${hidden}件… [Q]で一覧`, {
                fontSize: '8px', color: '#aaaaaa', fontFamily: '"Press Start 2P"'
            }).setOrigin(0.5, 0);
            this.questContainer.add(more);
            yOffset += 20;
        }

        this.drawBackground(280, Math.max(50, yOffset + 50));
    }

    createQuestItem(quest, yOffset) {
        const container = this.scene.add.container(10, yOffset);
        const width = 260;
        const height = 55;

        const isCompleted = quest.status === 'completed';
        const accentColor = isCompleted ? 0x00ffcc : 0x4a90e2;

        // 背景
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.3);
        bg.fillRoundedRect(0, 0, width, height, 8);
        bg.lineStyle(1, accentColor, 0.3);
        bg.strokeRoundedRect(0, 0, width, height, 8);
        container.add(bg);

        // アイコン (絵文字)
        const icon = this.scene.add.text(10, 10, isCompleted ? '✅' : '🎯', { fontSize: '14px' });
        container.add(icon);

        // タイトル
        const title = this.scene.add.text(32, 12, quest.title, {
            fontSize: '9px',
            color: isCompleted ? '#00ffcc' : '#ffffff',
            fontFamily: '"Press Start 2P"'
        });
        container.add(title);

        // プログレスバー背景
        const progressBg = this.scene.add.rectangle(10, 32, width - 20, 6, 0x222222).setOrigin(0, 0);
        container.add(progressBg);

        // プログレスバー
        const progressRatio = Math.min(quest.progress / quest.required, 1);
        const progressBar = this.scene.add.rectangle(10, 32, (width - 20) * progressRatio, 6, accentColor).setOrigin(0, 0);
        container.add(progressBar);

        // 数値テキスト
        const progressText = this.scene.add.text(width - 12, 42, `${quest.progress}/${quest.required}`, {
            fontSize: '8px',
            color: '#aaaaaa',
            fontFamily: '"Press Start 2P"'
        }).setOrigin(1, 0);
        container.add(progressText);

        if (isCompleted) {
            this.scene.tweens.add({
                targets: container,
                alpha: { from: 0.7, to: 1 },
                duration: 800,
                yoyo: true,
                repeat: -1
            });
        }

        return { container, height };
    }

    removeQuest(id) {
        if (this.questManager.quests[id]) {
            delete this.questManager.quests[id];
            if (this.container && this.container.active) {
                this.update(this.questManager.getActiveQuests());
            }
        }
    }
}

