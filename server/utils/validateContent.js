/**
 * マップと敵のデータを点検する（起動時の警告と、`npm run check` の両方で使う）。
 *
 * 見つけたいのは「マップを増やした時にやりがちなミス」:
 *   - 転移先のマップ名 / スポーン名のタイプミス
 *   - enemy_spawn の type が敵データに無い（無いとスライム扱いになり、画像も出ない）
 *   - 敵の sprite ファイルが client/assets/enemy/ に無い
 *   - どこからも行けない（転移で辿り着けない）マップ
 * どれも警告を出すだけで、サーバーは止めない。
 */
const fs = require("fs");
const path = require("path");
const { KNOWN_MAPS, CLIENT_DIR } = require("../config");
const { ENEMY_STATS } = require("../data/enemyStats");
const { readMapJson, readProps, resolveMapKey } = require("../data/maps");

const ENEMY_SPRITE_DIR = path.join(CLIENT_DIR, "assets", "enemy");
// ゲーム開始時にいるマップ（ここから転移で辿れるか調べる）
const START_MAPS = ["tutorial", "city"];

function objectsOf(mapJson, layerName) {
    const layer = (mapJson?.layers || []).find(l => l.name === layerName && l.type === "objectgroup");
    return layer ? layer.objects || [] : [];
}

function analyze() {
    const problems = [];
    const maps = {};

    for (const key of KNOWN_MAPS) {
        const json = readMapJson(key);
        if (!json || !Array.isArray(json.layers)) {
            problems.push(`[マップ] ${key}.json はTiledのマップとして読めません`);
            continue;
        }

        const enemies = {};
        for (const o of objectsOf(json, "enemy_spawn")) {
            const type = readProps(o.properties).type || "slime";
            enemies[type] = (enemies[type] || 0) + 1;
        }
        // 同じ間違いが何十個も並ばないよう、typeごとに1行にまとめる
        for (const [type, count] of Object.entries(enemies)) {
            if (!ENEMY_STATS[type]) {
                problems.push(`[敵] ${key}: enemy_spawn の type "${type}" は敵データにありません（${count}か所。スライム扱いになります）`);
            }
        }

        const spawnNames = objectsOf(json, "PlayerSpawn").map(o => o.name).filter(Boolean);
        if (objectsOf(json, "PlayerSpawn").length === 0) {
            problems.push(`[マップ] ${key}: PlayerSpawn レイヤーが無い/空です（入った時の出現位置が決まりません）`);
        }

        const teleports = objectsOf(json, "Teleports").map(o => {
            const p = readProps(o.properties);
            return { targetMap: p.targetMap, targetSpawn: p.targetSpawn, requiredQuest: p.requiredQuest, unlocked: !!p.unlocked };
        });

        maps[key] = { enemies, spawnNames, teleports, name: readProps(json.properties).displayName };
    }

    // 転移先の存在チェックと、到達可能性
    const edges = {};
    for (const [key, info] of Object.entries(maps)) {
        edges[key] = new Set();
        for (const tp of info.teleports) {
            const target = resolveMapKey(tp.targetMap);
            if (!target) {
                problems.push(`[転移] ${key}: targetMap "${tp.targetMap}" というマップはありません`);
                continue;
            }
            edges[key].add(target);
            tp.resolved = target;
            if (tp.targetSpawn && maps[target] && !maps[target].spawnNames.includes(tp.targetSpawn)) {
                problems.push(`[転移] ${key} -> ${target}: targetSpawn "${tp.targetSpawn}" が ${target} の PlayerSpawn に無いため、先頭の出現位置になります`);
            }
        }
    }

    const reached = new Set(START_MAPS.filter(m => maps[m]));
    const queue = [...reached];
    while (queue.length) {
        for (const next of edges[queue.shift()] || []) {
            if (!reached.has(next)) {
                reached.add(next);
                queue.push(next);
            }
        }
    }
    const unreachable = Object.keys(maps).filter(k => !reached.has(k));
    for (const k of unreachable) {
        problems.push(`[転移] ${k} には、${START_MAPS.join(" / ")} から転移で辿り着けません（どのマップの Teleports からも入口が無い）`);
    }

    // 敵データ側
    for (const [type, s] of Object.entries(ENEMY_STATS)) {
        if (!fs.existsSync(path.join(ENEMY_SPRITE_DIR, s.sprite))) {
            problems.push(`[敵] ${type}: 画像 client/assets/enemy/${s.sprite} がありません`);
        }
    }

    return { maps, problems, unreachable };
}

/** 起動時: 問題があれば警告だけ出す */
function warnAboutContent() {
    const { problems } = analyze();
    if (problems.length === 0) {
        console.log(`[content] マップ${KNOWN_MAPS.length}件・敵${Object.keys(ENEMY_STATS).length}種を確認しました（問題なし）`);
        return;
    }
    console.warn(`[content] ${problems.length}件の注意があります（詳しくは npm run check）`);
    problems.forEach(p => console.warn(`  - ${p}`));
}

module.exports = { analyze, warnAboutContent };
