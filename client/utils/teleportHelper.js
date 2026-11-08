import { resolveSceneKey, getMapKeyForScene, getMapDisplayName } from '../data/maps.js';
import { isTeleportUnlocked, describeMissingQuests } from './questGate.js';
import { flushSave } from './saveStore.js';
import { UI_FONT } from '../fontConfig.js';

function drawPortalGraphics(gfx, radius, unlocked, rot, pulseAlpha) {
    gfx.clear();
    const primaryColor = unlocked ? 0x00ffff : 0xff3366;
    const secondaryColor = unlocked ? 0x33ff99 : 0xaa22ff;
    const alpha = (unlocked ? 0.45 : 0.4) * pulseAlpha;

    // 外枠サークル
    gfx.fillStyle(primaryColor, alpha * 0.25);
    gfx.fillCircle(0, 0, radius);

    // 外枠リング
    gfx.lineStyle(2, primaryColor, alpha);
    gfx.strokeCircle(0, 0, radius);

    // 内側リング
    gfx.lineStyle(1.5, secondaryColor, alpha * 0.9);
    gfx.strokeCircle(0, 0, radius * 0.65);

    // 回転するルーン幾何学模様
    const numPoints = 4;
    gfx.lineStyle(1.5, primaryColor, alpha * 0.8);
    gfx.beginPath();
    for (let i = 0; i < numPoints; i++) {
        const a1 = rot + (i * Math.PI * 2) / numPoints;
        const x1 = Math.cos(a1) * (radius * 0.85);
        const y1 = Math.sin(a1) * (radius * 0.85);
        if (i === 0) gfx.moveTo(x1, y1);
        else gfx.lineTo(x1, y1);
    }
    gfx.closePath();
    gfx.strokePath();

    const offsetRot = rot + Math.PI / 4;
    gfx.lineStyle(1, secondaryColor, alpha * 0.7);
    gfx.beginPath();
    for (let i = 0; i < numPoints; i++) {
        const a2 = offsetRot + (i * Math.PI * 2) / numPoints;
        const x2 = Math.cos(a2) * (radius * 0.85);
        const y2 = Math.sin(a2) * (radius * 0.85);
        if (i === 0) gfx.moveTo(x2, y2);
        else gfx.lineTo(x2, y2);
    }
    gfx.closePath();
    gfx.strokePath();

    // 中心の光核
    gfx.fillStyle(0xffffff, alpha * 0.85);
    gfx.fillCircle(0, 0, radius * 0.22);
}

function updatePortalAppearance(scene, tp) {
    const v = tp.visual;
    if (!v) return;
    const unlocked = isTeleportUnlocked(scene.questManager, tp);
    if (v.lastUnlocked === unlocked) return;
    v.lastUnlocked = unlocked;
    v.isUnlocked = unlocked;

    const destName = getMapDisplayName(tp.targetMap);
    if (unlocked) {
        v.label.setText(`➡ ${destName}`);
        v.label.setColor('#aaffff');
        v.label.setStroke('#003344', 3);
    } else {
        v.label.setText(`🔒 ${destName}`);
        v.label.setColor('#ff99bb');
        v.label.setStroke('#440011', 3);
    }
}

function createPortalVisual(scene, tp) {
    const cx = tp.x + (tp.width || 32) / 2;
    const cy = tp.y + (tp.height || 32) / 2;
    const r = Math.max(20, Math.min(36, Math.max(tp.width || 32, tp.height || 32) / 2));

    const container = scene.add.container(cx, cy);
    container.setDepth(4); // 地面の上、プレイヤーの足元

    const gfx = scene.add.graphics();
    container.add(gfx);

    const destName = getMapDisplayName(tp.targetMap);
    const label = scene.add.text(0, -r - 14, '', {
        fontSize: '12px',
        fontFamily: UI_FONT,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(label);

    const visual = { container, gfx, label, radius: r, lastUnlocked: null, rotation: 0, pulseAlpha: 0.7 };
    tp.visual = visual;
    updatePortalAppearance(scene, tp);

    // 回転アニメーション
    scene.tweens.add({
        targets: visual,
        rotation: Math.PI * 2,
        duration: 8000,
        repeat: -1,
        ease: 'Linear',
        onUpdate: () => {
            if (visual.gfx && visual.gfx.active) {
                drawPortalGraphics(visual.gfx, visual.radius, visual.isUnlocked, visual.rotation, visual.pulseAlpha || 1.0);
            }
        }
    });

    // パルス明滅
    scene.tweens.add({
        targets: visual,
        pulseAlpha: 1.0,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    return visual;
}

export function setupTeleportsFromMap(scene, map) {
    const tpLayer = map.getObjectLayer('Teleports');
    if (!tpLayer) return [];

    return tpLayer.objects.map(tp => {
        const targetMap = tp.properties?.find(p => p.name === 'targetMap')?.value;
        const targetSpawn = tp.properties?.find(p => p.name === 'targetSpawn')?.value;
        const destX = tp.properties?.find(p => p.name === 'destX')?.value;
        const destY = tp.properties?.find(p => p.name === 'destY')?.value;
        const requiredQuest = tp.properties?.find(p => p.name === 'requiredQuest')?.value;
        const unlocked = tp.properties?.find(p => p.name === 'unlocked')?.value ?? false;

        const teleportObj = {
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

        createPortalVisual(scene, teleportObj);
        return teleportObj;
    });
}


export function updateTeleports(scene, player, npcs, teleports) {
    if (!scene.questManager || !npcs) return;

    const playerBounds = player.getBounds();

    teleports.forEach(tp => {
        updatePortalAppearance(scene, tp);
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
