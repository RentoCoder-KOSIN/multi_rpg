// npm run check: マップのつながり・敵の配置・データの不備をまとめて表示する
const { analyze } = require("../utils/validateContent");
const { ENEMY_STATS } = require("../data/enemyStats");

const { maps, problems } = analyze();

console.log("=== マップのつながり ===");
for (const [key, info] of Object.entries(maps)) {
    const label = info.name ? `${key} (${info.name})` : key;
    console.log(`\n${label}`);
    const tps = info.teleports;
    if (tps.length === 0) console.log("  転移: なし");
    tps.forEach(tp => {
        // クライアントの判定と同じ: unlockedならいつでも通れる。requiredQuestがあればクエスト完了後。どちらも無ければ通れる
        const lock = (!tp.unlocked && tp.requiredQuest) ? ` [クエスト:${tp.requiredQuest}]` : "";
        const spawn = tp.targetSpawn ? ` @${tp.targetSpawn}` : "";
        console.log(`  -> ${tp.resolved || `?${tp.targetMap}`}${spawn}${lock}`);
    });
    const en = Object.entries(info.enemies);
    console.log(en.length ? `  敵: ${en.map(([t, n]) => `${t}x${n}`).join(", ")}` : "  敵: なし");
}

console.log("\n=== 敵の一覧 ===");
const used = new Set(Object.values(maps).flatMap(m => Object.keys(m.enemies)));
for (const [type, s] of Object.entries(ENEMY_STATS)) {
    console.log(`  ${type.padEnd(14)} Lv${String(s.level).padEnd(4)} ${s.sprite.padEnd(20)} ${s.size.padEnd(7)} ${used.has(type) ? "" : "(どのマップにも未配置)"}`);
}

console.log("\n=== 注意 ===");
if (problems.length === 0) console.log("  なし");
problems.forEach(p => console.log(`  - ${p}`));
process.exitCode = problems.length ? 1 : 0;
