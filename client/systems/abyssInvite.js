// 仲間が無限の深淵の待機室に入ったときの「参加しますか？」の通知。
// アクティビティログに [参加する] [見送る] ボタン付きで出し、Y / N キーでも答えられる。
//
// 募集の状態は、シーンをまたいで残るようレジストリに置く（ボタンを押す時点の
// シーンは、通知が出た時のシーンと違うことがあるため、押した時点の net.scene を使う）。
import { enterAbyssLobby } from './abyssEntry.js';

const REGISTRY_KEY = 'abyssInvite';

const CLOSE_NOTES = {
    started: '開始済みのため参加できません',
    cancelled: '募集は取りやめられました',
    replaced: '',
};

function currentInvite(net) {
    return net.scene?.registry?.get(REGISTRY_KEY) || null;
}

function clearInvite(net, note) {
    const invite = currentInvite(net);
    if (!invite) return null;
    invite.notificationUI?.resolveEntry(invite.entry, note);
    net.scene.registry.set(REGISTRY_KEY, null);
    return invite;
}

export function hasPendingAbyssInvite(scene) {
    return !!scene.registry.get(REGISTRY_KEY);
}

/** 仲間が待機室に入った通知を出す */
export function showAbyssInvite(scene, data) {
    const net = scene.networkManager;
    clearInvite(net, CLOSE_NOTES.replaced);

    const entry = scene.notificationUI?.show(
        `🌀 ${data.fromName} が無限の深淵の待機室に入りました。参加しますか？  [Y] 参加 / [N] 見送る`,
        'warning',
        {
            actions: [
                { label: '参加する', onClick: () => acceptAbyssInvite(net) },
                { label: '見送る', onClick: () => declineAbyssInvite(net) },
            ],
        }
    );
    scene.registry.set(REGISTRY_KEY, {
        roomId: data.roomId,
        fromName: data.fromName,
        entry,
        notificationUI: scene.notificationUI,
    });
}

export function acceptAbyssInvite(net) {
    const scene = net.scene;
    if (!clearInvite(net, '参加を申し込みました')) return;
    enterAbyssLobby(scene);
}

export function declineAbyssInvite(net) {
    clearInvite(net, '見送りました');
}

/** 募集が終わった（開始された / 取りやめられた）ときに、参加ボタンを片付ける */
export function closeAbyssInvite(net, data) {
    const invite = currentInvite(net);
    if (!invite || (data?.roomId && invite.roomId !== data.roomId)) return;
    clearInvite(net, CLOSE_NOTES[data?.reason] ?? '募集は終了しました');
}
