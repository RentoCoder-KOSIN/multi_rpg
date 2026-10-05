import { ITEMS } from '../data/items.js';
import { JOBS } from '../data/jobs.js';
import { SKILLS } from '../data/skills.js';
import { ELEMENTS, getElementName } from '../data/elements.js';
import { getMapDisplayName } from '../data/maps.js';
import { getJobLabel } from '../utils/jobLabel.js';
import {
    AGI_CONFIG, COMBAT_CONFIG, REINCARNATION_CONFIG, TOTAL_SKILL_SLOTS,
    getRebirthDamageTakenMult, getRebirthRewardMult
} from '../gameConstants.js';

// The status view deliberately lives in the DOM, beside the Phaser canvas.
// Keeping it outside the game renderer prevents it from dimming or clipping
// when an in-game window opens.
//
// プレイヤーに関する情報を、できるだけ全て載せる（基本・状態異常/バフ・戦闘能力・基礎ステータス・
// 属性・装備・職業/スキル・持ち物・進行状況・パーティー）。
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const pct = (v, digits = 0) => `${((v || 0) * 100).toFixed(digits)}%`;
const row = (label, value) => `<div class="sr"><span>${label}</span><b>${value}</b></div>`;
const section = (title, body) => `<div class="ss"><h3>${title}</h3>${body}</div>`;

const BUFF_LABELS = { attack_buff: '攻撃UP', defense_buff: '防御UP', speed_buff: '速度UP' };
const STATUS_LABELS = { freeze: '❄️凍結', paralyze: '⚡麻痺', poison: '☠️毒' };

export default class PlayerStatsUI {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this._lastHtml = '';
        this.createUI();
    }

    createUI() {
        this.sidebar = document.getElementById('game-sidebar');
        this.panel = document.getElementById('player-status-panel');
        this.sidebar?.classList.add('is-active');
        this.update();
    }

    update() {
        const stats = this.player?.stats;
        if (!stats || !this.panel) return;
        const html = this.buildHtml(stats);
        // 毎フレーム呼ばれるので、内容が変わった時だけDOMを書き換える（スクロール位置・選択を保つ）
        if (html === this._lastHtml) return;
        this._lastHtml = html;
        this.panel.innerHTML = html;
    }

    buildHtml(stats) {
        const p = this.player;
        const scene = this.scene;
        const now = Date.now();
        const secLeft = (endTime) => Math.max(0, Math.ceil((endTime - now) / 1000));

        const playerId = p.isServerManaged ? p.id : scene.networkManager?.getPlayerId();
        const name = esc(scene.registry.get('playerNames')?.[playerId] || 'You');
        const jobDef = JOBS[stats.job];
        const rein = stats.reincarnationCount || 0;

        // ---- 基本 ----
        const jobType = jobDef ? (jobDef.type === 'magical' ? '魔法職' : '物理職') : '';
        const next = (jobDef?.nextJobs || []).map(id => JOBS[id]?.name || id).join(' / ');
        const basic = [
            row('職業', `${esc(getJobLabel(stats.job))}${jobType ? `（${jobType}）` : ''}`),
            jobDef ? row('通常攻撃', `射程${jobDef.attackRange} / ${jobDef.attackHit === 'area' ? '範囲' : '単体'}`) : '',
            next ? row('上位職', esc(next)) : '',
            row('転生回数', `${rein}回`),
            rein ? row('周回補正', `被ダメ×${getRebirthDamageTakenMult(rein).toFixed(2)} / 報酬×${getRebirthRewardMult(rein).toFixed(2)}`) : '',
            row('所持金', `${stats.gold || 0}G`),
            row('ステータスP', stats.statPoints || 0),
            row('Job EXP', stats.jobExp || 0),
        ].join('');

        // ---- 状態（HP/MP/EXP・状態異常・バフ） ----
        const effects = Object.entries(p.statusEffects || {}).filter(([, e]) => e && e.endTime > now);
        const effectText = effects.length
            ? effects.map(([t, e]) => `${STATUS_LABELS[t] || esc(t)} ${secLeft(e.endTime)}秒${t === 'poison' && e.tickDamage ? `(毎${e.tickDamage}ダメ)` : ''}`).join('<br>')
            : 'なし';
        const buffs = Object.entries(p.activeBuffs || {}).filter(([, b]) => b && b.endTime > now);
        const buffText = buffs.length
            ? buffs.map(([t, b]) => `${BUFF_LABELS[t] || esc(t)} +${b.value} ${secLeft(b.endTime)}秒`).join('<br>')
            : 'なし';
        const hpPct = Math.round(((stats.hp || 0) / (stats.maxHp || 1)) * 100);
        const state = [
            row('HP', `${Math.ceil(stats.hp)}/${stats.maxHp}（${hpPct}%）`),
            row('MP', `${Math.ceil(stats.mp)}/${stats.maxMp}`),
            row('EXP', `${Math.floor(stats.exp)}/${stats.maxExp}（${Math.floor(((stats.exp || 0) / (stats.maxExp || 1)) * 100)}%）`),
            row('行動', p.isDead ? '戦闘不能' : (p.isImmobilized?.() ? '行動不能' : '通常')),
            row('状態異常', effectText),
            row('バフ', buffText),
            row('復活の秘巻物', `${stats.reviveCharges || 0}回`),
        ].join('');

        // ---- 戦闘能力 ----
        const agi = Math.max(0, stats.agi || 0);
        const dodgeAgi = AGI_CONFIG.MAX_DODGE_CHANCE * agi / (agi + AGI_CONFIG.HALF_POINT);
        const dodgeTotal = p.getDodgeChance ? p.getDodgeChance() : dodgeAgi + (stats.dodgeChanceFlat || 0);
        const combat = [
            row('ATK', stats.atk || 0),
            row('DEF', stats.def || 0),
            row('攻撃倍率', `×${(stats.atkMultiplier || 1).toFixed(2)}`),
            row('会心率', pct(stats.critChance, 1)),
            row('会心ダメージ', `×${COMBAT_CONFIG.CRIT_MULTIPLIER}`),
            row('回避率', `${pct(dodgeTotal, 1)}（AGI ${pct(dodgeAgi, 1)} + 固定 ${pct(stats.dodgeChanceFlat, 1)}）`),
            row('移動速度', p.speed || 0),
            row('HP吸収', pct(stats.lifesteal, 1)),
            row('EXP倍率', `×${(stats.expMultiplier || 1).toFixed(2)}`),
            row('スキルCT倍率', `×${(stats.cooldownMult || 1).toFixed(2)}`),
            row('MP消費倍率', `×${(stats.mpCostMult || 1).toFixed(2)}`),
            row('回復量倍率', `×${(stats.healPowerMult || 1).toFixed(2)}`),
            row('最大召喚数', stats.maxSummons || 1),
            row('即死率', pct(stats.deathChance, 1)),
            row('凍結付与率', pct(stats.freezeChance, 1)),
            row('麻痺付与率', pct(stats.paralyzeChance, 1)),
            row('毒付与率', `${pct(stats.poisonChance, 1)}${stats.poisonDamage ? `（毎${stats.poisonDamage}ダメ）` : ''}`),
            (stats.bonusAtk || stats.bonusDef) ? row('種の加算', `ATK+${stats.bonusAtk || 0} / DEF+${stats.bonusDef || 0}`) : '',
        ].join('');

        // ---- 基礎ステータス ----
        const alloc = stats.allocatedStats || {};
        const base = ['str', 'int', 'vit', 'men', 'dex', 'agi'].map(k =>
            row(k.toUpperCase(), `${stats[k] || 0}${alloc[k] ? `（振り${alloc[k]}）` : ''}`)
        ).join('');

        // ---- 属性 ----
        const resist = stats.elementResist || {};
        const damage = stats.elementDamage || {};
        const elem = [
            row('武器属性', getElementName(stats.weaponElement)),
            row('防具属性', getElementName(stats.armorElement)),
            row('耐性', ELEMENTS.map(id => `${getElementName(id)}${resist[id] || 0}%`).join(' ')),
            row('追加ダメ', ELEMENTS.filter(id => damage[id]).map(id => `${getElementName(id)}+${damage[id]}`).join(' ') || 'なし'),
        ].join('');

        // ---- 装備 ----
        const eq = stats.equipment || {};
        const equipRow = (label, id) => {
            const item = ITEMS[id];
            if (!item) return row(label, 'なし');
            const power = p.getEquipmentPowerMultiplier ? p.getEquipmentPowerMultiplier(item) : 1;
            const note = power < 1 ? `（Lv${item.lvlReq}必要・性能${Math.round(power * 100)}%）` : '';
            return row(label, `${esc(item.name)}${note}`);
        };
        const bonus = stats.equipBonus || {};
        const equip = [
            equipRow('武器', eq.weapon),
            equipRow('防具', eq.armor),
            equipRow('宝具', eq.relic),
            row('装備補正', `ATK${bonus.atk >= 0 ? '+' : ''}${bonus.atk || 0} / DEF${bonus.def >= 0 ? '+' : ''}${bonus.def || 0} / 速度${bonus.speedBonus >= 0 ? '+' : ''}${bonus.speedBonus || 0}`),
            row('制限解除', stats.equipmentCapLevel ? `Lv${stats.equipmentCapLevel}まで` : 'なし'),
        ].join('');

        // ---- スキル ----
        const unlocked = stats.unlockedSkills || [];
        const levels = stats.skillLevels || {};
        const skillName = (id) => esc(SKILLS[id]?.name || id);
        const skillList = unlocked.length
            ? unlocked.map(id => `${skillName(id)} Lv${levels[id] || 1}${SKILLS[id]?.type === 'passive' ? '(P)' : ''}`).join('<br>')
            : 'なし';
        const slots = Array.from({ length: TOTAL_SKILL_SLOTS }, (_, i) => {
            const id = stats.activeSkills?.[i];
            return `${i + 1}: ${id ? (ITEMS[id] ? esc(ITEMS[id].name) : skillName(id)) : '—'}`;
        }).join('<br>');
        const skills = [
            row('習得スキル', `${unlocked.length}個`),
            `<div class="sl">${skillList}</div>`,
            row('スロット', ''),
            `<div class="sl">${slots}</div>`,
        ].join('');

        // ---- 持ち物 ----
        const inv = stats.inventory || [];
        const totalCount = inv.reduce((n, e) => n + (typeof e === 'string' ? 1 : (e.count || 1)), 0);
        const invList = inv.map(e => {
            const id = typeof e === 'string' ? e : e.id;
            const cnt = typeof e === 'string' ? 1 : (e.count || 1);
            return `${esc(ITEMS[id]?.name || id)} ×${cnt}`;
        }).join('<br>');
        const items = [
            row('種類/個数', `${inv.length}種 / ${totalCount}個`),
            invList ? `<div class="sl">${invList}</div>` : '',
        ].join('');

        // ---- 進行状況 ----
        const quests = Object.values(scene.questManager?.quests || {});
        const active = quests.filter(q => q.status !== 'finished' && q.status !== 'completed');
        const waiting = quests.filter(q => q.status === 'completed');
        const done = quests.filter(q => q.status === 'finished');
        const questLine = (q) => `${esc(q.title || q.name || q.id)}${q.required ? ` ${q.progress || 0}/${q.required}` : ''}`;
        const tile = (v) => Math.round((v || 0) / 32);
        const progress = [
            row('現在地', `${esc(getMapDisplayName(scene.currentMapKey))}（${tile(p.x)}, ${tile(p.y)}）`),
            row('クエスト', `進行${active.length} / 報告待ち${waiting.length} / 完了${done.length}`),
            active.length ? `<div class="sl">${active.map(questLine).join('<br>')}</div>` : '',
            waiting.length ? `<div class="sl">報告待ち: ${waiting.map(q => esc(q.title || q.name || q.id)).join(', ')}</div>` : '',
            row('チュートリアル報酬', stats.tutorialCompletionRewardClaimed ? '受取済' : '未受取'),
        ].join('');

        // ---- パーティー ----
        const members = scene.networkManager?.partyData?.members || [];
        const party = members.length > 1
            ? members.map(m => `${esc(m.name)} Lv${m.level} ${esc(getJobLabel(m.job))} HP${m.hp}/${m.maxHp}`).join('<br>')
            : '参加していない';

        return `
            <h2 class="status-title">${name} Lv.${stats.level}</h2>
            ${section('基本', basic)}
            ${section('状態', state)}
            ${section('戦闘能力', combat)}
            ${section('基礎ステータス', base)}
            ${section('属性', elem)}
            ${section('装備', equip)}
            ${section('スキル', skills)}
            ${section('持ち物', items)}
            ${section('進行状況', progress)}
            ${section('パーティー', `<div class="sl">${party}</div>`)}`;
    }

    destroy() {
        if (this.panel) this.panel.textContent = '';
        this.sidebar?.classList.remove('is-active');
    }
}
