import { ITEMS } from "../data/items.js";
import { SEED_CONFIG } from "../gameConstants.js";
import BaseWindowUI from "./BaseWindowUI.js";
import { entryId, entryCount, removableCount, removeFromInventory } from "../utils/inventoryOps.js";

export default class InventoryUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🎒 INVENTORY',
            width: 620,
            height: 480,
            depth: 110000,
            titleStroke: 0xe94560
        });

        this.selectedIndex = 0;
        this.inventory = [];
        this.slots = [];

        // 追加のセットアップは createWindow 内で行う
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // 下部詳細パネル (個別要素)
        const detailBg = this.scene.add.graphics();
        detailBg.fillStyle(0x000000, 0.4);
        detailBg.fillRoundedRect(-panelWidth / 2 + 20, panelHeight / 2 - 85, panelWidth - 40, 70, 10);
        this.container.add(detailBg);

        this.detailText = this.scene.add.text(0, panelHeight / 2 - 50, '十字キーで選択、Enterで装備/使用（Shift+Enterでまとめて使用）\nUで個数を指定して使用、Deleteで捨てる（売るのはショップで）', {
            fontSize: '11px', fontFamily: '"Press Start 2P"', color: '#e0e0e0',
            wordWrap: { width: panelWidth - 60 }, align: 'center'
        }).setOrigin(0.5);
        this.container.add(this.detailText);

        // 個数指定で使うボタン
        this.useManyBtn = this.scene.add.text(panelWidth / 2 - 72, panelHeight / 2 - 25, '🔢', { fontSize: '24px' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        this.useManyBtn.on('pointerdown', (p, lx, ly, e) => {
            if (e) e.stopPropagation();
            this.handleUseMany();
        });
        this.container.add(this.useManyBtn);

        // ゴミ箱ボタン
        this.trashBtn = this.scene.add.text(panelWidth / 2 - 40, panelHeight / 2 - 25, '🗑️', { fontSize: '24px' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        this.trashBtn.on('pointerdown', (e) => {
            if (e) e.stopPropagation();
            this.handleItemDiscard();
        });
        this.container.add(this.trashBtn);

        // マスクエリア
        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        const maskShape = this.scene.add.graphics();
        maskShape.setScrollFactor(0);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRect(sceneWidth / 2 - panelWidth / 2 + 20, sceneHeight / 2 - 165, panelWidth - 40, 310);
        maskShape.setVisible(false);
        const mask = maskShape.createGeometryMask();

        this.listContainer = this.scene.add.container(0, 0);
        this.listContainer.setMask(mask);
        this.container.add(this.listContainer);

        // キーボード登録 (BaseWindowUI の Esc 以外)
        this.scene.input.keyboard.on('keydown', (event) => {
            // 個数ダイアログの操作中（と閉じた直後）は、そのキー入力をこちらで処理しない
            if (this.scene.quantityDialog?.isBlocking()) return;

            // Iキーは常に（閉じている時でも）反応するように
            if (event.code === 'KeyI') {
                if (!this.scene.shopUI?.isOpen) {
                    this.toggle();
                }
                return;
            }

            if (!this.isOpen || (this.scene.shopUI && this.scene.shopUI.isOpen)) return;

            const itemsPerRow = 5;
            if (event.code === 'ArrowRight') {
                this.selectedIndex = Math.min(this.inventory.length - 1, this.selectedIndex + 1);
            } else if (event.code === 'ArrowLeft') {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            } else if (event.code === 'ArrowDown') {
                if (this.selectedIndex + itemsPerRow < this.inventory.length) this.selectedIndex += itemsPerRow;
                else if (this.inventory.length > 0) this.selectedIndex = this.inventory.length - 1;
            } else if (event.code === 'ArrowUp') {
                if (this.selectedIndex - itemsPerRow >= 0) this.selectedIndex -= itemsPerRow;
            } else if (event.code === 'Enter') {
                if (this.inventory[this.selectedIndex]) {
                    // Shift+Enterで、その枠にあるアイテムをまとめて（所持数分）一気に使用する
                    this.handleItemClick(this.selectedIndex, event.shiftKey);
                }
            } else if (event.code === 'Delete' || event.code === 'Backspace') {
                this.handleItemDiscard();
            } else if (event.code === 'KeyU') {
                this.handleUseMany();
            }
            this.updateSelection();
        });

        // マウスホイールでの選択移動(1行分ずつ)
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            if (this.scene.quantityDialog?.isBlocking()) return;
            if (!this.isOpen || (this.scene.shopUI && this.scene.shopUI.isOpen)) return;
            const itemsPerRow = 5;
            if (deltaY > 0) {
                if (this.selectedIndex + itemsPerRow < this.inventory.length) this.selectedIndex += itemsPerRow;
                else if (this.inventory.length > 0) this.selectedIndex = this.inventory.length - 1;
            } else if (deltaY < 0) {
                if (this.selectedIndex - itemsPerRow >= 0) this.selectedIndex -= itemsPerRow;
            }
            this.updateSelection();
        });
    }

    open() {
        super.open();
        this.selectedIndex = 0;
        this.refreshList();
    }

    refreshList() {
        this.listContainer.removeAll(true);
        this.slots = [];
        if (!this.scene.player) return;

        this.inventory = this.scene.player.stats.inventory || [];
        const itemsPerRow = 5;
        const slotSize = 110;
        const startY = -110;

        if (this.inventory.length === 0) {
            const emptyText = this.scene.add.text(0, 0, 'アイテムがありません', {
                fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#666666'
            }).setOrigin(0.5);
            this.listContainer.add(emptyText);
            return;
        }

        this.inventory.forEach((invItem, index) => {
            // 文字列の場合とオブジェクトの場合両方に対応
            const itemId = (typeof invItem === 'string') ? invItem : invItem.id;
            const count = (typeof invItem === 'string') ? 1 : (invItem.count || 1);

            const item = ITEMS[itemId];
            if (!item) return;

            const x = (index % itemsPerRow - (itemsPerRow / 2 - 0.5)) * slotSize;
            const y = startY + (Math.floor(index / itemsPerRow)) * slotSize;

            const slot = this.scene.add.container(x, y);

            // スロット背景
            const slotBg = this.scene.add.graphics();
            this.drawSlot(slotBg, 0x0f3460, 0.4, 0x533483, 0.3);

            // アイコン
            const itemIcon = this.scene.add.text(0, -10, this.getItemEmoji(item), { fontSize: '30px' }).setOrigin(0.5);

            // 名前
            const nameText = this.scene.add.text(0, 25, item.name.substring(0, 6), {
                fontSize: '9px', fontFamily: '"Press Start 2P"', color: '#ffffff'
            }).setOrigin(0.5);

            // 個数表示 (スタック可能な場合)
            let countText = null;
            if (count > 1) {
                countText = this.scene.add.text(35, 35, `x${count}`, {
                    fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#ffffff', stroke: '#000', strokeThickness: 2
                }).setOrigin(1, 1);
            }

            slot.add([slotBg, itemIcon, nameText]);
            if (countText) slot.add(countText);

            this.listContainer.add(slot);

            // インタラクティブ化 (タップ対応)
            slot.setSize(96, 96);
            slot.setInteractive({ useHandCursor: true });
            slot.on('pointerdown', (p, x, y, event) => {
                if (event) event.stopPropagation();
                this.selectedIndex = index;
                this.updateSelection();
                // Shiftを押しながらクリックすると、そのアイテムを所持数分まとめて使用する
                this.handleItemClick(index, !!(event && event.shiftKey));
            });

            this.slots.push({ bg: slotBg, item: item, container: slot, id: itemId }); // idも保持
        });
        this.updateSelection();
    }

    drawSlot(gfx, bgColor, bgAlpha, strokeColor, strokeAlpha) {
        gfx.clear();
        gfx.fillStyle(bgColor, bgAlpha);
        gfx.fillRoundedRect(-48, -48, 96, 96, 12);
        gfx.lineStyle(2, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(-48, -48, 96, 96, 12);
    }

    getItemEmoji(item) {
        if (item.type === 'weapon') return '⚔️';
        if (item.type === 'armor') return '🛡️';
        if (item.type === 'accessory') return '💍';
        if (item.id.includes('potion')) return '🧪';
        return '📦';
    }

    updateSelection() {
        if (this.slots.length === 0) return;

        this.slots.forEach((slot, index) => {
            // 文字列ID比較 (オブジェクト化されたインベントリでも item.id は文字列)
            const isEquipped = this.scene.player.stats.equipment.weapon === slot.item.id ||
                this.scene.player.stats.equipment.armor === slot.item.id ||
                this.scene.player.stats.equipment.relic === slot.item.id;

            if (index === this.selectedIndex) {
                this.drawSlot(slot.bg, 0xe94560, 0.4, 0xffffff, 1);
                if (this.detailText) {
                    const typeStr = slot.item.type === 'weapon' ? '[武器]' : (slot.item.type === 'armor' ? '[防具]' : (slot.item.type === 'accessory' ? '[宝具]' : '[消耗品]'));
                    let reqText = '';
                    if (slot.item.lvlReq) {
                        const isOk = this.scene.player.stats.level >= slot.item.lvlReq;
                        const power = this.scene.player.getEquipmentPowerMultiplier?.(slot.item) ?? 1;
                        reqText = isOk ? `\n必要Lv: ${slot.item.lvlReq} ✔` : `\n必要Lv: ${slot.item.lvlReq}（装備可・性能${Math.round(power * 100)}%）`;
                    }
                    this.detailText.setText(`${typeStr} ${slot.item.name}${reqText}\n${slot.item.description}`);

                }
                // スクロール追従
                const targetY = -(Math.max(0, Math.floor(index / 5) - 1)) * 110;
                this.listContainer.y = targetY;
                slot.container.setScale(1.1);
            } else {
                this.drawSlot(slot.bg, 0x0f3460, 0.4, isEquipped ? 0x00ff00 : 0x533483, isEquipped ? 1 : 0.3);
                slot.container.setScale(1);
            }
        });
    }

    handleItemClick(index, useAll = false) {
        // indexを受け取るように変更
        if (typeof index !== 'number') return; // 安全策

        const invItem = this.inventory[index];
        if (!invItem) return;

        const itemId = (typeof invItem === 'string') ? invItem : invItem.id;
        const item = ITEMS[itemId];

        if (!item || !this.scene.player) return;

        if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
            // 装備品はまとめ使用の対象外（useAllは無視）
            this.scene.player.equipItem(itemId);
        } else if (item.type === 'material') {
            // 属性の玉などの素材はここでは使用しない（街の鍛冶屋で使う）
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('街の鍛冶屋で装備に使用できます', 'info');
            }
        } else {
            this.useItem(index, useAll);
        }
        this.refreshList();
    }

    useItem(index, useAll = false, useCountOverride = null) {
        const invItem = this.inventory[index];
        if (!invItem) return;

        const itemId = (typeof invItem === 'string') ? invItem : invItem.id;
        const item = ITEMS[itemId];
        const player = this.scene.player;

        if (!item || !player) return;

        // useAll=trueなら、その枠にスタックされている分をまとめて一気に消費する
        const stackCount = entryCount(invItem);
        const s = item.stats || {};

        // 制限解除の証: 一度使うとキャラクター単位で恒久的に有効。
        if (s.unlockEquipmentCapLevel) {
            const cap = s.unlockEquipmentCapLevel;
            if ((player.stats.equipmentCapLevel || 0) >= cap) {
                this.scene.notificationUI?.show(`必要Lv${cap}までの装備制限はすでに解除済みです`, 'info');
                return;
            }
            player.stats.equipmentCapLevel = cap;
            removeFromInventory(player, index, 1);
            player.applyEquipmentStats();
            player.saveStats();
            this.scene.notificationUI?.show(`装備制限を解除！ 必要Lv${cap}までの装備を本来の性能で扱えます`, 'success', 5000);
            this.refreshList();
            return;
        }

        // リセットの書は「まとめて使う」ことに意味が無いので、常に1個だけ使う。
        // 効果が無い状況（割り振りが無い・職業が無い）では、確認も消費もしない。
        if (s.resetStats || s.resetJob) {
            this.useResetBook(index, invItem, s);
            return;
        }

        // useCountOverride: 個数ダイアログで指定された個数。useAll=trueなら所持数ぶん全部
        let useCount = Math.max(1, Math.min(stackCount, useCountOverride ?? (useAll ? stackCount : 1)));

        // 「種」の永続強化には上限がある（無限に強くなるのを防ぐ。gameConstants.js の SEED_CONFIG）。
        // 上限までしか使わず、上限に達していたら消費もしない。
        if (s.attackBoost > 0 || s.defenseBoost > 0) {
            const roomAtk = s.attackBoost > 0
                ? Math.floor((SEED_CONFIG.MAX_BONUS_ATK - (player.stats.bonusAtk || 0)) / s.attackBoost) : Infinity;
            const roomDef = s.defenseBoost > 0
                ? Math.floor((SEED_CONFIG.MAX_BONUS_DEF - (player.stats.bonusDef || 0)) / s.defenseBoost) : Infinity;
            const room = Math.min(roomAtk, roomDef);
            if (room <= 0) {
                const which = roomAtk <= 0 ? `攻撃力(上限+${SEED_CONFIG.MAX_BONUS_ATK})` : `防御力(上限+${SEED_CONFIG.MAX_BONUS_DEF})`;
                if (this.scene.notificationUI) this.scene.notificationUI.show(`${which}は、これ以上アップしない！`, 'error');
                return;
            }
            useCount = Math.min(useCount, room);
        }

        const heal = ((item.heal || s.heal || 0) + Math.floor(player.stats.maxHp * (s.healPct || 0))) * useCount;
        if (heal > 0) {
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`HPが ${heal} 回復した！${useCount > 1 ? ` (x${useCount})` : ''}`, "success");
        }

        const healMp = ((item.healMp || s.healMp || 0) + Math.floor(player.stats.maxMp * (s.healMpPct || 0))) * useCount;
        if (healMp > 0) {
            player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + healMp);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`MPが ${healMp} 回復した！${useCount > 1 ? ` (x${useCount})` : ''}`, "success");
        }

        // パーティ全員のHPを回復（回復の泉など）
        if (s.healAll > 0) {
            const healAllAmount = s.healAll * useCount;
            player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + healAllAmount);

            const netManager = this.scene.networkManager;
            if (netManager) {
                const myId = netManager.getPlayerId();
                const memberIds = netManager.partyData?.members?.map(m => m.id) || [];
                const otherPlayers = netManager.getOtherPlayers();
                memberIds.forEach(memberId => {
                    if (memberId === myId) return;
                    const remotePlayer = otherPlayers[memberId];
                    if (!remotePlayer || !remotePlayer.active) return;
                    netManager.healPlayer(memberId, healAllAmount);
                });
            }
            if (this.scene.notificationUI) this.scene.notificationUI.show(`パーティ全員のHPが ${healAllAmount} 回復した！${useCount > 1 ? ` (x${useCount})` : ''}`, "success");
        }

        // 永続ステータス上昇（攻撃力/防御力の種）
        if (s.attackBoost > 0) {
            const boost = s.attackBoost * useCount;
            player.stats.bonusAtk = (player.stats.bonusAtk || 0) + boost;
            if (this.scene.notificationUI) this.scene.notificationUI.show(`攻撃力が永久に+${boost}された！${useCount > 1 ? ` (x${useCount})` : ''}`, "warning");
        }
        if (s.defenseBoost > 0) {
            const boost = s.defenseBoost * useCount;
            player.stats.bonusDef = (player.stats.bonusDef || 0) + boost;
            if (this.scene.notificationUI) this.scene.notificationUI.show(`防御力が永久に+${boost}された！${useCount > 1 ? ` (x${useCount})` : ''}`, "warning");
        }
        if (s.attackBoost > 0 || s.defenseBoost > 0) {
            player.applyEquipmentStats();
        }

        // 蘇生アイテム: 死亡時に自動発動するチャージとして保持
        if (s.revive) {
            player.stats.reviveCharges = (player.stats.reviveCharges || 0) + useCount;
            if (this.scene.notificationUI) this.scene.notificationUI.show(`死亡時に自動で復活するお守りを手に入れた！${useCount > 1 ? ` (x${useCount})` : ''}`, "warning");
        }

        // 消費処理 (個数減算 or 削除)
        if (typeof invItem === 'object' && invItem.count > useCount) {
            invItem.count -= useCount;
        } else {
            player.stats.inventory.splice(index, 1);
            // インデックス調整
            if (this.selectedIndex >= player.stats.inventory.length) {
                this.selectedIndex = Math.max(0, player.stats.inventory.length - 1);
            }
        }

        player.saveStats();
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
    }

    // リセットの書（ステータス/職業）の使用
    useResetBook(index, invItem, s) {
        const player = this.scene.player;
        const notify = (msg, type = 'info') => this.scene.notificationUI?.show(msg, type);

        if (s.resetStats) {
            const alloc = player.stats.allocatedStats || player.estimateAllocatedStats();
            const total = Object.values(alloc).reduce((a, b) => a + b, 0);
            if (total <= 0) {
                notify('割り振ったステータスポイントがありません', 'error');
                return;
            }
            if (!confirm(`割り振った ${total} ポイントを全て返還します。よろしいですか？`)) return;
            const refunded = player.resetStatPoints();
            notify(`ステータスをリセットしました（${refunded}ポイント返還）。Pキーで振り直せます`, 'success');
        } else if (s.resetJob) {
            if (player.stats.job === 'none') {
                notify('すでに職業がありません。職業管理人で職業を選べます', 'error');
                return;
            }
            if (!confirm('職業を「なし」に戻します。習得スキルとJob EXPはリセットされます。よろしいですか？')) return;
            player.resetJob();
            notify('職業をリセットしました。街かチュートリアルの職業管理人で選び直してください', 'success');
        }

        removeFromInventory(player, index, 1);
        if (this.selectedIndex >= player.stats.inventory.length) {
            this.selectedIndex = Math.max(0, player.stats.inventory.length - 1);
        }
        player.saveStats();
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
        this.refreshList();
    }

    // Uキー / 🔢ボタン: 個数を指定して使う（消耗品のみ。装備品・素材は対象外）
    handleUseMany() {
        const invItem = this.inventory[this.selectedIndex];
        if (!invItem || !this.scene.player) return;
        const item = ITEMS[entryId(invItem)];
        if (!item) return;

        if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') {
            this.scene.notificationUI?.show('装備品は個数を指定して使えません', 'info');
            return;
        }
        if (item.type === 'material') {
            this.scene.notificationUI?.show('街の鍛冶屋で装備に使用できます', 'info');
            return;
        }

        const count = entryCount(invItem);
        if (count <= 1 || item.stats?.resetStats || item.stats?.resetJob) {
            // 1個しかない/リセットの書は、個数を選ぶ意味が無いので通常の使用と同じ
            this.handleItemClick(this.selectedIndex, false);
            return;
        }

        const index = this.selectedIndex;
        this.scene.quantityDialog.show({
            title: '🔢 いくつ使う？',
            itemName: item.name,
            max: count,
            confirmLabel: '使う',
            onConfirm: (qty) => {
                // ダイアログを開いている間にインベントリが変わっていないか確認してから使う
                const current = this.scene.player.stats.inventory[index];
                if (!current || entryId(current) !== entryId(invItem)) return;
                this.useItem(index, false, Math.min(qty, entryCount(current)));
                this.refreshList();
                this.updateSelection();
            },
        });
    }

    // 🗑️ / Delete: 個数を選んで捨てる。売るのはショップ（ShopUI の「売る」）からだけ。
    handleItemDiscard() {
        if (this.selectedIndex < 0 || this.selectedIndex >= this.inventory.length) return;
        const player = this.scene.player;
        if (!player) return;

        const index = this.selectedIndex;
        const invItem = this.inventory[index];
        const itemId = entryId(invItem);
        const item = ITEMS[itemId];
        if (!item) return;

        // 装備中の1個は捨てられない（同じ装備を複数持っていれば、余った分は捨てられる）
        const maxDiscard = removableCount(player, invItem);
        if (maxDiscard <= 0) {
            this.scene.notificationUI?.show('装備中のアイテムは捨てられません', 'error');
            return;
        }

        this.scene.quantityDialog.show({
            title: '🗑️ 捨てる',
            itemName: `${item.name}${entryCount(invItem) > 1 ? `（所持 ${entryCount(invItem)}）` : ''}`,
            max: maxDiscard,
            confirmLabel: '捨てる',
            onConfirm: (qty) => {
                const current = player.stats.inventory[index];
                if (!current || entryId(current) !== itemId) return;
                const n = Math.min(qty, removableCount(player, current));
                if (n <= 0) return;
                removeFromInventory(player, index, n);
                if (this.selectedIndex >= player.stats.inventory.length) {
                    this.selectedIndex = Math.max(0, player.stats.inventory.length - 1);
                }
                player.saveStats();
                this.scene.notificationUI?.show(`${item.name} を${n > 1 ? ` ${n}個 ` : ''}捨てました`, 'info');
                this.refreshList();
                this.updateSelection();
            },
        });
    }
}
