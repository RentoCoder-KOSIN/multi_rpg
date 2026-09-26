// Keyboard / pointer setup for game scenes.
import { isAnyWindowOpen } from '../../utils/uiState.js';
import { TOTAL_SKILL_SLOTS } from '../../gameConstants.js';

/**
 * Create the gameplay keys polled in update().
 */
export function createGameKeys(scene, config) {
    const KeyCodes = Phaser.Input.Keyboard.KeyCodes;
    scene.interactKey = scene.input.keyboard.addKey(KeyCodes.C);
    // スキルスロット数ぶんキー1〜8を割り当てる（TOTAL_SKILL_SLOTSに連動）
    const numberKeyCodes = [
        KeyCodes.ONE, KeyCodes.TWO, KeyCodes.THREE, KeyCodes.FOUR,
        KeyCodes.FIVE, KeyCodes.SIX, KeyCodes.SEVEN, KeyCodes.EIGHT
    ];
    scene.skillKeys = numberKeyCodes
        .slice(0, TOTAL_SKILL_SLOTS)
        .map(code => scene.input.keyboard.addKey(code));
    scene.partyKey = scene.input.keyboard.addKey(KeyCodes.V);
    if (config.showDebugKey) scene.debugKey = scene.input.keyboard.addKey(KeyCodes.D);
}

/**
 * Register event-driven input: attack key, window shortcuts, AI toggle, tap-to-move.
 * Call after the UI windows exist.
 */
export function registerInputHandlers(scene) {
    scene.attackKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // O: settings, M: side menu, K: skill manager
    scene.input.keyboard.on('keydown-O', () => {
        if (scene.settingsUI) scene.settingsUI.toggle();
    });
    scene.input.keyboard.on('keydown-M', () => {
        if (scene.sideMenuUI) scene.sideMenuUI.toggle();
    });
    scene.input.keyboard.on('keydown-K', () => {
        if (!scene.shopUI.isOpen && !scene.inventoryUI.isOpen && !scene.equipmentUI.isOpen && !scene.statAllocationUI.isOpen) {
            scene.skillManagerUI.toggle();
        }
    });

    // ESC closes one open window (topmost in this order)
    scene.escKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    scene.escKey.on('down', () => closeTopWindow(scene));

    // Shift+T toggles AI training for all enemies
    scene.input.keyboard.on('keydown', (event) => {
        if (event.key.toLowerCase() === 't' && event.shiftKey) {
            toggleAITraining(scene);
        }
    });

    // Tap / click to move (mobile only)
    scene.input.on('pointerdown', (pointer, currentlyOver) => {
        if (pointer.x < 100) return;                                    // menu button area
        if (currentlyOver && currentlyOver.length > 0) return;          // clicked on UI
        if (scene.dialogue && scene.dialogue.isTalking) return;         // no moving while talking
        if (isAnyWindowOpen(scene)) return;                             // no moving while a window is open

        if (scene.isMobile && scene.player && scene.player.active) {
            const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
            scene.player.moveTo(worldPoint.x, worldPoint.y);
        }
    });
}

function closeTopWindow(scene) {
    if (scene.shopUI && scene.shopUI.isOpen) {
        scene.shopUI.close();
    } else if (scene.inventoryUI && scene.inventoryUI.isOpen) {
        scene.inventoryUI.toggle();
    } else if (scene.equipmentUI && scene.equipmentUI.isOpen) {
        scene.equipmentUI.toggle();
    } else if (scene.statAllocationUI && scene.statAllocationUI.isOpen) {
        scene.statAllocationUI.toggle();
    } else if (scene.skillManagerUI && scene.skillManagerUI.isOpen) {
        scene.skillManagerUI.toggle();
    } else if (scene.settingsUI && scene.settingsUI.visible) { // SettingsUI exposes `visible`, not `isOpen`
        scene.settingsUI.toggle();
    }
}

function toggleAITraining(scene) {
    scene.aiTrainingEnabled = !scene.aiTrainingEnabled;
    const mode = scene.aiTrainingEnabled ? 'ON' : 'OFF';

    const enemies = scene.networkManager?.getEnemies() || {};
    Object.values(enemies).forEach(enemy => {
        if (enemy.ai && enemy.active) {
            enemy.ai.setTrainingMode(scene.aiTrainingEnabled);
        }
    });

    if (scene.notificationUI) {
        scene.notificationUI.show(`AI Training: ${mode}`, 'info');
    }
    console.log(`[BaseGameScene] AI Training mode: ${mode}`);
}
