import { ITEMS } from "./items.js";

// -----------------------------
// 共通の商品リスト定義
// -----------------------------
const defaultShopItems = ["wood_sword", "iron_sword"];

const allShopItems = [
    "wood_sword", "iron_sword", "bronze_spear", "exp_weapon", "travel_cloak",
    "menno_kayaku", "eatable_negi", "heal_potion_small", "heal_potion_large",
    "heal_izumi", "power_seed", "shield_seed", "magic_seed", "negi_sword",
    "wood_stick", "ice_wings", "fire_sword", "cheat_sword", "brass_knuckles",
    "ganble_stick", "dragon_bow", "leather_armor", "fire_armor", "ice_armor",
    "cheat_armor", "dragon_scale_armor"
];

// -----------------------------
// ★ 店ごとのプリセット (Loadouts)
// -----------------------------
export const SHOP_LOADOUTS = {
    first_weapon: {
        title: "森の武器屋",
        items: defaultShopItems
    },
    city_weapon: {
        title: "街の武器屋",
        items: allShopItems
    },
    city_armor: {
        title: "街の防具屋",
        items: allShopItems
    },
    city_food: {
        title: "街の雑貨屋",
        items: [
            "potion", "high_potion", "menno_kayaku", "eatable_negi",
            "heal_potion_small", "heal_potion_large", "heal_izumi",
            "power_seed", "shield_seed", "magic_seed"
        ]
    },
    city_death: {
        title: "闇の取引所",
        items: ["death_scythe", "resurrection_scroll", "cursed_ring", "cheat_sword"]
    },
    // デフォルト（見つからない場合用）
    default: {
        title: "旅の商人",
        items: defaultShopItems
    }
};

// -----------------------------
// ★ shopKey に応じて取得
// -----------------------------
export function getShopLoadout(shopKey) {
    if (!shopKey) {
        console.warn("[ShopManager] shopKey が undefined、default を使用します");
        return SHOP_LOADOUTS.default;
    }

    if (!SHOP_LOADOUTS[shopKey]) {
        console.warn(`[ShopManager] 未知の shopKey: ${shopKey} → default を使用`);
        return SHOP_LOADOUTS.default;
    }

    return SHOP_LOADOUTS[shopKey];
}

// -----------------------------
// itemId 配列 → アイテム定義に変換 (カテゴリフィルタリング対応)
// -----------------------------
export function resolveShopItems(itemIds, filterCategory = null) {
    return (itemIds || [])
        .map(id => {
            const def = ITEMS[id];
            if (!def) {
                console.warn(`[ShopManager] 未定義アイテムがショップに含まれています: ${id}`);
                return null;
            }
            return def;
        })
        .filter(item => {
            if (!item) return false;
            if (!filterCategory) return true;

            // カテゴリの正規化 (item -> consumable)
            const cat = filterCategory.toLowerCase();
            const targetCat = cat === "item" ? "consumable" : cat;

            return item.type === targetCat || item.type === cat;
        });
}

// -----------------------------
// ★★ Tiled の ShopTrigger を取得する (PhaserのMapオブジェクトを使用)
// -----------------------------
export function findShopTrigger(map, x, y) {
    const getProp = (obj, name) => {
        if (!obj) return null;
        if (Array.isArray(obj.properties)) {
            const p = obj.properties.find(v => v.name === name);
            return p ? p.value : null;
        }
        if (obj.properties && typeof obj.properties === "object") {
            return obj.properties[name] ?? null;
        }
        return obj[name] ?? null;
    };

    const isPointInObj = (px, py, obj) => {
        const { x: ox = 0, y: oy = 0, width: w = 0, height: h = 0 } = obj;
        // 通常の矩形判定と、下基準の判定の両方を確認
        if (px >= ox && py >= oy && px < ox + w && py < oy + h) return true;
        if (px >= ox && py >= oy - h && px < ox + w && py < oy) return true;
        return false;
    };

    // 全てのレイヤーを再帰的にチェック
    const searchLayers = (layers) => {
        for (const layer of layers) {
            if (layer.objects) {
                for (const obj of layer.objects) {
                    if (getProp(obj, "shop") && isPointInObj(x, y, obj)) {
                        return obj;
                    }
                }
            }
            if (layer.layers) {
                const found = searchLayers(layer.layers);
                if (found) return found;
            }
        }
        return null;
    };

    return searchLayers(map.layers || []);
}
