import BaseWindowUI from "./BaseWindowUI.js";

export default class PartyUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: 'Party',
            width: 500,
            height: 400
        });
        this.partyData = null;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this.listContainer = this.scene.add.container(0, 0);
        this.container.add(this.listContainer);

        // 招待入力エリア
        const inviteLabel = this.scene.add.text(-220, 140, 'Invite Player ID:', {
            fontSize: '14px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        });
        this.container.add(inviteLabel);

        // 簡易的なID表示（自分）
        this.myIdText = this.scene.add.text(-220, 170, `Your ID: ${this.scene.networkManager.getPlayerId()}`, {
            fontSize: '10px', color: '#aaaaaa', fontFamily: '"Press Start 2P"'
        });
        this.container.add(this.myIdText);

        // 招待ボタン
        this.inviteBtn = this.scene.add.container(100, 150);
        const btnBg = this.scene.add.rectangle(0, 0, 140, 35, 0x4a90e2).setInteractive({ useHandCursor: true });
        const btnText = this.scene.add.text(0, 0, 'INVITE', {
            fontSize: '14px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.inviteBtn.add([btnBg, btnText]);
        this.container.add(this.inviteBtn);

        btnBg.on('pointerdown', () => {
            const id = prompt("Enter Player ID to Invite:");
            if (id && id.trim()) {
                this.scene.networkManager.inviteToParty(id.trim());
                if (this.scene.notificationUI) this.scene.notificationUI.show(`Inviting ${id}...`, 'info');
            }
        });

        // 脱退ボタン
        this.leaveBtn = this.scene.add.container(100, 110);
        const leaveBg = this.scene.add.rectangle(0, 0, 140, 35, 0xe94560).setInteractive({ useHandCursor: true });
        const leaveText = this.scene.add.text(0, 0, 'LEAVE', {
            fontSize: '14px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);
        this.leaveBtn.add([leaveBg, leaveText]);
        this.container.add(this.leaveBtn);

        leaveBg.on('pointerdown', () => {
            this.scene.networkManager.leaveParty();
            this.partyData = null;
            this.refreshList();
        });

        this.refreshList();
    }

    updatePartyData(data) {
        this.partyData = data;
        this.refreshList();
    }

    refreshList() {
        this.listContainer.removeAll(true);

        if (!this.partyData || !this.partyData.members || this.partyData.members.length === 0) {
            const emptyText = this.scene.add.text(0, 0, 'No Party', {
                fontSize: '18px', color: '#888888', fontFamily: '"Press Start 2P"'
            }).setOrigin(0.5);
            this.listContainer.add(emptyText);
            return;
        }

        const startY = -120;
        const itemSpacing = 60;

        this.partyData.members.forEach((member, index) => {
            const y = startY + (index * itemSpacing);
            const item = this.scene.add.container(0, y);

            const bg = this.scene.add.rectangle(0, 0, 440, 50, 0x1a1a2e, 0.8).setStrokeStyle(2, 0x4a90e2);

            const nameText = this.scene.add.text(-200, -10, `${member.name} (Lv.${member.level})`, {
                fontSize: '14px', color: '#ffffff', fontFamily: '"Press Start 2P"'
            });

            const statusText = this.scene.add.text(-200, 10, `HP: ${member.hp}/${member.maxHp} | Map: ${member.map}`, {
                fontSize: '10px', color: '#00ff00', fontFamily: '"Press Start 2P"'
            });

            const leaderIcon = member.id === this.partyData.leader ? '👑' : '';
            if (leaderIcon) {
                const icon = this.scene.add.text(180, 0, leaderIcon, { fontSize: '20px' }).setOrigin(0.5);
                item.add(icon);
            }

            item.add([bg, nameText, statusText]);
            this.listContainer.add(item);
        });
    }

    toggle() {
        super.toggle();
        if (this.isOpen) {
            this.refreshList();
        }
    }
}
