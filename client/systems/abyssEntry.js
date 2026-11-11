// 無限の深淵への出入り（ゲート → 待機室 → ダンジョン → 帰還）の共通処理。
// NPCゲート・仲間からの参加確認・待機室・ダンジョン内の退出ボタンから使う。
import { findMap, resolveSceneKey } from '../data/maps.js';

export const ABYSS_LOBBY_SCENE_KEY = 'AbyssLobbyScene';

const FALLBACK_RETURN_MAP = 'city';

function fadeToScene(scene, sceneKey, data) {
    const cam = scene.cameras?.main;
    if (!cam) {
        scene.scene.start(sceneKey, data);
        return;
    }
    cam.fadeOut(300, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(sceneKey, data));
}

// ゲートに入る直前のシーン・位置を覚えておく（退出したらここへ戻る）
function rememberReturnPoint(scene) {
    if (!scene.currentMapKey || scene.currentMapKey === 'abyss') return; // 帰る先が深淵自身にならないように
    scene.registry.set('abyssReturn', {
        sceneKey: scene.scene.key,
        mapKey: scene.currentMapKey,
        x: scene.player?.x,
        y: scene.player?.y,
        maxFloor: scene.player?.stats?.abyssMaxFloor || 0,
    });
}

function getReturnPoint(scene) {
    const saved = scene.registry.get('abyssReturn');
    if (saved?.sceneKey) return saved;
    const fallback = findMap(FALLBACK_RETURN_MAP);
    return { sceneKey: fallback?.sceneKey || FALLBACK_RETURN_MAP, mapKey: fallback?.key || FALLBACK_RETURN_MAP };
}

/** ダンジョン本体のシーンへ（挑戦中の部屋の run 情報はレジストリに置く） */
export function goToAbyssDungeon(scene, run) {
    scene.registry.set('abyssRun', run);
    scene.registry.set('abyssStartFloor', run.floor);
    fadeToScene(scene, resolveSceneKey('abyss') || 'abyss', { mapKey: 'abyss', spawn: 'default' });
}

/**
 * ゲートから待機室へ入る（仲間の参加確認の「参加する」も同じ）。
 * サーバーが部屋を作る/参加させる。開始済みなら断られる（開始時の参加者本人の再入場だけ通る）。
 * @param {Phaser.Scene} scene 今動いているマップのシーン
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function enterAbyssLobby(scene) {
    const net = scene.networkManager;
    const res = await net.abyssEnter();
    if (!res.ok) {
        scene.notificationUI?.show(`🌀 ${res.error || '無限の深淵に入れませんでした'}`, 'error');
        return res;
    }

    rememberReturnPoint(scene);

    if (res.status === 'started') {
        // 自分が参加していた挑戦が続いている（再接続）。待機室は通らずダンジョンへ
        goToAbyssDungeon(scene, res.run);
        return res;
    }

    scene.registry.set('abyssRun', null);
    const cam = scene.cameras?.main;
    const go = () => {
        scene.networkManager.detachFromMap();
        scene.scene.start(ABYSS_LOBBY_SCENE_KEY, { room: res.room });
    };
    if (cam) {
        cam.fadeOut(300, 0, 0, 0);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
    } else {
        go();
    }
    return res;
}

/**
 * 待機室・ダンジョンから抜けて、ゲートに入る前の場所へ戻る。
 * @param {Phaser.Scene} scene
 * @param {string} [notice] 戻った先のログに出す一言
 */
export async function leaveAbyss(scene, notice = '') {
    const net = scene.networkManager || scene.registry.get('networkManager');
    await net?.abyssLeave();
    scene.registry.set('abyssRun', null);

    const ret = getReturnPoint(scene);
    if (notice) scene.notificationUI?.show(notice, 'info'); // ログはDOMなので、シーンが変わっても残る
    fadeToScene(scene, ret.sceneKey, { mapKey: ret.mapKey, x: ret.x, y: ret.y });
}
