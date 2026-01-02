// utils/playerSpawn.js

/**
 * resolvePlayerSpawn
 * - Tiled の PlayerSpawn レイヤー先頭オブジェクトの位置を返す
 * - 中央下基準に補正
 *
 * @param {Phaser.Tilemaps.Tilemap} map
 * @param {object} data - { spawn?: string, x?: number, y?: number }（オプション）
 * @param {object} fallback - 失敗時の座標 { x:number, y:number }
 * @returns {{x:number, y:number}}
 */
export function resolvePlayerSpawn(map, data = {}, fallback = { x: 400, y: 1256 }) {
    if (!map) {
        console.error('[resolvePlayerSpawn] Invalid map object! Using fallback.');
        return fallback;
    }

    // 複数の方法でPlayerSpawnレイヤーを取得
    let spawnLayer = null;
    let spawnObjects = null;

    // 方法1: getObjectLayer を使用
    if (typeof map.getObjectLayer === 'function') {
        spawnLayer = map.getObjectLayer('PlayerSpawn');
        if (spawnLayer && spawnLayer.objects) {
            spawnObjects = spawnLayer.objects;
        }
    }

    // 方法2: map.layers から直接検索（getObjectLayerが動作しない場合のフォールバック）
    if (!spawnObjects && map.layers) {
        const layerData = map.layers.find(l => l.name === 'PlayerSpawn' && l.type === 'objectgroup');
        if (layerData && layerData.objects) {
            spawnObjects = layerData.objects;
        }
    }

    // 方法3: objectsFromObjectLayer を使用（Phaser 3の別のAPI）
    if (!spawnObjects && typeof map.objectsFromObjectLayer === 'function') {
        spawnObjects = map.objectsFromObjectLayer('PlayerSpawn');
    }

    // デバッグ: 利用可能なレイヤー名を表示
    if (!spawnObjects && map.layers) {
        const availableLayers = map.layers.map(l => `${l.name} (${l.type})`).join(', ');
        console.warn('[resolvePlayerSpawn] PlayerSpawn layer not found. Available layers:', availableLayers);
    }

    if (!spawnObjects || !Array.isArray(spawnObjects) || spawnObjects.length === 0) {
        console.warn('[resolvePlayerSpawn] PlayerSpawn layer missing or empty! Using fallback.');
        return fallback;
    }

    // spawn名指定
    if (data.spawn) {
        const obj = spawnObjects.find(o => o.name === data.spawn);
        if (obj) {
            const x = obj.x + (obj.width || 0) / 2;
            const y = obj.y + (obj.height || 0);
            console.log(`[resolvePlayerSpawn] Found spawn '${data.spawn}' at (${x}, ${y})`);
            return { x, y };
        } else {
            console.warn(`[resolvePlayerSpawn] spawn='${data.spawn}' not found. Using default.`);
        }
    }

    // x,y指定（ただし、0,0や無効な値の場合はPlayerSpawnレイヤーを優先）
    if (typeof data.x === 'number' && typeof data.y === 'number') {
        // 0,0や非常に小さい値の場合は、PlayerSpawnレイヤーを優先
        if (data.x === 0 && data.y === 0) {
            console.warn('[resolvePlayerSpawn] Explicit coordinates are (0, 0), using PlayerSpawn layer instead');
        } else {
            console.log(`[resolvePlayerSpawn] Using explicit coordinates (${data.x}, ${data.y})`);
            return { x: data.x, y: data.y };
        }
    }

    // レイヤー先頭オブジェクト
    const obj = spawnObjects[0];
    const x = obj.x + (obj.width || 0) / 2;
    const y = obj.y + (obj.height || 0);
    console.log(`[resolvePlayerSpawn] Using first PlayerSpawn object at (${x}, ${y}) from object:`, obj);
    return { x, y };
}
