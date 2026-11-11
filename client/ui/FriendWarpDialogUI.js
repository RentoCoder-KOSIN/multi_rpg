import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from "./BaseWindowUI.js";
import { resolveSceneKey, getMapKeyForScene, getMapDisplayName } from '../data/maps.js';
import { flushSave } from '../utils/saveStore.js';

export function createWarpBurst(scene, x, y) {
    if (!scene || !scene.add) return;
    const ring = scene.add.circle(x, y, 10, 0x00ffff, 0.8).setDepth(2500);
    scene.tweens.add({
        targets: ring,
        radius: 60,
        alpha: 0,
        duration: 400,
        onComplete: () => ring.destroy()
    });

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        const particle = scene.add.circle(x, y, 4, 0x88ffff, 1).setDepth(2500);
        scene.tweens.add({
            targets: particle,
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist,
            alpha: 0,
            scale: 0.2,
            duration: 450,
            onComplete: () => particle.destroy()
        });
    }
}

// 無限の深淵の待機室 / ダンジョン（サーバーが返すマップキー）
function isAbyssLocation(mapKey) {
    return mapKey === 'abyss' || mapKey === 'abyss_lobby';
}

export function executeFriendWarp(scene, targetMember) {
    const player = scene.player;
    const nm = scene.networkManager;
    if (!player || !targetMember) return;

    const currentMap = scene.currentMapKey;
    const isSameMap = targetMember.map === currentMap;

    if (scene.cameras?.main) {
        scene.cameras.main.flash(200, 0, 255, 255);
    }

    if (isSameMap) {
        const others = nm?.getOtherPlayers() || {};
        const otherPlayer = others[targetMember.id];
        let targetX = otherPlayer ? otherPlayer.x : player.x;
        let targetY = otherPlayer ? otherPlayer.y : player.y;

        targetX += (player.facingDirection || 1) * -36;

        createWarpBurst(scene, player.x, player.y);
        player.setPosition(targetX, targetY);
        createWarpBurst(scene, targetX, targetY);

        if (nm) {
            nm.sendPlayerMovement(player.x, player.y, player.facingDirection || 1, player.stats.speed || 150, true);
        }

        scene.notificationUI?.show(`「${targetMember.name}」のそばへワープしました！`, 'success', 3500);
    } else {
        // 無限の深淵（待機室・挑戦中）へは、ゲートから待機室に入る以外では行けない
        // （開始後の途中参加を防ぐため、仲間のいる場所へのワープも不可）
        if (isAbyssLocation(targetMember.map)) {
            scene.notificationUI?.show('無限の深淵へはワープできません。ゲートから待機室に入ってください', 'error', 3500);
            return;
        }

        // 自力で到達したことのあるマップかチェック
        const canWarp = player.hasVisitedMap ? player.hasVisitedMap(targetMember.map) : true;
        if (!canWarp) {
            scene.notificationUI?.show(`「${getMapDisplayName(targetMember.map)}」にはまだ自力で到達したことがないためワープできません`, 'error', 3500);
            return;
        }

        const targetSceneKey = resolveSceneKey(targetMember.map);
        if (!targetSceneKey || !scene.scene.get(targetSceneKey)) {
            scene.notificationUI?.show(`移動先マップ「${targetMember.map}」が見つかりません`, 'error', 3000);
            return;
        }

        scene._isTeleporting = true;
        player.saveStats();
        flushSave(true);

        if (nm) {
            nm.changeMap(getMapKeyForScene(targetSceneKey), player.x, player.y);
        }

        scene.notificationUI?.show(`「${targetMember.name}」がいる「${getMapDisplayName(targetMember.map)}」へ転移中...`, 'info', 3000);

        scene.cameras.main.fadeOut(300, 0, 255, 255);
        scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            scene.scene.start(targetSceneKey, {
                mapKey: getMapKeyForScene(targetSceneKey),
                spawn: 'default',
                targetPlayerId: targetMember.id
            });
        });
    }
}

export default class FriendWarpDialogUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🌀 フレンドワープ',
            width: 440,
            height: 380,
            depth: 130000,
            themeColor: 0x00ffff,
            titleStroke: 0x0088aa,
        });
        this.members = [];
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        this.bodyContainer = this.scene.add.container(0, 0);
        this.container.add(this.bodyContainer);
    }

    openWithMembers(members) {
        this.members = members || [];
        this.open();
        this.refresh();
    }

    refresh() {
        if (!this.bodyContainer?.active) return;
        this.bodyContainer.removeAll(true);

        const w = this.config.width;
        const h = this.config.height;

        this.bodyContainer.add(this.scene.add.text(0, -h / 2 + 55, 'ワープ先のパーティーメンバーを選択してください', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#88ffff'
        }).setOrigin(0.5));

        if (!this.members || this.members.length === 0) {
            this.bodyContainer.add(this.scene.add.text(0, 0, 'テレポート可能なメンバーがいません', {
                fontSize: '12px', fontFamily: UI_FONT, color: '#aaaaaa'
            }).setOrigin(0.5));
            return;
        }

        const startY = -h / 2 + 85;
        const rowH = 50;

        this.members.forEach((m, i) => {
            const y = startY + i * (rowH + 6);

            const card = this.scene.add.container(0, y);

            const bg = this.scene.add.graphics();
            bg.fillStyle(0x0f2a40, 0.7);
            bg.fillRoundedRect(-w / 2 + 25, 0, w - 50, rowH, 8);
            bg.lineStyle(1.5, 0x00ffff, 0.4);
            bg.strokeRoundedRect(-w / 2 + 25, 0, w - 50, rowH, 8);
            card.add(bg);

            const player = this.scene.player;
            const isSame = m.map === this.scene.currentMapKey;
            const abyssLocked = !isSame && isAbyssLocation(m.map);
            const hasVisited = isSame || (!abyssLocked && (player?.hasVisitedMap ? player.hasVisitedMap(m.map) : true));
            const mapTag = isSame ? '📍同マップ'
                : abyssLocked ? `🔒${getMapDisplayName(m.map)} (ゲートから入室)`
                    : (hasVisited ? `🌐${getMapDisplayName(m.map)}` : `🔒${getMapDisplayName(m.map)} (未到達)`);

            const nameText = this.scene.add.text(-w / 2 + 40, 10, `${m.name} (Lv.${m.level || 1})`, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff', style: 'bold'
            });
            card.add(nameText);

            const mapText = this.scene.add.text(-w / 2 + 40, 30, mapTag, {
                fontSize: '10px', fontFamily: UI_FONT, color: isSame ? '#55ff99' : (hasVisited ? '#ffcc66' : '#888888')
            });
            card.add(mapText);

            const btnBg = this.scene.add.rectangle(w / 2 - 80, 25, 80, 28, hasVisited ? 0x0088aa : 0x333344)
                .setStrokeStyle(1.5, hasVisited ? 0x00ffff : 0x555566)
                .setInteractive({ useHandCursor: true });
            const btnText = this.scene.add.text(w / 2 - 80, 25, hasVisited ? 'ワープ 🌀' : '未到達 🔒', {
                fontSize: '11px', fontFamily: UI_FONT, color: hasVisited ? '#ffffff' : '#888888', style: 'bold'
            }).setOrigin(0.5);

            if (hasVisited) {
                btnBg.on('pointerover', () => btnBg.setFillStyle(0x00bbdd));
                btnBg.on('pointerout', () => btnBg.setFillStyle(0x0088aa));
            }
            btnBg.on('pointerdown', (pointer, x, y, event) => {
                if (event) event.stopPropagation();
                if (!hasVisited) {
                    this.scene.notificationUI?.show(`「${getMapDisplayName(m.map)}」にはまだ自力で到達したことがないためワープできません`, 'error', 3500);
                    return;
                }
                this.close();
                executeFriendWarp(this.scene, m);
            });

            card.add(btnBg);
            card.add(btnText);

            this.bodyContainer.add(card);
        });
    }
}
