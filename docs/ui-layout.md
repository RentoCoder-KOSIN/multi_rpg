# UI layout

HUD positions live in **one place**: `client/ui/uiLayout.js` (data only).
The logic is in `client/ui/UILayoutManager.js`. You normally never edit that file.

## Move / resize a UI
Edit its entry in `uiLayout.js`.

```js
minimap: { anchor: 'top-right', margin: { x: 15, y: 15 }, size: { w: 140, h: 140 } }
```

| field | meaning |
|---|---|
| `anchor` | `top/middle/bottom` + `-` + `left/center/right` |
| `margin` | distance from the anchored edge. For `middle` / `center` it is a signed offset. Negative = partly off-screen |
| `size` | `{w, h}` in px |
| `origin` | where the object's own (0,0) is inside the element (0..1). Default top-left, `{x:.5,y:.5}` = center |
| `relative` | `{to, side, gap}` place next to another entry: `below / above / left / right` |

## Add a new UI (3 steps)
1. Add an entry to `UI_LAYOUT` in `uiLayout.js`.
2. In your UI class:
   ```js
   import { getUILayout } from './UILayoutManager.js';
   this.container = scene.add.container(0, 0).setScrollFactor(0);
   getUILayout(scene).register('yourId', this.container);
   ```
3. If its size changes at runtime: `getUILayout(scene).setSize('yourId', w, h);`
   (everything placed `relative` to it follows automatically).

Need a one-off UI without touching `uiLayout.js`? `getUILayout(scene).define('id', spec)`.

## Add a menu button
Add one line to `MENU_ITEMS` in `client/ui/SideMenuUI.js`.

## Not migrated yet
`MapNameUI` and `NotificationUI` (top-center, animated) still place themselves.
