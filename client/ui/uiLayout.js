/**
 * HUD layout DATA. This file contains only numbers; the logic lives in UILayoutManager.js.
 *
 * To move / resize a UI, edit its entry here. To add a new UI, add an entry here and call
 *   getUILayout(scene).register('yourId', yourContainer);
 * from the UI class. Nothing else needs to change.
 *
 * Entry fields:
 *   anchor   'top|middle|bottom' + '-' + 'left|center|right'  (which point of the screen to attach to)
 *   margin   {x, y}  distance from the anchored edge (px). For 'middle' / 'center' it is a signed offset.
 *                    A negative value pushes the element partly off-screen.
 *   size     {w, h}  size of the element (px). Dynamic sizes are updated with layout.setSize(id, w, h).
 *   origin   {x, y}  where the game object's own (0,0) sits inside the element, as a 0..1 fraction.
 *                    {0,0} = top-left corner (default), {0.5,0.5} = center.
 *   relative {to, side, gap}  optional. Place next to another entry instead of using the anchor on
 *                    that axis. side: 'below' | 'above' | 'left' | 'right'.
 *
 * Coordinates are game pixels (the game is 800x600 and scaled by Phaser.Scale.FIT).
 */

// Skill dial geometry (also read by SkillBarUI)
const SKILL_DIAL_RADIUS = 80;      // ring radius the slots sit on
const SKILL_DIAL_PADDING = 38;     // background circle radius = ring radius + padding
const SKILL_DIAL_BOTTOM_CLIP = 28; // dial center is this far above the bottom edge (lower part is cut off)
const SKILL_DIAL_BG_RADIUS = SKILL_DIAL_RADIUS + SKILL_DIAL_PADDING;

export const UI_LAYOUT = {
    // Menu toggle button (round, 90px). Origin = its center.
    menu: {
        anchor: 'top-left',
        margin: { x: 7, y: 7 },
        size: { w: 90, h: 90 },
        origin: { x: 0.5, y: 0.5 }
    },

    // HP / MP / EXP panel: sits to the right of the menu button
    stats: {
        anchor: 'top-left',
        margin: { x: 0, y: 15 },
        size: { w: 250, h: 155 },
        relative: { to: 'menu', side: 'right', gap: 13 }
    },

    // Quest tracker: left edge, vertically centered (height is dynamic -> setSize)
    quest: {
        anchor: 'middle-left',
        margin: { x: 15, y: 20 },
        size: { w: 280, h: 50 }
    },

    // Minimap
    minimap: {
        anchor: 'top-right',
        margin: { x: 15, y: 15 },
        size: { w: 140, h: 140 }
    },

    // Party member list: under the minimap (height is dynamic)
    party: {
        anchor: 'top-right',
        margin: { x: 15, y: 0 },
        size: { w: 200, h: 55 },
        relative: { to: 'minimap', side: 'below', gap: 30 }
    },

    // Skill dial: round, origin = center
    skillDial: {
        anchor: 'bottom-right',
        margin: { x: 12, y: -(SKILL_DIAL_BG_RADIUS - SKILL_DIAL_BOTTOM_CLIP) },
        size: { w: SKILL_DIAL_BG_RADIUS * 2, h: SKILL_DIAL_BG_RADIUS * 2 },
        origin: { x: 0.5, y: 0.5 },
        radius: SKILL_DIAL_RADIUS,
        bgPadding: SKILL_DIAL_PADDING
    },

    // Touch action buttons (mobile only): stacked above the skill dial so they never overlap.
    // The container origin is the center of the bottom button row.
    virtualPad: {
        anchor: 'bottom-right',
        margin: { x: 15, y: 0 },
        size: { w: 270, h: 170 },
        origin: { x: 0.5, y: 135 / 170 },
        relative: { to: 'skillDial', side: 'above', gap: 10 }
    },

    // Enemy AI debug panel (hidden by default), bottom-left
    aiStats: {
        anchor: 'bottom-left',
        margin: { x: 10, y: 10 },
        size: { w: 250, h: 140 }
    },

    // "[C] talk" prompt: center of the prompt is 120px above the bottom edge
    interactPrompt: {
        anchor: 'bottom-center',
        margin: { x: 0, y: 102.5 },
        size: { w: 150, h: 35 },
        origin: { x: 0.5, y: 0.5 }
    }
};
