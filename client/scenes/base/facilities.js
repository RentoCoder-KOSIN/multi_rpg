// マップ上の施設（data/facilities.js）の当たり判定とEキー操作をまとめて作る。
import { FACILITIES, FACILITY_INTERACT_KEY, FACILITY_PROMPT_INTERVAL_MS } from '../../data/facilities.js';
import { isAnyWindowOpen } from '../../utils/uiState.js';

// Tiledの「FacilityTrigger」レイヤーから { 施設id: zone } を読む（レイヤーが無ければ空）
function readMapZones(scene) {
    const zones = {};
    const names = scene.map.getObjectLayerNames?.() || [];
    const layerName = names.find((n) => n === 'FacilityTrigger' || n.endsWith('/FacilityTrigger'));
    const layer = layerName ? scene.map.getObjectLayer(layerName) : null;
    (layer?.objects || []).forEach((obj) => {
        const id = obj.properties?.find((p) => p.name === 'facility')?.value;
        if (id) zones[id] = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
    });
    return zones;
}

export function setupFacilities(scene, mapKey) {
    const defs = FACILITIES[mapKey];
    if (!defs || !defs.length) return;

    const mapZones = readMapZones(scene);
    const key = scene.input.keyboard.addKey(FACILITY_INTERACT_KEY);
    scene.facilityZones = [];

    defs.forEach((def) => {
        const zone = mapZones[def.id] || def.zone;
        const cx = zone.x + zone.width / 2;
        const cy = zone.y + zone.height / 2;

        if (def.label) {
            const color = def.color ?? 0xffffff;
            scene.add.rectangle(cx, cy, zone.width, zone.height, color, 0.2).setStrokeStyle(2, color, 0.8);
            scene.add.text(cx, zone.y - 14, def.label, {
                fontSize: '16px', color: '#ffcc88', fontFamily: 'Arial', stroke: '#000', strokeThickness: 4
            }).setOrigin(0.5);
        }

        const area = scene.add.rectangle(cx, cy, zone.width, zone.height, 0x000000, 0);
        scene.physics.add.existing(area, true);
        scene.physics.add.overlap(scene.player, area, () => {
            const ui = scene[def.ui];
            if (!ui) return;
            const method = def.method || 'toggle';

            // 他のウィンドウが開いている間は無視。ただしtoggle型の施設は自分のウィンドウをEで閉じられる
            const ownOpen = !!ui.isOpen;
            if (isAnyWindowOpen(scene) && !(ownOpen && method === 'toggle')) return;

            if (Phaser.Input.Keyboard.JustDown(key)) {
                ui[method](...(def.args || []));
            } else if (!ownOpen && (!def._lastPrompt || scene.time.now - def._lastPrompt > FACILITY_PROMPT_INTERVAL_MS)) {
                scene.notificationUI?.show(def.prompt, 'info', 2000);
                def._lastPrompt = scene.time.now;
            }
        });
        scene.facilityZones.push({ id: def.id, zone, area });
    });
}
