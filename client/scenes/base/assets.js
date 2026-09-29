// Asset loading shared by every game scene.
import { getAllEnemyStats } from '../../data/enemyStats.js';

/**
 * @param {Phaser.Scene} scene
 * @param {{mapKey: string, mapFile: string}} config - scene config from getSceneConfig()
 */
export function preloadCommonAssets(scene, config) {
    scene.load.image('tiles', 'assets/tiles/tileChip.png');
    scene.load.tilemapTiledJSON(config.mapKey, config.mapFile);
    scene.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });

    // 敵の画像は敵データ（server/data/enemyStats.js の sprite）から。テクスチャキー = 敵のtype
    Object.entries(getAllEnemyStats()).forEach(([type, stats]) => {
        if (stats.sprite) scene.load.image(type, `assets/enemy/${stats.sprite}`);
    });

    scene.load.image('water', 'assets/tiles/water.png');
    scene.load.image('lava', 'assets/tiles/lava.png');
    scene.load.audio('bgm', 'sounds/bgm.mp3');
}
