import Enemy from '../entities/Enemy.js';

// enemy_spawn レイヤーのオブジェクトからスポーン
export function spawnEnemiesFromMap(scene, map) {
    const spawnObjects = map.getObjectLayer('enemy_spawn').objects;
    scene.enemies = [];

    spawnObjects.forEach(obj => {
        const enemy = new Enemy(scene, obj.x, obj.y, 'slime', 'slime');
        scene.physics.add.overlap(scene.player, enemy, () => enemy.die());
        scene.enemies.push(enemy);
    });
}

// 自動スポーン: レイヤー上のランダムなオブジェクトに湧かせる
export function spawnEnemyRandomFromMap(scene, map) {
    const spawnObjects = map.getObjectLayer('enemy_spawn').objects;
    const obj = Phaser.Utils.Array.GetRandom(spawnObjects);
    const enemy = new Enemy(scene, obj.x, obj.y, 'slime', 'slime');
    scene.physics.add.overlap(scene.player, enemy, () => enemy.die());
    scene.enemies.push(enemy);
}
