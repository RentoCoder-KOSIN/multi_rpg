/**
 * @param {Phaser.Scene} scene
 * @returns {boolean} true while any full-screen window (inventory, shop, ...) is open
 */
export function isAnyWindowOpen(scene) {
    return !!(
        scene.inventoryUI?.isOpen ||
        scene.shopUI?.isOpen ||
        scene.skillManagerUI?.isOpen ||
        scene.statAllocationUI?.isOpen ||
        (scene.settingsUI && scene.settingsUI.visible)
    );
}
