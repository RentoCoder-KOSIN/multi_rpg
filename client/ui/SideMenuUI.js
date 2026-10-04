import { pinToScreen } from '../utils/screenFixed.js';
import { UI_LAYOUT } from './uiLayout.js';
import { getUILayout } from './UILayoutManager.js';

// Menu buttons. To add a button, add one line here.
//   ui: name of the scene property that holds the window (must have toggle())
const MENU_ITEMS = [
    { icon: '🎒', label: 'Inv', key: 'I', color: '#e94560', ui: 'inventoryUI' },
    { icon: '🛡️', label: 'Equ', key: 'S', color: '#4a90e2', ui: 'equipmentUI' },
    { icon: '📊', label: 'Sta', key: 'P', color: '#ffd700', ui: 'statAllocationUI' },
    { icon: '📜', label: 'Qst', key: 'Q', color: '#00ccaa', ui: 'questLogUI' },
    { icon: '🔮', label: 'Skl', key: 'K', color: '#533483', ui: 'skillManagerUI' },
    { icon: '👥', label: 'Pty', key: 'V', color: '#00ff00', ui: 'partyUI' },
    { icon: '💬', label: 'Chat', key: 'T', color: '#c080ff', ui: 'chatUI' },
    { icon: '⚙️', label: 'Set', key: 'O', color: '#aaaaaa', ui: 'settingsUI' }
];

const ITEM_RADIUS = 32;
const ITEM_SPACING = 68;
const ITEM_GAP_FROM_TOGGLE = 10;

export default class SideMenuUI {
    constructor(scene) {
        this.scene = scene;
        this.isExpanded = false;
        this.container = null;
        this.buttons = [];
        this.createUI();
    }

    createUI() {
        // The toggle button is round; its radius comes from the layout size
        const toggleRadius = UI_LAYOUT.menu.size.w / 2;

        // Container origin = center of the toggle button (position is managed by UILayoutManager)
        this.container = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(300000);
        pinToScreen(this.container);
        getUILayout(this.scene).register('menu', this.container);

        // Toggle button (hamburger)
        this.toggleBtn = this.scene.add.container(0, 0);
        const toggleBg = this.scene.add.circle(0, 0, toggleRadius, 0x1a1a2e, 0.9).setStrokeStyle(4, 0x4a90e2);
        const toggleIcon = this.scene.add.text(0, -8, '☰', {
            fontSize: '40px', color: '#ffffff', fontFamily: 'Arial'
        }).setOrigin(0.5);
        const toggleLabel = this.scene.add.text(0, 22, '[M]', {
            fontSize: '12px', color: '#ffffff', fontFamily: '"Press Start 2P"'
        }).setOrigin(0.5);

        this.toggleBtn.add([toggleBg, toggleIcon, toggleLabel]);

        // Large hit area (mobile friendly)
        const hitSize = toggleRadius * 2;
        const toggleHitArea = this.scene.add.rectangle(0, 0, hitSize, hitSize, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        this.toggleBtn.add(toggleHitArea);
        this.toggleBtn.sendToBack(toggleHitArea);
        this.toggleBtn.sendToBack(toggleBg);

        toggleHitArea.on('pointerdown', (pointer, x, y, event) => {
            if (event) event.stopPropagation();
            this.toggle();
        });
        toggleHitArea.on('pointerover', () => toggleBg.setStrokeStyle(3, 0xffffff));
        toggleHitArea.on('pointerout', () => toggleBg.setStrokeStyle(4, 0x4a90e2));

        this.container.add(this.toggleBtn);

        // Item list (hidden at first). Expands downward under the toggle button.
        this.menuItems = this.scene.add.container(0, 0).setVisible(false);
        this.container.add(this.menuItems);

        MENU_ITEMS.forEach((item, index) => {
            const y = toggleRadius + ITEM_GAP_FROM_TOGGLE + ITEM_RADIUS + index * ITEM_SPACING;
            this.buttons.push(this.createItemButton(item, y));
        });
    }

    createItemButton(item, y) {
        const hit = ITEM_RADIUS * 2;
        const color = Phaser.Display.Color.HexStringToColor(item.color).color;

        const btn = this.scene.add.container(0, y);
        const bg = this.scene.add.circle(0, 0, ITEM_RADIUS, 0x1a1a2e, 0.9).setStrokeStyle(2, color);
        const icon = this.scene.add.text(0, -5, item.icon, { fontSize: '28px' }).setOrigin(0.5);
        const keyLabel = this.scene.add.text(0, 20, `[${item.key}]`, {
            fontSize: '10px', fontFamily: '"Press Start 2P"', color: '#ffffff'
        }).setOrigin(0.5);

        btn.add([bg, icon, keyLabel]);
        btn.setSize(hit, hit);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerdown', (pointer, x, y2, event) => {
            if (event) event.stopPropagation();
            const target = this.scene[item.ui];
            if (target && target.toggle) target.toggle();
            this.toggle(); // close the menu
        });
        btn.on('pointerover', () => {
            bg.setStrokeStyle(3, 0xffffff);
            btn.setScale(1.1);
        });
        btn.on('pointerout', () => {
            bg.setStrokeStyle(2, color);
            btn.setScale(1);
        });

        this.menuItems.add(btn);
        return btn;
    }

    toggle() {
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
            this.menuItems.setVisible(true);
            this.menuItems.setAlpha(0);
            this.menuItems.y = -20;

            this.scene.tweens.add({
                targets: this.menuItems,
                alpha: 1,
                y: 0,
                duration: 200,
                ease: 'Back.easeOut'
            });
            this.scene.tweens.add({ targets: this.toggleBtn, angle: 90, duration: 200 });
        } else {
            this.scene.tweens.add({
                targets: this.menuItems,
                alpha: 0,
                y: -20,
                duration: 150,
                ease: 'Power2.easeIn',
                onComplete: () => this.menuItems.setVisible(false)
            });
            this.scene.tweens.add({ targets: this.toggleBtn, angle: 0, duration: 200 });
        }
    }
}
