import { JOBS } from "../data/jobs.js";
import { ITEMS } from "../data/items.js";
import { SKILLS } from "../data/skills.js";
import { getEnemyStats } from "../data/enemyStats.js";
import { getLevelDiffMultiplier, getExpLevelMultiplier } from "../utils/levelScaling.js";
import { TOTAL_SKILL_SLOTS, GROWTH_CONFIG, COMBAT_CONFIG } from "../gameConstants.js";
import {
    ELEMENTS, getElementMultiplier, getBlendedElementMultiplier, getElementColor,
    getWeaponElementBonus, resolveElement, resistKey, damageKey, collectElementStats,
} from "../data/elements.js";
import { showDamageNumber } from "../utils/damagePopup.js";

// 状態異常の基本持続時間（ms）。武器の属性付与などから発生する。
const STATUS_DURATIONS = {
    freeze: 3000,
    paralyze: 2500,
};
const POISON_TICK_INTERVAL_MS = 1000;

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
        const saved = JSON.parse(localStorage.getItem('playerStats')) || this.scene.registry.get('playerStats') || {};
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
            dex: saved.dex || 5,  // Dexterity - クリティカル率・回避率に影響
            job: saved.job || 'none',
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

        this.applyEquipmentStats(); // 装備中のステータスを反映

        // インベントリのマイグレーション (文字列配列 -> オブジェクト配列)
        if (this.stats.inventory.length > 0 && typeof this.stats.inventory[0] === 'string') {
            this.stats.inventory = this.stats.inventory.map(id => ({ id, count: 1 }));
        }

        this.saveStats();
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

        // 前の職業のスキル構成が持ち越されないようにリセット
        this.stats.activeSkills = new Array(TOTAL_SKILL_SLOTS).fill(null);
        this.skillCooldowns = {};

        this.applyEquipmentStats(); // ボーナスを含めて再計算
        this.stats.hp = this.stats.maxHp;
        this.stats.mp = this.stats.maxMp;

        this.saveStats();

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`ジョブを${newJob.name}に変更しました！`, 'success');
        }
    }

    promoteJob(newJobId) {
        if (!this.isLocal || !JOBS[newJobId]) return false;
        const currentJobData = JOBS[this.stats.job];
        const newJobData = JOBS[newJobId];

        // 条件チェック
        if (this.stats.level < (newJobData.reqLevel || 50)) {
            if (this.scene.notificationUI) this.scene.notificationUI.show(`レベルが ${newJobData.reqLevel || 50} 足りません！`, 'error');
            return false;
        }

        if (currentJobData.nextJob !== newJobId) {
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
        localStorage.setItem('playerStats', JSON.stringify(this.stats));

        if (this.scene.networkManager) {
            this.scene.networkManager.sendPlayerStats(this.stats.hp, this.stats.maxHp, this.stats.level, this.stats.mp, this.stats.maxMp);
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

        const finalAmount = Math.ceil(amount * expMult * levelPenalty);

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

        // スキル解放済みチェック
        if (skillId && !this.stats.unlockedSkills.includes(skillId)) return;

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

            // 攻撃力・防御力 (関数なら実行、そうでなければ加算)
            const getVal = (val) => (typeof val === 'function' ? val(this) : (val || 0));

            // 魔法職は matk (魔法攻撃力) を優先して攻撃力に反映する
            const atkSource = isMagical ? (item.matk ?? s.matk ?? item.atk ?? s.attack) : (item.atk ?? s.attack);
            this.stats.atk += getVal(atkSource);
            this.stats.def += getVal(item.def || s.defense);

            // 特殊ステータス
            this.stats.critChance += getVal(item.critChance || s.critChance);
            this.stats.lifesteal += getVal(item.lifesteal || s.lifesteal);
            this.stats.speedBonus += getVal(item.speedBonus || s.speedBonus);

            // 属性・特殊効果
            // xxxResist / xxxDamage（xxxは属性id。旧名 ice も水として集計）。値が関数の項目にも対応
            [[resistKey, this.stats.elementResist], [damageKey, this.stats.elementDamage]].forEach(([keyFn, target]) => {
                const resolved = {};
                Object.keys(s).forEach((k) => { resolved[k] = getVal(s[k]); });
                Object.entries(collectElementStats(resolved, keyFn)).forEach(([el, v]) => {
                    target[el] = (target[el] || 0) + v;
                });
            });
            this.stats.freezeChance += getVal(s.freezeChance);
            this.stats.deathChance += getVal(s.deathChance);
            this.stats.paralyzeChance += getVal(s.paralyzeChance);
            this.stats.poisonChance += getVal(s.poisonChance);
            this.stats.poisonDamage += getVal(s.poisonDamage);
            if (s.attackMultiplier) this.stats.atkMultiplier *= s.attackMultiplier;
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
        const isCrit = Math.random() < (this.stats.critChance || 0);
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

        // レベル制限チェック
        if (item.lvlReq && this.stats.level < item.lvlReq) {
            if (this.scene.notificationUI) {
                this.scene.notificationUI.show(`レベルが足りません！ (必要Lv.${item.lvlReq})`, 'error');
            }
            return;
        }

        if (item.type === 'weapon') {
            this.stats.equipment.weapon = itemId;
        } else if (item.type === 'armor') {
            this.stats.equipment.armor = itemId;
        } else if (item.type === 'accessory') {
            this.stats.equipment.relic = itemId;
        }

        this.applyEquipmentStats(); // すべてのステータスを再計算

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${item.name} を装備しました！`, 'info');

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
    }

    /**
     * 各種報酬を一括で付与する（拡張性）
     * @param {Object} reward 報酬オブジェクト { exp, gold, item, ... }
     */
    addReward(reward) {
        if (!this.isLocal || !reward) return;

        if (reward.exp) this.gainExp(reward.exp);
        if (reward.gold) this.gainGold(reward.gold);

        // 将来的にアイテムなどもここに追加可能
        if (reward.item) {
            this.addItem(reward.item);
        }
    }

    levelUp() {
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

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`レベルアップ！ Level ${this.stats.level} (${statMsg}, Pt+5)`, 'warning');
        }

        // 各種UIを更新
        if (this.scene.playerStatsUI) {
            this.scene.playerStatsUI.update();
        }
        if (this.scene.playerNameUI) {
            this.scene.playerNameUI.updateLevel(this.stats.level);
        }

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
     * ステータスポイントを割り振る
     * @param {string} stat - 'str', 'int', 'vit', 'men', 'dex'
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

        const validStats = ['str', 'int', 'vit', 'men', 'dex'];
        if (!validStats.includes(stat)) {
            return false;
        }

        this.stats.statPoints -= points;
        this.stats[stat] += points;

        // 派生ステータスを再計算
        this.applyEquipmentStats();
        this.saveStats();

        const statNames = {
            str: 'STR (攻撃力)',
            int: 'INT (魔法)',
            vit: 'VIT (HP)',
            men: 'MEN (MP)',
            dex: 'DEX (クリティカル/速度)'
        };

        if (this.scene.notificationUI) {
            this.scene.notificationUI.show(`${statNames[stat]}に${points}ポイント割り振りました`, 'success');
        }
        return true;
    }

    takeDamage(amount, attacker, effects = null) {
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

        // とりあえず初期位置にリセット
        this.stats.hp = this.stats.maxHp;
        this.saveStats();

        // マップの初期位置へ
        this.scene.scene.restart();
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
                        this.stats.mp = Math.min(this.stats.mp + 2, this.stats.maxMp);
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
