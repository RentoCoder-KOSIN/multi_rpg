/**
 * 敵のデバッグ表示ユーティリティ
 * 敵の動きや状態を可視化してテスト
 */

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

    const enemies = scene.networkManager?.getEnemies() || {};
    const enemyCount = Object.keys(enemies).length;
    
    let debugText = `=== 敵AI デバッグ情報 ===\n敵数: ${enemyCount}\n`;

    // プレイヤーの位置
    debugText += `\nプレイヤー位置: (${scene.player.x.toFixed(0)}, ${scene.player.y.toFixed(0)})\n`;

    // 最初の8体の敵について詳細を表示
    let displayCount = 0;
    Object.values(enemies).forEach(enemy => {
        if (displayCount >= 8 || !enemy.active) return;
        displayCount++;

        const distance = Phaser.Math.Distance.Between(
            scene.player.x, scene.player.y,
            enemy.x, enemy.y
        );

        const inDetectRange = distance < enemy.detectRange;
        const inAttackRange = distance < enemy.attackRange;

        debugText += `\n[敵${displayCount}] ${enemy.type.toUpperCase()}`;
        debugText += `\n  位置: (${enemy.x.toFixed(0)}, ${enemy.y.toFixed(0)})`;
        debugText += `\n  距離: ${distance.toFixed(0)} (検:${enemy.detectRange} 攻:${enemy.attackRange})`;
        debugText += `\n  HP: ${enemy.hp}/${enemy.maxHp}`;
        
        if (enemy.ai && enemy.isAIEnabled) {
            debugText += `\n  [AI有効]`;
            debugText += `\n  状態: ${inDetectRange ? (inAttackRange ? '🔴攻撃範囲' : '🟡検出範囲') : '⚪未検出'}`;
            if (enemy.ai.lastAction) {
                debugText += ` | 行動: ${enemy.ai.lastAction}`;
            }
            
            // AI統計情報（改善版 + ピア学習数表示）
            const aiStats = enemy.ai.getStats();
            debugText += `\n  フレーム数: ${aiStats.frameCount}`;
            debugText += ` | 生存時間: ${aiStats.survivalTime}`;
            debugText += `\n  学習フレーム: ${aiStats.updateCount}`;
            debugText += ` | Q-table: ${aiStats.qTableSize}`;
            debugText += ` | Peers: ${aiStats.peersCount}`;
            debugText += `\n  ε=${aiStats.epsilon}`;
            debugText += ` | 平均報酬=${aiStats.avgReward}`;
            debugText += ` | 累計報酬=${aiStats.totalReward}`;
        } else {
            debugText += `\n  [デフォルト動作]`;
            debugText += `\n  状態: ${inDetectRange ? (inAttackRange ? '🔴攻撃範囲' : '🟡検出範囲') : '⚪未検出'}`;
        }
    });

    scene.enemyDebugText.setText(debugText);
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
