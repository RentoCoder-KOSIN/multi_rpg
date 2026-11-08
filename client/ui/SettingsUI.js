import { UI_FONT } from '../fontConfig.js';
import { pinToScreen } from '../utils/screenFixed.js';
import { getSession, logout, flushSave, exportAccountJson } from '../utils/saveStore.js';
export default class SettingsUI {
    constructor(scene) {
        this.scene = scene;
        this.visible = false;
        this.initSettings();
        this.createUI();
    }

    initSettings() {
        // 設定をロード (なければデフォルト)
        const saved = JSON.parse(localStorage.getItem('gameSettings')) || {};
        this.settings = {
            bgmVolume: saved.bgmVolume || 0.5,
            seVolume: saved.seVolume || 0.5,
            // パーティクル/カメラシェイクなどの視覚エフェクト。重い場合はOFFでラグを軽減できる
            effectsEnabled: saved.effectsEnabled !== undefined ? saved.effectsEnabled : true,
            // パーティメンバーのエフェクト表示共有（パーティ間のみ、オンオフ切替可能）
            partyEffectsEnabled: saved.partyEffectsEnabled !== undefined ? saved.partyEffectsEnabled : true,
            // 低スペックPC向け軽量化モード（パーティクル削減・環境演出OFF等）
            lowSpecMode: saved.lowSpecMode !== undefined ? saved.lowSpecMode : false
        };
        // レジストリにも反映して他のコンポーネントがアクセスできるようにする
        this.applySettings();
    }

    applySettings() {
        this.scene.registry.set('settings', this.settings);
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    }

    toggle() {
        this.visible = !this.visible;
        if (this.visible) {
            this.show();
        } else {
            this.hide();
        }
    }

    createUI() {
        const width = 310;
        const height = 430;
        const x = this.scene.scale.width / 2;
        const y = this.scene.scale.height / 2;

        this.container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(3000).setVisible(false);
        pinToScreen(this.container);

        // 背景
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.9);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
        bg.lineStyle(2, 0xffffff, 0.8);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
        this.container.add(bg);

        // タイトル
        const title = this.scene.add.text(0, -height / 2 + 20, 'SETTINGS', {
            fontSize: '18px',
            fontFamily: UI_FONT,
            color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(title);

        // 閉じるボタン
        const closeBtn = this.scene.add.text(width / 2 - 20, -height / 2 + 20, 'X', {
            fontSize: '18px',
            color: '#ff0000',
            fontFamily: UI_FONT
        }).setOrigin(0.5).setInteractive();
        closeBtn.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();
            this.toggle();
        });
        this.container.add(closeBtn);

        // --- 設定項目 ---

        // 1. Effects Toggle (自エフェクト表示)
        this.effectsCheckbox = this.createCheckbox(0, -145, 'Effects (自エフェクト)', this.settings.effectsEnabled, (val) => {
            this.settings.effectsEnabled = val;
            this.applySettings();
        });
        this.container.add(this.effectsCheckbox.container);

        // 2. Party Effects Toggle (パーティメンバーのエフェクト表示共有)
        this.partyEffectsCheckbox = this.createCheckbox(0, -110, 'Party Effects (PTエフェクト)', this.settings.partyEffectsEnabled, (val) => {
            this.settings.partyEffectsEnabled = val;
            this.applySettings();
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`PTエフェクト表示: ${val ? 'ON' : 'OFF'}`, 'info');
            }
        });
        this.container.add(this.partyEffectsCheckbox.container);

        // 3. Low-Spec Mode Toggle (低スペックPC向け軽量化モード)
        this.lowSpecCheckbox = this.createCheckbox(0, -75, 'Low-Spec Mode (低スペック軽量化)', this.settings.lowSpecMode, (val) => {
            this.settings.lowSpecMode = val;
            this.applySettings();
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`軽量化モード: ${val ? 'ON (軽量描画)' : 'OFF'}`, 'info');
            }
        });
        this.container.add(this.lowSpecCheckbox.container);

        // 4. AI Training Toggle
        this.aiCheckbox = this.createCheckbox(0, -40, 'AI Training (AI学習)', this.scene.aiTrainingEnabled, (val) => {
            this.scene.aiTrainingEnabled = val;
            const mode = val ? 'ON' : 'OFF';
            const enemies = this.scene.networkManager?.getEnemies() || {};
            Object.values(enemies).forEach(enemy => {
                if (enemy.ai) enemy.ai.setTrainingMode(val);
            });
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`AI Training: ${mode}`, 'info');
            }
        });
        this.container.add(this.aiCheckbox.container);

        // 5. Reset AI Button
        const resetBtn = this.createButton(0, 5, 'RESET AI DATA', 0xcc0000, () => {
            const confirmReset = confirm('全モンスターの学習記録をリセットしますか？\nAIが初期状態に戻ります。');
            if (confirmReset) {
                // localStorageの削除
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('enemyAI_')) {
                        localStorage.removeItem(key);
                    }
                });

                // 現在の敵AIをリセット
                const enemies = this.scene.networkManager?.getEnemies() || {};
                Object.values(enemies).forEach(enemy => {
                    if (enemy.ai && enemy.ai.agent) {
                        enemy.ai.agent.qTable = new Map();
                        enemy.ai.agent.episodeCount = 0;
                        enemy.ai.agent.totalReward = 0;
                        enemy.ai.agent.epsilon = 0.5;
                    }
                });

                if (this.scene.notificationUI) {
                    this.scene.notificationUI.show('AI Data Reset Complete', 'warning');
                }
            }
        });
        this.container.add(resetBtn);

        // 6. セーブ保存 (JSONダウンロード)
        const saveBtn = this.createButton(0, 50, 'SAVE & EXPORT (JSON)', 0x2ecc40, async () => {
            try {
                await flushSave();
                const res = exportAccountJson();
                if (res && this.scene.notificationUI) {
                    this.scene.notificationUI.show('セーブデータをJSON保存しました', 'success');
                }
            } catch (err) {
                console.warn('save error', err);
                if (this.scene.notificationUI) {
                    this.scene.notificationUI.show('保存に失敗しました', 'warning');
                }
            }
        });
        this.container.add(saveBtn);

        // 7. ログアウト
        const accountName = getSession()?.username || '';
        const logoutBtn = this.createButton(0, 95, `LOGOUT (${accountName.slice(0, 8)})`, 0x2c5aa0, () => {
            if (!confirm('ログアウトしますか？\n（事前に「SAVE & EXPORT」でバックアップを保存できます）')) return;
            flushSave(true);
            logout();
            window.location.reload();
        });
        this.container.add(logoutBtn);
    }

    createCheckbox(x, y, label, initialValue, onChange) {
        const container = this.scene.add.container(x, y);
        let checked = initialValue;

        const box = this.scene.add.rectangle(-60, 0, 20, 20).setStrokeStyle(2, 0xffffff);
        const checkMark = this.scene.add.text(-60, 0, 'X', { fontSize: '14px', color: '#00ff00' }).setOrigin(0.5).setVisible(checked);

        const text = this.scene.add.text(-40, 0, label, {
            fontSize: '14px',
            fontFamily: UI_FONT,
            color: '#ffffff'
        }).setOrigin(0, 0.5);

        const hitArea = this.scene.add.rectangle(0, 0, 240, 35, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        hitArea.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();
            checked = !checked;
            checkMark.setVisible(checked);
            onChange(checked);
        });

        container.add([hitArea, box, checkMark, text]);
        return { container, setChecked: (v) => { checked = v; checkMark.setVisible(v); } };
    }

    createButton(x, y, label, color, onClick) {
        const container = this.scene.add.container(x, y);
        const width = 220;
        const height = 35;

        const bg = this.scene.add.rectangle(0, 0, width, height, color, 1)
            .setInteractive({ useHandCursor: true });

        const text = this.scene.add.text(0, 0, label, {
            fontSize: '12px',
            fontFamily: UI_FONT,
            color: '#ffffff'
        }).setOrigin(0.5);

        bg.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();
            bg.setFillStyle(0x555555);
            onClick();
        });
        bg.on('pointerup', () => bg.setFillStyle(color));

        container.add([bg, text]);
        return container;
    }

    show() {
        this.container.setVisible(true);
        if (this.effectsCheckbox) this.effectsCheckbox.setChecked(this.settings.effectsEnabled);
        if (this.partyEffectsCheckbox) this.partyEffectsCheckbox.setChecked(this.settings.partyEffectsEnabled);
        if (this.lowSpecCheckbox) this.lowSpecCheckbox.setChecked(this.settings.lowSpecMode);
        if (this.aiCheckbox) this.aiCheckbox.setChecked(this.scene.aiTrainingEnabled);
    }

    hide() {
        this.container.setVisible(false);
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
