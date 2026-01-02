import BaseGameScene from './BaseGameScene.js';
import ShopUI from '../ui/ShopUI.js';

export default class CityScene extends BaseGameScene {
    constructor() {
        super('city');
        this.shopUI = null;
        this.shopTriggers = [];
    }

    getSceneConfig() {
        return {
            mapKey: 'city',
            mapFile: 'assets/maps/city.json',
            showQuestTracker: true,
            showDebugKey: true
        };
    }

    create(data) {
        super.create(data);

        // ShopUIの初期化
        this.shopUI = new ShopUI(this);

        // ShopTriggerの取得
        this.setupShopTriggers();
    }

    setupShopTriggers() {
        console.log('[CityScene] Setting up shop triggers...');

        // 全ての有効なオブジェクトレイヤー名を表示（デバッグ用）
        console.log('[CityScene] Available Object Layers:', this.map.getObjectLayerNames());

        // 1. 標準的な方法で取得を試みる (パス形式も考慮)
        let shopLayer = this.map.getObjectLayer('ShopTrigger') || this.map.getObjectLayer('Objects/ShopTrigger');

        // 2. それでも見つからない場合、全レイヤー名から「ShopTrigger」を含むものを探す
        if (!shopLayer) {
            const allNames = this.map.getObjectLayerNames();
            const matchingName = allNames.find(name => name.endsWith('ShopTrigger'));
            if (matchingName) {
                shopLayer = this.map.getObjectLayer(matchingName);
            }
        }

        if (!shopLayer) {
            console.error('[CityScene] ShopTrigger layer NOT FOUND. Check your city.json hierarchy.');
            // 最後の手段：Objectsグループの中を直接見る
            const objectsGroup = this.map.layers.find(l => l.name === 'Objects');
            if (objectsGroup && objectsGroup.layers) {
                shopLayer = objectsGroup.layers.find(l => l.name === 'ShopTrigger');
            }
        }

        if (!shopLayer) {
            console.error('[CityScene] Failed to find ShopTrigger even with fallback logic.');
            return;
        }

        this.eKey = this.input.keyboard.addKey('E');
        const objects = shopLayer.objects || [];
        console.log(`[CityScene] Success! Found ShopTrigger layer with ${objects.length} objects.`);

        shopLayer.objects.forEach(obj => {
            const shopId = obj.properties?.find(p => p.name === 'shop')?.value;
            const category = obj.properties?.find(p => p.name === 'category')?.value;

            // 判定エリアの作成 (obj.x, obj.y は左上)
            const trigger = this.add.rectangle(
                obj.x + (obj.width / 2),
                obj.y + (obj.height / 2),
                obj.width,
                obj.height,
                0x00ff00,
                0.3 // デバッグ用に少し色をつける（後で0にする）
            );

            this.physics.add.existing(trigger, true);

            this.physics.add.overlap(this.player, trigger, () => {
                if (!this.shopUI.isOpen) {
                    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
                        console.log(`[CityScene] Opening shop: ${shopId} (${category})`);
                        this.shopUI.open(shopId, category);
                    }

                    if (!this._lastShopPromptTime || this.time.now - this._lastShopPromptTime > 3000) {
                        if (this.notificationUI) {
                            this.notificationUI.show(`[E] ショップを開く (${category})`, 'info', 2000);
                        }
                        this._lastShopPromptTime = this.time.now;
                    }
                }
            });

            this.shopTriggers.push({ trigger, shopId, category });
            console.log(`[CityScene] Trigger set for ${shopId} at ${obj.x}, ${obj.y}`);
        });
    }

    update(time, delta) {
        super.update(time, delta);

        // ショップが開いている間はプレイヤーの入力を制限するなどの処理が必要
        if (this.shopUI && this.shopUI.isOpen) {
            if (this.player) {
                this.player.setVelocity(0, 0);
            }
        }
    }
}
