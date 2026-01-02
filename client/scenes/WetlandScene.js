import BaseGameScene from './BaseGameScene.js';

export default class WetLandScene extends BaseGameScene {
    constructor() {
        super('wetland');
    }

    getSceneConfig() {
        return {
            mapKey: 'wetland',
            mapFile: 'assets/maps/wetland.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
