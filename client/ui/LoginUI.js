import { login, register, getLegacySave, clearLegacySave } from "../utils/saveStore.js";

// ログイン / 新規登録の画面（HTMLオーバーレイ）。
// パスワード欄やスマホのキーボード、パスワードマネージャーとの相性が良いので、
// Phaserの描画ではなくDOMで作っている。
const STYLE_ID = "login-ui-style";

const CSS = `
.lg-overlay{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(5,5,16,.92);font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#fff}
.lg-panel{width:min(92vw,420px);box-sizing:border-box;padding:28px 26px 22px;background:#0a0a1a;border:3px solid #4a90e2;border-radius:18px;box-shadow:0 0 28px rgba(74,144,226,.35)}
.lg-title{margin:0 0 4px;text-align:center;font:18px "Press Start 2P",monospace;color:#fff;text-shadow:0 0 8px #4a90e2}
.lg-sub{margin:0 0 18px;text-align:center;font-size:12px;color:#8aa4c8;line-height:1.6}
.lg-tabs{display:flex;gap:8px;margin-bottom:16px}
.lg-tab{flex:1;padding:10px 0;font-size:14px;color:#aab;background:#14142a;border:2px solid #2c3a5c;border-radius:8px;cursor:pointer}
.lg-tab.on{color:#fff;background:#2c5aa0;border-color:#4a90e2}
.lg-field{display:block;margin-bottom:12px;font-size:12px;color:#aab}
.lg-field input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:11px 12px;font-size:16px;color:#fff;background:#1a1a2e;border:2px solid #4a90e2;border-radius:8px;outline:none}
.lg-field input:focus{border-color:#8fc1ff}
.lg-hint{margin:-6px 0 12px;font-size:11px;color:#6f84a6}
.lg-error{min-height:18px;margin:4px 0 10px;font-size:13px;color:#ff6b6b;line-height:1.5}
.lg-submit{width:100%;padding:13px 0;font-size:16px;font-weight:700;color:#fff;background:#2ecc40;border:2px solid #fff;border-radius:10px;cursor:pointer}
.lg-submit:disabled{opacity:.55;cursor:default}
.lg-note{margin:14px 0 0;font-size:11px;color:#6f84a6;line-height:1.7;text-align:center}
`;

export default class LoginUI {
    constructor({ onSuccess, message = "" }) {
        this.onSuccess = onSuccess;
        this.mode = "login";
        this.busy = false;
        this.injectStyle();
        this.build(message);
    }

    injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    build(message) {
        const el = document.createElement("div");
        el.className = "lg-overlay";
        el.innerHTML = `
            <div class="lg-panel">
                <h1 class="lg-title">RPG GAME</h1>
                <p class="lg-sub">ログインすると、どのPCでも<br>同じキャラクターで遊べます</p>
                <div class="lg-tabs">
                    <button type="button" class="lg-tab on" data-mode="login">ログイン</button>
                    <button type="button" class="lg-tab" data-mode="register">新規登録</button>
                </div>
                <form class="lg-form" autocomplete="on">
                    <label class="lg-field">ユーザー名
                        <input class="lg-user" type="text" name="username" autocomplete="username" maxlength="16" autocapitalize="off" spellcheck="false">
                    </label>
                    <label class="lg-field">パスワード
                        <input class="lg-pass" type="password" name="password" autocomplete="current-password" maxlength="64">
                    </label>
                    <label class="lg-field lg-pass2-wrap" style="display:none">パスワード（確認）
                        <input class="lg-pass2" type="password" name="password2" autocomplete="new-password" maxlength="64">
                    </label>
                    <p class="lg-hint lg-register-hint" style="display:none">ユーザー名: 半角英数字と _ - の 3〜16 文字 / パスワード: 6 文字以上</p>
                    <div class="lg-error"></div>
                    <button type="submit" class="lg-submit">ログイン</button>
                </form>
                <p class="lg-note">ユーザー名とパスワードを忘れるとデータを復元できません。<br>パスワードはハッシュ化して保存されます。</p>
            </div>`;
        document.body.appendChild(el);
        this.el = el;

        this.userInput = el.querySelector(".lg-user");
        this.passInput = el.querySelector(".lg-pass");
        this.pass2Input = el.querySelector(".lg-pass2");
        this.pass2Wrap = el.querySelector(".lg-pass2-wrap");
        this.hint = el.querySelector(".lg-register-hint");
        this.errorEl = el.querySelector(".lg-error");
        this.submitBtn = el.querySelector(".lg-submit");
        this.setError(message);

        el.querySelectorAll(".lg-tab").forEach(btn =>
            btn.addEventListener("click", () => this.setMode(btn.dataset.mode)));
        el.querySelector(".lg-form").addEventListener("submit", e => { e.preventDefault(); this.submit(); });

        // ゲーム側のキー入力（移動・ショートカット）に文字入力が奪われないようにする
        el.addEventListener("keydown", e => e.stopPropagation());
        el.addEventListener("keyup", e => e.stopPropagation());

        setTimeout(() => this.userInput.focus(), 50);
    }

    setMode(mode) {
        this.mode = mode;
        const isRegister = mode === "register";
        this.el.querySelectorAll(".lg-tab").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
        this.pass2Wrap.style.display = isRegister ? "block" : "none";
        this.hint.style.display = isRegister ? "block" : "none";
        this.passInput.autocomplete = isRegister ? "new-password" : "current-password";
        this.submitBtn.textContent = isRegister ? "登録して始める" : "ログイン";
        this.setError("");
    }

    setError(text) {
        this.errorEl.textContent = text || "";
    }

    async submit() {
        if (this.busy) return;
        const username = this.userInput.value.trim();
        const password = this.passInput.value;

        if (!username || !password) return this.setError("ユーザー名とパスワードを入力してください");
        if (this.mode === "register" && password !== this.pass2Input.value) {
            return this.setError("確認用パスワードが一致しません");
        }

        this.busy = true;
        this.submitBtn.disabled = true;
        this.setError("");

        try {
            let session;
            if (this.mode === "register") {
                // アカウント導入前にこの端末へ保存していたセーブがあれば、引き継ぐか確認する
                let legacy = getLegacySave();
                if (legacy && !confirm("この端末に保存されている既存のセーブデータを、新しいアカウントに引き継ぎますか？")) {
                    legacy = null;
                }
                session = await register(username, password, legacy);
                if (legacy) clearLegacySave();
            } else {
                session = await login(username, password);
            }
            this.destroy();
            this.onSuccess(session);
        } catch (err) {
            this.setError(err.message || "通信に失敗しました");
            this.busy = false;
            this.submitBtn.disabled = false;
        }
    }

    destroy() {
        if (this.el?.parentNode) this.el.parentNode.removeChild(this.el);
        this.el = null;
    }
}
