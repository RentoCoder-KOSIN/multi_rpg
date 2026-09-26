// SettingsUIで設定した「エフェクト表示」設定を、パーティクルや画面シェイクを
// 生成する各所（skillEffects.js, combat.js, Enemy.js など）から共通で参照するためのヘルパー。
// 重いパーティクルエフェクトが原因のラグ対策として、OFFにすると視覚効果を丸ごとスキップする。
export function areEffectsEnabled(scene) {
    const settings = scene?.registry?.get('settings');
    // 未設定（古いセーブ/未使用時）はデフォルトでON扱いにする
    return !settings || settings.effectsEnabled !== false;
}
