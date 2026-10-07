// タイルセット画像のファイル名(拡張子なし・小文字) -> assets.js で読み込んだテクスチャキー
const TILESET_TEXTURES = { tilechip: 'tiles', water: 'water', lava: 'lava' };

/**
 * マップJSONに書かれたタイルセットを、画像のファイル名から対応するテクスチャに結び付ける。
 * Tiled上のタイルセット名(例: "waters")がテクスチャキー("water")と違っていても読み込める。
 * 以前は名前が一致しないタイルセット(湿地の水など)が null になり、そのタイルが描かれなかった。
 *
 * @returns {Phaser.Tilemaps.Tileset[]}
 */
export function addMapTilesets(scene, map, mapKey) {
    const rawTilesets = scene.cache.tilemap.get(mapKey)?.data?.tilesets || [];
    const list = [];

    rawTilesets.forEach(ts => {
        const base = String(ts.image || '').split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
        const textureKey = TILESET_TEXTURES[base] || (scene.textures.exists(ts.name) ? ts.name : null);
        if (!textureKey) {
            console.warn(`[tilemap] ${mapKey}: タイルセット "${ts.name}" (${ts.image}) に対応する画像が読み込まれていません`);
            return;
        }
        const tileset = map.addTilesetImage(ts.name, textureKey);
        if (tileset) list.push(tileset);
    });

    if (list.length === 0) {
        // 想定外の形式（外部tsxなど）のときは、従来どおりの名前で読み込む
        [['tiles', 'tiles'], ['water', 'water'], ['lava', 'lava']].forEach(([name, key]) => {
            const tileset = map.addTilesetImage(name, key);
            if (tileset) list.push(tileset);
        });
    }
    return list;
}

export function setupTilemap(scene, map, tileset) {
    const collidableLayers = [];
    // 複数タイルセット(tiles/water/lava等)を跨ぐマップに対応するため配列で扱う
    const tilesetList = Array.isArray(tileset) ? tileset.filter(Boolean) : [tileset];

    map.layers.forEach(layerData => {
        const layer = map.createLayer(layerData.name, tilesetList, 0, 0);
        if (!layer) return;

        // Tiledで layer の名前を "front_*" / "roof_*" にすると、プレイヤーより
        // 手前へ描ける。既存のマップを壊さず、2Dの前後・高さ表現を段階的に足せる。
        if (/^(front|roof)_/i.test(layerData.name)) layer.setDepth(100000);

        const hasCollision = layerData.properties?.some(
            p => p.name === 'collides' && p.value === true
        );

        if (hasCollision) {
            layer.setCollisionByExclusion([-1]);
            collidableLayers.push(layer);
        }

        if (typeof layer.setRoundPixels === 'function') {
            layer.setRoundPixels(true);
        }
    });

    return { collidableLayers };
}
