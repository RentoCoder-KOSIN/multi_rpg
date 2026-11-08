import Enemy from '../entities/Enemy.js';
import { getLevelDiffMultiplier } from './levelScaling.js';

// enemy_spawn レイヤーのオブジェクトからスポーン
export function spawnEnemiesFromMap(scene, map) {
    const spawnObjects = map.getObjectLayer('enemy_spawn').objects;
    scene.enemies = [];

    spawnObjects.forEach(obj => {
        const type = (obj.properties && obj.properties.find(p => p.name === 'type')?.value) || 'slime';
        const respawnDelay = (obj.properties && obj.properties.find(p => p.name === 'respawnDelay')?.value) || 3000;
        const enemy = new Enemy(scene, obj.x, obj.y, type, type, null, obj.id, null, {});
        enemy.respawnDelay = respawnDelay;
        // 当たり判定で即死させないよう、プレイヤーの攻撃力でダメージを与える
        scene.physics.add.overlap(scene.player, enemy, () => {
            const atk = scene.player?.stats?.atk || 10;
            const levelMult = getLevelDiffMultiplier(scene.player?.stats?.level ?? 1, enemy.level);
            enemy.takeDamage(Math.max(1, Math.ceil(atk * levelMult)), scene.player);
        });
        scene.enemies.push(enemy);
    });
}

// 自動スポーン: レイヤー上のランダムなオブジェクトに湧かせる
export function spawnEnemyRandomFromMap(scene, map) {
    const spawnObjects = map.getObjectLayer('enemy_spawn').objects;
    const obj = Phaser.Utils.Array.GetRandom(spawnObjects);
    const type = (obj.properties && obj.properties.find(p => p.name === 'type')?.value) || 'slime';
    const respawnDelay = (obj.properties && obj.properties.find(p => p.name === 'respawnDelay')?.value) || 3000;
    const enemy = new Enemy(scene, obj.x, obj.y, type, type, null, obj.id, null, {});
    enemy.respawnDelay = respawnDelay;
    scene.physics.add.overlap(scene.player, enemy, () => {
        const atk = scene.player?.stats?.atk || 10;
        const levelMult = getLevelDiffMultiplier(scene.player?.stats?.level ?? 1, enemy.level);
        enemy.takeDamage(Math.max(1, Math.ceil(atk * levelMult)), scene.player);
    });
    scene.enemies.push(enemy);
}
