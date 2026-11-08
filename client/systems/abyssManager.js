import { UI_FONT } from '../fontConfig.js';
import Enemy from '../entities/Enemy.js';
import { rollRandomOptions } from '../data/randomOptions.js';

/**
 * 無限の深淵ダンジョン（Abyss Dungeon）進行管理クラス
 */
export class AbyssManager {
    constructor(scene) {
        this.scene = scene;
        this.floor = scene.registry.get('abyssStartFloor') || 1;
        this.monsters = [];
        this.cleared = false;
        this.hudContainer = null;
        this.portalZone = null;
        this.portalGfx = null;

        if (scene.currentMapKey === 'abyss') {
            this.initAbyss();
        }
    }

    initAbyss() {
        const scene = this.scene;
        const player = scene.player;

        // 最高到達階層の記録更新
        if (!player.stats.abyssMaxFloor) player.stats.abyssMaxFloor = 0;
        if (this.floor > player.stats.abyssMaxFloor) {
            player.stats.abyssMaxFloor = this.floor;
            player.saveStats();
        }

        this.createHUD();
        this.spawnFloorWave();

        // 敵死亡イベントの監視
        scene.events.on('update', this.checkWaveStatus, this);
    }

    createHUD() {
        const scene = this.scene;
        // カメラの実際の描画幅の中央を基準にする
        const cx = (scene.cameras?.main?.width || scene.scale.width) / 2;

        this.hudContainer = scene.add.container(cx, 30);
        this.hudContainer.setScrollFactor(0);
        this.hudContainer.setDepth(15000);

        const bg = scene.add.rectangle(0, 0, 260, 38, 0x0a0a1a, 0.85)
            .setStrokeStyle(2, 0xa855f7, 0.9);

        const isBossFloor = this.floor % 5 === 0;
        const titleText = isBossFloor
            ? `⚔️ 【深淵 第 ${this.floor} 層 - BOSS】`
            : `💀 【深淵 第 ${this.floor} 層】`;

        this.titleLabel = scene.add.text(0, -7, titleText, {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: isBossFloor ? '#f43f5e' : '#c084fc',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.remainLabel = scene.add.text(0, 9, '敵を探知中...', {
            fontSize: '11px',
            fontFamily: UI_FONT,
            color: '#e2e8f0',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.hudContainer.add([bg, this.titleLabel, this.remainLabel]);
    }

    spawnFloorWave() {
        const scene = this.scene;
        this.cleared = false;
        this.monsters = [];

        // 階層に応じたモンスター選択
        // 階層ごとに敵レベルがスケーリング (Floor 1: Lv15 〜 Floor 50: Lv150 〜 Floor 100+: Lv250)
        const isBossFloor = this.floor % 5 === 0;
        const enemyList = this.getEnemyListForFloor(this.floor, isBossFloor);

        // スポーン座標（中央広場周辺 x: 400〜880, y: 350〜750）
        enemyList.forEach((type, idx) => {
            const angle = (idx / enemyList.length) * Math.PI * 2;
            const dist = isBossFloor && idx === 0 ? 0 : (150 + Math.random() * 120);
            const x = 640 + Math.cos(angle) * dist;
            const y = 520 + Math.sin(angle) * dist;

            const textureKey = scene.textures.exists(type) ? type : 'slime';
            const enemy = new Enemy(scene, x, y, textureKey, type, null, null, null, {});
            enemy.noRespawn = true;

            // 階層倍率をステータスに上乗せ (階層が進むほど強くなる)
            const floorMult = 1.0 + (this.floor - 1) * 0.08;
            enemy.hp = Math.round(enemy.hp * floorMult);
            enemy.maxHp = enemy.hp;
            enemy.atk = Math.round(enemy.atk * floorMult);
            enemy.level = 20 + this.floor * 2;

            // コライダー設定
            if (scene.collidableLayers) {
                scene.collidableLayers.forEach(layer => scene.physics.add.collider(enemy, layer));
            }
            if (scene.player) {
                scene.physics.add.overlap(scene.player, enemy, () => {
                    const now = scene.time.now;
                    if (scene.player.active && enemy.active && enemy.hp > 0) {
                        if (!scene.player.lastHitTime || now - scene.player.lastHitTime > 1000) {
                            scene.player.takeDamage(Math.max(1, enemy.atk));
                            if (scene.player) scene.player.lastHitTime = now;
                        }
                    }
                });
            }

            // 撃破時報酬フック
            enemy.on('destroy', () => {
                if (scene.player && scene.player.active) {
                    const baseExp = Math.round(200 * Math.pow(1.08, this.floor));
                    const baseGold = Math.round(80 * Math.pow(1.06, this.floor));
                    scene.player.gainExp(baseExp, enemy.level);
                    scene.player.gainGold(baseGold);
                    // 18%確率でランダムOP装備ドロップ
                    if (Math.random() < 0.18) {
                        const equipPool = ['iron_sword', 'steel_sword', 'mythril_sword', 'leather_armor', 'iron_armor', 'mythril_armor', 'crystal_pendant', 'warrior_ring'];
                        const dropId = Phaser.Utils.Array.GetRandom(equipPool);
                        const rolled = rollRandomOptions('weapon', enemy.level);
                        scene.player.addItem(dropId, 1, enemy.level, rolled);
                    }
                }
            });

            scene.enemies = scene.enemies || [];
            scene.enemies.push(enemy);
            this.monsters.push(enemy);

            // スポーンエフェクト
            scene.tweens.add({
                targets: enemy,
                alpha: { from: 0, to: 1 },
                scale: { from: 0.2, to: 1 },
                duration: 400,
                ease: 'Back.easeOut'
            });
        });

        this.updateHUDText();
    }

    getEnemyListForFloor(floor, isBoss) {
        if (isBoss) {
            if (floor >= 50) return ['chaos_emperor', 'anubis_knight', 'anubis_knight'];
            if (floor >= 30) return ['blizzard_dragon', 'frost_golem', 'frost_golem'];
            if (floor >= 20) return ['dragon_boss', 'lava_golem', 'lava_golem'];
            if (floor >= 10) return ['swamp_boss', 'ruins_boss'];
            return ['forest_boss', 'skeleton', 'skeleton'];
        }

        // 通常階層 (3〜6体)
        const count = Math.min(8, 3 + Math.floor(floor / 8));
        const list = [];
        for (let i = 0; i < count; i++) {
            if (floor >= 40) list.push(Phaser.Utils.Array.GetRandom(['anubis_knight', 'mummy_lord', 'desert_scorpion', 'frost_golem']));
            else if (floor >= 25) list.push(Phaser.Utils.Array.GetRandom(['frost_golem', 'yeti', 'ice_wolf', 'magma_slime']));
            else if (floor >= 15) list.push(Phaser.Utils.Array.GetRandom(['ruins_wolf', 'ruins_gargoyle', 'dire_wolf', 'hell_hound']));
            else if (floor >= 8) list.push(Phaser.Utils.Array.GetRandom(['skeleton', 'goblin', 'swamp_viper', 'red_slime']));
            else list.push(Phaser.Utils.Array.GetRandom(['slime', 'forest_slime', 'forest_wolf', 'bat']));
        }
        return list;
    }

    checkWaveStatus() {
        if (this.cleared) return;

        // 生きている敵をカウント
        this.monsters = this.monsters.filter(m => m && m.active && m.hp > 0);
        this.updateHUDText();

        if (this.monsters.length === 0) {
            this.onFloorCleared();
        }
    }

    updateHUDText() {
        if (!this.remainLabel) return;
        this.remainLabel.setText(`残存モンスター: ${this.monsters.length} 体`);
    }

    onFloorCleared() {
        this.cleared = true;
        const scene = this.scene;
        const player = scene.player;

        // 突破アナウンス
        if (scene.notificationUI) {
            scene.notificationUI.show(`🎉 【深淵 第 ${this.floor} 層 突破！】 次層ポータルが出現！`, 'success', 4000);
        }

        // 最高到達更新
        if (this.floor >= (player.stats.abyssMaxFloor || 0)) {
            player.stats.abyssMaxFloor = this.floor + 1;
            player.saveStats();
        }

        // クリア報酬（EXP、Gold、魔石、高確率のランダムOP装備）
        const expReward = Math.round(5000 * Math.pow(1.15, this.floor));
        const goldReward = Math.round(2000 * Math.pow(1.12, this.floor));
        player.gainExp(expReward);
        player.gainGold(goldReward);
        player.addItem('magic_stone', Math.max(1, Math.floor(this.floor / 3)));

        // 5階層ごと、または20%確率で高OP装備確定ドロップ
        if (this.floor % 5 === 0 || Math.random() < 0.3) {
            const equipPool = ['mythril_sword', 'dragon_scale_armor', 'ancient_grimoire', 'void_aegis', 'genesis_bow', 'titan_armor'];
            const dropId = Phaser.Utils.Array.GetRandom(equipPool);
            const rolled = rollRandomOptions('weapon', this.floor * 2);
            player.addItem(dropId, 1, this.floor * 2, rolled);
        }

        // 次層ポータル（中央 x: 640, y: 320）を起動・表示
        this.activateNextFloorPortal();
    }

    activateNextFloorPortal() {
        const scene = this.scene;

        if (this.portalGfx) this.portalGfx.destroy();
        this.portalGfx = scene.add.circle(640, 320, 40, 0x8b5cf6, 0.4)
            .setStrokeStyle(3, 0xc084fc, 1);
        this.portalGfx.setDepth(5);

        scene.tweens.add({
            targets: this.portalGfx,
            scale: { from: 1, to: 1.25 },
            alpha: { from: 0.4, to: 0.7 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.portalLabel = scene.add.text(640, 260, `▼ 第 ${this.floor + 1} 層へ進む ▼`, {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: '#e9d5ff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(6);

        // プレイヤー接触判定
        const checkPortalTouch = () => {
            if (!this.cleared || !scene.player) return;
            const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, 640, 320);
            if (dist < 45) {
                scene.events.off('update', checkPortalTouch);
                this.advanceToNextFloor();
            }
        };
        scene.events.on('update', checkPortalTouch);
    }

    advanceToNextFloor() {
        const scene = this.scene;
        const player = scene.player;

        this.floor += 1;
        scene.registry.set('abyssStartFloor', this.floor);

        // プレイヤーHP/MP回復（層間休憩）
        player.stats.hp = player.stats.maxHp;
        player.stats.mp = player.stats.maxMp;

        // プレイヤーをスタート位置（南側）へワープ
        player.setPosition(640, 760);

        if (this.portalGfx) {
            this.portalGfx.destroy();
            this.portalGfx = null;
        }
        if (this.portalLabel) {
            this.portalLabel.destroy();
            this.portalLabel = null;
        }

        // 次の層を開始
        const isBoss = this.floor % 5 === 0;
        this.titleLabel.setText(isBoss ? `⚔️ 【深淵 第 ${this.floor} 層 - BOSS】` : `💀 【深淵 第 ${this.floor} 層】`);
        this.titleLabel.setColor(isBoss ? '#f43f5e' : '#c084fc');

        this.spawnFloorWave();
    }

    destroy() {
        if (this.hudContainer) this.hudContainer.destroy();
        if (this.portalGfx) this.portalGfx.destroy();
        if (this.portalLabel) this.portalLabel.destroy();
        this.scene.events.off('update', this.checkWaveStatus, this);
    }
}
