import { UI_FONT } from '../fontConfig.js';
// パーティーメンバーの位置を、ゲーム画面上で常に分かるようにする。
//  - 画面内にいるメンバー: 頭上に橙色の▼マーカーを出す
//  - 画面外にいるメンバー: 画面の縁に、その方向を指す矢印＋名前＋距離を出す
// 別マップにいるメンバーは位置が分からないので、ここでは何も出さない
// （PartyHUDUI 側に所在マップが出ている）。
const COLOR = 0xffa500;
const EDGE_MARGIN = 26;   // 画面の縁からの距離(px)
const TILE = 32;
const DEPTH = 1600;

export default class PartyLocatorUI {
    constructor(scene) {
        this.scene = scene;
        this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
        this.labels = new Map(); // memberId -> Text
        if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(this.gfx);
    }

    getLabel(id) {
        let t = this.labels.get(id);
        if (!t || !t.active) {
            t = this.scene.add.text(0, 0, '', {
                fontSize: '11px', color: '#ffd9a0', fontFamily: UI_FONT,
                stroke: '#000', strokeThickness: 3
            }).setScrollFactor(0).setDepth(DEPTH).setOrigin(0.5);
            if (this.scene.minimapCameraIgnore) this.scene.minimapCameraIgnore(t);
            this.labels.set(id, t);
        }
        return t;
    }

    update() {
        const scene = this.scene;
        const g = this.gfx;
        if (!g || !g.active) return;
        g.clear();

        const nm = scene.networkManager;
        const members = nm?.partyData?.members;
        const player = scene.player;
        const used = new Set();

        if (members && members.length > 1 && player) {
            const myId = nm.getPlayerId();
            const others = nm.getOtherPlayers();
            const cam = scene.cameras.main;
            const zoom = cam.zoom || 1;
            const cx = cam.width / 2;
            const cy = cam.height / 2;

            members.forEach(m => {
                if (m.id === myId) return;
                const p = others[m.id];
                if (!p || !p.active) return; // 別マップ等

                // ワールド座標 → 画面座標
                const sx = cx + (p.x - cam.midPoint.x) * zoom;
                const sy = cy + (p.y - cam.midPoint.y) * zoom;
                const onScreen = sx >= 0 && sx <= cam.width && sy >= 0 && sy <= cam.height;
                const label = this.getLabel(m.id);
                used.add(m.id);

                if (onScreen) {
                    // 頭上(名前タグより少し上)に▼
                    const mx = sx, my = sy - 52;
                    g.fillStyle(COLOR, 1);
                    g.fillTriangle(mx - 6, my - 8, mx + 6, my - 8, mx, my + 2);
                    g.lineStyle(1.5, 0xffffff, 1);
                    g.strokeTriangle(mx - 6, my - 8, mx + 6, my - 8, mx, my + 2);
                    label.setVisible(false);
                } else {
                    // 画面中心から対象への方向に伸ばした線が、縁の内側(EDGE_MARGIN)と交わる点
                    const dx = sx - cx, dy = sy - cy;
                    const halfW = cx - EDGE_MARGIN, halfH = cy - EDGE_MARGIN;
                    const k = Math.min(
                        dx !== 0 ? halfW / Math.abs(dx) : Infinity,
                        dy !== 0 ? halfH / Math.abs(dy) : Infinity
                    );
                    const ex = cx + dx * k, ey = cy + dy * k;
                    const ang = Math.atan2(dy, dx);

                    // 対象を指す矢印(三角形)
                    const size = 9;
                    const tip = { x: ex + Math.cos(ang) * size, y: ey + Math.sin(ang) * size };
                    const l = { x: ex + Math.cos(ang + 2.5) * size, y: ey + Math.sin(ang + 2.5) * size };
                    const r = { x: ex + Math.cos(ang - 2.5) * size, y: ey + Math.sin(ang - 2.5) * size };
                    g.fillStyle(COLOR, 1);
                    g.fillTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);
                    g.lineStyle(1.5, 0xffffff, 1);
                    g.strokeTriangle(tip.x, tip.y, l.x, l.y, r.x, r.y);

                    // 名前と距離（矢印の内側＝画面中心寄りに置く）
                    const dist = Math.round(Math.hypot(p.x - player.x, p.y - player.y) / TILE);
                    let name = m.name || '';
                    if (name.length > 8) name = `${name.substring(0, 6)}..`;
                    label.setText(`${name} ${dist}m`);
                    const lx = ex - Math.cos(ang) * 30, ly = ey - Math.sin(ang) * 18;
                    label.setPosition(
                        Phaser.Math.Clamp(lx, 50, cam.width - 50),
                        Phaser.Math.Clamp(ly, 12, cam.height - 12)
                    );
                    label.setVisible(true);
                }
            });
        }

        // 今回描かなかったメンバーのラベルは隠す
        this.labels.forEach((t, id) => { if (!used.has(id) && t.active) t.setVisible(false); });
    }

    destroy() {
        this.gfx?.destroy();
        this.labels.forEach(t => t.destroy());
        this.labels.clear();
    }
}
