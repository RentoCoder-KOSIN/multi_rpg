// Creates the HUD and windows of a game scene.
import QuestTrackerUI from '../../ui/QuestTrackerUI.js';
import MapNameUI from '../../ui/MapNameUI.js';
import NotificationUI from '../../ui/NotificationUI.js';
import PlayerStatsUI from '../../ui/PlayerStatsUI.js';
import SkillBarUI from '../../ui/SkillBarUI.js';
import EquipmentUI from '../../ui/EquipmentUI.js';
import StatAllocationUI from '../../ui/StatAllocationUI.js';
import SkillManagerUI from '../../ui/SkillManagerUI.js';
import SettingsUI from '../../ui/SettingsUI.js';
import SideMenuUI from '../../ui/SideMenuUI.js';
import VirtualPadUI from '../../ui/VirtualPadUI.js';
import AIStatsUI from '../../ui/AIStatsUI.js';
import MinimapUI from '../../ui/MinimapUI.js';
import { createEnemyDebugUI } from '../../utils/enemyDebug.js';

/**
 * Create the HUD and every window except Shop/Inventory/Party (created earlier in create()).
 */
export function createGameUI(scene, config) {
    // Use the real game size so positions are correct in Phaser.Scale.FIT mode
    const gameWidth = scene.scale.gameSize ? scene.scale.gameSize.width : scene.scale.width;
    const gameHeight = scene.scale.gameSize ? scene.scale.gameSize.height : scene.scale.height;

    scene.interactText = scene.add.text(
        gameWidth / 2,
        gameHeight - 120,
        '[C] 会話',
        { fontSize: '16px', color: '#ffff00', fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5).setScrollFactor(0).setVisible(false);

    scene.interactBg = scene.add.rectangle(
        gameWidth / 2,
        gameHeight - 120,
        150, 35, 0x000000, 0.7
    ).setOrigin(0.5).setScrollFactor(0).setVisible(false).setStrokeStyle(2, 0xffff00, 1);

    if (config.showQuestTracker) scene.questTrackerUI = new QuestTrackerUI(scene, scene.questManager);

    startTutorialQuest(scene);

    scene.mapNameUI = new MapNameUI(scene, scene.currentMapKey.toUpperCase());
    scene.notificationUI = new NotificationUI(scene);
    scene.playerStatsUI = new PlayerStatsUI(scene, scene.player);
    scene.skillBarUI = new SkillBarUI(scene, scene.player);
    scene.equipmentUI = new EquipmentUI(scene);
    scene.equipmentUI.createUI();
    scene.statAllocationUI = new StatAllocationUI(scene);
    scene.statAllocationUI.createUI();
    scene.skillManagerUI = new SkillManagerUI(scene);
    scene.skillManagerUI.createUI();
    scene.settingsUI = new SettingsUI(scene);
    scene.settingsUI.createUI();
    scene.sideMenuUI = new SideMenuUI(scene);
    scene.virtualPadUI = new VirtualPadUI(scene);
    scene.aiTrainingEnabled = true; // global reinforcement-learning switch
    scene.aiStatsUI = new AIStatsUI(scene);
    scene.minimapUI = new MinimapUI(scene);

    // The virtual pad is only for touch devices
    scene.isMobile = !scene.sys.game.device.os.desktop;
    if (!scene.isMobile) {
        if (scene.virtualPadUI && scene.virtualPadUI.container) scene.virtualPadUI.container.setVisible(false);
    }
}

// The tutorial map starts the job-selection quest automatically
function startTutorialQuest(scene) {
    const qm = scene.questManager;
    if (scene.currentMapKey === 'tutorial' &&
        !qm.isStarted('choose_job') &&
        !qm.isCompleted('choose_job') &&
        !qm.isFinished('choose_job')) {
        qm.startQuest('choose_job');
    }
}

/**
 * Enemy debug overlay, toggled with the D key.
 */
export function setupEnemyDebug(scene) {
    createEnemyDebugUI(scene);
    scene.showEnemyDebug = false;
    scene.input.keyboard.on('keydown-D', () => {
        scene.showEnemyDebug = !scene.showEnemyDebug;
        if (scene.enemyDebugText) {
            scene.enemyDebugText.setVisible(scene.showEnemyDebug);
        }
        console.log(`[BaseGameScene] Enemy debug: ${scene.showEnemyDebug ? 'ON' : 'OFF'}`);
    });
}
