// Tiledの「FacilityTrigger」レイヤーから施設（data/facilities.js）を作り、Eキー/タップで開けるようにする。
import {
    FACILITY_TYPES, FACILITY_LAYER_NAME, FACILITY_INTERACT_KEY, FACILITY_PROMPT_INTERVAL_MS,
} from '../../data/facilities.js';
import { isAnyWindowOpen } from '../../utils/uiState.js';
import GuildQuestBoardUI from '../../ui/GuildQuestBoardUI.js';

// FACILITY_TYPES[type].ui のUIをシーンがまだ持っていないときの生成方法
const UI_FACTORIES = {
    guildQuestBoardUI: (scene) => {
        const ui = new GuildQuestBoardUI(scene);
        ui.createUI();
        return ui;
    },
};

const resolve = (value, ...args) => (typeof value === 'function' ? value(...args) : value);

// Tiledオブジェクトのプロパティ配列 → { name: value }
function readProps(obj) {
    const props = {};
    (obj.properties || []).forEach((p) => { props[p.name] = p.value; });
    return props;
}

function parseColor(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const n = parseInt(value.replace('#', '').slice(-6), 16);
    return Number.isNaN(n) ? fallback : n;
}

// レイヤー名は Phaser では 'Objects/FacilityTrigger' のようにグループ名付きで返ることがある
function findFacilityObjects(scene) {
    const names = scene.map.getObjectLayerNames?.() || [];
    return names
        .filter((n) => n === FACILITY_LAYER_NAME || n.endsWith(`/${FACILITY_LAYER_NAME}`))
        .flatMap((n) => scene.map.getObjectLayer(n)?.objects || []);
}

export function setupFacilities(scene) {
    const objects = findFacilityObjects(scene);
    scene.facilityZones = [];
    if (!objects.length) return;

    const key = scene.input.keyboard.addKey(FACILITY_INTERACT_KEY);

    objects.forEach((obj) => {
        const props = readProps(obj);
        const type = FACILITY_TYPES[props.facility];
        if (!type) {
            console.warn(`[facilities] 未知の facility "${props.facility}" (object id ${obj.id}) → スキップ。data/facilities.js の FACILITY_TYPES を確認してください`);
            return;
        }
        if (props.facility === 'shop' && !props.shop) {
            console.warn(`[facilities] shop 施設に shop プロパティがありません (object id ${obj.id})`);
        }

        const zone = { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
        const cx = zone.x + zone.width / 2;
        const cy = zone.y + zone.height / 2;

        const icon = props.icon ?? type.icon;
        const text = props.label || obj.name || resolve(type.defaultLabel, props);
        const labelText = `${icon ? icon + ' ' : ''}${text}`;
        const color = parseColor(props.color, type.color ?? 0xffffff);

        let sign = null;
        if (props.showLabel !== false) {
            scene.add.rectangle(cx, cy, zone.width, zone.height, color, 0.2).setStrokeStyle(2, color, 0.8);
            sign = scene.add.text(cx, zone.y - 14, labelText, {
                fontSize: '16px', color: '#ffcc88', fontFamily: 'Arial', stroke: '#000', strokeThickness: 4
            }).setOrigin(0.5);
        }

        // UIをシーンが持っていなければ、必要なときに作る
        if (!scene[type.ui] && UI_FACTORIES[type.ui]) scene[type.ui] = UI_FACTORIES[type.ui](scene);

        const facility = { id: props.facility, props, zone, lastOverlapAt: -Infinity, lastPromptAt: -Infinity };

        const trigger = () => {
            const ui = scene[type.ui];
            if (!ui) return;
            const method = type.method || 'toggle';
            const ownOpen = !!ui.isOpen;
            // 他のウィンドウが開いている間は無視。toggle型は自分のウィンドウをもう一度押して閉じられる
            if (isAnyWindowOpen(scene) && !(ownOpen && method === 'toggle')) return;
            ui[method](...resolve(type.args, props) || []);
        };

        const area = scene.add.rectangle(cx, cy, zone.width, zone.height, 0x000000, 0);
        scene.physics.add.existing(area, true);
        scene.physics.add.overlap(scene.player, area, () => {
            facility.lastOverlapAt = scene.time.now;
            const ui = scene[type.ui];
            if (!ui || ui.isOpen && (type.method || 'toggle') !== 'toggle') return;

            if (Phaser.Input.Keyboard.JustDown(key)) {
                trigger();
            } else if (!ui.isOpen && scene.time.now - facility.lastPromptAt > FACILITY_PROMPT_INTERVAL_MS) {
                scene.notificationUI?.show(resolve(type.prompt, text, props), 'info', 2000);
                facility.lastPromptAt = scene.time.now;
            }
        });

        // スマホ等: 施設の中にいるとき、看板をタップして開く
        if (sign) {
            sign.setInteractive({ useHandCursor: true });
            sign.on('pointerdown', (pointer, x, y, event) => {
                if (event) event.stopPropagation();
                if (scene.time.now - facility.lastOverlapAt < 200) trigger();
            });
        }

        scene.facilityZones.push({ ...facility, area, sign });
    });
}
