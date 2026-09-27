import BaseGameScene from './BaseGameScene.js';
import GuildQuestBoardUI from '../ui/GuildQuestBoardUI.js';

// guild1f内の「掲示板」「ショップカウンター」の実ピクセル座標。
// このマップにはCityScene用のShopTriggerオブジェクトレイヤーが無いため、
// 実際にタイル画像を描画して確認した上で、ここにハードコードしている
// （掲示板: (1-6, 10-11)の壁に設置された2枚の張り紙、
//   ショップカウンター: (23-25, 28-29)の武器・薬品が並んだ台）。
const QUEST_BOARD_ZONE = { x: 32, y: 384, width: 192, height: 56 };
const SHOP_COUNTER_ZONE = { x: 736, y: 832, width: 96, height: 64 };

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

        this.guildEKey = this.input.keyboard.addKey('E');
        this.setupGuildFacilities();
    }

    setupGuildFacilities() {
        this.questBoardZoneObj = this.addFacilityZone(QUEST_BOARD_ZONE, () => {
            if (this.shopUI.isOpen) return;
            if (Phaser.Input.Keyboard.JustDown(this.guildEKey)) {
                this.guildQuestBoardUI.toggle();
            } else {
                this.promptFacility('[E] クエストボードを見る');
            }
        });

        this.shopZoneObj = this.addFacilityZone(SHOP_COUNTER_ZONE, () => {
            if (this.guildQuestBoardUI.isOpen) return;
            if (Phaser.Input.Keyboard.JustDown(this.guildEKey)) {
                this.shopUI.open('guild_shop');
            } else {
                this.promptFacility('[E] ギルドショップを開く');
            }
        });
    }

    // CityScene.setupShopTriggers()と同様の当たり判定ゾーンを作る共通ヘルパー。
    addFacilityZone({ x, y, width, height }, onOverlap) {
        const zone = this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x00ff00, 0);
        this.physics.add.existing(zone, true);
        this.physics.add.overlap(this.player, zone, onOverlap);
        return zone;
    }

    promptFacility(message) {
        if (!this._lastFacilityPromptTime || this.time.now - this._lastFacilityPromptTime > 3000) {
            if (this.notificationUI) this.notificationUI.show(message, 'info', 2000);
            this._lastFacilityPromptTime = this.time.now;
        }
    }

    update(time, delta) {
        super.update(time, delta);

        // クエストボード/ショップが開いている間は移動を止める（ShopUI側と同じ扱い）
        if ((this.guildQuestBoardUI && this.guildQuestBoardUI.isOpen) || (this.shopUI && this.shopUI.isOpen)) {
            if (this.player) this.player.setVelocity(0, 0);
        }
    }
}
