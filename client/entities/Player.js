import { JOBS } from "../data/jobs.js";
import { ITEMS } from "../data/items.js";
import { SKILLS } from "../data/skills.js";
import { getEnemyStats } from "../data/enemyStats.js";
import { getLevelDiffMultiplier, getExpLevelMultiplier } from "../utils/levelScaling.js";
import { TOTAL_SKILL_SLOTS, GROWTH_CONFIG, COMBAT_CONFIG, REINCARNATION_CONFIG, AGI_CONFIG, RESET_CONFIG, getRebirthDamageTakenMult, getRebirthRewardMult } from "../gameConstants.js";
import {
    ELEMENTS, getElementMultiplier, getBlendedElementMultiplier, getElementColor,
    getWeaponElementBonus, resolveElement, resistKey, damageKey, collectElementStats,
} from "../data/elements.js";
import { showDamageNumber } from "../utils/damagePopup.js";
import { isAdminFlag } from "../ui/AdminUI.js";
import { getSaved, setSaved, flushSave } from "../utils/saveStore.js";

// 状態異常の基本持続時間（ms）。武器の属性付与などから発生する。
const STATUS_DURATIONS = {
    freeze: 3000,
    paralyze: 2500,
};
const POISON_TICK_INTERVAL_MS = 1000;

const WEAPON_CLASS_LABELS = {
    oneHandSword: '片手剣', twoHandSword: '両手剣', spear: '槍',
    staff: '杖', wand: 'ワンド', tome: '魔導書', bow: '弓', mace: 'メイス'
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
            speedBonus: saved.speedBonus || 0,
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
            // 鍛冶屋で武器/防具(アイテムID)に付与した属性。 { itemId: 'fire' | 'water' | ... }
            // 存在しない属性の付与（属性定義の変更前のデータなど）は破棄する
            itemElements: Object.fromEntries(
                Object.entries(saved.itemElements || {}).filter(([, el]) => ELEMENTS.includes(el))
            ),
            // relic (宝具) を新規追加。 ...(saved.equipment || {}) を後に展開することで、
            // 旧セーブデータ（relicキーが無い）でも weapon/armor はそのまま引き継ぎつつ
            // relic だけ null で補える。
            equipment: { weapon: null, armor: null, relic: null, ...(saved.equipment || {}) },
            jobExp: saved.jobExp || 0,
            unlockedSkills: saved.unlockedSkills || [],
            skillLevels: saved.skillLevels || {}, // { skillId: level }
            // スロット数を3→8に拡張。古いセーブデータ(3枠)も足りない分をnullで埋めて引き継ぐ
            activeSkills: this.padActiveSkills(saved.activeSkills)
        };

        // ステータスポイントで割り振った分の記録（ステータスリセットの書で返還するために使う）。
        // この項目が無い古いセーブデータは、レベル・職業タイプ・転生回数から自然成長分を差し引いた推定値で初期化する。
        this.stats.allocatedStats = this.sanitizeAllocatedStats(saved.allocatedStats) || this.estimateAllocatedStats();

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
        // 以前は activeSkills（スキルバーの装備枠）だけをリセットしており、
        // unlockedSkills/skillLevels は残ったままだったため、転職後も
        // スキルマネージャーから前の職業のスキルをそのまま再装備できてしまっていた
        // （SkillManagerUI側で「系譜外だが既に習得しているスキル」として一覧に出ていたバグ）。
        // ここで確実に習得済みスキルごと破棄する。
        //
        // 例外: 輪廻転生（reincarnate()）の直後だけは、_skipSkillResetOnNextJob フラグにより
        // このリセットをスキップし、習得済みスキルを持ち越せるようにする。
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        const keepSkills = !!this.stats._skipSkillResetOnNextJob;
        if (!keepSkills) {
            this.stats.unlockedSkills = [];
            this.stats.skillLevels = {};
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

        // 割り振り済みポイントの返還量は、レベル・転生回数を変える前の状態で求める
        const alloc = this.stats.allocatedStats || this.estimateAllocatedStats();

        // 自然成長分（レベルアップで自動的に増えた分）の合計を求める。
        //   自然成長 = 現在値 - 初期値 - これまでの転生ボーナス - ポイントで割り振った分
        // 合計の NATURAL_GROWTH_REFUND_RATE（10分の1）をポイントに換算し、残りは捨てる。
        const prevReinBonus = (this.stats.reincarnationCount || 0) * REINCARNATION_CONFIG.BASE_STAT_BONUS;
        const naturalTotal = RESET_CONFIG.STAT_KEYS.reduce((sum, k) => {
            const base = (k === 'agi') ? AGI_CONFIG.BASE_AGI : RESET_CONFIG.BASE_VALUE;
            return sum + Math.max(0, (this.stats[k] || 0) - base - prevReinBonus - (alloc[k] || 0));
        }, 0);
        const naturalRefund = Math.floor(naturalTotal * REINCARNATION_CONFIG.NATURAL_GROWTH_REFUND_RATE);

        this.stats.reincarnationCount = (this.stats.reincarnationCount || 0) + 1;

        // レベル・経験値をリセット
        this.stats.level = 1;
        this.stats.exp = 0;
        this.stats.maxExp = calcMaxExp(1);

        // 職業を選び直せるようにする。次に setJob() が呼ばれたときだけ
        // 習得済みスキルのリセットをスキップさせるフラグを立てておく。
        this.stats.job = 'none';
        this.stats._skipSkillResetOnNextJob = true;
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        this.skillCooldowns = {};
        // unlockedSkills / skillLevels はそのまま維持する（通常の転職との最大の違い）

        // 装備を全て外す（アイテムはインベントリに残る）。
        // 以前は装備したままLv1に戻るため、Lv制限のある装備をLv1で着けたままになっていた。
        this.stats.equipment = { weapon: null, armor: null, relic: null };

        // ステータスのリセットとポイント換算:
        //  1. ポイントで割り振っていた分は、ステータスポイントとして全額返還する
        //  2. 基礎ステータスは「初期値 + 転生ボーナス × 転生回数」に作り直す
        //     （Lv100までの自然成長分は、合計の10分の1だけポイントに換算し、残りは捨てる）
        //  3. そのうえで、転生1回ごとのボーナスポイントを加算する
        // 未使用のステータスポイントや、種アイテムの永続加算（bonusAtk/bonusDef）はそのまま残る。
        const refunded = RESET_CONFIG.STAT_KEYS.reduce((sum, k) => sum + Math.max(0, alloc[k] || 0), 0);
        const reinBonus = this.stats.reincarnationCount * REINCARNATION_CONFIG.BASE_STAT_BONUS;
        RESET_CONFIG.STAT_KEYS.forEach(k => {
            const base = (k === 'agi') ? AGI_CONFIG.BASE_AGI : RESET_CONFIG.BASE_VALUE;
            this.stats[k] = base + reinBonus;
        });
        this.stats.allocatedStats = this.sanitizeAllocatedStats({});
        this.stats.statPoints += refunded + naturalRefund + REINCARNATION_CONFIG.BONUS_STAT_POINTS;

        this.applyEquipmentStats();
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;
        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(
                `輪廻転生した！(${this.stats.reincarnationCount}回目) 装備を外し、割り振り済み${refunded}pt+自然成長分${naturalRefund}ptを返還。基礎ステータスが強化され、Lv1から再スタート！`,
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

        if (this.stats.level >= 100) {
            // レベルキャップ到達後も、敵を倒せば Job EXP は貯まる。
            // （以前は何も増えず、スキルレベル上げ・スキル解放の育成が止まって「やることが無い」状態だった）
            const jobGain = Math.ceil(finalAmount * GROWTH_CONFIG.JOB_EXP_RATE);
            this.stats.jobExp = (this.stats.jobExp || 0) + jobGain;
            this.saveStats();
            if (this.scene.playerStatsUI) this.scene.playerStatsUI.update();
            if (this.scene.notificationUI) this.scene.notificationUI.show(`JOB EXP +${jobGain}`, 'info');
            return;
        }

        if (this.stats.level < 100) { // レベルキャップ
            this.stats.exp += finalAmount;

            // ジョブ経験値も獲得（簡単に貯まりすぎないよう、通常経験値の一部だけ加算する）
            this.stats.jobExp = (this.stats.jobExp || 0) + Math.ceil(finalAmount * GROWTH_CONFIG.JOB_EXP_RATE);

            let leveledUp = false;
            // 複数レベルアップに対応 & 経験値を消費するように修正
            while (this.stats.exp >= this.stats.maxExp && this.stats.level < 100) {
                this.stats.exp -= this.stats.maxExp;
                this.levelUp();
                leveledUp = true;
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
        amount = Math.ceil(amount * getRebirthRewardMult(this.stats.reincarnationCount || 0)); // 周回ボーナス
        this.stats.gold += amount;
        this.saveStats();
        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`GOLD +${amount}`, 'warning');
        }
    }

    addItem(itemId, amount = 1) {
        if (!this.isLocal || !ITEMS[itemId]) return;
        const itemDef = ITEMS[itemId];

        // 武器と防具以外はスタック可能
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
            // スタック不可アイテムは個別に追記
            for (let i = 0; i < amount; i++) {
                this.stats.inventory.push({ id: itemId, count: 1 });
            }
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`アイテム入手: ${itemDef.name}${expTag}`, 'success');
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

    levelUpSkill(skillId) {
        if (!this.isLocal) return false;
        if (!this.stats.unlockedSkills.includes(skillId)) return false;

        const currentLevel = this.stats.skillLevels[skillId] || 1;
        if (currentLevel >= 10) {
            if (this.scene.notificationUI) this.scene.notificationUI.show('スキルレベルが最大です(Lv.10)', 'error');
            return false;
        }

        const skillDef = SKILLS[skillId];
        // コスト大幅引き上げ: (現在レベル * 100) Job Exp
        const cost = (currentLevel + 1) * 100;

        if (this.stats.jobExp < cost) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`Job EXPが足りません (必要: ${cost})`, 'error');
            return false;
        }

        this.stats.jobExp -= cost;
        this.stats.skillLevels[skillId] = currentLevel + 1;
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

            if (e.atkMult) this.stats.atk = Math.ceil(this.stats.atk * e.atkMult);
            if (e.defMult) this.stats.def = Math.ceil(this.stats.def * e.defMult);
            if (e.maxHpMult) this.stats.maxHp = Math.ceil(this.stats.maxHp * e.maxHpMult);
            if (e.maxHpFlat) this.stats.maxHp += e.maxHpFlat;
            if (e.maxMpFlat) this.stats.maxMp += e.maxMpFlat;
            if (e.maxMpMult) this.stats.maxMp = Math.ceil(this.stats.maxMp * e.maxMpMult);
            if (e.speedFlat) passiveSpeedBonus += e.speedFlat;
            if (e.critChanceFlat) passiveCritBonus += e.critChanceFlat;
            if (e.lifestealFlat) passiveLifestealBonus += e.lifestealFlat;
            if (e.dodgeChanceFlat) passiveDodgeBonus += e.dodgeChanceFlat;
            if (e.expMultBonus) this.stats.expMultiplier += e.expMultBonus;
            if (e.cooldownMult) this.stats.cooldownMult *= e.cooldownMult;
            if (e.mpCostMult) this.stats.mpCostMult *= e.mpCostMult;
            if (e.healPowerMult) this.stats.healPowerMult *= e.healPowerMult;
            if (e.maxSummonsFlat) this.stats.maxSummons += e.maxSummonsFlat;
        });

        // 特殊ステータスの基礎値
        this.stats.critChance = (dex * 0.01) + passiveCritBonus;
        this.stats.lifesteal = passiveLifestealBonus;
        this.stats.speedBonus = (dex * 2) + passiveSpeedBonus;

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

            // 特殊ステータス
            this.stats.critChance += getRate(item.critChance || s.critChance);
            this.stats.lifesteal += getRate(item.lifesteal || s.lifesteal);
            this.stats.speedBonus += getInt(item.speedBonus || s.speedBonus);
            this.stats.dodgeChanceFlat += getRate(item.dodgeChance || s.dodgeChance);

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
            if (s.attackMultiplier) {
                const m = 1 + ((s.attackMultiplier - 1) * power);
                this.stats.atkMultiplier *= (power < 1 ? Math.round(m * 100) / 100 : m);
            }
            if (s.poison) this.stats.poisonEquipped = true;

            // 経験値倍率は加算方式
            if (item.expMultiplier) this.stats.expMultiplier += (item.expMultiplier - 1.0);
            if (s.expMultiplier) this.stats.expMultiplier += (getVal(s.expMultiplier) - 1.0);
        });

        // 鍛冶屋で付与した属性（武器/防具のアイテムIDに紐づく）
        this.stats.weaponElement = this.stats.itemElements?.[this.stats.equipment.weapon] || null;
        this.stats.armorElement = this.stats.itemElements?.[this.stats.equipment.armor] || null;

        // 武器の属性ごとの追加効果（凍結/麻痺/毒など）。効果の中身は data/elements.js の weaponBonus で定義
        Object.entries(getWeaponElementBonus(this.stats.weaponElement, this.stats.atk)).forEach(([key, value]) => {
            this.stats[key] = (this.stats[key] || 0) + value;
        });

        // ここまでで武器/防具/宝具による補正が乗った後の値なので、装備前との差分を
        // 「装備補正値」として保持する（UI表示用。種による永続加算はここに含めない）。
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

        this.speed = 150 + this.stats.speedBonus;

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
            amount = Math.ceil(amount * COMBAT_CONFIG.CRIT_MULTIPLIER);
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
        const targetDef = target ? (target.def ?? target.stats?.def ?? 0) : 0;
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

        return {
            amount, isCrit, isExecute, isFreeze, isParalyze, isPoison, poisonTick,
            isElementAdvantage, isElementWeak, element: attackElement,
        };
    }

    /**
     * バフを適用
     */
    applyBuff(buffType, value, duration) {
        const now = Date.now();
        this.activeBuffs[buffType] = {
            value: value,
            endTime: now + duration
        };

        // バフに応じてステータスを更新
        if (buffType === 'speed_buff') {
            this.speed = 150 + this.stats.speedBonus + value;
        } else if (buffType === 'defense_buff') {
            // 防御力バフは getDamage 相当のメソッドで参照
        }
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
            this.speed = 150 + this.stats.speedBonus;
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

    equipItem(itemId) {
        if (!this.isLocal || !ITEMS[itemId]) return;
        const item = ITEMS[itemId];

        if (item.type === 'weapon' && item.weaponClass && !this.canEquipWeapon(item.weaponClass)) {
            const label = WEAPON_CLASS_LABELS[item.weaponClass] || item.weaponClass;
            this.scene.notificationUI?.show(`${getJobWeaponLabel(this.stats.job)}は${label}を装備できません`, 'error');
            return false;
        }

        // レベル不足でも装備は可能。ただし制限解除の証がない限り、性能はレベル差に応じて低下する。

        if (item.type === 'weapon') {
            this.stats.equipment.weapon = itemId;
        } else if (item.type === 'armor') {
            this.stats.equipment.armor = itemId;
        } else if (item.type === 'accessory') {
            this.stats.equipment.relic = itemId;
        }

        this.applyEquipmentStats(); // すべてのステータスを再計算

        if (this.scene.notificationUI) {
            const power = this.getEquipmentPowerMultiplier(item);
            const suffix = power < 1 ? `（性能 ${Math.round(power * 100)}%）` : '';
            this.scene.notificationUI.show(`${item.name} を装備しました！${suffix}`, 'info');

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
        if (['ranger', 'sniper', 'wind_archer'].includes(job)) return weaponClass === 'bow';
        if (['tank', 'paladin', 'warden', 'juggernaut'].includes(job)) return ['oneHandSword', 'mace'].includes(weaponClass);
        if (JOBS[job]?.type === 'magical') return ['staff', 'wand', 'tome'].includes(weaponClass);
        return ['oneHandSword', 'twoHandSword', 'spear'].includes(weaponClass);
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
        const goal = Math.min(100, Math.floor(target));
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
     * ステータスポイントを割り振る
     * @param {string} stat - 'str', 'int', 'vit', 'men', 'dex', 'agi'
     * @param {number} points - 割り振るポイント数
     */
    allocateStatPoint(stat, points = 1) {
        if (!this.isLocal) return false;
        if (this.stats.statPoints < points) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show('ステータスポイントが足りません', 'error');
            }
            return false;
        }

        const validStats = RESET_CONFIG.STAT_KEYS;
        if (!validStats.includes(stat)) {
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
     * 習得スキル・スキルレベル・装備スロットのスキルはリセットされる（通常の転職と同じ扱い）。
     * レベルとステータスはそのまま。
     */
    resetJob() {
        if (!this.isLocal) return false;
        if (this.stats.job === 'none') return false;

        this.stats.job = 'none';
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        this.stats.unlockedSkills = [];
        this.stats.skillLevels = {};
        this.stats.jobExp = 0;
        this.stats._skipSkillResetOnNextJob = false;
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
        return Math.min(AGI_CONFIG.MAX_DODGE_CHANCE, Math.max(0, fromAgi + flat));
    }

    // 回避判定。成功したらMISS表示を出して true を返す（ダメージ・状態異常はすべて無効）。
    tryDodge() {
        if (!this.isLocal) return false;
        if (this.isImmobilized && this.isImmobilized()) return false; // 凍結・麻痺中は避けられない
        if (Math.random() >= this.getDodgeChance()) return false;

        const miss = this.scene.add.text(this.x, this.y - 30, 'MISS', {
            fontSize: '14px', fontFamily: '"Press Start 2P"', color: '#8be9fd', stroke: '#000', strokeThickness: 3
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

        finalAmount = Math.max(1, Math.round(finalAmount));

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
                fontSize: '14px', color: '#aa66ff', fontFamily: 'Press Start 2P', stroke: '#000', strokeThickness: 2
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
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.flipX = false;
                    this.facingDirection = dx > 0 ? 1 : -1;
                    this.anims.play(dx > 0 ? 'walk-right' : 'walk-left', true);
                } else this.anims.play('idle', true);
            } else this.anims.play('idle', true);
        }
    }
}
