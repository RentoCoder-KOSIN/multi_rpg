/**
 * Pin a game object (and, for containers, every current and future child) to the screen.
 *
 * Why this is needed: Phaser's hit test uses the scrollFactor of the *child* object,
 * not of its parent container. A container with scrollFactor 0 is drawn fixed on screen,
 * but children keep the default scrollFactor 1, so their click area follows the world
 * and drifts away from what is drawn by exactly the camera scroll.
 *
 * @param {Phaser.GameObjects.GameObject} obj
 * @returns the same object, for chaining
 */
export function pinToScreen(obj) {
    if (!obj) return obj;

    if (obj.setScrollFactor) obj.setScrollFactor(0, 0);

    if (obj.type === 'Container') {
        if (!obj._screenPinned) {
            obj._screenPinned = true;
            // Container.add()/addAt() call addHandler() for every new child, so this covers later additions too
            const originalAddHandler = obj.addHandler;
            obj.addHandler = function (child) {
                pinToScreen(child);
                originalAddHandler.call(this, child);
            };
        }
        obj.list.forEach(pinToScreen); // children that were added before pinning
    }

    return obj;
}
