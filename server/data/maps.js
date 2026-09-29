/**
 * マップのメタ情報（サーバー側 - Node.js CommonJS）
 *
 * マップの一覧は assets/maps/*.json から自動検出される（config.js の KNOWN_MAPS）。
 * 新しいマップは、Tiledで作ったJSONを置いて、Tiledの「マップのプロパティ」に
 * 次のカスタムプロパティを付ければ、コードを触らずに追加できる。
 *
 *   displayName        (string) 画面に出す名前。省略するとマップキー
 *   showQuestTracker   (bool)   クエストトラッカーを出すか。省略時 true
 *   showDebugKey       (bool)   Dキーのデバッグ表示を有効にするか。省略時 true
 *
 * 下の MAP_META は「Tiledにプロパティを付ける前から存在した」既存マップ用の補足。
 * Tiled側のプロパティが優先される。
 */
const fs = require("fs");
const path = require("path");
const { MAPS_DIR, KNOWN_MAPS } = require("../config");

const MAP_META = {
    tutorial: { name: "チュートリアル", sceneKey: "GameScene" }, // GameSceneがtutorialマップを担当
    battle: { name: "戦場", showQuestTracker: false, showDebugKey: false },
    city: { name: "街" },
    forest: { name: "森" },
    wetland: { name: "湿地" },
    volcano: { name: "火山" },
    guild1f: { name: "ギルド1F" },
    guild2f: { name: "ギルド2F" },
};

// 昔のTiledデータで使われていた別名（小文字で比較する）
const LEGACY_ALIASES = { battlescene: "battle" };

function readMapJson(mapKey) {
    const file = path.join(MAPS_DIR, `${mapKey}.json`);
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        console.warn(`[maps] ${mapKey}.json を読み込めませんでした: ${e.message}`);
        return null;
    }
}

// Tiledのカスタムプロパティ配列 -> { name: value }
function readProps(list) {
    const out = {};
    for (const p of list || []) out[p.name] = p.value;
    return out;
}

/** クライアントに渡すマップ一覧 */
function getPublicMaps() {
    return KNOWN_MAPS.map(key => {
        const meta = MAP_META[key] || {};
        const props = readProps(readMapJson(key)?.properties);
        return {
            key,
            name: props.displayName ?? meta.name ?? key,
            sceneKey: meta.sceneKey || key,
            file: `assets/maps/${key}.json`,
            showQuestTracker: props.showQuestTracker ?? meta.showQuestTracker ?? true,
            showDebugKey: props.showDebugKey ?? meta.showDebugKey ?? true,
        };
    });
}

/**
 * 転移先の名前(マップキー / シーンキー / 大文字小文字違い / 旧別名)を、マップキーに解決する。
 * @returns {string|null} 見つからなければ null
 */
function resolveMapKey(name) {
    if (!name) return null;
    if (KNOWN_MAPS.includes(name)) return name;
    for (const key of KNOWN_MAPS) {
        if ((MAP_META[key]?.sceneKey || key) === name) return key;
    }
    const lower = String(name).toLowerCase();
    const byCase = KNOWN_MAPS.find(k => k.toLowerCase() === lower);
    if (byCase) return byCase;
    if (LEGACY_ALIASES[lower]) return LEGACY_ALIASES[lower];
    for (const key of KNOWN_MAPS) {
        if ((MAP_META[key]?.sceneKey || key).toLowerCase() === lower) return key;
    }
    return null;
}

module.exports = { MAP_META, getPublicMaps, resolveMapKey, readMapJson, readProps };
