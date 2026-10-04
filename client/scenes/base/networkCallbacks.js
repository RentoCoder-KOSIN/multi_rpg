// Server-event handlers for game scenes. Registered once per scene in create().
import { SKILLS } from '../../data/skills.js';
import { addOtherPlayer, spawnEnemyFromServer } from '../../systems/entitySetup.js';
import { applySkillEffect, showHitEffect } from '../../systems/skillEffects.js';
import { handleSummonUpdate } from '../../systems/summons.js';
import { applyBuffVisual } from '../../systems/buffVisuals.js';
import { applyAdminAction } from '../../ui/AdminUI.js';

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
        const accept = confirm(`${data.fromName} から「${data.partyName || "Party"}」へ招待されました。参加しますか？`);
        if (accept) {
            const password = data.hasPassword ? prompt("パスワード:", "") : "";
            if (password !== null) net.joinParty(data.partyId, password);
        }
    });
    net.setCallback('onPartyList', (list) => scene.partyUI?.updatePartyList(list));
    net.setCallback('onPartyError', (message) => scene.notificationUI?.show(message, 'error'));
    net.setCallback('onChatMessage', (data) => {
        scene.chatUI?.addMessage(data);
        if (!scene.chatUI?.isOpen) scene.notificationUI?.show(`[${data.channel === 'party' ? 'TEAM' : 'ALL'}] ${data.fromName}: ${data.text}`, 'info');
    });

    net.setCallback('onHealed', (data) => handleHealed(scene, data));
    net.setCallback('onBuffApplied', (data) => handleBuffApplied(scene, data));
    net.setCallback('onAdminAction', (data) => applyAdminAction(scene, data));

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
    // クエスト更新で例外が出ても、経験値・ゴールド・ドロップの付与は止めない
    try {
        if (scene.questManager) scene.questManager.onEnemyKilled(enemyData.type);
    } catch (e) {
        console.warn('[handleEnemyKilled] quest update failed:', e);
    }

    if (scene.player && scene.player.active) {
        const exp = enemyData.exp || 0;
        const gold = enemyData.gold || 0;
        const drops = enemyData.drops || [];

        if (exp > 0) scene.player.gainExp(exp, enemyData.level);
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

function handleBuffApplied(scene, data) {
    const { type, value, duration, fromId } = data;
    console.log(`[Buff] Applied ${type} +${value} for ${duration}ms from ${fromId}`);

    const player = scene.player;
    if (!player || !player.active) return;

    // 自分に自分でバフをかけた場合、サーバーが自分自身にもこのイベントを
    // エコーで送り返してくる（playerBuff → targetSocket=自分）。
    // giveBuff() 側で既にローカル適用・アイコン表示を済ませているので、
    // ここで再適用すると効果が二重にかかってしまう。fromId === 自分IDの
    // ときはこのエコーとみなしてスキップする。
    const myId = scene.networkManager.getPlayerId();
    if (fromId === myId) return;

    if (type === 'summon_power_up') {
        applySummonPowerUp(scene, value, duration);
    } else {
        // applyBuff / updateBuffs が効果時間と解除を一元管理する。
        // stats を直接書き換えると、装備再計算時や重ね掛けで値がずれる。
        player.applyBuff(type, value, duration);
    }

    // バフをかけた側の画面には giveBuff() 経由でアイコンが出ていたが、
    // かけられた側（自分の画面）にはこれまで一切表示されていなかったバグを修正。
    // ここで自分のプレイヤーに対して同じ見た目のアイコンを出す。
    applyBuffVisual(scene, player, type, value, duration);
}

// Buff relayed through the player: strengthens all of our active summons for a while
function applySummonPowerUp(scene, value, duration) {
    const summons = (scene.activeSummons || []).filter(s => s && s.active);
    if (summons.length === 0) return;

    summons.forEach(summon => {
        summon.atk += value;
        summon.speed += 50;
        const originalScale = summon.scale;
        summon.setScale(originalScale * 1.5);

        floatText(scene, summon, 'SUMMON POWER UP!', '#9370db');

        scene.time.delayedCall(duration, () => {
            if (summon.active) {
                summon.atk -= value;
                summon.speed -= 50;
                summon.setScale(originalScale);
            }
        });
    });
}

// Text that floats up from a game object and fades out
function floatText(scene, target, message, color, { fontSize = '10px', offsetY = -50, riseTo = -80, duration = 1000 } = {}) {
    const text = scene.add.text(target.x, target.y + offsetY, message, {
        fontSize, color, fontFamily: '"Press Start 2P"'
    }).setOrigin(0.5);
    scene.tweens.add({ targets: text, y: target.y + riseTo, alpha: 0, duration, onComplete: () => text.destroy() });
}
