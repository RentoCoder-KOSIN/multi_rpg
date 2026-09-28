/**
 * 属性システム（データ駆動）。
 *
 * ★新しい属性を足すには ELEMENT_DEFS に1エントリ追加するだけ★
 *   - 鍛冶屋の玉の販売/付与、相性図UI、耐性(xxxResist)、固定ダメージ(xxxDamage)、
 *     ショップの説明文、ダメージ色、敵のname表示、サーバー側の属性チェックまで自動で対応する。
 *   - スキル/敵に属性を付けるときは、その id を element に書くだけ。
 *
 * エントリの項目:
 *   name / icon / color   表示用
 *   strongAgainst         この属性が「有利」を取れる属性idの配列（複数可）。弱点は逆引きで自動導出
 *   orbPrice              鍛冶屋で売る玉の価格（省略時は ELEMENT_RULES.defaultOrbPrice）
 *   weaponBonus           この属性を武器に付与したときの追加効果（省略可）。
 *                         数値はそのままstatsに加算、{ atkRatio, min } は atk×ratio と min の大きい方を加算
 *
 * 現在の相性:
 *   火 → 土 → 風 → 雷 → 水 → 火 （5すくみ。矢印の先に強い）
 *   光 ⇔ 闇（互いに強い） / 上の5属性とは無関係
 */
export const ELEMENT_DEFS = {
    fire: { name: '火', icon: '🔥', color: 0xff5533, strongAgainst: ['earth'] },
    water: {
        name: '水', icon: '💧', color: 0x3399ff, strongAgainst: ['fire'],
        weaponBonus: { freezeChance: 0.15 },
    },
    thunder: {
        name: '雷', icon: '⚡', color: 0xffdd33, strongAgainst: ['water'],
        weaponBonus: { paralyzeChance: 0.15 },
    },
    wind: { name: '風', icon: '🌪️', color: 0x66ffcc, strongAgainst: ['thunder'] },
    earth: {
        name: '土', icon: '🪨', color: 0xcc9944, strongAgainst: ['wind'],
        weaponBonus: { poisonChance: 0.15, poisonDamage: { atkRatio: 0.1, min: 5 } },
    },
    light: { name: '光', icon: '✨', color: 0xffee99, strongAgainst: ['dark'] },
    dark: { name: '闇', icon: '🌑', color: 0x9955cc, strongAgainst: ['light'] },
};

/** 相性・混合ダメージ・玉の調整値（バランス調整はここだけ触ればよい） */
export const ELEMENT_RULES = {
    advantageMultiplier: 1.7,   // 有利（相手の弱点を突く）
    disadvantageMultiplier: 0.6, // 不利（相手が得意な属性で受ける）
    skillWeight: 7,             // スキル属性と武器属性を混ぜるときの重み（スキル : 武器 = 7 : 3）
    weaponWeight: 3,
    defaultOrbPrice: 800,
};

/** 旧名 → 現行id（既存アイテムの iceResist など、旧データを壊さないための別名） */
export const ELEMENT_ALIASES = { ice: 'water' };

export const ELEMENTS = Object.keys(ELEMENT_DEFS);
export const ELEMENT_INFO = ELEMENT_DEFS;

export function resolveElement(element) {
    return ELEMENT_ALIASES[element] || element;
}

export function isElement(element) {
    return ELEMENTS.includes(element);
}

// key(攻撃側属性) が value(防御側属性の配列) に対して有利
export const STRONG_AGAINST = Object.fromEntries(
    ELEMENTS.map((el) => [el, ELEMENT_DEFS[el].strongAgainst || []])
);

// 弱点の逆引き: key が「どの属性から有利を取られるか」の配列
export const WEAK_TO = Object.fromEntries(ELEMENTS.map((el) => [el, []]));
ELEMENTS.forEach((atk) => STRONG_AGAINST[atk].forEach((def) => {
    if (WEAK_TO[def] && !WEAK_TO[def].includes(atk)) WEAK_TO[def].push(atk);
}));

// 定義の整合性チェック（存在しない属性idを参照していたら起動時に気付けるように）
ELEMENTS.forEach((el) => STRONG_AGAINST[el].forEach((t) => {
    if (!ELEMENT_DEFS[t]) throw new Error(`[elements] "${el}".strongAgainst に未定義の属性 "${t}" があります`);
}));

export function getElementName(element) {
    return ELEMENT_INFO[element]?.name || '無';
}

export function getElementIcon(element) {
    return ELEMENT_INFO[element]?.icon || '';
}

export function getElementColor(element) {
    return ELEMENT_INFO[element]?.color ?? 0xffffff;
}

export function getElementColorCss(element) {
    return '#' + getElementColor(element).toString(16).padStart(6, '0');
}

export function getOrbItemId(element) {
    return `${element}_orb`;
}

export function getOrbPrice(element) {
    return ELEMENT_DEFS[element]?.orbPrice ?? ELEMENT_RULES.defaultOrbPrice;
}

/**
 * 攻撃側属性 vs 防御側属性のダメージ倍率。
 * どちらかが未設定（無属性）なら常に1.0。
 */
export function getElementMultiplier(attackElement, defenseElement) {
    if (!attackElement || !defenseElement) return 1.0;
    if (STRONG_AGAINST[attackElement]?.includes(defenseElement)) return ELEMENT_RULES.advantageMultiplier;
    if (STRONG_AGAINST[defenseElement]?.includes(attackElement)) return ELEMENT_RULES.disadvantageMultiplier;
    return 1.0;
}

/**
 * スキル属性・武器属性をまとめて防御側属性に対する倍率を返す。
 *  - 両方ある: スキル : 武器 = skillWeight : weaponWeight で倍率を加重平均
 *  - どちらか片方だけ: その属性を100%で適用
 *  - どちらも無い（無属性）: 1.0
 * element は表示用の代表属性（スキル属性を優先、無ければ武器属性）。
 */
export function getBlendedElementMultiplier(skillElement, weaponElement, defenseElement) {
    const skillEl = skillElement || null;
    const weaponEl = weaponElement || null;
    let multiplier = 1.0;
    if (skillEl && weaponEl) {
        const { skillWeight, weaponWeight } = ELEMENT_RULES;
        multiplier = (getElementMultiplier(skillEl, defenseElement) * skillWeight
            + getElementMultiplier(weaponEl, defenseElement) * weaponWeight) / (skillWeight + weaponWeight);
    } else if (skillEl || weaponEl) {
        multiplier = getElementMultiplier(skillEl || weaponEl, defenseElement);
    }
    // 浮動小数の誤差で 1.0 がずれないよう小数2桁に丸める
    return { multiplier: Math.round(multiplier * 100) / 100, element: skillEl || weaponEl || null };
}

/**
 * 武器に付与された属性の追加効果を、statsへ加算する差分オブジェクトにして返す。
 * 例: earth → { poisonChance: 0.15, poisonDamage: max(5, ceil(atk*0.1)) }
 */
export function getWeaponElementBonus(element, atk = 0) {
    const bonus = ELEMENT_DEFS[element]?.weaponBonus;
    const result = {};
    if (!bonus) return result;
    Object.entries(bonus).forEach(([key, value]) => {
        result[key] = (typeof value === 'object')
            ? Math.max(value.min ?? 0, Math.ceil(atk * (value.atkRatio ?? 0)))
            : value;
    });
    return result;
}

/** 装備statsのキー名: 属性耐性(%) / 属性固定ダメージ。属性を足せば自動で有効になる */
export const resistKey = (element) => `${element}Resist`;
export const damageKey = (element) => `${element}Damage`;

/** statsに書かれた属性キー(fireResist, iceDamage 等)を { 属性id: 値 } に集計する（旧名ice→waterも吸収） */
export function collectElementStats(stats, keyFn) {
    const result = {};
    const names = [...ELEMENTS, ...Object.keys(ELEMENT_ALIASES)];
    names.forEach((name) => {
        const v = stats?.[keyFn(name)];
        if (v) {
            const id = resolveElement(name);
            result[id] = (result[id] || 0) + v;
        }
    });
    return result;
}

/**
 * 相性図UI用: 相性の関係でつながっている属性をグループにして返す。
 * 各グループは「有利の矢印をたどった順」に並ぶので、輪(5すくみ)や2属性ペアをそのまま円状に描ける。
 * どの属性とも関係の無い属性は1要素のグループになる。
 */
export function getElementGroups() {
    const adj = Object.fromEntries(ELEMENTS.map((el) => [el, new Set()]));
    ELEMENTS.forEach((a) => STRONG_AGAINST[a].forEach((b) => { adj[a].add(b); adj[b].add(a); }));

    const seen = new Set();
    const groups = [];
    ELEMENTS.forEach((start) => {
        if (seen.has(start)) return;
        const comp = new Set();
        const stack = [start];
        while (stack.length) {
            const cur = stack.pop();
            if (comp.has(cur)) continue;
            comp.add(cur);
            adj[cur].forEach((n) => stack.push(n));
        }
        comp.forEach((e) => seen.add(e));

        // 矢印(有利)を順にたどって並べる
        const ordered = [];
        let cur = start;
        while (cur && !ordered.includes(cur)) {
            ordered.push(cur);
            cur = STRONG_AGAINST[cur].find((n) => comp.has(n) && !ordered.includes(n));
        }
        comp.forEach((e) => { if (!ordered.includes(e)) ordered.push(e); });
        groups.push(ordered);
    });
    // 大きいグループ（輪）を先に
    return groups.sort((a, b) => b.length - a.length);
}

// weaponBonus のキー → 相性図UIに出す状態異常名（新しい効果キーを使うときはここに足す）
export const WEAPON_BONUS_LABELS = { freezeChance: '凍結', paralyzeChance: '麻痺', poisonChance: '毒' };

/** 相性図UI用: 武器に付与すると発生する状態異常の一覧 [{ element, label }] */
export function getWeaponBonusSummary() {
    const list = [];
    ELEMENTS.forEach((element) => {
        Object.keys(ELEMENT_DEFS[element].weaponBonus || {}).forEach((key) => {
            if (WEAPON_BONUS_LABELS[key]) list.push({ element, label: WEAPON_BONUS_LABELS[key] });
        });
    });
    return list;
}
