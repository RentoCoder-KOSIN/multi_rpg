import NetworkManager from '../managers/NetworkManager.js';
import LobbyUI from '../ui/LobbyUI.js';

export default class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
    }

    create() {
        const gameWidth = this.scale.gameSize ? this.scale.gameSize.width : this.scale.width;
        const gameHeight = this.scale.gameSize ? this.scale.gameSize.height : this.scale.height;

        // 背景
        this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth, gameHeight, 0x0a0a1a);

        // タイトル
        this.add.text(gameWidth / 2, gameHeight * 0.1, 'RPG GAME', {
            fontSize: '48px',
            color: '#4a90e2',
            fontFamily: 'Press Start 2P',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // NetworkManagerを初期化（ロビー用）
        // レジストリに保存して、ゲームシーンでも再利用できるようにする
        this.networkManager = new NetworkManager(this);
        this.registry.set('networkManager', this.networkManager);

        this.networkManager.connect('lobby', () => {
            console.log('[TitleScene] Connected to lobby');
            const socket = this.networkManager.getSocket();

            if (socket && socket.connected) {
                // ロビーUIを作成
                this.lobbyUI = new LobbyUI(this, this.networkManager);

                // ゲーム開始イベント（LobbyUIで処理されるため、ここでは何もしない）
                // LobbyUIがマップ変更とシーン遷移を処理する
            } else {
                console.error('[TitleScene] Failed to connect to server');
                // 接続エラー時の処理
                this.add.text(gameWidth / 2, gameHeight * 0.5,
                    'サーバーに接続できませんでした\nページをリロードしてください', {
                    fontSize: '16px',
                    color: '#e74c3c',
                    fontFamily: 'Press Start 2P',
                    stroke: '#000000',
                    strokeThickness: 2,
                    align: 'center'
                }).setOrigin(0.5);
            }
        });
    }

    shutdown() {
        if (this.lobbyUI) {
            this.lobbyUI.destroy();
        }
        // NetworkManagerは他のシーンでも使用するため、切断しない
        // if (this.networkManager) {
        //     this.networkManager.disconnect();
        // }
    }
}