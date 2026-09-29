/**
 * Map registry cache.
 * The server discovers maps from assets/maps/*.json (server/data/maps.js);
 * the client fetches the list once at boot via loadMaps(), then builds one Phaser
 * scene per map (scenes/mapScenes.js). Nothing here needs editing to add a map.
 */

let maps = [];

// 昔のTiledデータで使われていた転移先の別名（小文字で比較する）
const LEGACY_ALIASES = { battlescene: 'battle' };

/**
 * Fetch the map list from the server. Call once before starting Phaser.
 */
export async function loadMaps() {
    const res = await fetch('/api/maps');
    if (!res.ok) throw new Error(`Failed to load maps: HTTP ${res.status}`);
    maps = await res.json();
}

/** @returns {Array<{key:string,name:string,sceneKey:string,file:string,showQuestTracker:boolean,showDebugKey:boolean}>} */
export function getMapList() {
    return maps;
}

/**
 * マップキー / シーンキー / 大文字小文字違い / 旧別名 のどれからでもマップ定義を引く。
 * @returns {object|null}
 */
export function findMap(name) {
    if (!name) return null;
    const lower = String(name).toLowerCase();
    return maps.find(m => m.key === name) ||
        maps.find(m => m.sceneKey === name) ||
        maps.find(m => m.key.toLowerCase() === lower) ||
        maps.find(m => m.sceneKey.toLowerCase() === lower) ||
        maps.find(m => m.key === LEGACY_ALIASES[lower]) ||
        null;
}

/** 転移先の名前を、Phaserのシーンキーに解決する（見つからなければnull） */
export function resolveSceneKey(name) {
    return findMap(name)?.sceneKey ?? null;
}

/** シーンキー(GameSceneなど)から、サーバーとやり取りするマップキー(tutorialなど)を返す */
export function getMapKeyForScene(sceneKey) {
    return findMap(sceneKey)?.key ?? sceneKey;
}

/** 画面に出すマップ名（転移先の案内用）。未登録ならキーを大文字にして返す */
export function getMapDisplayName(name) {
    return findMap(name)?.name || String(name).toUpperCase();
}
