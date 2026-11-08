/**
 * @param {Phaser.Scene} scene
 * @returns {boolean} true while any full-screen window (inventory, shop, ...) is open
 */
export function isAnyWindowOpen(scene) {
    return !!(
        scene.quantityDialog?.isOpen ||
        scene.inventoryUI?.isOpen ||
        scene.equipmentUI?.isOpen ||
        scene.shopUI?.isOpen ||
        scene.skillManagerUI?.isOpen ||
        scene.statAllocationUI?.isOpen ||
        scene.guildQuestBoardUI?.isOpen ||
        scene.blacksmithUI?.isOpen ||
        scene.questLogUI?.isOpen ||
        scene.gachaUI?.isOpen ||
        scene.partyUI?.isOpen ||
        scene.chatUI?.isOpen ||
        scene.reincarnationUI?.isOpen ||
        scene.achievementUI?.isOpen ||
        scene.jobSkillPreviewUI?.isOpen ||
        scene.keyGuideWindowUI?.isOpen ||
        scene.tradeUI?.isOpen ||
        scene.craftingUI?.isOpen ||
        scene.friendWarpDialogUI?.isOpen ||
        scene.sideMenuUI?.isExpanded ||
        (scene.settingsUI && scene.settingsUI.visible)
    );
}
