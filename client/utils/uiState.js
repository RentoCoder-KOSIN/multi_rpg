/**
 * @param {Phaser.Scene} scene
 * @returns {boolean} true while any full-screen window (inventory, shop, ...) is open
 */
export function isAnyWindowOpen(scene) {
    return !!(
        scene.quantityDialog?.isOpen ||
        scene.inventoryUI?.isOpen ||
        scene.shopUI?.isOpen ||
        scene.skillManagerUI?.isOpen ||
        scene.statAllocationUI?.isOpen ||
        scene.guildQuestBoardUI?.isOpen ||
        scene.blacksmithUI?.isOpen ||
        scene.questLogUI?.isOpen ||
        (scene.settingsUI && scene.settingsUI.visible)
    );
}
