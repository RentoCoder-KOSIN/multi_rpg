// Server-event handlers for game scenes. Registered once per scene in create().
import { SKILLS } from '../../data/skills.js';
import { addOtherPlayer, spawnEnemyFromServer } from '../../systems/entitySetup.js';
import { applySkillEffect, showHitEffect } from '../../systems/skillEffects.js';
import { handleSummonUpdate } from '../../systems/summons.js';

/**
 * Register every NetworkManager callback the game scene reacts to.
 * @param {Phaser.Scene} scene
 */
export function registerNetworkCallbacks(scene) {
    const net = scene.networkManager;

    net.setCallback('onPlayerAdded', (id, px, py) => addOtherPlayer(scene, id, px, py));
    net.setCallback('onEnemySpawned', (enemyData) => spawnEnemyFromServer(scene, enemyData));
    net.setCallback('onEnemyKilled', (enemyData) => handleEnemyKilled(scene, enemyData));
    net.setCallback('onSummonUpdate', (data) => handleSummonUpdate(scene, data));

    net.setCallback('onPartyUpdate', (data) => {
        if (scene.partyUI) scene.partyUI.updatePartyData(data);
        if (scene.partyHUD) scene.partyHUD.updatePartyData(data);
    });
    net.setCallback('onPartyInvited', (data) => {
        const accept = confirm(`${data.fromName} からパーティーに招待されました。参加しますか？`);
        if (accept) {
            net.joinParty(data.partyId);
        }
    });

    net.setCallback('onHealed', (data) => handleHealed(scene, data));
    net.setCallback('onBuffApplied', (data) => handleBuffApplied(scene, data));

    net.setCallback('onSkillUsed', (data) => {
        const { id, skillId } = data;
        console.log(`[BaseGameScene] Skill used by ${id}: ${skillId}`);

        // Play the effect on the remote player who cast it
        const otherPlayer = net.getOtherPlayers()[id];
        if (otherPlayer && otherPlayer.active && SKILLS[skillId]) {
            applySkillEffect(scene, skillId, otherPlayer, true);
        }
    });
}

// Rewards are already split among the party by the server, so grant whatever we receive
function handleEnemyKilled(scene, enemyData) {
    if (scene.questManager) scene.questManager.onEnemyKilled(enemyData.type);

    if (scene.player && scene.player.active) {
        const exp = enemyData.exp || 0;
        const gold = enemyData.gold || 0;
        const drops = enemyData.drops || [];

        if (exp > 0) scene.player.gainExp(exp);
        if (gold > 0) scene.player.gainGold(gold);

        drops.forEach(itemId => scene.player.addItem(itemId));
    }
}

function handleHealed(scene, data) {
    const player = scene.player;
    if (!player || !player.active) return;

    const amount = data.amount;
    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + amount);
    player.saveStats();
    scene.networkManager.sendPlayerStats(player.stats.hp, player.stats.maxHp);

    floatText(scene, player, `+${amount}`, '#00ff00', { fontSize: '14px', offsetY: -40, riseTo: -80, duration: 800 });
    showHitEffect(scene, player.x, player.y, 0x00ff00);
}

// Timed stat buffs: how to apply and revert each one on the local player
const STAT_BUFFS = {
    attack_buff: {
        label: 'ATK UP!', color: '#ff4500',
        apply: (p, v) => { p.stats.atk += v; p.saveStats(); },
        revert: (p, v) => { p.stats.atk -= v; p.saveStats(); }
    },
    defense_buff: {
        label: 'DEF UP!', color: '#4169e1',
        apply: (p, v) => { p.stats.def += v; p.saveStats(); },
        revert: (p, v) => { p.stats.def -= v; p.saveStats(); }
    },
    speed_buff: {
        label: 'SPEED UP!', color: '#00ffff',
        // Speed is a temporary value on the sprite, not saved in stats
        apply: (p, v) => { p.speed += v; },
        revert: (p, v) => { p.speed -= v; }
    }
};

function handleBuffApplied(scene, data) {
    const { type, value, duration, fromId } = data;
    console.log(`[Buff] Applied ${type} +${value} for ${duration}ms from ${fromId}`);

    const player = scene.player;
    if (!player || !player.active) return;

    const statBuff = STAT_BUFFS[type];
    if (statBuff) {
        statBuff.apply(player, value);
        floatText(scene, player, statBuff.label, statBuff.color);
        scene.time.delayedCall(duration, () => statBuff.revert(player, value));
    } else if (type === 'summon_power_up') {
        applySummonPowerUp(scene, value, duration);
    }
}

// Buff relayed through the player: strengthens our active summon for a while
function applySummonPowerUp(scene, value, duration) {
    const summon = scene.activeSummon;
    if (!summon || !summon.active) return;

    summon.atk += value;
    summon.speed += 50;
    const originalScale = summon.scale;
    summon.setScale(originalScale * 1.5);

    floatText(scene, summon, 'SUMMON POWER UP!', '#9370db');

    scene.time.delayedCall(duration, () => {
        if (scene.activeSummon && scene.activeSummon.active) {
            scene.activeSummon.atk -= value;
            scene.activeSummon.speed -= 50;
            scene.activeSummon.setScale(originalScale);
        }
    });
}

// Text that floats up from a game object and fades out
function floatText(scene, target, message, color, { fontSize = '10px', offsetY = -50, riseTo = -80, duration = 1000 } = {}) {
    const text = scene.add.text(target.x, target.y + offsetY, message, {
        fontSize, color, fontFamily: '"Press Start 2P"'
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: target.y + riseTo, alpha: 0, duration, onComplete: () => text.destroy() });
}
