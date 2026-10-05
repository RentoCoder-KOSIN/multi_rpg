export function setupCameraAndWorld(scene, map, player, options = {}) {
    const {
        lerpX = 0.1,
        lerpY = 0.1,
        roundPixels = true
    } = options;

    const mapWidth = map.widthInPixels;
    const mapHeight = map.heightInPixels;

    // World
    scene.physics.world.setBounds(0, 0, mapWidth, mapHeight);
    player.setCollideWorldBounds(true);

    // Camera
    const cam = scene.cameras.main;
    cam.setBounds(0, 0, mapWidth, mapHeight);
    cam.startFollow(player);
    cam.setLerp(lerpX, lerpY);
    cam.roundPixels = roundPixels;

    setupFillZoom(scene, cam, mapWidth, mapHeight);
}

/**
 * マップが画面(ゲーム解像度)より小さい場合に、周りが黒く余らないようカメラをズームして埋める。
 *
 * Phaserのカメラズームは setScrollFactor(0) のUIにも掛かってしまう（中心を基準に拡大され、
 * 位置もずれる）。そのため、ズームする時だけUI専用カメラ(zoom 1)を追加し、
 *   - scrollFactor 0 のオブジェクト(HUD・ウィンドウ等) → UIカメラだけで描画
 *   - それ以外(マップ・キャラ・エフェクト等)          → メインカメラ(ズーム)だけで描画
 * に振り分ける。後から生成されるオブジェクトも、毎フレームの postupdate（描画直前）で振り分ける。
 */
function setupFillZoom(scene, cam, mapWidth, mapHeight) {
    scene.worldZoom = 1;
    scene.uiCamera = null;

    const ensureUiCamera = () => {
        if (scene.uiCamera) return scene.uiCamera;
        const game = scene.scale.gameSize || scene.scale;
        const uiCam = scene.cameras.add(0, 0, game.width, game.height, false, 'ui');
        scene.uiCamera = uiCam;

        const classify = () => {
            const list = scene.children.list;
            for (let i = 0; i < list.length; i++) {
                const obj = list[i];
                if (obj.__camAssigned) continue;
                obj.__camAssigned = true;
                // コンテナの子は親のscrollFactorで描かれ、親がカメラに映らなければ子も描かれない
                const isUi = obj.scrollFactorX === 0 && obj.scrollFactorY === 0;
                obj.cameraFilter |= (isUi ? cam.id : uiCam.id);
            }
        };
        classify();
        scene.events.on('postupdate', classify);
        // シーンのインスタンスは restart で再利用されるので、リスナーを残さない
        scene.events.once('shutdown', () => scene.events.off('postupdate', classify));
        return uiCam;
    };

    // ゲーム解像度が変わる(ウィンドウのリサイズ等)たびに倍率を計算し直す
    const applyZoom = () => {
        const game = scene.scale.gameSize || scene.scale;
        // 「画面を覆う」ための最小倍率。隙間が出ないよう小数第2位で切り上げる
        let zoom = Math.max(1, game.width / mapWidth, game.height / mapHeight);
        zoom = Math.ceil(zoom * 100) / 100;
        if (zoom > 1) ensureUiCamera();
        scene.worldZoom = zoom;
        cam.setZoom(zoom);
    };
    applyZoom();
    scene.scale.on('resize', applyZoom);
    scene.events.once('shutdown', () => scene.scale.off('resize', applyZoom));
}
