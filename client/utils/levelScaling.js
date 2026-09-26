// レベル差によるダメージ補正
// 攻撃側と防御側のレベル差が大きいほど、レベルが高い側に有利な結果になる
// (レベルが高い側の与ダメージは伸び、被ダメージはほぼ通らなくなる)

const PER_LEVEL_FACTOR = 1.05; // レベル1差につき±5%相当（指数的に効いてくる）
const MIN_MULTIPLIER = 0.05;   // 格上相手には最低でもこれだけは通る
const MAX_MULTIPLIER = 5.0;    // 格下相手への与ダメージはここで頭打ち

/**
 * attackerLevel と defenderLevel の差からダメージ倍率を計算する。
 * プレイヤー・敵・召喚獣のいずれの組み合わせでも共通して使う。
 */
export function getLevelDiffMultiplier(attackerLevel = 1, defenderLevel = 1) {
    const diff = (attackerLevel || 1) - (defenderLevel || 1);
    const raw = Math.pow(PER_LEVEL_FACTOR, diff);
    return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, raw));
}
