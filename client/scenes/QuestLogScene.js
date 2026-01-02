export default class QuestLogScene extends Phaser.Scene {
    constructor() {
        super('QuestLog');
    }

    create() {
        this.questManager = this.registry.get('questManager');

        this.add.rectangle(0, 0, 400, 300, 0x000000, 0.85)
            .setOrigin(0);

        let y = 20;

        this.questManager.getActiveQuests().forEach(q => {
            const text =
`${q.title}
${q.description}
${q.progress}/${q.required}
状態: ${q.status}`;

            this.add.text(20, y, text, {
                fontSize: '14px',
                color: '#ffffff'
            });

            y += 90;
        });

        this.input.keyboard.once('keydown-Q', () => {
            this.scene.stop();
        });
    }
}
