// 無限の深淵の待機室。
// ゲートから入ると、パーティーのメンバーとここに集まる。ホスト（最初に入った人）がスタートを押すと
// 全員でダンジョンへ移動する。スタート後は新しいメンバーは入れない（サーバーが弾く）。
import { UI_FONT } from '../fontConfig.js';
import NotificationUI from '../ui/NotificationUI.js';
import { getJobLabel } from '../utils/jobLabel.js';
import { ABYSS_LOBBY_SCENE_KEY, goToAbyssDungeon, leaveAbyss } from '../systems/abyssEntry.js';

const PANEL_COLOR = 0x12102a;
const ACCENT = 0xa855f7;

// 待機室には画面に出す敵・仲間・パーティー画面が無いので、前のシーンに紐づいた処理は止めておく
// （前のシーンの破棄済みオブジェクトを触ってエラーにならないように）
const IDLE_CALLBACKS = [
    'onPlayerAdded', 'onPlayerRemoved', 'onEnemySpawned', 'onEnemyRemoved', 'onEnemyKilled',
    'onSummonUpdate', 'onPartyUpdate', 'onPartyList', 'onHealed', 'onBuffApplied',
    'onAdminAction', 'onSkillUsed',
    'onAbyssPartyEntered', 'onAbyssPartyClosed', 'onAbyssFloorCleared', 'onAbyssFloorStarted',
];

export default class AbyssLobbyScene extends Phaser.Scene {
    constructor() {
        super(ABYSS_LOBBY_SCENE_KEY);
    }

    init(data) {
        this.room = data?.room || null;
        this.busy = false;
        this.leaving = false;
    }

    create() {
        // マップのシーンと同じ幅にそろえる（サイドパネルのアクティビティログを出したままにする）
        document.getElementById('game-sidebar')?.classList.add('is-active');
        window.__refitGame?.();

        this.networkManager = this.registry.get('networkManager');
        this.notificationUI = new NotificationUI(this);
        const net = this.networkManager;
        net.scene = this;

        this.buildLayout();
        this.registerCallbacks();
        this.registerKeys();

        this.cameras.main.fadeIn(300, 0, 0, 0);

        if (this.room) {
            this.renderRoom(this.room);
        } else {
            // マップを経由せず直接来た場合（ワープなど）は、ここで入室を申し込む
            net.detachFromMap();
            this.enterRoom();
        }
    }

    // ---------- 画面 ----------

    buildLayout() {
        const { width, height } = this.scale.gameSize;
        const cx = width / 2;
        const returnPoint = this.registry.get('abyssReturn');

        this.add.rectangle(cx, height / 2, width, height, 0x07060f);
        this.add.rectangle(cx, height / 2, Math.min(width - 40, 640), Math.min(height - 40, 520), PANEL_COLOR, 0.95)
            .setStrokeStyle(2, ACCENT, 0.9);

        const top = height / 2 - Math.min(height - 40, 520) / 2;

        this.add.text(cx, top + 34, '💀 無限の深淵 ─ 待機室', {
            fontSize: '24px', fontFamily: UI_FONT, color: '#e9d5ff', stroke: '#000', strokeThickness: 4,
        }).setOrigin(0.5);

        const record = returnPoint?.maxFloor ? `あなたの最高到達記録: 第 ${returnPoint.maxFloor} 層` : '';
        this.add.text(cx, top + 62, record, {
            fontSize: '13px', fontFamily: UI_FONT, color: '#c4b5fd',
        }).setOrigin(0.5);

        this.countText = this.add.text(cx - 280, top + 92, '', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#e2e8f0',
        });

        // メンバー一覧（renderRoom で作り直す）
        this.memberLayer = this.add.container(0, 0);
        this.memberTop = top + 118;
        this.memberCenterX = cx;

        this.statusText = this.add.text(cx, height / 2 + 150, '', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#fde68a', align: 'center', wordWrap: { width: 560 },
        }).setOrigin(0.5);

        this.add.text(cx, height / 2 + 190,
            '・スタートすると新しい仲間は参加できません\n・人数が多いほど敵のHPが増えます（報酬は1人あたりソロと同じ）', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#94a3b8', align: 'center', lineSpacing: 4,
            }).setOrigin(0.5);

        this.startButton = this.makeButton(cx - 100, height / 2 + 235, 170, 'スタート [Enter]', 0x16a34a, () => this.onStartClicked());
        this.leaveButton = this.makeButton(cx + 100, height / 2 + 235, 170, '退出 [Esc]', 0xb91c1c, () => this.onLeaveClicked());
        this.setStartEnabled(false);
    }

    makeButton(x, y, w, label, color, onClick) {
        const box = this.add.rectangle(x, y, w, 36, color).setStrokeStyle(2, 0xffffff, 0.8)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontSize: '14px', fontFamily: UI_FONT, color: '#fff' }).setOrigin(0.5);
        box.on('pointerdown', onClick);
        return { box, text, color, enabled: true };
    }

    setStartEnabled(enabled) {
        const b = this.startButton;
        b.enabled = enabled;
        b.box.setFillStyle(enabled ? b.color : 0x475569);
        b.text.setAlpha(enabled ? 1 : 0.6);
        if (enabled) b.box.setInteractive({ useHandCursor: true });
        else b.box.disableInteractive();
    }

    renderRoom(room) {
        this.room = room;
        const myId = this.networkManager.getPlayerId();
        const isHost = room.hostId === myId;
        const rowH = 32;

        this.memberLayer.removeAll(true);
        room.members.forEach((m, i) => {
            const y = this.memberTop + i * rowH;
            const isMe = m.id === myId;
            const bg = this.add.rectangle(this.memberCenterX, y + rowH / 2 - 2, 560, rowH - 4, isMe ? 0x2e1f5e : 0x1b1740, 0.9)
                .setStrokeStyle(1, m.isHost ? 0xfacc15 : 0x6d5bd0, 0.8);
            const label = `${m.isHost ? '👑 ' : '　 '}${m.name}${isMe ? '（あなた）' : ''}`;
            const name = this.add.text(this.memberCenterX - 270, y + 5, label, {
                fontSize: '14px', fontFamily: UI_FONT, color: m.isHost ? '#fde68a' : '#e2e8f0',
            });
            const info = this.add.text(this.memberCenterX + 270, y + 6, `Lv.${m.level}  ${getJobLabel(m.job)}`, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#c4b5fd',
            }).setOrigin(1, 0);
            this.memberLayer.add([bg, name, info]);
        });

        this.countText.setText(`メンバー ${room.members.length} / ${room.maxMembers}`);
        this.setStartEnabled(isHost && !this.busy);
        this.statusText.setText(isHost
            ? '準備ができたらスタートを押してください'
            : 'ホストの開始を待っています…');
    }

    // ---------- ネットワーク ----------

    registerCallbacks() {
        const net = this.networkManager;
        IDLE_CALLBACKS.forEach(name => net.setCallback(name, () => null));

        net.setCallback('onAbyssRoomUpdate', (data) => {
            this.logRoomEvent(data.lastEvent);
            if (data.status === 'waiting') this.renderRoom(data);
        });
        net.setCallback('onAbyssStarted', (data) => this.onStarted(data));
        net.setCallback('onAbyssRunInvalid', (data) => {
            leaveAbyss(this, `🌀 ${data?.error || '挑戦に参加できませんでした'}`);
        });
        net.setCallback('onPartyError', (message) => this.notificationUI.show(message, 'error'));
        net.setCallback('onChatMessage', (data) => {
            this.notificationUI.show(`[${data.channel === 'party' ? 'TEAM' : 'ALL'}] ${data.fromName}: ${data.text}`, 'info');
        });
    }

    registerKeys() {
        this.input.keyboard.on('keydown-ENTER', () => this.onStartClicked());
        this.input.keyboard.on('keydown-ESC', () => this.onLeaveClicked());
    }

    logRoomEvent(event) {
        if (!event) return;
        const log = (text, type = 'info') => this.notificationUI.show(`🌀 ${text}`, type);
        if (event.type === 'joined') log(`${event.name} が待機室に参加しました`, 'success');
        else if (event.type === 'left') log(`${event.name} が待機室から退出しました`);
        else if (event.type === 'hostChanged') log(`${event.name} が退出。ホストが ${event.newHostName} に交代しました`);
    }

    async enterRoom() {
        const res = await this.networkManager.abyssEnter();
        if (!res.ok) {
            leaveAbyss(this, `🌀 ${res.error || '無限の深淵に入れませんでした'}`);
            return;
        }
        if (res.status === 'started') {
            goToAbyssDungeon(this, res.run);
            return;
        }
        this.renderRoom(res.room);
    }

    async onStartClicked() {
        if (this.busy || this.leaving || !this.room) return;
        if (this.room.hostId !== this.networkManager.getPlayerId()) return;

        this.busy = true;
        this.setStartEnabled(false);
        const res = await this.networkManager.abyssStart();
        if (!res.ok) {
            this.busy = false;
            this.notificationUI.show(`🌀 ${res.error || '開始できませんでした'}`, 'error');
            this.renderRoom(this.room);
        }
        // 成功時は、サーバーから abyssStarted が全員に届いて onStarted へ進む
    }

    onStarted(data) {
        if (this.leaving) return;
        this.busy = true;
        this.setStartEnabled(false);
        this.statusText.setText('深淵へ突入します…');
        this.notificationUI.show('🌀 無限の深淵への挑戦が始まりました！', 'warning');
        goToAbyssDungeon(this, { roomId: data.roomId, networkMapKey: data.networkMapKey, floor: data.floor });
    }

    onLeaveClicked() {
        if (this.leaving) return;
        this.leaving = true;
        leaveAbyss(this, '待機室から退出しました');
    }
}
