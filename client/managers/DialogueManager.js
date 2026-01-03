import { JOBS } from "../data/jobs.js";
import { QUESTS } from "../data/quests.js";


export default class DialogueManager {
    constructor(scene) {
        this.scene = scene;
        this.isTalking = false;
        this.currentNPC = null;

        const width = 700;
        const height = 180;
        const sceneWidth = scene.scale.width;
        const sceneHeight = scene.scale.height;
        const centerX = sceneWidth / 2;
        const centerY = sceneHeight - height / 2 - 20;

        // 背景ウィンドウ
        this.chatBoxBg = scene.add.rectangle(centerX, centerY, width, height, 0x1a1a2e, 0.95)
            .setOrigin(0.5).setVisible(false).setStrokeStyle(3, 0x4a90e2, 1);
        this.chatBoxInner = scene.add.rectangle(centerX, centerY, width - 6, height - 6, 0x0f3460, 0.8)
            .setOrigin(0.5).setVisible(false);
        this.nameBox = scene.add.rectangle(centerX - width / 2 + 80, centerY - height / 2 + 15, 160, 30, 0x4a90e2, 1)
            .setOrigin(0, 0).setVisible(false).setStrokeStyle(2, 0xffffff, 1);
        this.nameText = scene.add.text(centerX - width / 2 + 90, centerY - height / 2 + 20, '', {
            fontFamily: 'Press Start 2P', fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 2
        }).setVisible(false);
        this.chatText = scene.add.text(centerX - width / 2 + 30, centerY - height / 2 + 55, '', {
            fontFamily: 'Press Start 2P', fontSize: '14px', color: '#ffffff', wordWrap: { width: width - 60 }, lineSpacing: 8
        }).setVisible(false);
        this.continueText = scene.add.text(centerX + width / 2 - 100, centerY + height / 2 - 35, 'SPACE で続ける', {
            fontFamily: 'Press Start 2P', fontSize: '10px', color: '#4a90e2'
        }).setOrigin(0.5).setVisible(false);
        this.choiceText = scene.add.text(centerX, centerY + height / 2 - 40, '[Y] はい  /  [N] いいえ', {
            fontFamily: 'Press Start 2P', fontSize: '14px', color: '#ffff00', stroke: '#000000', strokeThickness: 3
        }).setOrigin(0.5).setVisible(false);

        // スクロール固定
        [this.chatBoxBg, this.chatBoxInner, this.nameBox, this.nameText,
        this.chatText, this.continueText, this.choiceText].forEach(obj => obj.setScrollFactor(0));

        this.showNextLine = null;
        this.choiceHandler = null;
        this.typewriterText = '';
        this.typewriterIndex = 0;
        this.typewriterTimer = null;
    }

    startDialogue(npc) {
        if (this.isTalking) return;
        this.isTalking = true;
        this.currentNPC = npc;
        npc.talking = true;

        this.showDialogueUI();
        this.nameText.setText(npc.name || 'NPC');
        this.nameText.setVisible(true);
        this.nameBox.setVisible(true);

        const qm = this.scene.questManager;
        let questId = npc.questId ? String(npc.questId).trim() : null;

        // クエストチェーンを追跡：報告済みなら次のクエストを対象にする
        if (questId && qm.isFinished(questId)) {
            let nextId = QUESTS[questId]?.nextQuest;
            while (nextId && qm.isFinished(nextId)) {
                nextId = QUESTS[nextId]?.nextQuest;
            }
            if (nextId) {
                console.log(`[Dialogue] Following chain from ${questId} to ${nextId}`);
                questId = nextId;
            }
        }

        // --- クエスト受注 ---
        if (questId && !qm.isStarted(questId) && !qm.isCompleted(questId) && !qm.isFinished(questId)) {
            const questDef = qm.scene.cache.json.get('quests')?.[questId] || QUESTS[questId];
            if (questDef) {
                const title = questDef.title || questId;
                this.startTypewriter(`クエスト「${title}」を受けますか？ y/n`);
                this.choiceText.setVisible(true);

                this.choiceHandler = (event) => {
                    const key = event.key.toLowerCase();
                    if (key === 'y') {
                        qm.startQuest(questId);
                        this.showSystemMessage(`クエスト「${title}」を受注しました！`);
                        if (this.scene.notificationUI) this.scene.notificationUI.show(`クエスト「${title}」を受注しました！`, 'success');
                    } else if (key === 'n') {
                        this.showSystemMessage(`クエスト「${title}」をキャンセルしました。`);
                    } else return;

                    this.choiceText.setVisible(false);
                    this.scene.input.keyboard.off('keydown', this.choiceHandler);
                    this.isTalking = false;
                    npc.talking = false;
                    this.currentNPC = null;
                };
                this.scene.input.keyboard.on('keydown', this.choiceHandler);
                return;
            }
        }

        // --- クエスト報告 ---
        if (questId) {
            const isComp = qm.isCompleted(questId);
            const isFin = qm.isFinished(questId);
            const isStart = qm.isStarted(questId);
            console.log(`[Dialogue] Checking reporting for NPC with questId: ${questId}. status: start=${isStart}, completed=${isComp}, finished=${isFin}`);

            if (isComp) {
                const quest = qm.quests[questId];
                const title = quest?.title || questId;
                this.startTypewriter(`クエスト「${title}」を報告しますか？ y/n`);
                this.choiceText.setVisible(true);

                this.choiceHandler = (event) => {
                    const key = event.key.toLowerCase();
                    if (key === 'y') {
                        qm.finishQuest(questId);
                        this.scene.teleports.forEach(tp => { if (tp.requiredQuest === questId) tp.unlocked = true; });
                        this.showSystemMessage(`クエスト「${title}」を報告しました！`);
                        if (this.scene.notificationUI) this.scene.notificationUI.show(`クエスト「${title}」を完了しました！`, 'success');
                    } else if (key === 'n') {
                        this.showSystemMessage(`報告をキャンセルしました`);
                    } else return;

                    this.choiceText.setVisible(false);
                    this.scene.input.keyboard.off('keydown', this.choiceHandler);
                    this.isTalking = false;
                    npc.talking = false;
                    this.currentNPC = null;
                };
                this.scene.input.keyboard.on('keydown', this.choiceHandler);
                return;
            }
        }

        // 報告済みの場合
        const isTutorial = this.scene.currentMapKey === 'tutorial';
        const level = this.scene.player?.stats?.level || 0;
        const canReselect = isTutorial && level <= 10 && (npc.jobs || npc.jobQuest);

        if (npc.questId && qm.isFinished(npc.questId) && !canReselect) {
            const data = { name: npc.name, dialogue: [`クエスト「${npc.questId}」は達成済みだよ。さらに修行を積んでね！`] };
            this.startTypewriter(`${data.name}: ${data.dialogue[0]}`);
            this.scene.time.delayedCall(2000, () => {
                this.hideDialogueUI();
                this.isTalking = false;
                npc.talking = false;
                this.currentNPC = null;
            });
            return;
        }

        // --- 転職 ---
        if (npc.jobQuest && JOBS[npc.jobQuest]) {
            const job = JOBS[npc.jobQuest];
            const reselectMsg = (canReselect && qm.isFinished(npc.questId)) ? "【職業再選択】\n" : "";
            this.startTypewriter(`${reselectMsg}職業を「${job.name}」に変更しますか？ y/n`);
            this.choiceText.setVisible(true);

            this.choiceHandler = (event) => {
                const key = event.key.toLowerCase();
                if (key === 'y') {
                    this.scene.player.setJob(npc.jobQuest);
                    this.showSystemMessage(`職業を「${job.name}」に変更しました！`);
                } else if (key === 'n') {
                    this.showSystemMessage('転職をやめました。');
                } else return;

                this.choiceText.setVisible(false);
                this.scene.input.keyboard.off('keydown', this.choiceHandler);
                this.isTalking = false;
                npc.talking = false;
                this.currentNPC = null;
            };
            this.scene.input.keyboard.on('keydown', this.choiceHandler);
            return;
        }

        // --- 職業選択メニュー ---
        if (npc.jobs) {
            // 基本職業のみ（reqLevelが設定されていないもの）を抽出
            const jobList = Object.values(JOBS).filter(job => !job.reqLevel);
            let jobText = (canReselect && qm.isFinished(npc.questId))
                ? "【職業再選択】チュートリアル中なので何度でも変更可能です。\nどの職業になりますか？\n"
                : "どの職業になりますか？\n";
            jobList.forEach((job, i) => {
                jobText += `[${i + 1}] ${job.name} `;
            });

            this.startTypewriter(jobText);
            this.choiceText.setText('数字キーで選択 (1-' + jobList.length + ') その他でキャンセル');
            this.choiceText.setVisible(true);

            this.choiceHandler = (event) => {
                const key = event.key;
                const index = parseInt(key) - 1;

                if (index >= 0 && index < jobList.length) {
                    const selectedJob = jobList[index];
                    const player = this.scene.player;

                    player.setJob(selectedJob.id);

                    // 初期装備の付与
                    const jobWeapons = {
                        'fighter': 'beginner_sword',
                        'mage': 'beginner_staff',
                        'tank': 'iron_shield',
                        'ranger': 'wooden_bow',
                        'summoner': 'beginner_staff'
                    };
                    const weaponId = jobWeapons[selectedJob.id];
                    if (weaponId) {
                        player.addItem(weaponId);
                        player.equipItem(weaponId);
                    }

                    // クエスト「choose_job」の完了
                    if (this.scene.questManager.isStarted('choose_job')) {
                        this.scene.questManager.completeQuest('choose_job');
                    }

                    this.showSystemMessage(`職業を「${selectedJob.name}」に変更しました！`);
                } else {
                    this.showSystemMessage('職業選択をキャンセルしました。');
                }

                this.choiceText.setVisible(false);
                this.choiceText.setText('[Y] はい  /  [N] いいえ'); // 元に戻す
                this.scene.input.keyboard.off('keydown', this.choiceHandler);
                this.isTalking = false;
                npc.talking = false;
                this.currentNPC = null;
            };
            this.scene.input.keyboard.on('keydown', this.choiceHandler);
            return;
        }

        // --- 通常会話 ---
        let index = 0;
        const data = { name: npc.name, dialogue: npc.dialogue };

        this.showNextLine = () => {
            if (index < data.dialogue.length) {
                this.startTypewriter(`${data.name}: ${data.dialogue[index]}`);
                index++;
            } else {
                this.hideDialogueUI();
                this.scene.input.keyboard.off('keydown-SPACE', this.showNextLine);
                this.isTalking = false;
                npc.talking = false;
                this.currentNPC = null;
            }
        };

        this.showNextLine();
        this.scene.input.keyboard.on('keydown-SPACE', this.showNextLine);
    }

    showDialogueUI() {
        [this.chatBoxBg, this.chatBoxInner, this.chatText, this.continueText].forEach(obj => {
            obj.setVisible(true);
            obj.setAlpha(1);
        });
        this.chatBoxBg.setAlpha(0);
        this.chatBoxInner.setAlpha(0);
        this.scene.tweens.add({ targets: [this.chatBoxBg, this.chatBoxInner], alpha: { from: 0, to: 1 }, duration: 300, ease: 'Power2' });
        this.scene.tweens.add({ targets: this.continueText, alpha: { from: 0.3, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    }

    hideDialogueUI() {
        this.scene.tweens.add({
            targets: [this.chatBoxBg, this.chatBoxInner, this.nameBox, this.nameText, this.chatText, this.continueText, this.choiceText],
            alpha: 0,
            duration: 200,
            onComplete: () => {
                [this.chatBoxBg, this.chatBoxInner, this.nameBox, this.nameText, this.chatText, this.continueText, this.choiceText]
                    .forEach(obj => obj.setVisible(false));
            }
        });
    }

    startTypewriter(text) {
        if (this.typewriterTimer) this.scene.time.removeEvent(this.typewriterTimer);

        this.typewriterText = text;
        this.typewriterIndex = 0;
        this.chatText.setText('');
        this.chatText.setVisible(true);

        this.typewriterTimer = this.scene.time.addEvent({
            delay: 30,
            callback: () => {
                if (this.typewriterIndex < this.typewriterText.length) {
                    this.chatText.setText(this.typewriterText.substring(0, this.typewriterIndex + 1));
                    this.typewriterIndex++;
                } else {
                    this.scene.time.removeEvent(this.typewriterTimer);
                    this.typewriterTimer = null;
                }
            },
            loop: true
        });
    }

    showSystemMessage(text) {
        this.isTalking = true;
        this.showDialogueUI();
        this.nameText.setText('システム');
        this.nameText.setVisible(true);
        this.nameBox.setVisible(true);
        this.continueText.setVisible(false);
        this.startTypewriter(text);

        this.scene.time.delayedCall(2000, () => {
            this.hideDialogueUI();
            this.isTalking = false;
        });
    }
}
