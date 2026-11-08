import { UI_FONT } from '../fontConfig.js';
import { ITEMS } from '../data/items.js';
import BaseWindowUI from './BaseWindowUI.js';

export default class TradeUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🤝 トレード',
            width: 700,
            height: 520,
            depth: 130000,
            themeColor: 0x44aaff,
            titleStroke: 0x2288dd,
        });
        this.tradeSession = null;
        this._selectedSlot = 0;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this._buildLayout();
    }

    _buildLayout() {
        const W = this.config.width;
        const H = this.config.height;

        // --- 相手選択ダイアログ (トレード開始前) ---
        this._playerSelectContainer = this.scene.add.container(0, 0);
        this.container.add(this._playerSelectContainer);

        // --- トレードセッション中コンテナ ---
        this._sessionContainer = this.scene.add.container(0, 0);
        this._sessionContainer.setVisible(false);
        this.container.add(this._sessionContainer);

        this._buildPlayerSelectView();
        this._buildSessionView();
    }

    _buildPlayerSelectView() {
        const W = this.config.width;
        const H = this.config.height;

        const label = this.scene.add.text(0, -H / 2 + 70, 'トレード相手を選んでリクエストを送信', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        this._playerSelectContainer.add(label);

        this._playerListContainer = this.scene.add.container(0, -H / 2 + 105);
        this._playerSelectContainer.add(this._playerListContainer);
    }

    _refreshPlayerList() {
        this._playerListContainer.removeAll(true);
        const otherPlayers = this.scene.networkManager?.getOtherPlayers() || {};
        const playerNames = this.scene.registry.get('playerNames') || {};
        const playerIds = Object.keys(otherPlayers).filter(id => otherPlayers[id]?.active);

        const W = this.config.width;

        if (playerIds.length === 0) {
            const emptyTxt = this.scene.add.text(0, 60, '現在同じマップに他のプレイヤーがいません', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
            }).setOrigin(0.5);
            this._playerListContainer.add(emptyTxt);
            return;
        }

        playerIds.forEach((id, idx) => {
            const y = idx * 50;
            const name = playerNames[id] || `Player ${id.substring(0, 6)}`;
            const op = otherPlayers[id];
            const title = op?.activeTitle ? `${op.activeTitle} ` : '';

            const bg = this.scene.add.graphics();
            bg.fillStyle(0x1a263a, 0.9);
            bg.fillRoundedRect(-W / 2 + 30, y, W - 60, 42, 8);
            bg.lineStyle(1, 0x4a70aa, 0.6);
            bg.strokeRoundedRect(-W / 2 + 30, y, W - 60, 42, 8);

            const nameTxt = this.scene.add.text(-W / 2 + 50, y + 21, `${title}${name}`, {
                fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0, 0.5);

            const reqBtn = this.scene.add.rectangle(W / 2 - 80, y + 21, 100, 28, 0x0088cc)
                .setInteractive({ useHandCursor: true });
            const reqTxt = this.scene.add.text(W / 2 - 80, y + 21, '🤝 申請', {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);

            reqBtn.on('pointerdown', () => {
                this.scene.networkManager?.sendTradeRequest(id);
                this.scene.notificationUI?.show(`${name} にトレード申請を送信しました`, 'info');
            });
            reqBtn.on('pointerover', () => reqBtn.setFillStyle(0x00aaff));
            reqBtn.on('pointerout', () => reqBtn.setFillStyle(0x0088cc));

            this._playerListContainer.add([bg, nameTxt, reqBtn, reqTxt]);
        });
    }

    _buildSessionView() {
        const W = this.config.width;
        const H = this.config.height;

        // 左右カラム (左: 自分, 右: 相手)
        const myLabel = this.scene.add.text(-W / 2 + 35, -H / 2 + 55, '自分の提供アイテム（最大4個・クリックで選択/解除）', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#88ffff'
        });
        this._sessionContainer.add(myLabel);

        this._mySlotGraphics = [];
        this._mySlotTexts = [];
        for (let i = 0; i < 4; i++) {
            const sx = -W / 2 + 95 + (i % 2) * 125;
            const sy = -H / 2 + 120 + Math.floor(i / 2) * 85;

            const slotBg = this.scene.add.rectangle(sx, sy, 115, 75, 0x1a2a3a)
                .setStrokeStyle(1, 0x446688).setInteractive({ useHandCursor: true });
            const slotText = this.scene.add.text(sx, sy, '（空き）', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#666666', align: 'center'
            }).setOrigin(0.5);

            const slotIdx = i;
            slotBg.on('pointerdown', () => this._onMySlotClick(slotIdx));
            slotBg.on('pointerover', () => slotBg.setStrokeStyle(2, 0x88aaff));
            slotBg.on('pointerout',  () => slotBg.setStrokeStyle(1, 0x446688));

            this._sessionContainer.add([slotBg, slotText]);
            this._mySlotGraphics.push(slotBg);
            this._mySlotTexts.push(slotText);
        }

        // 中央
        const divider = this.scene.add.text(0, -H / 2 + 160, '⇄', {
            fontSize: '28px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        this._sessionContainer.add(divider);

        // 相手の提供欄
        this._partnerNameText = this.scene.add.text(W / 2 - 35, -H / 2 + 55, '相手の提供アイテム', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffaa88'
        }).setOrigin(1, 0);
        this._sessionContainer.add(this._partnerNameText);

        this._partnerSlotTexts = [];
        for (let i = 0; i < 4; i++) {
            const sx = W / 2 - 220 + (i % 2) * 125;
            const sy = -H / 2 + 120 + Math.floor(i / 2) * 85;

            const slotBg = this.scene.add.rectangle(sx, sy, 115, 75, 0x1a1a2a)
                .setStrokeStyle(1, 0x664488);
            const slotText = this.scene.add.text(sx, sy, '（空き）', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#555555', align: 'center'
            }).setOrigin(0.5);

            this._sessionContainer.add([slotBg, slotText]);
            this._partnerSlotTexts.push(slotText);
        }

        // ステータス表示
        this._myReadyText = this.scene.add.text(-130, H / 2 - 80, '⬜ 未確定', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        this._partnerReadyText = this.scene.add.text(130, H / 2 - 80, '⬜ 未確定', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        this._sessionContainer.add([this._myReadyText, this._partnerReadyText]);

        // 確定ボタン
        this._confirmBtn = this.scene.add.rectangle(-130, H / 2 - 40, 160, 36, 0x00aa00)
            .setInteractive({ useHandCursor: true });
        this._confirmTxt = this.scene.add.text(-130, H / 2 - 40, '✅ 確定する', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        this._confirmBtn.on('pointerover', () => this._confirmBtn.setFillStyle(0x00ff00));
        this._confirmBtn.on('pointerout',  () => this._confirmBtn.setFillStyle(0x00aa00));
        this._confirmBtn.on('pointerdown', () => this._onConfirm());
        this._sessionContainer.add([this._confirmBtn, this._confirmTxt]);

        // キャンセルボタン
        const cancelBtn = this.scene.add.rectangle(130, H / 2 - 40, 160, 36, 0xaa0000)
            .setInteractive({ useHandCursor: true });
        const cancelTxt = this.scene.add.text(130, H / 2 - 40, '❌ キャンセル', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xff0000));
        cancelBtn.on('pointerout',  () => cancelBtn.setFillStyle(0xaa0000));
        cancelBtn.on('pointerdown', () => this._onCancel());
        this._sessionContainer.add([cancelBtn, cancelTxt]);

        // アイテムピッカー
        this._itemPickerContainer = this.scene.add.container(0, 0);
        this._itemPickerContainer.setVisible(false);
        this.container.add(this._itemPickerContainer);
    }

    open() {
        if (!this.container) this.createUI();
        super.open();
        if (this.tradeSession) {
            this._playerSelectContainer.setVisible(false);
            this._sessionContainer.setVisible(true);
            this._refreshSessionUI();
        } else {
            this._playerSelectContainer.setVisible(true);
            this._sessionContainer.setVisible(false);
            this._refreshPlayerList();
        }
    }

    startSession(partnerId, partnerName) {
        this.tradeSession = {
            partnerId,
            partnerName,
            myOffer: [],
            partnerOffer: [],
            myReady: false,
            partnerReady: false,
        };
        if (!this.container) this.createUI();
        super.open();
        this._playerSelectContainer.setVisible(false);
        this._sessionContainer.setVisible(true);
        this._itemPickerContainer.setVisible(false);
        this._refreshSessionUI();
    }

    _refreshSessionUI() {
        if (!this.tradeSession) return;
        const { myOffer, partnerOffer, partnerName, myReady, partnerReady } = this.tradeSession;

        for (let i = 0; i < 4; i++) {
            const item = myOffer[i];
            if (item) {
                const def = ITEMS[item.id];
                this._mySlotTexts[i].setText(`${def?.icon || '📦'}\n${def?.name || item.id}\nx${item.count}`)
                    .setColor('#ffffff');
            } else {
                this._mySlotTexts[i].setText('（空き）').setColor('#666666');
            }
        }

        this._partnerNameText.setText(`${partnerName} の提供アイテム`);
        for (let i = 0; i < 4; i++) {
            const item = partnerOffer[i];
            if (item) {
                const def = ITEMS[item.id];
                this._partnerSlotTexts[i].setText(`${def?.icon || '📦'}\n${def?.name || item.id}\nx${item.count}`)
                    .setColor('#ffddcc');
            } else {
                this._partnerSlotTexts[i].setText('（空き）').setColor('#555555');
            }
        }

        this._myReadyText.setText(myReady ? '✅ 確定済' : '⬜ 未確定')
            .setColor(myReady ? '#44ff44' : '#888888');
        this._partnerReadyText.setText(partnerReady ? '✅ 確定済' : '⬜ 未確定')
            .setColor(partnerReady ? '#44ff44' : '#888888');
    }

    _onMySlotClick(slotIdx) {
        if (this.tradeSession?.myReady) {
            this.scene.notificationUI?.show('確定後は提供アイテムを変更できません', 'error');
            return;
        }
        if (this.tradeSession?.myOffer[slotIdx]) {
            this.tradeSession.myOffer.splice(slotIdx, 1);
            this._syncOffer();
            this._refreshSessionUI();
        } else {
            this._openItemPicker(slotIdx);
        }
    }

    _openItemPicker(slotIdx) {
        this._itemPickerContainer.removeAll(true);
        this._itemPickerContainer.setVisible(true);

        const bg = this.scene.add.rectangle(0, 0, 520, 360, 0x0b1329, 0.98)
            .setStrokeStyle(2, 0x4488ff);
        const title = this.scene.add.text(0, -150, '提供するアイテムを選択', {
            fontSize: '15px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        this._itemPickerContainer.add([bg, title]);

        const inventory = this.scene.player?.stats?.inventory || [];
        const alreadyOffered = this.tradeSession.myOffer.map(o => o?.id).filter(Boolean);

        let yOff = -110;
        let validItemCount = 0;
        inventory.forEach(entry => {
            const itemId = typeof entry === 'string' ? entry : entry.id;
            const count = typeof entry === 'string' ? 1 : entry.count;
            const def = ITEMS[itemId];
            if (!def) return;
            if (alreadyOffered.includes(itemId)) return;

            validItemCount++;
            if (validItemCount > 6) return; // 表示上限

            const row = this.scene.add.rectangle(0, yOff, 480, 36, 0x1a2a3a)
                .setStrokeStyle(1, 0x446688).setInteractive({ useHandCursor: true });
            const label = this.scene.add.text(-220, yOff, `${def.icon || '📦'} ${def.name}  x${count}`, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0, 0.5);

            row.on('pointerdown', () => {
                this.tradeSession.myOffer[slotIdx] = { id: itemId, count: 1 };
                this._itemPickerContainer.setVisible(false);
                this._syncOffer();
                this._refreshSessionUI();
            });
            row.on('pointerover', () => row.setFillStyle(0x2a3a4a));
            row.on('pointerout',  () => row.setFillStyle(0x1a2a3a));

            this._itemPickerContainer.add([row, label]);
            yOff += 42;
        });

        if (validItemCount === 0) {
            const noItem = this.scene.add.text(0, 0, '交換可能なアイテムがありません', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
            }).setOrigin(0.5);
            this._itemPickerContainer.add(noItem);
        }

        const closeBtn = this.scene.add.text(230, -150, '✕', {
            fontSize: '18px', fontFamily: UI_FONT, color: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this._itemPickerContainer.setVisible(false));
        this._itemPickerContainer.add(closeBtn);
    }

    _syncOffer() {
        if (this.scene.networkManager && this.tradeSession) {
            this.scene.networkManager.sendTradeOffer(
                this.tradeSession.partnerId,
                this.tradeSession.myOffer
            );
        }
    }

    _onConfirm() {
        if (!this.tradeSession) return;
        this.tradeSession.myReady = true;
        this._refreshSessionUI();
        if (this.scene.networkManager) {
            this.scene.networkManager.sendTradeConfirm(this.tradeSession.partnerId);
        }
    }

    _onCancel() {
        if (this.scene.networkManager && this.tradeSession) {
            this.scene.networkManager.sendTradeCancel(this.tradeSession.partnerId);
        }
        this.closeSession('トレードをキャンセルしました');
    }

    onPartnerOffer(offer) {
        if (!this.tradeSession) return;
        this.tradeSession.partnerOffer = offer || [];
        this._refreshSessionUI();
    }

    onPartnerReady() {
        if (!this.tradeSession) return;
        this.tradeSession.partnerReady = true;
        this._refreshSessionUI();
        this.scene.notificationUI?.show('相手がトレードを確定しました', 'info');
    }

    onTradeComplete(lostItems = [], gainedItems = []) {
        const player = this.scene.player;
        if (player) {
            // 出したアイテムを削除
            lostItems.forEach(item => {
                const idx = player.stats.inventory.findIndex(e => (typeof e === 'string' ? e : e.id) === item.id);
                if (idx !== -1) {
                    const entry = player.stats.inventory[idx];
                    if (typeof entry === 'object' && entry.count > item.count) {
                        entry.count -= item.count;
                    } else {
                        player.stats.inventory.splice(idx, 1);
                    }
                }
            });
            // 得たアイテムを追加
            gainedItems.forEach(item => {
                player.addItem(item.id, item.count);
            });
            player.saveStats();
        }
        this.closeSession('✅ トレードが成立しました！');
    }

    closeSession(reason = '') {
        this.tradeSession = null;
        this._itemPickerContainer?.setVisible(false);
        this._playerSelectContainer?.setVisible(true);
        this._sessionContainer?.setVisible(false);
        super.close();
        if (reason && this.scene.notificationUI) {
            this.scene.notificationUI.show(reason, 'info');
        }
    }
}
