// Activity log is a DOM panel next to the canvas, not a Phaser overlay.
export default class NotificationUI {
    constructor() {
        this.entries = [];
        this.log = document.getElementById('activity-log');
    }

    show(message, type = 'info') {
        if (!message || !this.log) return;
        const colors = { success: '#73e68c', error: '#ff8275', info: '#9ec5ff', warning: '#ffe07a' };
        const stamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        this.entries.unshift(`[${stamp}] ${message}`);
        this.entries = this.entries.slice(0, 6);
        this.log.textContent = this.entries.join('\n');
        this.log.style.color = colors[type] || colors.info;
    }

    destroy() {}
}
