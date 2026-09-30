// 初回プレイ中に、各ウィンドウを「何のために開くのか」まで示す常駐ガイド。
// クエストを増やして操作を強制するのではなく、好きな順番で試せるようにする。
export default class TutorialGuideUI {
    constructor(scene) {
        this.scene = scene;
        this.container = scene.add.container(0, 0)
            .setScrollFactor(0)
            .setDepth(290000);

        const { width } = scene.scale;
        const panelWidth = Math.min(410, width - 24);
        const x = width - panelWidth / 2 - 12;
        const y = 98;
        this.container.setPosition(x, y + 14);

        const bg = scene.add.graphics();
        bg.fillStyle(0x081225, 0.9);
        bg.fillRoundedRect(-panelWidth / 2, -66, panelWidth, 132, 8);
        bg.lineStyle(2, 0x4a90e2, 0.9);
        bg.strokeRoundedRect(-panelWidth / 2, -66, panelWidth, 132, 8);

        this.title = scene.add.text(-panelWidth / 2 + 12, -57, 'はじめてガイド', {
            fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#ffd700'
        });
        this.body = scene.add.text(-panelWidth / 2 + 12, -39, '', {
            fontSize: '8px', fontFamily: '"Press Start 2P"', color: '#ffffff',
            lineSpacing: 5, wordWrap: { width: panelWidth - 24 }
        });
        this.container.add([bg, this.title, this.body]);

        this.refresh();
        this.unsubscribe = scene.questManager?.onUpdate(() => this.refresh(), scene);
        scene.events.once('shutdown', () => this.destroy());
        scene.events.once('destroy', () => this.destroy());
    }

    refresh() {
        const qm = this.scene.questManager;
        const killComplete = qm?.isCompleted('kill_slime') || qm?.isFinished('kill_slime');
        const jobComplete = qm?.isCompleted('choose_job') || qm?.isFinished('choose_job');

        if (killComplete) {
            this.title.setText('次の目的: 戦場へ');
            this.body.setText('水色の「次は 戦場へ」矢印を追い、\n転移陣に入ろう。転移後は弱いボスで練習！');
            return;
        }

        const firstLine = jobComplete
            ? '初期報酬を使って、各メニューを試してみよう。'
            : 'まずは [C] で職業管理人と話し、職業を選ぼう。';
        this.title.setText('はじめてガイド');
        this.body.setText(`${firstLine}\n職業決定で SP 5 / Job EXP 300 / 火の玉を受け取れる\n[P] 能力値を割り振る  [K] スキルを解放→1〜8でセット\n[I] 装備を選んでEnter  [E] 鍛冶屋で火の玉を付与\n属性: 火→土→風→雷→水→火 / 光⇔闇`);
    }

    destroy() {
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = null;
        if (this.container) this.container.destroy();
        this.container = null;
    }
}
