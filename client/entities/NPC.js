import { UI_FONT } from '../fontConfig.js';
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
                fontFamily: UI_FONT,
                fontSize: '16px',
                color: '#ffff00'
            }
        ).setOrigin(0.5);

        this.questId = null;
    }

    updateQuestIcon(qm) {
        if (!this.questId) {
            if (this.questIcon.text !== '') this.questIcon.setText('');
            return;
        }

        let newText = '';
        if (qm.isFinished(this.questId)) {
            newText = ''; // 報告済み
        } else if (qm.isCompleted(this.questId)) {
            newText = '！'; // 完了報告
        } else if (!qm.isStarted(this.questId)) {
            newText = '？'; // 未受注
        }

        if (this.questIcon.text !== newText) {
            this.questIcon.setText(newText);
        }
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);

        if (this.questIcon) {
            this.questIcon.setPosition(this.x, this.y - 32);
        }
    }
}
