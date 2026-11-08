// セーブデータの保存先（サーバーのアカウント）を扱うモジュール。
//
// 以前は localStorage に直接保存していたため、別のPCではデータが使えなかった。
// 今はログイン時にサーバーからセーブを取得してメモリ(cache)に置き、
// 読み書きはこの cache に対して同期的に行う（Player.js などの既存コードがそのまま使える）。
// 変更はまとめて（デバウンスして）サーバーへアップロードする。
//
// 使い方:
//   getSaved('playerStats')            // 読み出し（無ければ null）
//   setSaved('playerStats', stats)     // 書き込み（自動でサーバーへ送信）
//   removeSaved('playerStats')         // 削除（「最初から」用）

const TOKEN_KEY = "mrpg_token";
const PWD_STORAGE_KEY = "mrpg_spwd";
const LEGACY_KEYS = ["playerStats", "playerQuests"]; // アカウント導入前の localStorage キー
const UPLOAD_DELAY_MS = 2500;

let session = null; // { token, username, playerId }
let sessionPassword = null; // 現在のセッションのパスワード（JSONダウンロード用）
let cache = { playerStats: null, playerQuests: null };
let dirty = false;
let timer = null;
let uploading = false;
let disabled = false; // 他の端末でログインされた後は、古い画面から上書きしない

function setSessionPassword(pwd) {
    sessionPassword = pwd || null;
    if (typeof sessionStorage !== "undefined") {
        if (pwd) sessionStorage.setItem(PWD_STORAGE_KEY, pwd);
        else sessionStorage.removeItem(PWD_STORAGE_KEY);
    }
}

// ---------- API ----------
async function api(path, { method = "POST", body, token, keepalive = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, {
        method, headers, keepalive,
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* 本文なし */ }
    if (!res.ok) {
        const err = new Error(data.error || `サーバーエラー (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return data;
}

function applySession(data) {
    session = { token: data.token, username: data.username, playerId: data.playerId };
    if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, data.token);
    cache = {
        playerStats: data.save?.stats ?? null,
        playerQuests: data.save?.quests ?? null,
    };
    dirty = false;
    disabled = false;
    return session;
}

// 以前この端末に保存していたセーブ（あれば）。新規登録時の引き継ぎに使う。
export function getLegacySave() {
    if (typeof localStorage === "undefined") return null;
    try {
        const stats = JSON.parse(localStorage.getItem("playerStats"));
        if (!stats) return null;
        const quests = JSON.parse(localStorage.getItem("playerQuests")) || {};
        return { stats, quests };
    } catch (_) {
        return null;
    }
}

export function clearLegacySave() {
    if (typeof localStorage !== "undefined") LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
}

export async function register(username, password, legacySave = null, autoDownload = true) {
    const res = await api("/api/register", { body: { username, password, legacySave } });
    setSessionPassword(password);
    const s = applySession(res);
    if (autoDownload) {
        try {
            exportAccountJson(password);
        } catch (e) {
            console.warn("[saveStore] auto export json failed:", e);
        }
    }
    return s;
}

export async function login(username, password) {
    const res = await api("/api/login", { body: { username, password } });
    setSessionPassword(password);
    return applySession(res);
}

// 保存済みトークンで自動ログイン。失敗したら null（ログイン画面を出す）
export async function restoreSession() {
    if (typeof localStorage === "undefined") return null;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    try {
        return applySession(await api("/api/session", { token }));
    } catch (err) {
        if (err.status === 401) localStorage.removeItem(TOKEN_KEY);
        return null;
    }
}

export async function changePassword(oldPassword, newPassword) {
    const data = await api("/api/change-password", {
        token: session?.token, body: { oldPassword, newPassword },
    });
    session = { ...session, token: data.token };
    setSessionPassword(newPassword);
    if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, data.token);
}

export function logout() {
    flushSave(true);
    session = null;
    setSessionPassword(null);
    cache = { playerStats: null, playerQuests: null };
    if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

// ---------- アカウント / セーブの JSON エクスポート & インポート ----------
export function exportAccountJson(customPassword = null) {
    if (!session) return null;
    const pwd = customPassword || sessionPassword || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(PWD_STORAGE_KEY) : null) || undefined;
    const data = {
        version: 1,
        game: "multi_rpg",
        exportedAt: new Date().toISOString(),
        username: session.username,
        password: pwd,
        save: {
            stats: cache.playerStats,
            quests: cache.playerQuests || {},
        },
    };
    if (typeof window !== "undefined" && typeof document !== "undefined") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        a.download = `rpg_account_${session.username}_${timeStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    return data;
}

export async function saveAndExportJson() {
    await flushSave();
    return exportAccountJson();
}

export function parseAccountJson(text) {
    let raw;
    try {
        raw = typeof text === "string" ? JSON.parse(text) : text;
    } catch (_) {
        throw new Error("無効なJSONフォーマットです");
    }
    if (!raw || typeof raw !== "object") throw new Error("無効なJSONデータです");

    // 多様な形式（独自バックアップ形式、accounts.json の抜粋など）を吸収
    const username = raw.username || raw.account?.username || "";
    const password = raw.password || raw.account?.password || "";
    let save = raw.save || null;
    if (!save && (raw.stats || raw.playerStats)) {
        save = {
            stats: raw.stats || raw.playerStats,
            quests: raw.quests || raw.playerQuests || {},
        };
    }
    if (!username) {
        throw new Error("JSON内にユーザー名が見つかりませんでした");
    }

    const stats = save?.stats;
    const summary = {
        username,
        hasPassword: !!password,
        level: stats?.level ?? 1,
        job: stats?.job ?? "none",
        gold: stats?.gold ?? 0,
        exportedAt: raw.exportedAt || stats?.updatedAt || null,
    };

    return {
        raw,
        username,
        password,
        save,
        summary,
    };
}

export async function restoreFromJson(dataOrText, fallbackPassword = "") {
    const parsed = typeof dataOrText === "string" ? parseAccountJson(dataOrText) : (dataOrText.summary ? dataOrText : parseAccountJson(dataOrText));
    const username = parsed.username;
    const password = parsed.password || fallbackPassword;
    if (!password) {
        throw new Error("パスワードを入力してください");
    }
    const res = await api("/api/restore-account", {
        body: { username, password, save: parsed.save }
    });
    setSessionPassword(password);
    return applySession(res);
}

export const getSession = () => session;
export const isLoggedIn = () => !!session;

// ---------- セーブの読み書き ----------
export function getSaved(key) {
    return cache[key] ?? null;
}

export function setSaved(key, value) {
    if (!session || disabled) return;
    // 参照のままだと後からの変更で内容が変わるので、複製して保持する
    cache[key] = JSON.parse(JSON.stringify(value));
    dirty = true;
    if (!timer) timer = setTimeout(() => flushSave(), UPLOAD_DELAY_MS);
}

export async function removeSaved(key) {
    if (!session || disabled) return;
    cache[key] = null;
    if (cache.playerStats === null && cache.playerQuests === null) {
        // 両方消えた = 「最初から」。サーバー側のセーブも削除する
        dirty = false;
        try { await api("/api/save", { method: "DELETE", token: session.token }); } catch (e) { console.warn("[save] delete failed", e); }
    }
}

// すぐ送信する。ページを閉じる直前は keepalive で送る
export async function flushSave(keepalive = false) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!session || disabled || !dirty || !cache.playerStats) return;
    if (uploading && !keepalive) {
        // 送信中に変更が来た場合は、終わった後にもう一度送る
        timer = setTimeout(() => flushSave(), 500);
        return;
    }

    uploading = true;
    dirty = false;
    try {
        await api("/api/save", {
            method: "PUT", token: session.token, keepalive,
            body: { stats: cache.playerStats, quests: cache.playerQuests || {} },
        });
    } catch (err) {
        dirty = true; // 失敗したら次回また送る
        console.warn("[save] upload failed:", err.message);
        if (err.status === 401) disabled = true;
        else if (!timer) timer = setTimeout(() => flushSave(), 10000);
    } finally {
        uploading = false;
    }
}

// 他の端末でログインされた時など、この画面からの保存を止める
export function disableSaving() {
    disabled = true;
    if (timer) { clearTimeout(timer); timer = null; }
}

if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => flushSave(true));
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushSave(true);
    });
}
