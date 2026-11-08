// animations/playerAnimations.js
export function createPlayerAnimations(scene) {
    if (!scene.anims.exists('walk-left')) {
        scene.anims.create({
            key: 'walk-left',
            frames: scene.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
    }

    if (!scene.anims.exists('walk-right')) {
        scene.anims.create({
            key: 'walk-right',
            frames: scene.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });
    }

    if (!scene.anims.exists('idle')) {
        scene.anims.create({
            key: 'idle',
            frames: [{ key: 'dude', frame: 4 }],
            frameRate: 10
        });
    }
}
