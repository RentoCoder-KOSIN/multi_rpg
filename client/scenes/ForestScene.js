import BaseGameScene from './BaseGameScene.js';

export default class ForestScene extends BaseGameScene {
    constructor() {
        super('forest');
    }

    getSceneConfig() {
        return {
            mapKey: 'forest',
            mapFile: 'assets/maps/forest.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
