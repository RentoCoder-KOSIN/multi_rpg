import { UI_FONT } from '../fontConfig.js';
import { getUILayout } from './UILayoutManager.js';

// ゲーム画面内(左上)に常時出す簡易ステータス。
// 詳細な情報は画面横のDOMパネル(PlayerStatsUI)にあるが、画面から目を離さずに
// name / Lv / HP / MP / EXP が確認できるように、同じ値をここにも表示する。
// 見た目は右のサイドパネルと揃える(濃紺の背景 + 青い枠)。
const W = 232;
const H = 76;
const PAD = 10;
const LABEL_W = 30;
const BAR_X = PAD + LABEL_W;
const BAR_W = 108;
const BAR_H = 10;
const VALUE_RIGHT = W - PAD;

// color: バー本体 / light: 上半分のハイライト / dark: 空き部分の背景
const ROWS = [
    { key: 'hp',  label: 'HP',  color: 0xe8575d, light: 0xff8a8f, dark: 0x3a1a20, text: '#ff9ea2', y: 27 },
    { key: 'mp',  label: 'MP',  color: 0x4f8cf0, light: 0x86b4ff, dark: 0x16233f, text: '#9cc2ff', y: 43 },
    { key: 'exp', label: 'EXP', color: 0xe9b84a, light: 0xffd983, dark: 0x3a2f14, text: '#ffd98a', y: 59 }
];

export default class PlayerHudUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this._last = '';

        this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(1500);
        getUILayout(scene).register('playerHud', this.container);

        const bg = scene.add.graphics();
        bg.fillStyle(0x080d1d, 0.92);
        bg.fillRoundedRect(0, 0, W, H, 10);
        bg.lineStyle(2, 0x4a90e2, 0.8);
        bg.strokeRoundedRect(1, 1, W - 2, H - 2, 10);
        // 名前行との区切り線
        bg.lineStyle(1, 0x4a90e2, 0.35);
        bg.lineBetween(PAD, 22, W - PAD, 22);
        this.container.add(bg);

        // 影のある白文字(黒い縁取りは文字が汚く見えるので使わない)
        this.nameText = scene.add.text(PAD, 5, '', {
            fontSize: '13px', fontStyle: 'bold', color: '#ffffff', fontFamily: UI_FONT
        });
        this.container.add(this.nameText);

        this.rows = {};
        ROWS.forEach(r => {
            const cy = r.y + BAR_H / 2;
            const label = scene.add.text(PAD, cy, r.label, {
                fontSize: '11px', fontStyle: 'bold', color: r.text, fontFamily: UI_FONT
            }).setOrigin(0, 0.5);

            const track = scene.add.graphics();
            track.fillStyle(r.dark, 1);
            track.fillRoundedRect(BAR_X, r.y, BAR_W, BAR_H, 4);
            track.lineStyle(1, 0x000000, 0.5);
            track.strokeRoundedRect(BAR_X, r.y, BAR_W, BAR_H, 4);

            const fill = scene.add.graphics();

            const value = scene.add.text(VALUE_RIGHT, cy, '', {
                fontSize: '11px', color: '#e6eefc', fontFamily: UI_FONT
            }).setOrigin(1, 0.5);

            this.container.add([label, track, fill, value]);
            this.rows[r.key] = { def: r, fill, value };
        });

        // ミニマップ用カメラにHUDが二重に映らないようにする
        if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(this.container);
    }

    drawBar(row, ratio) {
        const { def, fill } = row;
        fill.clear();
        const w = Math.round(BAR_W * Phaser.Math.Clamp(ratio, 0, 1));
        if (w <= 0) return;
        const r = Math.min(4, w / 2);
        fill.fillStyle(def.color, 1);
        fill.fillRoundedRect(BAR_X, def.y, w, BAR_H, r);
        // 上半分に明るい帯を重ねて立体感を出す
        fill.fillStyle(def.light, 0.45);
        fill.fillRoundedRect(BAR_X + 1, def.y + 1, Math.max(0, w - 2), BAR_H / 2 - 1, { tl: r, tr: r, bl: 0, br: 0 });
    }

    update() {
        const stats = this.player?.stats;
        if (!stats || !this.container?.active) return;

        const playerId = this.player.isServerManaged ? this.player.id : this.scene.networkManager?.getPlayerId();
        const name = this.scene.registry.get('playerNames')?.[playerId] || 'You';
        const vals = {
            hp: [Math.ceil(stats.hp || 0), stats.maxHp || 1],
            mp: [Math.ceil(stats.mp || 0), stats.maxMp || 1],
            exp: [Math.floor(stats.exp || 0), stats.maxExp || 1]
        };

        // 値が変わっていないフレームは再描画しない
        const key = `${name}|${stats.level}|${Object.values(vals).join(',')}`;
        if (key === this._last) return;
        this._last = key;

        const shown = name.length > 10 ? `${name.substring(0, 8)}..` : name;
        this.nameText.setText(`${shown}  Lv.${stats.level}`);
        Object.entries(vals).forEach(([k, [cur, max]]) => {
            const row = this.rows[k];
            this.drawBar(row, cur / max);
            row.value.setText(`${cur}/${max}`);
        });
    }

    destroy() {
        getUILayout(this.scene).unregister('playerHud');
        this.container?.destroy();
        this.container = null;
    }
}
