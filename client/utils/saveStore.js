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
const LEGACY_KEYS = ["playerStats", "playerQuests"]; // アカウント導入前の localStorage キー
const UPLOAD_DELAY_MS = 2500;

let session = null; // { token, username, playerId }
let cache = { playerStats: null, playerQuests: null };
let dirty = false;
let timer = null;
let uploading = false;
let disabled = false; // 他の端末でログインされた後は、古い画面から上書きしない

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
    localStorage.setItem(TOKEN_KEY, data.token);
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
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
}

export async function register(username, password, legacySave = null) {
    return applySession(await api("/api/register", { body: { username, password, legacySave } }));
}

export async function login(username, password) {
    return applySession(await api("/api/login", { body: { username, password } }));
}

// 保存済みトークンで自動ログイン。失敗したら null（ログイン画面を出す）
export async function restoreSession() {
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
    localStorage.setItem(TOKEN_KEY, data.token);
}

export function logout() {
    flushSave(true);
    session = null;
    cache = { playerStats: null, playerQuests: null };
    localStorage.removeItem(TOKEN_KEY);
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
