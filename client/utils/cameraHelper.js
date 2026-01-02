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
}
