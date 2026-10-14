import { areEffectsEnabled } from '../utils/effectsSettings.js';
import { getMapDisplayName } from '../data/maps.js';
import { UI_FONT } from '../fontConfig.js';

/**
 * マップごとの環境演出（アンビエントパーティクル・大気エフェクト）。
 * マップのテーマに応じた空気感を演出し、作り込みと臨場感を大幅に向上させる。
 */

const ATMOSPHERE_CONFIGS = {
    volcano: {
        type: 'embers',
        count: 45,
        color: [0xff4400, 0xff7722, 0xffaa00, 0xff2200],
        speedY: { min: -70, max: -25 },
        speedX: { min: -15, max: 15 },
        size: { min: 2, max: 4.5 },
        alpha: { min: 0.3, max: 0.8 },
        ambientTint: 0xff3300,
        ambientAlpha: 0.05
    },
    forest: {
        type: 'leaves',
        count: 35,
        color: [0x55cc66, 0x88ee77, 0xaaff88, 0x44aa55],
        speedY: { min: 10, max: 40 },
        speedX: { min: -25, max: 35 },
        size: { min: 2, max: 4 },
        alpha: { min: 0.3, max: 0.75 },
        ambientTint: 0x228833,
        ambientAlpha: 0.03
    },
    tutorial: {
        type: 'leaves',
        count: 25,
        color: [0x77dd88, 0xaaffaa, 0x55bb66],
        speedY: { min: 8, max: 30 },
        speedX: { min: -20, max: 25 },
        size: { min: 2, max: 3.5 },
        alpha: { min: 0.25, max: 0.65 },
        ambientTint: 0x33aa44,
        ambientAlpha: 0.02
    },
    wetland: {
        type: 'fireflies',
        count: 40,
        color: [0x66ffcc, 0x44ddff, 0x88ffaa, 0xaaffff],
        speedY: { min: -15, max: 15 },
        speedX: { min: -15, max: 15 },
        size: { min: 1.5, max: 3.5 },
        alpha: { min: 0.3, max: 0.85 },
        ambientTint: 0x004466,
        ambientAlpha: 0.04
    },
    ruins: {
        type: 'runes',
        count: 35,
        color: [0x88aaff, 0xbb88ff, 0x66ddff, 0xff88ff],
        speedY: { min: -25, max: -10 },
        speedX: { min: -10, max: 10 },
        size: { min: 2, max: 4 },
        alpha: { min: 0.25, max: 0.75 },
        ambientTint: 0x332266,
        ambientAlpha: 0.04
    },
    snow_city: {
        type: 'snow',
        count: 50,
        color: [0xffffff, 0xddf0ff, 0xeeeeff],
        speedY: { min: 35, max: 80 },
        speedX: { min: -30, max: 10 },
        size: { min: 1.5, max: 3.5 },
        alpha: { min: 0.4, max: 0.9 },
        ambientTint: 0xaaccff,
        ambientAlpha: 0.03
    },
    desert_city: {
        type: 'sand',
        count: 40,
        color: [0xddbb77, 0xcc9955, 0xeecc88],
        speedY: { min: -5, max: 15 },
        speedX: { min: 40, max: 90 },
        size: { min: 1.5, max: 3 },
        alpha: { min: 0.3, max: 0.7 },
        ambientTint: 0xbb7722,
        ambientAlpha: 0.03
    },
    port_city: {
        type: 'sparks',
        count: 25,
        color: [0x88ddff, 0xaaffff, 0xffffff],
        speedY: { min: -20, max: 20 },
        speedX: { min: -20, max: 20 },
        size: { min: 1.5, max: 3 },
        alpha: { min: 0.25, max: 0.6 },
        ambientTint: 0x0066aa,
        ambientAlpha: 0.02
    },
    city: {
        type: 'sparks',
        count: 20,
        color: [0xffeebb, 0xffdd88, 0xaaccff],
        speedY: { min: -15, max: 15 },
        speedX: { min: -15, max: 15 },
        size: { min: 1.5, max: 3 },
        alpha: { min: 0.2, max: 0.55 },
        ambientTint: 0x445588,
        ambientAlpha: 0.02
    }
};

export class MapAtmosphere {
    constructor(scene, mapKey) {
        this.scene = scene;
        this.mapKey = mapKey;
        this.particles = [];
        this.ambientGfx = null;
        this.particleGfx = null;
        this.bannerContainer = null;

        const configKey = Object.keys(ATMOSPHERE_CONFIGS).find(k => (mapKey || '').toLowerCase().includes(k));
        this.config = configKey ? ATMOSPHERE_CONFIGS[configKey] : null;

        if (this.config && areEffectsEnabled(scene)) {
            this.init();
        }

        if (areEffectsEnabled(scene)) {
            this.showBanner();
        }
    }

    init() {
        const scene = this.scene;
        const cfg = this.config;

        // アンビエント大気光オーバーレイ（画面固定）
        if (cfg.ambientTint && cfg.ambientAlpha) {
            this.ambientGfx = scene.add.graphics();
            this.ambientGfx.setScrollFactor(0);
            this.ambientGfx.setDepth(15000); // プレイヤーより前面、UIより背面
            this.ambientGfx.fillStyle(cfg.ambientTint, cfg.ambientAlpha);
            this.ambientGfx.fillRect(0, 0, scene.scale.width, scene.scale.height);
            if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(this.ambientGfx);
        }

        // パーティクル用Graphics
        this.particleGfx = scene.add.graphics();
        this.particleGfx.setDepth(14000);
        if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(this.particleGfx);

        // パーティクルデータ初期化
        const cam = scene.cameras.main;
        const w = cam.width || 800;
        const h = cam.height || 600;

        for (let i = 0; i < cfg.count; i++) {
            this.particles.push(this.createParticle(cam, w, h, true));
        }
    }

    createParticle(cam, w, h, initialRandom = false) {
        const cfg = this.config;
        const color = Phaser.Utils.Array.GetRandom(cfg.color);
        const size = Phaser.Math.FloatBetween(cfg.size.min, cfg.size.max);
        const vx = Phaser.Math.FloatBetween(cfg.speedX.min, cfg.speedX.max);
        const vy = Phaser.Math.FloatBetween(cfg.speedY.min, cfg.speedY.max);
        const baseAlpha = Phaser.Math.FloatBetween(cfg.alpha.min, cfg.alpha.max);

        // カメラ視野内のランダム位置にスポーン
        const scrollX = cam.scrollX || 0;
        const scrollY = cam.scrollY || 0;
        const x = initialRandom ? (scrollX + Math.random() * (w + 100) - 50) : (
            vx > 0 ? scrollX - 20 : (vx < 0 ? scrollX + w + 20 : scrollX + Math.random() * w)
        );
        const y = initialRandom ? (scrollY + Math.random() * (h + 100) - 50) : (
            vy > 0 ? scrollY - 20 : (vy < 0 ? scrollY + h + 20 : scrollY + Math.random() * h)
        );

        return {
            x, y, vx, vy, size, color, baseAlpha,
            phase: Math.random() * Math.PI * 2,
            pulseSpeed: Phaser.Math.FloatBetween(1.5, 3.5)
        };
    }

    update(time, delta) {
        if (!this.particleGfx || !this.config || !areEffectsEnabled(this.scene)) return;

        const dt = (delta || 16) / 1000;
        const cam = this.scene.cameras.main;
        const w = cam.width || 800;
        const h = cam.height || 600;
        const scrollX = cam.scrollX || 0;
        const scrollY = cam.scrollY || 0;

        const g = this.particleGfx;
        g.clear();

        const bounds = {
            left: scrollX - 60,
            right: scrollX + w + 60,
            top: scrollY - 60,
            bottom: scrollY + h + 60
        };

        const sec = time / 1000;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // タイプに応じたゆらぎ
            if (this.config.type === 'embers' || this.config.type === 'fireflies') {
                p.x += (p.vx + Math.sin(sec * p.pulseSpeed + p.phase) * 15) * dt;
                p.y += (p.vy + Math.cos(sec * p.pulseSpeed * 0.8 + p.phase) * 10) * dt;
            } else if (this.config.type === 'leaves') {
                p.x += (p.vx + Math.sin(sec * 2 + p.phase) * 20) * dt;
                p.y += p.vy * dt;
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }

            // 視野外に出たら反対側からリサイクル
            if (p.x < bounds.left || p.x > bounds.right || p.y < bounds.top || p.y > bounds.bottom) {
                this.particles[i] = this.createParticle(cam, w, h, false);
                continue;
            }

            // 明滅パルス
            const pulse = 0.7 + 0.3 * Math.sin(sec * p.pulseSpeed + p.phase);
            const currentAlpha = p.baseAlpha * pulse;

            g.fillStyle(p.color, currentAlpha);
            g.fillCircle(p.x, p.y, p.size);

            // 蛍やルーン、火の粉には淡い外側ハロー光
            if (p.size >= 2.5 && (this.config.type === 'embers' || this.config.type === 'fireflies' || this.config.type === 'runes')) {
                g.fillStyle(p.color, currentAlpha * 0.3);
                g.fillCircle(p.x, p.y, p.size * 2);
            }
        }
    }

    showBanner() {
        const scene = this.scene;
        const displayName = getMapDisplayName(this.mapKey);
        if (!displayName) return;

        const w = scene.scale?.width || 800;
        const cx = w / 2;
        const targetY = 95;

        const container = scene.add.container(cx, targetY - 20);
        container.setScrollFactor(0);
        container.setDepth(20000);
        container.setAlpha(0);
        this.bannerContainer = container;
        if (scene.minimapCameraIgnore) scene.minimapCameraIgnore(container);

        // 背景バー
        const barW = 340;
        const barH = 50;
        const bgGfx = scene.add.graphics();
        bgGfx.fillStyle(0x0c101c, 0.85);
        bgGfx.fillRoundedRect(-barW / 2, -barH / 2, barW, barH, 8);
        bgGfx.lineStyle(1.5, 0xe0c068, 0.9);
        bgGfx.strokeRoundedRect(-barW / 2, -barH / 2, barW, barH, 8);

        // 装飾ダイヤモンド
        bgGfx.fillStyle(0xffd700, 1);
        bgGfx.fillPoint(-barW / 2 + 14, 0, 4);
        bgGfx.fillPoint(barW / 2 - 14, 0, 4);

        // タイトルテキスト
        const titleText = scene.add.text(0, -5, `— ${displayName} —`, {
            fontFamily: UI_FONT,
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // 英語サブテキスト
        const subText = scene.add.text(0, 14, String(this.mapKey || '').toUpperCase().replace(/_/g, ' '), {
            fontFamily: UI_FONT,
            fontSize: '10px',
            color: '#b0c4de',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        container.add([bgGfx, titleText, subText]);

        // アニメーション (フェードイン -> 待機 -> フェードアウト)
        scene.tweens.add({
            targets: container,
            y: targetY,
            alpha: 1,
            duration: 450,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                scene.time.delayedCall(2200, () => {
                    if (!container.active) return;
                    scene.tweens.add({
                        targets: container,
                        y: targetY + 15,
                        alpha: 0,
                        duration: 600,
                        ease: 'Cubic.easeIn',
                        onComplete: () => {
                            container.destroy();
                            if (this.bannerContainer === container) this.bannerContainer = null;
                        }
                    });
                });
            }
        });
    }

    destroy() {
        if (this.bannerContainer) {
            this.bannerContainer.destroy();
            this.bannerContainer = null;
        }
        if (this.ambientGfx) {
            this.ambientGfx.destroy();
            this.ambientGfx = null;
        }
        if (this.particleGfx) {
            this.particleGfx.destroy();
            this.particleGfx = null;
        }
        this.particles = [];
    }
}
