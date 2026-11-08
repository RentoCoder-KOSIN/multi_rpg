import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from './BaseWindowUI.js';

/**
 * 初心者向け操作ガイド & キー一覧ウィンドウ
 */
export default class KeyGuideWindowUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '📖 初心者操作ガイド & キー一覧',
            width: 720,
            height: 560,
            depth: 140000,
            themeColor: 0x4a90e2,
            titleStroke: 0x2266aa,
        });
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const W = this.config.width;
        const H = this.config.height;

        const colW = (W - 60) / 2;
        const leftX = -W / 2 + 25;
        const rightX = 5;
        const startY = -H / 2 + 50;

        // --- 左列: 基本操作 & アクション ---
        this._renderSection('🎮 基本操作 & 戦闘', leftX, startY, colW, [
            { key: '矢印 / WASD', label: 'キャラクターの移動' },
            { key: 'SPACE',       label: '通常攻撃（長押しで範囲確認）' },
            { key: '1 〜 8',     label: 'スキル使用 / クイックアイテム' },
            { key: 'C',          label: 'NPCと会話 / 宝箱を開ける' },
            { key: 'M',          label: 'サイドメニュー開閉' },
            { key: 'ESC',        label: '開いている画面を閉じる' },
            { key: 'H',          label: 'このヘルプ画面を開閉' },
        ]);

        // --- 右列: メニューショートカット ---
        this._renderSection('📋 メニューショートカット', rightX, startY, colW, [
            { key: 'I', label: '持ち物（インベントリ）' },
            { key: 'S', label: '装備画面' },
            { key: 'P', label: 'ステータス割り振り（能力強化）' },
            { key: 'K', label: 'スキル管理（習得・強化・セット）' },
            { key: 'Q', label: 'クエスト履歴・一覧' },
            { key: 'U', label: '実績 & 称号（頭上にセット）' },
            { key: 'R', label: '輪廻転生画面（Lv100到達時）' },
            { key: 'V', label: 'パーティ管理画面' },
            { key: 'T', label: 'チャット画面' },
            { key: 'O', label: 'ゲーム設定' },
        ]);

        // --- 下部: 初心者向け序盤の手引き ---
        const tipY = H / 2 - 145;
        const tipBg = this.scene.add.graphics();
        tipBg.fillStyle(0x0f2038, 0.95);
        tipBg.fillRoundedRect(-W / 2 + 25, tipY, W - 50, 125, 8);
        tipBg.lineStyle(1, 0x4a90e2, 0.8);
        tipBg.strokeRoundedRect(-W / 2 + 25, tipY, W - 50, 125, 8);
        this.container.add(tipBg);

        const tipHeader = this.scene.add.text(-W / 2 + 40, tipY + 10, '💡 初心者アドバイス（序盤の進め方）', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffd700'
        });
        const tipText = [
            '1. まずは街の「ギルド」に行き、NPCに話しかけて【基本職】に就職しよう！',
            '2. 敵を倒してレベルが上がったら [P] でステータスを割り振り、[K] で新スキルを解放！',
            '3. 装備が手に入ったら街の【鍛冶屋】で強化石を使って武器や防具を強化 (+1〜+15) しよう！',
            '4. 他のプレイヤーに遭遇したら [M] メニューの [🤝 Trd] からアイテム交換もできるよ！'
        ].join('\n');
        const tipBody = this.scene.add.text(-W / 2 + 40, tipY + 30, tipText, {
            fontSize: '11px', fontFamily: UI_FONT, color: '#cfe3ff', lineSpacing: 5
        });
        this.container.add([tipHeader, tipBody]);
    }

    _renderSection(title, x, y, width, items) {
        const header = this.scene.add.text(x, y, title, {
            fontSize: '12px', fontFamily: UI_FONT, color: '#ffaa44'
        });
        this.container.add(header);

        let rowY = y + 22;
        items.forEach(item => {
            const rowBg = this.scene.add.graphics();
            rowBg.fillStyle(0x1a263a, 0.5);
            rowBg.fillRoundedRect(x, rowY, width, 22, 4);
            this.container.add(rowBg);

            // キーバッジ
            const badgeBg = this.scene.add.rectangle(x + 40, rowY + 11, 70, 16, 0x2a3e5c)
                .setStrokeStyle(1, 0x6699cc);
            const badgeTxt = this.scene.add.text(x + 40, rowY + 11, `[${item.key}]`, {
                fontSize: '9px', fontFamily: UI_FONT, color: '#ffffff'
            }).setOrigin(0.5);

            // 説明
            const labelTxt = this.scene.add.text(x + 85, rowY + 11, item.label, {
                fontSize: '10px', fontFamily: UI_FONT, color: '#e0e0e0'
            }).setOrigin(0, 0.5);

            this.container.add([badgeBg, badgeTxt, labelTxt]);
            rowY += 25;
        });
    }
}
