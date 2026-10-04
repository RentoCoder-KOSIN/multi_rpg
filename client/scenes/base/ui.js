// Creates the HUD and windows of a game scene.
import QuestTrackerUI from '../../ui/QuestTrackerUI.js';
import QuestLogUI from '../../ui/QuestLogUI.js';
import MapNameUI from '../../ui/MapNameUI.js';
import NotificationUI from '../../ui/NotificationUI.js';
import PlayerStatsUI from '../../ui/PlayerStatsUI.js';
import SkillBarUI from '../../ui/SkillBarUI.js';
import EquipmentUI from '../../ui/EquipmentUI.js';
import BlacksmithUI from '../../ui/BlacksmithUI.js';
import StatAllocationUI from '../../ui/StatAllocationUI.js';
import SkillManagerUI from '../../ui/SkillManagerUI.js';
import SettingsUI from '../../ui/SettingsUI.js';
import SideMenuUI from '../../ui/SideMenuUI.js';
import VirtualPadUI from '../../ui/VirtualPadUI.js';
import AIStatsUI from '../../ui/AIStatsUI.js';
import MinimapUI from '../../ui/MinimapUI.js';
import ReincarnationUI from '../../ui/ReincarnationUI.js';
import ObjectiveIndicatorUI from '../../ui/ObjectiveIndicatorUI.js';
import TutorialGuideUI from '../../ui/TutorialGuideUI.js';
import GachaUI from '../../ui/GachaUI.js';
import { bindAdminScene } from '../../ui/AdminUI.js';
import { getUILayout } from '../../ui/UILayoutManager.js';
import { createEnemyDebugUI } from '../../utils/enemyDebug.js';

/**
 * Create the HUD and every window except Shop/Inventory/Party (created earlier in create()).
 */
export function createGameUI(scene, config) {
    // "[C] talk" prompt. Its position is managed by UILayoutManager ('interactPrompt').
    scene.interactText = scene.add.text(
        0, 0,
        '[C] 会話',
        { fontSize: '16px', color: '#ffff00', fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 3 }
    ).setOrigin(0.5).setScrollFactor(0).setVisible(false);

    scene.interactBg = scene.add.rectangle(
        0, 0,
        150, 35, 0x000000, 0.7
    ).setOrigin(0.5).setScrollFactor(0).setVisible(false).setStrokeStyle(2, 0xffff00, 1);

    getUILayout(scene).register('interactPrompt', [scene.interactText, scene.interactBg]);

    if (config.showQuestTracker) scene.questTrackerUI = new QuestTrackerUI(scene, scene.questManager);

    // クエスト専用ウィンドウ（サイドメニュー/Qキーで開く）
    scene.questLogUI = new QuestLogUI(scene, scene.questManager);
    scene.questLogUI.createUI();

    startTutorialQuest(scene);

    // adminモード（Shift+@）が今のシーンのプレイヤーを操作できるように登録する
    bindAdminScene(scene);

    scene.mapNameUI = new MapNameUI(scene, scene.currentMapKey.toUpperCase());
    scene.notificationUI = new NotificationUI(scene);
    scene.playerStatsUI = new PlayerStatsUI(scene, scene.player);
    scene.skillBarUI = new SkillBarUI(scene, scene.player);
    scene.equipmentUI = new EquipmentUI(scene);
    scene.equipmentUI.createUI();
    scene.blacksmithUI = new BlacksmithUI(scene);
    scene.blacksmithUI.createUI();
    scene.statAllocationUI = new StatAllocationUI(scene);
    scene.statAllocationUI.createUI();
    scene.skillManagerUI = new SkillManagerUI(scene);
    scene.skillManagerUI.createUI();
    scene.gachaUI = new GachaUI(scene);
    scene.gachaUI.createUI();
    scene.settingsUI = new SettingsUI(scene);
    scene.settingsUI.createUI();
    scene.sideMenuUI = new SideMenuUI(scene);
    scene.virtualPadUI = new VirtualPadUI(scene);
    scene.aiTrainingEnabled = true; // global reinforcement-learning switch
    scene.aiStatsUI = new AIStatsUI(scene);
    scene.minimapUI = new MinimapUI(scene);
    scene.reincarnationUI = new ReincarnationUI(scene);
    scene.reincarnationUI.createUI();
    // 「次に何をすればいいか/どこに行けばいいか」を常時示すインジケーター（レベル不問）
    scene.objectiveIndicatorUI = new ObjectiveIndicatorUI(scene);
    // 初心者が各キー／画面の役割をその場で確認できるよう、チュートリアル中だけ表示する。
    if (scene.currentMapKey === 'tutorial') scene.tutorialGuideUI = new TutorialGuideUI(scene);

    // The virtual pad is only for touch devices
    scene.isMobile = !scene.sys.game.device.os.desktop;
    if (!scene.isMobile) {
        if (scene.virtualPadUI && scene.virtualPadUI.container) scene.virtualPadUI.container.setVisible(false);
    }
}

// The tutorial map starts the job-selection quest automatically
function startTutorialQuest(scene) {
    const qm = scene.questManager;
    // 報酬追加前に職業を選んでいたセーブデータも、チュートリアルに入った時点で救済する。
    // フラグはPlayerの保存データに入るため、再入場や職業選び直しで重複しない。
    if (scene.currentMapKey === 'tutorial' &&
        scene.player?.stats?.job !== 'none' &&
        !scene.player.stats.tutorialStarterRewardClaimed) {
        scene.player.stats.jobExp += 300;
        scene.player.stats.statPoints += 5;
        scene.player.addItem('fire_orb');
        scene.player.stats.tutorialStarterRewardClaimed = true;
        scene.player.saveStats();
        scene.notificationUI?.show('チュートリアル報酬: Job EXP 300 / SP 5 / 火の玉', 'success', 5000);
    }
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
