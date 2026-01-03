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

            // 敵を倒したのが自分自身の場合、報酬を付与
            if (enemyData.killedBy === this.networkManager.getSocketId()) {
                console.log(`You killed the enemy! (${enemyData.type})`);
                if (this.player && this.player.active) {
                    const exp = enemyData.exp || 0;
                    const gold = enemyData.gold || 0;
                    this.player.gainExp(exp);
                    this.player.gainGold(gold);
                }
            }
        });

        this.otherSummons = {};
        this.networkManager.setCallback('onSummonUpdate', (data) => {
            this.handleSummonUpdate(data);
        });

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
                    enemy.lastHitTime = now;

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
                        this.player.lastHitTime = now;
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

        // キューイングされたプレイヤーを定期的にチェック
        if (this.networkManager) {
            this.networkManager.checkPendingPlayers();
        }
        // キー入力
        if (this.inventoryUI && Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I))) {
            this.inventoryUI.toggle();
        }
        this.networkManager.updateRemotePlayers();
        this.networkManager.updateEnemies();

        updateNPCInteraction(this, { player: this.player, npcs: this.npcs, dialogue: this.dialogue, interactKey: this.interactKey, interactText: this.interactText, interactBg: this.interactBg });
        if (this.playerNameUI) this.playerNameUI.updatePosition();
        if (this.playerStatsUI) this.playerStatsUI.update();
        if (this.skillBarUI) this.skillBarUI.update();

        const otherPlayers = this.networkManager.getOtherPlayers();
        const playerNames = this.registry.get('playerNames') || {};
        Object.keys(otherPlayers).forEach(id => {
            const op = otherPlayers[id];
            if (op && op.active) {
                const playerName = playerNames[id] || `Player ${id.substring(0, 6)}`;
                if (!op.nameUI) op.nameUI = new PlayerNameUI(this, op, playerName);
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

            // 位置同期 (頻度を制限すべきだが、一旦毎フレームチェック)
            // 実際には NetworkManager や Player 側で頻度制御しているのと同様にすべき
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
        const cdTime = skill.cd || 2000;

        if (now - lastUse < cdTime) {
            if (this.notificationUI) this.notificationUI.show('クールダウン中...', 'error');
            return;
        }

        if (player.stats.mp < (skill.mpCost || 0)) {
            if (this.notificationUI) this.notificationUI.show('MPが足りません！', 'error');
            return;
        }

        if (skillId === 'summon' || skillId === 'mega_summon' || skillId === 'demon_lord_summon') {
            if (this.activeSummon && this.activeSummon.active) {
                if (this.notificationUI) this.notificationUI.show('召喚獣は既に存在します', 'error');
                return;
            }
        }

        player.stats.mp -= (skill.mpCost || 0);

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
        const skillLevel = player.stats.skillLevels?.[skillId] || 1;
        const damageBonus = 1 + (skillLevel - 1) * 0.15; // 1レベルごとに15%ダメージ増
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

        if (this.notificationUI) {
            this.notificationUI.show(`${skill.name}！`, 'warning');
        }
    }

    applySkillEffect(skillId, source) {
        const skill = SKILLS[skillId];
        const color = skill.color || 0x00ffff;

        if (skillId === 'slash') {
            const arc = this.add.arc(source.x, source.y, 60, 0, 180, false, color, 0.6);
            arc.setAngle(source.flipX ? 0 : 180);
            this.tweens.add({
                targets: arc,
                alpha: 0,
                scale: 1.2,
                duration: 200,
                onComplete: () => arc.destroy()
            });
        } else if (skillId === 'fireball') {
            for (let i = 0; i < 8; i++) {
                const particle = this.add.circle(source.x, source.y, 5, color, 1);
                const angle = (i / 8) * Math.PI * 2;
                this.tweens.add({
                    targets: particle,
                    x: source.x + Math.cos(angle) * 100,
                    y: source.y + Math.sin(angle) * 100,
                    alpha: 0,
                    scale: 2,
                    duration: 400,
                    onComplete: () => particle.destroy()
                });
            }

        } else if (skillId === 'whirlwind') {
            const circle = this.add.circle(source.x, source.y, 20, color, 0.4);
            circle.setStrokeStyle(4, color);
            this.tweens.add({
                targets: circle,
                radius: skill.range || 120,
                alpha: 0,
                duration: 300,
                onComplete: () => circle.destroy()
            });
            // 粒子回転エフェクト
            for (let i = 0; i < 12; i++) {
                const p = this.add.circle(source.x, source.y, 3, color, 0.8);
                const angle = (i / 12) * Math.PI * 2;
                this.tweens.add({
                    targets: p,
                    x: source.x + Math.cos(angle) * (skill.range || 120),
                    y: source.y + Math.sin(angle) * (skill.range || 120),
                    alpha: 0,
                    duration: 300,
                    onComplete: () => p.destroy()
                });
            }
        } else if (skillId === 'sonic_wave') {
            const dir = source.flipX ? -1 : 1;
            const wave = this.add.rectangle(source.x, source.y - 20, 20, 60, color, 0.6);
            this.tweens.add({
                targets: wave,
                x: source.x + (skill.range || 200) * dir,
                alpha: 0,
                scaleY: 1.5,
                duration: 400,
                onComplete: () => wave.destroy()
            });
        } else if (skillId === 'ice_needle') {
            const dir = source.flipX ? -1 : 1;
            for (let i = -2; i <= 2; i++) {
                const needle = this.add.rectangle(source.x, source.y - 20, 30, 4, color, 0.8);
                const angle = (i * 0.2);
                this.tweens.add({
                    targets: needle,
                    x: source.x + Math.cos(angle) * (skill.range || 180) * dir,
                    y: (source.y - 20) + Math.sin(angle) * (skill.range || 180) * (dir > 0 ? 1 : -1),
                    rotation: angle * (dir > 0 ? 1 : -1),
                    alpha: 0,
                    duration: 500,
                    onComplete: () => needle.destroy()
                });
            }
        } else if (skillId === 'thunder_storm' || skillId === 'meteor_swarm') {
            for (let i = 0; i < 5; i++) {
                this.time.delayedCall(i * 200, () => {
                    const rx = source.x + (Math.random() - 0.5) * (skill.range || 200) * 2;
                    const ry = (source.y - 20) + (Math.random() - 0.5) * (skill.range || 200) * 2;
                    const bolt = this.add.rectangle(rx, ry - 100, 10, 200, color, 0.8);
                    this.cameras.main.shake(100, 0.005);
                    this.tweens.add({
                        targets: bolt,
                        alpha: 0,
                        scaleX: 0,
                        duration: 300,
                        onComplete: () => bolt.destroy()
                    });
                    // 着弾点エフェクト
                    const hit = this.add.circle(rx, ry, 30, color, 0.5);
                    this.tweens.add({ targets: hit, scale: 2, alpha: 0, duration: 400, onComplete: () => hit.destroy() });
                });
            }
        } else if (skillId === 'dark_nova') {
            const nova = this.add.circle(source.x, source.y - 20, 10, color, 0.9);
            this.tweens.add({
                targets: nova,
                radius: skill.range || 180,
                alpha: 0,
                duration: 600,
                ease: 'Cubic.out',
                onComplete: () => nova.destroy()
            });
            // 吸い込み演出
            const particles = this.add.graphics();
            particles.lineStyle(2, color, 0.5);
            for (let i = 0; i < 20; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = (skill.range || 180);
                const x = source.x + Math.cos(angle) * r;
                const y = (source.y - 20) + Math.sin(angle) * r;
                this.tweens.add({
                    targets: { val: r },
                    val: 0,
                    duration: 400,
                    onUpdate: (tween) => {
                        particles.clear();
                        particles.lineStyle(2, color, 0.5);
                        const curR = tween.getValue();
                        particles.strokeCircle(source.x, source.y - 20, curR);
                    },
                    onComplete: () => particles.destroy()
                });
            }
        } else {
            const circle = this.add.circle(source.x, source.y, 30, color, 0.4);
            circle.setStrokeStyle(2, color);
            this.tweens.add({
                targets: circle,
                scale: 1.5,
                alpha: 0,
                duration: 500,
                onComplete: () => circle.destroy()
            });
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

    spawnSummon(player, summonType = 'summon') {
        // 既存の召喚獣を削除
        if (this.activeSummon && this.activeSummon.active) {
            this.destroySummon(this.activeSummon);
        }

        // 召喚獣を生成
        const summonX = player.x + (player.flipX ? -50 : 50);
        const summonY = player.y;

        const summon = new SummonedBeast(this, summonX, summonY, player, summonType);
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
                        summon.lastHitTime = now;
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
                isMega: isMega,
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
