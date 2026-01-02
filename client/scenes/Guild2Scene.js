import BaseGameScene from './BaseGameScene.js';

export default class Guild2Scene extends BaseGameScene {
    constructor() {
        super('guild2f');
    }

    getSceneConfig() {
        return {
            mapKey: 'guild2f',
            mapFile: 'assets/maps/guild2f.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
