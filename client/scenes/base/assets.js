// Asset loading shared by every game scene.

// enemy type -> sprite file under assets/enemy/
const ENEMY_SPRITES = {
    slime: "slime1.png", // art-sourceにスライムは無いので従来のまま
    bat: "pipo-enemy001a.png", // コウモリ
    forest_slime: "slime2.png", // 同上
    skeleton: "pipo-enemy039.png", // ガイコツ
    red_slime: "slime3.png", // 同上
    goblin: "pipo-enemy013.png", // ハンマーを持った小鬼
    ghost: "pipo-enemy010a.png", // ゴースト
    orc: "pipo-enemy015.png", // 棍棒を持った緑の鬼
    dire_wolf: "pipo-enemy002.png", // オオカミ
    boss: "pipo-enemy043.png", // 魔王
    dragon_boss: "pipo-enemy044d.png", // 赤いドラゴン
};

/**
 * @param {Phaser.Scene} scene
 * @param {{mapKey: string, mapFile: string}} config - scene config from getSceneConfig()
 */
export function preloadCommonAssets(scene, config) {
    scene.load.image("tiles", "assets/tiles/tileChip.png");
    scene.load.tilemapTiledJSON(config.mapKey, config.mapFile);
    scene.load.spritesheet("dude", "assets/dude.png", {
        frameWidth: 32,
        frameHeight: 48,
    });

    Object.entries(ENEMY_SPRITES).forEach(([type, file]) => {
        scene.load.image(type, `assets/enemy/${file}`);
    });

    scene.load.image("water", "assets/tiles/water.png");
    scene.load.image("lava", "assets/tiles/lava.png");
    scene.load.audio("bgm", "sounds/bgm.mp3");
}
