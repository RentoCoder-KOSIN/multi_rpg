import TitleScene from "./scenes/TitleScene.js"
import GameScene from "./scenes/GameScene.js"
import BattleScene from "./scenes/BattleScene.js";
import CityScene from "./scenes/CityScene.js";
import ForestScene from "./scenes/ForestScene.js";
import GuildScene from "./scenes/GuildScene.js";
import Guild2Scene from "./scenes/Guild2Scene.js";
import WetLandScene from "./scenes/WetlandScene.js";



// サーバー設定
export const SERVER_CONFIG = {
    // url: (typeof window !== 'undefined' && window.SERVER_URL) || "https://samara-reticent-jeanice.ngrok-free.dev/",
    url: "https://samara-reticent-jeanice.ngrok-free.dev/",
    reconnectAttempts: 5,
    reconnectDelay: 1000
};

// デバッグ設定
export const DEBUG = {
    enabled: (typeof window !== 'undefined' && window.DEBUG_MODE === true) || false,
    showPhysics: false
};

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            debug: DEBUG.showPhysics,
            gravity: {y:0}
        }
    },

    scene: [TitleScene, GameScene, BattleScene, CityScene, ForestScene, GuildScene, Guild2Scene, WetLandScene],

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
};

export default config;