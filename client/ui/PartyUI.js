import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from "./BaseWindowUI.js";
import { getJobLabel } from "../utils/jobLabel.js";

function button(scene, x, y, label, color, onClick, width = 110) {
    const box = scene.add.rectangle(x, y, width, 28, color).setStrokeStyle(1, 0xffffff).setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, { fontSize: "11px", color: "#ffffff", fontFamily: UI_FONT }).setOrigin(0.5);
    box.on("pointerdown", onClick);
    return [box, text];
}

export default class PartyUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, { title: "PARTY FINDER  [V]", width: 620, height: 520 });
        this.partyData = null;
        this.partyList = [];
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this.currentContainer = this.scene.add.container(0, 0);
        this.listContainer = this.scene.add.container(0, 0);
        this.container.add([this.currentContainer, this.listContainer]);
        this.container.add(button(this.scene, -205, -205, "CREATE", 0x258a50, () => this.createParty()));
        this.container.add(button(this.scene, -75, -205, "REFRESH", 0x4a90e2, () => this.scene.networkManager.requestPartyList()));
        this.container.add(button(this.scene, 65, -205, "LEAVE", 0xe94560, () => this.scene.networkManager.leaveParty()));
        this.container.add(this.scene.add.text(155, -205, "パーティー一覧", { fontSize: "12px", color: "#ffd700", fontFamily: UI_FONT }).setOrigin(0.5));
        this.refresh();
    }

    updatePartyData(data) { this.partyData = data; this.refresh(); }
    updatePartyList(list) { this.partyList = list || []; this.refresh(); }

    createParty() {
        const name = prompt("パーティー名（空欄なら自動設定）:", "");
        if (name === null) return;
        const password = prompt("パスワード（空欄なら誰でも参加可能）:", "");
        if (password === null) return;
        this.scene.networkManager.createParty(name, password);
    }

    joinParty(entry) {
        const password = entry.hasPassword ? prompt("このパーティーのパスワード:", "") : "";
        if (password === null) return;
        this.scene.networkManager.joinParty(entry.partyId, password);
    }

    invite() {
        const id = prompt("招待するプレイヤーID:", "");
        if (id?.trim()) this.scene.networkManager.inviteToParty(id.trim());
    }

    refresh() {
        if (!this.currentContainer || !this.listContainer) return;
        this.currentContainer.removeAll(true);
        this.listContainer.removeAll(true);
        const myId = this.scene.networkManager.getPlayerId();
        const current = this.partyData;
        const isLeader = current?.leader === myId;

        this.currentContainer.add(this.scene.add.text(-275, -165, current ? `現在: ${current.name || "Party"}${isLeader ? "（リーダー）" : ""}` : "現在: パーティー未所属", {
            fontSize: "12px", color: "#00ffff", fontFamily: UI_FONT
        }));
        if (current) {
            if (isLeader) this.currentContainer.add(button(this.scene, 205, -165, "INVITE", 0x4a90e2, () => this.invite()));
            current.members.forEach((member, index) => {
                const y = -135 + index * 32;
                this.currentContainer.add(this.scene.add.text(-275, y, `${member.id === current.leader ? "👑 " : ""}${member.name}  Lv.${member.level}  [${getJobLabel(member.job)}]  ${member.map}`, {
                    fontSize: "11px", color: "#ffffff", fontFamily: UI_FONT
                }));
                if (isLeader && member.id !== myId) {
                    this.currentContainer.add(button(this.scene, 215, y + 5, "KICK", 0xb03040, () => this.scene.networkManager.kickFromParty(member.id), 70));
                }
            });
        }

        this.listContainer.add(this.scene.add.text(-275, 110, "参加できるパーティー", {
            fontSize: "12px", color: "#ffd700", fontFamily: UI_FONT
        }));
        if (this.partyList.length === 0) {
            this.listContainer.add(this.scene.add.text(-275, 140, "公開中のパーティーはありません。CREATEで作成できます。", {
                fontSize: "11px", color: "#aaaaaa", fontFamily: UI_FONT
            }));
            return;
        }
        this.partyList.slice(0, 6).forEach((entry, index) => {
            const y = 140 + index * 32;
            const locked = entry.hasPassword ? "🔒" : "OPEN";
            this.listContainer.add(this.scene.add.text(-275, y, `${locked} ${entry.name}  ${entry.memberCount}/${entry.maxMembers}  leader:${entry.leaderName}`, {
                fontSize: "11px", color: "#ffffff", fontFamily: UI_FONT
            }));
            this.listContainer.add(button(this.scene, 230, y + 4, "JOIN", 0x258a50, () => this.joinParty(entry), 75));
        });
    }

    open() {
        super.open();
        this.scene.networkManager.requestPartyList();
        this.refresh();
    }
}
