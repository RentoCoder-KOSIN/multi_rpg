const fs = require("fs");
const path = require("path");
const { getEnemyStats } = require("../data/enemyStats");
const { MAPS_DIR, KNOWN_MAPS } = require("../config");
const { enemies } = require("../state");

function generateId(type) {
    return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Tiled オブジェクトのカスタムプロパティを名前で取得
function getObjectProperty(object, name) {
    return object.properties?.find(p => p.name === name)?.value;
}

// マップJSONの enemy_spawn レイヤーからスポーン地点を読み込む
function loadSpawnPoints(mapKey) {
    const mapPath = path.join(MAPS_DIR, `${mapKey}.json`);
    if (!fs.existsSync(mapPath)) return [];

    const mapData = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const layer = mapData.layers?.find(l => l.name === "enemy_spawn");
    if (!layer) return [];

    return layer.objects.map(o => ({
        x: o.x,
        y: o.y,
        type: getObjectProperty(o, "type") || "slime",
        respawnDelay: getObjectProperty(o, "respawnDelay") || 5000,
        id: o.id
    }));
}

function createEnemyService({ io, aiManager }) {
    function spawnEnemy(mapKey, spawn) {
        if (!enemies[mapKey]) enemies[mapKey] = {};
        const id = generateId(spawn.type);
        const stats = getEnemyStats(spawn.type);

        const enemy = {
            id,
            type: spawn.type,
            x: spawn.x,
            y: spawn.y,
            spawnX: spawn.x,
            spawnY: spawn.y,
            spawnId: spawn.id,
            respawnDelay: spawn.respawnDelay,
            displayName: stats.displayName,
            hp: stats.hp,
            maxHp: stats.hp,
            atk: stats.atk,
            exp: stats.exp,
            gold: stats.gold,
            drops: stats.drops
        };

        enemies[mapKey][id] = enemy;

        // AIマネージャーに登録（学習を開始）
        aiManager.registerEnemy(enemy);

        io.to(`map:${mapKey}`).emit("enemySpawned", enemy);
    }

    // 全マップの初期敵をスポーンさせる
    function spawnInitialEnemies() {
        KNOWN_MAPS.forEach(mapKey => {
            loadSpawnPoints(mapKey).forEach(spawn => spawnEnemy(mapKey, spawn));
        });
    }

    function getEnemiesOnMap(mapKey) {
        return Object.values(enemies[mapKey] || {});
    }

    return { spawnEnemy, spawnInitialEnemies, getEnemiesOnMap };
}

module.exports = { createEnemyService };
