export default class LobbyUI {
    constructor(scene, networkManager) {
        this.scene = scene;
        this.networkManager = networkManager;
        this.playerNames = {}; // playerId -> name
        this.readyPlayers = new Set(); // 準備完了したプレイヤーのID
        this.maxPlayers = 4;
        this.myPlayerName = '';
        this.isReady = false;
        this.useSaveData = !!localStorage.getItem('playerStats');

        this.createUI();
        this.setupNetworkEvents();

        // 初期表示
        this.scene.time.delayedCall(200, () => {
            if (this.networkManager.getSocket()?.connected) {
                const myId = this.networkManager.getPlayerId();
                if (!this.playerNames[myId]) {
                    this.playerNames[myId] = this.myPlayerName || 'Player';
                }
                this.updatePlayerList();
            }
        });
    }

    createUI() {
        const { width, height } = this.scene.scale;
        const panelWidth = Math.min(width * 0.9, 700);
        const panelHeight = Math.min(height * 0.9, 580);

        this.mainContainer = this.scene.add.container(width / 2, height / 2).setScrollFactor(0).setDepth(1000);

        // --- 背景パネル ---
        this.bgGfx = this.scene.add.graphics();
        // 外枠の輝き
        this.bgGfx.lineStyle(6, 0x4a90e2, 0.2);
        this.bgGfx.strokeRoundedRect(-panelWidth / 2 - 2, -panelHeight / 2 - 2, panelWidth + 4, panelHeight + 4, 22);
        // メインパネル
        this.bgGfx.fillStyle(0x0a0a1a, 0.95);
        this.bgGfx.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
        this.bgGfx.lineStyle(3, 0x4a90e2, 0.8);
        this.bgGfx.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
        this.mainContainer.add(this.bgGfx);

        // --- ヘッダー ---
        this.titleText = this.scene.add.text(0, -panelHeight / 2 + 40, '⚔️ マルチプレイヤー ロビー', {
            fontSize: '24px', color: '#ffffff', fontFamily: '"Press Start 2P"', stroke: '#4a90e2', strokeThickness: 5
        }).setOrigin(0.5);
        this.mainContainer.add(this.titleText);

        this.connectionStatusText = this.scene.add.text(0, -panelHeight / 2 + 80, '接続済み', {
            fontSize: '11px', color: '#2ecc40', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.mainContainer.add(this.connectionStatusText);

        this.playerCountText = this.scene.add.text(0, -panelHeight / 2 + 110, '待機人数: 0 / 4', {
            fontSize: '14px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.mainContainer.add(this.playerCountText);

        // 操作説明 (重なり防止のため上部に配置)
        this.instructionText = this.scene.add.text(0, -panelHeight / 2 + 140,
            '名前を入力して準備完了！全員の準備ができると開始できます。', {
            fontSize: '10px', color: '#888888', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.mainContainer.add(this.instructionText);

        // --- プレイヤーリストエリア ---
        const listBg = this.scene.add.graphics();
        listBg.fillStyle(0x000000, 0.3);
        listBg.fillRoundedRect(-panelWidth / 2 + 30, -panelHeight / 2 + 165, panelWidth - 60, 190, 15);
        this.mainContainer.add(listBg);

        this.playerListContainer = this.scene.add.container(0, -panelHeight / 2 + 260);
        this.mainContainer.add(this.playerListContainer);

        // --- 操作エリア (下部) ---
        const startY = 85;

        // 名前入力
        this.nameLabel = this.scene.add.text(0, startY, 'プレイヤー名:', {
            fontSize: '12px', color: '#aaaaaa', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.mainContainer.add(this.nameLabel);

        this.nameInputBg = this.scene.add.rectangle(0, startY + 35, 320, 45, 0x1a1a2e, 1)
            .setOrigin(0.5).setStrokeStyle(2, 0x4a90e2, 1);
        this.mainContainer.add(this.nameInputBg);

        this.nameInputText = this.scene.add.text(0, startY + 35, 'Player', {
            fontSize: '16px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.mainContainer.add(this.nameInputText);

        // 準備ボタン
        this.readyButton = this.scene.add.rectangle(0, startY + 105, 240, 55, 0x4a90e2, 1)
            .setOrigin(0.5).setStrokeStyle(2, 0xffffff, 0.5).setInteractive({ useHandCursor: true });
        this.mainContainer.add(this.readyButton);

        this.readyButtonText = this.scene.add.text(0, startY + 105, '準備完了', {
            fontSize: '18px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.mainContainer.add(this.readyButtonText);

        // セーブデータ切り替え
        this.saveToggleButton = this.scene.add.container(0, startY + 155);
        const saveToggleBg = this.scene.add.rectangle(0, 0, 240, 32, 0x4a90e2, 0.3)
            .setStrokeStyle(1, 0xffffff, 0.2).setInteractive({ useHandCursor: true });
        this.saveToggleText = this.scene.add.text(0, 0, 'つづきから', {
            fontSize: '10px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.saveToggleButton.add([saveToggleBg, this.saveToggleText]);
        this.mainContainer.add(this.saveToggleButton);

        if (!localStorage.getItem('playerStats')) this.saveToggleButton.setVisible(false);

        // 開始ボタン (ホストのみ)
        this.startButton = this.scene.add.rectangle(0, startY + 215, 300, 60, 0x2ecc40, 1)
            .setOrigin(0.5).setStrokeStyle(3, 0xffffff, 1).setInteractive({ useHandCursor: true }).setVisible(false);
        this.startButtonText = this.scene.add.text(0, startY + 215, 'ゲーム開始', {
            fontSize: '22px', color: '#ffffff', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setVisible(false);
        this.mainContainer.add([this.startButton, this.startButtonText]);

        this.setupHTMLInput(width, height, startY + 35);
        this.setupInteractions();
    }

    setupHTMLInput(w, h, yOff) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = 'Player';
        input.maxLength = 10;
        input.style.position = 'fixed';
        input.style.textAlign = 'center';
        input.style.backgroundColor = 'transparent';
        input.style.color = 'transparent';
        input.style.border = 'none';
        input.style.outline = 'none';
        input.style.zIndex = '10000';
        input.style.caretColor = '#4a90e2';

        const updatePos = () => {
            if (!this.mainContainer) return;
            const cv = this.scene.game.canvas;
            const r = cv.getBoundingClientRect();
            const sx = r.width / this.scene.game.config.width;
            const sy = r.height / this.scene.game.config.height;
            input.style.left = (r.left + r.width / 2 - 160 * sx) + 'px';
            input.style.top = (r.top + r.height / 2 + (yOff - 22) * sy) + 'px';
            input.style.width = (320 * sx) + 'px';
            input.style.height = (45 * sy) + 'px';
            input.style.fontSize = (16 * sx) + 'px';
        };

        document.body.appendChild(input);
        this.htmlInput = input;
        input.addEventListener('input', (e) => {
            this.myPlayerName = e.target.value || 'Player';
            this.nameInputText.setText(this.myPlayerName);
            this.networkManager.getSocket()?.emit('playerNameUpdate', { name: this.myPlayerName });
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !this.isReady) this.toggleReady(); });
        window.addEventListener('resize', updatePos);
        this.scene.scale.on('resize', updatePos);
        updatePos();
    }

    setupInteractions() {
        this.readyButton.on('pointerdown', () => this.toggleReady());
        this.readyButton.on('pointerover', () => this.readyButton.setStrokeStyle(3, 0xffffff, 1).setScale(1.02));
        this.readyButton.on('pointerout', () => this.readyButton.setStrokeStyle(2, 0xffffff, 0.5).setScale(1));

        const bg = this.saveToggleButton.list[0];
        bg.on('pointerdown', () => {
            this.useSaveData = !this.useSaveData;
            this.updateSaveToggleUI();
        });

        this.startButton.on('pointerdown', () => { if (this.canStart()) this.startGame(); });
        this.scene.tweens.add({
            targets: [this.startButton, this.startButtonText],
            scale: 1.05, duration: 600, yoyo: true, repeat: -1
        });
    }

    updateSaveToggleUI() {
        const bg = this.saveToggleButton.list[0];
        if (this.useSaveData) {
            bg.setFillStyle(0x4a90e2, 0.5).setStrokeStyle(1, 0xffffff, 0.4);
            this.saveToggleText.setText('つづきから').setColor('#ffffff');
        } else {
            bg.setFillStyle(0xe74c3c, 0.5).setStrokeStyle(1, 0xffffff, 0.4);
            this.saveToggleText.setText('最初から(消去)').setColor('#ffffff');
        }
    }

    setupNetworkEvents() {
        const socket = this.networkManager.getSocket();
        if (!socket) return;

        socket.on('lobbyPlayerJoined', (d) => { if (d.playerNames) this.playerNames = { ...this.playerNames, ...d.playerNames }; this.updatePlayerList(d.players); });
        socket.on('lobbyPlayerLeft', (d) => {
            if (d.players) {
                const ids = Object.keys(d.players);
                Object.keys(this.playerNames).forEach(id => { if (!ids.includes(id)) delete this.playerNames[id]; });
            }
            this.updatePlayerList(d.players);
        });
        socket.on('lobbyPlayerNameUpdate', (d) => { if (d.socketId) { this.playerNames[d.socketId] = d.name; this.updatePlayerList(); } });
        socket.on('lobbyPlayerReady', (d) => { if (d.socketId) { if (d.ready) this.readyPlayers.add(d.socketId); else this.readyPlayers.delete(d.socketId); this.updatePlayerList(); } });
        socket.on('lobbyInfo', (d) => { if (d.playerNames) this.playerNames = { ...d.playerNames }; if (d.readyPlayers) this.readyPlayers = new Set(d.readyPlayers); this.updatePlayerList(d.players); });
        socket.on('lobbyKicked', () => { alert('ロビーからキックされました。'); window.location.reload(); });
        socket.on('lobbyGameStarted', () => {
            if (!this.useSaveData) { localStorage.removeItem('playerStats'); localStorage.removeItem('playerQuests'); }
            if (this.playerNames) this.scene.registry.set('playerNames', this.playerNames);
            this.destroy();
            this.networkManager.changeMap('tutorial', 0, 0);
            this.scene.time.delayedCall(200, () => this.scene.scene.start('GameScene'));
        });
    }

    updatePlayerList(players = null) {
        if (!this.playerListContainer) return;
        this.playerListContainer.removeAll(true);
        if (!players) players = Object.keys(this.playerNames).reduce((acc, id) => { acc[id] = {}; return acc; }, {});

        const ids = Object.keys(players);
        const count = ids.length;
        this.playerCountText.setText(`待機人数: ${count} / ${this.maxPlayers}`);

        const myId = this.networkManager.getPlayerId();
        const sortedIds = Object.keys(this.playerNames).sort();
        const isHost = sortedIds[0] === myId;

        ids.forEach((id, index) => {
            const isMe = id === myId;
            const name = this.playerNames[id] || `Player ${id.substring(0, 4)}`;
            const isReady = this.readyPlayers.has(id);
            const y = (index - (count - 1) / 2) * 44;

            const box = this.scene.add.container(0, y);
            const bGfx = this.scene.add.graphics();
            bGfx.fillStyle(isMe ? 0x4a90e2 : 0x2a2a3e, 0.4);
            bGfx.fillRoundedRect(-250, -18, 500, 36, 6);
            bGfx.lineStyle(2, isReady ? 0x2ecc40 : 0x444444, 1);
            bGfx.strokeRoundedRect(-250, -18, 500, 36, 6);
            box.add(bGfx);

            const nTxt = this.scene.add.text(-230, 0, (isMe ? '▶ ' : '') + name + (sortedIds[0] === id ? ' (ホスト)' : ''), {
                fontSize: '11px', color: '#ffffff', fontFamily: '"Press Start 2P"'
            }).setOrigin(0, 0.5);
            box.add(nTxt);

            if (isHost && !isMe) {
                const kBtn = this.scene.add.text(120, 0, '[キック]', { fontSize: '9px', color: '#ff4b2b', fontFamily: '"Press Start 2P"' })
                    .setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
                kBtn.on('pointerdown', () => this.networkManager.getSocket()?.emit('lobbyKick', { targetId: id }));
                kBtn.on('pointerover', () => kBtn.setColor('#ff0000'));
                kBtn.on('pointerout', () => kBtn.setColor('#ff4b2b'));
                box.add(kBtn);
            }

            const sTxt = this.scene.add.text(230, 0, isReady ? '準備完了' : '待機中', {
                fontSize: '10px', color: isReady ? '#2ecc40' : '#888888', fontFamily: '"Press Start 2P"'
            }).setOrigin(1, 0.5);
            box.add(sTxt);

            this.playerListContainer.add(box);
        });
        this.updateStartButton();
    }

    toggleReady() {
        this.isReady = !this.isReady;
        this.networkManager.getSocket()?.emit('lobbyReady', { ready: this.isReady });
        if (this.isReady) {
            this.readyButton.setFillStyle(0x2ecc40).setStrokeStyle(3, 0xffffff, 1);
            this.readyButtonText.setText('準備解除');
        } else {
            this.readyButton.setFillStyle(0x4a90e2).setStrokeStyle(2, 0xffffff, 0.5);
            this.readyButtonText.setText('準備完了');
        }
    }

    updateStartButton() {
        const can = this.canStart();
        if (this.startButton) {
            this.startButton.setVisible(can);
            this.startButtonText.setVisible(can);
        }
    }

    canStart() {
        const ids = Object.keys(this.playerNames);
        if (ids.length === 0) return false;
        const myId = this.networkManager.getPlayerId();
        const sorted = [...ids].sort();
        return (sorted[0] === myId) && ids.every(id => this.readyPlayers.has(id));
    }

    startGame() { this.networkManager.getSocket()?.emit('lobbyStartGame'); }

    destroy() {
        if (this.htmlInput?.parentNode) this.htmlInput.parentNode.removeChild(this.htmlInput);
        if (this.mainContainer) this.mainContainer.destroy();
    }
}
