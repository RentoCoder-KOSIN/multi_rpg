import config from "./config.js";
import { loadEnemyStats } from "./data/enemyStats.js";
import { loadMaps } from "./data/maps.js";
import { buildMapScenes } from "./scenes/mapScenes.js";

// Enemy stats and the map list live on the server; load them before any scene needs them.
await Promise.all([loadEnemyStats(), loadMaps()]);

// One scene per map (discovered from assets/maps/*.json), after the title scene.
config.scene = [...config.scene, ...buildMapScenes()];

new Phaser.Game(config);
