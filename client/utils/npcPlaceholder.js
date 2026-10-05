import { NPC_FRAME } from '../data/npcTextures.js';

// Same key -> same color, so each NPC type stays recognizable between runs.
function colorFromKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return Phaser.Display.Color.HSLToColor((hash % 360) / 360, 0.55, 0.5).color;
}

/**
 * Make sure a texture with this key exists. If the real image was not loaded,
 * generate a simple person-shaped placeholder under the same key, so the NPC
 * never shows Phaser's black "missing texture" box.
 * @returns {boolean} true if a placeholder had to be generated
 */
export function ensureNpcTexture(scene, key) {
    if (scene.textures.exists(key)) return false;

    const { width: w, height: h } = NPC_FRAME;
    const color = colorFromKey(key);
    const g = scene.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0x000000, 0.25);                 // ground shadow
    g.fillEllipse(w / 2, h - 4, w * 0.7, 8);
    g.fillStyle(color, 1);                       // body
    g.fillRoundedRect(w * 0.2, h * 0.38, w * 0.6, h * 0.5, 6);
    g.fillStyle(0xffe0bd, 1);                    // head
    g.fillCircle(w / 2, h * 0.25, w * 0.22);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeRoundedRect(w * 0.2, h * 0.38, w * 0.6, h * 0.5, 6);

    g.generateTexture(key, w, h);
    g.destroy();

    console.warn(`[npc] Texture "${key}" is not loaded; using a placeholder. Register it in client/data/npcTextures.js.`);
    return true;
}
