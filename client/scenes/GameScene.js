import BaseGameScene from './BaseGameScene.js';

export default class GameScene extends BaseGameScene {
    constructor() {
        super('GameScene');
    }

    getSceneConfig() {
        return {
            mapKey: 'tutorial',
            mapFile: 'assets/maps/tutorial.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
