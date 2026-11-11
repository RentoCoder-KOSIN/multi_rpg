// Activity log is a DOM panel next to the canvas, not a Phaser overlay.
const MAX_ENTRIES = 100;
const COLORS = { success: '#73e68c', error: '#ff8275', info: '#9ec5ff', warning: '#ffe07a' };

export default class NotificationUI {
    constructor() {
        this.log = document.getElementById('activity-log');
    }

    /**
     * ログに1行追加する。
     * @param {string} message
     * @param {'success'|'error'|'info'|'warning'} type
     * @param {number|{actions?: Array<{label: string, onClick: Function}>}} [options]
     *        数値は従来の「表示時間」引数（今は使わない）。
     *        { actions } を渡すと、行の下に押せるボタンを付ける（例: 無限の深淵への参加確認）。
     * @returns {HTMLElement|null} 追加した行。resolveEntry() でボタンを片付けられる
     */
    show(message, type = 'info', options = null) {
        if (!message || !this.log) return null;
        // 初期の案内文を消す
        this.log.querySelector('.log-empty')?.remove();

        const stamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.style.color = COLORS[type] || COLORS.info;

        const text = document.createElement('span');
        text.textContent = `[${stamp}] ${message}`;
        entry.appendChild(text);

        const actions = options && typeof options === 'object' ? options.actions : null;
        if (Array.isArray(actions) && actions.length > 0) {
            const row = document.createElement('div');
            row.className = 'log-actions';
            actions.forEach(({ label, onClick }) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = label;
                button.addEventListener('click', () => onClick?.(entry));
                row.appendChild(button);
            });
            entry.appendChild(row);
        }

        // 新しいものを上に積む（スクロールは先頭へ）。古いものは MAX_ENTRIES を超えたら削除
        this.log.prepend(entry);
        while (this.log.childElementCount > MAX_ENTRIES) this.log.lastElementChild.remove();
        this.log.scrollTop = 0;
        return entry;
    }

    /**
     * show() で付けたボタンを外し、代わりに結果の一言を表示する（回答済み・締め切りなど）
     */
    resolveEntry(entry, note = '') {
        if (!entry) return;
        entry.querySelector('.log-actions')?.remove();
        entry.classList.add('log-resolved');
        if (note) {
            const span = document.createElement('span');
            span.className = 'log-note';
            span.textContent = ` → ${note}`;
            entry.appendChild(span);
        }
    }

    destroy() {}
}
