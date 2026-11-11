import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from "./BaseWindowUI.js";
import { getJobLabel } from "../utils/jobLabel.js";

function button(scene, x, y, label, color, onClick, width = 110, height = 28) {
    const box = scene.add.rectangle(x, y, width, height, color).setStrokeStyle(1, 0xffffff).setInteractive({ useHandCursor: true });
    const text = scene.add.text(x, y, label, { fontSize: "11px", color: "#ffffff", fontFamily: UI_FONT }).setOrigin(0.5);
    box.on("pointerdown", onClick);
    return [box, text];
}

export default class PartyUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, { title: "PARTY FINDER  [V]", width: 620, height: 520, fullScreen: true });
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
        this.container.add(this.scene.add.text(0, 238, "作成・更新・脱退 / 一覧から参加　｜　Escで閉じる", {
            fontSize: "10px", color: "#aebbd2", fontFamily: UI_FONT
        }).setOrigin(0.5));
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
        const id = prompt("招待するプレイヤーの名前 または ユーザーID:\n（例: rento または u-xxxx）", "");
        if (id?.trim()) {
            this.scene.networkManager.inviteToParty(id.trim());
            this.scene.notificationUI?.show(`「${id.trim()}」へ招待を送信しました`, 'info');
        }
    }

    refresh() {
        if (!this.currentContainer || !this.listContainer) return;
        this.currentContainer.removeAll(true);
        this.listContainer.removeAll(true);
        const myId = this.scene.networkManager.getPlayerId();
        const current = this.partyData;
        const isLeader = current?.leader === myId;

        this.currentContainer.add(this.scene.add.text(-250, -165, current ? `所属中: ${current.name || "Party"}  ${current.members?.length || 0}/4${isLeader ? "  👑リーダー" : ""}` : "現在: パーティー未所属", {
            fontSize: "12px", color: "#8fe8ee", fontFamily: UI_FONT,
            wordWrap: { width: isLeader ? 345 : 520 }, maxLines: 2, lineSpacing: 1
        }));
        if (current) {
            if (isLeader) this.currentContainer.add(button(this.scene, 205, -165, "ID/名前で招待", 0x4a90e2, () => this.invite(), 110));
            current.members.forEach((member, index) => {
                const y = -135 + index * 32;
                this.currentContainer.add(this.scene.add.text(-250, y, `${member.id === current.leader ? "👑 " : ""}${member.name}  Lv.${member.level}  [${getJobLabel(member.job)}]  ${member.map}`, {
                    fontSize: "10px", color: "#ffffff", fontFamily: UI_FONT,
                    wordWrap: { width: isLeader && member.id !== myId ? 390 : 515 }, maxLines: 2, lineSpacing: 1
                }));
                if (isLeader && member.id !== myId) {
                    this.currentContainer.add(button(this.scene, 215, y + 5, "KICK", 0xb03040, () => this.scene.networkManager.kickFromParty(member.id), 70));
                }
            });

            // リーダーの場合、近く（同マップ）の他プレイヤーを一覧表示して直接招待できる機能
            if (isLeader && current.members.length < 4) {
                const others = this.scene.networkManager?.getOtherPlayers() || {};
                const playerNames = this.scene.registry.get('playerNames') || {};
                const partyMemberIds = new Set(current.members.map(m => m.id));
                const nearbyCandidates = Object.keys(others)
                    .filter(id => others[id]?.active && !partyMemberIds.has(id))
                    .slice(0, 3);

                if (nearbyCandidates.length > 0) {
                    const candidateY = -5;
                    this.currentContainer.add(this.scene.add.text(-250, candidateY - 14, "📍 近くのプレイヤーを招待:", {
                        fontSize: "11px", color: "#88ccff", fontFamily: UI_FONT
                    }));
                    nearbyCandidates.forEach((candId, idx) => {
                        const cy = candidateY + 8 + idx * 28;
                        const cName = playerNames[candId] || `Player ${candId.substring(0, 6)}`;
                        this.currentContainer.add(this.scene.add.text(-240, cy, `${cName}`, {
                            fontSize: "11px", color: "#ffffff", fontFamily: UI_FONT
                        }));
                        this.currentContainer.add(button(this.scene, 215, cy + 4, "招待", 0x258a50, () => {
                            this.scene.networkManager.inviteToParty(candId);
                            this.scene.notificationUI?.show(`${cName} に招待を送信しました`, 'info');
                        }, 70));
                    });
                }
            }
        }

        this.listContainer.add(this.scene.add.text(-250, 98, `参加できるパーティー（${this.partyList.length}件）`, {
            fontSize: "12px", color: "#ffd700", fontFamily: UI_FONT
        }));
        if (this.partyList.length === 0) {
            this.listContainer.add(this.scene.add.text(-250, 128, "公開中のパーティーはありません。CREATEで作成できます。", {
                fontSize: "10px", color: "#aaaaaa", fontFamily: UI_FONT, wordWrap: { width: 500 }
            }));
            return;
        }
        this.partyList.slice(0, 4).forEach((entry, index) => {
            const y = 123 + index * 30;
            const locked = entry.hasPassword ? "🔒" : "OPEN";
            this.listContainer.add(this.scene.add.text(-250, y, `${locked} ${entry.name}  ${entry.memberCount}/${entry.maxMembers}  主催:${entry.leaderName}`, {
                fontSize: "10px", color: "#ffffff", fontFamily: UI_FONT,
                wordWrap: { width: 410 }, maxLines: 2, lineSpacing: 1
            }));
            this.listContainer.add(button(this.scene, 230, y + 4, "参加", 0x258a50, () => this.joinParty(entry), 68, 24));
        });
    }

    open() {
        super.open();
        this.scene.networkManager.requestPartyList();
        this.refresh();
    }
}
