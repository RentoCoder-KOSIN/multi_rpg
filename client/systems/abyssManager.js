import { UI_FONT } from '../fontConfig.js';
import { rollRandomOptions } from '../data/randomOptions.js';
import { ITEMS } from '../data/items.js';
import { leaveAbyss } from './abyssEntry.js';

// 階層の開始位置（南側）と、次層ポータルの位置（中央）
const START_POS = { x: 640, y: 760 };
const PORTAL_POS = { x: 640, y: 320 };
const PORTAL_TOUCH_DISTANCE = 45;

/**
 * 無限の深淵ダンジョン（Abyss Dungeon）のクライアント側進行管理。
 *
 * 敵の生成・階層クリアの判定・次の階層への切り替えは、すべてサーバー（abyssService）が行う。
 * パーティーの全員が同じ敵を見て戦うため、ここでは
 *   - 階層の表示（HUD）
 *   - クリア報酬の受け取り
 *   - 次層ポータルの表示と接触判定
 *   - 退出ボタン
 * だけを受け持つ。
 */
export class AbyssManager {
    constructor(scene) {
        this.scene = scene;
        this.net = scene.networkManager;
        const run = scene.registry.get('abyssRun');
        this.floor = run?.floor || 1;
        this.cleared = false;
        this.advanceRequested = false;
        this.memberCount = 1;
        this.hudContainer = null;
        this.portalGfx = null;
        this.portalLabel = null;
        this.portalTween = null;
        this.destroyed = false;

        this.createHUD();
        this.recordFloor(this.floor);

        // 毎フレーム: 残り敵数の表示とポータル接触判定
        scene.events.on('update', this.onUpdate, this);

        // 死亡後の復帰などでシーンが作り直されたときも、サーバーの状態に合わせる
        this.syncWithServer();
    }

    // ---------- サーバーとの同期 ----------

    async syncWithServer() {
        const state = await this.net.abyssSync();
        if (this.destroyed) return;
        if (!state.ok) return; // 参加資格が無い場合は abyssRunInvalid が別途届く

        this.floor = state.floor;
        this.cleared = state.cleared;
        this.memberCount = state.room?.members?.length || 1;
        this.scene.registry.set('abyssRun', { ...this.scene.registry.get('abyssRun'), floor: this.floor });
        this.recordFloor(this.floor);
        this.refreshTitle();
        if (this.cleared) this.showPortal();
    }

    /** 最高到達階層の記録を更新する */
    recordFloor(floor) {
        const player = this.scene.player;
        if (!player?.stats) return;
        if (!player.stats.abyssMaxFloor) player.stats.abyssMaxFloor = 0;
        if (floor > player.stats.abyssMaxFloor) {
            player.stats.abyssMaxFloor = floor;
            player.saveStats();
        }
    }

    handleRoomUpdate(room) {
        this.memberCount = room.members.length;
        const log = (text, type = 'info') => this.scene.notificationUI?.show(`🌀 ${text}`, type);
        const e = room.lastEvent;
        if (e?.type === 'left' || e?.type === 'hostChanged') log(`${e.name} が深淵から離脱しました`);
        else if (e?.type === 'rejoined') log(`${e.name} が深淵に戻ってきました`, 'success');
    }

    // ---------- 階層クリア ----------

    handleFloorCleared({ floor, rewards }) {
        if (this.cleared || floor !== this.floor) return;
        this.cleared = true;
        const scene = this.scene;
        const player = scene.player;

        scene.notificationUI?.show(`🎉 【深淵 第 ${floor} 層 突破！】 次層ポータルが出現！`, 'success');

        // 次の階層まで進んだ記録
        this.recordFloor(floor + 1);

        if (player && rewards) this.grantRewards(player, rewards);
        this.showPortal();
    }

    grantRewards(player, { exp, level, gold, magicStone, equip }) {
        player.gainExp(exp, level); // 階層の敵レベルを渡して、格下の周回にはレベル差補正がかかるようにする
        player.gainGold(gold);
        if (magicStone > 0) player.addItem('magic_stone', magicStone);

        if (equip && ITEMS[equip.id]) {
            const rolled = rollRandomOptions(ITEMS[equip.id].type || 'weapon', equip.level);
            player.addItem(equip.id, 1, equip.level, rolled);
        }
    }

    // ---------- 次の階層 ----------

    handleFloorStarted({ floor }) {
        const scene = this.scene;
        const player = scene.player;

        this.floor = floor;
        this.cleared = false;
        this.advanceRequested = false;
        scene.registry.set('abyssRun', { ...scene.registry.get('abyssRun'), floor });
        this.recordFloor(floor);

        this.hidePortal();

        if (player?.active) {
            // 層間休憩: HP/MPを回復して、スタート位置（南側）へ
            player.stats.hp = player.stats.maxHp;
            player.stats.mp = player.stats.maxMp;
            player.setPosition(START_POS.x, START_POS.y);
        }

        this.refreshTitle();
        scene.notificationUI?.show(`💀 【深淵 第 ${floor} 層】 開始！`, 'warning');
    }

    showPortal() {
        const scene = this.scene;
        this.hidePortal();

        this.portalGfx = scene.add.circle(PORTAL_POS.x, PORTAL_POS.y, 40, 0x8b5cf6, 0.4)
            .setStrokeStyle(3, 0xc084fc, 1)
            .setDepth(5);

        this.portalTween = scene.tweens.add({
            targets: this.portalGfx,
            scale: { from: 1, to: 1.25 },
            alpha: { from: 0.4, to: 0.7 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        this.portalLabel = scene.add.text(PORTAL_POS.x, PORTAL_POS.y - 60, `▼ 第 ${this.floor + 1} 層へ進む ▼`, {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: '#e9d5ff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(6);
    }

    hidePortal() {
        if (this.portalTween) {
            this.portalTween.stop();
            this.portalTween = null;
        }
        if (this.portalGfx) {
            this.portalGfx.destroy();
            this.portalGfx = null;
        }
        if (this.portalLabel) {
            this.portalLabel.destroy();
            this.portalLabel = null;
        }
    }

    // ---------- 毎フレーム ----------

    onUpdate() {
        if (this.destroyed) return;
        this.updateRemainLabel();

        // ポータルに触れたら、次の階層をサーバーに要求する（パーティー全員が一緒に進む）
        const player = this.scene.player;
        if (this.cleared && !this.advanceRequested && this.portalGfx && player?.active) {
            const dist = Phaser.Math.Distance.Between(player.x, player.y, PORTAL_POS.x, PORTAL_POS.y);
            if (dist < PORTAL_TOUCH_DISTANCE) {
                this.advanceRequested = true;
                this.net.abyssAdvance(this.floor);
                // 返事（abyssFloorStarted）が来なかった場合に備えて、少し後に再要求できるようにする
                this.scene.time.delayedCall(2000, () => { this.advanceRequested = false; });
            }
        }
    }

    // ---------- HUD ----------

    createHUD() {
        const scene = this.scene;
        // カメラの実際の描画幅の中央を基準にする
        const cx = (scene.cameras?.main?.width || scene.scale.width) / 2;

        this.hudContainer = scene.add.container(cx, 30);
        this.hudContainer.setScrollFactor(0);
        this.hudContainer.setDepth(15000);

        const bg = scene.add.rectangle(0, 0, 260, 38, 0x0a0a1a, 0.85)
            .setStrokeStyle(2, 0xa855f7, 0.9);

        this.titleLabel = scene.add.text(0, -7, '', {
            fontSize: '13px',
            fontFamily: UI_FONT,
            color: '#c084fc',
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

        // 退出ボタン（挑戦から抜けてゲートの前へ戻る）
        const leaveBox = scene.add.rectangle(160, 0, 54, 26, 0x7f1d1d, 0.95)
            .setStrokeStyle(1, 0xfca5a5, 0.9)
            .setInteractive({ useHandCursor: true });
        const leaveText = scene.add.text(160, 0, '退出', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#fff'
        }).setOrigin(0.5);
        leaveBox.on('pointerdown', () => this.confirmLeave());

        this.hudContainer.add([bg, this.titleLabel, this.remainLabel, leaveBox, leaveText]);
        this.refreshTitle();
    }

    refreshTitle() {
        if (!this.titleLabel) return;
        const isBossFloor = this.floor % 5 === 0;
        this.titleLabel.setText(isBossFloor
            ? `⚔️ 【深淵 第 ${this.floor} 層 - BOSS】`
            : `💀 【深淵 第 ${this.floor} 層】`);
        this.titleLabel.setColor(isBossFloor ? '#f43f5e' : '#c084fc');
    }

    updateRemainLabel() {
        if (!this.remainLabel) return;
        const enemies = Object.values(this.net.getEnemies()).filter(e => e && e.active && e.hp > 0);
        const party = this.memberCount > 1 ? `  👥${this.memberCount}人` : '';
        this.remainLabel.setText(`残存モンスター: ${enemies.length} 体${party}`);
    }

    confirmLeave() {
        const message = this.memberCount > 1
            ? '深淵から退出しますか？\n（仲間は挑戦を続けます）'
            : '深淵から退出しますか？（この挑戦は終了します）';
        if (confirm(message)) leaveAbyss(this.scene, '深淵から退出しました');
    }

    destroy() {
        this.destroyed = true;
        this.scene.events.off('update', this.onUpdate, this);
        this.hidePortal();
        if (this.hudContainer) this.hudContainer.destroy();
        this.hudContainer = null;
    }
}
