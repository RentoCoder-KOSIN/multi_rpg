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

// マップJSONの boss_spawn レイヤーからボスのスポーン地点を読み込む（各マップ先頭の1体想定）。
// クエスト用ボス（例: battle.jsonの森の守護者）は、enemy_spawnのように常駐はせず、
// クライアントからの要求があったときだけ出現させる。
function loadBossSpawnPoint(mapKey) {
    const mapPath = path.join(MAPS_DIR, `${mapKey}.json`);
    if (!fs.existsSync(mapPath)) return null;

    const mapData = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const layer = mapData.layers?.find(l => l.name === "boss_spawn");
    if (!layer || !layer.objects?.length) return null;

    const obj = layer.objects[0];
    return {
        x: obj.x,
        y: obj.y,
        type: getObjectProperty(obj, "type") || "boss",
        // マップごとに固定のIDにしておき、同じボスの二重湧きを防止する
        id: `boss_spawn_${mapKey}`
    };
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
            // trueの場合、倒されても enemy.js 側の自動リスポーン処理をスキップする
            // （クエスト用ボスなど、要求されたときだけ出現してほしい敵に使う）
            noAutoRespawn: !!spawn.noAutoRespawn,
            displayName: stats.displayName,
            level: stats.level || 1,
            hp: stats.hp,
            maxHp: stats.hp,
            atk: stats.atk,
            def: stats.def || 0,
            exp: stats.exp,
            gold: stats.gold,
            drops: stats.drops,
            element: stats.element || null
        };

        enemies[mapKey][id] = enemy;

        // AIマネージャーに登録（学習を開始）
        aiManager.registerEnemy(enemy);

        io.to(`map:${mapKey}`).emit("enemySpawned", enemy);
        return enemy;
    }

    // クエスト用ボスなど「要求されたときだけ出現する」敵をスポーンする。
    // 同じスポーン地点のボスが既に生きている場合は何もしない（二重湧き防止）。
    function spawnBossOnDemand(mapKey) {
        const spawn = loadBossSpawnPoint(mapKey);
        if (!spawn) return null;

        const alreadyAlive = Object.values(enemies[mapKey] || {}).some(e => e.spawnId === spawn.id);
        if (alreadyAlive) return null;

        return spawnEnemy(mapKey, { ...spawn, respawnDelay: 0, noAutoRespawn: true });
    }

    // 倒された敵を、死んだ場所ではなく元のスポーン地点で復活させる
    function respawnEnemy(mapKey, deadEnemy) {
        spawnEnemy(mapKey, {
            x: deadEnemy.spawnX,
            y: deadEnemy.spawnY,
            type: deadEnemy.type,
            respawnDelay: deadEnemy.respawnDelay,
            id: deadEnemy.spawnId
        });
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

    return { spawnEnemy, respawnEnemy, spawnInitialEnemies, getEnemiesOnMap, spawnBossOnDemand };
}

module.exports = { createEnemyService };
