// 無限の深淵まわりの特別なマップキー。
//
//   abyss_lobby       待機室。Tiledのマップは無く、サーバー上の「居場所」としてだけ使う
//   abyss:<roomId>    挑戦中の部屋ごとのインスタンス。敵・他プレイヤーの同期は
//                     この部屋のメンバー同士だけで行われる（Socket.IOの部屋は map:abyss:<roomId>）

const ABYSS_LOBBY_MAP_KEY = "abyss_lobby";
const ABYSS_INSTANCE_PREFIX = "abyss:";

function isAbyssInstanceKey(mapKey) {
    return typeof mapKey === "string" && mapKey.startsWith(ABYSS_INSTANCE_PREFIX);
}

function abyssInstanceKey(roomId) {
    return `${ABYSS_INSTANCE_PREFIX}${roomId}`;
}

function abyssRoomIdOf(mapKey) {
    return mapKey.slice(ABYSS_INSTANCE_PREFIX.length);
}

// パーティー画面などに出すマップ名。インスタンスの内部IDは外に出さない
function toPublicMapKey(mapKey) {
    if (isAbyssInstanceKey(mapKey)) return "abyss";
    return mapKey;
}

module.exports = {
    ABYSS_LOBBY_MAP_KEY,
    ABYSS_INSTANCE_PREFIX,
    isAbyssInstanceKey,
    abyssInstanceKey,
    abyssRoomIdOf,
    toPublicMapKey,
};
