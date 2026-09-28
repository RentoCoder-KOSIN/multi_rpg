/**
 * 属性システム（火・水・雷・風・土・光・闇）。
 *
 * 相性は5すくみの輪:
 *   火 → 土 → 風 → 雷 → 水 → 火 （この順で「強い」）
 *
 *   火: 土に強く、水に弱い
 *   水: 火に強く、雷に弱い
 *   雷: 水に強く、風に弱い
 *   風: 雷に強く、土に弱い
 *   土: 風に強く、火に弱い
 *   光 ⇔ 闇: 互いに強い（光は闇に、闇は光に1.7倍）
 *   光・闇は上の5属性とは無関係（1.0倍）
 *
 * ダメージ倍率:
 *   有利（相手の弱点を突く）: 1.7倍
 *   特に関係なし（無属性 / 同属性 / 無関係な組み合わせ）: 1.0倍
 *   不利（相手が得意な属性で受ける）: 0.6倍
 */

export const ELEMENTS = ['fire', 'water', 'thunder', 'wind', 'earth', 'light', 'dark'];

export const ELEMENT_INFO = {
    fire: { name: '火', icon: '🔥', color: 0xff5533 },
    water: { name: '水', icon: '💧', color: 0x3399ff },
    thunder: { name: '雷', icon: '⚡', color: 0xffdd33 },
    wind: { name: '風', icon: '🌪️', color: 0x66ffcc },
    earth: { name: '土', icon: '🪨', color: 0xcc9944 },
    light: { name: '光', icon: '✨', color: 0xffee99 },
    dark: { name: '闇', icon: '🌑', color: 0x9955cc },
};

// key(攻撃側属性) が value(防御側属性) に対して有利（1.7倍）
export const STRONG_AGAINST = {
    fire: 'earth',
    earth: 'wind',
    wind: 'thunder',
    thunder: 'water',
    water: 'fire',
    light: 'dark',
    dark: 'light',
};

export function getElementName(element) {
    return ELEMENT_INFO[element]?.name || '無';
}

export function getElementIcon(element) {
    return ELEMENT_INFO[element]?.icon || '';
}

export function getElementColor(element) {
    return ELEMENT_INFO[element]?.color ?? 0xffffff;
}

export function getOrbItemId(element) {
    return `${element}_orb`;
}

/**
 * 攻撃側属性 vs 防御側属性のダメージ倍率。
 * どちらかが未設定（無属性）なら常に1.0。
 */
export function getElementMultiplier(attackElement, defenseElement) {
    if (!attackElement || !defenseElement) return 1.0;
    if (STRONG_AGAINST[attackElement] === defenseElement) return 1.7;
    if (STRONG_AGAINST[defenseElement] === attackElement) return 0.6;
    return 1.0;
}

