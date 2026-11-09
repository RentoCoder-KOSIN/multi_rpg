import { ITEMS } from "./items.js";

// -----------------------------
// 共通の商品リスト定義
// -----------------------------
const defaultShopItems = ["wood_sword", "iron_sword", "novice_dagger", "debug_stick"];

const allShopItems = [
    // "debug_stick",
    "god_stick",
    // --- 基本武器（職業問わず） ---
    "wood_sword", "iron_sword", "novice_dagger", "bronze_spear", "exp_weapon", "travel_cloak",
    "menno_kayaku", "eatable_negi", "heal_potion_small", "heal_potion_large",
    "heal_izumi", "power_seed", "shield_seed", "magic_seed", "negi_sword",
    "wood_stick", "ice_wings", "fire_sword", "cheat_sword", "brass_knuckles",
    "ganble_stick", "dragon_bow", "leather_armor", "fire_armor", "ice_armor",
    "cheat_armor", "dragon_scale_armor",
    // 新規追加分（武器・防具）
    "silver_dagger", "battle_axe", "arcane_rod", "thunder_spear",
    "moonlight_rapier", "abyssal_blade", "phoenix_bow",
    "chain_mail", "knight_armor", "guardian_plate", "mystic_robe",
    "titan_armor", "celestial_mail", "void_aegis",
    // 宝具（accessory）
    "ring_of_swiftness", "vampiric_amulet", "guardian_charm",
    "philosophers_stone", "dragonfang_pendant",
    // 追加分（谷間を埋める装備）。竜の心臓・銀河の刃は最終ボス限定なので並べない
    "hunter_longbow", "steel_claymore", "crystal_staff", "mithril_mail", "orichalcum_plate",
    "lucky_clover", "windstep_anklet", "seekers_monocle",

    // ===== 職業別オリジナル武器 =====
    // 【短刀】タンク専用
    "novice_dagger", "iron_dagger", "knight_dagger", "guardian_dagger", "aegis_dagger",
    "paladin_dagger", "frost_dagger", "bastion_dagger", "divine_dagger", "colossus_dagger",
    // 【片手剣】ファイター / タンク / ナイト
    "short_sword", "knight_sword", "paladin_blade", "holy_sword", "divine_blade",
    // 【双剣】バーサーカー / ニンジャ
    "twin_daggers", "chaos_blades", "berserker_fangs", "shadow_fangs", "demon_twin_swords",
    // 【刀】サムライ / ドラゴンナイト
    "training_katana", "steel_katana", "moonblade_katana", "dragon_katana", "soul_edge_katana",
    // 【両手剣・斧】ファイター系
    "great_axe", "war_axe", "dragon_slayer_axe", "titan_greatsword", "void_greatsword",
    // 【メイス・ハンマー】タンク / プリースト
    "iron_mace", "guardian_mace", "sacred_mace", "war_hammer", "mjolnir",
    // 【弓・クロスボウ】レンジャー系
    "short_bow", "composite_bow", "sniper_bow", "wind_bow", "divine_bow",
    "steel_crossbow", "thunder_crossbow",
    // 【杖】メイジ / プリースト
    "apprentice_staff", "flame_staff", "frost_staff", "thunder_staff", "dark_staff",
    "archmage_staff", "genesis_staff",
    // 【ワンド】
    "healing_wand", "chaos_wand", "divine_wand",
    // 【魔導書・魔導球】サモナー / 魔法職
    "summoners_tome", "dark_tome", "ancient_grimoire", "chaos_orb", "cosmos_orb",
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
            "potion", "high_potion", "great_potion", "great_mp_potion", "elixir", "menno_kayaku", "eatable_negi",
            "heal_potion_small", "heal_potion_large", "heal_izumi",
            "power_seed", "shield_seed", "magic_seed",
            "stat_reset_book", "job_reset_book",
            // 強化石 (鍛冶屋でも使えるが雑貨屋でも購入できる)
            "enhance_stone_1", "enhance_stone_2", "enhance_stone_3"
        ]
    },
    // チュートリアルの雑貨屋: 最初の戦いに必要なポーションだけを並べる
    tutorial_shop: {
        title: "はじまりの雑貨屋",
        items: ["potion", "mp_potion", "high_potion"]
    },
    city_death: {
        title: "闇の取引所",
        items: ["death_scythe", "resurrection_scroll", "cursed_ring", "cheat_sword", "dragonfang_pendant",
                "demon_twin_swords", "soul_edge_katana", "void_greatsword", "demon_scythe"]
    },
    // ギルド限定ショップ: allShopItemsに含めていないため、他のどの店にも並ばない。
    guild_shop: {
        title: "ギルドショップ",
        items: ["guild_captain_blade", "guild_emblem", "mp_potion", "high_mp_potion", "limit_break_license"]
    },
    // ----- 職業別専門武器店 -----
    // ファイター系（片手剣・双剣・刀・斧・両手剣）
    fighter_shop: {
        title: "剣士の武器店",
        items: [
            "wood_sword", "iron_sword", "beginner_sword",
            "short_sword", "knight_sword", "paladin_blade", "holy_sword", "divine_blade",
            "twin_daggers", "chaos_blades", "berserker_fangs", "shadow_fangs", "demon_twin_swords",
            "training_katana", "steel_katana", "moonblade_katana", "dragon_katana", "soul_edge_katana",
            "great_axe", "war_axe", "dragon_slayer_axe",
            "battle_axe", "steel_claymore", "titan_greatsword", "void_greatsword",
            "silver_dagger", "brass_knuckles", "negi_sword", "fire_sword", "ice_wings",
        ]
    },
    // メイジ系（杖・ワンド・魔導書・魔導球）
    mage_shop: {
        title: "魔法使いの道具店",
        items: [
            "beginner_staff", "exp_staff",
            "apprentice_staff", "flame_staff", "frost_staff", "thunder_staff",
            "dark_staff", "archmage_staff", "genesis_staff",
            "healing_wand", "chaos_wand", "divine_wand",
            "summoners_tome", "dark_tome", "ancient_grimoire",
            "chaos_orb", "cosmos_orb",
            "arcane_rod", "crystal_staff", "sage_staff", "ganble_stick",
        ]
    },
    // レンジャー系（弓・クロスボウ）
    ranger_shop: {
        title: "弓師の武器店",
        items: [
            "wooden_bow", "beginner_sword",
            "short_bow", "composite_bow", "sniper_bow", "wind_bow", "divine_bow",
            "steel_crossbow", "thunder_crossbow",
            "hunter_longbow", "dragon_bow", "phoenix_bow", "_bow",
        ]
    },
    // タンク・プリースト系（短刀・メイス・ハンマー・片手剣）
    tank_priest_shop: {
        title: "防衛の武器店",
        items: [
            "novice_dagger", "iron_dagger", "knight_dagger", "guardian_dagger", "aegis_dagger",
            "paladin_dagger", "frost_dagger", "bastion_dagger", "divine_dagger",
            "iron_mace", "guardian_mace", "sacred_mace", "war_hammer", "mjolnir",
            "short_sword", "knight_sword", "paladin_blade", "holy_sword",
            "healing_wand", "divine_wand",
            "iron_shield", "plate_armor", "guardian_plate",
        ]
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
// itemId 配列 → アイテム定義に変換 (カテゴリ・職業フィルタリング対応 + レベル順ソート)
// -----------------------------
export function resolveShopItems(itemIds, filterCategory = null, player = null, filterByJob = true) {
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

            // カテゴリフィルタ
            if (filterCategory) {
                // カテゴリの正規化 (item -> consumable)
                const cat = filterCategory.toLowerCase();
                const targetCat = cat === "item" ? "consumable" : cat;

                // 宝具(accessory)専用のショップトリガーは無いため、街の防具屋(category:"armor")
                // でも宝具を扱う。
                if (targetCat === "armor" && item.type === "accessory") {
                    // 通す
                } else if (item.type !== targetCat && item.type !== cat) {
                    return false;
                }
            }

            // プレイヤーの職業による武器の自動フィルタリング
            if (filterByJob && player && player.stats?.job && player.stats.job !== 'none') {
                if (item.type === 'weapon' && item.weaponClass && typeof player.canEquipWeapon === 'function') {
                    if (!player.canEquipWeapon(item.weaponClass)) {
                        return false; // 装備できない武器種は除外
                    }
                }
            }

            return true;
        })
        // ユーザーがどの装備から買えばいいか一目でわかるように、必要レベルの低い順に並べる。
        // レベル制限がない消耗品などは lvlReq=0 扱いで先頭付近に来る。
        .sort((a, b) => (a.lvlReq || 0) - (b.lvlReq || 0));
}
