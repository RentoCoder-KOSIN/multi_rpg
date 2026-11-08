/**
 * NPC texture registry: texture key -> image path (relative to client/).
 *
 * The key is the "texture" property of the NPC object in the Tiled map
 * (an NPC without that property uses the key 'npc').
 * Add one line per NPC image. Keys that are not listed here fall back to a
 * generated placeholder (see utils/npcPlaceholder.js), and the browser console
 * prints a warning with the missing key so you know what to add.
 *
 * Example:
 *   job_master: 'assets/npc/job_master.png',
 */
export const NPC_TEXTURES = {
};

// Frame size of the NPC images (same as the player sprite 'dude').
export const NPC_FRAME = { width: 32, height: 48 };
