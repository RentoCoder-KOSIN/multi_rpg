/**
 * 「遺跡(ruins)」マップを、湿地(wetland)と火山(volcano)の間に1回だけ追加するスクリプト。
 *
 *   cd server && npm run add-ruins          (既に ruins.json があれば作り直さない)
 *   cd server && npm run add-ruins -- --force   (ruins.json を作り直す)
 *
 * やること（client/assets/maps/ 内のTiledのJSONを書き換える。書き換える前に *.bak を作る）:
 *   1. wetland.json を土台に ruins.json を作る
 *        - enemy_spawn の敵を、湿地の敵のレベル順に ruins_skeleton / ruins_goblin / ruins_wolf へ置き換え、
 *          湿地のマップボス(swamp_boss)は ruins_boss に置き換える
 *        - マップのプロパティ displayName を「遺跡」にする
 *   2. 街(湿地と火山の両方への転移を持つマップ)の Teleports を書き換える
 *        - 火山への転移の requiredQuest を「遺跡のクリアクエスト」に変更
 *        - 湿地への転移を複製して「遺跡への転移」を追加（requiredQuest は元の火山用 = 湿地のクリアクエスト）
 *
 * 地形の見た目は湿地のコピーなので、気が向いたらTiledで遺跡らしく描き直す。
 * 追加した転移の位置は、湿地用と火山用の転移の中間に置くだけなので、Tiledで通れる場所に動かすこと。
 */
const fs = require("fs");
const path = require("path");
const { MAPS_DIR } = require("../config");
const { ENEMY_STATS } = require("../data/enemyStats");

const FORCE = process.argv.includes("--force");

// クライアントの MAP_CLEAR_QUESTS と同じ内容（ここを変えたら client/data/quests.js も合わせる）
const WETLAND_CLEAR = ["wetland_red_slime", "kill_goblin", "swamp_boss_quest"];
const RUINS_CLEAR = ["ruins_skeleton_hunt", "ruins_goblin_hunt", "ruins_wolf_hunt", "ruins_boss_quest"];
const RUINS_ENEMIES = ["ruins_skeleton", "ruins_goblin", "ruins_wolf"];
const RUINS_BOSS = "ruins_boss";

const mapPath = (key) => path.join(MAPS_DIR, `${key}.json`);
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");

function getProp(obj, name) {
    return (obj.properties || []).find((p) => p.name === name)?.value;
}

function setProp(obj, name, value, type = "string") {
    obj.properties = obj.properties || [];
    const found = obj.properties.find((p) => p.name === name);
    if (found) {
        found.value = value;
    } else {
        obj.properties.push({ name, type, value });
    }
}

function objectsOf(json, layerName) {
    const layer = (json.layers || []).find((l) => l.name === layerName && l.type === "objectgroup");
    return layer ? layer.objects || [] : [];
}

/** 湿地のenemy_spawnの敵を遺跡の敵に置き換える対応表を作る */
function buildEnemyMapping(wetlandJson) {
    const types = [...new Set(objectsOf(wetlandJson, "enemy_spawn").map((o) => getProp(o, "type") || "slime"))];
    const isBoss = (t) => ENEMY_STATS[t]?.size === "boss";
    const normal = types
        .filter((t) => !isBoss(t))
        .sort((a, b) => (ENEMY_STATS[a]?.level || 0) - (ENEMY_STATS[b]?.level || 0));

    const mapping = {};
    normal.forEach((t, i) => {
        mapping[t] = RUINS_ENEMIES[Math.min(RUINS_ENEMIES.length - 1, Math.floor((i * RUINS_ENEMIES.length) / normal.length))];
    });
    types.filter(isBoss).forEach((t) => {
        mapping[t] = RUINS_BOSS;
    });
    return mapping;
}

function createRuinsMap() {
    const wetlandFile = mapPath("wetland");
    const ruinsFile = mapPath("ruins");
    if (!fs.existsSync(wetlandFile)) {
        throw new Error(`${wetlandFile} が見つかりません（土台にする湿地マップが必要です）`);
    }
    if (fs.existsSync(ruinsFile) && !FORCE) {
        console.log("[ruins] ruins.json は既にあるので作り直しません（作り直すなら --force）");
        return false;
    }
    if (fs.existsSync(ruinsFile)) fs.copyFileSync(ruinsFile, `${ruinsFile}.bak`);

    const json = readJson(wetlandFile);
    const mapping = buildEnemyMapping(json);
    const summary = {};
    for (const o of objectsOf(json, "enemy_spawn")) {
        const from = getProp(o, "type") || "slime";
        const to = mapping[from] || RUINS_ENEMIES[0];
        setProp(o, "type", to);
        summary[`${from} -> ${to}`] = (summary[`${from} -> ${to}`] || 0) + 1;
    }
    setProp(json, "displayName", "遺跡");
    writeJson(ruinsFile, json);

    console.log("[ruins] ruins.json を作成しました（湿地をコピーして敵を置き換え）");
    Object.entries(summary).forEach(([k, n]) => console.log(`        ${k} x${n}`));
    if (!Object.keys(summary).length) console.log("        (湿地に enemy_spawn が無かったので、敵は置き換えていません)");
    return true;
}

/** 街のように「湿地への転移」と「火山への転移」を両方持つマップを書き換える */
function patchHubMaps() {
    const files = fs.readdirSync(MAPS_DIR).filter((f) => f.endsWith(".json") && !["wetland.json", "ruins.json"].includes(f));
    let patched = 0;

    for (const f of files) {
        const file = path.join(MAPS_DIR, f);
        const json = readJson(file);
        const layer = (json.layers || []).find((l) => l.name === "Teleports" && l.type === "objectgroup");
        if (!layer) continue;

        const toWetland = layer.objects.filter((o) => getProp(o, "targetMap") === "wetland");
        const toVolcano = layer.objects.filter((o) => getProp(o, "targetMap") === "volcano");
        const hasRuins = layer.objects.some((o) => getProp(o, "targetMap") === "ruins");
        if (!toVolcano.length) continue;

        let changed = false;
        // 火山へ行く条件を「遺跡を全部クリア」に変える
        for (const o of toVolcano) {
            const want = RUINS_CLEAR.join(",");
            if (getProp(o, "requiredQuest") !== want) {
                setProp(o, "requiredQuest", want);
                changed = true;
            }
        }

        // 遺跡への転移を足す（湿地への転移をひな形にする）
        if (!hasRuins && toWetland.length) {
            const base = toWetland[0];
            const volcano = toVolcano[0];
            const clone = JSON.parse(JSON.stringify(base));
            clone.id = json.nextobjectid || Math.max(0, ...layer.objects.map((o) => o.id || 0)) + 1;
            json.nextobjectid = clone.id + 1;
            clone.name = "to_ruins";
            clone.x = Math.round((base.x + volcano.x) / 2);
            clone.y = Math.round((base.y + volcano.y) / 2);
            setProp(clone, "targetMap", "ruins");
            // 入口の出現位置: 湿地用の転移が指す名前をそのまま使う（ruins.json は湿地のコピーなので同じ名前がある）
            setProp(clone, "requiredQuest", WETLAND_CLEAR.join(","));
            layer.objects.push(clone);
            changed = true;
            console.log(`[ruins] ${f}: 遺跡への転移を追加しました (x=${clone.x}, y=${clone.y}) ← Tiledで通れる場所に動かしてください`);
        } else if (!hasRuins) {
            console.log(`[ruins] ${f}: 湿地への転移が無いので、遺跡への転移は自動で足せません。` +
                `Tiledで targetMap=ruins / requiredQuest=${WETLAND_CLEAR.join(",")} の転移を足してください`);
        }

        if (changed) {
            fs.copyFileSync(file, `${file}.bak`);
            writeJson(file, json);
            console.log(`[ruins] ${f}: 火山への転移の requiredQuest を遺跡のクリアクエストに変更しました`);
            patched++;
        }
    }

    if (!patched) console.log("[ruins] 火山への転移を持つマップが見つからない（または変更済み）でした");
}

try {
    createRuinsMap();
    patchHubMaps();
    console.log("\n完了。`npm run check` でつながりと敵の配置を確認してください。");
} catch (e) {
    console.error(`[ruins] 失敗: ${e.message}`);
    process.exitCode = 1;
}
