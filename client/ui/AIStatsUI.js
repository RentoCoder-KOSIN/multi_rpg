/**
 * AI Stats UI - 敵AIの学習状況を表示
 */
export default class AIStatsUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.visible = false;
        this.createUI();
    }

    createUI() {
        const gameWidth = this.scene.scale.gameSize ? this.scene.scale.gameSize.width : this.scene.scale.width;
        const gameHeight = this.scene.scale.gameSize ? this.scene.scale.gameSize.height : this.scene.scale.height;

        // コンテナ
        this.container = this.scene.add.container(10, gameHeight - 150);
        this.container.setScrollFactor(0);
        this.container.setDepth(1000);
        this.container.setVisible(false);

        // 背景
        this.bg = this.scene.add.rectangle(0, 0, 250, 140, 0x000000, 0.8);
        this.bg.setOrigin(0, 0);
        this.bg.setStrokeStyle(2, 0x00ff00);
        this.container.add(this.bg);

        // タイトル
        this.titleText = this.scene.add.text(10, 10, 'AI Learning Stats', {
            fontSize: '12px',
            color: '#00ff00',
            fontFamily: 'Press Start 2P'
        });
        this.container.add(this.titleText);

        // 統計テキスト
        this.statsText = this.scene.add.text(10, 35, '', {
            fontSize: '9px',
            color: '#ffffff',
            fontFamily: 'Press Start 2P',
            lineSpacing: 5
        });
        this.container.add(this.statsText);

        // トグルキー (Shift+A)
        this.scene.input.keyboard.on('keydown-A', (event) => {
            if (event.shiftKey) {
                this.toggle();
            }
        });

        // 更新タイマー
        this.scene.time.addEvent({
            delay: 1000,
            callback: () => this.updateStats(),
            loop: true
        });
    }

    toggle() {
        this.visible = !this.visible;
        this.container.setVisible(this.visible);
        if (this.visible) {
            this.updateStats();
        }
    }

    updateStats() {
        if (!this.visible) return;

        // クライアント側で認識している全ての敵タイプ
        const enemyTypes = ['slime', 'bat', 'forest_slime', 'skeleton', 'red_slime', 'goblin', 'ghost', 'orc', 'dire_wolf', 'boss', 'dragon_boss'];

        let totalEpisodes = 0;
        let totalQSize = 0;
        let avgEpsilon = 0;
        let avgReward = 0;
        let typesCount = 0;

        enemyTypes.forEach(type => {
            const data = localStorage.getItem(`enemyAI_${type}`);
            if (data) {
                const stats = JSON.parse(data);
                totalEpisodes += stats.episodeCount || 0;
                totalQSize += (stats.qTable ? stats.qTable.length : 0);
                avgEpsilon += stats.epsilon || 0;
                avgReward += (stats.totalReward / (stats.episodeCount || 1)) || 0;
                typesCount++;
            }
        });

        if (typesCount > 0) {
            avgEpsilon /= typesCount;
            avgReward /= typesCount;
        }

        // 現在の画面内のAI敵の数
        const activeEnemies = Object.values(this.scene.networkManager?.getEnemies() || {}).filter(e => e.ai && e.active).length;

        const text = [
            `--- AI GLOBAL STATS ---`,
            `Total Deaths (Episodes): ${totalEpisodes}`,
            `Global Avg Epsilon: ${avgEpsilon.toFixed(3)}`,
            `Global Avg Reward: ${avgReward.toFixed(2)}`,
            `Global Q-Table States: ${totalQSize}`,
            ``,
            `--- LOCAL STATS ---`,
            `Active AI on Screen: ${activeEnemies}`,
            `Training: ${this.scene.aiTrainingEnabled ? 'ON' : 'OFF'}`,
            ``,
            `Press Shift+T to toggle training`
        ].join('\n');

        this.statsText.setText(text);
    }

    destroy() {
        if (this.container) {
            this.container.destroy();
        }
    }
}
