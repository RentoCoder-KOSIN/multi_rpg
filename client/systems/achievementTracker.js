/**
 * 実績進捗トラッカー
 */
import { ACHIEVEMENTS } from '../data/achievements.js';

export function checkAchievements(player) {
    if (!player || !player.isLocal) return;

    const stats = player.stats;
    if (!stats.achievements) stats.achievements = {};
    if (!stats.unlockedTitles) stats.unlockedTitles = [];
    if (!stats.achievementCounters) stats.achievementCounters = {};

    Object.values(ACHIEVEMENTS).forEach(ach => {
        if (stats.achievements[ach.id]) return;

        const counter = stats.achievementCounters;
        const { type, value } = ach.condition;
        let progress = 0;

        switch (type) {
            case 'kills':
                progress = counter.kills || 0;
                break;
            case 'level':
                progress = stats.level || 1;
                break;
            case 'reincarnation':
                progress = stats.reincarnationCount || 0;
                break;
            case 'jobMaster':
                progress = counter.jobsUnlocked || 0;
                break;
            case 'gold':
                progress = counter.totalGoldEarned || 0;
                break;
            case 'skillMaxLevel':
                progress = Object.values(stats.skillLevels || {}).filter(lv => lv >= 10).length;
                break;
            case 'enhance':
                progress = Math.max(0, ...(Object.values(stats.enhanceLevels || {})));
                break;
            default:
                return;
        }

        if (progress >= value) {
            stats.achievements[ach.id] = { unlockedAt: Date.now() };

            if (ach.title && !stats.unlockedTitles.includes(ach.title)) {
                stats.unlockedTitles.push(ach.title);
                if (!stats.activeTitle) {
                    stats.activeTitle = ach.title;
                    stats.activeTitleColor = ach.titleColor;
                    if (player.nameUI) {
                        player.nameUI.setTitle(ach.title, ach.titleColor);
                    }
                    if (player.scene?.networkManager) {
                        player.scene.networkManager.sendTitleUpdate(ach.title, ach.titleColor);
                    }
                }
            }

            if (player.scene?.notificationUI) {
                const titleMsg = ach.title ? ` 称号「${ach.title}」獲得！` : '';
                player.scene.notificationUI.show(
                    `🏆 実績達成: ${ach.name}！${titleMsg}`,
                    'success'
                );
            }

            player.saveStats();
        }
    });
}

export function onEnemyKill(player) {
    if (!player?.stats) return;
    if (!player.stats.achievementCounters) player.stats.achievementCounters = {};
    player.stats.achievementCounters.kills = (player.stats.achievementCounters.kills || 0) + 1;
    checkAchievements(player);
}

export function onGoldEarned(player, amount) {
    if (!player?.stats || amount <= 0) return;
    if (!player.stats.achievementCounters) player.stats.achievementCounters = {};
    player.stats.achievementCounters.totalGoldEarned =
        (player.stats.achievementCounters.totalGoldEarned || 0) + amount;
    checkAchievements(player);
}

export function onJobUnlocked(player) {
    if (!player?.stats) return;
    if (!player.stats.achievementCounters) player.stats.achievementCounters = {};
    player.stats.achievementCounters.jobsUnlocked =
        (player.stats.achievementCounters.jobsUnlocked || 0) + 1;
    checkAchievements(player);
}
