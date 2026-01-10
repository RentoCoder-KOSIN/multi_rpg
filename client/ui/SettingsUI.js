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
            showLog: saved.showLog !== undefined ? saved.showLog : true,
            bgmVolume: saved.bgmVolume || 0.5,
            seVolume: saved.seVolume || 0.5
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
        const width = 300;
        const height = 300;
        const x = this.scene.scale.width / 2;
        const y = this.scene.scale.height / 2;

        this.container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(3000).setVisible(false);

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
            fontFamily: '"Press Start 2P"',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(title);

        // 閉じるボタン
        const closeBtn = this.scene.add.text(width / 2 - 20, -height / 2 + 20, 'X', {
            fontSize: '18px',
            color: '#ff0000',
            fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5).setInteractive();
        closeBtn.on('pointerdown', (pointer, localX, localY, event) => {
            if (event) event.stopPropagation();
            this.toggle();
        });
        this.container.add(closeBtn);

        // --- 設定項目 ---

        // 1. Log UI Toggle
        this.logCheckbox = this.createCheckbox(0, -60, 'Show Log UI', this.settings.showLog, (val) => {
            this.settings.showLog = val;
            this.applySettings();
        });
        this.container.add(this.logCheckbox.container);

        // 2. AI Training Toggle
        this.aiCheckbox = this.createCheckbox(0, -20, 'AI Training', this.scene.aiTrainingEnabled, (val) => {
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

        // 3. Reset AI Button
        const resetBtn = this.createButton(0, 60, 'RESET AI DATA', 0xcc0000, () => {
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
    }

    createCheckbox(x, y, label, initialValue, onChange) {
        const container = this.scene.add.container(x, y);
        let checked = initialValue;

        const box = this.scene.add.rectangle(-60, 0, 20, 20).setStrokeStyle(2, 0xffffff);
        const checkMark = this.scene.add.text(-60, 0, 'X', { fontSize: '14px', color: '#00ff00' }).setOrigin(0.5).setVisible(checked);

        const text = this.scene.add.text(-40, 0, label, {
            fontSize: '14px',
            fontFamily: '"Press Start 2P"',
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
            fontFamily: '"Press Start 2P"',
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
        this.logCheckbox.setChecked(this.settings.showLog);
        if (this.aiCheckbox) this.aiCheckbox.setChecked(this.scene.aiTrainingEnabled);
    }

    hide() {
        this.container.setVisible(false);
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
