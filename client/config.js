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
    url: "https://orange-space-computing-machine-r4qv4vrq7ww52pq4p-3000.app.github.dev/",
    reconnectAttempts: 5,
    reconnectDelay: 1000
};

// デバッグ設定
export const DEBUG = {
    enabled: (typeof window !== 'undefined' && window.DEBUG_MODE === true) || false,
    showPhysics: true
};

// 敵AI設定
export const ENEMY_AI_CONFIG = {
    enabled: true, // 敵AIの有効/無効
    trainingEnabled: true, // 強化学習の有効/無効
    peerLearning: true, // 【新】敵同士の相互学習 (ON/OFF)
    serverSync: true // 学習データをサーバーに送信・保存する
};

// 敵AIピア学習設定【新】
export const PEER_LEARNING_CONFIG = {
    enabled: true, // ピア学習の有効/無効
    detectionRange: 150, // 敵同士の検出範囲（px）
    dataShareInterval: 2000, // データ共有の間隔（ms）
    rewardBonus: 1.0 // 連携時のボーナス報酬
};

// 敵AI設定ログ出力
console.log('[Config] Enemy AI Settings:', ENEMY_AI_CONFIG);
console.log('[Config] Peer Learning Settings:', PEER_LEARNING_CONFIG);

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