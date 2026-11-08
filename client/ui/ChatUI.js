import { UI_FONT } from '../fontConfig.js';
import BaseWindowUI from "./BaseWindowUI.js";

export default class ChatUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, { title: "CHAT  [T]", width: 620, height: 420, themeColor: 0x7b4db4 });
        this.channel = "global";
    }

    createUI() {
        if (this.container) return;
        this.createWindow();
        this.logText = this.scene.add.text(-280, -145, "", {
            fontSize: "11px", color: "#ffffff", fontFamily: "monospace", lineSpacing: 5,
            wordWrap: { width: 560 },
        });
        this.channelText = this.scene.add.text(-280, 155, "", { fontSize: "12px", color: "#00ffff", fontFamily: UI_FONT });
        const all = this.scene.add.text(60, 155, "[全体]", { fontSize: "12px", color: "#ffffff", fontFamily: UI_FONT }).setInteractive({ useHandCursor: true });
        const party = this.scene.add.text(150, 155, "[チーム]", { fontSize: "12px", color: "#ffffff", fontFamily: UI_FONT }).setInteractive({ useHandCursor: true });
        const send = this.scene.add.text(255, 155, "[送信]", { fontSize: "12px", color: "#ffd700", fontFamily: UI_FONT }).setInteractive({ useHandCursor: true });
        all.on("pointerdown", () => { this.channel = "global"; this.refresh(); });
        party.on("pointerdown", () => { this.channel = "party"; this.refresh(); });
        send.on("pointerdown", () => this.compose());
        this.container.add([this.logText, this.channelText, all, party, send]);
        this.refresh();
    }

    compose() {
        const text = prompt(`${this.channel === "party" ? "チーム" : "全体"}チャット:`, "");
        if (text?.trim()) this.scene.networkManager.sendChat(this.channel, text.trim());
    }

    addMessage() { this.refresh(); }

    refresh() {
        if (!this.logText) return;
        const messages = (this.scene.networkManager.chatMessages || []).slice(-12);
        this.logText.setText(messages.map(message => {
            const tag = message.channel === "party" ? "TEAM" : "ALL";
            return `[${tag}] ${message.fromName}: ${message.text}`;
        }).join("\n"));
        this.channelText?.setText(`送信先: ${this.channel === "party" ? "チーム" : "全体"}`);
    }
}
