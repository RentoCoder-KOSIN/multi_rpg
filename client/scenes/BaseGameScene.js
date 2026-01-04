// BaseGameScene.js
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import QuestManager from '../managers/QuestManager.js';
import DialogueManager from '../managers/DialogueManager.js';
import NetworkManager from '../managers/NetworkManager.js';
import { resolvePlayerSpawn } from '../utils/playerSpawn.js';
import { createNPCsFromMap } from '../utils/npcFactory.js';
import { setupTilemap } from '../utils/tilemapHelper.js';
import { setupMapCollisions } from '../utils/collisionHelper.js';
import { setupCameraAndWorld } from '../utils/cameraHelper.js';
import { setupTeleportsFromMap, updateTeleports } from '../utils/teleportHelper.js';
import { updateNPCInteraction } from '../utils/interactionHelper.js';
import { createPlayerAnimations } from '../animations/playerAnimations.js';
import MapNameUI from '../ui/MapNameUI.js';
import NotificationUI from '../ui/NotificationUI.js';
import PlayerNameUI from '../ui/PlayerNameUI.js';
import QuestTrackerUI from '../ui/QuestTrackerUI.js';
import PlayerStatsUI from '../ui/PlayerStatsUI.js';
import SkillBarUI from '../ui/SkillBarUI.js';
import InventoryUI from '../ui/InventoryUI.js';
import ShopUI from '../ui/ShopUI.js';
import EquipmentUI from '../ui/EquipmentUI.js';
import StatAllocationUI from '../ui/StatAllocationUI.js';
import SettingsUI from '../ui/SettingsUI.js';
import SkillManagerUI from '../ui/SkillManagerUI.js';
import PartyUI from '../ui/PartyUI.js';
import PartyHUDUI from '../ui/PartyHUDUI.js';
import SideMenuUI from '../ui/SideMenuUI.js';
import VirtualPadUI from '../ui/VirtualPadUI.js';
import { SKILLS } from '../data/skills.js';
import SummonedBeast from '../entities/SummonedBeast.js';



export default class BaseGameScene extends Phaser.Scene {
    constructor(sceneKey) {
        super(sceneKey);
    }

    getSceneConfig() {
        throw new Error('getSceneConfig() must be implemented by subclass');
    }

    preload() {
        const config = this.getSceneConfig();
        this.load.image('tiles', 'assets/tiles/tileChip.png');
        this.load.tilemapTiledJSON(config.mapKey, config.mapFile);
        this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });

        // 敵画像の読み込み
        this.load.image('slime', 'assets/enemy/slime1.png');
        this.load.image('bat', 'assets/enemy/pipo-enemy001.png');
        this.load.image('forest_slime', 'assets/enemy/slime2.png');
        this.load.image('skeleton', 'assets/enemy/pipo-enemy010.png');
        this.load.image('red_slime', 'assets/enemy/slime3.png');
        this.load.image('goblin', 'assets/enemy/pipo-enemy014.png');
        this.load.image('ghost', 'assets/enemy/pipo-enemy035.png');
        this.load.image('orc', 'assets/enemy/pipo-enemy016.png');
        this.load.image('dire_wolf', 'assets/enemy/pipo-enemy018.png');
        this.load.image('boss', 'assets/enemy/pipo-boss001.png');
        this.load.image('dragon_boss', 'assets/enemy/pipo-boss004.png');

        this.load.image('water', 'assets/tiles/water.png');

        // BGM
        this.load.audio('bgm', 'sounds/bgm.mp3');
    }

    create(data) {
        this._isTeleporting = false;
        this.events.on('wake', () => {
            this._isTeleporting = false;
        });
        const config = this.getSceneConfig();

        // --- QuestManager ---
        this.questManager = this.registry.get('questManager') || new QuestManager(this);
        this.questManager.setScene(this); // 常に現在のシーンをセット
        this.registry.set('questManager', this.questManager);
        console.log('[BaseGameScene] QuestManager synchronized with scene');

        // --- Map ---
        this.map = this.make.tilemap({ key: config.mapKey });
        const tileset = this.map.addTilesetImage('tiles', 'tiles');
        const waterset = this.map.addTilesetImage('water', 'water');
        const { collidableLayers } = setupTilemap(this, this.map, tileset);
        this.collidableLayers = collidableLayers;

        // --- Player ---
        const { x, y } = resolvePlayerSpawn(this.map, data);
        this.shopUI = new ShopUI(this);
        this.inventoryUI = new InventoryUI(this);
        // createUIは各クラスのopen/toggle内で呼ばれるか、個別に行う
        this.shopUI.createUI();
        this.inventoryUI.createUI();
        this.player = new Player(this, x, y, true, null);
        console.log('Player spawn:', x, y);
        createPlayerAnimations(this);
        this.cursors = this.input.keyboard.createCursorKeys();

        // BGM Play
        if (!this.sound.get('bgm')) {
            this.sound.play('bgm', { loop: true, volume: 0.5 });
        } else if (!this.sound.get('bgm').isPlaying) {
            this.sound.get('bgm').play({ loop: true, volume: 0.5 });
        }

        // --- NetworkManager ---
        // NetworkManagerを再利用（既存のインスタンスがあればそれを使用）
        this.networkManager = this.registry.get('networkManager');
        if (!this.networkManager) {
            this.networkManager = new NetworkManager(this);
            this.registry.set('networkManager', this.networkManager);
        } else {
            // 既存のNetworkManagerのシーン参照を更新
            this.networkManager.scene = this;
        }

        this.currentMapKey = data?.mapKey || config.mapKey;
        this.otherPlayers = {}; // 他プレイヤー管理用のオブジェクトを初期化

        this.networkManager.setCallback('onPlayerAdded', (id, px, py) => {
            // 他プレイヤーを追加
            this.addOtherPlayer(id, px, py);
        });
        this.networkManager.setCallback('onEnemySpawned', (enemyData) => {
            return this.spawnEnemyFromServer(enemyData);
        });
        this.networkManager.setCallback('onEnemyKilled', (enemyData) => {
            if (this.questManager) this.questManager.onEnemyKilled(enemyData.type);

            // 報酬を付与（サーバー側でパーティー分配計算済み）
            // killedByに関わらず、exp/goldが送られてくれば付与する
            if (this.player && this.player.active) {
                const exp = enemyData.exp || 0;
                const gold = enemyData.gold || 0;
                const drops = enemyData.drops || [];

                if (exp > 0) this.player.gainExp(exp);
                if (gold > 0) this.player.gainGold(gold);

                // アイテムドロップの処理
                if (drops.length > 0) {
                    drops.forEach(itemId => {
                        this.player.addItem(itemId);
                    });
                }
            }
        });

        this.otherSummons = {};
        this.networkManager.setCallback('onSummonUpdate', (data) => {
            this.handleSummonUpdate(data);
        });

        // --- PartyUI ---
        this.partyUI = new PartyUI(this);
        this.partyUI.createUI();
        this.partyHUD = new PartyHUDUI(this);

        this.networkManager.setCallback('onPartyUpdate', (data) => {
            if (this.partyUI) this.partyUI.updatePartyData(data);
            if (this.partyHUD) this.partyHUD.updatePartyData(data);
        });

        this.networkManager.setCallback('onPartyInvited', (data) => {
            const accept = confirm(`${data.fromName} からパーティーに招待されました。参加しますか？`);
            if (accept) {
                this.networkManager.joinParty(data.partyId);
            }
        });

        this.networkManager.setCallback('onHealed', (data) => {
            if (this.player && this.player.active) {
                const amount = data.amount;
                this.player.stats.hp = Math.min(this.player.stats.maxHp, this.player.stats.hp + amount);
                this.player.saveStats();
                this.networkManager.sendPlayerStats(this.player.stats.hp, this.player.stats.maxHp);

                // エフェクト表示
                const healText = this.add.text(this.player.x, this.player.y - 40, `+${amount}`, {
                    fontSize: '14px', color: '#00ff00', fontFamily: '"Press Start 2P"'
                }).setOrigin(0.5);
                this.tweens.add({ targets: healText, y: this.player.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
                this.showHitEffect(this.player.x, this.player.y, 0x00ff00);
            }
        });

        this.networkManager.setCallback('onBuffApplied', (data) => {
            const { type, value, duration, fromId } = data;
            console.log(`[Buff] Applied ${type} +${value} for ${duration}ms from ${fromId}`);

            if (this.player && this.player.active) {
                if (type === 'attack_buff') {
                    // 攻撃力バフ
                    const originalAtk = this.player.stats.atk;
                    this.player.stats.atk += value;
                    this.player.saveStats();

                    const text = this.add.text(this.player.x, this.player.y - 50, 'ATK UP!', { fontSize: '10px', color: '#ff4500', fontFamily: '"Press Start 2P"' }).setOrigin(0.5);
                    this.tweens.add({ targets: text, y: this.player.y - 80, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

                    this.time.delayedCall(duration, () => {
                        this.player.stats.atk -= value;
                        this.player.saveStats();
                    });
                } else if (type === 'defense_buff') {
                    // 防御力バフ
                    const originalDef = this.player.stats.def;
                    this.player.stats.def += value;
                    this.player.saveStats();

                    const text = this.add.text(this.player.x, this.player.y - 50, 'DEF UP!', { fontSize: '10px', color: '#4169e1', fontFamily: '"Press Start 2P"' }).setOrigin(0.5);
                    this.tweens.add({ targets: text, y: this.player.y - 80, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

                    this.time.delayedCall(duration, () => {
                        this.player.stats.def -= value;
                        this.player.saveStats();
                    });
                } else if (type === 'speed_buff') {
                    // 速度バフ
                    const originalSpeed = this.player.speed;
                    this.player.speed += value;
                    // speedはstatsには保存されない一時的なものとする（またはstats.speedBonusを使うべきだが、簡単のため直接speedを変更）

                    const text = this.add.text(this.player.x, this.player.y - 50, 'SPEED UP!', { fontSize: '10px', color: '#00ffff', fontFamily: '"Press Start 2P"' }).setOrigin(0.5);
                    this.tweens.add({ targets: text, y: this.player.y - 80, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

                    this.time.delayedCall(duration, () => {
                        this.player.speed -= value;
                    });
                } else if (type === 'summon_power_up') {
                    // 召喚獣強化バフ（プレイヤー経由で受信）
                    if (this.activeSummon && this.activeSummon.active) {
                        this.activeSummon.atk += value;
                        this.activeSummon.speed += 50;
                        const originalScale = this.activeSummon.scale;
                        this.activeSummon.setScale(originalScale * 1.5);

                        const text = this.add.text(this.activeSummon.x, this.activeSummon.y - 50, 'SUMMON POWER UP!', { fontSize: '10px', color: '#9370db', fontFamily: '"Press Start 2P"' }).setOrigin(0.5);
                        this.tweens.add({ targets: text, y: this.activeSummon.y - 80, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

                        this.time.delayedCall(duration, () => {
                            if (this.activeSummon && this.activeSummon.active) {
                                this.activeSummon.atk -= value;
                                this.activeSummon.speed -= 50;
                                this.activeSummon.setScale(originalScale);
                            }
                        });
                    }
                }
            }
        });

        this.networkManager.setCallback('onSkillUsed', (data) => {
            const { id, skillId, x, y, direction } = data;
            console.log(`[BaseGameScene] Skill used by ${id}: ${skillId}`);

            // 他プレイヤーのエフェクト再生
            const otherPlayer = this.otherPlayers[id];
            if (otherPlayer && otherPlayer.active) {
                // スキルの定義を取得
                const skill = SKILLS[skillId];
                if (skill) {
                    this.applySkillEffect(skillId, otherPlayer, true);
                }
            }
        });

        // --- Connect and process queued players ---

        // --- Connect and process queued players ---
        this.networkManager.connect(this.currentMapKey, () => {
            // ソケットをプレイヤーに設定
            this.socket = this.networkManager.getSocket();
            this.player.socket = this.socket;
            // newPlayerイベントの送信はNetworkManager.connect内で処理されるため、ここでは何もしない
            console.log('[BaseGameScene] Connected, socket set to player');
        });

        // --- NPC ---
        this.npcs = createNPCsFromMap(this, this.map);

        // NPCの状態をクエスト状況と同期
        this.npcs.forEach(npc => {
            if (npc.questId) {
                // 完了状態（報告済み）をチェック
                if (this.questManager.isFinished(npc.questId)) {
                    npc.is_Complited = true;
                }
            }
        });

        // --- Collisions ---
        setupMapCollisions(this, {
            player: this.player,
            npcs: this.npcs,
            collidableLayers,
            otherPlayers: this.networkManager.getOtherPlayers()
        });

        // --- Teleports ---
        this.teleports = setupTeleportsFromMap(this, this.map) || [];
        // テレポートの状態を同期
        this.teleports.forEach(tp => {
            if (tp.requiredQuest && (this.questManager.isFinished(tp.requiredQuest) || this.questManager.isCompleted(tp.requiredQuest))) {
                tp.unlocked = true;
            }
        });

        // --- Camera ---
        setupCameraAndWorld(this, this.map, this.player);

        // --- UI ---
        this.dialogue = new DialogueManager(this);
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.skillKeys = [
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
            this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE)
        ];
        this.partyKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
        if (config.showDebugKey) this.debugKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

        // UIの位置を正しい画面サイズで計算（Phaser.Scale.FITモードに対応）
        const gameWidth = this.scale.gameSize ? this.scale.gameSize.width : this.scale.width;
        const gameHeight = this.scale.gameSize ? this.scale.gameSize.height : this.scale.height;

        this.interactText = this.add.text(
            gameWidth / 2,
            gameHeight - 120,
            '[C] 会話',
            { fontSize: '16px', color: '#ffff00', fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 3 }
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false);

        this.interactBg = this.add.rectangle(
            gameWidth / 2,
            gameHeight - 120,
            150, 35, 0x000000, 0.7
        ).setOrigin(0.5).setScrollFactor(0).setVisible(false).setStrokeStyle(2, 0xffff00, 1);

        if (config.showQuestTracker) this.questTrackerUI = new QuestTrackerUI(this, this.questManager);

        // チュートリアル時は職業選択クエストを自動開始
        if (this.currentMapKey === 'tutorial' &&
            !this.questManager.isStarted('choose_job') &&
            !this.questManager.isCompleted('choose_job') &&
            !this.questManager.isFinished('choose_job')) {
            this.questManager.startQuest('choose_job');
        }

        this.mapNameUI = new MapNameUI(this, this.currentMapKey.toUpperCase());
        this.notificationUI = new NotificationUI(this);
        this.playerStatsUI = new PlayerStatsUI(this, this.player);
        this.skillBarUI = new SkillBarUI(this, this.player);
        this.equipmentUI = new EquipmentUI(this);
        this.equipmentUI.createUI();
        this.statAllocationUI = new StatAllocationUI(this);
        this.statAllocationUI.createUI();
        this.skillManagerUI = new SkillManagerUI(this);
        this.skillManagerUI.createUI();
        this.settingsUI = new SettingsUI(this);
        this.settingsUI.createUI();
        this.sideMenuUI = new SideMenuUI(this);
        this.virtualPadUI = new VirtualPadUI(this);

        this.isMobile = !this.sys.game.device.os.desktop;
        if (!this.isMobile) {
            if (this.virtualPadUI && this.virtualPadUI.container) this.virtualPadUI.container.setVisible(false);
        }

        // Settings key (O)
        this.input.keyboard.on('keydown-O', () => {
            if (this.settingsUI) {
                this.settingsUI.toggle();
            }
        });

        // Menu key (M)
        this.input.keyboard.on('keydown-M', () => {
            if (this.sideMenuUI) {
                this.sideMenuUI.toggle();
            }
        });

        // ESC key (Close UI only)
        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.escKey.on('down', () => {
            console.log('ESC key pressed');
            // Close other UIs if open
            if (this.shopUI && this.shopUI.isOpen) {
                console.log('Closing ShopUI');
                this.shopUI.close();
            } else if (this.inventoryUI && this.inventoryUI.isOpen) {
                console.log('Toggling InventoryUI');
                this.inventoryUI.toggle();
            } else if (this.equipmentUI && this.equipmentUI.isOpen) {
                console.log('Toggling EquipmentUI');
                this.equipmentUI.toggle();
            } else if (this.statAllocationUI && this.statAllocationUI.isOpen) {
                console.log('Toggling StatAllocationUI');
                this.statAllocationUI.toggle();
            } else if (this.skillManagerUI && this.skillManagerUI.isOpen) {
                console.log('Toggling SkillManagerUI');
                this.skillManagerUI.toggle();
            } else if (this.settingsUI && this.settingsUI.visible) { // SettingsUI uses visible property check inside itself usually, but we corrected BaseGameScene logic before.
                // Wait, SettingsUI actually has a 'visible' property but loop check above used 'visible' before correction.
                // Let's check SettingsUI.js again. It has 'visible' property and 'toggle' method.
                // It does NOT have 'isOpen' property explicitly defined in constructor in previous view, let's verify.
                console.log('Closing SettingsUI');
                this.settingsUI.toggle();
            }
        });

        this.input.keyboard.on('keydown-K', () => {
            if (!this.shopUI.isOpen && !this.inventoryUI.isOpen && !this.equipmentUI.isOpen && !this.statAllocationUI.isOpen) {
                this.skillManagerUI.toggle();
            }
        });

        // --- タップで移動対応 (スマホ/マウス) ---
        // --- 地面クリック移動 (モバイルのみ / PCは無効化) ---
        this.input.on('pointerdown', (pointer, currentlyOver) => {
            // 画面左端 (メニューボタン付近) のクリックなら移動させない
            if (pointer.x < 100) return;

            // UI上のクリックなら即終了 (currentlyOverには現在重なっているインタラクティブなオブジェクトが入る)
            if (currentlyOver && currentlyOver.length > 0) return;

            // 会話中も移動禁止
            if (this.dialogue && this.dialogue.isTalking) return;

            // インベントリ等が開いている時も移動禁止
            const isAnyWindowOpen = this.inventoryUI?.isOpen || this.shopUI?.isOpen || this.skillManagerUI?.isOpen || this.statAllocationUI?.isOpen || (this.settingsUI && this.settingsUI.visible);
            if (isAnyWindowOpen) return;

            // プレイヤーに目標地点をセット (モバイル環境のみ)
            if (this.isMobile && this.player && this.player.active) {
                const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
                this.player.moveTo(worldPoint.x, worldPoint.y);
            }
        });

        // プレイヤー名をレジストリから取得
        const playerNames = this.registry.get('playerNames') || {};

        const socket = this.networkManager.getSocket();
        const myPlayerName = (socket && playerNames[socket.id]) || 'You';
        this.playerNameUI = new PlayerNameUI(this, this.player, myPlayerName);

        // シーンが完全に初期化された後にキューイングされたプレイヤーを処理
        // 次のフレームで実行することで、シーンが確実にアクティブになった後に処理される
        this.time.delayedCall(0, () => {
            if (this.networkManager) {
                this.networkManager.sceneReady();
            }
        });
    }


    addOtherPlayer(id, x, y) {
        // NetworkManagerが既にプレイヤーを作成しているので、それを取得
        const otherPlayers = this.networkManager.getOtherPlayers();
        const other = otherPlayers[id];

        if (!other) {
            console.warn(`[BaseGameScene] Player ${id} not found in NetworkManager`);
            return null;
        }

        // 既にコライダーが設定されているかチェック（重複設定を防ぐ）
        if (!other._collidersSet) {
            // Collider 設定
            if (this.collidableLayers) {
                this.collidableLayers.forEach(layer => this.physics.add.collider(other, layer));
            }
            if (this.npcs) {
                this.npcs.forEach(npc => this.physics.add.collider(other, npc));
            }

            // --- Click to Invite ---
            other.setInteractive({ useHandCursor: true });
            other.on('pointerdown', (pointer, localX, localY, event) => {
                if (event) event.stopPropagation();

                // 既に自分のパーティーにいるかチェック
                const myId = this.networkManager.getPlayerId();
                const inParty = this.networkManager.partyData?.members.some(m => m.id === id);

                if (inParty) {
                    if (this.notificationUI) this.notificationUI.show('既にパーティーメンバーです', 'info');
                    return;
                }

                const playerName = this.registry.get('playerNames')?.[id] || `Player ${id.substring(0, 6)}`;
                const accept = confirm(`${playerName} をパーティーに招待しますか？`);
                if (accept) {
                    this.networkManager.inviteToParty(id);
                    if (this.notificationUI) this.notificationUI.show(`${playerName} を招待しました`, 'success');
                }
            });

            other._collidersSet = true; // フラグを設定して重複を防ぐ
        }

        return other;
    }

    spawnEnemyFromServer(data) {
        // NetworkManager側で既に存在チェックが行われているため、ここでは新規作成のみを行う
        const textureKey = data.type || 'slime';
        const enemy = new Enemy(this, data.x, data.y, textureKey, data.type, data.id, data.spawnId, this.networkManager.getSocket(), data);

        if (this.collidableLayers) this.collidableLayers.forEach(layer => this.physics.add.collider(enemy, layer));

        // プレイヤーとの戦闘
        if (this.player) {
            this.physics.add.overlap(this.player, enemy, () => {
                const now = this.time.now;

                // プレイヤーが敵を攻撃
                if (this.player.active && enemy.active && (!enemy.lastHitTime || now - enemy.lastHitTime > 500)) {
                    const damageData = this.player.getDamage(1, enemy);
                    enemy.takeDamage(damageData.amount, this.player);
                    if (enemy) enemy.lastHitTime = now;

                    // 攻撃エフェクト
                    this.cameras.main.shake(100, 0.005);

                    if (damageData.isCrit) {
                        this.showHitEffect(enemy.x, enemy.y - 20, 0xffff00);
                        const critText = this.add.text(enemy.x, enemy.y - 40, 'CRITICAL!', {
                            fontSize: '16px', color: '#ffff00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4
                        }).setOrigin(0.5);
                        this.tweens.add({ targets: critText, y: enemy.y - 80, alpha: 0, duration: 800, onComplete: () => critText.destroy() });
                    }
                }

                // 敵がプレイヤーを攻撃
                // ボスなどの強力な敵の場合、接触直後に即死しないように少し長めの無敵時間または猶予を設ける
                if (this.player.active && enemy.active) {
                    // グローバルな被ダメージクールダウン (2000ms)
                    if (!this.player.lastHitTime || now - this.player.lastHitTime > 2000) {
                        this.player.takeDamage(enemy.atk);
                        if (this.player) this.player.lastHitTime = now;
                    }
                }
            });
        }

        Object.values(this.networkManager.getOtherPlayers()).forEach(op => { if (op && op.active) this.physics.add.overlap(op, enemy); });

        // 召喚獣との接触判定を追加
        if (this.activeSummon && this.activeSummon.active) {
            this.physics.add.overlap(this.activeSummon, enemy, () => {
                const now = this.time.now;
                if (!this.activeSummon.lastHitTime || now - this.activeSummon.lastHitTime > 1000) {
                    this.activeSummon.takeDamage(enemy.atk);
                    this.activeSummon.lastHitTime = now;
                }
            });
        }

        return enemy;
    }

    handleSkillUse(index) {
        if (!this.player || !this.player.active) return;
        const skillId = this.player.stats.activeSkills?.[index];
        if (skillId) {
            this.usePlayerSkill(skillId);
        }
    }

    handleInteraction() {
        if (!this.player || !this.player.active) return;
        // 近隣のNPCを探して会話
        const distanceThreshold = 50;
        let targetNPC = null;

        for (const npc of this.npcs) {
            const distance = Phaser.Math.Distance.Between(npc.x, npc.y, this.player.x, this.player.y);
            if (distance < distanceThreshold) {
                targetNPC = npc;
                break;
            }
        }

        if (targetNPC && this.dialogue && !this.dialogue.isTalking) {
            this.dialogue.startDialogue(targetNPC);
            // クエスト進行（interactionHelper.js と同じロジックをここにも持たせるか、向こうを呼び出しやすくする）
            if (targetNPC.questId) {
                const quest = this.questManager.quests[targetNPC.questId];
                if (quest && quest.type === 'talk' && quest.status === 'active') {
                    quest.progress++;
                    if (quest.progress >= quest.required) {
                        this.questManager.completeQuest(targetNPC.questId);
                    }
                }
            }
        }
    }

    update(time, delta) {
        if (!this.player || !this.player.active) return;

        // クルソル入力を取得
        this.player.update(this.cursors);

        // インベントリ等が開いている時はスキル使用禁止
        const isAnyWindowOpen = this.inventoryUI?.isOpen || this.shopUI?.isOpen || this.skillManagerUI?.isOpen || this.statAllocationUI?.isOpen || (this.settingsUI && this.settingsUI.visible);

        // スキル使用 (1-3キー)
        if (!isAnyWindowOpen && this.skillKeys) {
            this.skillKeys.forEach((key, index) => {
                if (Phaser.Input.Keyboard.JustDown(key)) {
                    this.handleSkillUse(index);
                }
            });
        }

        // PartyUI (V)
        if (Phaser.Input.Keyboard.JustDown(this.partyKey)) {
            this.partyUI.toggle();
        }

        // キューイングされたプレイヤーを定期的にチェック
        if (this.networkManager) {
            this.networkManager.checkPendingPlayers();
        }

        this.networkManager.updateRemotePlayers();
        this.networkManager.updateEnemies();

        updateNPCInteraction(this, { player: this.player, npcs: this.npcs, dialogue: this.dialogue, interactKey: this.interactKey, interactText: this.interactText, interactBg: this.interactBg });
        if (this.playerNameUI) this.playerNameUI.updatePosition();
        if (this.playerStatsUI) this.playerStatsUI.update();

        // バフの期限チェック
        if (this.player) {
            this.player.updateBuffs();
        }

        // --- MP自然回復 ---
        if (this.player && this.player.stats) {
            // 聖なる武器装備時は常にMAX
            if (this.player.stats.equipment && this.player.stats.equipment.weapon === 'holy_weapon') {
                if (this.player.stats.mp < this.player.stats.maxMp) {
                    this.player.stats.mp = this.player.stats.maxMp;
                    // MP回復通知はうるさいので出さないか、必要なら変更
                }
            } else {
                // 通常の自然回復 (1秒に1回、最大MPの1% + MEN値)
                // time はミリ秒
                if (!this._lastMpRegen || time - this._lastMpRegen > 1000) {
                    const regenAmount = Math.max(1, Math.floor(this.player.stats.maxMp * 0.01) + Math.floor(this.player.stats.men / 5));
                    if (this.player.stats.mp < this.player.stats.maxMp) {
                        this.player.stats.mp = Math.min(this.player.stats.maxMp, this.player.stats.mp + regenAmount);
                    }
                    this._lastMpRegen = time;
                }
            }
        }
        if (this.skillBarUI) this.skillBarUI.update();

        const otherPlayers = this.networkManager.getOtherPlayers();
        const playerNames = this.registry.get('playerNames') || {};
        Object.keys(otherPlayers).forEach(id => {
            const op = otherPlayers[id];
            if (op && op.active) {
                const playerName = playerNames[id] || `Player ${id.substring(0, 6)}`;
                if (!op.nameUI) op.nameUI = new PlayerNameUI(this, op, playerName, id);
                else {
                    op.nameUI.updatePosition();
                    if (op.nameUI.playerName !== playerName) {
                        op.nameUI.setName(playerName);
                    }
                }
            } else if (op && op.nameUI) {
                try { op.nameUI.destroy(); } catch (e) { }
                op.nameUI = null;
            }
        });

        this.npcs.forEach(npc => npc.updateQuestIcon(this.questManager));
        updateTeleports(this, this.player, this.npcs, this.teleports);

        // 召喚獣の更新
        if (this.activeSummon && this.activeSummon.active) {
            if (this.activeSummon.updateSummon) {
                this.activeSummon.updateSummon();
            }

            // 更新処理(updateSummon)内で消滅(null)する可能性があるため、再度チェック
            if (!this.activeSummon || !this.activeSummon.active) return;

            // 位置同期 (頻度を制限すべきだが、一旦毎フレームチェック)
            const now = this.time.now;
            if (!this.activeSummon.lastPosSent || now - this.activeSummon.lastPosSent > 100) {
                if (this.activeSummon.x !== this.activeSummon.lastX || this.activeSummon.y !== this.activeSummon.lastY) {
                    this.networkManager.sendSummonUpdate({
                        type: 'move',
                        x: this.activeSummon.x,
                        y: this.activeSummon.y
                    });
                    this.activeSummon.lastX = this.activeSummon.x;
                    this.activeSummon.lastY = this.activeSummon.y;
                    this.activeSummon.lastPosSent = now;
                }
            }
        }
    }

    usePlayerSkill(skillId) {
        const player = this.player;
        const skill = SKILLS[skillId];
        if (!skill) return;

        // UIが開いている間はスキル使用不可 (モバイル対策)
        const isAnyWindowOpen = this.inventoryUI?.isOpen || this.shopUI?.isOpen || this.skillManagerUI?.isOpen || this.statAllocationUI?.isOpen || (this.settingsUI && this.settingsUI.visible);
        if (isAnyWindowOpen) return;

        const now = Date.now();
        const lastUse = player.skillCooldowns[skillId] || 0;
        let cdTime = skill.cd || 2000;

        // 聖なる武器装備時はクールダウン半減
        if (player.stats.equipment.weapon === 'holy_weapon') {
            cdTime = Math.floor(cdTime * 0.5);
        }

        if (now - lastUse < cdTime) {
            if (this.notificationUI) this.notificationUI.show('クールダウン中...', 'error');
            return;
        }

        let mpCost = skill.mpCost || 0;
        // 聖なる武器装備時はMP消費ゼロ
        if (player.stats.equipment.weapon === 'holy_weapon') {
            mpCost = 0;
        }

        if (player.stats.mp < mpCost) {
            if (this.notificationUI) this.notificationUI.show('MPが足りません！', 'error');
            return;
        }

        if (skillId === 'summon' || skillId === 'mega_summon' || skillId === 'demon_lord_summon') {
            if (this.activeSummon && this.activeSummon.active) {
                // 既にいる場合は帰還させる
                this.destroySummon(this.activeSummon);
                if (this.notificationUI) this.notificationUI.show('召喚獣を帰還させました', 'info');
                return;
            }
        }

        player.stats.mp -= mpCost;

        // 召喚スキル以外は即座にクールダウン開始
        // 召喚スキルは消滅時にクールダウン開始
        if (skillId !== 'summon' && skillId !== 'mega_summon' && skillId !== 'demon_lord_summon') {
            player.skillCooldowns[skillId] = now;
        }

        player.saveStats();

        // エフェクト発動
        this.applySkillEffect(skillId, player);

        // サモンスキルの特殊処理
        if (skillId === 'summon' || skillId === 'mega_summon' || skillId === 'demon_lord_summon') {
            this.spawnSummon(player, skillId);
            return;
        }

        const isPartySkill = skill.targetType === 'party';

        if (skillId === 'command_attack') {
            if (this.activeSummon && this.activeSummon.active) {
                this.activeSummon.commandAttack();
                player.skillCooldowns[skillId] = now; // クールダウン開始
                if (this.notificationUI) this.notificationUI.show('召喚獣に突撃を命じた！', 'success');
            } else {
                if (this.notificationUI) this.notificationUI.show('召喚獣がいません！', 'error');
            }
            return;
        }

        // 範囲攻撃判定 (レベルに応じて強化)
        // 範囲攻撃判定 (レベルに応じて強化)
        const skillLevel = player.stats.skillLevels?.[skillId] || 1;
        const levelBonus = 1 + (skillLevel - 1) * 0.15; // 1レベルごとに15%効果増
        const damageBonus = levelBonus;
        const healBonus = levelBonus;
        const rangeBonus = 1 + (skillLevel - 1) * 0.1;  // 1レベルごとに10%範囲増

        const range = (skill.range || 80) * rangeBonus;
        const damageMultiplier = (skill.damageMult || 1) * damageBonus;

        const rangeType = skill.rangeType || 'circle';
        const enemies = this.children.list.filter(child => child instanceof Enemy && child.active);

        // --- 近くの敵に自動で向きを合わせる (扇形・直線スキルの場合) ---
        if (rangeType === 'fan' || rangeType === 'line') {
            let nearest = null;
            let minDist = range * 1.5; // 射程の1.5倍まで探索
            enemies.forEach(e => {
                const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = e;
                }
            });
            if (nearest) {
                player.flipX = (nearest.x < player.x);
            }
        }

        // プレイヤーの方向 (右向きがデフォルト、左向きは flipX=true)
        const direction = player.flipX ? -1 : 1;

        if (isPartySkill) {
            // パーティーメンバー（自分を含む）を回復/バフ
            const myId = this.networkManager.getPlayerId();

            // パーティメンバーIDリストを取得
            const partyMemberIds = this.networkManager.partyData?.members?.map(m => m.id) || [myId];

            // 自分自身を含むターゲットリスト
            const targets = [
                { player: player, id: myId, dist: 0 }
            ];

            // 他のパーティメンバーを追加
            partyMemberIds.forEach(memberId => {
                if (memberId === myId) return; // 自分は既に追加済み

                const remotePlayer = this.remotePlayers.get(memberId);
                if (!remotePlayer || !remotePlayer.active) return;

                const dx = remotePlayer.x - player.x;
                const dy = remotePlayer.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < range) {
                    targets.push({ player: remotePlayer, id: memberId, dist });
                }
            });

            // 各ターゲットにスキル効果を適用
            targets.forEach(({ player: target, id: targetId, dist }) => {
                if (skillId === 'heal') {
                    const skillLevel = player.stats.skillLevels?.[skillId] || 1;
                    const int = player.stats.int || 5;
                    const baseHeal = skill.heal || 50;
                    const healAmount = Math.ceil(baseHeal * (1 + (int * 0.1)) * (1 + (skillLevel - 1) * 0.2));

                    target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + healAmount);
                    const healText = this.add.text(target.x, target.y - 40, `+${healAmount}`, {
                        fontSize: '16px', color: '#00ff00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 3
                    }).setOrigin(0.5);
                    this.tweens.add({ targets: healText, y: target.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
                    this.showHitEffect(target.x, target.y, 0x00ff00);

                    // HP同期
                    if (target === player) {
                        this.networkManager.sendPlayerStats(player.stats.hp, player.stats.maxHp);
                    } else {
                        this.networkManager.healPlayer(targetId, healAmount);
                    }

                } else if (skillId === 'attack_buff') {
                    // 攻撃力 +50%
                    const buffValue = Math.ceil(target.stats.atk * 0.5);
                    target.applyBuff('attack_buff', buffValue, 30000);
                    this.applyBuffVisual(target, 'attack_buff', buffValue, 30000);
                    this.networkManager.sendBuff(targetId, 'attack_buff', buffValue, 30000);
                } else if (skillId === 'defense_buff') {
                    // 防御力 +50%
                    const buffValue = Math.ceil(target.stats.def * 0.5);
                    target.applyBuff('defense_buff', buffValue, 30000);
                    this.applyBuffVisual(target, 'defense_buff', buffValue, 30000);
                    this.networkManager.sendBuff(targetId, 'defense_buff', buffValue, 30000);
                } else if (skillId === 'speed_buff') {
                    // 速度 +50
                    target.applyBuff('speed_buff', 50, 30000);
                    this.applyBuffVisual(target, 'speed_buff', 50, 30000);
                    this.networkManager.sendBuff(targetId, 'speed_buff', 50, 30000);
                } else if (skillId === 'summon_boost') {
                    // 召喚獣強化
                    const buffValue = Math.ceil(player.stats.int * 2); // 知力依存
                    target.applyBuff('summon_power_up', buffValue, 45000);
                    this.applyBuffVisual(target, 'summon_power_up', buffValue, 45000);
                    this.networkManager.sendBuff(targetId, 'summon_power_up', buffValue, 45000);
                }
            });

        } else {
            enemies.forEach(enemy => {
                const dx = enemy.x - player.x;
                const dy = enemy.y - (player.y - 20); // キャラクターの腰あたりを基準にする
                const dist = Math.sqrt(dx * dx + dy * dy);

                let isHit = false;

                if (rangeType === 'circle') {
                    if (dist < range) isHit = true;
                } else if (rangeType === 'line') {
                    // 前方直線範囲 (縦幅±40程度)
                    const inFront = (direction > 0) ? dx > 0 : dx < 0;
                    if (inFront && Math.abs(dx) < range && Math.abs(dy) < 40) isHit = true;
                } else if (rangeType === 'fan') {
                    // 前方扇形範囲 (約90度)
                    const inFront = (direction > 0) ? dx > 0 : dx < 0;
                    if (inFront && dist < range && Math.abs(dy) < Math.abs(dx) + 20) isHit = true;
                }

                if (isHit) {
                    const damageData = player.getDamage(damageMultiplier, enemy);
                    const damage = damageData.amount;

                    // 会心演出
                    if (damageData.isCrit) {
                        this.showHitEffect(enemy.x, enemy.y - 20, 0xffff00); // 豪華なヒット
                        const critText = this.add.text(enemy.x, enemy.y - 40, 'CRITICAL!', {
                            fontSize: '16px', color: '#ffff00', fontFamily: '"Press Start 2P"', stroke: '#000', strokeThickness: 4
                        }).setOrigin(0.5);
                        this.tweens.add({ targets: critText, y: enemy.y - 80, alpha: 0, duration: 800, onComplete: () => critText.destroy() });
                    }

                    enemy.takeDamage(damage, player);

                    // HP吸収 (Lifesteal)
                    if (player.stats.lifesteal > 0) {
                        const heal = Math.ceil(damage * player.stats.lifesteal);
                        player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
                        const healText = this.add.text(player.x, player.y - 40, `+${heal}`, {
                            fontSize: '12px', color: '#00ff00', fontFamily: '"Press Start 2P"'
                        }).setOrigin(0.5);
                        this.tweens.add({ targets: healText, y: player.y - 80, alpha: 0, duration: 800, onComplete: () => healText.destroy() });
                    }

                    // ヒットエフェクト
                    this.showHitEffect(enemy.x, enemy.y, skill.color || 0xffffff);
                }
            });
        }

        if (this.notificationUI) {
            this.notificationUI.show(`${skill.name}！`, 'warning');
        }
    }

    applySkillEffect(skillId, sourceUser, isRemote = false) {
        const skill = SKILLS[skillId];
        if (!skill) return;

        // スキルレベルと範囲ボーナスを計算
        const skillLevel = sourceUser.stats?.skillLevels?.[skillId] || 1;
        const rangeBonus = 1 + (skillLevel - 1) * 0.1;
        const baseRange = skill.range || 80;
        const actualRange = baseRange * rangeBonus;

        // エフェクトのスケールを範囲に応じて調整（基準範囲80を1.0とする）
        const effectScale = actualRange / 80;

        // 共通エフェクト (スキル名表示)
        // 他プレイヤーの場合は少し小さめに表示
        const fontSize = isRemote ? '10px' : '12px';
        const textYOffset = isRemote ? -50 : -60;

        const text = this.add.text(sourceUser.x, sourceUser.y + textYOffset, skill.name, {
            fontSize: fontSize,
            color: '#fffff0',
            fontFamily: '"Press Start 2P"',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);
        this.tweens.add({ targets: text, y: sourceUser.y - 100, alpha: 0, duration: 1000, onComplete: () => text.destroy() });

        // 方向
        const direction = sourceUser.flipX ? -1 : 1;
        const startX = sourceUser.x;
        const startY = sourceUser.y;

        // パーティクルエフェクトの汎用生成関数（範囲に応じてスケール）
        const createBurst = (color, count = 10, speed = 100) => {
            const emitter = this.add.particles(startX, startY, 'water', {
                speed: { min: -speed * effectScale, max: speed * effectScale },
                scale: { start: 0.4 * effectScale, end: 0 },
                alpha: { start: 1, end: 0 },
                lifespan: 600,
                blendMode: 'ADD',
                tint: color,
                quantity: Math.ceil(count * effectScale)
            });
            this.time.delayedCall(600, () => emitter.destroy());
        };

        if (skillId === 'slash' || skillId === 'heavy_slash' || skillId === 'whirlwind' || skillId === 'judgment_cut') {
            // 近接斬撃エフェクト
            const slashColor = (skillId === 'heavy_slash') ? 0xff0000 : (skillId === 'judgment_cut' ? 0x00ffff : 0xffffff);

            // 回転斬系
            if (skill.rangeType === 'circle') {
                const circle = this.add.circle(startX, startY, 5 * effectScale, slashColor, 0.6);
                // 衝撃波が広がる（範囲に応じたサイズ）
                this.tweens.add({ targets: circle, radius: actualRange, alpha: 0, duration: 300, onComplete: () => circle.destroy() });
                // リング状のエフェクト
                const ring = this.add.circle(startX, startY, actualRange, slashColor, 0);
                ring.setStrokeStyle(4 * effectScale, slashColor, 0.8);
                this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 300, onComplete: () => ring.destroy() });

                createBurst(slashColor, 20, 150);
            } else {
                // 直線/前方斬撃
                const hitX = startX + (direction * actualRange / 2);
                const slashLine = this.add.rectangle(hitX, startY, actualRange, 10 * effectScale, slashColor).setOrigin(0.5);
                // 斬撃の軌跡
                this.tweens.add({
                    targets: slashLine,
                    alpha: 0,
                    scaleY: 8,
                    angle: direction * 45, // 斜めに斬る
                    duration: 200,
                    onComplete: () => slashLine.destroy()
                });
                createBurst(slashColor, 10, 100);
            }
        } else if (skillId === 'fireball' || skillId === 'big_fireball' || skillId === 'meteor_swarm' || skillId === 'abyss_storm' || skillId === 'dark_nova') {
            // 魔法弾/爆発系
            const color = skill.color || 0xff4500;

            // ターゲット位置に爆発を起こす（簡易的に前方一定距離、または円中心、範囲に応じて調整）
            const targetX = (skill.rangeType === 'circle') ? startX : startX + (direction * 150 * effectScale);

            // 巨大な魔法陣っぽい円（範囲に応じてサイズ変更）
            const circle = this.add.circle(targetX, startY, 10 * effectScale, color, 0.8);
            this.tweens.add({
                targets: circle,
                scale: actualRange / 10, // 実際の範囲に合わせて拡大
                alpha: 0,
                duration: 500,
                onComplete: () => circle.destroy()
            });

            // 魔力収束エフェクト（範囲に応じてパーティクル数とスピード調整）
            const baseQuantity = (skillId === 'meteor_swarm' || skillId === 'abyss_storm') ? 50 : 20;
            const emitter = this.add.particles(targetX, startY, 'water', {
                speed: { min: 50 * effectScale, max: 200 * effectScale },
                scale: { start: 0.6 * effectScale, end: 0 },
                alpha: { start: 1, end: 0 },
                lifespan: 800,
                blendMode: 'ADD',
                tint: color,
                quantity: Math.ceil(baseQuantity * effectScale)
            });
            this.time.delayedCall(800, () => emitter.destroy());

            // 画面シェイク (自分が使った場合か、近くの場合のみ、範囲に応じて強度調整)
            if (!isRemote || Phaser.Math.Distance.Between(this.player.x, this.player.y, startX, startY) < 400) {
                if (skillId === 'meteor_swarm' || skillId === 'abyss_storm' || skillId === 'big_fireball') {
                    this.cameras.main.shake(200, 0.005 * effectScale);
                }
            }
        } else if (skill.targetType === 'party') {
            // バフ・回復系（範囲に応じてエフェクトサイズ調整）
            const color = skill.color || 0x00ff00;
            const ring = this.add.circle(startX, startY, actualRange, color, 0.1);
            ring.setStrokeStyle(2 * effectScale, color, 0.5);
            this.tweens.add({
                targets: ring,
                scale: 1.1,
                alpha: 0,
                duration: 1000,
                onComplete: () => ring.destroy()
            });

            // 上昇するパーティクル（聖なる光、範囲に応じて調整）
            const emitter = this.add.particles(startX, startY + 20, 'water', {
                speedY: { min: -150 * effectScale, max: -50 * effectScale },
                speedX: { min: -20 * effectScale, max: 20 * effectScale },
                scale: { start: 0.4 * effectScale, end: 0 },
                alpha: { start: 0.8, end: 0 },
                lifespan: 1200,
                blendMode: 'ADD',
                tint: color,
                quantity: Math.ceil(15 * effectScale)
            });
            this.time.delayedCall(1200, () => emitter.destroy());
        } else if (skillId === 'sonic_wave' || skillId === 'ice_needle' || skillId === 'holy_arrow') {
            // 射出系（範囲に応じてサイズ調整）
            const color = skill.color || 0x00ffff;
            const emitter = this.add.particles(startX, startY, 'water', {
                speedX: (direction * 300 * effectScale),
                scale: { start: 0.5 * effectScale, end: 0 },
                lifespan: 600,
                blendMode: 'ADD',
                tint: color,
                quantity: Math.ceil(10 * effectScale),
                emitting: false
            });
            emitter.explode(Math.ceil(10 * effectScale), startX, startY);

            // 衝撃波本体（範囲に応じてサイズ調整）
            let projectile;
            if (skillId === 'holy_arrow') {
                projectile = this.add.rectangle(startX, startY, 40 * effectScale, 4 * effectScale, color, 1);
            } else {
                projectile = this.add.arc(startX, startY, 30 * effectScale, -30, 30, false, color, 0.8);
            }

            projectile.setAngle(direction === 1 ? 0 : 180);
            this.tweens.add({
                targets: projectile,
                x: startX + (direction * actualRange),
                scale: 1.5,
                alpha: 0,
                duration: 500,
                onComplete: () => projectile.destroy()
            });
        }
        else {
            // 汎用エフェクト
            createBurst(skill.color || 0xffffff, 15, 100);
        }
    }

    showHitEffect(x, y, color) {
        const flash = this.add.star(x, y, 5, 5, 15, color, 1);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            rotation: 1,
            duration: 200,
            onComplete: () => flash.destroy()
        });
    }

    applyBuffVisual(target, buffType, buffValue, duration) {
        // バフアイコンの定義
        const buffIcons = {
            'attack_buff': { emoji: '⚔️', color: 0xff4444, name: '攻撃力UP' },
            'defense_buff': { emoji: '🛡️', color: 0x4444ff, name: '防御力UP' },
            'speed_buff': { emoji: '💨', color: 0x44ff44, name: '速度UP' },
            'summon_power_up': { emoji: '🐲', color: 0xff44ff, name: '召喚強化' }
        };

        const buffInfo = buffIcons[buffType];
        if (!buffInfo) return;

        // バフアイコンを表示（プレイヤーの上）
        const buffIcon = this.add.container(target.x, target.y - 60);

        // 背景円
        const bg = this.add.circle(0, 0, 18, buffInfo.color, 0.8);
        const bgStroke = this.add.circle(0, 0, 18, 0xffffff, 0).setStrokeStyle(2, 0xffffff, 1);

        // アイコン
        const icon = this.add.text(0, 0, buffInfo.emoji, {
            fontSize: '20px'
        }).setOrigin(0.5);

        buffIcon.add([bg, bgStroke, icon]);
        buffIcon.setDepth(1000);

        // バフアイコンをプレイヤーに追従させる
        if (!target.buffIcons) target.buffIcons = [];
        target.buffIcons.push({ container: buffIcon, type: buffType });

        // アイコンの位置を更新するループ
        const updateIconPosition = () => {
            if (buffIcon.active && target.active) {
                const index = target.buffIcons.findIndex(b => b.container === buffIcon);
                buffIcon.setPosition(target.x + (index * 25) - 12, target.y - 60);
            }
        };

        this.events.on('update', updateIconPosition);

        // 出現アニメーション
        buffIcon.setScale(0);
        this.tweens.add({
            targets: buffIcon,
            scale: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });

        // パルスアニメーション
        this.tweens.add({
            targets: bg,
            scale: { from: 1, to: 1.2 },
            alpha: { from: 0.8, to: 0.5 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // エフェクト（光の粒子）
        const particles = this.add.particles(target.x, target.y - 40, 'water', {
            speed: { min: 20, max: 40 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 1000,
            blendMode: 'ADD',
            tint: buffInfo.color,
            frequency: 100,
            quantity: 2
        });
        particles.setDepth(999);

        // 通知表示
        if (this.notificationUI) {
            this.notificationUI.show(`${buffInfo.name} +${buffValue}`, 'success');
        }

        // バフテキスト表示
        const buffText = this.add.text(target.x, target.y - 50, `${buffInfo.name}`, {
            fontSize: '12px',
            color: '#ffff00',
            fontFamily: '"Press Start 2P"',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);
        buffText.setDepth(1001);

        this.tweens.add({
            targets: buffText,
            y: target.y - 90,
            alpha: 0,
            duration: 1500,
            onComplete: () => buffText.destroy()
        });

        // 持続時間後に削除
        this.time.delayedCall(duration, () => {
            // アイコンリストから削除
            if (target.buffIcons) {
                const index = target.buffIcons.findIndex(b => b.container === buffIcon);
                if (index !== -1) target.buffIcons.splice(index, 1);
            }

            // フェードアウト
            this.tweens.add({
                targets: buffIcon,
                alpha: 0,
                scale: 0,
                duration: 300,
                onComplete: () => {
                    buffIcon.destroy();
                    this.events.off('update', updateIconPosition);
                }
            });

            particles.stop();
            this.time.delayedCall(2000, () => particles.destroy());
        });
    }

    spawnSummon(player, summonType = 'summon') {
        // 既存の召喚獣を削除
        if (this.activeSummon && this.activeSummon.active) {
            this.destroySummon(this.activeSummon);
        }

        // 召喚獣を生成
        const summonX = player.x + (player.flipX ? -50 : 50);
        const summonY = player.y;

        const skillLevel = player.stats.skillLevels?.[summonType] || 1;
        const summon = new SummonedBeast(this, summonX, summonY, player, summonType, skillLevel);
        this.activeSummon = summon;

        // 敵との接触判定を一括で設定（既存の敵＋将来スポーンする敵はOverlapで対応）
        // 既存の敵に対して設定
        const enemies = this.children.list.filter(child => child instanceof Enemy && child.active);
        enemies.forEach(enemy => {
            if (enemy.active) {
                this.physics.add.overlap(summon, enemy, () => {
                    const now = this.time.now;
                    if (!summon.lastHitTime || now - summon.lastHitTime > 1000) {
                        summon.takeDamage(enemy.atk);
                        if (summon) summon.lastHitTime = now;
                    }
                });
            }
        });

        // 召喚エフェクト
        this.applySkillEffect('summon', player);

        if (this.notificationUI) {
            this.notificationUI.show('召喚獣を呼び出した！', 'success');
        }

        // サーバーへ通知
        if (this.networkManager) {
            this.networkManager.sendSummonUpdate({
                type: 'spawn',
                isMega: summon.isMega,
                x: summon.x,
                y: summon.y
            });
        }
    }


    destroySummon(summon) {
        if (!summon || !summon.active) return;

        // クールダウン開始
        if (this.player && this.player.skillCooldowns) {
            const skillId = summon.isMega ? 'mega_summon' : 'summon';
            this.player.skillCooldowns[skillId] = Date.now();
        }

        // 消滅エフェクト
        const fadeCircle = this.add.circle(summon.x, summon.y, 20, 0x9370db, 0.5);
        this.tweens.add({
            targets: fadeCircle,
            scale: 2,
            alpha: 0,
            duration: 500,
            onComplete: () => fadeCircle.destroy()
        });

        if (summon.hpBar) summon.hpBar.destroy();
        if (summon.hpBarBg) summon.hpBarBg.destroy();
        if (summon.preDestroy) summon.preDestroy();
        summon.destroy();

        if (this.activeSummon === summon) {
            this.activeSummon = null;
            // サーバーへ通知
            if (this.networkManager) {
                this.networkManager.sendSummonUpdate({ type: 'despawn' });
            }
        }
    }

    handleSummonUpdate(data) {
        if (data.id === this.networkManager.getPlayerId()) return; // 自分のは無視

        if (data.type === 'spawn') {
            const owner = this.networkManager.getOtherPlayers()[data.id];
            if (owner) {
                // 既に存在していたら作り直す?
                if (this.otherSummons[data.id]) {
                    this.otherSummons[data.id].destroy();
                }
                const summon = new SummonedBeast(this, data.x, data.y, owner, data.isMega);
                this.otherSummons[data.id] = summon;
            }
        } else if (data.type === 'move') {
            const summon = this.otherSummons[data.id];
            if (summon && summon.active) {
                // 補間とか入れたほうがいいが、とりあえず直接セット
                // summon.setPosition(data.x, data.y);
                // あるいは移動用ロジック
                this.physics.moveTo(summon, data.x, data.y, 200); // 簡易移動

                // 距離が近ければ強制セット
                if (Phaser.Math.Distance.Between(summon.x, summon.y, data.x, data.y) < 10) {
                    summon.body.reset(data.x, data.y);
                }
            }
        } else if (data.type === 'despawn') {
            const summon = this.otherSummons[data.id];
            if (summon) {
                summon.destroy();
                delete this.otherSummons[data.id];
            }
        }
    }

    shutdown() {
        // マップ変更時は他のプレイヤーをクリアしない
        // NetworkManagerはレジストリで管理されているため、シーン間で共有される
        // if (this.networkManager) this.networkManager.clearAllOtherPlayers();
    }
}
