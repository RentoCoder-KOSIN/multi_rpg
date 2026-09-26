// Asset loading shared by every game scene.

// enemy type -> sprite file under assets/enemy/
const ENEMY_SPRITES = {
    slime: 'slime1.png',
    bat: 'pipo-enemy001.png',
    forest_slime: 'slime2.png',
    skeleton: 'pipo-enemy010.png',
    red_slime: 'slime3.png',
    goblin: 'pipo-enemy014.png',
    ghost: 'pipo-enemy035.png',
    orc: 'pipo-enemy016.png',
    dire_wolf: 'pipo-enemy018.png',
    boss: 'pipo-boss001.png',
    dragon_boss: 'pipo-boss004.png'
};

/**
 * @param {Phaser.Scene} scene
 * @param {{mapKey: string, mapFile: string}} config - scene config from getSceneConfig()
 */
export function preloadCommonAssets(scene, config) {
    scene.load.image('tiles', 'assets/tiles/tileChip.png');
    scene.load.tilemapTiledJSON(config.mapKey, config.mapFile);
    scene.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });

    Object.entries(ENEMY_SPRITES).forEach(([type, file]) => {
        scene.load.image(type, `assets/enemy/${file}`);
    });

    scene.load.image('water', 'assets/tiles/water.png');
    scene.load.image('lava', 'assets/tiles/lava.png');
    scene.load.audio('bgm', 'sounds/bgm.mp3');
}
