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

// 経験値のレベル差補正
// プレイヤーが敵よりも圧倒的に高レベル（差が一定以上）の場合、格下狩りによる
// 経験値稼ぎを抑えるため獲得経験値を減らす。逆（敵の方が高レベル）は補正しない。
const EXP_PENALTY_THRESHOLD = 15; // この差未満なら補正なし（等倍）
const EXP_PENALTY_DECAY = 0.85;   // 閾値を超えた1レベル差ごとの減衰率
const EXP_PENALTY_MIN = 0.05;     // 最低保証割合（これ以上は減らさない）

/**
 * プレイヤーレベルと敵レベルの差から経験値倍率を計算する。
 * 差が EXP_PENALTY_THRESHOLD 未満、または敵の方が高レベルの場合は 1.0（補正なし）。
 */
export function getExpLevelMultiplier(playerLevel = 1, enemyLevel = 1) {
    const diff = (playerLevel || 1) - (enemyLevel || 1);
    if (diff < EXP_PENALTY_THRESHOLD) return 1;
    const over = diff - (EXP_PENALTY_THRESHOLD - 1); // 閾値ちょうどで1乗から減衰開始
    return Math.max(EXP_PENALTY_MIN, Math.pow(EXP_PENALTY_DECAY, over));
}
