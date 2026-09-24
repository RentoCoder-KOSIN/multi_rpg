// Wiring for entities that are created from network events (other players, server-managed enemies).
import Enemy from '../entities/Enemy.js';

const PLAYER_CONTACT_COOLDOWN_MS = 2000;
const SUMMON_CONTACT_COOLDOWN_MS = 1000;

/**
 * Prepare a remote player that NetworkManager already created: colliders + click-to-invite.
 * @returns the remote player sprite, or null if it is unknown
 */
export function addOtherPlayer(scene, id, x, y) {
    const otherPlayers = scene.networkManager.getOtherPlayers();
    const other = otherPlayers[id];

    if (!other) {
        console.warn(`[BaseGameScene] Player ${id} not found in NetworkManager`);
        return null;
    }

    // Guard against registering colliders twice
    if (!other._collidersSet) {
        if (scene.collidableLayers) {
            scene.collidableLayers.forEach(layer => scene.physics.add.collider(other, layer));
        }
        if (scene.npcs) {
            scene.npcs.forEach(npc => scene.physics.add.collider(other, npc));
        }

        // Click to invite to party
        other.setInteractive({ useHandCursor: true });
        other.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();

            const inParty = scene.networkManager.partyData?.members.some(m => m.id === id);
            if (inParty) {
                if (scene.notificationUI) scene.notificationUI.show('既にパーティーメンバーです', 'info');
                return;
            }

            const playerName = scene.registry.get('playerNames')?.[id] || `Player ${id.substring(0, 6)}`;
            const accept = confirm(`${playerName} をパーティーに招待しますか？`);
            if (accept) {
                scene.networkManager.inviteToParty(id);
                if (scene.notificationUI) scene.notificationUI.show(`${playerName} を招待しました`, 'success');
            }
        });

        other._collidersSet = true;
    }

    return other;
}

/**
 * Create an Enemy from server data and wire up its collisions and contact damage.
 * NetworkManager has already checked that the enemy does not exist yet.
 */
export function spawnEnemyFromServer(scene, data) {
    const textureKey = data.type || 'slime';
    const enemy = new Enemy(scene, data.x, data.y, textureKey, data.type, data.id, data.spawnId, scene.networkManager.getSocket(), data);

    if (scene.collidableLayers) scene.collidableLayers.forEach(layer => scene.physics.add.collider(enemy, layer));

    // Contact damage to the local player, with a global hit cooldown
    // (gives strong enemies a grace period so a boss cannot one-shot on touch)
    if (scene.player) {
        scene.physics.add.overlap(scene.player, enemy, () => {
            const now = scene.time.now;

            if (scene.player.active && enemy.active) {
                if (!scene.player.lastHitTime || now - scene.player.lastHitTime > PLAYER_CONTACT_COOLDOWN_MS) {
                    scene.player.takeDamage(enemy.atk);
                    if (scene.player) scene.player.lastHitTime = now;
                }
            }
        });
    }

    Object.values(scene.networkManager.getOtherPlayers()).forEach(op => {
        if (op && op.active) scene.physics.add.overlap(op, enemy);
    });

    // Contact damage to our summon
    if (scene.activeSummon && scene.activeSummon.active) {
        scene.physics.add.overlap(scene.activeSummon, enemy, () => {
            const now = scene.time.now;
            if (!scene.activeSummon.lastHitTime || now - scene.activeSummon.lastHitTime > SUMMON_CONTACT_COOLDOWN_MS) {
                scene.activeSummon.takeDamage(enemy.atk);
                scene.activeSummon.lastHitTime = now;
            }
        });
    }

    return enemy;
}
