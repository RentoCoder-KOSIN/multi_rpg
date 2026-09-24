// BaseGameScene.js
// Shared parent of every playable map scene. It only orchestrates:
// the actual logic lives in scenes/base/* (setup) and systems/* (gameplay).
import Player from '../entities/Player.js';
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
import { updateEnemyDebugUI } from '../utils/enemyDebug.js';
import { isAnyWindowOpen } from '../utils/uiState.js';
import { createPlayerAnimations } from '../animations/playerAnimations.js';
import ShopUI from '../ui/ShopUI.js';
import InventoryUI from '../ui/InventoryUI.js';
import PartyUI from '../ui/PartyUI.js';
import PartyHUDUI from '../ui/PartyHUDUI.js';
import PlayerNameUI from '../ui/PlayerNameUI.js';

import { preloadCommonAssets } from './base/assets.js';
import { registerNetworkCallbacks } from './base/networkCallbacks.js';
import { createGameKeys, registerInputHandlers } from './base/input.js';
import { createGameUI, setupEnemyDebug } from './base/ui.js';
import {
    updateEnemyContactDamage,
    regenerateMp,
    updateRemotePlayerNameTags,
    updateActiveSummon
} from './base/frameUpdate.js';

import { performBasicAttack, usePlayerSkill } from '../systems/combat.js';
import { showHitEffect } from '../systems/skillEffects.js';
import { destroySummon } from '../systems/summons.js';
import { addOtherPlayer, spawnEnemyFromServer } from '../systems/entitySetup.js';

export default class BaseGameScene extends Phaser.Scene {
    constructor(sceneKey) {
        super(sceneKey);
    }

    getSceneConfig() {
        throw new Error('getSceneConfig() must be implemented by subclass');
    }

    preload() {
        preloadCommonAssets(this, this.getSceneConfig());
    }

    create(data) {
        this._isTeleporting = false;
        this.events.on('wake', () => {
            this._isTeleporting = false;
        });
        const config = this.getSceneConfig();

        // --- QuestManager (shared across scenes through the registry) ---
        this.questManager = this.registry.get('questManager') || new QuestManager(this);
        this.questManager.setScene(this); // always point at the current scene
        this.registry.set('questManager', this.questManager);
        console.log('[BaseGameScene] QuestManager synchronized with scene');

        // --- Map ---
        this.map = this.make.tilemap({ key: config.mapKey });
        const tileset = this.map.addTilesetImage('tiles', 'tiles');
        this.map.addTilesetImage('water', 'water');
        const { collidableLayers } = setupTilemap(this, this.map, tileset);
        this.collidableLayers = collidableLayers;

        // --- Player ---
        const { x, y } = resolvePlayerSpawn(this.map, data);
        this.shopUI = new ShopUI(this);
        this.inventoryUI = new InventoryUI(this);
        this.shopUI.createUI();
        this.inventoryUI.createUI();
        this.player = new Player(this, x, y, true, null);
        console.log('Player spawn:', x, y);
        createPlayerAnimations(this);
        this.cursors = this.input.keyboard.createCursorKeys();

        this.playBgm();

        // --- NetworkManager (reused across scenes through the registry) ---
        this.networkManager = this.registry.get('networkManager');
        if (!this.networkManager) {
            this.networkManager = new NetworkManager(this);
            this.registry.set('networkManager', this.networkManager);
        } else {
            this.networkManager.scene = this;
        }

        this.currentMapKey = data?.mapKey || config.mapKey;
        this.otherSummons = {};

        this.partyUI = new PartyUI(this);
        this.partyUI.createUI();
        this.partyHUD = new PartyHUDUI(this);

        registerNetworkCallbacks(this);

        this.networkManager.connect(this.currentMapKey, () => {
            this.socket = this.networkManager.getSocket();
            this.player.socket = this.socket;
            // The newPlayer event is sent inside NetworkManager.connect()
            console.log('[BaseGameScene] Connected, socket set to player');
        });

        // --- NPC ---
        this.npcs = createNPCsFromMap(this, this.map);
        this.npcs.forEach(npc => {
            if (npc.questId && this.questManager.isFinished(npc.questId)) {
                npc.is_Complited = true; // quest already reported
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
        this.teleports.forEach(tp => {
            if (tp.requiredQuest && (this.questManager.isFinished(tp.requiredQuest) || this.questManager.isCompleted(tp.requiredQuest))) {
                tp.unlocked = true;
            }
        });

        // --- Camera ---
        setupCameraAndWorld(this, this.map, this.player);

        // --- UI and input ---
        this.dialogue = new DialogueManager(this);
        createGameKeys(this, config);
        createGameUI(this, config);
        registerInputHandlers(this);

        const playerNames = this.registry.get('playerNames') || {};
        const socket = this.networkManager.getSocket();
        const myPlayerName = (socket && playerNames[socket.id]) || 'You';
        this.playerNameUI = new PlayerNameUI(this, this.player, myPlayerName);

        setupEnemyDebug(this);

        // Process players queued during load once the scene is fully active (next frame)
        this.time.delayedCall(0, () => {
            if (this.networkManager) {
                this.networkManager.sceneReady();
            }
        });
    }

    // Start the BGM once; keep it running across scene changes
    playBgm() {
        if (!this.sound.get('bgm')) {
            this.sound.play('bgm', { loop: true, volume: 0.5 });
        } else if (!this.sound.get('bgm').isPlaying) {
            this.sound.get('bgm').play({ loop: true, volume: 0.5 });
        }
    }

    update(time, delta) {
        if (!this.player || !this.player.active) return;

        this.player.update(this.cursors);

        // Attack / skills are disabled while a window is open
        const windowOpen = isAnyWindowOpen(this);

        if (!windowOpen && this.attackKey && Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.performBasicAttack();
        }

        if (!windowOpen && this.skillKeys) {
            this.skillKeys.forEach((key, index) => {
                if (Phaser.Input.Keyboard.JustDown(key)) {
                    this.handleSkillUse(index);
                }
            });
        }

        if (Phaser.Input.Keyboard.JustDown(this.partyKey)) {
            this.partyUI.toggle();
        }

        this.networkManager.checkPendingPlayers();
        this.networkManager.updateRemotePlayers();
        this.networkManager.updateEnemies(time, delta);

        if (this.showEnemyDebug && this.enemyDebugText && this.enemyDebugText.visible) {
            updateEnemyDebugUI(this);
        }

        updateNPCInteraction(this, { player: this.player, npcs: this.npcs, dialogue: this.dialogue, interactKey: this.interactKey, interactText: this.interactText, interactBg: this.interactBg });
        if (this.playerNameUI) this.playerNameUI.updatePosition();
        if (this.playerStatsUI) this.playerStatsUI.update();
        if (this.minimapUI) this.minimapUI.update();

        updateEnemyContactDamage(this);

        this.player.updateBuffs();
        regenerateMp(this, time);
        if (this.skillBarUI) this.skillBarUI.update();

        updateRemotePlayerNameTags(this);

        this.npcs.forEach(npc => npc.updateQuestIcon(this.questManager));
        updateTeleports(this, this.player, this.npcs, this.teleports);

        updateActiveSummon(this);
    }

    // --- Entry points used by UI / entities / NetworkManager ---

    handleSkillUse(index) {
        if (!this.player || !this.player.active) return;
        const skillId = this.player.stats.activeSkills?.[index];
        if (skillId) {
            this.usePlayerSkill(skillId);
        }
    }

    performBasicAttack() { performBasicAttack(this); }
    usePlayerSkill(skillId) { usePlayerSkill(this, skillId); }
    showHitEffect(x, y, color) { showHitEffect(this, x, y, color); }
    destroySummon(summon) { destroySummon(this, summon); }
    addOtherPlayer(id, x, y) { return addOtherPlayer(this, id, x, y); }
    spawnEnemyFromServer(data) { return spawnEnemyFromServer(this, data); }

    // Talk to the nearest NPC (used by the virtual pad button)
    handleInteraction() {
        if (!this.player || !this.player.active) return;
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
            // Same quest-progress logic as interactionHelper.js
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

    shutdown() {
        // Do not clear other players on map change:
        // NetworkManager lives in the registry and is shared between scenes.
    }

    // Make the minimap camera skip the given game objects
    minimapCameraIgnore(elements) {
        if (!this.minimapUI || !this.minimapUI.minimapCamera) return;

        const camera = this.minimapUI.minimapCamera;
        if (Array.isArray(elements)) {
            elements.forEach(el => { if (el) camera.ignore(el); });
        } else if (elements) {
            camera.ignore(elements);
        }
    }
}
