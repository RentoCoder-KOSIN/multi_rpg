import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from "./BaseWindowUI.js";

/**
 * 個数を選ぶ小さなダイアログ（使う / 捨てる / 売る / 買う で共用）。
 *
 *   scene.quantityDialog.show({
 *       title: '売る', itemName: 'ポーション', max: 12,
 *       unitPrice: 30, priceLabel: '売却額',        // 省略可: 合計金額を表示する
 *       confirmLabel: '売る',                          // 省略可
 *       onConfirm: (qty) => { ... },
 *   });
 *
 * 操作: ←→ で±1、↑↓ で±10、数字キーで直接入力、Enterで決定、Escでキャンセル。
 *
 * ★ 他のウィンドウのキー処理との衝突を避けるため:
 *   - このダイアログは、インベントリ/ショップより「先に」生成する（BaseGameScene.create 参照）。
 *     Phaserのキーイベントは登録順に届くので、先に受け取って isBlocking() を立てられる。
 *   - 他のウィンドウは、キー入力の先頭で scene.quantityDialog?.isBlocking() を見て無視する。
 *   - 閉じた直後の数十msも isBlocking() が true を返す（同じキー押下で、ダイアログが閉じた後に
 *     別ウィンドウのEnter/Escが反応してしまうのを防ぐ）。
 */
export default class QuantityDialogUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '個数を選択',
            width: 460,
            height: 300,
            depth: 300000,
            themeColor: 0xe94560,
            overlayAlpha: 0.5,
        });
        this.quantity = 1;
        this.max = 1;
        this.opts = null;
        this.swallowUntil = 0;
        this.typed = '';
    }

    /** 開いている間と、閉じた直後のわずかな間 true */
    isBlocking() {
        return this.isOpen || Date.now() < this.swallowUntil;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        const H = this.config.height;
        const W = this.config.width;

        this.titleText = this.container.list.find(o => o instanceof Phaser.GameObjects.Text && o.y < -H / 2 + 50);

        this.itemText = this.scene.add.text(0, -H / 2 + 95, '', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#ffffff', align: 'center',
            wordWrap: { width: W - 60 }
        }).setOrigin(0.5);
        this.qtyText = this.scene.add.text(0, -H / 2 + 145, '1', {
            fontSize: '32px', fontFamily: UI_FONT, color: '#ffd700', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);
        this.subText = this.scene.add.text(0, -H / 2 + 185, '', {
            fontSize: '11px', fontFamily: UI_FONT, color: '#8fd3ff', align: 'center'
        }).setOrigin(0.5);
        this.container.add([this.itemText, this.qtyText, this.subText]);

        const btn = (x, y, w, label, color, onClick) => {
            const bg = this.scene.add.rectangle(x, y, w, 36, color, 0.9).setStrokeStyle(2, 0xffffff, 0.8)
                .setInteractive({ useHandCursor: true });
            const tx = this.scene.add.text(x, y, label, {
                fontSize: '12px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);
            bg.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); onClick(); });
            bg.on('pointerover', () => bg.setAlpha(1));
            bg.on('pointerout', () => bg.setAlpha(0.9));
            this.container.add([bg, tx]);
            return { bg, tx };
        };

        const rowY = -H / 2 + 145;
        btn(-190, rowY, 50, '-10', 0x555577, () => this.change(-10));
        btn(-130, rowY, 44, '-1', 0x555577, () => this.change(-1));
        btn(130, rowY, 44, '+1', 0x555577, () => this.change(1));
        btn(190, rowY, 50, '+10', 0x555577, () => this.change(10));
        btn(0, rowY + 48 + 0, 90, 'MAX', 0x2a6f97, () => this.setQuantity(this.max));

        const bottomY = H / 2 - 40;
        this.okBtn = btn(-90, bottomY, 150, '決定', 0x2e8b57, () => this.confirm());
        btn(90, bottomY, 150, 'キャンセル', 0x8b2e2e, () => this.cancel());

        this.scene.input.keyboard.on('keydown', (event) => {
            if (!this.isOpen) return;
            this.swallowUntil = Date.now() + 80; // このキー押下は他のウィンドウに渡さない
            const code = event.code;
            if (code === 'ArrowRight') this.change(1);
            else if (code === 'ArrowLeft') this.change(-1);
            else if (code === 'ArrowUp') this.change(10);
            else if (code === 'ArrowDown') this.change(-10);
            else if (code === 'Enter' || code === 'NumpadEnter') this.confirm();
            else if (/^(Digit|Numpad)\d$/.test(code)) this.typeDigit(code.slice(-1));
            else if (code === 'Backspace') this.typed = this.typed.slice(0, -1), this.setQuantity(parseInt(this.typed || '1', 10));
        });
    }

    show(opts) {
        if (!this.container) this.createUI();
        this.opts = opts;
        this.max = Math.max(1, Math.floor(opts.max || 1));
        this.typed = '';
        this.quantity = Math.min(this.max, Math.max(1, Math.floor(opts.initial || 1)));

        if (this.titleText) this.titleText.setText(opts.title || '個数を選択');
        this.itemText.setText(opts.itemName || '');
        this.refresh();

        if (!this.isOpen) {
            this.isOpen = true;
            this.open();
        }
        this.swallowUntil = Date.now() + 80; // 開くきっかけになったEnter/クリックを持ち越さない
    }

    typeDigit(d) {
        // 数字キーの直接入力。上限を超えたら上限に丸める
        this.typed = (this.typed + d).replace(/^0+/, '').slice(0, 4);
        this.setQuantity(parseInt(this.typed || '1', 10));
    }

    change(delta) {
        this.typed = '';
        this.setQuantity(this.quantity + delta);
    }

    setQuantity(n) {
        this.quantity = Math.min(this.max, Math.max(1, Math.floor(n) || 1));
        this.refresh();
    }

    refresh() {
        this.qtyText.setText(`${this.quantity}`);
        const parts = [`(最大 ${this.max})`];
        const o = this.opts || {};
        if (o.unitPrice != null) {
            parts.push(`${o.priceLabel || '合計'}: ${o.unitPrice * this.quantity} G`);
        }
        this.subText.setText(parts.join('\n'));
    }

    confirm() {
        const cb = this.opts?.onConfirm;
        const qty = this.quantity;
        this.hideDialog();
        if (cb) cb(qty);
    }

    cancel() {
        const cb = this.opts?.onCancel;
        this.hideDialog();
        if (cb) cb();
    }

    hideDialog() {
        this.swallowUntil = Date.now() + 80;
        if (this.isOpen) {
            this.isOpen = false;
            this.close();
        }
    }

    // Esc / ✕ ボタン（BaseWindowUI.toggle）から閉じられた場合も、必ず swallow を立てる
    close() {
        this.swallowUntil = Date.now() + 80;
        super.close();
    }
}
