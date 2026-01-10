// NetworkManager.js
import { SERVER_CONFIG } from '../config.js';
import Player from '../entities/Player.js';

export default class NetworkManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.currentMapKey = null;
        this.otherPlayers = {};
        this.enemies = {};
        this.pendingPlayers = [];
        this.pendingEnemies = [];
        this.pendingCurrentPlayers = null;
        this.callbacks = {
            onPlayerAdded: null,
            onPlayerRemoved: null,
            onEnemySpawned: null,
            onEnemyRemoved: null,
            onEnemyKilled: null,
            onSummonUpdate: null,
            onPartyUpdate: null,
            onPartyInvited: null,
            onHealed: null
        };
        this.partyData = null; // { partyId, leader, members: [] }

        // 永続的なプレイヤーIDを取得または生成
        this.playerId = localStorage.getItem('game_player_id');
        if (!this.playerId) {
            this.playerId = 'p-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            localStorage.setItem('game_player_id', this.playerId);
        }
        console.log('[NetworkManager] Persistent Player ID:', this.playerId);
    }

    connect(mapKey = 'tutorial', onConnected = null) {
        console.log('[NetworkManager] connect called with mapKey:', mapKey, 'currentMapKey:', this.currentMapKey, 'mapChanged:', this._mapChanged);

        if (this.currentMapKey) {
            this.clearAllOtherPlayers();
            this.clearAllEnemies();
        }

        if (this.socket && this.socket.connected) {
            // 既に接続している場合、マップが変更された場合は changeMap を呼び出す
            // これによりサーバーから currentPlayers が送られてくる
            if (this.currentMapKey !== mapKey) {
                this.currentMapKey = mapKey;
                this.clearAllOtherPlayers();
                // changeMap を呼び出すとサーバーから currentPlayers が送られてくる
                // mapChangeイベント内でサーバーがnewPlayerも送信するので、ここでは送信しない
                this.socket.emit("mapChange", {
                    mapKey,
                    x: this.scene.player?.x || 0,
                    y: this.scene.player?.y || 0,
                    hp: this.scene.player?.stats?.hp || 100,
                    maxHp: this.scene.player?.stats?.maxHp || 100,
                    level: this.scene.player?.stats?.level || 1
                });

                if (mapKey === 'lobby') {
                    console.log('[NetworkManager] Emitting lobbyJoin (already connected)');
                    this.socket.emit('lobbyJoin');
                }
                // マップ変更時はnewPlayerを送信済みフラグを設定
                this._mapChanged = true;
            } else if (!this._mapChanged) {
                // 同じマップの場合で、かつマップ変更フラグが設定されていない場合のみ newPlayer を送信
                console.log('[NetworkManager] Same map and not changed, sending newPlayer');
                this.socket.emit("newPlayer", {
                    x: this.scene.player?.x || 0,
                    y: this.scene.player?.y || 0,
                    mapKey,
                    hp: this.scene.player?.stats?.hp || 100,
                    maxHp: this.scene.player?.stats?.maxHp || 100
                });
                if (mapKey === 'lobby') {
                    console.log('[NetworkManager] Emitting lobbyJoin (already connected)');
                    this.socket.emit('lobbyJoin');
                }
            } else {
                console.log('[NetworkManager] Same map but mapChanged flag is set, skipping newPlayer');
            }

            if (onConnected) onConnected();
            return;
        }

        // 新規接続時はフラグをリセット
        this._mapChanged = false;

        this.socket = io(SERVER_CONFIG.url, {
            reconnection: true,
            reconnectionAttempts: SERVER_CONFIG.reconnectAttempts,
            reconnectionDelay: SERVER_CONFIG.reconnectDelay,
            auth: {
                playerId: this.playerId
            }
        });

        this.currentMapKey = mapKey;

        this.socket.on('connect', () => {
            console.log('Connected:', this.socket.id);
            // 初回接続時はnewPlayerを送信する必要がある
            this._mapChanged = false;

            // ロビーの場合はlobbyJoinを送信
            if (mapKey === 'lobby') {
                console.log('[NetworkManager] Emitting lobbyJoin!!');
                this.socket.emit('lobbyJoin');
                console.log("ko")
            }

            if (onConnected) onConnected();
        });

        this.socket.on('disconnect', () => console.log('Disconnected'));
        this.socket.on('connect_error', (err) => console.error('Connect error:', err));

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // ===== プレイヤー関連 =====
        this.socket.on("currentPlayers", (players) => {
            console.log('[NetworkManager] Received currentPlayers event');
            this.handleCurrentPlayers(players);
            // currentPlayersを受信した後、次のフレームまで待ってからマップ変更フラグをリセット
            // これにより、BaseGameSceneのconnectメソッドが正しく動作する
            if (this._mapChanged && this.scene && this.scene.time) {
                this.scene.time.delayedCall(100, () => {
                    console.log('[NetworkManager] Resetting mapChanged flag after delay');
                    this._mapChanged = false;
                });
            }
        });
        this.socket.on("newPlayer", (data) => {
            console.log('[NetworkManager] Received newPlayer event:', data);
            if (data.id !== this.playerId) {
                console.log('[NetworkManager] Adding other player:', data.id);
                this.addOtherPlayer(data.id, data.x, data.y, data.hp, data.maxHp, data.level, data.mp, data.maxMp);
            } else {
                console.log('[NetworkManager] Ignoring own player');
            }
        });
        this.socket.on("playerMoved", (data) => {
            const op = this.otherPlayers[data.id];
            if (op) op.setPosition(data.pos.x, data.pos.y);
        });
        this.socket.on("playerStatUpdate", (data) => {
            const op = this.otherPlayers[data.id];
            if (op) {
                if (op.setStats) {
                    op.setStats(data.hp, data.maxHp, data.level, data.mp, data.maxMp);
                }
            }
        });
        this.socket.on("playerDisconnected", (id) => this.removeOtherPlayer(id));

        // ===== 敵関連 =====
        this.socket.on("currentEnemies", (enemies) => enemies.forEach(e => this.spawnEnemyFromServer(e)));
        this.socket.on("enemySpawned", (data) => this.spawnEnemyFromServer(data));
        this.socket.on("enemyDefeated", (data) => {
            this.removeEnemyById(data.id);
            if (data.type && this.callbacks.onEnemyKilled) {
                this.callbacks.onEnemyKilled(data);
            }
        });
        this.socket.on("enemyMoved", (data) => {
            const e = this.enemies[data.id];
            if (e) e.setPosition(data.x, data.y);
        });
        this.socket.on("enemyStatUpdate", (data) => {
            const e = this.enemies[data.id];
            if (e && e.active) {
                e.hp = data.hp;
                e.maxHp = data.maxHp;
            }
        });


        // ===== 召喚獣関連 =====
        this.socket.on("summonUpdate", (data) => {
            if (this.callbacks.onSummonUpdate) {
                this.callbacks.onSummonUpdate(data);
            }
        });

        // ===== パーティー関連 =====
        this.socket.on("partyUpdate", (data) => {
            this.partyData = data;
            if (this.callbacks.onPartyUpdate) {
                this.callbacks.onPartyUpdate(data);
            }
        });

        this.socket.on("partyInvited", (data) => {
            if (this.callbacks.onPartyInvited) {
                this.callbacks.onPartyInvited(data);
            }
        });

        this.socket.on("playerHealed", (data) => {
            if (this.callbacks.onHealed) {
                this.callbacks.onHealed(data);
            }
        });

        this.socket.on("playerBuffApplied", (data) => {
            if (this.callbacks.onBuffApplied) {
                this.callbacks.onBuffApplied(data);
            }
        });

        this.socket.on("playerSkillUsed", (data) => {
            if (this.callbacks.onSkillUsed) {
                this.callbacks.onSkillUsed(data);
            }
        });

        // ===== マップ変更 =====
        // サーバーからの mapChange イベントは存在しないため、このハンドラーは削除
        // マップ変更時は changeMap() を呼び出し、サーバーから currentPlayers が送られてくる
    }

    sceneReady() {
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            console.warn('[NetworkManager] Scene still not active when sceneReady() called, will retry');
            // シーンがまだアクティブでない場合は、少し待ってから再試行
            if (this.scene && this.scene.time) {
                this.scene.time.delayedCall(100, () => {
                    if (this.scene && this.scene.sys && this.scene.sys.isActive()) {
                        this.sceneReady();
                    }
                });
            }
            return;
        }

        // pendingCurrentPlayers を処理（シーンがアクティブになった後に処理）
        if (this.pendingCurrentPlayers) {
            const players = this.pendingCurrentPlayers;
            this.pendingCurrentPlayers = null;
            this.handleCurrentPlayers(players);
        }

        // pendingPlayers を処理
        const playersToProcess = [...this.pendingPlayers];
        this.pendingPlayers = [];
        playersToProcess.forEach(p => {
            this.addOtherPlayer(p.id, p.x, p.y, p.hp, p.maxHp, p.level, p.mp, p.maxMp);
        });

        // pendingEnemies を処理
        const enemiesToProcess = [...this.pendingEnemies];
        this.pendingEnemies = [];
        enemiesToProcess.forEach(e => {
            this.spawnEnemyFromServer(e);
        });
    }

    // updateメソッドで定期的にキューイングされたプレイヤーをチェック
    checkPendingPlayers() {
        if (this.pendingPlayers.length > 0 && this.scene && this.scene.sys && this.scene.sys.isActive()) {
            const playersToProcess = [...this.pendingPlayers];
            this.pendingPlayers = [];
            playersToProcess.forEach(p => {
                this.addOtherPlayer(p.id, p.x, p.y, p.hp, p.maxHp, p.level, p.mp, p.maxMp);
            });
        }

        if (this.pendingCurrentPlayers && this.scene && this.scene.sys && this.scene.sys.isActive()) {
            const players = this.pendingCurrentPlayers;
            this.pendingCurrentPlayers = null;
            this.handleCurrentPlayers(players);
        }
    }

    handleCurrentPlayers(players) {
        // シーンがアクティブでない場合は、後で処理するために保存
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            this.pendingCurrentPlayers = players;
            console.warn('[NetworkManager] Scene not active when handleCurrentPlayers called, will retry');
            return;
        }

        console.log('[NetworkManager] handleCurrentPlayers:', Object.keys(players).length, 'players');

        const currentIds = new Set(Object.keys(players).filter(id => id !== this.playerId));
        Object.keys(this.otherPlayers).forEach(id => {
            if (!currentIds.has(id)) this.removeOtherPlayer(id);
        });

        Object.keys(players).forEach(id => {
            if (id !== this.playerId) {
                const p = players[id];
                this.addOtherPlayer(id, p.x, p.y, p.hp, p.maxHp, p.level, p.mp, p.maxMp);
            }
        });
    }

    addOtherPlayer(id, x, y, hp = 100, maxHp = 100, level = 1, mp = 50, maxMp = 50) {
        console.log('[NetworkManager] addOtherPlayer called:', id, 'at', x, y, 'scene active:', this.scene?.sys?.isActive());
        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            this.pendingPlayers.push({ id, x, y, hp, maxHp, level, mp, maxMp });
            console.warn('[NetworkManager] Scene not active, queuing player:', id);
            return;
        }

        if (this.otherPlayers[id]) {
            const existing = this.otherPlayers[id];
            // 既存のスプライトが現在のシーンで有効かチェック
            if (existing.active && existing.scene === this.scene) {
                console.log('[NetworkManager] Player already exists and active, updating position:', id);
                existing.setPosition(x, y);
                if (existing.setStats) existing.setStats(hp, maxHp, level, mp, maxMp);
                return existing;
            } else {
                console.log('[NetworkManager] Existing player sprite is dead or from old scene, re-creating:', id);
                try { existing.destroy(); } catch (e) { }
                delete this.otherPlayers[id];
            }
        }

        console.log('[NetworkManager] Creating new player:', id);
        const other = new Player(this.scene, x, y, false);
        if (other.setStats) other.setStats(hp, maxHp, level, mp, maxMp);
        this.otherPlayers[id] = other;

        if (this.callbacks.onPlayerAdded) {
            try { this.callbacks.onPlayerAdded(id, x, y, hp, maxHp, level); } catch (e) { console.warn(e); }
        }

        console.log('[NetworkManager] Player created successfully:', id, 'total players:', Object.keys(this.otherPlayers).length);
        return other;
    }

    removeOtherPlayer(id) {
        const player = this.otherPlayers[id];
        if (!player) return;

        if (player.nameUI) try { player.nameUI.destroy(); } catch (e) { console.warn(e); }
        player.nameUI = null;

        if (this.callbacks.onPlayerRemoved) {
            try { this.callbacks.onPlayerRemoved(player); } catch (e) { console.warn(e); }
        }

        if (player.active && player.scene) try { player.destroy(); } catch (e) { console.warn(e); }

        delete this.otherPlayers[id];
    }

    clearAllOtherPlayers() {
        Object.keys(this.otherPlayers).forEach(id => this.removeOtherPlayer(id));
    }

    spawnEnemyFromServer(data) {
        console.log('[NetworkManager] spawnEnemyFromServer called:', data.id, 'scene active:', this.scene?.sys?.isActive());

        if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
            this.pendingEnemies.push(data);
            console.warn('[NetworkManager] Scene not active, queuing enemy:', data.id);
            return;
        }

        if (this.enemies[data.id]) {
            const existing = this.enemies[data.id];
            if (existing && existing.active) existing.setPosition(data.x, data.y);
            console.log('[NetworkManager] Enemy already exists, updated position:', data.id);
            return;
        }

        console.log('[NetworkManager] Creating new enemy via callback:', data.id);
        if (this.callbacks.onEnemySpawned) {
            const enemy = this.callbacks.onEnemySpawned(data);
            if (enemy) {
                this.enemies[data.id] = enemy;
                console.log('[NetworkManager] Enemy created successfully:', data.id, 'total enemies:', Object.keys(this.enemies).length);
            } else {
                console.warn('[NetworkManager] Enemy creation failed:', data.id);
            }
        } else {
            console.warn('[NetworkManager] No onEnemySpawned callback set!');
        }
    }

    removeEnemyById(id) {
        const e = this.enemies[id];
        if (!e) return;

        if (this.callbacks.onEnemyRemoved) try { this.callbacks.onEnemyRemoved(e); } catch (error) { console.warn(error); }
        if (e.active && e.scene) try { e.destroy(); } catch (error) { console.warn(error); }
        delete this.enemies[id];
    }

    clearAllEnemies() {
        Object.keys(this.enemies).forEach(id => this.removeEnemyById(id));
    }

    sendPlayerPosition(x, y) { if (this.socket && this.socket.connected) this.socket.emit('playerMove', { x, y }); }
    sendPlayerStats(hp, maxHp, level, mp, maxMp) { if (this.socket && this.socket.connected) this.socket.emit('playerStatsUpdate', { hp, maxHp, level, mp, maxMp }); }
    sendSummonUpdate(data) { if (this.socket && this.socket.connected) this.socket.emit('summonUpdate', data); }
    changeMap(mapKey, x, y) {
        if (this.socket && this.socket.connected) {
            console.log('[NetworkManager] Changing map from', this.currentMapKey, 'to', mapKey);
            this.clearAllOtherPlayers();
            this.currentMapKey = mapKey;
            this._mapChanged = true;
            this.socket.emit('mapChange', { mapKey, x, y });
        }
    }
    notifyEnemyDefeat(enemyId) { if (this.socket && this.socket.connected) this.socket.emit('enemyDefeat', { id: enemyId }); }

    // パーティー系
    inviteToParty(targetId) {
        console.log('[NetworkManager] inviteToParty:', targetId);
        if (this.socket && this.socket.connected) this.socket.emit('partyInvite', { targetId });
    }
    joinParty(partyId) {
        console.log('[NetworkManager] joinParty:', partyId);
        if (this.socket && this.socket.connected) this.socket.emit('partyJoin', { partyId });
    }
    leaveParty() {
        console.log('[NetworkManager] leaveParty');
        if (this.socket && this.socket.connected) this.socket.emit('partyLeave');
    }
    healPlayer(targetId, amount) { if (this.socket && this.socket.connected) this.socket.emit('playerHeal', { targetId, amount }); }
    healPlayer(targetId, amount) { if (this.socket && this.socket.connected) this.socket.emit('playerHeal', { targetId, amount }); }
    sendBuff(targetId, type, value, duration) { if (this.socket && this.socket.connected) this.socket.emit('playerBuff', { targetId, type, value, duration }); }
    sendSkillUse(skillId, x, y, direction) { if (this.socket && this.socket.connected) this.socket.emit('playerSkill', { skillId, x, y, direction }); }

    setCallback(name, callback) { if (this.callbacks.hasOwnProperty(name)) this.callbacks[name] = callback; }

    updateRemotePlayers() { Object.values(this.otherPlayers).forEach(op => { if (op && op.active && op.updateRemotePosition) op.updateRemotePosition(); }); }
    updateEnemies(time, delta) { Object.values(this.enemies).forEach(e => { if (e && e.active) e.update(time, delta); }); }

    disconnect() {
        if (this.socket) { this.socket.removeAllListeners(); this.socket.disconnect(); this.socket = null; }
        this.clearAllOtherPlayers();
        Object.keys(this.enemies).forEach(id => this.removeEnemyById(id));
    }

    getSocket() { return this.socket; }
    getSocketId() { return this.playerId; }
    getPlayerId() { return this.playerId; }
    getOtherPlayers() { return this.otherPlayers; }
    getEnemies() { return this.enemies; }
    getCurrentMapKey() { return this.currentMapKey; }
    isMapChanged() { return this._mapChanged === true; }
}
