import { UI_FONT } from '../fontConfig.js';
import { JOBS } from "../data/jobs.js";
import { ITEMS } from "../data/items.js";
import { SKILLS } from "../data/skills.js";
import { UNIQUE_SKILLS } from "../data/skills/uniqueSkills.js";
import { getEnemyStats } from "../data/enemyStats.js";
import { getLevelDiffMultiplier, getExpLevelMultiplier } from "../utils/levelScaling.js";
import { TOTAL_SKILL_SLOTS, GROWTH_CONFIG, COMBAT_CONFIG, REINCARNATION_CONFIG, AGI_CONFIG, RESET_CONFIG, SPEED_CONFIG, LEVEL_CONFIG, getRebirthDamageTakenMult, getRebirthRewardMult } from "../gameConstants.js";
import {
    ELEMENTS, getElementMultiplier, getBlendedElementMultiplier, getElementColor,
    getWeaponElementBonus, resolveElement, resistKey, damageKey, collectElementStats,
} from "../data/elements.js";
import { showDamageNumber } from "../utils/damagePopup.js";
import { isAdminFlag } from "../ui/AdminUI.js";
import { getSaved, setSaved, flushSave } from "../utils/saveStore.js";
import { onEnemyKill, onGoldEarned, onJobUnlocked, checkAchievements } from "../systems/achievementTracker.js";
import { findMap } from "../data/maps.js";
import { OPTION_POOL } from "../data/randomOptions.js";

// 状態異常の基本持続時間（ms）。武器の属性付与などから発生する。
const STATUS_DURATIONS = {
    freeze: 3000,
    paralyze: 2500,
};
const POISON_TICK_INTERVAL_MS = 1000;

const WEAPON_CLASS_LABELS = {
    dagger: '短刀',
    oneHandSword: '片手剣', twoHandSword: '両手剣', spear: '槍',
    dualSword: '双剣', axe: '斧', katana: '刀',
    staff: '杖', wand: 'ワンド', tome: '魔導書', orb: '魔導球',
    bow: '弓', crossbow: 'クロスボウ',
    mace: 'メイス', hammer: 'ハンマー', shield_sword: '剣盾',
    scythe: '大鎌',
};

function getJobWeaponLabel(jobId) {
    return JOBS[jobId]?.name || 'この職業';
}

// レベルアップに必要な経験値を計算する。
// 以前は maxExp *= 1.5 という「複利」計算だったため、
// レベル100までに 1.5^99 倍(=天文学的な数値)の経験値が必要になり、
// 実質どれだけ敵を倒しても経験値が全く貯まらないように見えるバグになっていた。
// 多項式カーブ(level^2.0)に変更し、終盤でも現実的な必要量に収める。
// （少しハードにする調整として、以前の level^1.8 より指数を上げてある）
function calcMaxExp(level) {
    return Math.max(100, Math.floor(100 * Math.pow(level, 2.0)));
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, isLocal = false, socket = null) {
        super(scene, x, y, 'dude');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.isLocal = isLocal;
        this.socket = socket;
        this.speed = 150;
        // 向いている方向 (1: 右, -1: 左)。スキルの発射方向などに使用。
        // 注意: このゲームは walk-left / walk-right の専用アニメーションを使うため
        // flipX は常に false のまま。方向判定には必ず facingDirection を使うこと。
        this.facingDirection = 1;
        // 向いている方向の単位ベクトル。facingDirection が左右だけなのに対し、こちらは縦・斜めも表す。
        // ブリンク/ダッシュ/バックステップや、一直線・扇のスキルの向きに使う（最後に歩いた方向）。
        this.facingVec = { x: 1, y: 0 };
        this.setCollideWorldBounds(true);
        this.setOrigin(0.5, 1);

        this.body.setSize(this.width * 0.5, this.height * 0.6);
        this.body.setOffset(this.width * 0.25, this.height * 0.4);

        // ここで body を初期位置にリセット
        this.body.reset(x, y);

        if (!this.isLocal) {
            this.targetX = x;
            this.targetY = y;
            this.lerpSpeed = 0.2;
        }

        this.lastPositionSent = { x, y };
        this.positionUpdateInterval = 100;
        this.lastUpdateTime = 0;

        // スキルクールダウン管理用
        this.skillCooldowns = {};

        // バフ管理用
        this.activeBuffs = {}; // { buffType: { value, endTime } }

        // 状態異常管理用（凍結・麻痺・毒）。セーブデータには含めない一時的な状態。
        this.statusEffects = {}; // { freeze: {endTime}, paralyze: {endTime}, poison: {endTime, tickDamage} }
        this.lastPoisonTick = 0;

        // ステータス初期化
        this.initializeStats();
    }

    initializeStats() {
        // localStorage または registry から読み込み
        const saved = getSaved('playerStats') || this.scene.registry.get('playerStats') || {};
        this.stats = {
            level: saved.level || 1,
            hp: saved.hp !== undefined ? saved.hp : 100,
            maxHp: saved.maxHp || 100,
            mp: saved.mp !== undefined ? saved.mp : 50,
            maxMp: saved.maxMp || 50,
            exp: saved.exp || 0,
            maxExp: saved.maxExp || calcMaxExp(saved.level || 1),
            gold: saved.gold || 0,
            atk: saved.atk || 10,
            def: saved.def || 5,
            critChance: saved.critChance || 0,
            lifesteal: saved.lifesteal || 0,
            speedBonus: Math.min(saved.speedBonus || 0, SPEED_CONFIG.MAX_SPEED_BONUS),
            expMultiplier: saved.expMultiplier || 1.0,
            statPoints: saved.statPoints || 0,
            // アイテム（種）による永続ステータス加算
            bonusAtk: saved.bonusAtk || 0,
            bonusDef: saved.bonusDef || 0,
            // 復活の秘巻物などのチャージ数
            reviveCharges: saved.reviveCharges || 0,
            // 基本ステータス (Base Stats)
            str: saved.str || 5,  // Strength - 攻撃力に影響
            int: saved.int || 5,  // Intelligence - 魔法攻撃力に影響
            vit: saved.vit || 5,  // Vitality - HP最大値に影響
            men: saved.men || 5,  // Mental - MP最大値に影響
            dex: saved.dex || 5,  // Dexterity - クリティカル率・速度に影響
            agi: saved.agi || AGI_CONFIG.BASE_AGI,  // Agility - 敵の攻撃を回避する確率に影響
            job: saved.job || 'none',
            // 輪廻転生した回数。転生ごとの基礎ステータス強化に使う。
            reincarnationCount: saved.reincarnationCount || 0,
            // 輪廻転生直後の「次の職業選択ではスキルを持ち越す」フラグ。
            // ここで復元しないと、転生後にマップ移動・再読み込みでPlayerが作り直された時点でフラグが消え、
            // 職業を選んだ瞬間に習得済みスキルが全て消えてしまう（以前の不具合）。
            _skipSkillResetOnNextJob: !!saved._skipSkillResetOnNextJob,
            // チュートリアルの進行記録。ここで復元しないと、マップ移動・再ログインのたびに消えてしまう
            // （以前は tutorialStarterRewardClaimed が復元されず、初期報酬が再配布される状態だった）。
            tutorialStarterRewardClaimed: !!saved.tutorialStarterRewardClaimed,
            tutorialCompletionRewardClaimed: !!saved.tutorialCompletionRewardClaimed,
            // 制限解除は段階制。旧「全解除」セーブはLv100解除済みとして移行する。
            equipmentCapLevel: saved.equipmentCapUnlocked ? 100 : (saved.equipmentCapLevel || 0),
            tutorialFlags: (saved.tutorialFlags && typeof saved.tutorialFlags === 'object') ? { ...saved.tutorialFlags } : {},
            inventory: saved.inventory || [],
            // 開けた宝箱の記録（"マップ名:オブジェクトID" の配列）。1人1回だけ開けられるようにする
            openedChests: Array.isArray(saved.openedChests) ? [...saved.openedChests] : [],
            // 鍛冶屋で武器/防具(アイテムID)に付与した属性。 { itemId: 'fire' | 'water' | ... }
            // 存在しない属性の付与（属性定義の変更前のデータなど）は破棄する
            itemElements: Object.fromEntries(
                Object.entries(saved.itemElements || {}).filter(([, el]) => ELEMENTS.includes(el))
            ),
            // relic (宝具) を新規追加。 ...(saved.equipment || {}) を後に展開することで、
            // 旧セーブデータ（relicキーが無い）でも weapon/armor はそのまま引き継ぎつつ
            // relic だけ null で補える。
            equipment: { weapon: null, armor: null, relic: null, ...(saved.equipment || {}) },
            // 強化レベル: アイテムIDごとに管理（装備変更で他装備がMAXにならないよう個別保持）
            itemEnhanceLevels: (saved.itemEnhanceLevels && typeof saved.itemEnhanceLevels === 'object')
                ? { ...saved.itemEnhanceLevels }
                : {},
            enhanceLevels: (saved.enhanceLevels && typeof saved.enhanceLevels === 'object')
                ? { weapon: 0, armor: 0, relic: 0, ...saved.enhanceLevels }
                : { weapon: 0, armor: 0, relic: 0 },
            // 実績・称号データ
            achievements: saved.achievements || {},
            unlockedTitles: Array.isArray(saved.unlockedTitles) ? [...saved.unlockedTitles] : [],
            activeTitle: saved.activeTitle || null,
            activeTitleColor: saved.activeTitleColor || '#ffff00',
            achievementCounters: saved.achievementCounters || {},
            jobExp: saved.jobExp || 0,
            // 輪廻転生で集めたスキルの永続保存リスト。職業リセットしても絶対に失われない。
            reincarnatedSkills: Array.isArray(saved.reincarnatedSkills) ? [...saved.reincarnatedSkills] : [],
            reincarnatedSkillLevels: (saved.reincarnatedSkillLevels && typeof saved.reincarnatedSkillLevels === 'object') ? { ...saved.reincarnatedSkillLevels } : {},
            unlockedSkills: saved.unlockedSkills || [],
            skillLevels: saved.skillLevels || {}, // { skillId: level }
            customItems: (saved.customItems && typeof saved.customItems === 'object') ? { ...saved.customItems } : {},
            // 訪れたことのあるマップ一覧（フレンドワープの移動可能制限などに使用）
            visitedMaps: Array.isArray(saved.visitedMaps) ? [...saved.visitedMaps] : ['city', 'tutorial'],
            // スロット数を3→8に拡張。古いセーブデータ(3枠)も足りない分をnullで埋めて引き継ぐ
            activeSkills: this.padActiveSkills(saved.activeSkills)
        };

        // 作成されたオリジナル装備をITEMS辞書に復元
        if (this.stats.customItems) {
            Object.values(this.stats.customItems).forEach(item => {
                if (item?.id) ITEMS[item.id] = item;
            });
        }

        // 輪廻転生したプレイヤー（または既に転生スキルがある場合）、集めたスキルを確実に復元・同期
        if (this.stats.reincarnationCount > 0 || this.stats.reincarnatedSkills.length > 0) {
            const mergedSkills = Array.from(new Set([...this.stats.unlockedSkills, ...this.stats.reincarnatedSkills]));
            this.stats.unlockedSkills = mergedSkills;
            this.stats.reincarnatedSkills = [...mergedSkills];
            this.stats.skillLevels = { ...this.stats.reincarnatedSkillLevels, ...this.stats.skillLevels };
            this.stats.reincarnatedSkillLevels = { ...this.stats.skillLevels };
        }

        // リモートプレイヤーはローカルのセーブデータ称号を引き継がないように初期化
        if (!this.isLocal) {
            this.stats.activeTitle = null;
            this.stats.activeTitleColor = '#ffff00';
            this.stats.unlockedTitles = [];
        }

        // ステータスポイントで割り振った分の記録（ステータスリセットの書で返還するために使う）。
        // この項目が無い古いセーブデータは、レベル・職業タイプ・転生回数から自然成長分を差し引いた推定値で初期化する。
        this.stats.allocatedStats = this.sanitizeAllocatedStats(saved.allocatedStats) || this.estimateAllocatedStats();

        // --- 輪廻転生インフレ防止・適正化マイグレーション（アヴァベル/イザナギ式）---
        // 以前の仕様で転生毎にポイントが無限に重複返還されていたセーブデータを検知し、適正なポイントに整流化する
        const currentLv = Math.max(1, this.stats.level || 1);
        const reinCount = Math.min(this.stats.reincarnationCount || 0, REINCARNATION_CONFIG.MAX_SCALED_COUNT);
        const expectedTotalPoints = (currentLv - 1) * 3 + reinCount * REINCARNATION_CONFIG.BONUS_STAT_POINTS;
        const currentAllocatedTotal = RESET_CONFIG.STAT_KEYS.reduce((sum, k) => sum + Math.max(0, this.stats.allocatedStats?.[k] || 0), 0);
        const currentTotalPoints = (this.stats.statPoints || 0) + currentAllocatedTotal;

        // 許容誤差（種などのボーナスポイント等で若干多い場合を考慮し +60 まで許容）
        if (currentTotalPoints > expectedTotalPoints + 60) {
            console.warn(`[Player] 転生インフレセーブデータを検知 (所持:${currentTotalPoints}pt, 適正:${expectedTotalPoints}pt)。アヴァベル/イザナギ式バランスに適正化します。`);
            this.stats.statPoints = expectedTotalPoints;
            this.stats.allocatedStats = this.sanitizeAllocatedStats({});
            // 基礎ステータスも再初期化
            const reinBonus = reinCount * REINCARNATION_CONFIG.BASE_STAT_BONUS;
            RESET_CONFIG.STAT_KEYS.forEach(k => {
                const base = (k === 'agi') ? AGI_CONFIG.BASE_AGI : RESET_CONFIG.BASE_VALUE;
                const grow = currentLv - 1;
                const jobType = JOBS[this.stats.job]?.type || null;
                let natural = base + reinBonus;
                if (k === 'str') natural += grow * (jobType === 'physical' ? 2 : 1);
                else if (k === 'int') natural += grow * (jobType === 'magical' ? 2 : 1);
                else if (k !== 'agi') natural += grow;
                this.stats[k] = natural;
            });
        }

        this.applyEquipmentStats(); // 装備中のステータスを反映

        // インベントリのマイグレーション (文字列配列 -> オブジェクト配列)
        if (this.stats.inventory.length > 0 && typeof this.stats.inventory[0] === 'string') {
            this.stats.inventory = this.stats.inventory.map(id => ({ id, count: 1 }));
        }

        this.saveStats();
    }

    // 保存済みの割り振り記録を { str,int,vit,men,dex,agi } の非負整数に整える。無効なら null
    sanitizeAllocatedStats(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const out = {};
        RESET_CONFIG.STAT_KEYS.forEach(k => { out[k] = Math.max(0, Math.floor(Number(raw[k]) || 0)); });
        return out;
    }

    // 割り振り記録が無い古いセーブデータ向けの推定。
    // 「初期値 + 転生ボーナス + レベルアップの自然成長」を現在値から引いた残りを、ポイントで振った分とみなす。
    // （転職でタイプが変わっていた場合など多少ずれる可能性はあるが、0未満には絶対にならない）
    estimateAllocatedStats() {
        const lv = Math.max(1, this.stats.level || 1);
        const grow = lv - 1;
        const jobType = JOBS[this.stats.job]?.type || null;
        const rein = (this.stats.reincarnationCount || 0) * REINCARNATION_CONFIG.BASE_STAT_BONUS;
        const base = RESET_CONFIG.BASE_VALUE + rein;
        const natural = {
            str: base + grow * (jobType === 'physical' ? 2 : 1),
            int: base + grow * (jobType === 'magical' ? 2 : 1),
            vit: base + grow,
            men: base + grow,
            dex: base + grow,
            agi: base, // AGIはレベルアップでは自動成長しない
        };
        const out = {};
        RESET_CONFIG.STAT_KEYS.forEach(k => { out[k] = Math.max(0, (this.stats[k] || 0) - natural[k]); });
        return out;
    }

    // 保存済みのactiveSkills配列をTOTAL_SKILL_SLOTS件になるまでnullで埋める
    // (3枠だった頃のセーブデータを8枠に安全に移行するため)
    padActiveSkills(saved) {
        const arr = Array.isArray(saved) ? [...saved] : [];
        while (arr.length < TOTAL_SKILL_SLOTS) arr.push(null);
        return arr.slice(0, TOTAL_SKILL_SLOTS);
    }

    // updateSkillsByJob は廃止
    // this.skills = [...new Set(unlockedSkills)]; 処理も不要（unlockedSkillsで管理）
    updateSkillsByJob() {
        // 後方互換性のため空メソッドとして残すか、削除する
    }

    setJob(jobId) {
        if (!this.isLocal || !JOBS[jobId]) return;

        const newJob = JOBS[jobId];
        this.stats.job = jobId;

        // 前の職業のスキル構成が持ち越されないようにリセット。
        // ただし以下は絶対に保護する:
        //  1) 輪廻転生で集めたスキル（転生経験者 reincarnationCount > 0）
        //  2) クエスト報酬等で獲得したユニークスキル（UNIQUE_SKILLS）
        //  3) _skipSkillResetOnNextJob フラグが立っている場合
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        const isReincarnated = (this.stats.reincarnationCount || 0) > 0 || (this.stats.reincarnatedSkills || []).length > 0;
        const keepAllSkills = !!this.stats._skipSkillResetOnNextJob || isReincarnated;

        const uniqueKeys = Object.keys(UNIQUE_SKILLS || {});
        const reinSkills = this.stats.reincarnatedSkills || [];

        if (keepAllSkills) {
            // 転生者またはフラグ付き: 集めたスキルをすべて保持し、転生スキルプールと同期
            const merged = Array.from(new Set([...(this.stats.unlockedSkills || []), ...reinSkills]));
            this.stats.unlockedSkills = merged;
            this.stats.reincarnatedSkills = [...merged];
            this.stats.skillLevels = { ...(this.stats.reincarnatedSkillLevels || {}), ...(this.stats.skillLevels || {}) };
            this.stats.reincarnatedSkillLevels = { ...this.stats.skillLevels };
        } else {
            // 未転生者: クエストで得たユニークスキルのみ保護し、一般スキルはリセット
            const preservedSkills = (this.stats.unlockedSkills || []).filter(id => uniqueKeys.includes(id));
            const preservedLevels = {};
            preservedSkills.forEach(id => {
                if (this.stats.skillLevels?.[id]) preservedLevels[id] = this.stats.skillLevels[id];
            });
            this.stats.unlockedSkills = preservedSkills;
            this.stats.skillLevels = preservedLevels;
            this.stats.jobExp = 0;
        }
        this.stats._skipSkillResetOnNextJob = false;
        this.skillCooldowns = {};

        this.applyEquipmentStats(); // ボーナスを含めて再計算
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;

        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`ジョブを${newJob.name}に変更しました！`, 'success');
        }
    }

    // 輪廻転生が可能かどうか（Lv上限に到達しているか）
    canReincarnate() {
        return this.stats.level >= REINCARNATION_CONFIG.REQUIRED_LEVEL;
    }

    // 輪廻転生: Lv100到達後に実行できる。レベル1からやり直しつつ職業を選び直せるが、
    // 通常の転職（setJob）と違い、習得済みスキル（unlockedSkills/skillLevels）は持ち越せる。
    // その代わり、基礎ステータス（STR/INT/VIT/MEN/DEX）が永続的に大幅強化される。
    reincarnate() {
        if (!this.isLocal) return false;

        if (!this.canReincarnate()) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`輪廻転生にはLv${REINCARNATION_CONFIG.REQUIRED_LEVEL}が必要です`, 'error');
            }
            return false;
        }

        this.stats.reincarnationCount = (this.stats.reincarnationCount || 0) + 1;
        const cappedCount = Math.min(this.stats.reincarnationCount, REINCARNATION_CONFIG.MAX_SCALED_COUNT);

        // レベル・経験値をリセット（Lv1から新たな冒険へ）
        this.stats.level = 1;
        this.stats.exp = 0;
        this.stats.maxExp = calcMaxExp(1);

        // 職業を選び直せるようにする（習得済みスキルはすべて持ち越す）
        this.stats.job = 'none';
        this.stats._skipSkillResetOnNextJob = true;
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        this.skillCooldowns = {};
        
        // unlockedSkills / skillLevels はそのまま維持し、reincarnatedSkills にも永久記録する
        const currentSkills = this.stats.unlockedSkills || [];
        this.stats.reincarnatedSkills = Array.from(new Set([
            ...(this.stats.reincarnatedSkills || []),
            ...currentSkills
        ]));
        this.stats.reincarnatedSkillLevels = {
            ...(this.stats.reincarnatedSkillLevels || {}),
            ...(this.stats.skillLevels || {})
        };

        // 装備を全て外す（アイテムはインベントリに残る）
        this.stats.equipment = { weapon: null, armor: null, relic: null };

        // --- アヴァベル/イザナギ式ステータス再構築 ---
        // 1. 基礎ステータスは「初期値(5) + 転生ボーナス(各+3)」
        const reinBonus = cappedCount * REINCARNATION_CONFIG.BASE_STAT_BONUS;
        RESET_CONFIG.STAT_KEYS.forEach(k => {
            const base = (k === 'agi') ? AGI_CONFIG.BASE_AGI : RESET_CONFIG.BASE_VALUE;
            this.stats[k] = base + reinBonus;
        });

        // 2. 割り振り記録をリセット
        this.stats.allocatedStats = this.sanitizeAllocatedStats({});

        // 3. 所持ステータスポイントは「転生回数 × 転生ボーナスポイント (アヴァベルの転生P)」
        // （※前周のレベルアップ分はLv1に戻るためリセットされ、再度Lvを上げて獲得する健全な育成サイクル）
        this.stats.statPoints = cappedCount * REINCARNATION_CONFIG.BONUS_STAT_POINTS;

        this.applyEquipmentStats();
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;
        onJobUnlocked(this);
        this.saveStats();

        const newStatCap = this.getMaxAllocatableStat('str');
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(
                `【輪廻転生成功】(${this.stats.reincarnationCount}周目) 転生P+${REINCARNATION_CONFIG.BONUS_STAT_POINTS}pt獲得！全基礎ステ+${REINCARNATION_CONFIG.BASE_STAT_BONUS}！ステ上限が${newStatCap}ptへ開放！`,
                'warning'
            );
        }
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
        if (this.scene.playerNameUI) this.scene.playerNameUI.updateLevel(this.stats.level);

        return true;
    }

    promoteJob(newJobId) {
        if (!this.isLocal || !JOBS[newJobId]) return false;
        const currentJobData = JOBS[this.stats.job];
        const newJobData = JOBS[newJobId];
        if (!currentJobData) return false;

        // 条件チェック
        if (this.stats.level < (newJobData.reqLevel || 50)) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`レベルが ${newJobData.reqLevel || 50} 足りません！`, 'error');
            return false;
        }

        // 上位職は基本職ごとに複数（nextJobs）ある。現在の職業から進める先だけ許可する
        const allowedNext = currentJobData?.nextJobs || (currentJobData?.nextJob ? [currentJobData.nextJob] : []);
        if (!allowedNext.includes(newJobId)) {
            return false;
        }

        this.stats.job = newJobId;

        // 前の職業のスキル構成が持ち越されないようにリセット
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        this.skillCooldowns = {};

        // 転職ボーナス
        this.stats.statPoints += 20;

        this.applyEquipmentStats();
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;
        onJobUnlocked(this);
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`祝！上位職「${newJobData.name}」に転職しました！`, 'warning');
        }
        return true;
    }

    saveStats() {
        if (!this.isLocal) return;
        this.scene.registry.set('playerStats', this.stats);
        setSaved('playerStats', this.stats); // サーバーのアカウントへ保存（まとめて送信される）

        if (this.scene.networkManager) {
            this.scene.networkManager.sendPlayerStats(this.stats.hp, this.stats.maxHp, this.stats.level, this.stats.mp, this.stats.maxMp, this.stats.job);
        }
    }

    /**
     * マップの訪問を記録する
     * @param {string} mapKey
     */
    markMapVisited(mapKey) {
        if (!mapKey || !this.isLocal) return;
        if (!Array.isArray(this.stats.visitedMaps)) {
            this.stats.visitedMaps = ['city', 'tutorial'];
        }
        const def = findMap(mapKey);
        const canonicalKey = def?.key || mapKey;
        if (!this.stats.visitedMaps.includes(canonicalKey)) {
            this.stats.visitedMaps.push(canonicalKey);
            this.saveStats();
        }
    }

    /**
     * 指定マップに行ったことがあるかどうか
     * @param {string} mapKey
     * @returns {boolean}
     */
    hasVisitedMap(mapKey) {
        if (!mapKey) return false;
        if (!Array.isArray(this.stats.visitedMaps)) {
            this.stats.visitedMaps = ['city', 'tutorial'];
        }
        const def = findMap(mapKey);
        const targetKey = def?.key || mapKey;
        const targetSceneKey = def?.sceneKey || mapKey;
        return this.stats.visitedMaps.some(k => {
            const kDef = findMap(k);
            const kKey = kDef?.key || k;
            const kScene = kDef?.sceneKey || k;
            return kKey === targetKey || kScene === targetSceneKey || k === mapKey;
        });
    }

    gainExp(amount, enemyLevel = null) {
        if (!this.isLocal) return;

        // 経験値倍率を適用（経験値増加の武器などの効果はLv{cap}以下にのみ有効。
        // それ以上のレベルでは倍率をかけない）
        const expMult = (this.stats.level <= GROWTH_CONFIG.EXP_MULTIPLIER_LEVEL_CAP) ? (this.stats.expMultiplier || 1.0) : 1.0;

        // レベル差補正: 敵レベルが分かる場合、圧倒的な格下（レベル差15以上）を
        // 狩ったときは経験値を減らす。敵の方が格上の場合は補正しない。
        const levelPenalty = (enemyLevel != null) ? getExpLevelMultiplier(this.stats.level, enemyLevel) : 1.0;

        // 周回ボーナス: 転生を重ねるほど経験値が増える（その分、敵から受けるダメージも増える。gameConstants.js 参照）
        const rebirthMult = getRebirthRewardMult(this.stats.reincarnationCount || 0);
        const sourceMult = enemyLevel != null ? GROWTH_CONFIG.ENEMY_EXP_MULTIPLIER : 1;
        const finalAmount = Math.ceil(amount * sourceMult * expMult * levelPenalty * rebirthMult);

        if (this.stats.level >= LEVEL_CONFIG.MAX_LEVEL) {
            // レベルキャップ到達後も、敵を倒せば Job EXP は貯まる。
            // （以前は何も増えず、スキルレベル上げ・スキル解放の育成が止まって「やることが無い」状態だった）
            const jobGain = Math.ceil(finalAmount * GROWTH_CONFIG.JOB_EXP_RATE);
            this.stats.jobExp = (this.stats.jobExp || 0) + jobGain;
            this.saveStats();
            if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
            if (this.scene.notificationUI) this.scene.notificationUI.show(`JOB EXP +${jobGain}`, 'info');
            return;
        }

        if (this.stats.level < LEVEL_CONFIG.MAX_LEVEL) { // レベルキャップ
            this.stats.exp += finalAmount;

            // ジョブ経験値も獲得（簡単に貯まりすぎないよう、通常経験値の一部だけ加算する）
            this.stats.jobExp = (this.stats.jobExp || 0) + Math.ceil(finalAmount * GROWTH_CONFIG.JOB_EXP_RATE);

            let leveledUp = false;
            // 複数レベルアップに対応 & 経験値を消費するように修正
            while (this.stats.exp >= this.stats.maxExp && this.stats.level < LEVEL_CONFIG.MAX_LEVEL) {
                this.stats.exp -= this.stats.maxExp;
                this.levelUp();
                leveledUp = true;
            }

            if (leveledUp) {
                checkAchievements(this);
            }

            // レベルアップしなかった場合でもUIを更新
            if (!leveledUp) {
                this.saveStats();
                if (this.scene.playerStatsUI) {
                    this.scene.playerStatsUI.update();
                }
            }
        }

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`EXP +${finalAmount}`, 'info');
        }
    }

    gainGold(amount) {
        if (!this.isLocal) return;
        const goldMult = (this.stats.goldMultiplier || 1.0) * getRebirthRewardMult(this.stats.reincarnationCount || 0);
        amount = Math.ceil(amount * goldMult); // 周回ボーナス・装備ボーナス
        this.stats.gold += amount;
        onGoldEarned(this, amount);
        this.saveStats();
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`GOLD +${amount}`, 'warning');
        }
    }

    addItem(itemId, amount = 1, monsterLevel = null, rolledOptions = null) {
        if (!this.isLocal || !ITEMS[itemId]) return;
        const itemDef = ITEMS[itemId];

        // 武器と防具・装飾品以外はスタック可能
        const isStackable = itemDef.type !== 'weapon' && itemDef.type !== 'armor' && itemDef.type !== 'accessory';

        // 経験値倍率つきの装備は、入手した時点で一目でわかるようにタグを付ける
        const itemExpMult = itemDef.stats?.expMultiplier || itemDef.expMultiplier;
        const expTag = (itemExpMult && itemExpMult !== 1) ? ` ✨経験値x${itemExpMult}` : '';

        if (isStackable) {
            const existingItem = this.stats.inventory.find(i => i.id === itemId);
            if (existingItem) {
                existingItem.count = (existingItem.count || 1) + amount;
                // 最大99個まで? (必要なら制限を追加)
            } else {
                this.stats.inventory.push({ id: itemId, count: amount });
            }
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`アイテム入手: ${itemDef.name} x${amount}${expTag}`, 'success');
            }
        } else {
            // スタック不可アイテム（装備品等）
            for (let i = 0; i < amount; i++) {
                const uid = 'item_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
                const invEntry = { id: itemId, count: 1, uid };
                if (rolledOptions) {
                    invEntry.options = rolledOptions;
                }
                this.stats.inventory.push(invEntry);

                if (this.scene.notificationUI) {
                    if (rolledOptions && rolledOptions.options?.length > 0) {
                        const optTag = ` [${rolledOptions.rarityName}]`;
                        this.scene.notificationUI.show(`装備入手: ${rolledOptions.prefix || ''}${itemDef.name}${optTag}`, 'warning', 4500);
                    } else {
                        this.scene.notificationUI.show(`アイテム入手: ${itemDef.name}${expTag}`, 'success');
                    }
                }
            }
        }
        this.saveStats();
    }

    removeItem(itemId, amount = 1) {
        if (!this.stats.inventory) return;
        let remaining = amount;
        for (let i = this.stats.inventory.length - 1; i >= 0 && remaining > 0; i--) {
            const entry = this.stats.inventory[i];
            const currentId = typeof entry === 'string' ? entry : entry.id;
            if (currentId === itemId) {
                if (typeof entry === 'object' && entry.count && entry.count > remaining) {
                    entry.count -= remaining;
                    remaining = 0;
                } else {
                    const currentCount = typeof entry === 'object' ? (entry.count || 1) : 1;
                    remaining -= currentCount;
                    this.stats.inventory.splice(i, 1);
                }
            }
        }
        this.saveStats();
    }

    unlockSkill(skillId) {
        if (!this.isLocal) return false;
        if (this.stats.unlockedSkills.includes(skillId)) return false; // 既に解放済み

        const skillDef = SKILLS[skillId];
        if (!skillDef) return false;

        const cost = skillDef.unlockCost || 10;
        if (this.stats.jobExp < cost) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`ジョブ経験値が足りません (必要: ${cost})`, 'error');
            }
            return false; // コスト不足
        }

        this.stats.jobExp -= cost;
        this.stats.unlockedSkills.push(skillId);

        // 初期レベルを1に設定
        this.stats.skillLevels[skillId] = 1;

        // 輪廻転生経験者の場合、新しく習得したスキルも転生スキルプールに永久保存
        if ((this.stats.reincarnationCount || 0) > 0) {
            this.stats.reincarnatedSkills = Array.from(new Set([...(this.stats.reincarnatedSkills || []), skillId]));
            this.stats.reincarnatedSkillLevels = { ...(this.stats.reincarnatedSkillLevels || {}), [skillId]: 1 };
        }

        // パッシブスキル（攻撃力+10%など）は習得した瞬間から効いてほしいので、
        // ここでステータスを再計算する。以前は次に装備を変えたりレベルアップ
        // するまで反映されず、「習得してもパッシブが効いていない」ように見えていた。
        this.applyEquipmentStats();
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`スキル「${skillDef.name}」を習得した！`, 'success');
        }

        return true;
    }

    /**
     * クエスト報酬でスキルを強制習得する（jobExp コストなし）。
     * 通常の unlockSkill() と違い、ジョブ経験値を消費しない。
     * ユニークスキルや特殊クエスト報酬に使う。
     */
    forceUnlockSkill(skillId) {
        if (!this.isLocal) return false;
        if (this.stats.unlockedSkills.includes(skillId)) {
            if (this.scene.notificationUI) {
                const skillDef = SKILLS[skillId];
                this.scene.notificationUI.show(`スキル「${skillDef?.name || skillId}」は既に習得済みです`, 'info');
            }
            return false;
        }

        const skillDef = SKILLS[skillId];
        if (!skillDef) return false;

        this.stats.unlockedSkills.push(skillId);
        this.stats.skillLevels[skillId] = 1;

        // クエスト等のユニークスキルや転生経験者のスキルは転生スキルプールに永久保存
        if ((this.stats.reincarnationCount || 0) > 0 || UNIQUE_SKILLS[skillId]) {
            this.stats.reincarnatedSkills = Array.from(new Set([...(this.stats.reincarnatedSkills || []), skillId]));
            this.stats.reincarnatedSkillLevels = { ...(this.stats.reincarnatedSkillLevels || {}), [skillId]: 1 };
        }

        this.applyEquipmentStats();
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`✨ 特殊スキル「${skillDef.name}」を習得した！`, 'success');
        }
        return true;
    }

    levelUpSkill(skillId) {
        if (!this.isLocal) return false;
        if (!this.stats.unlockedSkills.includes(skillId)) return false;

        const currentLevel = this.stats.skillLevels[skillId] || 1;
        if (currentLevel >= 10) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('スキルレベルが最大です(Lv.10)', 'error');
            return false;
        }

        const skillDef = SKILLS[skillId];
        // スキルのtier（格）を unlockCost で判定し、レベルアップコストに差をつける
        // tier1（入門スキル: unlockCost <= 50）  : 100 * nextLv^2
        // tier2（中級スキル: unlockCost <= 100） : 200 * nextLv^2
        // tier3（上級スキル: unlockCost <= 300） : 400 * nextLv^2
        // tier4（高難度スキル: unlockCost <= 500）: 700 * nextLv^2
        // tier5（ユニーク/特殊スキル: それ以上） : 1200 * nextLv^2
        const unlockCost = skillDef?.unlockCost || 0;
        let baseCost;
        if (unlockCost <= 50) baseCost = 100;
        else if (unlockCost <= 100) baseCost = 200;
        else if (unlockCost <= 300) baseCost = 400;
        else if (unlockCost <= 500) baseCost = 700;
        else baseCost = 1200;
        // ユニークスキル（unlockCost=0だが特別扱い）は高コスト
        if (UNIQUE_SKILLS && UNIQUE_SKILLS[skillId]) baseCost = 1200;

        const nextLevel = currentLevel + 1;
        const cost = baseCost * nextLevel * nextLevel;

        if (this.stats.jobExp < cost) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`Job EXPが足りません (必要: ${cost})`, 'error');
            return false;
        }

        this.stats.jobExp -= cost;
        this.stats.skillLevels[skillId] = currentLevel + 1;

        if ((this.stats.reincarnationCount || 0) > 0 || UNIQUE_SKILLS[skillId]) {
            this.stats.reincarnatedSkillLevels = { ...(this.stats.reincarnatedSkillLevels || {}), [skillId]: currentLevel + 1 };
        }
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${skillDef.name} が Lv.${currentLevel + 1} に上がった！`, 'success');
        }
        return true;
    }

    setActiveSkill(slotIndex, skillId) {
        if (!this.isLocal) return;
        if (slotIndex < 0 || slotIndex >= TOTAL_SKILL_SLOTS) return;

        // 回復アイテムは `item:<itemId>` として同じクイックスロットに登録できる。
        const quickItemId = typeof skillId === 'string' && skillId.startsWith('item:') ? skillId.slice(5) : null;
        if (quickItemId) {
            const item = ITEMS[quickItemId];
            const owned = this.stats.inventory.some(e => (typeof e === 'string' ? e : e.id) === quickItemId);
            if (!item || item.type !== 'consumable' || !owned) return;
        } else if (skillId && !this.stats.unlockedSkills.includes(skillId)) return;

        this.stats.activeSkills[slotIndex] = skillId;
        this.saveStats();
    }

    hasSkill(skillId) {
        return this.stats.unlockedSkills.includes(skillId);
    }

    useSkill(slotIndex, target = null) {
        if (!this.isLocal) return;
        if (slotIndex < 0 || slotIndex >= TOTAL_SKILL_SLOTS) return;

        const skillId = this.stats.activeSkills[slotIndex];
        if (!skillId) return; // スキル未設定

        const skillDef = SKILLS[skillId];
        if (!skillDef) return;

        // 以下既存のuseSkillロジック（引数等調整が必要な場合あり、現状のコードベースに合わせて呼び出し）
        // 元のuseSkillメソッドはこのクラスにはなく、BaseGameSceneなどから呼ばれる想定か？
        // Playerクラスに `useSkill` 的なロジックがあるか確認したが、viewにはない。
        // おそらく BaseGameScene で `this.player.skills[index]` を参照している。
        // BaseGameScene側を変更して `this.player.stats.activeSkills[index]` を参照するようにする。
    }

    applyEquipmentStats() {
        // 基本ステータスから派生ステータスを計算
        const str = this.stats.str || 5;
        const int = this.stats.int || 5;
        const vit = this.stats.vit || 5;
        const men = this.stats.men || 5;
        const dex = this.stats.dex || 5;

        // 派生ステータスの基礎値を計算
        const jobDef = JOBS[this.stats.job];
        const isMagical = jobDef && jobDef.type === 'magical';
        const jobAtkBonus = jobDef?.atkBonus || 0;
        const jobDefBonus = jobDef?.defBonus || 0;
        const jobHpBonus = jobDef?.hpBonus || 0;

        // 注: ここでジョブ固有のボーナス(jobDefBonus等)が加算されます
        if (isMagical) {
            this.stats.atk = 5 + (int * 2) + jobAtkBonus;  // INT 1 = ATK +2 + Job Bonus
        } else {
            this.stats.atk = 5 + (str * 2) + jobAtkBonus;  // STR 1 = ATK +2 + Job Bonus
        }
        this.stats.def = 3 + Math.floor(vit * 0.5) + jobDefBonus;
        // HPの伸び方は GROWTH_CONFIG で一括調整できる。
        // レベルのべき乗成分（序盤は緩やか、終盤にしっかり伸びる）と
        // VIT由来の成分を足してから、最後に HP_GROWTH_MULTIPLIER をまとめて掛ける。
        const hpFromLevel = Math.pow(this.stats.level || 1, GROWTH_CONFIG.HP_LEVEL_EXPONENT) * GROWTH_CONFIG.HP_LEVEL_SCALE;
        const hpFromVit = vit * GROWTH_CONFIG.HP_PER_VIT;
        this.stats.maxHp = GROWTH_CONFIG.HP_BASE + Math.round((hpFromLevel + hpFromVit) * GROWTH_CONFIG.HP_GROWTH_MULTIPLIER) + jobHpBonus;
        this.stats.maxMp = 30 + (men * 5);

        // 職業ごとのステータス倍率（data/jobs.js の atkMult/defMult/hpMult/mpMult。未設定の職業は1.0）。
        // 固定値ボーナスと違い、レベルが上がっても職業の個性が残る。パッシブ・装備の補正はこの後に乗る。
        this.stats.atk = Math.ceil(this.stats.atk * (jobDef?.atkMult ?? 1));
        this.stats.def = Math.ceil(this.stats.def * (jobDef?.defMult ?? 1));
        this.stats.maxHp = Math.ceil(this.stats.maxHp * (jobDef?.hpMult ?? 1));
        this.stats.maxMp = Math.ceil(this.stats.maxMp * (jobDef?.mpMult ?? 1));

        // --- パッシブスキルの効果を汎用的に適用 ---
        // 新しいパッシブを追加するとき、ここにif文を増やす必要はない。
        // スキル定義側の effect にキーを書けば、対応する効果が自動で乗る。
        // 対応キー: atkMult, defMult, maxHpMult, maxHpFlat, maxMpFlat, maxMpMult,
        //           speedFlat, critChanceFlat, lifestealFlat, expMultBonus, maxSummonsFlat,
        //           cooldownMult, mpCostMult, healPowerMult, maxSummonsFlat
        const unlocked = this.stats.unlockedSkills || [];
        let passiveSpeedBonus = 0;
        let passiveCritBonus = 0;
        let passiveLifestealBonus = 0;
        let passiveDodgeBonus = 0;
        this.stats.cooldownMult = 1.0;  // combat.js がスキルCTに掛ける（1.0=通常）
        this.stats.mpCostMult = 1.0;    // combat.js がMP消費に掛ける（1.0=通常）
        this.stats.healPowerMult = 1.0; // combat.js が回復量に掛ける（1.0=通常）
        this.stats.expMultiplier = 1.0;
        this.stats.maxSummons = 1;      // summons.js が同時召喚数の上限として参照する（1=通常、パッシブで増加）

        unlocked.forEach(skillId => {
            const skillDef = SKILLS[skillId];
            if (!skillDef || skillDef.type !== 'passive' || !skillDef.effect) return;
            const e = skillDef.effect;

            // スキルレベルによる倍率（Lv1=1.0, Lv2=1.3, Lv3=1.6, … Lv10=3.7）
            const skillLevel = this.stats.skillLevels?.[skillId] || 1;
            const levelMult = 1 + (skillLevel - 1) * 0.3;

            // 乗算系: スキルレベルは基礎値に対してかけ算（累乗ではなくレベル比例）
            if (e.atkMult) this.stats.atk = Math.ceil(this.stats.atk * (1 + (e.atkMult - 1) * levelMult));
            if (e.defMult) this.stats.def = Math.ceil(this.stats.def * (1 + (e.defMult - 1) * levelMult));
            if (e.maxHpMult) this.stats.maxHp = Math.ceil(this.stats.maxHp * (1 + (e.maxHpMult - 1) * levelMult));
            if (e.maxMpMult) this.stats.maxMp = Math.ceil(this.stats.maxMp * (1 + (e.maxMpMult - 1) * levelMult));
            // 加算系: スキルレベルに比例してフラット値を倍増
            if (e.maxHpFlat) this.stats.maxHp += Math.ceil(e.maxHpFlat * levelMult);
            if (e.maxMpFlat) this.stats.maxMp += Math.ceil(e.maxMpFlat * levelMult);
            if (e.speedFlat) passiveSpeedBonus += e.speedFlat * levelMult;
            if (e.critChanceFlat) passiveCritBonus += e.critChanceFlat * levelMult;
            if (e.lifestealFlat) passiveLifestealBonus += e.lifestealFlat * levelMult;
            if (e.dodgeChanceFlat) passiveDodgeBonus += e.dodgeChanceFlat * levelMult;
            if (e.expMultBonus) this.stats.expMultiplier += e.expMultBonus * levelMult;
            // 乗算系（cooldown/mpCost/healPower）: レベルが高いほどより強く縮小・拡大する
            if (e.cooldownMult) this.stats.cooldownMult *= (1 + (e.cooldownMult - 1) * levelMult);
            if (e.mpCostMult) this.stats.mpCostMult *= (1 + (e.mpCostMult - 1) * levelMult);
            if (e.healPowerMult) this.stats.healPowerMult *= (1 + (e.healPowerMult - 1) * levelMult);
            if (e.maxSummonsFlat) this.stats.maxSummons += Math.floor(e.maxSummonsFlat * levelMult);
        });

        // 特殊ステータスの基礎値
        this.stats.critChance = (dex * 0.01) + passiveCritBonus;
        this.stats.lifesteal = passiveLifestealBonus;
        this.stats.speedBonus = Math.min((dex * 2) + passiveSpeedBonus, SPEED_CONFIG.MAX_SPEED_BONUS);

        // ステータス割り振り画面で「装備によってここまで補正されている」を
        // 表示できるように、装備を加算する直前（素のステータス）を控えておく。
        const baseAtk = this.stats.atk;
        const baseDef = this.stats.def;
        const baseCritChance = this.stats.critChance;
        const baseSpeedBonus = this.stats.speedBonus;

        // 回避率の固定加算分（パッシブ + 装備の dodgeChance）。AGI由来の分は getDodgeChance() が別に計算する
        this.stats.dodgeChanceFlat = passiveDodgeBonus;

        // 装備由来の特殊効果（毎回リセットしてから再計算する）
        this.stats.atkMultiplier = 1.0;
        this.stats.attackCooldownMult = 1.0;
        this.stats.multiHit = 1;
        this.stats.attackRangeBonus = 0;
        this.stats.forceAreaAttack = false;
        this.stats.critDamageMultiplier = COMBAT_CONFIG.CRIT_MULTIPLIER;
        this.stats.defenseIgnore = 0;
        this.stats.manaSteal = 0;
        this.stats.damageReduction = 0;
        this.stats.hpRegen = 0;
        this.stats.mpRegen = 0;
        this.stats.goldMultiplier = 1.0;
        this.stats.knockback = 0;

        // 状態異常耐性 (%) / 状態異常完全無効フラグ
        this.stats.statusResist = { freeze: 0, paralyze: 0, poison: 0 };
        this.stats.allStatusResist = 0;
        this.stats.statusImmunity = false;

        // 属性耐性(%) / 属性固定加算ダメージ。{ 属性id: 値 } で持つので、属性を足しても書き換え不要
        this.stats.elementResist = {};
        this.stats.elementDamage = {};
        this.stats.freezeChance = 0; // 0〜1
        this.stats.deathChance = 0;  // 0〜1（即死効果）
        this.stats.poisonEquipped = false;

        // 新属性システム（火・水・雷・風・土・光・闇）。鍛冶屋で武器/防具に付与した属性。
        this.stats.paralyzeChance = 0; // 0〜1
        this.stats.poisonChance = 0;   // 0〜1
        this.stats.poisonDamage = 0;   // 毒の1tickあたりの固定ダメージ
        this.stats.burnChance = 0;     // 0〜1（火属性: 炎上/炎症付与率）
        this.stats.burnDamage = 0;     // 炎上の1tickあたりのダメージ
        this.stats.armorBreakChance = 0; // 0〜1（土属性: アーマーブレイク/防御崩し付与率）
        this.stats.extraStatusEffects = []; // 新状態異常（スタン、石化、呪い、出血、沈黙、失明、混乱等）

        const weapon = ITEMS[this.stats.equipment.weapon];
        const armor = ITEMS[this.stats.equipment.armor];
        const relic = ITEMS[this.stats.equipment.relic]; // 宝具スロット

        // 装備ボーナスを加算
        [weapon, armor, relic].forEach(item => {
            if (!item) return;
            const s = item.stats || {};
            const power = this.getEquipmentPowerMultiplier(item);

            // 攻撃力・防御力 (関数なら実行、そうでなければ加算)
            const rawVal = (val) => (typeof val === 'function' ? val(this) : (val || 0));
            // レベル不足で性能が落ちたときに小数が出ないよう、四捨五入で管理する。
            //  - getInt : 攻撃力・防御力・速度・固定ダメージ・属性耐性(%)など「整数で扱う値」→ 整数に四捨五入
            //  - getRate: 会心率・回避率・状態異常の確率など 0〜1 の割合 → 1%刻み(小数第2位)に四捨五入
            // 性能100%(レベル足りている/制限解除済み)のときは、元の値をそのまま使う。
            const getInt = (val) => (power < 1 ? Math.round(rawVal(val) * power) : rawVal(val));
            const getRate = (val) => (power < 1 ? Math.round(rawVal(val) * power * 100) / 100 : rawVal(val));
            const getVal = (val) => rawVal(val) * power; // 経験値倍率など、丸めない値用

            // 魔法職は matk (魔法攻撃力) を優先して攻撃力に反映する
            const atkSource = isMagical ? (item.matk ?? s.matk ?? item.atk ?? s.attack) : (item.atk ?? s.attack);
            this.stats.atk += getInt(atkSource);
            this.stats.def += getInt(item.def || s.defense);
            this.stats.maxHp += getInt(item.maxHp || s.maxHp || s.hp || 0);
            this.stats.maxMp += getInt(item.maxMp || s.maxMp || 0);
            this.stats.speedBonus += getInt(item.speedBonus || s.speedBonus || s.speed || 0);

            // 特殊ステータス
            this.stats.critChance += getRate(item.critChance || s.critChance);
            this.stats.lifesteal += getRate(item.lifesteal || s.lifesteal);
            this.stats.dodgeChanceFlat += getRate(item.dodgeChance || s.dodgeChance);

            // クラフト装備等の特殊状態異常配列
            if (Array.isArray(item.statusEffects)) {
                item.statusEffects.forEach(se => {
                    const ch = getRate(se.chance);
                    if (se.key === 'freeze') this.stats.freezeChance = Math.max(this.stats.freezeChance, ch);
                    else if (se.key === 'paralyze') this.stats.paralyzeChance = Math.max(this.stats.paralyzeChance, ch);
                    else if (se.key === 'poison') {
                        this.stats.poisonChance = Math.max(this.stats.poisonChance, ch);
                        this.stats.poisonDamage = Math.max(this.stats.poisonDamage, Math.ceil(this.stats.atk * 0.15));
                    } else if (se.key === 'burn') {
                        this.stats.burnChance = Math.max(this.stats.burnChance, ch);
                        this.stats.burnDamage = Math.max(this.stats.burnDamage, Math.ceil(this.stats.atk * 0.18));
                    } else {
                        if (!this.stats.extraStatusEffects) this.stats.extraStatusEffects = [];
                        this.stats.extraStatusEffects.push({ key: se.key, chance: ch });
                    }
                });
            }

            // 属性・特殊効果
            // xxxResist / xxxDamage（xxxは属性id。旧名 ice も水として集計）。値が関数の項目にも対応
            [[resistKey, this.stats.elementResist], [damageKey, this.stats.elementDamage]].forEach(([keyFn, target]) => {
                const resolved = {};
                Object.keys(s).forEach((k) => { resolved[k] = getInt(s[k]); });
                Object.entries(collectElementStats(resolved, keyFn)).forEach(([el, v]) => {
                    target[el] = (target[el] || 0) + v;
                });
            });
            this.stats.freezeChance += getRate(s.freezeChance);
            this.stats.deathChance += getRate(s.deathChance);
            this.stats.paralyzeChance += getRate(s.paralyzeChance);
            this.stats.poisonChance += getRate(s.poisonChance);
            this.stats.poisonDamage += getInt(s.poisonDamage);
            this.stats.burnChance += getRate(s.burnChance);
            this.stats.burnDamage += getInt(s.burnDamage);
            this.stats.armorBreakChance += getRate(s.armorBreakChance);
            if (s.attackMultiplier) {
                const m = 1 + ((s.attackMultiplier - 1) * power);
                this.stats.atkMultiplier *= (power < 1 ? Math.round(m * 100) / 100 : m);
            }
            if (s.poison) this.stats.poisonEquipped = true;

            // 攻撃速度 (attackSpeed: 倍率 / attackCooldownMult: クールダウン倍率)
            if (s.attackSpeed) {
                const spd = (power < 1 ? 1 + (s.attackSpeed - 1) * power : s.attackSpeed);
                if (spd > 0) this.stats.attackCooldownMult *= (1 / spd);
            }
            if (s.attackCooldownMult) {
                const m = (power < 1 ? 1 - (1 - s.attackCooldownMult) * power : s.attackCooldownMult);
                this.stats.attackCooldownMult *= Math.max(0.05, m);
            }

            // スキルクールダウン短縮 / スキルMP消費 / 回復量倍率
            if (s.cooldownMult !== undefined) {
                const m = (power < 1 ? 1 - (1 - s.cooldownMult) * power : s.cooldownMult);
                this.stats.cooldownMult *= Math.max(0.05, m);
            }
            if (s.mpCostMult !== undefined) {
                const m = (power < 1 ? 1 - (1 - s.mpCostMult) * power : s.mpCostMult);
                this.stats.mpCostMult *= Math.max(0, m);
            }
            if (s.healPowerMult !== undefined) {
                const m = (power < 1 ? 1 + (s.healPowerMult - 1) * power : s.healPowerMult);
                this.stats.healPowerMult *= m;
            }

            // マルチ攻撃（多段ヒット）
            if (s.multiHit) this.stats.multiHit += (getInt(s.multiHit) - 1);
            if (s.extraHits) this.stats.multiHit += getInt(s.extraHits);

            // 攻撃射程増加 / 単体職でも強制範囲攻撃化
            if (s.attackRangeBonus) this.stats.attackRangeBonus += getInt(s.attackRangeBonus);
            if (s.forceAreaAttack) this.stats.forceAreaAttack = true;

            // 会心ダメージ倍率強化
            if (s.critDamageMultiplier) {
                const bonus = (s.critDamageMultiplier - COMBAT_CONFIG.CRIT_MULTIPLIER) * power;
                this.stats.critDamageMultiplier += Math.max(0, bonus);
            }

            // 防御無視 / 貫通 (0〜1)
            if (s.defenseIgnore) this.stats.defenseIgnore = Math.min(1.0, this.stats.defenseIgnore + getRate(s.defenseIgnore));
            if (s.armorPenetration) this.stats.defenseIgnore = Math.min(1.0, this.stats.defenseIgnore + getRate(s.armorPenetration));

            // MP吸収 (0〜1)
            if (s.manaSteal) this.stats.manaSteal += getRate(s.manaSteal);

            // 被ダメージ軽減 (0〜1)
            if (s.damageReduction) this.stats.damageReduction = Math.min(1.0, this.stats.damageReduction + getRate(s.damageReduction));

            // HP / MP 自動回復
            if (s.hpRegen) this.stats.hpRegen += getInt(s.hpRegen);
            if (s.mpRegen) this.stats.mpRegen += getInt(s.mpRegen);

            // ゴールド獲得倍率
            if (s.goldMultiplier) this.stats.goldMultiplier += (getVal(s.goldMultiplier) - 1.0);

            // ノックバック
            if (s.knockback) this.stats.knockback += getInt(s.knockback);

            // 全属性ダメージ / 全属性耐性
            if (s.allElementDamage) {
                const val = getInt(s.allElementDamage);
                ELEMENTS.forEach(el => {
                    this.stats.elementDamage[el] = (this.stats.elementDamage[el] || 0) + val;
                });
            }
            if (s.allElementResist) {
                const val = getInt(s.allElementResist);
                ELEMENTS.forEach(el => {
                    this.stats.elementResist[el] = (this.stats.elementResist[el] || 0) + val;
                });
            }

            // 状態異常耐性
            if (s.freezeResist) this.stats.statusResist.freeze += getInt(s.freezeResist);
            if (s.paralyzeResist) this.stats.statusResist.paralyze += getInt(s.paralyzeResist);
            if (s.poisonResist) this.stats.statusResist.poison += getInt(s.poisonResist);
            if (s.allStatusResist || s.statusResist) {
                const sr = getInt(s.allStatusResist || s.statusResist);
                this.stats.allStatusResist += sr;
            }
            if (s.statusImmunity) this.stats.statusImmunity = true;

            // 経験値倍率は加算方式
            if (item.expMultiplier) this.stats.expMultiplier += (item.expMultiplier - 1.0);
            if (s.expMultiplier) this.stats.expMultiplier += (getVal(s.expMultiplier) - 1.0);
        });

        // 鍛冶屋で付与した属性、または武器自体の属性(element/elements)
        const customElements = (weapon?.elements && weapon.elements.length > 0)
            ? [...weapon.elements]
            : (weapon?.element ? [weapon.element] : []);
        const forgedElement = this.stats.itemElements?.[this.stats.equipment.weapon];
        if (forgedElement && !customElements.includes(forgedElement)) {
            customElements.push(forgedElement);
        }
        this.stats.weaponElements = customElements;
        this.stats.weaponElement = customElements.length > 1 ? customElements : (customElements[0] || null);
        this.stats.armorElement = this.stats.itemElements?.[this.stats.equipment.armor] || armor?.element || null;

        // 武器の属性ごとの追加効果（凍結/麻痺/毒など）。複合属性は全属性分を適用
        customElements.forEach(el => {
            Object.entries(getWeaponElementBonus(el, this.stats.atk)).forEach(([key, value]) => {
                this.stats[key] = (this.stats[key] || 0) + value;
            });
        });

        // 強化ボーナスを適用（アイテムごとの enhanceLevel × 5%）
        // ※ 属性ボーナスを含む全装備補正が確定した後に加算する。
        const enhSlots = ['weapon', 'armor', 'relic'];
        enhSlots.forEach(slot => {
            const itemId = this.stats.equipment[slot];
            if (!itemId) return;
            const enhItem = ITEMS[itemId];
            if (!enhItem) return;
            const enhLv = this.getEnhanceLevel(itemId);
            if (!enhLv) return;
            const enhS = enhItem.stats || {};
            const bonus = enhLv * 0.05; // 1レベルにつき +5%
            const baseItemAtk = isMagical
                ? (enhItem.matk ?? enhS.matk ?? enhItem.atk ?? enhS.attack ?? 0)
                : (enhItem.atk ?? enhS.attack ?? 0);
            const baseItemDef = enhItem.def ?? enhS.defense ?? 0;
            const baseItemHp  = enhItem.maxHp ?? enhS.maxHp ?? 0;
            if (baseItemAtk) this.stats.atk   = Math.ceil(this.stats.atk   + baseItemAtk * bonus);
            if (baseItemDef) this.stats.def   = Math.ceil(this.stats.def   + baseItemDef * bonus);
            if (baseItemHp)  this.stats.maxHp = Math.ceil(this.stats.maxHp + baseItemHp  * bonus);
        });

        // ランダムOP（ハクスラ厳選エンチャント）の適用
        this.stats.atkMult = 1.0;
        this.stats.defMult = 1.0;
        this.stats.bonusMaxHp = 0;
        this.stats.bonusMaxMp = 0;
        this.stats.cooldownReduction = 0;

        if (this.stats.equipmentOptions) {
            ['weapon', 'armor', 'relic'].forEach(slot => {
                const optData = this.stats.equipmentOptions[slot];
                if (optData && Array.isArray(optData.options)) {
                    optData.options.forEach(op => {
                        const def = OPTION_POOL.find(p => p.id === op.id);
                        if (def && typeof def.apply === 'function') {
                            def.apply(this.stats, op.value);
                        }
                    });
                }
            });
        }

        if (this.stats.bonusMaxHp) this.stats.maxHp += this.stats.bonusMaxHp;
        if (this.stats.bonusMaxMp) this.stats.maxMp += this.stats.bonusMaxMp;
        if (this.stats.atkMult && this.stats.atkMult !== 1) {
            this.stats.atk = Math.round(this.stats.atk * this.stats.atkMult);
        }
        if (this.stats.defMult && this.stats.defMult !== 1) {
            this.stats.def = Math.round(this.stats.def * this.stats.defMult);
        }
        if (this.stats.cooldownReduction) {
            this.stats.cooldownMult = (this.stats.cooldownMult || 1) * Math.max(0.4, 1 - this.stats.cooldownReduction);
        }

        // ここまでで武器/防具/宝具による補正が乗った後の値なので、装備前との差分を
        // 「装備補正値」として保持する（UI表示用。種による永続加算はここに含めない）。
        // 装備由来の speedBonus を加算（上限で頭打ち）
        this.stats.speedBonus = Math.min(this.stats.speedBonus, SPEED_CONFIG.MAX_SPEED_BONUS);

        this.stats.equipBonus = {
            atk: this.stats.atk - baseAtk,
            def: this.stats.def - baseDef,
            critChance: this.stats.critChance - baseCritChance,
            speedBonus: this.stats.speedBonus - baseSpeedBonus,
        };
        this.stats.isMagicalJob = isMagical;

        // アイテム（種）による永続ステータス加算
        this.stats.atk += (this.stats.bonusAtk || 0);
        this.stats.def += (this.stats.bonusDef || 0);

        this.speed = Math.min(SPEED_CONFIG.BASE_SPEED + this.stats.speedBonus, SPEED_CONFIG.MAX_TOTAL_SPEED);

        // HPとMPが最大値を超えないように調整
        this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
        this.stats.mp = Math.min(this.stats.mp, this.stats.maxMp);
    }

    /**
     * 必要Lv未満の装備は、Lv差に応じて20%〜100%の性能で使える。
     * 制限解除の証を使ったキャラクターは常に本来の性能になる。
     */
    getEquipmentPowerMultiplier(item) {
        const required = Number(item?.lvlReq || 0);
        if (!required || (this.stats.equipmentCapLevel || 0) >= required || this.stats.level >= required) return 1;
        const ratio = Math.max(0, this.stats.level || 1) / required;
        return GROWTH_CONFIG.UNDERLEVEL_EQUIPMENT_MIN_POWER
            + (1 - GROWTH_CONFIG.UNDERLEVEL_EQUIPMENT_MIN_POWER) * ratio;
    }

    /**
     * 装備またはスロットの強化レベルを取得する
     * @param {string} slotOrItemId - 'weapon' | 'armor' | 'relic' または アイテムID
     */
    getEnhanceLevel(slotOrItemId) {
        if (!slotOrItemId) return 0;
        let itemId = slotOrItemId;
        if (slotOrItemId === 'weapon' || slotOrItemId === 'armor' || slotOrItemId === 'relic') {
            itemId = this.stats.equipment[slotOrItemId];
        }
        if (!itemId) return 0;
        // アイテムごとの強化値を優先
        if (this.stats.itemEnhanceLevels && this.stats.itemEnhanceLevels[itemId] !== undefined) {
            return this.stats.itemEnhanceLevels[itemId];
        }
        return 0;
    }

    /**
     * 装備強化
     * @param {string} slot - 'weapon' | 'armor' | 'relic'
     * @param {string} stoneId - 'enhance_stone_1' | 'enhance_stone_2' | 'enhance_stone_3'
     */
    enhanceEquipment(slot, stoneId) {
        if (!this.isLocal) return { success: false };

        const itemId = this.stats.equipment[slot];
        if (!itemId) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('その枠に装備がありません', 'error');
            return { success: false };
        }

        if (!this.stats.itemEnhanceLevels) this.stats.itemEnhanceLevels = {};
        if (!this.stats.enhanceLevels) this.stats.enhanceLevels = { weapon: 0, armor: 0, relic: 0 };
        const currentLevel = this.getEnhanceLevel(itemId);

        // 石の種類ごとの上限
        const stoneLimits = {
            enhance_stone_1: 5,
            enhance_stone_2: 10,
            enhance_stone_3: 15,
        };
        const stoneLimit = stoneLimits[stoneId] || 5;

        if (currentLevel >= 15) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('強化限界に達しています (+15)', 'error');
            return { success: false };
        }
        if (currentLevel >= stoneLimit) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`この石では+${stoneLimit}が上限です`, 'error');
            return { success: false };
        }

        // 石を持っているか確認
        const stoneEntry = this.stats.inventory.find(e => (typeof e === 'string' ? e : e.id) === stoneId);
        if (!stoneEntry) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('強化石が足りません', 'error');
            return { success: false };
        }

        // ゴールドコスト: (currentLevel + 1)^2 * 1000
        const goldCost = Math.pow(currentLevel + 1, 2) * 1000;
        if (this.stats.gold < goldCost) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`ゴールドが足りません (必要: ${goldCost}G)`, 'error');
            return { success: false };
        }

        // 成功率: +0〜+5: 100%, +6〜+9: 80%, +10〜+12: 60%, +13〜+14: 40%, +15: 20%
        let successRate;
        if (currentLevel < 6) successRate = 1.0;
        else if (currentLevel < 10) successRate = 0.8;
        else if (currentLevel < 13) successRate = 0.6;
        else if (currentLevel < 15) successRate = 0.4;
        else successRate = 0.2;

        // ゴールドと石を消費
        this.stats.gold -= goldCost;
        if (typeof stoneEntry === 'object') {
            stoneEntry.count--;
            if (stoneEntry.count <= 0) {
                this.stats.inventory = this.stats.inventory.filter(e => (typeof e === 'string' ? e : e.id) !== stoneId);
            }
        } else {
            this.stats.inventory = this.stats.inventory.filter(e => (typeof e === 'string' ? e : e.id) !== stoneId);
        }

        const roll = Math.random();
        if (roll < successRate) {
            // 成功！
            const newLv = currentLevel + 1;
            this.stats.itemEnhanceLevels[itemId] = newLv;
            this.stats.enhanceLevels[slot] = newLv;
            this.applyEquipmentStats();
            this.saveStats();
            checkAchievements(this);
            if (this.scene.notificationUI) this.scene.notificationUI.show(`✨ 強化成功！ +${newLv} になった！`, 'success');
            return { success: true, newLevel: newLv };
        } else {
            // 失敗: +6以上は1段階下がるリスクあり（+5以下は据え置き）
            if (currentLevel >= 6) {
                const newLv = Math.max(0, currentLevel - 1);
                this.stats.itemEnhanceLevels[itemId] = newLv;
                this.stats.enhanceLevels[slot] = newLv;
                this.applyEquipmentStats();
                this.saveStats();
                if (this.scene.notificationUI) this.scene.notificationUI.show(`💔 強化失敗… +${newLv} に下がってしまった`, 'error');
                return { success: false, downgraded: true, newLevel: newLv };
            } else {
                this.saveStats();
                if (this.scene.notificationUI) this.scene.notificationUI.show('💔 強化失敗…（レベルは維持されました）', 'error');
                return { success: false, downgraded: false, newLevel: currentLevel };
            }
        }
    }

    /** クイックスロット用の消耗品を1個使用する。 */
    useQuickItem(itemId) {
        if (!this.isLocal) return false;
        const item = ITEMS[itemId];
        const entry = this.stats.inventory.find(e => (typeof e === 'string' ? e : e.id) === itemId);
        if (!item || item.type !== 'consumable' || !entry) {
            this.scene.notificationUI?.show('このアイテムはもう持っていません', 'error');
            return false;
        }
        const now = Date.now();
        const key = `item:${itemId}`;
        if (now - (this.skillCooldowns[key] || 0) < 700) return false;
        const s = item.stats || {};
        const heal = (item.heal || s.heal || 0) + Math.floor(this.stats.maxHp * (s.healPct || 0));
        const healMp = (item.healMp || s.healMp || 0) + Math.floor(this.stats.maxMp * (s.healMpPct || 0));
        if (!heal && !healMp) return false;
        if (heal) this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + heal);
        if (healMp) this.stats.mp = Math.min(this.stats.maxMp, this.stats.mp + healMp);
        if (typeof entry === 'string' || (entry.count || 1) <= 1) this.stats.inventory.splice(this.stats.inventory.indexOf(entry), 1);
        else entry.count -= 1;
        this.skillCooldowns[key] = now;
        this.saveStats();
        this.scene.notificationUI?.show(`${item.name}を使用した！`, 'success');
        this.scene.inventoryUI?.refreshList();
        return true;
    }

    /**
     * 最終的なダメージ計算
     * 武器の特殊効果などを反映可能にする
     */
    getDamage(multiplier = 1, target = null, skillElement = null) {
        // レベル差補正（自分が格上なら伸び、格下ならほぼ通らない）
        if (target) {
            const targetLevel = (target.level !== undefined) ? target.level : (target.stats?.level ?? 1);
            multiplier *= getLevelDiffMultiplier(this.stats.level, targetLevel);
        }

        let atk = this.stats.atk;

        // バフ効果を適用
        if (this.activeBuffs['attack_buff']) {
            atk += this.activeBuffs['attack_buff'].value;
        }

        const weapon = ITEMS[this.stats.equipment.weapon];

        // 武器独自の威力計算ロジックがあれば上書き/追加
        if (weapon && typeof weapon.calculateAtk === 'function') {
            atk = weapon.calculateAtk(atk, this, target);
        }

        // 装備の攻撃力倍率（例: 呪いの指輪で2倍）
        atk *= (this.stats.atkMultiplier || 1);

        let amount = Math.ceil(atk * multiplier);

        // 属性ダメージ（固定加算。会心の後に上乗せ）
        const elementalBonus = Object.values(this.stats.elementDamage || {}).reduce((sum, v) => sum + v, 0);

        // クリティカル判定
        const isCrit = Math.random() < Math.min(this.stats.critChance || 0, COMBAT_CONFIG.CRIT_CHANCE_CAP);
        if (isCrit) {
            const critMult = this.stats.critDamageMultiplier || COMBAT_CONFIG.CRIT_MULTIPLIER;
            amount = Math.ceil(amount * critMult);
        }

        amount += elementalBonus;

        // 新属性システム: 武器に付与した属性 vs 敵の属性（相性が良ければ1.7倍、悪ければ0.6倍）
        const targetElement = target ? (target.element || (target.type ? getEnemyStats(target.type)?.element : null)) : null;
        // スキル属性7 : 武器属性3 で相性倍率を混ぜる。片方だけならそちらが100%、
        // 通常攻撃などスキル属性が無ければ武器属性のみ、どちらも無ければ無属性(1.0倍)
        const { multiplier: affinityMult, element: attackElement } =
            getBlendedElementMultiplier(skillElement, this.stats.weaponElement, targetElement);
        if (affinityMult !== 1.0) {
            amount = Math.ceil(amount * affinityMult);
        }
        const isElementAdvantage = affinityMult > 1.0;
        const isElementWeak = affinityMult < 1.0;

        // 敵の防御力による軽減（フラット減算。プレイヤーが受けるダメージの計算式と揃えてある）
        let targetDef = target ? (target.def ?? target.stats?.def ?? 0) : 0;
        // 土属性アーマーブレイク効果: 防御力を完全に無力化しダメージ1.35倍
        const isTargetArmorBroken = target && target._armorBreakUntil && Date.now() < target._armorBreakUntil;
        if (isTargetArmorBroken) {
            targetDef = 0;
            amount = Math.ceil(amount * 1.35);
        } else if (this.stats.defenseIgnore > 0) {
            targetDef = Math.floor(targetDef * Math.max(0, 1 - this.stats.defenseIgnore));
        }
        if (targetDef > 0) {
            amount = Math.max(1, amount - targetDef);
        }

        // 即死効果（ボス系には効かない。type に "boss" を含むものは全てボス扱い）
        const isBossTarget = target && typeof target.type === 'string' && target.type.includes('boss');
        const isExecute = target && !isBossTarget &&
            this.stats.deathChance > 0 && Math.random() < this.stats.deathChance;
        if (isExecute && target) {
            amount = Math.max(amount, target.hp || amount);
        }

        // 状態異常（付与するかどうかの判定のみ。実際の付与は呼び出し側で行う）
        const isFreeze = this.stats.freezeChance > 0 && Math.random() < this.stats.freezeChance;
        const isParalyze = !isFreeze && this.stats.paralyzeChance > 0 && Math.random() < this.stats.paralyzeChance;
        const isPoison = this.stats.poisonChance > 0 && Math.random() < this.stats.poisonChance;
        const poisonTick = this.stats.poisonDamage || 0;
        // 火属性: 炎上（炎症/やけど）
        const isBurn = this.stats.burnChance > 0 && Math.random() < this.stats.burnChance;
        const burnTick = this.stats.burnDamage || Math.max(8, Math.ceil(atk * 0.12));
        // 土属性: アーマーブレイク（防御崩し）
        const isArmorBreak = this.stats.armorBreakChance > 0 && Math.random() < this.stats.armorBreakChance;

        // 特殊状態異常（スタン、石化、呪い、出血、沈黙、失明、混乱等）
        const extraStatusHits = [];
        if (Array.isArray(this.stats.extraStatusEffects)) {
            this.stats.extraStatusEffects.forEach(se => {
                if (se.chance > 0 && Math.random() < se.chance) {
                    extraStatusHits.push(se.key);
                }
            });
        }

        return {
            amount, isCrit, isExecute, isFreeze, isParalyze, isPoison, poisonTick,
            isBurn, burnTick, isArmorBreak, extraStatusHits,
            isElementAdvantage, isElementWeak, element: attackElement,
        };
    }

    /**
     * バフを適用（重ねがけ・スタック対応: 最大5スタック）
     */
    applyBuff(buffType, value, duration, maxStacks = 5) {
        const now = Date.now();
        const current = this.activeBuffs[buffType];

        // 状態異常無効の結界: スタックせず時間だけ更新し、すでにかかっている状態異常も浄化する
        if (buffType === 'status_immunity_buff') {
            this.activeBuffs[buffType] = { baseValue: 1, value: 1, stacks: 1, endTime: now + duration };
            if (this.isLocal) this.cleanseStatusEffects();
            if (this.isLocal && this.scene.notificationUI) {
                this.scene.notificationUI.show('🔰 結界が状態異常を防ぐ！', 'success', 2000);
            }
            if (this.isLocal && this.scene.playerStatsUI) {
                this.scene.playerStatsUI._lastUpdateTime = 0;
                this.scene.playerStatsUI.update();
            }
            return;
        }

        if (current && current.endTime > now) {
            // 既存バフがある場合はスタック加算
            const stacks = Math.min((current.stacks || 1) + 1, maxStacks);
            current.stacks = stacks;
            current.value = (current.baseValue || current.value) * stacks;
            current.endTime = now + duration;
        } else {
            // 新規バフ
            this.activeBuffs[buffType] = {
                baseValue: value,
                value: value,
                stacks: 1,
                endTime: now + duration
            };
        }

        const buff = this.activeBuffs[buffType];

        // バフに応じてステータスを更新
        if (buffType === 'speed_buff') {
            this.speed = Math.min(SPEED_CONFIG.BASE_SPEED + this.stats.speedBonus + buff.value, SPEED_CONFIG.MAX_TOTAL_SPEED);
        }

        if (this.scene.notificationUI && buff.stacks > 1) {
            const buffNames = {
                attack_buff: '攻撃力バフ',
                defense_buff: '防御力バフ',
                speed_buff: '移動速度バフ',
                summon_power_up: '召喚強化バフ'
            };
            const label = buffNames[buffType] || buffType;
            this.scene.notificationUI.show(`✨ ${label} が重ねがけされた！ (${buff.stacks}スタック)`, 'info', 2000);
        }

        // 右側の戦闘能力パネルへ即反映（通常は250ms間隔の更新を待たない）
        if (this.isLocal && this.scene.playerStatsUI) {
            this.scene.playerStatsUI._lastUpdateTime = 0;
            this.scene.playerStatsUI.update();
        }
    }

    /**
     * 円形ゾーン（結界など）の中にいる間のバフ。スタックせず、毎回「あと少し」だけ延長する。
     * 円から出ると短時間で切れる。新しくかかった瞬間だけ true を返す。
     * 別のスキル由来の同種バフが有効なときは上書きしない。
     */
    refreshZoneBuff(buffType, value, duration) {
        const now = Date.now();
        const current = this.activeBuffs[buffType];
        const active = current && current.endTime > now;
        if (active && !current.fromZone) return false;

        this.activeBuffs[buffType] = { baseValue: value, value, stacks: 1, endTime: now + duration, fromZone: true };

        if (buffType === 'status_immunity_buff' && !active && this.isLocal) this.cleanseStatusEffects();
        if (buffType === 'speed_buff') {
            this.speed = Math.min(SPEED_CONFIG.BASE_SPEED + this.stats.speedBonus + value, SPEED_CONFIG.MAX_TOTAL_SPEED);
        }
        if (!active && this.isLocal && this.scene.playerStatsUI) {
            this.scene.playerStatsUI._lastUpdateTime = 0;
            this.scene.playerStatsUI.update();
        }
        return !active;
    }

    /**
     * 期限切れのバフを削除
     */
    updateBuffs() {
        const now = Date.now();
        let buffExpired = false;

        Object.keys(this.activeBuffs).forEach(buffType => {
            if (this.activeBuffs[buffType].endTime <= now) {
                delete this.activeBuffs[buffType];
                buffExpired = true;
            }
        });

        // バフが切れたら速度を再計算
        if (buffExpired && !this.activeBuffs['speed_buff']) {
            this.speed = Math.min(SPEED_CONFIG.BASE_SPEED + this.stats.speedBonus, SPEED_CONFIG.MAX_TOTAL_SPEED);
        }
    }

    /**
     * 現在の防御力を取得（バフ込み）
     */
    getDefense() {
        let def = this.stats.def;
        if (this.activeBuffs['defense_buff']) {
            def += this.activeBuffs['defense_buff'].value;
        }
        return def;
    }

    equipItem(itemId, itemUidOrOptions = null) {
        if (!this.isLocal || !ITEMS[itemId]) return;
        const item = ITEMS[itemId];

        if (item.type === 'weapon' && item.weaponClass && !this.canEquipWeapon(item.weaponClass)) {
            const label = WEAPON_CLASS_LABELS[item.weaponClass] || item.weaponClass;
            this.scene.notificationUI?.show(`${getJobWeaponLabel(this.stats.job)}は${label}を装備できません`, 'error');
            return false;
        }

        // オプション情報の取得
        let targetOptions = null;
        let targetUid = null;
        if (itemUidOrOptions && typeof itemUidOrOptions === 'object' && itemUidOrOptions.options) {
            targetOptions = itemUidOrOptions;
        } else if (typeof itemUidOrOptions === 'string') {
            targetUid = itemUidOrOptions;
            const found = this.stats.inventory?.find(i => typeof i === 'object' && i.uid === targetUid);
            if (found && found.options) targetOptions = found.options;
        } else {
            // インベントリから該当アイテムのオプションを探索
            const found = this.stats.inventory?.find(i => typeof i === 'object' && i.id === itemId && i.options);
            if (found) {
                targetOptions = found.options;
                targetUid = found.uid;
            }
        }

        this.stats.equipmentOptions = this.stats.equipmentOptions || {};
        this.stats.equipmentUid = this.stats.equipmentUid || {};

        if (item.type === 'weapon') {
            this.stats.equipment.weapon = itemId;
            this.stats.equipmentOptions.weapon = targetOptions;
            this.stats.equipmentUid.weapon = targetUid;
        } else if (item.type === 'armor') {
            this.stats.equipment.armor = itemId;
            this.stats.equipmentOptions.armor = targetOptions;
            this.stats.equipmentUid.armor = targetUid;
        } else if (item.type === 'accessory') {
            this.stats.equipment.relic = itemId;
            this.stats.equipmentOptions.relic = targetOptions;
            this.stats.equipmentUid.relic = targetUid;
        }

        this.applyEquipmentStats(); // すべてのステータスを再計算

        if (this.scene.notificationUI) {
            const power = this.getEquipmentPowerMultiplier(item);
            const suffix = power < 1 ? `（性能 ${Math.round(power * 100)}%）` : '';
            const optPrefix = targetOptions?.prefix || '';
            const optRarity = targetOptions ? ` [${targetOptions.rarityName}]` : '';
            this.scene.notificationUI.show(`${optPrefix}${item.name}${optRarity} を装備しました！${suffix}`, 'info');

            // 経験値倍率つきの装備は、実際に効いているかどうかが分かりにくいという声が
            // あったため、装備した瞬間に「x◯発動中/Lv上限で無効」をはっきり表示する。
            const itemExpMult = item.stats?.expMultiplier || item.expMultiplier;
            if (itemExpMult && itemExpMult !== 1) {
                const cap = GROWTH_CONFIG.EXP_MULTIPLIER_LEVEL_CAP;
                if (this.stats.level <= cap) {
                    this.scene.notificationUI.show(`✨経験値 x${itemExpMult} 発動中！（Lv${cap}まで）`, 'success');
                } else {
                    this.scene.notificationUI.show(`⚠経験値x${itemExpMult}の効果はLv${cap}までのため、現在は無効です`, 'error');
                }
            }
        }

        this.saveStats();
        return true;
    }

    canEquipWeapon(weaponClass) {
        const job = this.stats.job || '';

        // --- 短刀（dagger）: タンク系専用武器！---
        if (weaponClass === 'dagger') {
            return ['tank', 'paladin', 'warden', 'juggernaut', 'avenger'].includes(job);
        }

        // --- レンジャー系（弓・クロスボウ専用）---
        if (['ranger', 'sniper', 'wind_archer', 'gunslinger'].includes(job))
            return ['bow', 'crossbow'].includes(weaponClass);

        // --- タンク系（短刀・片手剣・メイス・ハンマー・剣盾）---
        if (['tank', 'paladin', 'warden', 'juggernaut', 'avenger'].includes(job))
            return ['dagger', 'oneHandSword', 'mace', 'hammer', 'shield_sword'].includes(weaponClass);

        // --- 双剣特化（バーサーカー・ニンジャ・サムライ・ドラゴンナイト）---
        // ※ファイター・ナイトは oneHandSword/twoHandSword/spear/katana も可
        if (['berserker', 'ninja'].includes(job))
            return ['dualSword', 'oneHandSword', 'katana'].includes(weaponClass);

        if (['samurai', 'dragon_knight'].includes(job))
            return ['katana', 'twoHandSword', 'oneHandSword', 'spear'].includes(weaponClass);

        // --- 魔法職（杖・ワンド・魔導書・魔導球）---
        if (JOBS[job]?.type === 'magical')
            return ['staff', 'wand', 'tome', 'orb'].includes(weaponClass);

        // --- サモナー系（魔導書・杖・魔導球）---
        if (['summoner', 'high_summoner', 'necromancer', 'beast_lord', 'spirit_master'].includes(job))
            return ['tome', 'staff', 'orb', 'scythe'].includes(weaponClass);

        // --- プリースト系（杖・メイス・ハンマー）---
        if (['priest', 'saint', 'war_priest', 'shadow_priest', 'exorcist'].includes(job))
            return ['staff', 'mace', 'hammer', 'wand'].includes(weaponClass);

        // --- ファイター・ナイト（汎用物理職）---
        return ['oneHandSword', 'twoHandSword', 'spear', 'axe', 'dualSword', 'katana', 'scythe'].includes(weaponClass);
    }

    /**
     * 各種報酬を一括で付与する（拡張性）
     * @param {Object} reward 報酬オブジェクト { exp, gold, item, ... }
     */
    addReward(reward) {
        if (!this.isLocal || !reward) return;

        if (reward.exp) this.gainExp(reward.exp * GROWTH_CONFIG.QUEST_EXP_MULTIPLIER);
        if (reward.gold) this.gainGold(reward.gold);

        // 将来的にアイテムなどもここに追加可能
        if (reward.item) {
            this.addItem(reward.item);
        }
    }

    // silent=true なら通知とエフェクトを出さない（adminLevelUpTo で何十回も呼ぶとき用）
    levelUp(silent = false) {
        this.stats.level++;

        const jobDef = JOBS[this.stats.job];
        let statMsg = '';

        if (jobDef && jobDef.type === 'magical') {
            // 魔法職: INT重視
            this.stats.int += 2;
            this.stats.men += 1;
            this.stats.vit += 1; // 耐久も少し
            this.stats.dex += 1;
            // STRは上がらない
            statMsg = 'INT+2, MEN/VIT/DEX+1';
        } else if (jobDef && jobDef.type === 'physical') {
            // 物理職: STR重視
            this.stats.str += 2;
            this.stats.vit += 1;
            this.stats.dex += 1;
            this.stats.men += 1; // スキル用MP
            // INTは上がらない
            statMsg = 'STR+2, VIT/DEX/MEN+1';
        } else {
            // その他/初心者: バランス
            this.stats.str++;
            this.stats.int++;
            this.stats.vit++;
            this.stats.men++;
            this.stats.dex++;
            statMsg = '全ステータス+1';
        }

        this.stats.statPoints += 5; // レベルアップごとに5ポイント付与

        this.applyEquipmentStats(); // ステータス再計算

        this.updateSkillsByJob(); // 新スキルチェック

        this.stats.hp = this.stats.maxHp; // HP全回復
        this.stats.mp = this.stats.maxMp; // MP全回復
        this.stats.maxExp = calcMaxExp(this.stats.level);
        this.saveStats();

        if (!silent && this.scene.notificationUI) {
            this.scene.notificationUI.show(`レベルアップ！ Level ${this.stats.level} (${statMsg}, Pt+5)`, 'warning');
        }

        // 各種UIを更新
        if (this.scene.playerStatsUI) {
            this.scene.playerStatsUI.update();
        }
        if (this.scene.playerNameUI) {
            this.scene.playerNameUI.updateLevel(this.stats.level);
        }

        if (silent) return;

        // レベルアップエフェクト（簡易）
        const circle = this.scene.add.circle(this.x, this.y, 10, 0xffff00, 0.5);
        this.scene.tweens.add({
            targets: circle,
            radius: 50,
            alpha: 0,
            duration: 500,
            onComplete: () => circle.destroy()
        });
    }

    /**
     * adminモード用: 通常のレベルアップ処理（ステータス成長・ポイント付与）を、目標レベルまで通知なしで繰り返す。
     * レベルを下げることはできない。
     * @returns {number} 上がったレベル数
     */
    adminLevelUpTo(target) {
        if (!this.isLocal) return 0;
        const goal = Math.min(LEVEL_CONFIG.MAX_LEVEL, Math.floor(target));
        let gained = 0;
        while (this.stats.level < goal) {
            this.levelUp(true);
            gained++;
        }
        if (gained > 0) {
            this.stats.exp = 0;
            this.saveStats();
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`Lv.${this.stats.level} になった！(+${gained})`, 'warning');
            }
            if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
            if (this.scene.playerNameUI) this.scene.playerNameUI.updateLevel(this.stats.level);
        }
        return gained;
    }

    /**
     * アヴァベル/イザナギ式: 1つのステータスに割り振れる最大値（ステータスカウンター上限）を取得。
     * 転生を重ねることで上限が+15ずつ開放され、極限特化ビルドが可能になる。
     */
    getMaxAllocatableStat(statKey) {
        const rein = Math.min(this.stats.reincarnationCount || 0, REINCARNATION_CONFIG.MAX_SCALED_COUNT);
        return REINCARNATION_CONFIG.STAT_CAP_BASE + rein * REINCARNATION_CONFIG.STAT_CAP_PER_COUNT;
    }

    /**
     * ステータスポイントを割り振る
     * @param {string} stat - 'str', 'int', 'vit', 'men', 'dex', 'agi'
     * @param {number} points - 割り振るポイント数
     */
    allocateStatPoint(stat, points = 1) {
        if (!this.isLocal) return false;
        if (points <= 0) return false;

        const validStats = RESET_CONFIG.STAT_KEYS;
        if (!validStats.includes(stat)) {
            return false;
        }

        if (this.stats.statPoints < points) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('ステータスポイントが足りません', 'error');
            }
            return false;
        }

        // アヴァベル/イザナギ式: ステータス上限チェック
        const maxCap = this.getMaxAllocatableStat(stat);
        const currentAlloc = this.stats.allocatedStats?.[stat] || 0;
        if (currentAlloc + points > maxCap) {
            const remaining = Math.max(0, maxCap - currentAlloc);
            if (this.scene.notificationUI) {
                if (remaining <= 0) {
                    this.scene.notificationUI.show(`このステータスは上限（${maxCap}pt）に達しています。輪廻転生で上限を開放できます！`, 'error');
                } else {
                    this.scene.notificationUI.show(`上限（${maxCap}pt）を超えるため割り振れません（現在 ${currentAlloc} / 上限 ${maxCap}。あと ${remaining}pt 可能）`, 'error');
                }
            }
            return false;
        }

        this.stats.statPoints -= points;
        this.stats[stat] = (this.stats[stat] || 0) + points;
        // 割り振った分を記録（ステータスリセットの書で返還する対象）
        if (!this.stats.allocatedStats) this.stats.allocatedStats = this.sanitizeAllocatedStats({}) ;
        this.stats.allocatedStats[stat] = (this.stats.allocatedStats[stat] || 0) + points;

        // 派生ステータスを再計算
        this.applyEquipmentStats();
        this.saveStats();

        const statNames = {
            str: 'STR (攻撃力)',
            int: 'INT (魔法)',
            vit: 'VIT (HP)',
            men: 'MEN (MP)',
            dex: 'DEX (クリティカル/速度)',
            agi: 'AGI (回避)'
        };

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${statNames[stat]}に${points}ポイント割り振りました`, 'success');
        }
        return true;
    }

    /**
     * ステータスリセット: ポイントで割り振った分を全て返還し、ステータスポイントに戻す。
     * レベルアップの自然成長・転生ボーナス・アイテム（種）の加算分は戻らない。
     * @returns {number} 返還したポイント数（0なら割り振りが無かった）
     */
    resetStatPoints() {
        if (!this.isLocal) return 0;
        const alloc = this.stats.allocatedStats || this.estimateAllocatedStats();
        let refunded = 0;
        RESET_CONFIG.STAT_KEYS.forEach(k => {
            // 現在値が初期値を下回らないよう、念のためクランプする
            const n = Math.min(alloc[k] || 0, Math.max(0, (this.stats[k] || 0) - RESET_CONFIG.BASE_VALUE));
            if (n > 0) {
                this.stats[k] -= n;
                refunded += n;
            }
        });
        this.stats.allocatedStats = this.sanitizeAllocatedStats({});
        if (refunded <= 0) return 0;

        this.stats.statPoints += refunded;
        this.applyEquipmentStats();
        this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
        this.stats.mp = Math.min(this.stats.mp, this.stats.maxMp);
        this.saveStats();
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
        return refunded;
    }

    /**
     * 職業リセット: 職業を「なし」に戻し、職業管理人で基本職を選び直せるようにする。
     * 輪廻転生で集めたスキルや、クエストで獲得したユニークスキルは絶対に保護される。
     */
    resetJob() {
        if (!this.isLocal) return false;
        if (this.stats.job === 'none') return false;

        this.stats.job = 'none';
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);

        // 輪廻転生で集めたスキル、またはクエストユニークスキルは保護する
        const isReincarnated = (this.stats.reincarnationCount || 0) > 0 || (this.stats.reincarnatedSkills || []).length > 0;
        const uniqueKeys = Object.keys(UNIQUE_SKILLS || {});
        const reinSkills = this.stats.reincarnatedSkills || [];

        if (isReincarnated) {
            // 転生者: 集めた全スキルを保持し、再就職時にも消えないようにフラグを立てる
            const merged = Array.from(new Set([...(this.stats.unlockedSkills || []), ...reinSkills]));
            this.stats.unlockedSkills = merged;
            this.stats.reincarnatedSkills = [...merged];
            this.stats.skillLevels = { ...(this.stats.reincarnatedSkillLevels || {}), ...(this.stats.skillLevels || {}) };
            this.stats.reincarnatedSkillLevels = { ...this.stats.skillLevels };
            this.stats._skipSkillResetOnNextJob = true;
        } else {
            // 未転生者: ユニークスキルのみ保持、一般職スキルはリセット
            const preservedSkills = (this.stats.unlockedSkills || []).filter(id => uniqueKeys.includes(id));
            const preservedLevels = {};
            preservedSkills.forEach(id => {
                if (this.stats.skillLevels?.[id]) preservedLevels[id] = this.stats.skillLevels[id];
            });
            this.stats.unlockedSkills = preservedSkills;
            this.stats.skillLevels = preservedLevels;
            this.stats.jobExp = 0;
            this.stats._skipSkillResetOnNextJob = true; // 次の就職時もユニークスキルを消さない
        }

        this.skillCooldowns = {};

        this.applyEquipmentStats();
        this.stats.hp = Math.min(this.stats.hp, this.stats.maxHp);
        this.stats.mp = Math.min(this.stats.mp, this.stats.maxMp);
        this.saveStats();
        if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
        if (this.scene.skillBarUI) this.scene.skillBarUI.update();
        return true;
    }

    // 現在の回避率（0〜MAX_DODGE_CHANCE）。AGIの逓減カーブ + 装備/パッシブの固定加算、上限でクランプ。
    getDodgeChance() {
        const agi = Math.max(0, this.stats.agi || 0);
        const fromAgi = AGI_CONFIG.MAX_DODGE_CHANCE * agi / (agi + AGI_CONFIG.HALF_POINT);
        const flat = this.stats.dodgeChanceFlat || 0;
        // スモークボム等の一時的な回避率バフ（evasion_buff）。期限切れは updateBuffs() が消す
        const evasionBuff = this.activeBuffs?.['evasion_buff']?.value || 0;
        // 恒常分（AGI・装備・パッシブ）は従来どおり上限でクランプし、一時バフは上限の外に上乗せする
        // （上限に埋もれて「+30%」が効かなくならないように）。最終的な上限は80%。
        const base = Math.min(AGI_CONFIG.MAX_DODGE_CHANCE, Math.max(0, fromAgi + flat));
        return Math.min(0.8, base + evasionBuff);
    }

    // 回避判定。成功したらMISS表示を出して true を返す（ダメージ・状態異常はすべて無効）。
    tryDodge() {
        if (!this.isLocal) return false;
        if (this.isImmobilized && this.isImmobilized()) return false; // 凍結・麻痺中は避けられない
        if (Math.random() >= this.getDodgeChance()) return false;

        const miss = this.scene.add.text(this.x, this.y - 30, 'MISS', {
            fontSize: '14px', fontFamily: UI_FONT, color: '#8be9fd', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(20);
        this.scene.tweens.add({
            targets: miss, y: miss.y - 45, alpha: 0, duration: 700,
            onComplete: () => miss.destroy()
        });
        return true;
    }

    takeDamage(amount, attacker, effects = null) {
        if (this.isDead) return;
        // adminモードの無敵（敵の攻撃・接触ダメージを無効化）
        if (isAdminFlag('god')) return;

        // AGIによる回避。Player.takeDamage は敵の攻撃・接触ダメージからしか呼ばれない
        // （毒の継続ダメージは stats.hp を直接減らすので、この判定は通らず避けられない）
        if (this.tryDodge()) {
            return;
        }

        // 忍術「空蝉の術（身代わり回避）」: 攻撃を完全に身代わりで回避
        if (this.activeBuffs['utsusemi']) {
            this.activeBuffs['utsusemi'].count = (this.activeBuffs['utsusemi'].count || 1) - 1;
            if (this.activeBuffs['utsusemi'].count <= 0) {
                delete this.activeBuffs['utsusemi'];
            }
            const subText = this.scene.add.text(this.x, this.y - 30, '🪵空蝉回避!', {
                fontSize: '12px',
                color: '#a3e635',
                fontFamily: UI_FONT,
                stroke: '#000',
                strokeThickness: 2
            }).setOrigin(0.5);
            this.scene.tweens.add({
                targets: subText,
                y: this.y - 60,
                alpha: 0,
                duration: 600,
                onComplete: () => subText.destroy()
            });
            if (this.scene.add?.circle) {
                const smoke = this.scene.add.circle(this.x, this.y, 25, 0x888888, 0.6);
                this.scene.tweens.add({
                    targets: smoke,
                    scale: 2,
                    alpha: 0,
                    duration: 400,
                    onComplete: () => smoke.destroy()
                });
            }
            return;
        }

        let finalAmount = amount;

        // 防御力によるダメージ軽減（逓減方式: DEFが高いほど軽減率が上がるが0にはならない）
        const def = this.getDefense();
        if (def > 0) {
            finalAmount *= 100 / (100 + def);
        }

        // 属性耐性（装備の xxxResist）。attacker の種類から属性を判定して軽減する
        let attackerElement = resolveElement(attacker?.element) || null;
        if (attacker && attacker.type) {
            const enemyDef = getEnemyStats(attacker.type);
            if (!attackerElement) attackerElement = resolveElement(enemyDef?.element) || null;
        }
        const resist = attackerElement ? (this.stats.elementResist?.[attackerElement] || 0) : 0;
        if (resist) {
            finalAmount *= Math.max(0, 1 - resist / 100);
        }

        // 新属性システム: 敵の属性 vs 防具に付与した属性
        let affinityMult = 1.0;
        if (attackerElement && this.stats.armorElement) {
            affinityMult = getElementMultiplier(attackerElement, this.stats.armorElement);
            finalAmount *= affinityMult;
        }

        // 周回による難易度上昇: 転生回数に応じて敵から受けるダメージが増える（gameConstants.js 参照）
        finalAmount *= getRebirthDamageTakenMult(this.stats.reincarnationCount || 0);

        // 装備による被ダメージ軽減 (damageReduction)
        if (this.stats.damageReduction > 0) {
            finalAmount *= Math.max(0, 1 - this.stats.damageReduction);
        }

        // タンクスキル等によるダメージカットバフ (damage_cut_buff)
        if (this.activeBuffs['damage_cut_buff']) {
            const cutRate = Math.min(0.90, this.activeBuffs['damage_cut_buff'].value || 0.5);
            finalAmount *= Math.max(0.1, 1 - cutRate);
        }

        // メイジスキル「マナシールド」によるMP肩代わり
        if (this.activeBuffs['mana_shield'] && this.stats.mp > 0) {
            const absorbRate = this.activeBuffs['mana_shield'].value || 0.5;
            const mpAbsorbTarget = Math.round(finalAmount * absorbRate);
            const actualMpAbsorb = Math.min(this.stats.mp, mpAbsorbTarget);
            this.stats.mp -= actualMpAbsorb;
            finalAmount -= actualMpAbsorb;

            const shieldText = this.scene.add.text(this.x, this.y - 45, `🛡️MANA -${actualMpAbsorb}`, {
                fontSize: '11px',
                color: '#38bdf8',
                fontFamily: UI_FONT,
                stroke: '#000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            this.scene.tweens.add({
                targets: shieldText,
                y: this.y - 75,
                alpha: 0,
                duration: 600,
                onComplete: () => shieldText.destroy(),
            });
        }

        finalAmount = Math.max(this.stats.damageReduction >= 1 ? 0 : 1, Math.round(finalAmount));

        // スパイクガードによる自動反撃（自身のDEFに応じた反射ダメージ）
        if (this.activeBuffs['spike_guard'] && attacker && attacker.takeDamage && !attacker.isDead) {
            const reflectRatio = this.activeBuffs['spike_guard'].value || 1.2;
            const reflectDamage = Math.max(1, Math.ceil(this.getDefense() * reflectRatio));
            attacker.takeDamage(reflectDamage, this);

            // 反撃エフェクト
            const spikeText = this.scene.add.text(this.x, this.y - 45, `⚡COUNTER ${reflectDamage}`, {
                fontSize: '11px',
                color: '#facc15',
                fontFamily: UI_FONT,
                stroke: '#000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            this.scene.tweens.add({
                targets: spikeText,
                y: this.y - 75,
                alpha: 0,
                duration: 600,
                onComplete: () => spikeText.destroy(),
            });
        }

        this.stats.hp = Math.max(0, this.stats.hp - finalAmount);
        this.saveStats();

        // ダメージ数値の表示（属性があればその色、相性が良い/悪いなら背景エフェクト）
        const affinity = affinityMult > 1.0 ? 'super' : (affinityMult < 1.0 ? 'weak' : null);
        const hitColor = attackerElement ? getElementColor(attackerElement) : 0xff0000;
        showDamageNumber(this.scene, this.x, this.y, finalAmount, { color: hitColor, affinity });

        // 敵からの状態異常（凍結・麻痺・毒）を付与
        if (effects) {
            if (effects.freezeMs) this.applyStatusEffect('freeze', effects.freezeMs);
            if (effects.paralyzeMs) this.applyStatusEffect('paralyze', effects.paralyzeMs);
            if (effects.poisonMs) this.applyStatusEffect('poison', effects.poisonMs, effects.poisonTick || 0);
        }

        if (this.stats.hp <= 0) {
            this.die();
        }
    }

    /**
     * 状態異常（凍結・麻痺・毒）を付与する。凍結/麻痺は移動・攻撃・スキル使用を止める。
     * 毒は一定間隔で継続ダメージを与える。
     */
    applyStatusEffect(type, duration, tickDamage = 0) {
        if (!this.isLocal || !this.active) return;

        // 状態異常完全無効化（装備・パッシブ、または結界バフ）
        if (this.stats.statusImmunity || this.hasStatusImmunityBuff()) {
            if (this.scene.notificationUI) {
                const labels = { freeze: '❄️凍結を防いだ！', paralyze: '⚡麻痺を防いだ！', poison: '☠️毒を防いだ！' };
                this.scene.notificationUI.show(labels[type] || `${type}を防いだ！`, 'info');
            }
            return;
        }

        // 状態異常耐性値の計算 (個別耐性% + 全状態異常耐性%)
        const specificResist = this.stats.statusResist?.[type] || 0;
        const totalResist = Math.min(100, specificResist + (this.stats.allStatusResist || 0));
        const resistRate = totalResist / 100;

        // 100%以上の耐性、または確率抽選で成功した場合は無効化
        if (totalResist >= 100 || (resistRate > 0 && Math.random() < resistRate)) {
            if (this.scene.notificationUI) {
                const labels = { freeze: '❄️凍結を防いだ！', paralyze: '⚡麻痺を防いだ！', poison: '☠️毒を防いだ！' };
                this.scene.notificationUI.show(labels[type] || `${type}を防いだ！`, 'info');
            }
            return;
        }

        // 耐性がある場合は持続時間と毒ダメージを軽減
        if (resistRate > 0) {
            duration = Math.max(500, Math.round(duration * (1 - resistRate * 0.5)));
            tickDamage = Math.max(1, Math.round(tickDamage * (1 - resistRate * 0.5)));
        }

        const now = Date.now();
        this.statusEffects[type] = { endTime: now + duration, tickDamage };

        if (type === 'poison') this.lastPoisonTick = now;

        if (this.scene.notificationUI) {
            const labels = { freeze: '❄️凍結してしまった！', paralyze: '⚡麻痺してしまった！', poison: '☠️毒を受けた！' };
            this.scene.notificationUI.show(labels[type] || `状態異常: ${type}`, 'error');
        }

        if ((type === 'freeze' || type === 'paralyze') && this.setTint) {
            const tint = type === 'freeze' ? 0x99ddff : 0xffee55;
            this.setTint(tint);
        }
    }

    /**
     * 状態異常（凍結・麻痺・毒）をすべて解除する（浄化）。
     */
    cleanseStatusEffects() {
        this.statusEffects = {};
        if (this.clearTint) this.clearTint();
    }

    /**
     * 結界（status_immunity_buff）による状態異常無効が有効か
     */
    hasStatusImmunityBuff() {
        const b = this.activeBuffs?.['status_immunity_buff'];
        return !!(b && b.endTime > Date.now());
    }

    /**
     * 凍結中/麻痺中は移動・攻撃・スキル使用ができない。
     */
    isImmobilized() {
        const now = Date.now();
        const freeze = this.statusEffects.freeze;
        const paralyze = this.statusEffects.paralyze;
        return !!(freeze && now < freeze.endTime) || !!(paralyze && now < paralyze.endTime);
    }

    /**
     * 状態異常の期限切れ処理と、毒の継続ダメージのtickを進める。update()から毎フレーム呼ぶ。
     */
    updateStatusEffects(now) {
        let anyExpired = false;
        Object.keys(this.statusEffects).forEach((type) => {
            if (this.statusEffects[type].endTime <= now) {
                delete this.statusEffects[type];
                anyExpired = true;
            }
        });
        if (anyExpired && !this.statusEffects.freeze && !this.statusEffects.paralyze && this.clearTint) {
            this.clearTint();
        }

        const poison = this.statusEffects.poison;
        if (poison && poison.tickDamage > 0 && now - this.lastPoisonTick >= POISON_TICK_INTERVAL_MS) {
            this.lastPoisonTick = now;
            this.stats.hp = Math.max(0, this.stats.hp - poison.tickDamage);
            this.saveStats();

            const text = this.scene.add.text(this.x, this.y - 20, `-${poison.tickDamage}`, {
                fontSize: '14px', color: '#aa66ff', fontFamily: UI_FONT, stroke: '#000', strokeThickness: 2
            }).setOrigin(0.5);
            this.scene.tweens.add({ targets: text, y: this.y - 55, alpha: 0, duration: 700, onComplete: () => text.destroy() });

            if (this.stats.hp <= 0) this.die();
        }
    }

    die() {
        if (this.isDead) return;
        // adminモードの無敵中は、毒などで0になっても死なない
        if (isAdminFlag('god')) {
            this.stats.hp = this.stats.maxHp;
            return;
        }

        // 復活の秘巻物などのチャージがあれば、ペナルティなしでその場復活する
        if (this.stats.reviveCharges > 0) {
            this.stats.reviveCharges -= 1;
            this.stats.hp = this.stats.maxHp;
            this.stats.mp = this.stats.maxMp;
            this.saveStats();
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('復活の秘巻物の力で蘇った！', 'warning');
            }
            return;
        }

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show('力尽きました...', 'error');
        }

        // 死亡ペナルティ: 所持金の10%を失う
        if (this.stats.gold > 0) {
            const lostGold = Math.ceil(this.stats.gold * 0.1);
            this.stats.gold -= lostGold;
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`所持金を ${lostGold}G 失った...`, 'error');
            }
        }

        this.isDead = true;
        this.body?.setVelocity(0, 0);
        this.saveStats();
        flushSave(true);
        this.scene.deathUI?.show();
    }

    respawn() {
        if (!this.isDead) return;
        this.isDead = false;
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;
        this.statusEffects = {};
        this.clearTint?.();
        this.saveStats();
        flushSave(true);
        this.scene.deathUI?.hide();
        // Use the map's normal spawn path so respawn never places the player inside terrain.
        this.scene.scene.restart({ mapKey: this.scene.currentMapKey });
    }

    setStats(hp, maxHp, level, mp, maxMp) {
        if (hp !== undefined) this.stats.hp = hp;
        if (maxHp !== undefined) this.stats.maxHp = maxHp;
        if (level !== undefined) this.stats.level = level;
        if (mp !== undefined) this.stats.mp = mp;
        if (maxMp !== undefined) this.stats.maxMp = maxMp;

        // 名前表示UIの更新
        if (this.nameUI) {
            this.nameUI.updateLevel(this.stats.level);
        }
    }


    setPosition(x, y) {
        if (!this.isLocal) {
            // 他プレイヤーの位置補間用
            this.targetX = x;
            this.targetY = y;
        } else {
            // ローカルプレイヤーは単純に座標更新
            super.setPosition(x, y);
        }
    }


    moveTo(x, y) {
        if (!this.isLocal) return;
        this.moveTarget = { x, y };
    }

    update(cursors) {
        // Y座標で前後関係を決めることで、木・建物・他プレイヤーの前後を自然に見せる。
        this.setDepth(this.y);
        if (this.isDead) {
            this.body?.setVelocity(0, 0);
            return;
        }
        if (this.isLocal && cursors) { // Keep cursors check here
            const now = this.scene.time.now;
            const body = this.body;
            if (!body) return;

            // 凍結・麻痺中の状態異常を進行させる（期限切れ処理・毒tick）
            this.updateStatusEffects(Date.now());

            // 凍結/麻痺中は移動できない
            if (this.isImmobilized()) {
                this.moveTarget = null;
                body.setVelocity(0, 0);
                this.anims.play('idle', true);
                return;
            }

            // キー入力を優先
            let isMovingByKey = cursors.left.isDown || cursors.right.isDown || cursors.up.isDown || cursors.down.isDown;

            if (isMovingByKey) {
                this.moveTarget = null; // キー入力があったら自動移動解除
                body.setVelocity(0, 0);
                if (cursors.left.isDown) { body.setVelocityX(-this.speed); this.flipX = false; this.facingDirection = -1; this.anims.play('walk-left', true); }
                else if (cursors.right.isDown) { body.setVelocityX(this.speed); this.flipX = false; this.facingDirection = 1; this.anims.play('walk-right', true); }

                if (cursors.up.isDown) body.setVelocityY(-this.speed);
                else if (cursors.down.isDown) body.setVelocityY(this.speed);

                // 押しているキーの合成方向を向きベクトルにする（縦だけ・斜めも含む）
                const ix = cursors.left.isDown ? -1 : (cursors.right.isDown ? 1 : 0);
                const iy = cursors.up.isDown ? -1 : (cursors.down.isDown ? 1 : 0);
                const il = Math.hypot(ix, iy);
                if (il > 0) this.facingVec = { x: ix / il, y: iy / il };
            } else if (this.moveTarget) {
                // 自動移動 (moveTo)
                const distance = Phaser.Math.Distance.Between(this.x, this.y, this.moveTarget.x, this.moveTarget.y);

                if (distance < 5) {
                    this.moveTarget = null;
                    body.setVelocity(0, 0);
                    this.anims.play('idle', true);
                } else {
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.moveTarget.x, this.moveTarget.y);
                    const vx = Math.cos(angle) * this.speed;
                    const vy = Math.sin(angle) * this.speed;

                    body.setVelocity(vx, vy);
                    this.facingVec = { x: Math.cos(angle), y: Math.sin(angle) };

                    // アニメーション向き
                    if (Math.abs(vx) > Math.abs(vy)) {
                        this.flipX = false;
                        this.facingDirection = vx > 0 ? 1 : -1;
                        this.anims.play(vx > 0 ? 'walk-right' : 'walk-left', true);
                    } else if (vy < 0) {
                        this.anims.play('walk-up', true); // walk-up があれば
                    } else {
                        this.anims.play('walk-down', true); // walk-down があれば
                    }
                    if (!this.anims.exists('walk-up')) {
                        this.flipX = false;
                        this.facingDirection = vx > 0 ? 1 : -1;
                        this.anims.play(vx > 0 ? 'walk-right' : 'walk-left', true);
                    }
                }
            } else {
                body.setVelocity(0, 0);
                this.anims.play('idle', true);
            }

            // 自然回復 (2秒ごとにHP 1%, MP 2回復)
            if (this.isLocal && this.active && !this.stats.dead) {
                if (!this.lastRegenTime || now - this.lastRegenTime > 2000) {
                    if (this.stats.poisonEquipped) {
                        // 呪いの装備による継続ダメージ（最大HPの2%、HP1以下にはならない）
                        this.stats.hp = Math.max(1, this.stats.hp - Math.ceil(this.stats.maxHp * 0.02));
                    } else if (this.stats.hp < this.stats.maxHp) {
                        // HP回復
                        this.stats.hp = Math.min(this.stats.hp + Math.ceil(this.stats.maxHp * 0.01), this.stats.maxHp);
                    }
                    // MP回復 (召喚獣が1体でもいる場合は回復しない)
                    const hasSummon = (this.scene.activeSummons || []).some(s => s && s.active);
                    if (!hasSummon && this.stats.mp < this.stats.maxMp) {
                        // MP自然回復は最大MPの1%（最低2）。固定2だと、高レベルでMPが数百あっても全く回復しなかった
                        this.stats.mp = Math.min(this.stats.mp + Math.max(2, Math.ceil(this.stats.maxMp * 0.01)), this.stats.maxMp);
                    }

                    this.lastRegenTime = now;
                    this.saveStats();
                }
            }
            const distance = Phaser.Math.Distance.Between(this.lastPositionSent.x, this.lastPositionSent.y, this.x, this.y);
            if (distance > 5 || (now - this.lastUpdateTime) > this.positionUpdateInterval) {
                if (this.socket) {
                    this.socket.emit('playerMove', { x: this.x, y: this.y });
                    this.lastPositionSent = { x: this.x, y: this.y };
                    this.lastUpdateTime = now;
                }
            }
        }
    }

    updateRemotePosition() {
        if (!this.isLocal && this.targetX !== undefined && this.targetY !== undefined) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            if (Math.abs(dx) > 50 || Math.abs(dy) > 50) super.setPosition(this.targetX, this.targetY);
            else { this.x += dx * this.lerpSpeed; this.y += dy * this.lerpSpeed; }

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                const rl = Math.hypot(dx, dy);
                this.facingVec = { x: dx / rl, y: dy / rl };
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.flipX = false;
                    this.facingDirection = dx > 0 ? 1 : -1;
                    this.anims.play(dx > 0 ? 'walk-right' : 'walk-left', true);
                } else this.anims.play('idle', true);
            } else this.anims.play('idle', true);
        }
    }
}
