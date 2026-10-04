/**
 * adminモード（開発・動作確認用）。
 *
 * 使い方:
 *   1. Shift+@ キー（日本語配列の「@」キーをShiftと同時押し。予備として Ctrl+Alt+A も可）を押す
 *   2. パスワード入力欄が出るので、gameConstants.js の ADMIN_CONFIG.PASSWORD を入力して Enter
 *   3. 正しければ adminモードになり、操作パネルが開く（以降は同じキーでパネルの開閉）
 *
 * できること: レベル/ゴールド/ステータスポイント/ジョブEXP の付与、全スキル習得、職業変更、
 *            アイテム付与、全回復、無敵・MP/CDなし、マップ移動、クエストの一括操作。
 *
 * 注意:
 *   - パスワードはクライアントのJSに書いてあるだけなので、本格的な防御ではない（開発用の鍵）。
 *     友達に配るときは ADMIN_CONFIG.PASSWORD を変えておくこと。
 *   - adminモードの状態は sessionStorage に保存する（タブを閉じると解除される）。
 *   - パネルはDOMで作っており、シーンが切り替わっても1つを使い回す（bindAdminScene で現在のシーンを差し替える）。
 *   - パネル/ログイン欄の中のキー入力は stopPropagation して、ゲーム側（Phaser）にキー操作が漏れないようにしている。
 */
import { JOBS } from "../data/jobs.js";
import { ITEMS } from "../data/items.js";
import { SKILLS } from "../data/skills.js";
import { QUESTS } from "../data/quests.js";
import { getMapList } from "../data/maps.js";
import { ADMIN_CONFIG } from "../gameConstants.js";

const SESSION_KEY = "mrpgAdminMode";
const flags = { god: false, free: false };
const MIN_KEY = "mrpgAdminMinimized";

let enabled = false;
let minimized = false;
try {
    enabled = sessionStorage.getItem(SESSION_KEY) === "1";
    minimized = sessionStorage.getItem(MIN_KEY) === "1";
} catch (e) {
    /* 無視 */
}

let currentScene = null;
let listenerInstalled = false;
let panel = null;
let loginBox = null;
let statusTimer = null;
let failCount = 0;
let lockedUntil = 0;

/** adminモード中か */
export function isAdminMode() {
    return enabled;
}

/** adminモード中かつそのフラグがONか（'god' = 無敵 / 'free' = MP消費・クールダウンなし） */
export function isAdminFlag(name) {
    return enabled && !!flags[name];
}

/** 現在のゲームシーンを登録する。シーンが作られるたびに呼ぶ（createGameUI から） */
export function bindAdminScene(scene) {
    currentScene = scene;
    installKeyListener();
}

// ---------------------------------------------------------------- キー

function isToggleKey(e) {
    // Shift+@。日本語配列では「@」キーをShiftと押すと e.key が '`'（code は BracketLeft）になる。
    // 英語配列でも Shift+2 が '@' になるので、'@' と '`' のどちらも受け付ける。
    if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        (e.key === "@" || e.key === "`" || e.code === "BracketLeft")
    )
        return true;
    // 予備: キー配列が合わなかったときに締め出されないように
    return e.ctrlKey && e.altKey && e.code === "KeyA";
}

function installKeyListener() {
    if (listenerInstalled) return;
    listenerInstalled = true;
    // capture フェーズで取る。パネルやログイン欄にフォーカスがあっても確実に反応させるため。
    window.addEventListener(
        "keydown",
        (e) => {
            if (!isToggleKey(e)) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.repeat) return;
            toggle();
        },
        true,
    );
}

function toggle() {
    if (loginBox && loginBox.style.display !== "none") {
        hideLogin();
        return;
    }
    if (!enabled) {
        showLogin();
        return;
    }
    if (panel && panel.style.display !== "none") hidePanel();
    else showPanel();
}

// ---------------------------------------------------------------- DOM部品

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(
        (c) => c && node.appendChild(c),
    );
    return node;
}

// 文字や数値を打ち込む欄か（チェックボックス・ボタンは含まない）
function isTypingTarget(t) {
    if (!t || !t.tagName) return false;
    if (t.tagName === "SELECT" || t.tagName === "TEXTAREA") return true;
    if (t.tagName === "INPUT") {
        return !["checkbox", "radio", "button", "submit"].includes(
            (t.type || "text").toLowerCase(),
        );
    }
    return false;
}

function blurActive() {
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
}

// 入力欄にフォーカスがある間だけ、キー入力をゲーム側に漏らさない（Phaserは window でキーを拾うため、ここで止める）。
// ボタンやチェックボックスの上ではキーを止めない → パネルを開いたままでもゲームを操作できる。
function isolateKeys(root) {
    ["keydown", "keyup", "keypress"].forEach((type) => {
        root.addEventListener(type, (e) => {
            if (isToggleKey(e)) return; // 開閉キーは window の capture 側で処理済み
            if (!isTypingTarget(e.target)) return;
            if (
                type === "keydown" &&
                (e.key === "Escape" ||
                    (e.key === "Enter" && e.target.tagName === "INPUT"))
            ) {
                blurActive(); // 入力を終えたらフォーカスをゲームに返す
            }
            e.stopPropagation();
        });
    });
    // ボタン/チェックボックスをクリックしてもフォーカスを奪わない（奪うと Space で再クリックされたりする）
    root.addEventListener("mousedown", (e) => {
        const t = e.target;
        if (
            t.tagName === "BUTTON" ||
            t.tagName === "LABEL" ||
            (t.tagName === "INPUT" && t.type === "checkbox")
        ) {
            e.preventDefault();
        }
    });
    // 何かを押し終わったら、入力欄に残っているフォーカスを外してゲームに返す
    root.addEventListener("click", (e) => {
        if (e.target.closest && e.target.closest("button")) blurActive();
    });
    root.addEventListener("change", (e) => {
        if (
            e.target.tagName === "SELECT" ||
            (e.target.tagName === "INPUT" && e.target.type === "checkbox")
        )
            blurActive();
    });
}

function injectStyle() {
    if (document.getElementById("admin-style")) return;
    const style = document.createElement("style");
    style.id = "admin-style";
    style.textContent = `
    #admin-panel, #admin-login { font: 12px/1.4 monospace; color: #eee; z-index: 100000; box-sizing: border-box; }
    #admin-panel { position: fixed; top: 8px; right: 8px; width: 330px; max-height: 94vh; overflow-y: auto;
        background: rgba(15,15,30,.96); border: 2px solid #e94560; border-radius: 6px; padding: 8px; }
    #admin-panel h3 { margin: 0 0 6px; font-size: 13px; color: #e94560; display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    #admin-panel h3 .adm-btns { display: flex; gap: 4px; }
    #admin-panel .adm-mini { display: none; flex: 1; color: #8be9fd; font-weight: normal; white-space: nowrap; }
    #admin-panel.min { width: auto; min-width: 230px; padding: 4px 8px; }
    #admin-panel.min h3 { margin: 0; }
    #admin-panel.min .adm-mini { display: inline; }
    #admin-panel.min .adm-body { display: none; }
    #admin-panel .adm-status { background: #0b0b18; border: 1px solid #333; padding: 4px 6px; margin-bottom: 6px; white-space: pre-wrap; }
    #admin-panel fieldset { border: 1px solid #444; margin: 0 0 6px; padding: 4px 6px 6px; }
    #admin-panel legend { color: #ffd700; padding: 0 4px; }
    #admin-panel .adm-row { display: flex; gap: 4px; margin-top: 4px; align-items: center; flex-wrap: wrap; }
    #admin-panel input[type=number], #admin-panel input[type=text], #admin-panel select { background: #1a1a2e; color: #fff;
        border: 1px solid #555; padding: 2px 4px; font: inherit; min-width: 0; }
    #admin-panel input[type=number] { width: 90px; }
    #admin-panel input.grow, #admin-panel select.grow { flex: 1; }
    #admin-panel button, #admin-login button { background: #2b3a67; color: #fff; border: 1px solid #4a90e2; border-radius: 3px;
        padding: 3px 8px; font: inherit; cursor: pointer; }
    #admin-panel button:hover, #admin-login button:hover { background: #3d5299; }
    #admin-panel button.danger { background: #5a1f2b; border-color: #e94560; }
    #admin-panel .adm-log { color: #8be9fd; margin-top: 4px; min-height: 1.4em; }
    #admin-login { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; }
    #admin-login .adm-box { background: #0f0f1e; border: 2px solid #e94560; border-radius: 6px; padding: 14px 16px; width: 280px; }
    #admin-login .adm-title { color: #e94560; font-weight: bold; margin-bottom: 8px; }
    #admin-login input { width: 100%; box-sizing: border-box; background: #1a1a2e; color: #fff; border: 1px solid #555;
        padding: 5px 6px; font: inherit; margin-bottom: 6px; }
    #admin-login .adm-msg { color: #ff8080; min-height: 1.4em; margin-bottom: 6px; }
    `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------- ログイン

function showLogin() {
    injectStyle();
    if (!loginBox) buildLogin();
    loginBox.style.display = "flex";
    const input = loginBox.querySelector("input");
    input.value = "";
    loginBox.querySelector(".adm-msg").textContent = "";
    setTimeout(() => input.focus(), 0);
}

function hideLogin() {
    if (loginBox) loginBox.style.display = "none";
    if (document.activeElement && document.activeElement.blur)
        document.activeElement.blur();
}

function buildLogin() {
    const msg = el("div", { class: "adm-msg" });
    const input = el("input", {
        type: "password",
        placeholder: "パスワード",
        autocomplete: "off",
    });
    const submit = () => {
        const now = Date.now();
        if (now < lockedUntil) {
            msg.textContent = `入力ミスが続いたため ${Math.ceil((lockedUntil - now) / 1000)} 秒待ってください`;
            return;
        }
        if (input.value === ADMIN_CONFIG.PASSWORD) {
            failCount = 0;
            enabled = true;
            try {
                sessionStorage.setItem(SESSION_KEY, "1");
            } catch (e) {
                /* 無視 */
            }
            hideLogin();
            showPanel();
            log("adminモードになりました");
        } else {
            failCount++;
            input.value = "";
            if (failCount >= 5) {
                lockedUntil = Date.now() + 30000;
                failCount = 0;
                msg.textContent = "パスワードが違います。30秒ロックします";
            } else {
                msg.textContent = "パスワードが違います";
            }
        }
    };
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
        else if (e.key === "Escape") hideLogin();
    });
    loginBox = el(
        "div",
        { id: "admin-login" },
        el("div", { class: "adm-box" }, [
            el("div", { class: "adm-title", text: "ADMIN LOGIN" }),
            input,
            msg,
            el("div", { class: "adm-row" }, [
                el("button", { text: "OK", onclick: submit }),
                el("button", { text: "キャンセル", onclick: hideLogin }),
            ]),
        ]),
    );
    loginBox.style.display = "none";
    isolateKeys(loginBox);
    document.body.appendChild(loginBox);
}

// ---------------------------------------------------------------- 操作パネル

function ctx() {
    const scene = currentScene;
    const player = scene && scene.player;
    if (!scene || !player || !player.active || !player.stats) {
        log("プレイヤーが見つかりません（シーン切り替え中かも）");
        return null;
    }
    return { scene, player };
}

function log(message) {
    const line = panel && panel.querySelector(".adm-log");
    if (line) line.textContent = message;
    const n = currentScene && currentScene.notificationUI;
    if (n && n.show) {
        try {
            n.show(`[ADMIN] ${message}`, "info");
        } catch (e) {
            /* 無視 */
        }
    }
}

function refreshUI(player) {
    player.saveStats();
    const s = player.scene;
    if (s.playerStatsUI) s.playerStatsUI.update();
    if (s.skillBarUI && s.skillBarUI.update) s.skillBarUI.update();
}

function num(id, fallback = 0) {
    const v = Number(panel.querySelector(`#${id}`).value);
    return Number.isFinite(v) ? Math.floor(v) : fallback;
}

function updateStatus() {
    if (!panel || panel.style.display === "none") return;
    const box = panel.querySelector(".adm-status");
    const mini = panel.querySelector(".adm-mini");
    const c =
        currentScene &&
        currentScene.player &&
        currentScene.player.active &&
        currentScene.player.stats
            ? currentScene
            : null;
    if (!c) {
        box.textContent = "(プレイヤー未生成)";
        if (mini) mini.textContent = "";
        return;
    }
    const s = c.player.stats;
    if (mini)
        mini.textContent = `Lv.${s.level} HP ${s.hp}/${s.maxHp} MP ${s.mp}/${s.maxMp}`;
    box.textContent =
        `Lv.${s.level}  職業:${JOBS[s.job]?.name || s.job}  転生:${s.reincarnationCount || 0}回\n` +
        `HP ${s.hp}/${s.maxHp}  MP ${s.mp}/${s.maxMp}\n` +
        `ゴールド ${s.gold}  Pt ${s.statPoints}  ジョブEXP ${s.jobExp}\n` +
        `マップ: ${c.currentMapKey || "?"}`;
}

function showPanel() {
    injectStyle();
    if (!panel) buildPanel();
    panel.style.display = "block";
    updateStatus();
    clearInterval(statusTimer);
    statusTimer = setInterval(updateStatus, 500);
}

function setMinimized(value) {
    minimized = value;
    try {
        sessionStorage.setItem(MIN_KEY, value ? "1" : "0");
    } catch (e) {
        /* 無視 */
    }
    if (!panel) return;
    panel.classList.toggle("min", value);
    const b = panel.querySelector(".adm-minbtn");
    if (b) {
        b.textContent = value ? "＋" : "－";
        b.title = value ? "展開" : "最小化";
    }
    updateStatus();
}

function hidePanel() {
    if (panel) panel.style.display = "none";
    clearInterval(statusTimer);
    if (document.activeElement && document.activeElement.blur)
        document.activeElement.blur();
}

function exitAdmin() {
    enabled = false;
    flags.god = false;
    flags.free = false;
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
        /* 無視 */
    }
    hidePanel();
    panel.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        cb.checked = false;
    });
}

function fieldset(title, ...rows) {
    return el("fieldset", {}, [el("legend", { text: title }), ...rows]);
}
const row = (...children) => el("div", { class: "adm-row" }, children);
const btn = (text, onclick, cls = "") =>
    el("button", { text, onclick, class: cls });

function buildPanel() {
    // --- マップ / ジョブ / アイテムの選択肢 ---
    const mapSelect = el(
        "select",
        { id: "adm-map", class: "grow" },
        getMapList().map((m) =>
            el("option", { value: m.key, text: `${m.name} (${m.key})` }),
        ),
    );

    const jobEntries = Object.values(JOBS);
    const jobSelect = el("select", { id: "adm-job", class: "grow" }, [
        el("option", { value: "none", text: "なし (none)" }),
        ...jobEntries
            .sort((a, b) => (a.reqLevel || 0) - (b.reqLevel || 0))
            .map((j) =>
                el("option", {
                    value: j.id,
                    text: `${j.name} (${j.id})${j.reqLevel ? ` Lv${j.reqLevel}~` : ""}`,
                }),
            ),
    ]);

    const itemList = el(
        "datalist",
        { id: "adm-items" },
        Object.values(ITEMS).map((i) =>
            el("option", { value: `${i.id} ${i.name || ""}`.trim() }),
        ),
    );

    panel = el("div", { id: "admin-panel" }, [
        el("h3", {}, [
            el("span", { text: "ADMIN  (Shift+@で開閉)" }),
            el("span", { class: "adm-mini" }),
            el("div", { class: "adm-btns" }, [
                el("button", {
                    class: "adm-minbtn",
                    text: "－",
                    title: "最小化",
                    onclick: () => setMinimized(!minimized),
                }),
                btn("×", hidePanel),
            ]),
        ]),
        el("div", { class: "adm-body" }, [
            el("div", { class: "adm-status" }),

            fieldset(
                "レベル / 数値",
                row(
                    el("input", {
                        type: "number",
                        id: "adm-level",
                        value: "100",
                        min: "1",
                        max: "100",
                    }),
                    btn("このLvまで上げる", actionLevel),
                    btn("Lv100", () => {
                        panel.querySelector("#adm-level").value = "100";
                        actionLevel();
                    }),
                ),
                row(
                    el("input", {
                        type: "number",
                        id: "adm-gold",
                        value: "100000",
                    }),
                    btn("ゴールド追加", actionGold),
                ),
                row(
                    el("input", {
                        type: "number",
                        id: "adm-points",
                        value: "100",
                    }),
                    btn("ステPt追加", actionPoints),
                ),
                row(
                    el("input", {
                        type: "number",
                        id: "adm-jobexp",
                        value: "5000",
                    }),
                    btn("ジョブEXP追加", actionJobExp),
                ),
                row(
                    el("input", { type: "number", id: "adm-magic-stone", value: "10", min: "1" }),
                    btn("魔石追加", actionMagicStone),
                ),
                row(btn("HP/MP全回復", actionHeal)),
            ),

            fieldset(
                "職業 / スキル",
                row(jobSelect, btn("変更", actionJob)),
                row(
                    btn("現在職業の全スキル習得", actionUnlockAllSkills),
                    btn("習得済みを全てLv10", actionMaxSkillLevels),
                ),
            ),

            fieldset(
                "アイテム",
                row(
                    el("input", {
                        type: "text",
                        id: "adm-item",
                        class: "grow",
                        list: "adm-items",
                        placeholder: "ID or 名前で検索",
                    }),
                    el("input", {
                        type: "number",
                        id: "adm-item-count",
                        value: "1",
                        min: "1",
                    }),
                ),
                row(
                    btn("付与", actionItem),
                    btn("装備を全て外す", actionUnequip),
                ),
                itemList,
            ),

            fieldset(
                "戦闘",
                row(
                    el("label", {}, [
                        el("input", {
                            type: "checkbox",
                            id: "adm-god",
                            onchange: (e) => {
                                flags.god = e.target.checked;
                            },
                        }),
                        document.createTextNode(" 無敵（敵のダメージ無効）"),
                    ]),
                ),
                row(
                    el("label", {}, [
                        el("input", {
                            type: "checkbox",
                            id: "adm-free",
                            onchange: (e) => {
                                flags.free = e.target.checked;
                            },
                        }),
                        document.createTextNode(" MP消費0・クールダウン0"),
                    ]),
                ),
            ),

            fieldset(
                "マップ / クエスト",
                row(mapSelect, btn("移動", actionTeleport)),
                row(
                    btn("進行中を全て達成", actionCompleteActive),
                    btn("全クエスト完了扱い", actionFinishAll),
                ),
                row(btn("クエスト全リセット", actionResetQuests, "danger")),
            ),

            row(btn("adminモード終了", exitAdmin, "danger")),
            el("div", { class: "adm-log" }),
        ]),
    ]);
    setMinimized(minimized); // 前回の最小化状態を復元
    // チェックボックスの初期状態をフラグに合わせる
    panel.querySelector("#adm-god").checked = flags.god;
    panel.querySelector("#adm-free").checked = flags.free;
    isolateKeys(panel);
    document.body.appendChild(panel);
}

// ---------------------------------------------------------------- 各ボタンの処理

function actionLevel() {
    const c = ctx();
    if (!c) return;
    const target = Math.max(1, Math.min(100, num("adm-level", 1)));
    if (target <= c.player.stats.level) {
        log(`すでに Lv.${c.player.stats.level} です（レベルは上げるだけ）`);
        return;
    }
    const gained = c.player.adminLevelUpTo(target);
    log(`Lv.${c.player.stats.level} になりました（+${gained}）`);
}

function actionGold() {
    const c = ctx();
    if (!c) return;
    const n = num("adm-gold");
    if (n === 0) return;
    c.player.gainGold(n);
    refreshUI(c.player);
    log(`ゴールド ${n >= 0 ? "+" : ""}${n}`);
}

function actionPoints() {
    const c = ctx();
    if (!c) return;
    const n = num("adm-points");
    c.player.stats.statPoints = Math.max(
        0,
        (c.player.stats.statPoints || 0) + n,
    );
    refreshUI(c.player);
    log(`ステータスポイント ${n >= 0 ? "+" : ""}${n}`);
}

function actionJobExp() {
    const c = ctx();
    if (!c) return;
    const n = num("adm-jobexp");
    c.player.stats.jobExp = Math.max(0, (c.player.stats.jobExp || 0) + n);
    refreshUI(c.player);
    log(`ジョブEXP ${n >= 0 ? "+" : ""}${n}`);
}

function actionMagicStone() {
    const c = ctx();
    if (!c) return;
    const n = Math.max(1, num("adm-magic-stone", 1));
    c.player.addItem('magic_stone', n);
    refreshUI(c.player);
    log(`魔石 x${n} を付与しました`);
}

function actionHeal() {
    const c = ctx();
    if (!c) return;
    c.player.stats.hp = c.player.stats.maxHp;
    c.player.stats.mp = c.player.stats.maxMp;
    refreshUI(c.player);
    log("HP/MPを全回復しました");
}

function actionJob() {
    const c = ctx();
    if (!c) return;
    const id = panel.querySelector("#adm-job").value;
    if (id !== "none" && !JOBS[id]) {
        log("職業が見つかりません");
        return;
    }
    const p = c.player;
    // 通常の転職(setJob)と違い、習得済みスキルは消さない。スキルバーだけ空にする。
    p.stats.job = id;
    p.stats.activeSkills = p.padActiveSkills([]);
    p.skillCooldowns = {};
    p.applyEquipmentStats();
    p.stats.hp = p.stats.maxHp;
    p.stats.mp = p.stats.maxMp;
    refreshUI(p);
    log(
        `職業を ${id === "none" ? "なし" : JOBS[id].name} にしました（習得済みスキルは維持）`,
    );
}

function actionUnlockAllSkills() {
    const c = ctx();
    if (!c) return;
    const p = c.player;
    const job = p.stats.job;
    if (!JOBS[job]) {
        log("先に職業を選んでください");
        return;
    }

    // SkillManagerUI と同じ「系譜」（ファイター → ナイト など）を遡る
    const lineage = [job];
    let check = job;
    for (;;) {
        const parent = Object.values(JOBS).find((j) =>
            (j.nextJobs || []).includes(check),
        );
        if (!parent) break;
        lineage.push(parent.id);
        check = parent.id;
    }

    let added = 0;
    lineage.forEach((jid) => {
        Object.values(JOBS[jid].skills || {}).forEach((ids) => {
            (ids || []).forEach((skillId) => {
                if (!SKILLS[skillId]) return;
                if (!p.stats.unlockedSkills.includes(skillId)) {
                    p.stats.unlockedSkills.push(skillId);
                    added++;
                }
                if (!p.stats.skillLevels[skillId])
                    p.stats.skillLevels[skillId] = 1;
            });
        });
    });
    p.applyEquipmentStats(); // パッシブを反映
    refreshUI(p);
    log(`スキルを ${added} 個習得しました（K キーで装備）`);
}

function actionMaxSkillLevels() {
    const c = ctx();
    if (!c) return;
    const p = c.player;
    p.stats.unlockedSkills.forEach((id) => {
        p.stats.skillLevels[id] = 10;
    });
    p.applyEquipmentStats();
    refreshUI(p);
    log(`習得済み ${p.stats.unlockedSkills.length} 個を Lv10 にしました`);
}

function actionItem() {
    const c = ctx();
    if (!c) return;
    const raw = panel.querySelector("#adm-item").value.trim();
    const id = raw.split(/\s+/)[0];
    if (!ITEMS[id]) {
        log(`アイテム「${raw}」が見つかりません`);
        return;
    }
    const count = Math.max(1, num("adm-item-count", 1));
    c.player.addItem(id, count);
    refreshUI(c.player);
    log(`${ITEMS[id].name || id} x${count} を付与しました`);
}

function actionUnequip() {
    const c = ctx();
    if (!c) return;
    c.player.stats.equipment = { weapon: null, armor: null, relic: null };
    c.player.applyEquipmentStats();
    refreshUI(c.player);
    log("装備を全て外しました");
}

function actionTeleport() {
    const c = ctx();
    if (!c) return;
    const key = panel.querySelector("#adm-map").value;
    const def = getMapList().find((m) => m.key === key);
    if (!def || !c.scene.scene.get(def.sceneKey)) {
        log("移動先のシーンが見つかりません");
        return;
    }
    if (c.scene._isTeleporting) return;
    c.scene._isTeleporting = true;
    if (c.scene.networkManager)
        c.scene.networkManager.changeMap(def.key, c.player.x, c.player.y);
    c.scene.cameras.main.fadeOut(250, 0, 0, 0);
    c.scene.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
            c.scene.scene.start(def.sceneKey, {
                mapKey: def.key,
                spawn: "default",
            });
        },
    );
    log(`${def.name} へ移動します`);
}

function actionCompleteActive() {
    const c = ctx();
    if (!c) return;
    const qm = c.scene.questManager;
    if (!qm) return;
    const active = Object.values(qm.quests).filter(
        (q) => q.status === "active",
    );
    active.forEach((q) => qm.completeQuest(q.id));
    log(`進行中の ${active.length} 件を達成にしました（NPCに報告すると完了）`);
}

function actionFinishAll() {
    const c = ctx();
    if (!c) return;
    const qm = c.scene.questManager;
    if (!qm) return;
    if (
        !window.confirm(
            "全クエストを「報告済み」にします（報酬なし）。マップの解放条件も満たされます。よろしいですか？",
        )
    )
        return;
    Object.values(QUESTS).forEach((def) => {
        qm.quests[def.id] = {
            ...def,
            progress: def.required || 1,
            status: "finished",
        };
    });
    qm.saveQuests();
    qm.emitUpdate();
    log("全クエストを完了扱いにしました");
}

function actionResetQuests() {
    const c = ctx();
    if (!c) return;
    const qm = c.scene.questManager;
    if (!qm) return;
    if (!window.confirm("全クエストの進行状況を消去します。よろしいですか？"))
        return;
    qm.quests = {};
    qm.saveQuests();
    qm.emitUpdate();
    log("クエストを全てリセットしました");
}
