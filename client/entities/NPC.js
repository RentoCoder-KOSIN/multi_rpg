export default class NPC extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture = 'npc') {
        super(scene, x, y, texture);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setImmovable(true);

        // ★ クエスト状態アイコン
        this.questIcon = scene.add.text(
            this.x,
            this.y - 32,
            '',
            {
                fontFamily: 'Press Start 2P',
                fontSize: '16px',
                color: '#ffff00'
            }
        ).setOrigin(0.5);

        this.questId = null;
    }

    updateQuestIcon(qm) {
        if (!this.questId) {
            this.questIcon.setText('');
            return;
        }

        if (qm.isFinished(this.questId)) {
            this.questIcon.setText(''); // 報告済み
        } else if (qm.isCompleted(this.questId)) {
            this.questIcon.setText('！'); // 完了報告
        } else if (!qm.isStarted(this.questId)) {
            this.questIcon.setText('？'); // 未受注
        } else {
            this.questIcon.setText(''); // 進行中
        }
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);

        if (this.questIcon) {
            this.questIcon.setPosition(this.x, this.y - 32);
        }
    }
}
