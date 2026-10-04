/**
 * 敵のデバッグ表示ユーティリティ
 * 敵の動きや状態を可視化してテスト
 */
import { ENEMY_ATTACK_RANGE } from '../config.js';

export function createEnemyDebugUI(scene) {
    if (!scene.enemyDebugText) {
        scene.enemyDebugText = scene.add.text(10, 80, '', {
            fontSize: '11px',
            color: '#00ff00',
            fontFamily: 'monospace',
            backgroundColor: '#00000088',
            padding: { x: 5, y: 5 }
        }).setOrigin(0, 0).setDepth(9999).setScrollFactor(0);
    }
}

export function updateEnemyDebugUI(scene) {
    if (!scene.enemyDebugText || !scene.player) return;

    // このデバッグ表示はDキーで誰でも開けるが、内部で例外が起きると
    // シーンのupdate()がそこで止まってしまい、移動やネットワーク同期まで
    // 巻き込んで「フリーズしたように見える」原因になっていた。
    // 表示はあくまでおまけ機能なので、失敗しても本編の処理は絶対に止めない。
    try {
        const enemies = scene.networkManager?.getEnemies() || {};
        const enemyList = Object.values(enemies).filter(Boolean);
        const enemyCount = enemyList.length;

        let debugText = `=== 敵AI デバッグ情報 ===\n敵数: ${enemyCount}\n`;

        // プレイヤーの位置
        debugText += `\nプレイヤー位置: (${scene.player.x.toFixed(0)}, ${scene.player.y.toFixed(0)})\n`;

        // 最初の8体の敵について詳細を表示
        let displayCount = 0;
        enemyList.forEach(enemy => {
            if (displayCount >= 8 || !enemy || !enemy.active) return;
            displayCount++;

            const distance = Phaser.Math.Distance.Between(
                scene.player.x, scene.player.y,
                enemy.x, enemy.y
            );

            const detectRange = enemy.detectRange ?? 0;
            const attackRange = enemy.attackRange ?? 0;
            const inDetectRange = distance < detectRange;
            const inAttackRange = distance < attackRange;
            const typeLabel = (enemy.type || '???').toString().toUpperCase();

            debugText += `\n[敵${displayCount}] ${typeLabel}`;
            debugText += `\n  位置: (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)})`;
            debugText += `\n  距離: ${distance.toFixed(0)} (検:${detectRange} 攻:${attackRange})`;
            debugText += `\n  HP: ${enemy.hp}/${enemy.maxHp}`;

            if (enemy.ai && enemy.isAIEnabled) {
                debugText += `\n  [AI有効]`;
                debugText += `\n  状態: ${inDetectRange ? (inAttackRange ? '🔴攻撃範囲' : '🟡検出範囲') : '⚪未検出'}`;
                if (enemy.ai.lastAction) {
                    debugText += ` | 行動: ${enemy.ai.lastAction}`;
                }

                // AI統計情報（改善版 + ピア学習数表示）
                const aiStats = enemy.ai.getStats ? enemy.ai.getStats() : null;
                if (aiStats) {
                    debugText += `\n  フレーム数: ${aiStats.frameCount}`;
                    debugText += ` | 生存時間: ${aiStats.survivalTime}`;
                    debugText += `\n  学習フレーム: ${aiStats.updateCount}`;
                    debugText += ` | Q-table: ${aiStats.qTableSize}`;
                    debugText += ` | Peers: ${aiStats.peersCount}`;
                    debugText += `\n  ε=${aiStats.epsilon}`;
                    debugText += ` | 平均報酬=${aiStats.avgReward}`;
                    debugText += ` | 累計報酬=${aiStats.totalReward}`;
                }
            } else {
                debugText += `\n  [デフォルト動作]`;
                debugText += `\n  状態: ${inDetectRange ? (inAttackRange ? '🔴攻撃範囲' : '🟡検出範囲') : '⚪未検出'}`;
            }
        });

        scene.enemyDebugText.setText(debugText);
    } catch (e) {
        console.warn('[enemyDebug] デバッグ表示の更新に失敗しました（本編には影響しません）:', e);
    }
}

export function drawEnemyDetectionRanges(scene, graphics) {
    if (!scene.player || !graphics) return;

    const enemies = scene.networkManager?.getEnemies() || {};

    Object.values(enemies).forEach(enemy => {
        if (!enemy.active) return;

        // 検出範囲（黄）
        graphics.lineStyle(1, 0xffff00, 0.5);
        graphics.strokeCircleShape(
            new Phaser.Geom.Circle(enemy.x, enemy.y, enemy.detectRange)
        );

        // 攻撃範囲（赤）
        graphics.lineStyle(2, 0xff0000, 0.7);
        graphics.strokeCircleShape(
            new Phaser.Geom.Circle(enemy.x, enemy.y, enemy.attackRange)
        );

        // 敵の位置を小さなマーク
        graphics.fillStyle(0xff00ff, 1);
        graphics.fillPointShape(new Phaser.Geom.Point(enemy.x, enemy.y), 3);
    });
}

/**
 * 敵の攻撃間合いを常時、薄い輪として表示する。
 * 「敵の攻撃の間合いがわからない」対策の可視化で、Dキーのデバッグ表示とは
 * 独立して常に呼び出される想定（BaseGameScene.update() から呼ばれる）。
 *
 * サーバー管理の敵（isServerManaged）は本当の判定距離である
 * ENEMY_ATTACK_RANGE（config.js。サーバー側の値をミラーしたもの）を使い、
 * ローカル限定の敵（ボスなど）は自身が持つ attackRange を使う。
 * Enemy インスタンスは scene.children.list に全て乗っているため、
 * networkManager 経由では見えないローカルのボスもここで正しく拾える。
 */
export function drawEnemyAttackRanges(scene) {
    if (!scene.player || !scene.player.active) return;

    if (!scene._enemyRangeGraphics) {
        scene._enemyRangeGraphics = scene.add.graphics();
        // マップのオブジェクトレイヤーより確実に前。HPバー(10/11)より後ろに置く。
        scene._enemyRangeGraphics.setDepth(8);
    }
    const g = scene._enemyRangeGraphics;
    g.clear();

    scene.children.list.forEach(child => {
        if (!child.active) return;
        // Enemy クラスを import すると循環importのリスクがあるため、
        // ダックタイピングで判定する（敵なら必ず持っているプロパティで見分ける）。
        if (typeof child.attackRange !== 'number' || typeof child.isServerManaged !== 'boolean') return;

        const range = child.isServerManaged ? ENEMY_ATTACK_RANGE : (child.attackRange || 60);

        // 常時見える、薄い赤の危険エリア。敵の足元を中心に描く。
        g.fillStyle(0xff2222, 0.08);
        g.fillCircle(child.x, child.y, range);
        g.lineStyle(2, 0xff5555, 0.75);
        g.strokeCircle(child.x, child.y, range);
    });
}
