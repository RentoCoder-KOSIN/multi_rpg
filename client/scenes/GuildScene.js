import BaseGameScene from './BaseGameScene.js';

// ギルド1F。クエストボード・ギルドショップは Tiled(guild1f.json)の「FacilityTrigger」レイヤーで配置する。
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
