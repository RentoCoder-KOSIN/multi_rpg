import { UI_LAYOUT } from './uiLayout.js';

/**
 * HUD layout logic. Data lives in uiLayout.js.
 *
 * Usage from a UI class:
 *   const layout = getUILayout(scene);
 *   layout.register('minimap', this.container);   // positioned now and again on every resize
 *   layout.setSize('quest', width, height);       // when the element's size changes at runtime
 */

// Real game size (correct in Phaser.Scale.FIT mode)
export function getGameSize(scene) {
    const size = scene.scale.gameSize || scene.scale;
    return { width: size.width, height: size.height };
}

function parseAnchor(anchor) {
    const [v, h] = String(anchor).split('-');
    if (!['top', 'middle', 'bottom'].includes(v) || !['left', 'center', 'right'].includes(h)) {
        throw new Error(`Invalid anchor "${anchor}" (expected e.g. "top-left", "middle-left", "bottom-right")`);
    }
    return { v, h };
}

/**
 * Pure function: top-left rectangle {x, y, w, h} of an entry.
 * `sizes` holds runtime size overrides ({ [id]: {w, h} }). Pure, so it can be unit-tested.
 */
export function resolveRect(id, layout, game, sizes = {}, _stack = []) {
    const spec = layout[id];
    if (!spec) throw new Error(`Unknown UI layout id "${id}"`);
    if (_stack.includes(id)) throw new Error(`Circular layout reference: ${[..._stack, id].join(' -> ')}`);

    const { w, h } = sizes[id] || spec.size;
    const m = { x: 0, y: 0, ...spec.margin };
    const { v, h: hor } = parseAnchor(spec.anchor);

    let x;
    if (hor === 'left') x = m.x;
    else if (hor === 'right') x = game.width - m.x - w;
    else x = (game.width - w) / 2 + m.x;

    let y;
    if (v === 'top') y = m.y;
    else if (v === 'bottom') y = game.height - m.y - h;
    else y = (game.height - h) / 2 + m.y;

    // Optional: place next to another element (only the relevant axis is overridden)
    if (spec.relative) {
        const { to, side, gap = 0 } = spec.relative;
        const ref = resolveRect(to, layout, game, sizes, [..._stack, id]);
        if (side === 'below') y = ref.y + ref.h + gap;
        else if (side === 'above') y = ref.y - gap - h;
        else if (side === 'right') x = ref.x + ref.w + gap;
        else if (side === 'left') x = ref.x - gap - w;
        else throw new Error(`Invalid relative side "${side}"`);
    }

    return { x, y, w, h };
}

export class UILayoutManager {
    constructor(scene, layout = UI_LAYOUT) {
        this.scene = scene;
        this.layout = { ...layout };   // copy, so define() never mutates the shared data
        this.sizes = {};               // runtime size overrides
        this.targets = new Map();      // id -> array of game objects
        this.alive = true;

        this._onResize = () => this.relayout();
        scene.scale.on('resize', this._onResize);
        // Scene objects are reused across restarts, so always clean up
        scene.events.once('shutdown', () => this.destroy());
        scene.events.once('destroy', () => this.destroy());
    }

    // Add (or replace) a layout entry at runtime
    define(id, spec) {
        this.layout[id] = spec;
        this.relayout();
        return this;
    }

    // target: a game object, or an array of them (all get the same position)
    register(id, target) {
        if (!this.layout[id]) {
            console.warn(`[UILayout] No layout entry for "${id}". Add it to uiLayout.js.`);
            return this;
        }
        this.targets.set(id, Array.isArray(target) ? target : [target]);
        this.place(id);
        return this;
    }

    unregister(id) {
        this.targets.delete(id);
        return this;
    }

    setSize(id, w, h) {
        const cur = this.sizes[id];
        if (cur && cur.w === w && cur.h === h) return this;
        this.sizes[id] = { w, h };
        this.relayout();   // other entries may be positioned relative to this one
        return this;
    }

    getRect(id) {
        return resolveRect(id, this.layout, getGameSize(this.scene), this.sizes);
    }

    place(id) {
        const objs = this.targets.get(id);
        if (!objs) return;
        const rect = this.getRect(id);
        const origin = { x: 0, y: 0, ...this.layout[id].origin };
        const px = rect.x + origin.x * rect.w;
        const py = rect.y + origin.y * rect.h;
        objs.forEach(o => { if (o && o.active !== false) o.setPosition(px, py); });
    }

    relayout() {
        this.targets.forEach((_, id) => this.place(id));
    }

    destroy() {
        if (!this.alive) return;
        this.alive = false;
        this.scene.scale.off('resize', this._onResize);
        this.targets.clear();
    }
}

// One manager per scene, created on first use (UIs are built in no fixed order).
export function getUILayout(scene) {
    if (!scene.uiLayout || !scene.uiLayout.alive) {
        scene.uiLayout = new UILayoutManager(scene);
    }
    return scene.uiLayout;
}
