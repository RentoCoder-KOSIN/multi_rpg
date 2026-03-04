/**
 * Minimap UI - 安定版レーダー形式ミニマップ（マスク不使用）
 */
export default class MinimapUI {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.graphics = null;
        this.size = 140; // 少しコンパクトに
        this.zoom = 0.15; // バランスの良い拡大率
        this.padding = 15;
        this.radius = this.size / 2;

        this.createUI();
    }

    createUI() {
        const gameWidth = this.scene.scale.gameSize ? this.scene.scale.gameSize.width : this.scene.scale.width;

        // コンテナ作成
        this.container = this.scene.add.container(gameWidth - this.size - this.padding, this.padding);
        this.container.setScrollFactor(0);
        this.container.setDepth(5000); // 確実に最前面へ

        // 背景
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillCircle(this.radius, this.radius, this.radius);
        // 高級感のあるゴールド/グリーンの枠線
        bg.lineStyle(2, 0x00ff00, 1);
        bg.strokeCircle(this.radius, this.radius, this.radius);
        this.container.add(bg);

        // 描画部
        this.graphics = this.scene.add.graphics();
        this.container.add(this.graphics);

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

    drawTerrain() {
        if (!this.scene.map) return;
        const player = this.scene.player;
        if (!player) return;

        const tileSize = 32;
        const range = 25;
        const px = Math.floor(player.x / tileSize);
        const py = Math.floor(player.y / tileSize);

        this.graphics.fillStyle(0x444444, 1);

        // 各レイヤーを走査
        this.scene.map.layers.forEach(layer => {
            const isCollision = layer.name.toLowerCase().includes('collision') ||
                layer.name.toLowerCase().includes('wall') ||
                layer.name.toLowerCase().includes('block');

            if (isCollision) {
                for (let ty = py - range; ty < py + range; ty++) {
                    for (let tx = px - range; tx < px + range; tx++) {
                        const tile = this.scene.map.getTileAt(tx, ty, true, layer.name);
                        if (tile && tile.index !== -1 && tile.index !== 0) {
                            const rx = (tx * tileSize - player.x) * this.zoom + this.radius;
                            const ry = (ty * tileSize - player.y) * this.zoom + this.radius;

                            // 円の内側だけ描画（これがマスクの代わり）
                            if (this.isInside(rx, ry)) {
                                this.graphics.fillRect(rx, ry, tileSize * this.zoom, tileSize * this.zoom);
                            }
                        }
                    }
                }
            }
        });
    }

    drawEntities() {
        const player = this.scene.player;
        if (!player) return;

        // 1. NPC (Yellow)
        this.graphics.fillStyle(0xffff00, 1);
        if (this.scene.npcs) {
            this.scene.npcs.forEach(npc => {
                if (npc.active) this.drawDot(npc.x, npc.y, player, 2);
            });
        }

        // 2. 他のプレイヤー (Blue)
        this.graphics.fillStyle(0x00ccff, 1);
        if (this.scene.networkManager) {
            const others = this.scene.networkManager.getOtherPlayers();
            Object.values(others).forEach(p => {
                if (p.active) this.drawDot(p.x, p.y, player, 2);
            });
        }

        // 3. 敵 (Red)
        this.graphics.fillStyle(0xff3300, 1);
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
        this.graphics.fillStyle(0x00ff00, 1);
        this.graphics.fillCircle(this.radius, this.radius, 4);

        // 向き
        const angle = player.rotation || 0;
        this.graphics.lineStyle(2, 0x00ff00, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(this.radius, this.radius);
        this.graphics.lineTo(
            this.radius + Math.cos(angle) * 10,
            this.radius + Math.sin(angle) * 10
        );
        this.graphics.strokePath();
    }

    drawDot(worldX, worldY, player, dotSize) {
        const rx = (worldX - player.x) * this.zoom + this.radius;
        const ry = (worldY - player.y) * this.zoom + this.radius;

        if (this.isInside(rx, ry)) {
            this.graphics.fillCircle(rx, ry, dotSize);
        }
    }

    update() {
        if (!this.graphics || !this.scene.player) return;
        this.graphics.clear();
        this.drawTerrain();
        this.drawEntities();
    }

    destroy() {
        if (this.container) this.container.destroy();
    }
}
