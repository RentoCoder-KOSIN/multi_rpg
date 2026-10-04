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
