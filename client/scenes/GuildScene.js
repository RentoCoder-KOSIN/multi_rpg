import BaseGameScene from './BaseGameScene.js';

export default class GuildScene extends BaseGameScene {
    constructor() {
        super('guild1f');
    }

    getSceneConfig() {
        return {
            mapKey: 'guild1f',
            mapFile: 'assets/maps/guild1f.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
