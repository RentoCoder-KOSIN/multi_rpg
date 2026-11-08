import { login, register, getLegacySave, clearLegacySave, parseAccountJson, restoreFromJson } from "../utils/saveStore.js";

// ログイン / 新規登録 / JSON読込・復元の画面（HTMLオーバーレイ）。
const STYLE_ID = "login-ui-style";

const CSS = `
.lg-overlay{position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(5,5,16,.92);font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#fff}
.lg-panel{width:min(92vw,440px);box-sizing:border-box;padding:26px 24px 20px;background:#0a0a1a;border:3px solid #4a90e2;border-radius:18px;box-shadow:0 0 28px rgba(74,144,226,.35);transition:border-color .2s}
.lg-panel.dragover{border-color:#55f088;box-shadow:0 0 32px rgba(85,240,136,.4)}
.lg-title{margin:0 0 4px;text-align:center;font:18px "Press Start 2P",monospace;color:#fff;text-shadow:0 0 8px #4a90e2}
.lg-sub{margin:0 0 16px;text-align:center;font-size:12px;color:#8aa4c8;line-height:1.6}
.lg-tabs{display:flex;gap:6px;margin-bottom:16px}
.lg-tab{flex:1;padding:9px 0;font-size:13px;color:#aab;background:#14142a;border:2px solid #2c3a5c;border-radius:8px;cursor:pointer;transition:all .15s}
.lg-tab.on{color:#fff;background:#2c5aa0;border-color:#4a90e2;font-weight:bold}
.lg-field{display:block;margin-bottom:12px;font-size:12px;color:#aab}
.lg-field input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:11px 12px;font-size:15px;color:#fff;background:#1a1a2e;border:2px solid #4a90e2;border-radius:8px;outline:none}
.lg-field input:focus{border-color:#8fc1ff}
.lg-hint{margin:-6px 0 12px;font-size:11px;color:#6f84a6}
.lg-error{min-height:18px;margin:4px 0 10px;font-size:13px;color:#ff6b6b;line-height:1.5;text-align:center}
.lg-submit{width:100%;padding:13px 0;font-size:15px;font-weight:700;color:#fff;background:#2ecc40;border:2px solid #fff;border-radius:10px;cursor:pointer;transition:background .15s}
.lg-submit:hover:not(:disabled){background:#28b337}
.lg-submit:disabled{opacity:.55;cursor:default}
.lg-note{margin:14px 0 0;font-size:11px;color:#6f84a6;line-height:1.6;text-align:center}
.lg-switch-wrap{text-align:center;margin:12px 0 0;font-size:12px;color:#8aa4c8}
.lg-link-btn{background:none;border:none;color:#4a90e2;cursor:pointer;font-size:12px;padding:0;text-decoration:underline}
.lg-link-btn:hover{color:#8fc1ff}

/* JSONインポート用UI */
.lg-dropzone{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px 16px;background:#14142a;border:2px dashed #4a90e2;border-radius:10px;cursor:pointer;transition:all .2s;text-align:center}
.lg-dropzone:hover,.lg-dropzone.dragover{background:#1a2245;border-color:#8fc1ff;box-shadow:0 0 16px rgba(74,144,226,.35)}
.lg-drop-icon{font-size:32px;margin-bottom:8px}
.lg-drop-text{font-size:13px;color:#d0e2ff;line-height:1.5}
.lg-drop-sub{font-size:11px;color:#7e98bf;margin-top:4px}
.lg-browse-btn{display:inline-block;margin-top:10px;padding:7px 16px;background:#2c5aa0;border:1px solid #4a90e2;border-radius:6px;font-size:12px;color:#fff;font-weight:600}
.lg-file-card{background:#11162d;border:1px solid #4a90e2;border-radius:10px;padding:14px 16px;margin-bottom:14px}
.lg-file-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #233157}
.lg-file-name{font-size:12px;font-weight:bold;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px}
.lg-file-reset{background:none;border:none;color:#ff8b7b;cursor:pointer;font-size:11px}
.lg-file-reset:hover{text-decoration:underline}
.lg-file-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;color:#aab;margin-bottom:10px}
.lg-file-stats b{color:#8fc1ff}
.lg-badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;margin-bottom:8px}
.lg-badge-auth{background:#143d22;color:#55f088;border:1px solid #2ecc40}
.lg-badge-noauth{background:#3d3014;color:#f0c055;border:1px solid #e2a02c}
`;

export default class LoginUI {
    constructor({ onSuccess, message = "" }) {
        this.onSuccess = onSuccess;
        this.mode = "login"; // "login" | "register" | "import"
        this.busy = false;
        this.selectedJson = null;
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
                    <button type="button" class="lg-tab" data-mode="import">JSON読込</button>
                </div>

                <!-- 通常のログイン・登録フォーム -->
                <form class="lg-form" autocomplete="on">
                    <label class="lg-field lg-user-wrap">ユーザー名
                        <input class="lg-user" type="text" name="username" autocomplete="username" maxlength="16" autocapitalize="off" spellcheck="false">
                    </label>
                    <label class="lg-field lg-pass-wrap">パスワード
                        <input class="lg-pass" type="password" name="password" autocomplete="current-password" maxlength="64">
                    </label>
                    <label class="lg-field lg-pass2-wrap" style="display:none">パスワード（確認）
                        <input class="lg-pass2" type="password" name="password2" autocomplete="new-password" maxlength="64">
                    </label>
                    <p class="lg-hint lg-register-hint" style="display:none">ユーザー名: 半角英数字と _ - の 3〜16 文字 / パスワード: 6 文字以上<br>※登録時にアカウントJSONファイルが自動保存されます</p>
                    <button type="submit" class="lg-submit">ログイン</button>
                    <div class="lg-switch-wrap">
                        または <button type="button" class="lg-link-btn" data-goto="import">保存したJSONファイルから読み込む</button>
                    </div>
                </form>

                <!-- JSONインポートエリア -->
                <div class="lg-import-area" style="display:none">
                    <div class="lg-dropzone">
                        <div class="lg-drop-icon">📁</div>
                        <div class="lg-drop-text">保存したJSONファイルをドラッグ＆ドロップ</div>
                        <div class="lg-drop-sub">または下のボタンから選択</div>
                        <span class="lg-browse-btn">ファイルを選択</span>
                        <input type="file" class="lg-file-input" accept=".json,application/json" style="display:none">
                    </div>

                    <div class="lg-file-card" style="display:none">
                        <div class="lg-file-header">
                            <span class="lg-file-name">-</span>
                            <button type="button" class="lg-file-reset">別のファイル</button>
                        </div>
                        <div class="lg-file-stats">
                            <div>ユーザー名: <b class="lg-info-user">-</b></div>
                            <div>レベル: <b class="lg-info-level">-</b></div>
                            <div>職業: <b class="lg-info-job">-</b></div>
                            <div>所持金: <b class="lg-info-gold">-</b></div>
                        </div>
                        <div class="lg-badge lg-badge-auth" style="display:none">🔑 ログイン情報が含まれています</div>
                        <div class="lg-badge lg-badge-noauth" style="display:none">⚠️ パスワード入力が必要です</div>
                        <label class="lg-field lg-json-pass-wrap" style="display:none">パスワード
                            <input class="lg-json-pass" type="password" placeholder="このアカウントのパスワード" maxlength="64">
                        </label>
                        <button type="button" class="lg-submit lg-import-btn">読み込んでログイン</button>
                    </div>
                </div>

                <div class="lg-error"></div>
                <p class="lg-note">アカウント登録・保存時にJSONファイルがダウンロードされます。<br>そのJSONファイルを使えばいつでもデータを復元できます。</p>
            </div>`;
        document.body.appendChild(el);
        this.el = el;
        this.panel = el.querySelector(".lg-panel");

        // フォーム要素
        this.form = el.querySelector(".lg-form");
        this.userInput = el.querySelector(".lg-user");
        this.passInput = el.querySelector(".lg-pass");
        this.pass2Input = el.querySelector(".lg-pass2");
        this.pass2Wrap = el.querySelector(".lg-pass2-wrap");
        this.hint = el.querySelector(".lg-register-hint");
        this.errorEl = el.querySelector(".lg-error");
        this.submitBtn = el.querySelector(".lg-submit");

        // JSONインポート要素
        this.importArea = el.querySelector(".lg-import-area");
        this.dropzone = el.querySelector(".lg-dropzone");
        this.fileInput = el.querySelector(".lg-file-input");
        this.fileCard = el.querySelector(".lg-file-card");
        this.fileNameEl = el.querySelector(".lg-file-name");
        this.fileResetBtn = el.querySelector(".lg-file-reset");
        this.infoUser = el.querySelector(".lg-info-user");
        this.infoLevel = el.querySelector(".lg-info-level");
        this.infoJob = el.querySelector(".lg-info-job");
        this.infoGold = el.querySelector(".lg-info-gold");
        this.badgeAuth = el.querySelector(".lg-badge-auth");
        this.badgeNoAuth = el.querySelector(".lg-badge-noauth");
        this.jsonPassWrap = el.querySelector(".lg-json-pass-wrap");
        this.jsonPassInput = el.querySelector(".lg-json-pass");
        this.importSubmitBtn = el.querySelector(".lg-import-btn");

        this.setError(message);
        this.setupEvents();

        setTimeout(() => this.userInput.focus(), 50);
    }

    setupEvents() {
        // タブ切り替え
        this.el.querySelectorAll(".lg-tab").forEach(btn =>
            btn.addEventListener("click", () => this.setMode(btn.dataset.mode)));

        // フォーム内の切り替えリンク
        this.el.querySelectorAll("[data-goto]").forEach(link =>
            link.addEventListener("click", () => this.setMode(link.dataset.goto)));

        // 通常フォーム送信
        this.form.addEventListener("submit", e => { e.preventDefault(); this.submitNormal(); });

        // ファイル選択
        this.dropzone.addEventListener("click", () => this.fileInput.click());
        this.fileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.handleFile(file);
        });

        // ファイルリセット
        this.fileResetBtn.addEventListener("click", () => this.resetSelectedFile());

        // インポート送信
        this.importSubmitBtn.addEventListener("click", () => this.submitImport());
        this.jsonPassInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.submitImport();
            }
        });

        // ドラッグ＆ドロップ（ドロップゾーンとパネル全体）
        const handleDragOver = (e, targetEl) => {
            e.preventDefault();
            e.stopPropagation();
            targetEl.classList.add("dragover");
        };
        const handleDragLeave = (e, targetEl) => {
            e.preventDefault();
            e.stopPropagation();
            targetEl.classList.remove("dragover");
        };

        this.dropzone.addEventListener("dragover", (e) => handleDragOver(e, this.dropzone));
        this.dropzone.addEventListener("dragleave", (e) => handleDragLeave(e, this.dropzone));
        this.dropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.dropzone.classList.remove("dragover");
            const file = e.dataTransfer?.files?.[0];
            if (file) this.handleFile(file);
        });

        this.panel.addEventListener("dragover", (e) => handleDragOver(e, this.panel));
        this.panel.addEventListener("dragleave", (e) => handleDragLeave(e, this.panel));
        this.panel.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.panel.classList.remove("dragover");
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                if (this.mode !== "import") this.setMode("import");
                this.handleFile(file);
            }
        });

        // ゲーム側のキー入力（移動・ショートカット）に文字入力が奪われないようにする
        this.el.addEventListener("keydown", e => e.stopPropagation());
        this.el.addEventListener("keyup", e => e.stopPropagation());
    }

    setMode(mode) {
        this.mode = mode;
        this.el.querySelectorAll(".lg-tab").forEach(b => b.classList.toggle("on", b.dataset.mode === mode));
        this.setError("");

        if (mode === "import") {
            this.form.style.display = "none";
            this.importArea.style.display = "block";
        } else {
            this.form.style.display = "block";
            this.importArea.style.display = "none";
            const isRegister = mode === "register";
            this.pass2Wrap.style.display = isRegister ? "block" : "none";
            this.hint.style.display = isRegister ? "block" : "none";
            this.passInput.autocomplete = isRegister ? "new-password" : "current-password";
            this.submitBtn.textContent = isRegister ? "登録して始める (JSON保存)" : "ログイン";
        }
    }

    setError(text) {
        this.errorEl.textContent = text || "";
    }

    handleFile(file) {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
            return this.setError("JSONファイル（.json）を選択してください");
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = parseAccountJson(e.target.result);
                this.selectedJson = parsed;
                this.showJsonPreview(parsed, file.name);
                this.setError("");
            } catch (err) {
                this.setError(err.message || "JSONファイルの解析に失敗しました");
            }
        };
        reader.onerror = () => this.setError("ファイルの読み込みに失敗しました");
        reader.readAsText(file);
    }

    showJsonPreview(parsed, fileName) {
        this.dropzone.style.display = "none";
        this.fileCard.style.display = "block";
        this.fileNameEl.textContent = fileName;
        this.infoUser.textContent = parsed.summary.username;
        this.infoLevel.textContent = `Lv.${parsed.summary.level}`;
        this.infoJob.textContent = parsed.summary.job;
        this.infoGold.textContent = Number(parsed.summary.gold).toLocaleString();

        if (parsed.summary.hasPassword) {
            this.badgeAuth.style.display = "inline-block";
            this.badgeNoAuth.style.display = "none";
            this.jsonPassWrap.style.display = "none";
            this.importSubmitBtn.textContent = "このデータで読み込み・ログイン";
        } else {
            this.badgeAuth.style.display = "none";
            this.badgeNoAuth.style.display = "inline-block";
            this.jsonPassWrap.style.display = "block";
            this.importSubmitBtn.textContent = "パスワードを入力して復元";
            setTimeout(() => this.jsonPassInput.focus(), 50);
        }
    }

    resetSelectedFile() {
        this.selectedJson = null;
        this.fileInput.value = "";
        this.dropzone.style.display = "flex";
        this.fileCard.style.display = "none";
        this.jsonPassInput.value = "";
        this.setError("");
    }

    async submitNormal() {
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
                let legacy = getLegacySave();
                if (legacy && !confirm("この端末に保存されている既存のセーブデータを、新しいアカウントに引き継ぎますか？")) {
                    legacy = null;
                }
                // アカウント登録完了と同時にJSONバックアップを自動ダウンロード
                session = await register(username, password, legacy, true);
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

    async submitImport() {
        if (this.busy || !this.selectedJson) return;
        const fallbackPassword = this.jsonPassInput.value;
        if (!this.selectedJson.summary.hasPassword && !fallbackPassword) {
            return this.setError("このアカウントのパスワードを入力してください");
        }

        this.busy = true;
        this.importSubmitBtn.disabled = true;
        this.setError("");

        try {
            const session = await restoreFromJson(this.selectedJson, fallbackPassword);
            this.destroy();
            this.onSuccess(session);
        } catch (err) {
            this.setError(err.message || "読み込みに失敗しました");
            this.busy = false;
            this.importSubmitBtn.disabled = false;
        }
    }

    destroy() {
        if (this.el?.parentNode) this.el.parentNode.removeChild(this.el);
        this.el = null;
    }
}
