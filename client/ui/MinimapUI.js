import { UI_LAYOUT } from './uiLayout.js';
import { getUILayout } from './UILayoutManager.js';

/**
 * Minimap UI - 安定版レーダー形式ミニマップ（マスク不使用）
 */

// レイヤー名のキーワード → ミニマップ上の色。
// 「collision/wall/block」だけを見ていた以前の実装だと、マップによっては
// 該当レイヤーが存在せず地形が一切描画されないことがあったため、
// 主要なレイヤー名をひと通りカバーする。マッチしない場合は最後のdefaultを使う。
const TERRAIN_COLORS = [
    { keywords: ['wall', 'block', 'collision'], color: 0x555555 }, // 壁・障害物
    { keywords: ['water', 'lake', 'river'], color: 0x2288dd },     // 水場
    { keywords: ['lava'], color: 0xff3300 },                        // 溶岩
    { keywords: ['tree', 'forest'], color: 0x1f6b2f },              // 木々
    { keywords: ['grass'], color: 0x4caf50 },                       // 草地
    { keywords: ['sand', 'ash'], color: 0xc9a26a },                 // 砂・火山灰
    { keywords: ['stone', 'cave'], color: 0x6b6b6b },               // 岩・洞窟
    { keywords: ['floor'], color: 0xaaaaaa },                       // 屋内床
    { keywords: ['stairs'], color: 0xffffff },                      // 階段
    { keywords: ['shop'], color: 0x9b59b6 },                        // 店
    { keywords: ['quest'], color: 0xffd700 },                       // クエストボード等
    { keywords: ['town', 'city', 'road'], color: 0xbbbbbb },        // 街・道
    { keywords: ['teleport'], color: 0xffff00 },                    // テレポート床
    { keywords: ['ground', 'field', 'background'], color: 0x5a8f3c } // 汎用の地面
];
const DEFAULT_TERRAIN_COLOR = 0x336633;

function getTerrainColor(layerName) {
    const lname = (layerName || '').toLowerCase();
    for (const entry of TERRAIN_COLORS) {
        if (entry.keywords.some(k => lname.includes(k))) return entry.color;
    }
    return DEFAULT_TERRAIN_COLOR;
}

export default class MinimapUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.terrainGraphics = null; // 地形（滅多に変わらないのでキャッシュする）
        this.entityGraphics = null;  // 敵・仲間など、毎フレーム動くもの
        this.size = UI_LAYOUT.minimap.size.w;
        this.zoom = 0.15; // バランスの良い拡大率
        this.radius = this.size / 2;

        // 地形の再描画をプレイヤーがタイルをまたいだ時だけに絞るためのキャッシュ
        this._lastTerrainTileX = null;
        this._lastTerrainTileY = null;
        this._lastTerrainMapKey = null;

        this.createUI();
    }

    createUI() {
        // Position is managed by UILayoutManager (top-right corner)
        this.container = this.scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(5000); // 確実に最前面へ
        getUILayout(this.scene).register('minimap', this.container);

        // 背景
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillCircle(this.radius, this.radius, this.radius);
        // 高級感のあるゴールド/グリーンの枠線
        bg.lineStyle(2, 0x00ff00, 1);
        bg.strokeCircle(this.radius, this.radius, this.radius);
        this.container.add(bg);

        // 描画部（地形とエンティティでレイヤーを分ける）
        this.terrainGraphics = this.scene.add.graphics();
        this.container.add(this.terrainGraphics);

        this.entityGraphics = this.scene.add.graphics();
        this.container.add(this.entityGraphics);

        // 方角テキスト
        const nText = this.scene.add.text(this.radius, 5, 'N', {
            fontSize: '10px',
            color: '#00ff00',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        this.container.add(nText);
    }

    // 中心からの距離が円の中にあるかチェックするヘルパー
    isInside(x, y) {
        const dx = x - this.radius;
        const dy = y - this.radius;
        return (dx * dx + dy * dy) < (this.radius * this.radius);
    }

    // 地形は毎フレーム変化しないので、プレイヤーが今いるタイルが変わった時だけ
    // 再計算する（毎フレーム全レイヤー×範囲内タイルを舐めるとマップによっては重いため）。
    drawTerrain() {
        if (!this.scene.map) return;
        const player = this.scene.player;
        if (!player) return;

        const tileSize = 32;
        const range = 25;
        const px = Math.floor(player.x / tileSize);
        const py = Math.floor(player.y / tileSize);
        const mapKey = this.scene.currentMapKey || this.scene.map;

        if (px === this._lastTerrainTileX && py === this._lastTerrainTileY && mapKey === this._lastTerrainMapKey) {
            return; // タイルをまたいでいなければ再描画不要
        }
        this._lastTerrainTileX = px;
        this._lastTerrainTileY = py;
        this._lastTerrainMapKey = mapKey;

        this.terrainGraphics.clear();

        // 各レイヤーを走査（以前はcollision系のレイヤーしか描いておらず、
        // そのレイヤーが存在しないマップでは地形が何も見えなかった）
        this.scene.map.layers.forEach(layer => {
            const color = getTerrainColor(layer.name);
            this.terrainGraphics.fillStyle(color, 1);

            for (let ty = py - range; ty < py + range; ty++) {
                for (let tx = px - range; tx < px + range; tx++) {
                    const tile = this.scene.map.getTileAt(tx, ty, true, layer.name);
                    if (tile && tile.index !== -1 && tile.index !== 0) {
                        const rx = (tx * tileSize - player.x) * this.zoom + this.radius;
                        const ry = (ty * tileSize - player.y) * this.zoom + this.radius;

                        // 円の内側だけ描画（これがマスクの代わり）
                        if (this.isInside(rx, ry)) {
                            this.terrainGraphics.fillRect(rx, ry, tileSize * this.zoom, tileSize * this.zoom);
                        }
                    }
                }
            }
        });
    }

    drawEntities() {
        const player = this.scene.player;
        if (!player) return;

        const g = this.entityGraphics;
        g.clear();

        // 1. NPC (Yellow)
        g.fillStyle(0xffff00, 1);
        if (this.scene.npcs) {
            this.scene.npcs.forEach(npc => {
                if (npc.active) this.drawDot(npc.x, npc.y, player, 2);
            });
        }

        // 2. 他のプレイヤー (Blue)
        g.fillStyle(0x00ccff, 1);
        if (this.scene.networkManager) {
            const others = this.scene.networkManager.getOtherPlayers();
            Object.values(others).forEach(p => {
                if (p.active) this.drawDot(p.x, p.y, player, 2);
            });
        }

        // 3. 敵 (Red)
        g.fillStyle(0xff3300, 1);
        if (this.scene.networkManager) {
            const enemies = this.scene.networkManager.getEnemies();
            Object.values(enemies).forEach(e => {
                if (e.active) this.drawDot(e.x, e.y, player, 2);
            });
        }
        if (this.scene.boss && this.scene.boss.active) {
            this.drawDot(this.scene.boss.x, this.scene.boss.y, player, 4);
        }

        // 4. 自分 (Center Green)
        g.fillStyle(0x00ff00, 1);
        g.fillCircle(this.radius, this.radius, 4);

        // 向き
        const angle = player.rotation || 0;
        g.lineStyle(2, 0x00ff00, 1);
        g.beginPath();
        g.moveTo(this.radius, this.radius);
        g.lineTo(
            this.radius + Math.cos(angle) * 10,
            this.radius + Math.sin(angle) * 10
        );
        g.strokePath();
    }

    drawDot(worldX, worldY, player, dotSize) {
        const rx = (worldX - player.x) * this.zoom + this.radius;
        const ry = (worldY - player.y) * this.zoom + this.radius;

        if (this.isInside(rx, ry)) {
            this.entityGraphics.fillCircle(rx, ry, dotSize);
        }
    }

    update() {
        if (!this.entityGraphics || !this.scene.player) return;
        this.drawTerrain();
        this.drawEntities();
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
