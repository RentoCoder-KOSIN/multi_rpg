/**
 * 実績・称号データ定義
 * secret: true の実績は未達成時に「???」として伏せられる（めずらしい実績）
 */
export const ACHIEVEMENTS = {
    // === 戦闘実績 ===
    first_blood: {
        id: 'first_blood',
        name: '初陣',
        description: '初めて敵を倒した',
        reqText: 'モンスターを1体倒す',
        title: null,
        condition: { type: 'kills', value: 1 }
    },
    slayer_100: {
        id: 'slayer_100',
        name: '討伐者',
        description: '敵を100体倒した',
        reqText: 'モンスターを100体倒す',
        title: '【討伐者】',
        titleColor: '#ff8844',
        condition: { type: 'kills', value: 100 }
    },
    slayer_1000: {
        id: 'slayer_1000',
        name: '大量討伐',
        description: '敵を1000体倒した',
        reqText: 'モンスターを1000体倒す',
        title: '【魔物狩り】',
        titleColor: '#ff4400',
        condition: { type: 'kills', value: 1000 }
    },
    slayer_10000: {
        id: 'slayer_10000',
        name: '伝説の討伐者',
        description: '敵を10000体倒した',
        reqText: 'モンスターを10000体倒す',
        title: '【魔神殺し】',
        titleColor: '#ff0000',
        secret: true, // 珍しいシークレット実績
        condition: { type: 'kills', value: 10000 }
    },
    // === レベル実績 ===
    level_30: {
        id: 'level_30',
        name: '駆け出し冒険者',
        description: 'レベル30に到達した',
        reqText: 'プレイヤーLv.30に到達',
        title: '【見習い】',
        titleColor: '#88ff88',
        condition: { type: 'level', value: 30 }
    },
    level_60: {
        id: 'level_60',
        name: '中級冒険者',
        description: 'レベル60に到達した',
        reqText: 'プレイヤーLv.60に到達',
        title: '【冒険者】',
        titleColor: '#44ffaa',
        condition: { type: 'level', value: 60 }
    },
    level_100: {
        id: 'level_100',
        name: 'レベルマスター',
        description: 'レベル100（上限）に到達した',
        reqText: 'プレイヤーLv.100（カンスト）に到達',
        title: '【頂点の戦士】',
        titleColor: '#ffff00',
        condition: { type: 'level', value: 100 }
    },
    // === 転生実績 ===
    reborn_1: {
        id: 'reborn_1',
        name: '輪廻の始まり',
        description: '初めて輪廻転生した',
        reqText: 'Lv100で初めて転生を行う',
        title: '【転生者】',
        titleColor: '#aa88ff',
        condition: { type: 'reincarnation', value: 1 }
    },
    reborn_3: {
        id: 'reborn_3',
        name: '輪廻の旅人',
        description: '3回転生した',
        reqText: '輪廻転生を累計3回行う',
        title: '【輪廻の旅人】',
        titleColor: '#8844ff',
        condition: { type: 'reincarnation', value: 3 }
    },
    reborn_10: {
        id: 'reborn_10',
        name: '永遠の輪廻',
        description: '10回転生した',
        reqText: '輪廻転生を累計10回行う',
        title: '【永劫の輪廻者】',
        titleColor: '#ff44ff',
        secret: true, // 珍しいシークレット実績
        condition: { type: 'reincarnation', value: 10 }
    },
    // === スキル実績 ===
    skill_master_1: {
        id: 'skill_master_1',
        name: 'スキルマスター',
        description: 'スキルをLv10にした',
        reqText: 'いずれかのスキルをLv10まで強化',
        title: '【修練者】',
        titleColor: '#44aaff',
        condition: { type: 'skillMaxLevel', value: 1 }
    },
    skill_master_5: {
        id: 'skill_master_5',
        name: '全力修練',
        description: 'スキルを5個Lv10にした',
        reqText: 'スキルを合計5つLv10まで極める',
        title: '【達人】',
        titleColor: '#0088ff',
        condition: { type: 'skillMaxLevel', value: 5 }
    },
    // === 職業実績 ===
    job_changer: {
        id: 'job_changer',
        name: '転職者',
        description: '上位職に転職した',
        reqText: '上位職への転職を達成',
        title: '【転職者】',
        titleColor: '#ffaa44',
        condition: { type: 'jobMaster', value: 1 }
    },
    job_master: {
        id: 'job_master',
        name: '万能冒険者',
        description: '3種以上の上位職を経験した',
        reqText: '異なる上位職を3種類以上経験する',
        title: '【万能者】',
        titleColor: '#ff8800',
        secret: true, // 珍しいシークレット実績
        condition: { type: 'jobMaster', value: 3 }
    },
    // === 富の実績 ===
    rich_1: {
        id: 'rich_1',
        name: '小金持ち',
        description: '累計10000ゴールド獲得した',
        reqText: '累計で10,000ゴールド獲得',
        title: null,
        condition: { type: 'gold', value: 10000 }
    },
    rich_2: {
        id: 'rich_2',
        name: '大富豪',
        description: '累計100万ゴールド獲得した',
        reqText: '累計で1,000,000ゴールド獲得',
        title: '【大富豪】',
        titleColor: '#ffd700',
        secret: true, // 珍しいシークレット実績
        condition: { type: 'gold', value: 1000000 }
    },
    // === 強化実績 ===
    enhance_5: {
        id: 'enhance_5',
        name: '名工の卵',
        description: '装備を+5以上まで強化した',
        reqText: '鍛冶屋で装備を+5以上にする',
        title: '【強化工】',
        titleColor: '#aaffaa',
        condition: { type: 'enhance', value: 5 }
    },
    enhance_10: {
        id: 'enhance_10',
        name: '業物の創造者',
        description: '装備を+10以上まで強化した',
        reqText: '鍛冶屋で装備を+10以上にする',
        title: '【鍛冶の名匠】',
        titleColor: '#ffaa00',
        condition: { type: 'enhance', value: 10 }
    },
    enhance_15: {
        id: 'enhance_15',
        name: '神話の鍛冶神',
        description: '装備を+15（最大）まで強化した',
        reqText: '鍛冶屋で装備を+15（限界）まで極める',
        title: '【神域の鍛冶師】',
        titleColor: '#ff00ff',
        secret: true, // 珍しいシークレット実績
        condition: { type: 'enhance', value: 15 }
    }
};

/** 称号一覧 */
export const TITLES = Object.values(ACHIEVEMENTS)
    .filter(a => a.title)
    .map(a => ({
        title: a.title,
        color: a.titleColor,
        achievementId: a.id,
        secret: !!a.secret,
        reqText: a.reqText,
    }));
