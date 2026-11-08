// Builds the Phaser scene list from the map registry (data/maps.js).
// Every map gets a plain BaseGameScene automatically; a map only needs its own class
// here when it has special logic (e.g. the boss fight in BattleScene).
import BaseGameScene from './BaseGameScene.js';
import BattleScene from './BattleScene.js';
import { getMapList } from '../data/maps.js';

// マップキー -> 専用シーンクラス（特別な処理を持つマップだけ）
const CUSTOM_SCENES = {
    battle: BattleScene
};

function createMapScene(def) {
    return class MapScene extends BaseGameScene {
        constructor() {
            super(def.sceneKey);
        }

        getSceneConfig() {
            return {
                mapKey: def.key,
                mapFile: def.file,
                showQuestTracker: def.showQuestTracker,
                showDebugKey: def.showDebugKey
            };
        }
    };
}

/** @returns {Function[]} Phaser scene classes, one per map */
export function buildMapScenes() {
    return getMapList().map(def => CUSTOM_SCENES[def.key] || createMapScene(def));
}
