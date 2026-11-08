import { UI_FONT } from '../fontConfig.js';
import { ITEMS } from '../data/items.js';
import BaseWindowUI from './BaseWindowUI.js';

/**
 * トレードUI
 * - プレイヤー選択 → 申請 → セッション開始
 * - インベントリスクロール対応アイテムピッカー
 * - ゴールドトレード対応
 * - 申請受信時にポップアップ通知UIを表示
 */
export default class TradeUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🤝 トレード',
            width: 740,
            height: 560,
            depth: 130000,
            themeColor: 0x44aaff,
            titleStroke: 0x2288dd,
        });
        this.tradeSession = null;
        // アイテムピッカーのスクロール状態
        this._pickerScrollY = 0;
        this._pickerItems = [];
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this._buildLayout();
    }

    _buildLayout() {
        // --- 相手選択ダイアログ (トレード開始前) ---
        this._playerSelectContainer = this.scene.add.container(0, 0);
        this.container.add(this._playerSelectContainer);

        // --- トレードセッション中コンテナ ---
        this._sessionContainer = this.scene.add.container(0, 0);
        this._sessionContainer.setVisible(false);
        this.container.add(this._sessionContainer);

        // --- 申請受信ポップアップ ---
        this._requestPopupContainer = this.scene.add.container(0, 0);
        this._requestPopupContainer.setVisible(false);
        this.container.add(this._requestPopupContainer);

        this._buildPlayerSelectView();
        this._buildSessionView();
        this._buildRequestPopup();
    }

    // ===== 申請受信ポップアップ =====
    _buildRequestPopup() {
        const popupBg = this.scene.add.graphics();
        popupBg.fillStyle(0x0a1a2a, 0.97);
        popupBg.fillRoundedRect(-220, -80, 440, 160, 12);
        popupBg.lineStyle(2, 0x44aaff, 1);
        popupBg.strokeRoundedRect(-220, -80, 440, 160, 12);

        this._popupTitle = this.scene.add.text(0, -50, '🤝 トレード申請', {
            fontSize: '16px', fontFamily: UI_FONT, color: '#44aaff'
        }).setOrigin(0.5);

        this._popupMsg = this.scene.add.text(0, -15, '', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);

        // 承認ボタン
        const acceptBg = this.scene.add.rectangle(-80, 40, 140, 36, 0x00aa00)
            .setInteractive({ useHandCursor: true });
        const acceptTxt = this.scene.add.text(-80, 40, '✅ 承認する', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        acceptBg.on('pointerover', () => acceptBg.setFillStyle(0x00ff00));
        acceptBg.on('pointerout', () => acceptBg.setFillStyle(0x00aa00));
        acceptBg.on('pointerdown', () => this._onAcceptTrade());

        // 拒否ボタン
        const declineBg = this.scene.add.rectangle(80, 40, 140, 36, 0xaa0000)
            .setInteractive({ useHandCursor: true });
        const declineTxt = this.scene.add.text(80, 40, '❌ 断る', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        declineBg.on('pointerover', () => declineBg.setFillStyle(0xff0000));
        declineBg.on('pointerout', () => declineBg.setFillStyle(0xaa0000));
        declineBg.on('pointerdown', () => this._onDeclineTrade());

        this._requestPopupContainer.add([
            popupBg, this._popupTitle, this._popupMsg,
            acceptBg, acceptTxt, declineBg, declineTxt
        ]);
    }

    // 申請受信時に呼ぶ（NetworkManagerから）
    showTradeRequest(fromId, fromName) {
        this._pendingFromId = fromId;
        this._pendingFromName = fromName;
        if (this._popupMsg) {
            this._popupMsg.setText(`「${fromName}」からトレード申請が届いています`);
        }
        if (!this.container) this.createUI();
        super.open();
        this._playerSelectContainer.setVisible(false);
        this._sessionContainer.setVisible(false);
        this._requestPopupContainer.setVisible(true);
    }

    _onAcceptTrade() {
        if (!this._pendingFromId) return;
        this.scene.networkManager?.sendTradeAccept(this._pendingFromId);
        this._pendingFromId = null;
        this._requestPopupContainer.setVisible(false);
        // sceneの_pendingTradeFromもクリア
        this.scene._pendingTradeFrom = null;
    }

    _onDeclineTrade() {
        if (!this._pendingFromId) return;
        this.scene.networkManager?.sendTradeDecline(this._pendingFromId);
        this._pendingFromId = null;
        this._requestPopupContainer.setVisible(false);
        this.scene._pendingTradeFrom = null;
        super.close();
        this.scene.notificationUI?.show('トレード申請を断りました', 'info');
    }

    // ===== プレイヤー選択ビュー =====
    _buildPlayerSelectView() {
        const W = this.config.width;
        const H = this.config.height;

        const label = this.scene.add.text(0, -H / 2 + 65, 'トレード相手を選んで申請ボタンを押してください', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#aaccff'
        }).setOrigin(0.5);

        const hint = this.scene.add.text(0, -H / 2 + 85, '※ 相手が承認するとトレード画面が開きます', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#666688'
        }).setOrigin(0.5);

        this._playerSelectContainer.add([label, hint]);

        this._playerListContainer = this.scene.add.container(0, -H / 2 + 115);
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
            const y = idx * 52;
            const name = playerNames[id] || `Player ${id.substring(0, 6)}`;
            const op = otherPlayers[id];
            const title = op?.activeTitle ? `${op.activeTitle} ` : '';

            const bg = this.scene.add.graphics();
            bg.fillStyle(0x1a263a, 0.9);
            bg.fillRoundedRect(-W / 2 + 25, y, W - 50, 44, 8);
            bg.lineStyle(1, 0x4a70aa, 0.6);
            bg.strokeRoundedRect(-W / 2 + 25, y, W - 50, 44, 8);

            const nameTxt = this.scene.add.text(-W / 2 + 48, y + 22, `${title}${name}`, {
                fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0, 0.5);

            const reqBtn = this.scene.add.rectangle(W / 2 - 75, y + 22, 110, 30, 0x0088cc)
                .setInteractive({ useHandCursor: true });
            const reqTxt = this.scene.add.text(W / 2 - 75, y + 22, '🤝 申請する', {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);

            reqBtn.on('pointerdown', () => {
                this.scene.networkManager?.sendTradeRequest(id);
                this.scene.notificationUI?.show(`${name} にトレード申請を送信しました\n相手が承認するまでお待ちください`, 'info');
            });
            reqBtn.on('pointerover', () => reqBtn.setFillStyle(0x00aaff));
            reqBtn.on('pointerout', () => reqBtn.setFillStyle(0x0088cc));

            this._playerListContainer.add([bg, nameTxt, reqBtn, reqTxt]);
        });
    }

    // ===== セッションビュー =====
    _buildSessionView() {
        const W = this.config.width;
        const H = this.config.height;

        // ===== 自分の提供欄 (左) =====
        const myLabel = this.scene.add.text(-W / 2 + 20, -H / 2 + 50, '自分の提供', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#88ffff'
        });
        this._sessionContainer.add(myLabel);

        // 自分アイテムスロット (縦3個)
        this._mySlotGraphics = [];
        this._mySlotTexts = [];
        for (let i = 0; i < 3; i++) {
            const sx = -W / 2 + 100;
            const sy = -H / 2 + 100 + i * 80;

            const slotBg = this.scene.add.rectangle(sx, sy, 150, 68, 0x1a2a3a)
                .setStrokeStyle(1, 0x446688).setInteractive({ useHandCursor: true });
            const slotText = this.scene.add.text(sx, sy, '＋ アイテム追加', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#446688', align: 'center'
            }).setOrigin(0.5);

            const slotIdx = i;
            slotBg.on('pointerdown', () => this._onMySlotClick(slotIdx));
            slotBg.on('pointerover', () => slotBg.setStrokeStyle(2, 0x88aaff));
            slotBg.on('pointerout', () => slotBg.setStrokeStyle(1, 0x446688));

            this._sessionContainer.add([slotBg, slotText]);
            this._mySlotGraphics.push(slotBg);
            this._mySlotTexts.push(slotText);
        }

        // ゴールド提供欄 (左)
        const goldLabel = this.scene.add.text(-W / 2 + 20, -H / 2 + 345, '💰 提供ゴールド:', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffdd44'
        });
        this._sessionContainer.add(goldLabel);

        // ゴールドマイナスボタン
        const myGoldMinusBtn = this.scene.add.rectangle(-W / 2 + 55, -H / 2 + 375, 32, 28, 0x885500)
            .setInteractive({ useHandCursor: true });
        const myGoldMinusTxt = this.scene.add.text(-W / 2 + 55, -H / 2 + 375, '−', {
            fontSize: '16px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        myGoldMinusBtn.on('pointerdown', () => this._adjustMyGold(-100));
        myGoldMinusBtn.on('pointerover', () => myGoldMinusBtn.setFillStyle(0xaa7700));
        myGoldMinusBtn.on('pointerout', () => myGoldMinusBtn.setFillStyle(0x885500));

        // ゴールド表示テキスト
        this._myGoldText = this.scene.add.text(-W / 2 + 100, -H / 2 + 375, '0 G', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffdd44'
        }).setOrigin(0.5);

        // ゴールドプラスボタン
        const myGoldPlusBtn = this.scene.add.rectangle(-W / 2 + 150, -H / 2 + 375, 32, 28, 0x885500)
            .setInteractive({ useHandCursor: true });
        const myGoldPlusTxt = this.scene.add.text(-W / 2 + 150, -H / 2 + 375, '＋', {
            fontSize: '16px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        myGoldPlusBtn.on('pointerdown', () => this._adjustMyGold(100));
        myGoldPlusBtn.on('pointerover', () => myGoldPlusBtn.setFillStyle(0xaa7700));
        myGoldPlusBtn.on('pointerout', () => myGoldPlusBtn.setFillStyle(0x885500));

        // 直接入力ボタン
        const myGoldInputBtn = this.scene.add.rectangle(-W / 2 + 198, -H / 2 + 375, 40, 28, 0x444466)
            .setInteractive({ useHandCursor: true });
        const myGoldInputTxt = this.scene.add.text(-W / 2 + 198, -H / 2 + 375, '直接', {
            fontSize: '10px', fontFamily: UI_FONT, color: '#aaaaff'
        }).setOrigin(0.5);
        myGoldInputBtn.on('pointerdown', () => this._inputMyGold());
        myGoldInputBtn.on('pointerover', () => myGoldInputBtn.setFillStyle(0x6666aa));
        myGoldInputBtn.on('pointerout', () => myGoldInputBtn.setFillStyle(0x444466));

        this._sessionContainer.add([
            goldLabel, myGoldMinusBtn, myGoldMinusTxt,
            this._myGoldText, myGoldPlusBtn, myGoldPlusTxt,
            myGoldInputBtn, myGoldInputTxt
        ]);

        // ===== 中央区切り =====
        const divider = this.scene.add.text(0, -H / 2 + 180, '⇄', {
            fontSize: '28px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        this._sessionContainer.add(divider);

        // ===== 相手の提供欄 (右) =====
        this._partnerNameText = this.scene.add.text(W / 2 - 20, -H / 2 + 50, '相手の提供', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffaa88'
        }).setOrigin(1, 0);
        this._sessionContainer.add(this._partnerNameText);

        this._partnerSlotTexts = [];
        for (let i = 0; i < 3; i++) {
            const sx = W / 2 - 100;
            const sy = -H / 2 + 100 + i * 80;

            const slotBg = this.scene.add.rectangle(sx, sy, 150, 68, 0x1a1a2a)
                .setStrokeStyle(1, 0x664488);
            const slotText = this.scene.add.text(sx, sy, '（空き）', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#555555', align: 'center'
            }).setOrigin(0.5);

            this._sessionContainer.add([slotBg, slotText]);
            this._partnerSlotTexts.push(slotText);
        }

        // 相手のゴールド表示
        const partnerGoldLabel = this.scene.add.text(W / 2 - 20, -H / 2 + 345, '💰 相手のゴールド:', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffcc88'
        }).setOrigin(1, 0);
        this._partnerGoldText = this.scene.add.text(W / 2 - 20, -H / 2 + 375, '0 G', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffcc88'
        }).setOrigin(1, 0.5);
        this._sessionContainer.add([partnerGoldLabel, this._partnerGoldText]);

        // ===== ステータス・ボタン =====
        // 状態テキスト
        this._myReadyText = this.scene.add.text(-170, H / 2 - 85, '⬜ 未確定', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        this._partnerReadyText = this.scene.add.text(170, H / 2 - 85, '⬜ 未確定', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        this._sessionContainer.add([this._myReadyText, this._partnerReadyText]);

        // ガイドテキスト
        const guideText = this.scene.add.text(0, H / 2 - 110, '両者が「確定する」を押すとトレードが成立します', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#888866'
        }).setOrigin(0.5);
        this._sessionContainer.add(guideText);

        // 確定ボタン
        this._confirmBtn = this.scene.add.rectangle(-130, H / 2 - 48, 180, 38, 0x00aa00)
            .setInteractive({ useHandCursor: true });
        this._confirmTxt = this.scene.add.text(-130, H / 2 - 48, '✅ 確定する', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        this._confirmBtn.on('pointerover', () => this._confirmBtn.setFillStyle(0x00ff00));
        this._confirmBtn.on('pointerout', () => this._confirmBtn.setFillStyle(0x00aa00));
        this._confirmBtn.on('pointerdown', () => this._onConfirm());
        this._sessionContainer.add([this._confirmBtn, this._confirmTxt]);

        // キャンセルボタン
        const cancelBtn = this.scene.add.rectangle(130, H / 2 - 48, 180, 38, 0xaa0000)
            .setInteractive({ useHandCursor: true });
        const cancelTxt = this.scene.add.text(130, H / 2 - 48, '❌ キャンセル', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);
        cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xff0000));
        cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0xaa0000));
        cancelBtn.on('pointerdown', () => this._onCancel());
        this._sessionContainer.add([cancelBtn, cancelTxt]);

        // ===== アイテムピッカー (スクロール対応) =====
        this._itemPickerContainer = this.scene.add.container(0, 0);
        this._itemPickerContainer.setVisible(false);
        this.container.add(this._itemPickerContainer);
    }

    // ===== ゴールド操作 =====
    _adjustMyGold(delta) {
        if (!this.tradeSession) return;
        const player = this.scene.player;
        const myGold = player?.stats?.gold || 0;
        const current = this.tradeSession.myGold || 0;
        const next = Math.max(0, Math.min(myGold, current + delta));
        this.tradeSession.myGold = next;
        this._myGoldText?.setText(`${next} G`);
        this._syncOffer();
    }

    _inputMyGold() {
        const player = this.scene.player;
        const myGold = player?.stats?.gold || 0;
        const val = prompt(`提供するゴールド額を入力してください\n（所持: ${myGold} G）`);
        if (val === null) return;
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 0) {
            this.scene.notificationUI?.show('有効な数値を入力してください', 'error');
            return;
        }
        if (num > myGold) {
            this.scene.notificationUI?.show(`所持ゴールド(${myGold} G)を超えています`, 'error');
            return;
        }
        this.tradeSession.myGold = num;
        this._myGoldText?.setText(`${num} G`);
        this._syncOffer();
    }

    // ===== open/startSession =====
    open() {
        if (!this.container) this.createUI();
        super.open();
        if (this.tradeSession) {
            this._playerSelectContainer.setVisible(false);
            this._sessionContainer.setVisible(true);
            this._requestPopupContainer.setVisible(false);
            this._refreshSessionUI();
        } else {
            this._playerSelectContainer.setVisible(true);
            this._sessionContainer.setVisible(false);
            this._requestPopupContainer.setVisible(false);
            this._refreshPlayerList();
        }
    }

    startSession(partnerId, partnerName) {
        this.tradeSession = {
            partnerId,
            partnerName,
            myOffer: [],
            partnerOffer: [],
            myGold: 0,
            partnerGold: 0,
            myReady: false,
            partnerReady: false,
        };
        if (!this.container) this.createUI();
        super.open();
        this._playerSelectContainer.setVisible(false);
        this._requestPopupContainer.setVisible(false);
        this._sessionContainer.setVisible(true);
        this._itemPickerContainer.setVisible(false);
        this._refreshSessionUI();
    }

    _refreshSessionUI() {
        if (!this.tradeSession) return;
        const { myOffer, partnerOffer, partnerName, myReady, partnerReady, myGold, partnerGold } = this.tradeSession;

        // 自分スロット
        for (let i = 0; i < 3; i++) {
            const item = myOffer[i];
            if (item) {
                const def = ITEMS[item.id];
                this._mySlotTexts[i].setText(`${def?.icon || '📦'} ${def?.name || item.id}\nx${item.count}\n[クリックで解除]`)
                    .setColor('#ffffff');
            } else {
                this._mySlotTexts[i].setText('＋ アイテム追加').setColor('#446688');
            }
        }

        // 相手スロット
        this._partnerNameText.setText(`${partnerName} の提供`);
        for (let i = 0; i < 3; i++) {
            const item = partnerOffer[i];
            if (item) {
                const def = ITEMS[item.id];
                this._partnerSlotTexts[i].setText(`${def?.icon || '📦'} ${def?.name || item.id}\nx${item.count}`)
                    .setColor('#ffddcc');
            } else {
                this._partnerSlotTexts[i].setText('（空き）').setColor('#555555');
            }
        }

        // ゴールド
        this._myGoldText?.setText(`${myGold || 0} G`);
        this._partnerGoldText?.setText(`${partnerGold || 0} G`);

        // 状態
        this._myReadyText.setText(myReady ? '✅ 自分: 確定済' : '⬜ 自分: 未確定')
            .setColor(myReady ? '#44ff44' : '#888888');
        this._partnerReadyText.setText(partnerReady ? '✅ 相手: 確定済' : '⬜ 相手: 未確定')
            .setColor(partnerReady ? '#44ff44' : '#888888');

        // 確定ボタン無効化（確定済みなら）
        if (myReady) {
            this._confirmBtn.setFillStyle(0x446644);
            this._confirmBtn.disableInteractive();
            this._confirmTxt.setText('✅ 確定済み');
        }
    }

    // ===== アイテムスロッククリック =====
    _onMySlotClick(slotIdx) {
        if (this.tradeSession?.myReady) {
            this.scene.notificationUI?.show('確定後はアイテムを変更できません', 'error');
            return;
        }
        if (this.tradeSession?.myOffer[slotIdx]) {
            // 解除
            this.tradeSession.myOffer.splice(slotIdx, 1);
            this._syncOffer();
            this._refreshSessionUI();
        } else {
            this._openItemPicker(slotIdx);
        }
    }

    // ===== アイテムピッカー (スクロール対応) =====
    _openItemPicker(slotIdx) {
        this._itemPickerContainer.removeAll(true);
        this._itemPickerContainer.setVisible(true);
        this._pickerScrollY = 0;
        this._currentPickerSlot = slotIdx;

        const W = 540;
        const H = 380;

        // 背景
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0a1020, 0.98);
        bg.fillRoundedRect(-W / 2, -H / 2, W, H, 12);
        bg.lineStyle(2, 0x44aaff, 1);
        bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 12);

        const title = this.scene.add.text(0, -H / 2 + 20, '提供するアイテムを選択', {
            fontSize: '15px', fontFamily: UI_FONT, color: '#88ffff'
        }).setOrigin(0.5);

        const closeBtn = this.scene.add.text(W / 2 - 15, -H / 2 + 15, '✕', {
            fontSize: '20px', fontFamily: UI_FONT, color: '#ff4444'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this._itemPickerContainer.setVisible(false));

        this._itemPickerContainer.add([bg, title, closeBtn]);

        // インベントリ取得
        const inventory = this.scene.player?.stats?.inventory || [];
        const alreadyOffered = this.tradeSession.myOffer.map(o => o?.id).filter(Boolean);

        // 有効アイテムリスト
        this._pickerItems = [];
        inventory.forEach(entry => {
            const itemId = typeof entry === 'string' ? entry : entry.id;
            const count = typeof entry === 'string' ? 1 : (entry.count || 1);
            const def = ITEMS[itemId];
            if (!def) return;
            if (alreadyOffered.includes(itemId)) return;
            this._pickerItems.push({ itemId, count, def });
        });

        // スクロール可能リストエリア
        const listAreaY = -H / 2 + 50;
        const listH = H - 100;
        const itemH = 44;
        const visibleCount = Math.floor(listH / itemH);

        // マスク用ゾーン
        const maskZone = this.scene.add.zone(0, listAreaY + listH / 2, W - 20, listH)
            .setInteractive();

        // スクロールイベント
        maskZone.on('wheel', (pointer, dx, dy) => {
            const maxScroll = Math.max(0, this._pickerItems.length - visibleCount);
            this._pickerScrollY = Phaser.Math.Clamp(this._pickerScrollY + (dy > 0 ? 1 : -1), 0, maxScroll);
            this._refreshPickerList(slotIdx, listAreaY, listH, itemH, visibleCount, W);
        });
        this._itemPickerContainer.add(maskZone);

        // 上下スクロールボタン
        const upBtn = this.scene.add.text(W / 2 - 15, listAreaY + 15, '▲', {
            fontSize: '16px', fontFamily: UI_FONT, color: '#aaaaff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const downBtn = this.scene.add.text(W / 2 - 15, listAreaY + listH - 15, '▼', {
            fontSize: '16px', fontFamily: UI_FONT, color: '#aaaaff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        upBtn.on('pointerdown', () => {
            const maxScroll = Math.max(0, this._pickerItems.length - visibleCount);
            this._pickerScrollY = Phaser.Math.Clamp(this._pickerScrollY - 1, 0, maxScroll);
            this._refreshPickerList(slotIdx, listAreaY, listH, itemH, visibleCount, W);
        });
        downBtn.on('pointerdown', () => {
            const maxScroll = Math.max(0, this._pickerItems.length - visibleCount);
            this._pickerScrollY = Phaser.Math.Clamp(this._pickerScrollY + 1, 0, maxScroll);
            this._refreshPickerList(slotIdx, listAreaY, listH, itemH, visibleCount, W);
        });

        this._itemPickerContainer.add([upBtn, downBtn]);

        // スクロール件数表示
        this._pickerCountText = this.scene.add.text(0, H / 2 - 20, '', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#888888'
        }).setOrigin(0.5);
        this._itemPickerContainer.add(this._pickerCountText);

        // リスト描画
        this._pickerListContainer = this.scene.add.container(0, 0);
        this._itemPickerContainer.add(this._pickerListContainer);

        this._refreshPickerList(slotIdx, listAreaY, listH, itemH, visibleCount, W);
    }

    _refreshPickerList(slotIdx, listAreaY, listH, itemH, visibleCount, W) {
        this._pickerListContainer.removeAll(true);

        const total = this._pickerItems.length;

        if (total === 0) {
            const noItem = this.scene.add.text(0, listAreaY + listH / 2, '交換可能なアイテムがありません', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#888888'
            }).setOrigin(0.5);
            this._pickerListContainer.add(noItem);
            return;
        }

        // スクロール範囲
        const start = this._pickerScrollY;
        const end = Math.min(start + visibleCount, total);

        for (let i = start; i < end; i++) {
            const { itemId, count, def } = this._pickerItems[i];
            const yPos = listAreaY + 10 + (i - start) * itemH;

            const rowBg = this.scene.add.rectangle(0, yPos + itemH / 2 - 5, W - 40, itemH - 4, 0x1a2a3a)
                .setStrokeStyle(1, 0x446688).setInteractive({ useHandCursor: true });
            const icon = this.scene.add.text(-W / 2 + 25, yPos + itemH / 2 - 5, def.icon || '📦', {
                fontSize: '18px', fontFamily: UI_FONT
            }).setOrigin(0.5);
            const nameTxt = this.scene.add.text(-W / 2 + 50, yPos + itemH / 2 - 5, `${def.name}`, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0, 0.5);
            const countTxt = this.scene.add.text(W / 2 - 50, yPos + itemH / 2 - 5, `x${count}`, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#aaaaaa'
            }).setOrigin(0.5);

            rowBg.on('pointerdown', () => {
                // 個数選択（stack > 1 の場合）
                if (count > 1) {
                    const qty = prompt(`${def.name} をいくつ提供しますか？\n（最大 ${count}）`);
                    if (qty === null) return;
                    const n = parseInt(qty, 10);
                    if (isNaN(n) || n < 1 || n > count) {
                        this.scene.notificationUI?.show('有効な数量を入力してください', 'error');
                        return;
                    }
                    this.tradeSession.myOffer[slotIdx] = { id: itemId, count: n };
                } else {
                    this.tradeSession.myOffer[slotIdx] = { id: itemId, count: 1 };
                }
                this._itemPickerContainer.setVisible(false);
                this._syncOffer();
                this._refreshSessionUI();
            });
            rowBg.on('pointerover', () => rowBg.setFillStyle(0x2a3a4a));
            rowBg.on('pointerout', () => rowBg.setFillStyle(0x1a2a3a));

            this._pickerListContainer.add([rowBg, icon, nameTxt, countTxt]);
        }

        // 件数表示
        if (this._pickerCountText) {
            this._pickerCountText.setText(`${start + 1}〜${end} / ${total}件（マウスホイールでスクロール）`);
        }
    }

    // ===== Offer同期 =====
    _syncOffer() {
        if (this.scene.networkManager && this.tradeSession) {
            this.scene.networkManager.sendTradeOffer(
                this.tradeSession.partnerId,
                {
                    items: this.tradeSession.myOffer,
                    gold: this.tradeSession.myGold || 0,
                }
            );
        }
    }

    // ===== 確定/キャンセル =====
    _onConfirm() {
        if (!this.tradeSession) return;
        this.tradeSession.myReady = true;
        this._refreshSessionUI();
        if (this.scene.networkManager) {
            this.scene.networkManager.sendTradeConfirm(this.tradeSession.partnerId);
        }
        this.scene.notificationUI?.show('確定しました。相手の確定を待っています...', 'info');
    }

    _onCancel() {
        if (this.scene.networkManager && this.tradeSession) {
            this.scene.networkManager.sendTradeCancel(this.tradeSession.partnerId);
        }
        this.closeSession('トレードをキャンセルしました');
    }

    // ===== 相手からのイベント =====
    onPartnerOffer(offer) {
        if (!this.tradeSession) return;
        // offer は { items, gold } 形式 または 旧形式（配列）に対応
        if (Array.isArray(offer)) {
            this.tradeSession.partnerOffer = offer;
        } else {
            this.tradeSession.partnerOffer = offer.items || [];
            this.tradeSession.partnerGold = offer.gold || 0;
        }
        this._refreshSessionUI();
    }

    onPartnerReady() {
        if (!this.tradeSession) return;
        this.tradeSession.partnerReady = true;
        this._refreshSessionUI();
        this.scene.notificationUI?.show('相手がトレードを確定しました！あなたも確定してください', 'info');
    }

    onTradeComplete(lostItems = [], gainedItems = [], lostGold = 0, gainedGold = 0) {
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
            // ゴールド移動
            if (lostGold > 0) player.stats.gold = Math.max(0, (player.stats.gold || 0) - lostGold);
            if (gainedGold > 0) player.stats.gold = (player.stats.gold || 0) + gainedGold;

            player.saveStats();

            // ゴールドUI更新
            this.scene.playerStatsUI?.update?.();
        }
        this.closeSession(`✅ トレード成立！\n獲得: ${gainedItems.length}個のアイテム${gainedGold > 0 ? ` + ${gainedGold}G` : ''}`);
    }

    closeSession(reason = '') {
        this.tradeSession = null;
        this._pendingFromId = null;
        this._itemPickerContainer?.setVisible(false);
        this._requestPopupContainer?.setVisible(false);
        this._playerSelectContainer?.setVisible(true);
        this._sessionContainer?.setVisible(false);
        super.close();
        if (reason && this.scene.notificationUI) {
            this.scene.notificationUI.show(reason, 'info');
        }
    }
}
