import { resolveSceneKey, getMapKeyForScene } from '../data/maps.js';

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
        let blocked = false;

        if (tp.unlocked) {
            blocked = false;
        } else if (tp.requiredQuest) {
            // クエストマネージャーの状態をチェック
            if (scene.questManager) {
                // 「報告済み」または「達成済み（報告待ち）」であればロック解除
                blocked = !(scene.questManager.isFinished(tp.requiredQuest) || scene.questManager.isCompleted(tp.requiredQuest));
            } else {
                // クエストマネージャーがない場合のフォールバック（NPCの状態を見る）
                const npc = npcs.find(n => String(n.questId) === String(tp.requiredQuest));
                blocked = !npc?.is_Complited;
            }
        }

        if (blocked) return;

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
