export function setupTilemap(scene, map, tileset) {
    const collidableLayers = [];

    map.layers.forEach(layerData => {
        const layer = map.createLayer(layerData.name, tileset, 0, 0);
        if (!layer) return;

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
