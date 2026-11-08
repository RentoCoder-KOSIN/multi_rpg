// SettingsUIで設定した「エフェクト表示」設定を、パーティクルや画面シェイクを
// 生成する各所（skillEffects.js, combat.js, Enemy.js など）から共通で参照するためのヘルパー。
// 重いパーティクルエフェクトが原因のラグ対策として、OFFにすると視覚効果を丸ごとスキップする。

/**
 * 自身のスキル・攻撃エフェクトや画面演出が有効かどうか
 * @param {Phaser.Scene} scene 
 * @returns {boolean}
 */
export function areEffectsEnabled(scene) {
    const settings = scene?.registry?.get('settings');
    // 未設定（古いセーブ/未使用時）はデフォルトでON扱いにする
    return !settings || settings.effectsEnabled !== false;
}

/**
 * パーティメンバーのエフェクト共有が有効かどうか
 * （設定でオンオフ切替可能。デフォルトON）
 * @param {Phaser.Scene} scene 
 * @returns {boolean}
 */
export function isPartyEffectsEnabled(scene) {
    const settings = scene?.registry?.get('settings');
    return !settings || settings.partyEffectsEnabled !== false;
}

/**
 * 低スペックPC向け軽量化モードが有効かどうか
 * （パーティクル削減、環境演出OFF、背景エフェクト省略でサクサク動作）
 * @param {Phaser.Scene} scene 
 * @returns {boolean}
 */
export function isLowSpecMode(scene) {
    const settings = scene?.registry?.get('settings');
    return !!settings && settings.lowSpecMode === true;
}

/**
 * 画面シェイクが有効かどうか（低スペックモード時やエフェクトOFF時はスキップ）
 * @param {Phaser.Scene} scene 
 * @returns {boolean}
 */
export function isCameraShakeEnabled(scene) {
    return areEffectsEnabled(scene) && !isLowSpecMode(scene);
}
