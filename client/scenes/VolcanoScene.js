import BaseGameScene from './BaseGameScene.js';

export default class VolcanoScene extends BaseGameScene {
    constructor() {
        super('volcano');
    }

    getSceneConfig() {
        return {
            mapKey: 'volcano',
            mapFile: 'assets/maps/volcano.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
