import config from "./config.js";
import { loadEnemyStats } from "./data/enemyStats.js";

// Enemy stats live on the server; load them before any scene needs them.
await loadEnemyStats();

new Phaser.Game(config);
