import config from "./config.js";
import { loadEnemyStats } from "./data/enemyStats.js";
import { loadMaps } from "./data/maps.js";
import { buildMapScenes } from "./scenes/mapScenes.js";
import { computeGameSize } from "./utils/gameSize.js";

// Enemy stats and the map list live on the server; load them before any scene needs them.
await Promise.all([loadEnemyStats(), loadMaps()]);

// One scene per map (discovered from assets/maps/*.json), after the title scene.
config.scene = [...config.scene, ...buildMapScenes()];

const game = new Phaser.Game(config);

// 表示領域(#game-root)のサイズが変わったら（ウィンドウのリサイズ、サイドパネルの表示/非表示）、
// 余白が出ないようにゲーム解像度の幅を合わせ直す。
const root = document.getElementById("game-root");
function refitGame() {
    if (!game.isBooted) return;
    const { width, height } = computeGameSize(root);
    const gs = game.scale.gameSize;
    // 親(#game-root)の実サイズを取り直してから拡縮し直す（古い親サイズで FIT して余白が出るのを防ぐ）
    game.scale.getParentBounds();

    if (gs.width !== width || gs.height !== height)
        game.scale.setGameSize(width, height);
    game.scale.refresh();
}
window.__refitGame = refitGame; // サイドパネルを出した直後に同期的に呼ぶ用（BaseGameScene.create）
game.events.once("ready", refitGame);
new ResizeObserver(refitGame).observe(root);
window.addEventListener("resize", refitGame);
