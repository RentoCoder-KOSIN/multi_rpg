// チュートリアルの手順（ui/TutorialGuideUI.js が順番に案内する）。
//
// 手順を増やす/直すときは、この配列を編集するだけでよい。
//   id    : 一意な名前
//   short : チェックリストに並べる短い名前
//   key   : 画面に出す操作キー（無ければ省略）
//   title : 手順の見出し
//   body  : 詳しい説明（\n で改行。1行はおよそ全角23文字以内に収めると収まりが良い）
//   done  : (ctx) => boolean  達成判定。毎回「今の状態」から判断するので、セーブを読み込んだ後も正しく動く。
//           ctx = { player, stats, flags, qm }   flags は TutorialGuideUI が記録する操作フラグ（セーブに保存される）
//
// ※ 操作に自信が無い人（スマホ等でキー操作が記録されない場合）が詰まらないよう、
//    done には「別の形で達成していれば完了扱い」の条件も入れてある。

const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);
const killedSlimes = (ctx) => ctx.qm?.isCompleted('kill_slime') || ctx.qm?.isFinished('kill_slime');

export const TUTORIAL_STEPS = [
    {
        id: 'job',
        short: '職業',
        key: 'C',
        title: '職業を選ぼう',
        body:
            '職業管理人に近づいて [C] で話しかけよう。\n' +
            '戦士・魔法使い・タンク・弓使い・召喚士・僧侶の6職。\n' +
            '物理職はSTR、魔法職はINTで攻撃力が伸びる。\n' +
            '決定でSP5・Job EXP300・火の玉・初期武器がもらえる。\n' +
            '※Lv10まではここで何度でも選び直せる。',
        done: (c) => c.stats.job && c.stats.job !== 'none',
    },
    {
        id: 'move',
        short: '移動',
        key: '矢印キー',
        title: '歩いてみよう',
        body:
            '矢印キーで移動（スマホは画面をタップ）。\n' +
            '足元の金色の矢印は「次の目的」、\n' +
            '水色の矢印は「次に行ける転移先」を指している。\n' +
            '迷ったら矢印に従えば進める。ミニマップも見てみよう。',
        done: (c) => c.flags.moved || c.stats.level > 1,
    },
    {
        id: 'attack',
        short: '攻撃',
        key: 'Space',
        title: '攻撃してみよう',
        body:
            'スペースを「押している間」は攻撃範囲が表示される。\n' +
            '離すと攻撃！ 敵に向けて試そう。\n' +
            '通常攻撃はMPを使わない。基本はこれで戦う。\n' +
            '敵の頭上のHPバーが減るのを確認しよう。',
        done: (c) => c.flags.attacked || c.stats.level > 1 || killedSlimes(c),
    },
    {
        id: 'stats',
        short: '能力値',
        key: 'P',
        title: '能力値を割り振ろう',
        body:
            'レベルアップごとにSPが5もらえる。[P]で割り振り画面。\n' +
            'STR:物理攻撃 INT:魔法攻撃 VIT:HPと防御\n' +
            'MEN:MP DEX:会心と速度 AGI:回避(最大45%)\n' +
            '迷ったら「メインの攻撃ステ＋VIT」が安定。\n' +
            '※割り振りはリセットの書でやり直せる。',
        done: (c) => sum(c.stats.allocatedStats) > 0,
    },
    {
        id: 'skill',
        short: 'スキル',
        key: 'K',
        title: 'スキルを覚えてセット',
        body:
            '[K]でスキル画面。Job EXPを使ってスキルを解放できる。\n' +
            'Job EXPは敵を倒すと少しずつ貯まる（経験値の15%）。\n' +
            '解放したスキルは1〜8の枠にセットして使う。\n' +
            'まず攻撃スキルを1つセットしてみよう。',
        done: (c) => (c.stats.activeSkills || []).some(Boolean),
    },
    {
        id: 'useSkill',
        short: '発動',
        key: '1〜8',
        title: 'スキルを使ってみよう',
        body:
            'セットした枠の数字キーを「押して範囲表示、離して発動」。\n' +
            '単体スキルは狙われる敵が赤く光る。\n' +
            'スキルはMPを消費し、使うとクールタイムがある。\n' +
            'MPが切れたらMPポーションで回復しよう。',
        done: (c) => c.flags.usedSkill || killedSlimes(c),
    },
    {
        id: 'inventory',
        short: '持物',
        key: 'I',
        title: '持ち物を開こう',
        body:
            '[I]で持ち物。矢印キーで選び Enter で使用/装備。\n' +
            'Shift+Enterでまとめて使用、Uで個数指定、\n' +
            'Deleteで捨てる（売るのはショップで）。\n' +
            'HPが3割を切ったら、迷わずポーションを使おう。',
        done: (c) => c.flags.openedInventory,
    },
    {
        id: 'equip',
        short: '装備',
        key: 'S',
        title: '装備を確認しよう',
        body:
            '[S]で装備画面。武器・防具・宝具の3枠がある。\n' +
            '宝具は攻撃・防御・経験値などの特殊効果を持つ。\n' +
            '装備の補正は能力値画面[P]でも確認できる。\n' +
            '強い装備はショップやボスのドロップで手に入る。',
        done: (c) => c.flags.openedEquip,
    },
    {
        id: 'blacksmith',
        short: '鍛冶',
        key: 'E',
        title: '鍛冶屋で属性を付けよう',
        body:
            '鍛冶屋の前で [E]。属性の玉を使うと武器/防具に属性が付く。\n' +
            '有利 火→土→風→雷→水→火（光⇔闇は互いに有利）\n' +
            '有利だとダメージ1.7倍、不利だと0.6倍。\n' +
            '武器の属性とスキルの属性は 3:7 で混ざる。\n' +
            'もらった火の玉を武器に使ってみよう。',
        done: (c) => Object.keys(c.stats.itemElements || {}).length > 0,
    },
    {
        id: 'kill',
        short: '討伐',
        key: 'Q',
        title: 'スライムを5体倒そう',
        body:
            '倒すと経験値・ゴールド・アイテムが手に入る。\n' +
            '画面右上のクエスト欄で進み具合を確認、[Q]で一覧。\n' +
            '報告が必要なクエストはNPCに話しかけて完了させる。\n' +
            'レベルが上がるとHP/MPが全回復する。',
        done: (c) => killedSlimes(c),
    },
    {
        id: 'go',
        short: '出発',
        key: '',
        title: '戦場へ向かおう',
        body:
            '水色の「次は 戦場へ」矢印を追って転移陣に入ろう。\n' +
            '転移した先で、弱いボスと練習戦ができる。\n' +
            'ボスは近づいて攻撃してくる。距離を取りながら戦おう。\n' +
            'ポーションを持って、準備ができたら出発！',
        done: (c) => !!c.flags.leftTutorial,
    },
];
