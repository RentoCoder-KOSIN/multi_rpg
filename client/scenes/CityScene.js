import BaseGameScene from './BaseGameScene.js';

// 街。ショップ・鍛冶屋などの施設は Tiled(city.json)の「FacilityTrigger」レイヤーで配置する。
export default class CityScene extends BaseGameScene {
    constructor() {
        super('city');
    }

    getSceneConfig() {
        return {
            mapKey: 'city',
            mapFile: 'assets/maps/city.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }
}
