import { UI_FONT } from '../fontConfig.js';
import { ACHIEVEMENTS, TITLES } from '../data/achievements.js';
import BaseWindowUI from './BaseWindowUI.js';

export default class AchievementUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🏆 実績・称号',
            width: 720,
            height: 560,
            fullScreen: true,
            depth: 120000,
            themeColor: 0xffd700,
            titleStroke: 0xffaa00,
        });
        this._tab = 'achievement'; // 'achievement' | 'title'
        this._achScrollY = 0;
        this._titleScrollY = 0;
        this._maskShape = null;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this._buildTabs();
        this._buildLists();
        this._setupInputs();
        this._switchTab(this._tab);
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        this._achScrollY = 0;
        this._titleScrollY = 0;
        if (this._achListContainer) this._achListContainer.y = this._listStartY;
        if (this._titleListContainer) this._titleListContainer.y = this._listStartY;
        this.refresh();
    }

    _buildTabs() {
        const W = this.config.width;
        const H = this.config.height;

        const tabY = -H / 2 + 50;
        const tabs = [
            { key: 'achievement', label: '🏆 実績一覧', x: -120 },
            { key: 'title',       label: '👑 称号セット', x:   60 },
        ];
        this._tabBtns = {};
        tabs.forEach(t => {
            const btn = this.scene.add.rectangle(t.x, tabY, 150, 30, 0x333366)
                .setInteractive({ useHandCursor: true });
            const lbl = this.scene.add.text(t.x, tabY, t.label, {
                fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);
            btn.on('pointerdown', () => this._switchTab(t.key));
            btn.on('pointerover', () => btn.setFillStyle(0x5566aa));
            btn.on('pointerout',  () => btn.setFillStyle(this._tab === t.key ? 0x4a90e2 : 0x333366));
            this.container.add([btn, lbl]);
            this._tabBtns[t.key] = { btn, lbl };
        });
    }

    _switchTab(key) {
        this._tab = key;
        Object.entries(this._tabBtns).forEach(([k, { btn }]) => {
            btn.setFillStyle(k === key ? 0x4a90e2 : 0x333366);
        });
        if (this._achContainer) this._achContainer.setVisible(key === 'achievement');
        if (this._titleContainer) this._titleContainer.setVisible(key === 'title');
    }

    _buildLists() {
        const W = this.config.width;
        const H = this.config.height;

        this._listStartY = -H / 2 + 80;
        this._listHeight = H - 105;

        // マスク生成 (ウィンドウ枠の内側のみを表示)
        const screenW = this.scene.scale.width;
        const screenH = this.scene.scale.height;
        this._maskShape = this.scene.add.graphics();
        this._maskShape.setScrollFactor(0);
        this._maskShape.fillStyle(0xffffff);
        this._maskShape.fillRect(
            screenW / 2 - W / 2 + 15,
            screenH / 2 - H / 2 + 80,
            W - 30,
            this._listHeight
        );
        const mask = this._maskShape.createGeometryMask();
        this._maskShape.setVisible(false);

        // 1. 実績一覧コンテナ
        this._achContainer = this.scene.add.container(0, 0);
        this.container.add(this._achContainer);

        this._achListContainer = this.scene.add.container(0, this._listStartY);
        this._achListContainer.setMask(mask);
        this._achContainer.add(this._achListContainer);

        // 2. 称号セットコンテナ
        this._titleContainer = this.scene.add.container(0, 0);
        this.container.add(this._titleContainer);

        this._titleListContainer = this.scene.add.container(0, this._listStartY);
        this._titleListContainer.setMask(mask);
        this._titleContainer.add(this._titleListContainer);
    }

    scrollBy(deltaY) {
        if (this._tab === 'achievement') {
            const totalHeight = Object.keys(ACHIEVEMENTS).length * 68;
            const maxScroll = Math.max(0, totalHeight - this._listHeight);
            this._achScrollY = Phaser.Math.Clamp(this._achScrollY - deltaY, -maxScroll, 0);
            this._achListContainer.y = this._listStartY + this._achScrollY;
        } else if (this._tab === 'title') {
            const totalHeight = (TITLES.length + 2) * 44;
            const maxScroll = Math.max(0, totalHeight - this._listHeight);
            this._titleScrollY = Phaser.Math.Clamp(this._titleScrollY - deltaY, -maxScroll, 0);
            this._titleListContainer.y = this._listStartY + this._titleScrollY;
        }
    }

    _setupInputs() {
        // マウスホイール
        this._onWheel = (pointer, gameObjects, deltaX, deltaY) => {
            if (!this.isOpen) return;
            this.scrollBy(deltaY * 0.5);
        };
        this.scene.input.on('wheel', this._onWheel);

        // 矢印キー & WASDキーによるスクロール & タブ切替
        this._onKeyDown = (event) => {
            if (!this.isOpen) return;

            const code = event.code;
            if (code === 'ArrowDown' || code === 'KeyS') {
                this.scrollBy(45);
            } else if (code === 'ArrowUp' || code === 'KeyW') {
                this.scrollBy(-45);
            } else if (code === 'ArrowLeft' || code === 'KeyA') {
                this._switchTab('achievement');
            } else if (code === 'ArrowRight' || code === 'KeyD') {
                this._switchTab('title');
            }
        };
        this.scene.input.keyboard.on('keydown', this._onKeyDown);
    }

    _getProgress(ach, stats) {
        const counter = stats.achievementCounters || {};
        const { type, value } = ach.condition;
        let cur = 0;
        switch (type) {
            case 'kills': cur = counter.kills || 0; break;
            case 'level': cur = stats.level || 1; break;
            case 'reincarnation': cur = stats.reincarnationCount || 0; break;
            case 'jobMaster': cur = counter.jobsUnlocked || 0; break;
            case 'gold': cur = counter.totalGoldEarned || 0; break;
            case 'skillMaxLevel': cur = Object.values(stats.skillLevels || {}).filter(lv => lv >= 10).length; break;
            case 'enhance': cur = Math.max(0, ...(Object.values(stats.enhanceLevels || {}))); break;
        }
        return { cur: Math.min(value, cur), max: value };
    }

    refresh() {
        const player = this.scene.player;
        if (!player) return;

        const stats = player.stats;
        const achievements = stats.achievements || {};
        const unlockedTitles = stats.unlockedTitles || [];
        const activeTitle = stats.activeTitle || null;

        // --- 1. 実績リスト描画 ---
        this._achListContainer.removeAll(true);
        const achList = Object.values(ACHIEVEMENTS);
        achList.forEach((ach, i) => {
            const isUnlocked = !!achievements[ach.id];
            const isSecret = !!ach.secret && !isUnlocked;
            const y = i * 68;

            const bg = this.scene.add.graphics();
            bg.fillStyle(isUnlocked ? 0x15351a : (isSecret ? 0x121218 : 0x151d2c), 0.9);
            bg.fillRoundedRect(-330, y, 660, 60, 8);
            bg.lineStyle(1, isUnlocked ? 0x44ff44 : (isSecret ? 0x442255 : 0x3a5078), 0.7);
            bg.strokeRoundedRect(-330, y, 660, 60, 8);

            const icon = this.scene.add.text(-310, y + 30, isUnlocked ? '✅' : (isSecret ? '❓' : '🔒'), {
                fontSize: '22px'
            }).setOrigin(0, 0.5).setAlpha(isUnlocked ? 1 : 0.6);

            const displayName = isSecret ? '？？？？？（シークレット実績）' : ach.name;
            const nameColor = isUnlocked ? '#ffff55' : (isSecret ? '#aa88cc' : '#cccccc');
            const nameText = this.scene.add.text(-275, y + 8, displayName, {
                fontSize: '13px', fontFamily: UI_FONT, color: nameColor
            });

            const displayDesc = isSecret ? 'めずらしい隠し実績です。特別な条件を果たすと解除されます。' : ach.description;
            const descText = this.scene.add.text(-275, y + 26, displayDesc, {
                fontSize: '10px', fontFamily: UI_FONT, color: isUnlocked ? '#aaccff' : '#888888'
            });

            const { cur, max } = this._getProgress(ach, stats);
            let reqStr = '';
            if (isUnlocked) {
                reqStr = '【達成済み】';
            } else if (isSecret) {
                reqStr = '条件: ？？？？？';
            } else {
                reqStr = `条件: ${ach.reqText || ''} (${cur}/${max})`;
            }
            const reqText = this.scene.add.text(-275, y + 43, reqStr, {
                fontSize: '10px', fontFamily: UI_FONT, color: isUnlocked ? '#44ff44' : '#ffaa44'
            });

            if (ach.title) {
                const displayTitle = isSecret ? '称号: ？？？' : `称号: ${ach.title}`;
                const titleText = this.scene.add.text(310, y + 30, displayTitle, {
                    fontSize: '12px', fontFamily: UI_FONT,
                    color: isUnlocked ? (ach.titleColor || '#ffff00') : '#555555'
                }).setOrigin(1, 0.5);
                this._achListContainer.add(titleText);
            }

            this._achListContainer.add([bg, icon, nameText, descText, reqText]);
        });

        // --- 2. 称号リスト描画 ---
        this._titleListContainer.removeAll(true);
        const W = this.config.width;

        // 現在の称号ヘッダー
        const curTitleLabel = activeTitle ? `現在の称号: ${activeTitle}` : '現在の称号: （なし）';
        const curHeader = this.scene.add.text(0, 5, curTitleLabel, {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffd700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5, 0);
        this._titleListContainer.add(curHeader);

        // 称号なし選択肢
        const noneSelected = !activeTitle;
        const noneBg = this.scene.add.graphics();
        noneBg.fillStyle(noneSelected ? 0x224a22 : 0x1a1a2e, 0.9);
        noneBg.fillRoundedRect(-W / 2 + 30, 30, W - 60, 38, 8);
        noneBg.lineStyle(1, noneSelected ? 0x44ff44 : 0x444455, 0.7);
        noneBg.strokeRoundedRect(-W / 2 + 30, 30, W - 60, 38, 8);

        const noneText = this.scene.add.text(0, 49, '（称号を外す）', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        const noneBtn = this.scene.add.rectangle(0, 49, W - 60, 38, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        noneBtn.on('pointerdown', () => {
            player.stats.activeTitle = null;
            player.stats.activeTitleColor = null;
            player.saveStats();
            if (this.scene.networkManager) {
                this.scene.networkManager.sendTitleUpdate(null, null);
            }
            if (player.nameUI) player.nameUI.setTitle(null);
            if (this.scene.playerNameUI) this.scene.playerNameUI.setTitle(null);
            this.refresh();
        });
        this._titleListContainer.add([noneBg, noneText, noneBtn]);

        // 各称号の行
        TITLES.forEach((t, i) => {
            const isUnlocked = unlockedTitles.includes(t.title);
            const isActive = activeTitle === t.title;
            const isSecret = t.secret && !isUnlocked;
            const y = 78 + i * 44;

            const bg = this.scene.add.graphics();
            bg.fillStyle(isActive ? 0x1d441d : (isUnlocked ? 0x18283a : 0x111115), 0.9);
            bg.fillRoundedRect(-W / 2 + 30, y, W - 60, 38, 8);
            bg.lineStyle(1, isActive ? 0x44ff44 : (isUnlocked ? 0x4a70aa : 0x333333), 0.7);
            bg.strokeRoundedRect(-W / 2 + 30, y, W - 60, 38, 8);

            const displayLabel = isSecret ? '？？？（シークレット実績で解除）' : t.title;
            const labelColor = isUnlocked ? (t.color || '#ffffff') : (isSecret ? '#554466' : '#555555');
            const label = this.scene.add.text(-W / 2 + 50, y + 19, displayLabel, {
                fontSize: '13px', fontFamily: UI_FONT, color: labelColor
            }).setOrigin(0, 0.5);

            if (isActive) {
                const activeBadge = this.scene.add.text(W / 2 - 50, y + 19, '👑 装備中', {
                    fontSize: '11px', fontFamily: UI_FONT, color: '#44ff44'
                }).setOrigin(1, 0.5);
                this._titleListContainer.add(activeBadge);
            } else if (isUnlocked) {
                const equipHint = this.scene.add.text(W / 2 - 50, y + 19, 'クリックで装備', {
                    fontSize: '10px', fontFamily: UI_FONT, color: '#88aaff'
                }).setOrigin(1, 0.5);
                this._titleListContainer.add(equipHint);

                const btn = this.scene.add.rectangle(0, y + 19, W - 60, 38, 0x000000, 0)
                    .setInteractive({ useHandCursor: true });
                btn.on('pointerdown', () => {
                    player.stats.activeTitle = t.title;
                    player.stats.activeTitleColor = t.color;
                    player.saveStats();
                    if (this.scene.networkManager) {
                        this.scene.networkManager.sendTitleUpdate(t.title, t.color);
                    }
                    if (player.nameUI) player.nameUI.setTitle(t.title, t.color);
                    if (this.scene.playerNameUI) this.scene.playerNameUI.setTitle(t.title, t.color);
                    this.scene.notificationUI?.show(`称号「${t.title}」を頭上にセットしました！`, 'success');
                    this.refresh();
                });
                this._titleListContainer.add(btn);
            } else if (!isSecret) {
                const lockHint = this.scene.add.text(W / 2 - 50, y + 19, `🔒 ${t.reqText || '未解除'}`, {
                    fontSize: '10px', fontFamily: UI_FONT, color: '#666666'
                }).setOrigin(1, 0.5);
                this._titleListContainer.add(lockHint);
            }

            this._titleListContainer.add([bg, label]);
        });
    }

    destroy() {
        if (this._onWheel && this.scene?.input) {
            this.scene.input.off('wheel', this._onWheel);
            this._onWheel = null;
        }
        if (this._onKeyDown && this.scene?.input?.keyboard) {
            this.scene.input.keyboard.off('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._maskShape) {
            this._maskShape.destroy();
            this._maskShape = null;
        }
        super.destroy();
    }
}
