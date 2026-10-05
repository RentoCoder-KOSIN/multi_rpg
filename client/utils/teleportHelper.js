import { resolveSceneKey, getMapKeyForScene } from '../data/maps.js';
import { isTeleportUnlocked, describeMissingQuests } from './questGate.js';
import { flushSave } from './saveStore.js';

export function setupTeleportsFromMap(scene, map) {
    const tpLayer = map.getObjectLayer('Teleports');
    if (!tpLayer) return [];

    return tpLayer.objects.map(tp => {
        const targetMap = tp.properties?.find(p => p.name === 'targetMap')?.value;
        const targetSpawn = tp.properties?.find(p => p.name === 'targetSpawn')?.value;
        const destX = tp.properties?.find(p => p.name === 'destX')?.value;
        const destY = tp.properties?.find(p => p.name === 'destY')?.value;
        const requiredQuest = tp.properties?.find(p => p.name === 'requiredQuest')?.value;
        const unlocked = tp.properties?.find(p => p.name === 'unlocked')?.value ?? false; // ← booleanに初期化

        return {
            x: tp.x,
            y: tp.y,
            width: tp.width ?? 32,
            height: tp.height ?? 32,
            targetMap,
            targetSpawn,
            destX,
            destY,
            requiredQuest,
            unlocked
        };
    });
}


export function updateTeleports(scene, player, npcs, teleports) {
    if (!scene.questManager || !npcs) return;

    const playerBounds = player.getBounds();

    teleports.forEach(tp => {
        // 「報告済み」または「達成済み（報告待ち）」のクエストが、requiredQuest（カンマ区切りで複数可）の全てで揃っていれば通れる
        const blocked = !isTeleportUnlocked(scene.questManager, tp);

        if (blocked) {
            // 転移に重なったときだけ、なぜ通れないかを（3秒に1回まで）教える
            const lockRect = new Phaser.Geom.Rectangle(tp.x, tp.y, tp.width, tp.height);
            const now = scene.time?.now ?? Date.now();
            if (Phaser.Geom.Rectangle.Overlaps(lockRect, playerBounds) && (!scene._lastLockedTeleportMsg || now - scene._lastLockedTeleportMsg > 3000)) {
                scene._lastLockedTeleportMsg = now;
                const detail = describeMissingQuests(scene.questManager, tp.requiredQuest);
                scene.notificationUI?.show(`このマップのクエストを全て達成すると先へ進めます。${detail}`, 'error', 4000);
            }
            return;
        }

        const tpRect = new Phaser.Geom.Rectangle(tp.x, tp.y, tp.width, tp.height);
        if (Phaser.Geom.Rectangle.Overlaps(tpRect, playerBounds)) {
            // Check if already transitioning
            if (scene._isTeleporting) return;

            // 転移先の名前（マップキー・シーンキー・大文字小文字違い・旧別名）をシーンキーに解決する。
            // マップは assets/maps/*.json から自動登録されるので、ここに対応表を足す必要は無い
            const targetSceneKey = resolveSceneKey(tp.targetMap);

            // 最終確認
            if (!targetSceneKey || !scene.scene.get(targetSceneKey)) {
                console.error(`[Teleport] Critical Error: Target scene '${targetSceneKey}' (original: ${tp.targetMap}) does not exist!`);
                return;
            }

            scene._isTeleporting = true;
            // シーン切替の直前に、スキル枠を含む現在の状態を必ずスナップショットする。
            // 通信保存のデバウンス中でも registry から次マップへ即座に引き継げる。
            player.stats.activeSkills = player.padActiveSkills(player.stats.activeSkills);
            scene.registry.set('playerStats', player.stats);
            player.saveStats();
            // Keep hosted deployments (including Render) in sync before the
            // old scene is torn down. The in-memory cache remains immediate,
            // and this also sends the latest snapshot to the account server.
            flushSave(true);
            // 最後のチュートリアル手順は「戦場へ転移」で達成。初回だけ経験値2倍の宝具を渡す。
            if (scene.currentMapKey === 'tutorial' && !player.stats.tutorialFlags?.leftTutorial) {
                player.stats.tutorialFlags = { ...(player.stats.tutorialFlags || {}), leftTutorial: true };
                if (!player.stats.tutorialCompletionRewardClaimed) {
                    player.stats.tutorialCompletionRewardClaimed = true;
                    player.addItem('tutorial_expedition_charm');
                    player.addItem('magic_stone', 10);
                    scene.notificationUI?.show('チュートリアル完全達成！「修練者の護符」・魔石 x10を獲得！', 'success', 5000);
                }
                player.saveStats();
            }
            console.log(`[Teleport] Transitioning to '${targetSceneKey}' (Map: ${tp.targetMap})`);

            // マップ変更をサーバーに通知（シーン再起動前に送信）
            if (scene.networkManager) {
                // サーバーにはマップキー（tutorial など）を送る
                scene.networkManager.changeMap(getMapKeyForScene(targetSceneKey), player.x, player.y);
            }

            // マップ名を更新
            if (scene.mapNameUI) {
                scene.mapNameUI.updateMapName(targetSceneKey.toUpperCase());
            }

            // シーン遷移
            scene.cameras.main.fadeOut(250, 0, 0, 0);
            scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, (cam, effect) => {
                console.log(`[Teleport] Fade complete. Starting scene: ${targetSceneKey}`);
                scene.scene.start(targetSceneKey, {
                    mapKey: getMapKeyForScene(targetSceneKey),
                    spawn: tp.targetSpawn,
                    x: tp.destX,
                    y: tp.destY
                });
            });
        }
    });
}
