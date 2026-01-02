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

            let targetSceneKey = tp.targetMap;

            // シーンキーの解決（エイリアスや大文字小文字の吸収）
            if (targetSceneKey && !scene.scene.get(targetSceneKey)) {
                console.warn(`[Teleport] Scene '${targetSceneKey}' not found. Attempting to resolve...`);
                // マッピング定義
                const keyMap = {
                    'battleScene': 'battle',
                    'BattleScene': 'battle',
                    'tutorial': 'GameScene', // GameSceneがtutorialマップを担当
                    'Tutorial': 'GameScene',
                    'city': 'city',
                    'City': 'city',
                    'forest': 'forest',
                    'Forest': 'forest'
                };

                if (keyMap[targetSceneKey]) {
                    console.log(`[Teleport] Resolved '${targetSceneKey}' to '${keyMap[targetSceneKey]}'`);
                    targetSceneKey = keyMap[targetSceneKey];
                } else {
                    // Phaserのシーンマネージャーから検索（ケースインセンシティブなど）
                    const found = scene.scene.manager.scenes.find(s => {
                        const sceneKey = s.sys.settings.key;
                        return sceneKey && targetSceneKey && sceneKey.toLowerCase() === targetSceneKey.toLowerCase();
                    });
                    if (found) {
                        targetSceneKey = found.sys.settings.key;
                        console.log(`[Teleport] Resolved via case-insensitivity to '${targetSceneKey}'`);
                    }
                }
            }

            // 最終確認
            if (!targetSceneKey || !scene.scene.get(targetSceneKey)) {
                console.error(`[Teleport] Critical Error: Target scene '${targetSceneKey}' (original: ${tp.targetMap}) does not exist!`);
                return;
            }

            scene._isTeleporting = true;
            console.log(`[Teleport] Transitioning to '${targetSceneKey}' (Map: ${tp.targetMap})`);

            // マップ変更をサーバーに通知（シーン再起動前に送信）
            if (scene.networkManager) {
                // サーバーにはマップキー（tutorial/city/battle）を送るべきか、シーンキーを送るべきか？
                // config.jsのmapKeyと一致させるのが理想。
                // ここではターゲットマップ名をそのまま送るか、シーンキーを送るか。
                // tp.targetMapが 'battle' なら問題ない。 'battleScene' なら 'battle' にしたほうがいいかも。
                // 安全のため、targetSceneKey（解決後の有効なキー）を使用するが、
                // GameSceneの場合は 'tutorial' を送りたいかもしれない。
                // いったん targetSceneKey を送るが、GameScene 特有の処理が必要なら調整。
                let mapKeyToSend = targetSceneKey;
                if (targetSceneKey === 'GameScene') mapKeyToSend = 'tutorial';

                scene.networkManager.changeMap(mapKeyToSend, player.x, player.y);
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
                    mapKey: targetSceneKey === 'GameScene' ? 'tutorial' : targetSceneKey,
                    spawn: tp.targetSpawn,
                    x: tp.destX,
                    y: tp.destY
                });
            });
        }
    });
}
