// Activity log is a DOM panel next to the canvas, not a Phaser overlay.
const MAX_ENTRIES = 100;
const COLORS = { success: '#73e68c', error: '#ff8275', info: '#9ec5ff', warning: '#ffe07a' };

export default class NotificationUI {
    constructor() {
        this.log = document.getElementById('activity-log');
    }

    show(message, type = 'info') {
        if (!message || !this.log) return;
        // 初期の案内文を消す
        this.log.querySelector('.log-empty')?.remove();

        const stamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.style.color = COLORS[type] || COLORS.info;
        entry.textContent = `[${stamp}] ${message}`;

        // 新しいものを上に積む（スクロールは先頭へ）。古いものは MAX_ENTRIES を超えたら削除
        this.log.prepend(entry);
        while (this.log.childElementCount > MAX_ENTRIES) this.log.lastElementChild.remove();
        this.log.scrollTop = 0;
    }

    destroy() {}
}
