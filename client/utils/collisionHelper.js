export function setupMapCollisions(scene, { player, npcs = [], collidableLayers = [], otherPlayers = {} }) {
    // Player vs Map
    if (player) {
        collidableLayers.forEach(layer => {
            scene.physics.add.collider(player, layer);
        });
    }

    // NPCs vs Map
    npcs.forEach(npc => {
        collidableLayers.forEach(layer => {
            scene.physics.add.collider(npc, layer);
        });
    });

    // Player vs NPC
    if (player) {
        npcs.forEach(npc => {
            scene.physics.add.collider(player, npc);
        });
    }

    // Player vs Other Players (軽い衝突、押し返しなし)
    if (player) {
        Object.values(otherPlayers).forEach(otherPlayer => {
            if (otherPlayer && otherPlayer.active) {
                // 重複を避けるため、軽いオーバーラップのみ
                scene.physics.add.overlap(player, otherPlayer, () => {
                    // 必要に応じて処理を追加
                });
            }
        });
    }

    // Other Players vs Map
    Object.values(otherPlayers).forEach(otherPlayer => {
        if (otherPlayer && otherPlayer.active) {
            collidableLayers.forEach(layer => {
                scene.physics.add.collider(otherPlayer, layer);
            });
        }
    });
}
