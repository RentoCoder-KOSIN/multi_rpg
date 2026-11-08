import { UI_FONT } from '../fontConfig.js';
import { SKILLS } from '../data/skills.js';
import { JOBS } from '../data/jobs.js';
import { ELEMENT_INFO } from '../data/elements.js';
import BaseWindowUI from './BaseWindowUI.js';

export default class JobSkillPreviewUI extends BaseWindowUI {
    constructor(scene) {
        super(scene, {
            title: '🔍 職業スキル詳細',
            width: 680,
            height: 520,
            depth: 130000,
            themeColor: 0xffd700,
            titleStroke: 0xffa500,
            overlayAlpha: 0.6
        });

        this.currentJobId = null;
        this.scrollY = 0;
        this.maxScrollY = 0;
    }

    createUI() {
        if (this.container) return;
        this.createWindow();

        const panelWidth = this.config.width;
        const panelHeight = this.config.height;

        // タイトルテキストの参照を保持
        this.titleRef = this.container.list.find(c => c.type === 'Text' && c.text === this.config.title);

        // サブ情報バー（職業説明など）
        this.subText = this.scene.add.text(0, -panelHeight / 2 + 65, '', {
            fontSize: '12px', fontFamily: UI_FONT, color: '#e0e0ff', align: 'center', stroke: '#000', strokeThickness: 2
        }).setOrigin(0.5);
        this.container.add(this.subText);

        // リスト領域（マスク）
        const { width: sceneWidth, height: sceneHeight } = this.scene.scale;
        this.listContainer = this.scene.add.container(0, -panelHeight / 2 + 95);

        this.maskShape = this.scene.add.graphics();
        this.maskShape.setScrollFactor(0);
        this.maskShape.fillStyle(0xffffff);
        this.maskShape.fillRect(
            sceneWidth / 2 - panelWidth / 2 + 15,
            sceneHeight / 2 - panelHeight / 2 + 95,
            panelWidth - 30,
            panelHeight - 160
        );
        const mask = this.maskShape.createGeometryMask();
        this.maskShape.setVisible(false);
        this.listContainer.setMask(mask);
        this.container.add(this.listContainer);

        // 下部ボタン領域
        this.bottomContainer = this.scene.add.container(0, panelHeight / 2 - 35);
        this.container.add(this.bottomContainer);

        // ホイール・キー操作
        this.wheelHandler = (pointer, gameObjects, deltaX, deltaY) => {
            if (!this.isOpen) return;
            this.scroll(deltaY > 0 ? 50 : -50);
        };
        this.scene.input.on('wheel', this.wheelHandler);

        this.keyHandler = (event) => {
            if (!this.isOpen) return;
            if (event.code === 'ArrowDown') {
                this.scroll(40);
            } else if (event.code === 'ArrowUp') {
                this.scroll(-40);
            } else if (event.code === 'Escape') {
                this.close();
            }
        };
        this.scene.input.keyboard.on('keydown', this.keyHandler);

        this.scene.events.once('shutdown', () => this.destroy());
    }

    scroll(delta) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.listContainer.y = (-this.config.height / 2 + 95) - this.scrollY;
    }

    showJob(jobId) {
        this.currentJobId = jobId;
        if (!this.container) this.createUI();
        super.open();

        this.scrollY = 0;
        this.listContainer.y = -this.config.height / 2 + 95;
        this.renderJobSkills(jobId);
    }

    renderJobSkills(jobId) {
        this.listContainer.removeAll(true);
        this.bottomContainer.removeAll(true);

        const jobDef = JOBS[jobId];
        if (!jobDef) return;

        const player = this.scene.player;

        // タイトル更新
        if (this.titleRef) {
            this.titleRef.setText(`【上位職】${jobDef.name} のスキル一覧`);
        }
        if (this.subText) {
            const reqLv = jobDef.reqLevel || 50;
            const typeStr = jobDef.type === 'magical' ? '魔法職' : '近接・物理職';
            this.subText.setText(`${jobDef.description} （${typeStr} / 転職条件: Lv.${reqLv}）`);
        }

        // スキル一覧収集
        const skillEntries = [];
        if (jobDef.skills) {
            Object.entries(jobDef.skills).forEach(([lvl, skills]) => {
                const reqLvl = parseInt(lvl);
                skills.forEach(skillId => {
                    const skill = SKILLS[skillId];
                    if (skill) {
                        skillEntries.push({ lvl: reqLvl, skill });
                    }
                });
            });
        }

        // レベル順にソート
        skillEntries.sort((a, b) => a.lvl - b.lvl);

        const cardW = 630;
        const cardH = 82;
        const spacing = 90;

        skillEntries.forEach((entry, index) => {
            const { lvl, skill } = entry;
            const y = index * spacing + cardH / 2;
            const card = this.scene.add.container(0, y);

            // 背景
            const bg = this.scene.add.graphics();
            const isActive = skill.type === 'active';
            const borderCol = isActive ? 0x4a90e2 : 0x00cc88;
            const fillCol = isActive ? 0x141e30 : 0x0f2b24;

            bg.fillStyle(fillCol, 0.9);
            bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
            bg.lineStyle(2, borderCol, 0.8);
            bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
            card.add(bg);

            // アイコン
            const icon = this.scene.add.text(-cardW / 2 + 35, 0, skill.icon || '⚔️', {
                fontSize: '32px'
            }).setOrigin(0.5);
            card.add(icon);

            // スキル名
            const nameColor = isActive ? '#ffd700' : '#88ffcc';
            const name = this.scene.add.text(-cardW / 2 + 75, -24, `${skill.name}`, {
                fontSize: '15px', fontFamily: UI_FONT, color: nameColor, style: 'bold'
            });
            card.add(name);

            // 種別バッジ & 解放Lv
            const typeLabel = isActive ? '【Active】' : '【Passive】';
            const typeColor = isActive ? '#66ccff' : '#66ff99';
            const badge = this.scene.add.text(-cardW / 2 + 75 + name.width + 10, -23, `${typeLabel}  習得: Lv.${lvl}`, {
                fontSize: '11px', fontFamily: UI_FONT, color: typeColor
            });
            card.add(badge);

            // スペックライン (Active / Passive)
            let specStr = '';
            if (isActive) {
                const cdStr = skill.cd ? `${(skill.cd / 1000).toFixed(1)}s` : '0s';
                const mpStr = skill.mpCost ? `${skill.mpCost}` : '0';
                const rangeStr = skill.range ? `${skill.range}px` : '近接';
                const rangeTypeMap = { circle: '円形', line: '直線貫通', fan: '扇状' };
                const rtStr = rangeTypeMap[skill.rangeType] || skill.rangeType || '範囲';
                const elemStr = skill.element && ELEMENT_INFO[skill.element]
                    ? ` | 属性: ${ELEMENT_INFO[skill.element].icon}${ELEMENT_INFO[skill.element].name}`
                    : '';
                const multStr = skill.damageMult ? `×${skill.damageMult}` : '';

                specStr = `威力: ${multStr} | CT: ${cdStr} | MP: ${mpStr} | 射程: ${rangeStr}(${rtStr})${elemStr}`;
            } else {
                specStr = '常時発動型パッシブスキル（ステータス・アビリティ強化）';
            }

            const specText = this.scene.add.text(-cardW / 2 + 75, -5, specStr, {
                fontSize: '11px', fontFamily: UI_FONT, color: '#ffea70'
            });
            card.add(specText);

            // 説明文
            const desc = this.scene.add.text(-cardW / 2 + 75, 15, skill.description || '説明なし', {
                fontSize: '11px', fontFamily: UI_FONT, color: '#dddddd', wordWrap: { width: 530 }
            });
            card.add(desc);

            this.listContainer.add(card);
        });

        const totalHeight = skillEntries.length * spacing;
        const visibleHeight = this.config.height - 160;
        this.maxScrollY = Math.max(0, totalHeight - visibleHeight + 20);

        // 下部ボタン
        const canPromote = player && player.stats.level >= (jobDef.reqLevel || 50) && player.stats.job !== jobId;

        if (canPromote) {
            // 転職するボタン
            const promoteBtn = this.scene.add.graphics();
            promoteBtn.fillStyle(0x00aa44, 1);
            promoteBtn.fillRoundedRect(-180, -18, 160, 36, 6);
            promoteBtn.lineStyle(2, 0x00ff66, 1);
            promoteBtn.strokeRoundedRect(-180, -18, 160, 36, 6);

            const promoteTxt = this.scene.add.text(-100, 0, '⭐ この職業に転職', {
                fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff', style: 'bold'
            }).setOrigin(0.5);

            const promoteHit = this.scene.add.rectangle(-100, 0, 160, 36, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            promoteHit.on('pointerdown', () => {
                if (player.promoteJob(jobId)) {
                    this.close();
                    if (this.scene.skillManagerUI?.isOpen) {
                        this.scene.skillManagerUI.refreshList();
                    }
                }
            });
            this.bottomContainer.add([promoteBtn, promoteTxt, promoteHit]);
        }

        // 閉じるボタン
        const closeBtnX = canPromote ? 100 : 0;
        const closeBtn = this.scene.add.graphics();
        closeBtn.fillStyle(0x444455, 1);
        closeBtn.fillRoundedRect(closeBtnX - 80, -18, 160, 36, 6);
        closeBtn.lineStyle(2, 0x888899, 1);
        closeBtn.strokeRoundedRect(closeBtnX - 80, -18, 160, 36, 6);

        const closeTxt = this.scene.add.text(closeBtnX, 0, '✕ 閉じる', {
            fontSize: '13px', fontFamily: UI_FONT, color: '#ffffff'
        }).setOrigin(0.5);

        const closeHit = this.scene.add.rectangle(closeBtnX, 0, 160, 36, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        closeHit.on('pointerdown', () => this.close());
        this.bottomContainer.add([closeBtn, closeTxt, closeHit]);
    }

    destroy() {
        if (this.wheelHandler && this.scene?.input) {
            this.scene.input.off('wheel', this.wheelHandler);
        }
        if (this.keyHandler && this.scene?.input?.keyboard) {
            this.scene.input.keyboard.off('keydown', this.keyHandler);
        }
        if (this.maskShape?.active) this.maskShape.destroy();
        super.destroy();
    }
}
