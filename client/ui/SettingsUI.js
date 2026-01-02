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

        // 即時反映が必要なものがあればここで処理
        // (例: 音量など)
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
        const height = 250;
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
        closeBtn.on('pointerdown', () => this.toggle());
        this.container.add(closeBtn);

        // --- 設定項目 ---

        // 1. Log UI Toggle
        this.logCheckbox = this.createCheckbox(0, -30, 'Show Log UI', this.settings.showLog, (val) => {
            this.settings.showLog = val;
            this.applySettings();
        });
        this.container.add(this.logCheckbox.container);

        // (将来的に音量スライダーなどもここに追加)
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

        const hitArea = this.scene.add.rectangle(0, 0, 200, 30).setInteractive();

        hitArea.on('pointerdown', () => {
            checked = !checked;
            checkMark.setVisible(checked);
            onChange(checked);
        });

        container.add([hitArea, box, checkMark, text]);

        return { container, setChecked: (v) => { checked = v; checkMark.setVisible(v); } };
    }

    show() {
        this.container.setVisible(true);
        // 設定値に合わせてUI更新
        this.logCheckbox.setChecked(this.settings.showLog);
    }

    hide() {
        this.container.setVisible(false);
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
