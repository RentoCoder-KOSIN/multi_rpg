// Tiledの「Chests」オブジェクトレイヤー（タイルオブジェクト）から宝箱を作り、Eキー/タップで開けられるようにする。
// 設定の書き方は data/chests.js。
import {
    CHEST_LAYER_NAME, CHEST_INTERACT_KEY, CHEST_INTERACT_DISTANCE,
    CHEST_PROMPT_INTERVAL_MS, CHEST_LOOTS,
} from '../../data/chests.js';
import { ITEMS } from '../../data/items.js';
import { isAnyWindowOpen } from '../../utils/uiState.js';

const GID_MASK = 0x1FFFFFFF; // Tiledの上位3bit(反転フラグ)を除く

function readProps(obj) {
    const props = {};
    (obj.properties || []).forEach((p) => { props[p.name] = p.value; });
    return props;
}

// レイヤー名は Phaser では 'Objects/Chests' のようにグループ名付きで返ることがある
function findChestObjects(scene) {
    const names = scene.map.getObjectLayerNames?.() || [];
    return names
        .filter((n) => n === CHEST_LAYER_NAME || n.endsWith(`/${CHEST_LAYER_NAME}`))
        .flatMap((n) => scene.map.getObjectLayer(n)?.objects || []);
}

// gid から、そのタイルを描くためのテクスチャキーとフレーム名を返す（無ければ null）。
// タイルセット画像は1枚絵なので、必要になったタイルだけフレームを足して使う。
function getTileFrame(scene, gid) {
    const tilesets = scene.map.tilesets || [];
    let ts = null;
    tilesets.forEach((t) => { if (t.firstgid <= gid && (!ts || t.firstgid > ts.firstgid)) ts = t; });
    const texture = ts?.image;
    if (!ts || !texture) return null;

    const index = gid - ts.firstgid;
    const frameName = `tile_${ts.name}_${index}`;
    if (!texture.has(frameName)) {
        const columns = ts.columns || Math.max(1, Math.floor((ts.image.getSourceImage().width - ts.tileMargin * 2 + ts.tileSpacing) / (ts.tileWidth + ts.tileSpacing)));
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = ts.tileMargin + col * (ts.tileWidth + ts.tileSpacing);
        const y = ts.tileMargin + row * (ts.tileHeight + ts.tileSpacing);
        texture.add(frameName, 0, x, y, ts.tileWidth, ts.tileHeight);
    }
    return { key: texture.key, frame: frameName };
}

// "potion:3,magic_stone:10" → [{id,count}]
function parseItemsProp(value) {
    if (typeof value !== 'string') return [];
    return value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [id, count] = s.split(':').map((v) => v.trim());
        return { id, count: Math.max(1, Math.floor(Number(count)) || 1) };
    });
}

function buildLoot(props, objId) {
    let gold = 0;
    let items = [];
    if (props.loot) {
        const tpl = CHEST_LOOTS[props.loot];
        if (tpl) {
            gold += tpl.gold || 0;
            items = items.concat((tpl.items || []).map((i) => ({ ...i })));
        } else {
            console.warn(`[chests] 未知の loot "${props.loot}" (object id ${objId}) → data/chests.js の CHEST_LOOTS を確認してください`);
        }
    }
    gold += Math.max(0, Math.floor(Number(props.gold)) || 0);
    items = items.concat(parseItemsProp(props.items));
    items = items.filter((i) => {
        if (ITEMS[i.id]) return true;
        console.warn(`[chests] 未知のアイテム "${i.id}" (object id ${objId}) → スキップ`);
        return false;
    });
    return { gold, items };
}

function isOpened(player, chestKey) {
    return (player.stats.openedChests || []).includes(chestKey);
}

function showOpened(chest) {
    const { sprite, props, scene } = chest;
    if (props.openedGid) {
        const f = getTileFrame(scene, props.openedGid & GID_MASK);
        if (f) { sprite.setTexture(f.key, f.frame); return; }
    }
    sprite.setTint(0x777777); // 開けた後の絵が無いときは暗くして「開封済み」を表す
}

function openChest(scene, chest) {
    const player = scene.player;
    if (!player?.active || chest.opened) return;

    chest.opened = true;
    if (!Array.isArray(player.stats.openedChests)) player.stats.openedChests = [];
    player.stats.openedChests.push(chest.key);

    const { gold, items } = chest.loot;
    if (gold > 0) player.gainGold(gold);
    items.forEach((i) => player.addItem(i.id, i.count));
    if (gold <= 0 && items.length === 0) scene.notificationUI?.show('宝箱は空だった…', 'info');
    player.saveStats(); // 開封済みの記録をセーブへ

    showOpened(chest);
    chest.label?.setVisible(false);
    scene.tweens.add({ targets: chest.sprite, scaleX: 1.1, scaleY: 1.1, duration: 100, yoyo: true });
}

export function setupChests(scene) {
    scene.chests = [];
    const objects = findChestObjects(scene);
    if (!objects.length) return;

    const mapKey = scene.currentMapKey || scene.getSceneConfig().mapKey;
    scene.chestKey = scene.input.keyboard.addKey(CHEST_INTERACT_KEY);

    objects.forEach((obj) => {
        const gid = (obj.gid || 0) & GID_MASK;
        if (!gid) {
            console.warn(`[chests] object id ${obj.id} はタイルオブジェクトではありません（挿入→タイル で置いてください）→ スキップ`);
            return;
        }
        const frame = getTileFrame(scene, gid);
        if (!frame) {
            console.warn(`[chests] object id ${obj.id}: gid ${gid} のタイルセット画像が読み込まれていません → スキップ`);
            return;
        }

        const props = readProps(obj);
        const key = props.chestId ? String(props.chestId) : `${mapKey}:${obj.id}`;

        // タイルオブジェクトは (x, y) が左下。幅・高さはTiledで拡縮した値
        const sprite = scene.add.image(obj.x, obj.y, frame.key, frame.frame).setOrigin(0, 1);
        if (obj.width && obj.height) sprite.setDisplaySize(obj.width, obj.height);
        if (obj.rotation) sprite.setAngle(obj.rotation);
        sprite.setDepth(obj.y); // プレイヤー/敵と同じく、下にあるものほど手前

        const chest = {
            key, props, scene, sprite,
            loot: buildLoot(props, obj.id),
            opened: isOpened(scene.player, key),
            lastPromptAt: -Infinity,
            label: null,
        };

        const cx = sprite.x + sprite.displayWidth / 2;
        const cy = sprite.y - sprite.displayHeight / 2;
        chest.center = { x: cx, y: cy };

        if (props.solid !== false) {
            scene.physics.add.existing(sprite, true);
            scene.physics.add.collider(scene.player, sprite);
        }

        if (chest.opened) {
            showOpened(chest);
        } else {
            chest.label = scene.add.text(cx, sprite.y - sprite.displayHeight - 12, props.label || obj.name || '宝箱', {
                fontSize: '14px', color: '#ffe066', fontFamily: 'Arial', stroke: '#000', strokeThickness: 4,
            }).setOrigin(0.5).setDepth(obj.y + 1);

            // スマホ等: 近くにいるとき、宝箱をタップして開く
            sprite.setInteractive({ useHandCursor: true });
            sprite.on('pointerdown', (pointer, x, y, event) => {
                if (event) event.stopPropagation();
                if (isNear(scene, chest) && !isAnyWindowOpen(scene)) openChest(scene, chest);
            });
        }

        scene.chests.push(chest);
    });
}

function isNear(scene, chest) {
    const p = scene.player;
    return Phaser.Math.Distance.Between(p.x, p.y, chest.center.x, chest.center.y) <= CHEST_INTERACT_DISTANCE;
}

// 毎フレーム: 近くの未開封の宝箱があれば案内を出し、Eキーで開ける
export function updateChests(scene) {
    if (!scene.chests?.length || !scene.player?.active) return;
    if (isAnyWindowOpen(scene) || scene.dialogue?.isTalking) return;

    const pressed = Phaser.Input.Keyboard.JustDown(scene.chestKey);
    for (const chest of scene.chests) {
        if (chest.opened || !isNear(scene, chest)) continue;
        if (pressed) {
            openChest(scene, chest);
            return; // 1回の押下で開けるのは1個まで
        }
        if (scene.time.now - chest.lastPromptAt > CHEST_PROMPT_INTERVAL_MS) {
            scene.notificationUI?.show(`[${CHEST_INTERACT_KEY}] ${chest.props.label || '宝箱'}を開ける`, 'info', 2000);
            chest.lastPromptAt = scene.time.now;
        }
    }
}
