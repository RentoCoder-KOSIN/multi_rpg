import { ITEMS } from "../data/items.js";
import { getShopLoadout, resolveShopItems } from "../data/shops.js";
import BaseWindowUI from "./BaseWindowUI.js";
import { areEffectsEnabled } from "../utils/effectsSettings.js";
import { collectElementStats, resistKey, damageKey, getElementName } from "../data/elements.js";
import { entryId, entryCount, removableCount, removeFromInventory, unitSellPrice } from "../utils/inventoryOps.js";

// 装備statsから属性ごとの表示文言を作る（属性を追加してもここは書き換え不要）
function elementStatParts(stats, keyFn, format) {
    return Object.entries(collectElementStats(stats, keyFn)).map(([el, v]) => format(el, v));
}

// 武器・防具・消耗品のステータスを、購入前に一目でわかる短い文字列にまとめる。
// 「買うときに攻撃力とかステータスがわからない」を解消するための表示用ヘルパー。
function summarizeItemStats(item) {
    const s = item.stats || {};
    const parts = [];

    if (item.type === 'weapon') {
        if (typeof item.calculateAtk === 'function') {
            parts.push('ATK 1~150(運次第)');
        } else {
            const atk = item.atk ?? s.attack;
            const matk = item.matk ?? s.matk;
            if (atk) parts.push(`ATK+${atk}`);
            if (matk) parts.push(`MATK+${matk}`);
        }
        const crit = item.critChance ?? s.critChance;
        if (crit) parts.push(`会心+${Math.round(crit * 100)}%`);
        const lifesteal = item.lifesteal ?? s.lifesteal;
        if (lifesteal) parts.push(`吸収${Math.round(lifesteal * 100)}%`);
        const speed = item.speedBonus ?? s.speedBonus;
        if (speed) parts.push(`速度+${speed}`);
        parts.push(...elementStatParts(s, damageKey, (el, v) => `${getElementName(el)}+${v}`));
        if (s.freezeChance) parts.push(`凍結${Math.round(s.freezeChance * 100)}%`);
        if (s.deathChance) parts.push(`即死${Math.round(s.deathChance * 100)}%`);
        if (s.attackMultiplier) parts.push(`ATK×${s.attackMultiplier}`);
        const expMult = item.expMultiplier ?? s.expMultiplier;
        if (expMult) parts.push(`EXP×${expMult}`);
    } else if (item.type === 'armor') {
        const def = item.def ?? s.defense;
        if (def) parts.push(`DEF+${def}`);
        parts.push(...elementStatParts(s, resistKey, (el, v) => `${getElementName(el)}耐性+${v}%`));
        if (s.attackMultiplier) parts.push(`ATK×${s.attackMultiplier}`);
        if (s.poison) parts.push('⚠HPが徐々に減る');
    } else if (item.type === 'accessory') {
        // 宝具は武器・防具どちらの数値も持ちうるので、両方チェックする
        const atk = item.atk ?? s.attack;
        const matk = item.matk ?? s.matk;
        const def = item.def ?? s.defense;
        if (atk) parts.push(`ATK+${atk}`);
        if (matk) parts.push(`MATK+${matk}`);
        if (def) parts.push(`DEF+${def}`);
        if (s.critChance) parts.push(`会心+${Math.round(s.critChance * 100)}%`);
        if (s.lifesteal) parts.push(`吸収${Math.round(s.lifesteal * 100)}%`);
        if (s.speedBonus) parts.push(`速度+${s.speedBonus}`);
        parts.push(...elementStatParts(s, resistKey, (el, v) => `${getElementName(el)}耐性+${v}%`));
        if (s.attackMultiplier) parts.push(`ATK×${s.attackMultiplier}`);
        if (s.expMultiplier) parts.push(`EXP×${s.expMultiplier}`);
        if (s.poison) parts.push('⚠HPが徐々に減る');
    } else {
        // 消耗品など
        const heal = item.heal ?? s.heal;
        if (heal) parts.push(`HP+${heal}`);
        if (item.healMp) parts.push(`MP+${item.healMp}`);
        if (s.healMp) parts.push(`MP+${s.healMp}`);
        if (s.healPct) parts.push(`HP+${Math.round(s.healPct * 100)}%`);
        if (s.healMpPct) parts.push(`MP+${Math.round(s.healMpPct * 100)}%`);
        if (s.healAll) parts.push(`味方全員HP+${s.healAll}`);
        if (s.attackBoost) parts.push(`ATK永久+${s.attackBoost}`);
        if (s.defenseBoost) parts.push(`DEF永久+${s.defenseBoost}`);
        if (s.revive) parts.push('復活効果');
        if (s.resetStats) parts.push('ステ振り直し');
        if (s.resetJob) parts.push('職業を「なし」に');
    }

    return parts.length > 0 ? parts.join('  ') : '－';
}

const BUY_STACK_CAP = 99; // 1回の購入で買える上限個数

export default class ShopUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🏪 SHOP',
            width: 600,
            height: 480,
            depth: 100000,
            themeColor: 0x4a90e2
        });

        this.selectedIndex = 0;
        this.items = [];
        this.itemBoxes = [];
        // 'select' = 開いた直後の「買う/売る」選択 / 'buy' / 'sell'
        this.mode = 'select';
        this.modeChoice = 0; // 選択画面でのカーソル (0=買う, 1=売る)
        this.shopId = null;
        this.category = null;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // ゴールド表示 (個別要素)
        const goldPanel = this.scene.add.graphics();
        goldPanel.fillStyle(0x000000, 0.4);
        goldPanel.fillRoundedRect(-panelWidth / 2 + 20, panelHeight / 2 - 45, 180, 30, 8);
        this.container.add(goldPanel);

        this.goldText = this.scene.add.text(-panelWidth / 2 + 30, panelHeight / 2 - 30, '🪙 0', {
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#ffd700', stroke: '#000', strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.container.add(this.goldText);

        // 説明文パネル
        const descPanel = this.scene.add.graphics();
        descPanel.fillStyle(0x000000, 0.3);
        descPanel.fillRoundedRect(-panelWidth / 2 + 20, panelHeight / 2 - 105, panelWidth - 40, 50, 8);
        this.container.add(descPanel);

        this.descText = this.scene.add.text(0, panelHeight / 2 - 80, '', {
            fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#aaaaaa',
            wordWrap: { width: panelWidth - 60 }, align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.descText);

        // 買う/売る 切替ボタン（ヘッダー左）
        this.modeToggleBg = this.scene.add.rectangle(-panelWidth / 2 + 85, -panelHeight / 2 + 35, 130, 30, 0x2a6f97, 0.9)
            .setStrokeStyle(2, 0xffffff, 0.7).setInteractive({ useHandCursor: true }).setVisible(false);
        this.modeToggleText = this.scene.add.text(-panelWidth / 2 + 85, -panelHeight / 2 + 35, '', {
            fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#ffffff'
        }).setOrigin(0.5).setVisible(false);
        this.modeToggleBg.on('pointerdown', (p, lx, ly, ev) => {
            if (ev) ev.stopPropagation();
            this.setMode(this.mode === 'buy' ? 'sell' : 'buy');
        });
        this.container.add([this.modeToggleBg, this.modeToggleText]);

        // マスクエリア
        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        const maskShape = this.scene.add.graphics();
        maskShape.setScrollFactor(0);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(sceneWidth / 2 - panelWidth / 2 + 20, sceneHeight / 2 - 165, panelWidth - 40, 290);
        maskShape.setVisible(false);
        const mask = maskShape.createGeometryMask();

        this.itemListContainer = this.scene.add.container(0, 0);
        this.itemListContainer.setMask(mask);
        this.container.add(this.itemListContainer);

        this.createModeSelectPanel();

        // キーボード登録
        this.scene.input.keyboard.on('keydown', (event) => {
            if (!this.isOpen || (this.scene.inventoryUI && this.scene.inventoryUI.isOpen)) return;
            // 個数ダイアログの操作中（と閉じた直後）は、そのキー入力をこちらで処理しない
            if (this.scene.quantityDialog?.isBlocking()) return;

            // --- 「買う/売る」選択画面 ---
            if (this.mode === 'select') {
                if (event.code === 'ArrowLeft' || event.code === 'ArrowUp') {
                    this.modeChoice = 0; this.updateModeChoice();
                } else if (event.code === 'ArrowRight' || event.code === 'ArrowDown') {
                    this.modeChoice = 1; this.updateModeChoice();
                } else if (event.code === 'KeyB' || event.code === 'Digit1') {
                    this.setMode('buy');
                } else if (event.code === 'KeyS' || event.code === 'Digit2') {
                    this.setMode('sell');
                } else if (event.code === 'Enter') {
                    this.setMode(this.modeChoice === 0 ? 'buy' : 'sell');
                }
                return;
            }

            if (event.code === 'Tab') {
                event.preventDefault();
                this.setMode(this.mode === 'buy' ? 'sell' : 'buy');
            } else if (event.code === 'ArrowDown') {
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
                this.updateSelection();
            } else if (event.code === 'ArrowUp') {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                this.updateSelection();
            } else if (event.code === 'Enter') {
                this.activateSelected();
            }
        });

        // マウスホイールでの選択移動
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (!this.isOpen || (this.scene.inventoryUI && this.scene.inventoryUI.isOpen)) return;
            if (this.scene.quantityDialog?.isBlocking() || this.mode === 'select') return;
            if (deltaY > 0) {
                this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
            } else if (deltaY < 0) {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            }
            this.updateSelection();
        });
    }

    // ショップを開いた直後に出す「買う / 売る」の選択パネル
    createModeSelectPanel() {
        this.modePanel = this.scene.add.container(0, 0).setVisible(false);
        const label = this.scene.add.text(0, -80, '何をしますか？', {
            fontSize: '16px', fontFamily: '"Press Start 2P"', color: '#ffffff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5);
        this.modePanel.add(label);

        this.modeButtons = [];
        [
            { mode: 'buy', x: -130, text: '🛒 買う', key: '[B]', color: 0x2e8b57 },
            { mode: 'sell', x: 130, text: '💰 売る', key: '[S]', color: 0xb8860b },
        ].forEach((def, i) => {
            const bg = this.scene.add.rectangle(def.x, 20, 210, 120, def.color, 0.85)
                .setStrokeStyle(3, 0xffffff, 0.6).setInteractive({ useHandCursor: true });
            const t = this.scene.add.text(def.x, 5, def.text, {
                fontSize: '20px', fontFamily: '"Press Start 2P"', color: '#ffffff', stroke: '#000', strokeThickness: 3
            }).setOrigin(0.5);
            const k = this.scene.add.text(def.x, 50, def.key, {
                fontSize: '12px', fontFamily: '"Press Start 2P"', color: '#dddddd'
            }).setOrigin(0.5);
            bg.on('pointerdown', (p, lx, ly, ev) => { if (ev) ev.stopPropagation(); this.setMode(def.mode); });
            bg.on('pointerover', () => { this.modeChoice = i; this.updateModeChoice(); });
            this.modePanel.add([bg, t, k]);
            this.modeButtons.push(bg);
        });

        const hint = this.scene.add.text(0, 110, '←→で選択、Enterで決定（開いた後は Tab で切替）', {
            fontSize: '9px', fontFamily: '"Press Start 2P"', color: '#aaaaaa'
        }).setOrigin(0.5);
        this.modePanel.add(hint);
        this.container.add(this.modePanel);
    }

    updateModeChoice() {
        this.modeButtons?.forEach((bg, i) => {
            bg.setStrokeStyle(i === this.modeChoice ? 5 : 3, i === this.modeChoice ? 0xffff00 : 0xffffff, i === this.modeChoice ? 1 : 0.6);
            bg.setScale(i === this.modeChoice ? 1.05 : 1);
        });
    }

    open(shopId, category = null) {
        if (!this.container) this.createUI();
        super.open();

        this.shopId = shopId;
        this.category = category;
        this.selectedIndex = 0;
        this.itemListContainer.y = 0;

        const loadout = getShopLoadout(shopId);
        // BaseWindowUIのタイトルを更新可能にするか、ここで直接弄る
        const titleText = this.container.list.find(obj => obj instanceof Phaser.GameObjects.Text && obj.y < -this.config.height / 2 + 50 && obj !== this.modeToggleText);
        if (titleText) titleText.setText(`🏪 ${loadout.title}`);

        this.updateGold();
        // 開いた瞬間に「買う / 売る」を選ばせる
        this.setMode('select');
    }

    // 'select' | 'buy' | 'sell'
    setMode(mode) {
        this.mode = mode;
        this.selectedIndex = 0;
        this.itemListContainer.y = 0;

        const isSelect = mode === 'select';
        this.modePanel.setVisible(isSelect);
        this.itemListContainer.setVisible(!isSelect);
        this.modeToggleBg.setVisible(!isSelect);
        this.modeToggleText.setVisible(!isSelect);

        if (isSelect) {
            this.modeChoice = 0;
            this.updateModeChoice();
            this.itemListContainer.removeAll(true);
            this.itemBoxes = [];
            this.items = [];
            this.descText.setText('買う・売るを選んでください');
            return;
        }

        this.modeToggleText.setText(mode === 'buy' ? '⇄ 売るへ (Tab)' : '⇄ 買うへ (Tab)');
        if (mode === 'buy') this.refreshItemList(this.shopId, this.category);
        else this.refreshSellList();
        this.updateSelection();
    }

    updateGold() {
        if (this.scene.player && this.goldText) {
            this.goldText.setText(`🪙 ${this.scene.player.stats.gold}`);
        }
    }

    // 選択中の行を実行（買う or 売る）
    activateSelected() {
        const item = this.items[this.selectedIndex];
        if (!item) return;
        if (this.mode === 'sell') this.startSell(item);
        else this.startBuy(item);
    }

    // 行を1つ描く。row.action は 'BUY' / 'SELL'。price は1個あたり。
    addRow(item, index, { price, nameSuffix = '', action }) {
        const startY = -120;
        const spacing = 74; // ステータス行を追加したため、以前(70)より少し広げる
        const playerLevel = this.scene.player?.stats?.level || 1;
        const y = startY + (index * spacing);
        const box = this.scene.add.container(0, y);

        const boxBg = this.scene.add.graphics();
        this.drawItemBox(boxBg, 540, 64, 0x0f3460, 0.5, 0x4a90e2, 0.3);
        box.add(boxBg);

        // レベル不足でも購入・装備は可能（性能は装備時にレベル差で低下する）。
        const meetsLevel = !item.lvlReq || playerLevel >= item.lvlReq;
        const nameColor = meetsLevel ? '#ffffff' : '#ffd27a';

        const namePrefix = item.lvlReq ? `[Lv.${item.lvlReq}] ` : '';
        const name = this.scene.add.text(-250, -16, `${namePrefix}${item.name}${nameSuffix}`, {
            fontSize: '13px', fontFamily: '"Press Start 2P"', color: nameColor
        }).setOrigin(0, 0.5);
        box.add(name);

        // ステータス要約（攻撃力・防御力・会心率など）を1行で表示
        const statsLine = this.scene.add.text(-250, 15, summarizeItemStats(item), {
            fontSize: '9px', fontFamily: '"Press Start 2P"', color: '#8fd3ff'
        }).setOrigin(0, 0.5);
        box.add(statsLine);

        const priceText = this.scene.add.text(180, -16, `${price} G`, {
            fontSize: '13px', fontFamily: '"Press Start 2P"', color: '#ffd700'
        }).setOrigin(1, 0.5);
        box.add(priceText);

        const hint = this.scene.add.text(230, 15, action, {
            fontSize: '9px', fontFamily: '"Press Start 2P"', color: '#ffffff'
        }).setOrigin(0.5);
        box.add(hint);

        this.itemListContainer.add(box);

        // インタラクティブ化 (タップ対応)
        box.setSize(540, 64);
        box.setInteractive({ useHandCursor: true });
        box.on('pointerdown', () => {
            if (this.scene.quantityDialog?.isBlocking()) return;
            this.selectedIndex = index;
            this.updateSelection();
            this.activateSelected();
        });

        this.itemBoxes.push({ bgGfx: boxBg, item, container: box });
    }

    refreshItemList(shopId, category = null) {
        this.itemListContainer.removeAll(true);
        this.itemBoxes = [];
        const loadout = getShopLoadout(shopId);
        this.items = resolveShopItems(loadout.items, category);

        this.items.forEach((item, index) => this.addRow(item, index, { price: item.price, action: 'BUY' }));
    }

    // 「売る」一覧: 所持品のうち、売れるもの（price>0、装備中の1個は除く）を並べる。
    // 行は item 定義に sell 情報（インベントリの位置・売れる個数・単価）を足したもの。
    refreshSellList() {
        this.itemListContainer.removeAll(true);
        this.itemBoxes = [];
        this.items = [];

        const player = this.scene.player;
        if (!player) return;

        (player.stats.inventory || []).forEach((entry, invIndex) => {
            const def = ITEMS[entryId(entry)];
            if (!def) return;
            const unit = unitSellPrice(def);
            if (unit <= 0) return;
            const sellable = removableCount(player, entry);
            if (sellable <= 0) return; // 装備中
            this.items.push({ ...def, sell: { invIndex, count: sellable, unit, owned: entryCount(entry) } });
        });

        if (this.items.length === 0) {
            const empty = this.scene.add.text(0, 0, '売れるアイテムがありません', {
                fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#666666'
            }).setOrigin(0.5);
            this.itemListContainer.add(empty);
            return;
        }

        this.items.forEach((item, index) => this.addRow(item, index, {
            price: item.sell.unit,
            nameSuffix: item.sell.owned > 1 ? ` x${item.sell.owned}` : '',
            action: 'SELL'
        }));
    }

    drawItemBox(gfx, width, height, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(-width / 2, -height / 2, width, height, 10);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(-width / 2, -height / 2, width, height, 10);
    }

    updateSelection() {
        if (this.itemBoxes.length === 0 && this.descText) {
            this.descText.setText(this.mode === 'sell' ? 'Tab で「買う」に切り替え' : '');
        }
        this.itemBoxes.forEach((box, index) => {
            if (index === this.selectedIndex) {
                this.drawItemBox(box.bgGfx, 540, 64, 0x4a90e2, 0.4, 0xffffff, 1);
                if (this.descText) {
                    let desc = box.item.description || '説明なし';
                    if (box.item.lvlReq) {
                        const isOk = this.scene.player.stats.level >= box.item.lvlReq;
                        desc = `【必要Lv.${box.item.lvlReq} ${isOk ? '✔' : '❌'}】 ${desc}`;
                    }
                    const verb = this.mode === 'sell' ? 'Enterで売る' : 'Enterで購入';
                    this.descText.setText(`${desc}\n(${verb} / Tabで切替)`);
                }
                const targetY = -(Math.max(0, index - 1) * 74);
                this.scene.tweens.add({
                    targets: this.itemListContainer,
                    y: targetY, duration: 150, ease: 'Power2'
                });
                box.container.setScale(1.02);
                box.container.setSize(540 * 1.02, 64 * 1.02);
            } else {
                this.drawItemBox(box.bgGfx, 540, 64, 0x0f3460, 0.5, 0x4a90e2, 0.3);
                box.container.setScale(1);
                box.container.setSize(540, 64);
            }
        });
    }

    // --- 買う ---
    startBuy(item) {
        const p = this.scene.player;
        if (!p) return;
        if (p.stats.gold < item.price) {
            this.scene.notificationUI?.show("ゴールドが足りません！", "error");
            return;
        }

        const isGear = item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory';
        if (isGear || item.price <= 0) {
            // 装備品は1個ずつ買う
            this.buyItem(item.id, item.price, 1);
            return;
        }

        // 消耗品・素材は個数を選んで買う（所持金で買える範囲まで）
        const affordable = Math.min(BUY_STACK_CAP, Math.floor(p.stats.gold / item.price));
        this.scene.quantityDialog.show({
            title: '🛒 いくつ買う？',
            itemName: item.name,
            max: affordable,
            unitPrice: item.price,
            priceLabel: '合計',
            onConfirm: (qty) => this.buyItem(item.id, item.price, qty),
        });
    }

    buyItem(itemId, price, qty = 1) {
        const p = this.scene.player;
        const total = price * qty;
        if (!p || p.stats.gold < total) {
            if (this.scene.notificationUI) this.scene.notificationUI.show("ゴールドが足りません！", "error");
            return;
        }
        p.stats.gold -= total;
        p.addItem(itemId, qty);
        p.saveStats();
        this.updateGold();
        if (this.scene.notificationUI) this.scene.notificationUI.show(`[${ITEMS[itemId].name}]${qty > 1 ? ` x${qty}` : ''} を購入しました！`, "success");
        if (areEffectsEnabled(this.scene)) this.scene.cameras.main.shake(100, 0.002);
    }

    // --- 売る ---
    startSell(item) {
        const sell = item.sell;
        if (!sell) return;
        this.scene.quantityDialog.show({
            title: '💰 いくつ売る？',
            itemName: `${item.name}（所持 ${sell.owned}）`,
            max: sell.count,
            unitPrice: sell.unit,
            priceLabel: '売却額',
            onConfirm: (qty) => this.sellItem(item.id, sell.invIndex, qty),
        });
    }

    sellItem(itemId, invIndex, qty) {
        const p = this.scene.player;
        if (!p) return;
        const entry = p.stats.inventory[invIndex];
        // ダイアログを開いている間に所持品が変わっていた場合は、何も売らない
        if (!entry || entryId(entry) !== itemId) return;

        const def = ITEMS[itemId];
        const n = Math.min(qty, removableCount(p, entry));
        if (!def || n <= 0) {
            this.scene.notificationUI?.show('装備中のアイテムは売れません', 'error');
            return;
        }

        const total = unitSellPrice(def) * n;
        removeFromInventory(p, invIndex, n);
        // gainGold() は「GOLD +N」という別の通知も出すため、ここでは直接加算して
        // 「何を売って何Gになったか」が分かる一つの通知にまとめる。
        p.stats.gold += total;
        p.saveStats();
        this.scene.notificationUI?.show(`${def.name}${n > 1 ? ` x${n}` : ''} を ${total}G で売りました`, 'success');
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();

        this.updateGold();
        const keep = this.selectedIndex;
        this.refreshSellList();
        this.selectedIndex = Math.min(keep, Math.max(0, this.items.length - 1));
        this.updateSelection();
    }
}
