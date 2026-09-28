import BaseGameScene from './BaseGameScene.js';
import GuildQuestBoardUI from '../ui/GuildQuestBoardUI.js';

// 掲示板・ショップカウンターの座標や操作は data/facilities.js（guild1f）で定義している。
export default class GuildScene extends BaseGameScene {
    constructor() {
        super('guild1f');
        this.guildQuestBoardUI = null;
    }

    getSceneConfig() {
        return {
            mapKey: 'guild1f',
            mapFile: 'assets/maps/guild1f.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }

    create(data) {
        super.create(data);

        this.guildQuestBoardUI = new GuildQuestBoardUI(this);
        this.guildQuestBoardUI.createUI();
    }

    update(time, delta) {
        super.update(time, delta);

        // クエストボード/ショップが開いている間は移動を止める（ShopUI側と同じ扱い）
        if ((this.guildQuestBoardUI && this.guildQuestBoardUI.isOpen) || (this.shopUI && this.shopUI.isOpen)) {
            if (this.player) this.player.setVelocity(0, 0);
        }
    }
}
