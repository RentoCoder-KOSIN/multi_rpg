export function updateNPCInteraction(scene, {
    player,
    npcs,
    dialogue,
    interactKey,
    interactText,
    interactBg = null,
    distanceThreshold = 50
}) {
    let nearNPC = false;
    let targetNPC = null;

    for (const npc of npcs) {
        const distance = Phaser.Math.Distance.Between(
            npc.x, npc.y,
            player.x, player.y
        );

        if (distance < distanceThreshold) {
            nearNPC = true;
            targetNPC = npc;
            break;
        }
    }

    const shouldShow = nearNPC && !dialogue.isTalking;
    interactText.setVisible(shouldShow);
    if (interactBg) {
        interactBg.setVisible(shouldShow);
        
        // 点滅アニメーション
        if (shouldShow && !interactBg.tween) {
            interactBg.tween = scene.tweens.add({
                targets: interactBg,
                alpha: { from: 0.7, to: 1 },
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } else if (!shouldShow && interactBg.tween) {
            scene.tweens.remove(interactBg.tween);
            interactBg.tween = null;
        }
    }

    if (
        nearNPC &&
        Phaser.Input.Keyboard.JustDown(interactKey) &&
        targetNPC &&
        !dialogue.isTalking
    ) {
        dialogue.startDialogue(targetNPC);

        // 会話型クエストなら progress を増やして条件達成で completeQuest
        if (targetNPC.questId) {
            const quest = scene.questManager.quests[targetNPC.questId];
            if (quest && quest.type === 'talk' && quest.status === 'active') {
                quest.progress++;
                if (quest.progress >= quest.required) {
                    scene.questManager.completeQuest(targetNPC.questId);
                }
            }
        }
    }
}
