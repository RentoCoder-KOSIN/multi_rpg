import { defineJob } from './schema.js';

export const JOBS = {
    fighter: defineJob({
        id: 'fighter',
        type: 'physical',
        name: 'ファイター',
        description: '攻撃力と防御力のバランスが良い近接職',
        atkBonus: 5,
        defBonus: 2,
        hpBonus: 20,
        atkMult: 1.0, defMult: 1.0, hpMult: 1.1, mpMult: 0.8,
        attackCooldownMult: 1.0,
        attackRange: 80,
        attackHit: 'area',
        skills: {
            1: ['slash'],
            3: ['whirlwind'],
            5: ['heavy_slash'],
            7: ['sonic_wave'],
            10: ['ground_smash'],
            15: ['fighting_spirit'],
            20: ['counter_stance']
        },
        nextJobs: ['knight', 'berserker', 'samurai', 'dragon_knight']
    }),
    mage: defineJob({
        id: 'mage',
        type: 'magical',
        name: 'メイジ',
        description: '高い攻撃力を誇るが、防御力が低い魔法職',
        atkBonus: 10,
        defBonus: 0,
        hpBonus: -10,
        atkMult: 1.25, defMult: 0.8, hpMult: 0.8, mpMult: 1.5,
        attackCooldownMult: 1.2,
        attackRange: 200,
        attackHit: 'single',
        skills: {
            1: ['fireball'],
            3: ['ice_needle'],
            5: ['big_fireball'],
            8: ['dark_nova'],
            10: ['meteor_swarm'],
            12: ['thunder_storm'],
            15: ['mana_well']
        },
        nextJobs: ['archmage', 'elementalist', 'warlock', 'sage']
    }),
    tank: defineJob({
        id: 'tank',
        type: 'physical',
        name: 'タンク',
        description: '圧倒的な防御力と体力を誇る守りの要',
        atkBonus: 2,
        defBonus: 10,
        hpBonus: 50,
        atkMult: 0.85, defMult: 1.3, hpMult: 1.4, mpMult: 0.7,
        attackCooldownMult: 1.2,
        attackRange: 70,
        attackHit: 'area',
        skills: {
            1: ['guard'],
            5: ['iron_defense'],
            10: ['shield_bash'],
            15: ['immovable_body'],
            18: ['spike_guard'],
            20: ['stalwart_heart'],
            25: ['retaliate']
        },
        nextJobs: ['paladin', 'warden', 'avenger', 'juggernaut']
    }),
    ranger: defineJob({
        id: 'ranger',
        type: 'physical',
        name: 'レンジャー',
        description: '素早い動きで敵を翻弄する遠距離職',
        atkBonus: 7,
        defBonus: 3,
        hpBonus: 5,
        atkMult: 1.05, defMult: 0.9, hpMult: 0.9, mpMult: 0.9,
        attackCooldownMult: 0.7,
        attackRange: 260,
        attackHit: 'single',
        skills: {
            1: ['rapid_fire'],
            5: ['arrow_rain'],
            10: ['piercing_shot'],
            13: ['multi_shot'],
            15: ['wind_walker'],
            18: ['explosive_arrow'],
            20: ['hunters_focus']
        },
        nextJobs: ['sniper', 'ninja', 'gunslinger', 'wind_archer']
    }),
    summoner: defineJob({
        id: 'summoner',
        type: 'magical',
        name: 'サモナー',
        description: '召喚獣を操り戦場を支配する召喚術師',
        atkBonus: 3,
        defBonus: 2,
        hpBonus: 10,
        atkMult: 0.9, defMult: 0.9, hpMult: 0.9, mpMult: 1.4,
        attackCooldownMult: 1.1,
        attackRange: 180,
        attackHit: 'single',
        skills: {
            1: ['summon'],
            5: ['mega_summon'],
            8: ['spirit_bolt'],
            10: ['command_attack'],
            13: ['familiar_speed'],
            15: ['spirit_link'],
            20: ['beast_bond']
        },
        nextJobs: ['high_summoner', 'necromancer', 'beast_lord', 'spirit_master']
    }),
    priest: defineJob({
        id: 'priest',
        type: 'magical',
        name: 'プリースト',
        description: '神の祝福を授ける聖職者。仲間の能力を強化する。',
        atkBonus: 5,
        defBonus: 5,
        hpBonus: 30,
        atkMult: 0.85, defMult: 1.0, hpMult: 1.0, mpMult: 1.3,
        attackCooldownMult: 1.0,
        attackRange: 170,
        attackHit: 'single',
        skills: {
            1: ['heal', 'attack_buff'],
            3: ['holy_arrow'],
            5: ['defense_buff'],
            10: ['speed_buff'],
            15: ['summon_boost'],
            20: ['blessed_vitality']
        },
        nextJobs: ['exorcist', 'saint', 'war_priest', 'shadow_priest']
    }),

    // --- 上位職 (Lv50〜) ---
    // 基本職ごとに上位職が4つずつ（fighter: ナイト/バーサーカー/サムライ/ドラゴンナイト ...）。
    // どの上位職に進むかは基本職の nextJobs に並べる。習得スキルは Lv50/55/60/65 に1つずつ。
    // 上位職の skills には「新しく増える4つ」だけを書く。
    // 元の職業（例: fighter）のスキルは、SkillManagerUI 側が
    // 職業の系譜(nextJobの逆引き)を辿って自動的に引き継ぐため、
    // ここで heavy_slash 等を再度書く必要はない。
    knight: defineJob({
        id: 'knight',
        type: 'physical',
        name: 'ナイト',
        description: '高潔なる騎士。攻守ともに極限まで高められている。',
        atkBonus: 15,
        defBonus: 10,
        hpBonus: 100,
        reqLevel: 50,
        atkMult: 1.15, defMult: 1.2, hpMult: 1.3, mpMult: 0.9,
        attackCooldownMult: 0.9,
        attackRange: 90,
        attackHit: 'area',
        skills: {
            50: ['judgment_cut'],
            55: ['guardian_slash'],
            60: ['veteran_instinct'],
            65: ['last_stand']
        }
    }),
    archmage: defineJob({
        id: 'archmage',
        type: 'magical',
        name: 'アークメイジ',
        description: '深遠なる真理を極めた魔導師。広範囲を殲滅する力を持つ。',
        atkBonus: 25,
        defBonus: 5,
        hpBonus: 20,
        reqLevel: 50,
        atkMult: 1.5, defMult: 0.85, hpMult: 0.9, mpMult: 1.8,
        attackCooldownMult: 1.1,
        attackRange: 230,
        attackHit: 'single',
        skills: {
            50: ['abyss_storm'],
            55: ['chain_lightning'],
            60: ['arcane_efficiency'],
            65: ['mind_over_matter']
        }
    }),
    paladin: defineJob({
        id: 'paladin',
        type: 'physical',
        name: 'パラディン',
        description: '聖なる盾。神聖な魔法と鉄壁の守りで仲間を守る。',
        atkBonus: 10,
        defBonus: 25,
        hpBonus: 200,
        reqLevel: 50,
        atkMult: 0.95, defMult: 1.5, hpMult: 1.7, mpMult: 0.9,
        attackCooldownMult: 1.1,
        attackRange: 85,
        attackHit: 'area',
        skills: {
            50: ['holy_sanctuary'],
            55: ['smite'],
            60: ['aegis_of_faith'],
            65: ['retribution_aura']
        }
    }),
    sniper: defineJob({
        id: 'sniper',
        type: 'physical',
        name: 'スナイパー',
        description: '静かなる狙撃手。遠方から敵を一撃で射抜く。',
        atkBonus: 20,
        defBonus: 8,
        hpBonus: 50,
        reqLevel: 50,
        atkMult: 1.3, defMult: 0.95, hpMult: 1.0, mpMult: 1.0,
        attackCooldownMult: 0.55,
        attackRange: 330,
        attackHit: 'single',
        skills: {
            50: ['death_rain'],
            55: ['headshot'],
            60: ['eagle_eye'],
            65: ['swift_reload']
        }
    }),
    high_summoner: defineJob({
        id: 'high_summoner',
        type: 'magical',
        name: 'ハイサモナー',
        description: '古の力を使役する召喚士。より強力な存在を呼び出す。',
        atkBonus: 15,
        defBonus: 12,
        hpBonus: 80,
        reqLevel: 50,
        atkMult: 1.05, defMult: 1.0, hpMult: 1.1, mpMult: 1.7,
        attackCooldownMult: 1.0,
        attackRange: 200,
        attackHit: 'single',
        skills: {
            50: ['demon_lord_summon'],
            55: ['arcane_barrage'],
            60: ['overlords_pact'],
            65: ['ancient_bond']
        }
    }),
    exorcist: defineJob({
        id: 'exorcist',
        type: 'magical',
        name: 'エクソシスト',
        description: '悪しき者を祓う祓魔師。アンデッド系に絶大な効果を発揮する上位聖職者。',
        atkBonus: 20,
        defBonus: 15,
        hpBonus: 60,
        reqLevel: 50,
        atkMult: 1.1, defMult: 1.15, hpMult: 1.2, mpMult: 1.5,
        attackCooldownMult: 0.95,
        attackRange: 190,
        attackHit: 'single',
        skills: {
            50: ['exorcism'],
            55: ['divine_judgment'],
            60: ['sanctified_ground'],
            65: ['unwavering_faith']
        }
    }),

    // --- 上位職（追加分。各基本職の2つ目以降） ---
    berserker: defineJob({
        id: 'berserker',
        type: 'physical',
        name: 'バーサーカー',
        description: '狂気を力に変える戦士。防御を捨てて圧倒的な火力で敵をなぎ倒す。',
        atkBonus: 22,
        defBonus: 4,
        hpBonus: 60,
        reqLevel: 50,
        atkMult: 1.35, defMult: 0.85, hpMult: 1.1, mpMult: 0.8,
        attackCooldownMult: 0.85,
        attackRange: 85,
        attackHit: 'area',
        skills: {
            50: ['rampage_slash'],
            55: ['blood_frenzy'],
            60: ['bloodlust'],
            65: ['berserk_heart']
        }
    }),
    samurai: defineJob({
        id: 'samurai',
        type: 'physical',
        name: 'サムライ',
        description: '一刀に全てを懸ける剣客。研ぎ澄まされた居合と鋭い会心が持ち味。',
        atkBonus: 18,
        defBonus: 8,
        hpBonus: 50,
        reqLevel: 50,
        atkMult: 1.25, defMult: 1.0, hpMult: 1.05, mpMult: 0.9,
        attackCooldownMult: 0.75,
        attackRange: 95,
        attackHit: 'area',
        skills: {
            50: ['iai_slash'],
            55: ['moonlit_blade'],
            60: ['bushido'],
            65: ['zanshin']
        }
    }),
    dragon_knight: defineJob({
        id: 'dragon_knight',
        type: 'physical',
        name: 'ドラゴンナイト',
        description: '竜の力を宿した槍騎士。長い間合いと竜の炎で戦場を制する。',
        atkBonus: 18,
        defBonus: 12,
        hpBonus: 90,
        reqLevel: 50,
        atkMult: 1.2, defMult: 1.15, hpMult: 1.25, mpMult: 0.9,
        attackCooldownMult: 0.95,
        attackRange: 120,
        attackHit: 'area',
        skills: {
            50: ['dragon_thrust'],
            55: ['dragon_breath'],
            60: ['dragon_scale'],
            65: ['dragon_soul']
        }
    }),
    elementalist: defineJob({
        id: 'elementalist',
        type: 'magical',
        name: 'エレメンタリスト',
        description: '火・風など属性の理を操る魔術師。属性の力を纏った魔法で敵を焼き払う。',
        atkBonus: 22,
        defBonus: 5,
        hpBonus: 20,
        reqLevel: 50,
        atkMult: 1.4, defMult: 0.85, hpMult: 0.9, mpMult: 1.7,
        attackCooldownMult: 1.0,
        attackRange: 220,
        attackHit: 'single',
        skills: {
            50: ['flame_lance'],
            55: ['tempest_burst'],
            60: ['elemental_mastery'],
            65: ['prismatic_focus']
        }
    }),
    warlock: defineJob({
        id: 'warlock',
        type: 'magical',
        name: 'ウォーロック',
        description: '禁断の契約で闇の力を得た魔術師。呪いと生命吸収で敵を蝕む。',
        atkBonus: 24,
        defBonus: 4,
        hpBonus: 30,
        reqLevel: 50,
        atkMult: 1.45, defMult: 0.8, hpMult: 0.95, mpMult: 1.6,
        attackCooldownMult: 1.05,
        attackRange: 210,
        attackHit: 'single',
        skills: {
            50: ['curse_bolt'],
            55: ['soul_drain'],
            60: ['dark_pact'],
            65: ['forbidden_knowledge']
        }
    }),
    sage: defineJob({
        id: 'sage',
        type: 'magical',
        name: 'セージ',
        description: 'あらゆる魔法に通じた賢者。仲間を守る結界と雷の裁きを使い分ける。',
        atkBonus: 14,
        defBonus: 10,
        hpBonus: 50,
        reqLevel: 50,
        atkMult: 1.15, defMult: 1.05, hpMult: 1.0, mpMult: 2.0,
        attackCooldownMult: 0.9,
        attackRange: 210,
        attackHit: 'single',
        skills: {
            50: ['thunder_judgment'],
            55: ['arcane_ward'],
            60: ['sages_wisdom'],
            65: ['mana_flow']
        }
    }),
    warden: defineJob({
        id: 'warden',
        type: 'physical',
        name: 'ウォーデン',
        description: '仲間の盾となる要塞の守護者。鉄壁の防御力と分厚い体力を誇る。',
        atkBonus: 8,
        defBonus: 30,
        hpBonus: 250,
        reqLevel: 50,
        atkMult: 0.9, defMult: 1.6, hpMult: 1.9, mpMult: 0.9,
        attackCooldownMult: 1.15,
        attackRange: 85,
        attackHit: 'area',
        skills: {
            50: ['bulwark_bash'],
            55: ['fortress_aura'],
            60: ['ironwall'],
            65: ['vital_bastion']
        }
    }),
    avenger: defineJob({
        id: 'avenger',
        type: 'physical',
        name: 'アベンジャー',
        description: '受けた痛みを力に変える復讐者。耐えるほど反撃が鋭くなる。',
        atkBonus: 14,
        defBonus: 20,
        hpBonus: 150,
        reqLevel: 50,
        atkMult: 1.05, defMult: 1.3, hpMult: 1.5, mpMult: 0.9,
        attackCooldownMult: 1.0,
        attackRange: 80,
        attackHit: 'area',
        skills: {
            50: ['vengeful_strike'],
            55: ['wrath_of_the_fallen'],
            60: ['grudge'],
            65: ['unyielding_wrath']
        }
    }),
    juggernaut: defineJob({
        id: 'juggernaut',
        type: 'physical',
        name: 'ジャガーノート',
        description: '止まらぬ巨人。重い一撃で大地を揺らし、どんな攻撃にも怯まない。',
        atkBonus: 12,
        defBonus: 24,
        hpBonus: 220,
        reqLevel: 50,
        atkMult: 1.0, defMult: 1.45, hpMult: 1.8, mpMult: 0.9,
        attackCooldownMult: 1.25,
        attackRange: 90,
        attackHit: 'area',
        skills: {
            50: ['colossus_slam'],
            55: ['earthquake'],
            60: ['titan_hide'],
            65: ['unstoppable']
        }
    }),
    ninja: defineJob({
        id: 'ninja',
        type: 'physical',
        name: 'ニンジャ',
        description: '影に潜む暗殺者。圧倒的な機動力と急所を突く技で敵を翻弄する。',
        atkBonus: 20,
        defBonus: 6,
        hpBonus: 40,
        reqLevel: 50,
        atkMult: 1.25, defMult: 0.9, hpMult: 0.95, mpMult: 1.0,
        attackCooldownMult: 0.55,
        attackRange: 160,
        attackHit: 'single',
        skills: {
            50: ['shuriken_storm'],
            55: ['shadow_assassinate'],
            60: ['shadow_step'],
            65: ['killer_instinct']
        }
    }),
    gunslinger: defineJob({
        id: 'gunslinger',
        type: 'physical',
        name: 'ガンスリンガー',
        description: '早撃ちの名手。連射速度と会心率に優れた遠距離射撃のスペシャリスト。',
        atkBonus: 22,
        defBonus: 6,
        hpBonus: 40,
        reqLevel: 50,
        atkMult: 1.3, defMult: 0.95, hpMult: 1.0, mpMult: 1.0,
        attackCooldownMult: 0.5,
        attackRange: 300,
        attackHit: 'single',
        skills: {
            50: ['quick_draw'],
            55: ['bullet_hell'],
            60: ['sharpshooter'],
            65: ['gun_kata']
        }
    }),
    wind_archer: defineJob({
        id: 'wind_archer',
        type: 'physical',
        name: 'ウィンドアーチャー',
        description: '風を読み、風に乗る弓の名手。素早い身のこなしで矢を降らせる。',
        atkBonus: 18,
        defBonus: 5,
        hpBonus: 30,
        reqLevel: 50,
        atkMult: 1.2, defMult: 0.9, hpMult: 0.95, mpMult: 1.0,
        attackCooldownMult: 0.6,
        attackRange: 320,
        attackHit: 'single',
        skills: {
            50: ['gale_arrow'],
            55: ['storm_volley'],
            60: ['wind_veil'],
            65: ['zephyr_focus']
        }
    }),
    necromancer: defineJob({
        id: 'necromancer',
        type: 'magical',
        name: 'ネクロマンサー',
        description: '死者を従える死霊術師。闇の力で敵の魂を刈り取る。',
        atkBonus: 18,
        defBonus: 6,
        hpBonus: 40,
        reqLevel: 50,
        atkMult: 1.15, defMult: 0.9, hpMult: 1.0, mpMult: 1.8,
        attackCooldownMult: 1.0,
        attackRange: 200,
        attackHit: 'single',
        skills: {
            50: ['death_bolt'],
            55: ['grave_call'],
            60: ['undead_pact'],
            65: ['soul_harvest']
        }
    }),
    beast_lord: defineJob({
        id: 'beast_lord',
        type: 'magical',
        name: 'ビーストロード',
        description: '獣たちの王。野生の力で共に戦い、群れを率いて敵を圧倒する。',
        atkBonus: 14,
        defBonus: 14,
        hpBonus: 100,
        reqLevel: 50,
        atkMult: 1.0, defMult: 1.15, hpMult: 1.3, mpMult: 1.5,
        attackCooldownMult: 1.0,
        attackRange: 190,
        attackHit: 'single',
        skills: {
            50: ['primal_roar'],
            55: ['wild_charge'],
            60: ['pack_leader'],
            65: ['wild_instinct']
        }
    }),
    spirit_master: defineJob({
        id: 'spirit_master',
        type: 'magical',
        name: 'スピリットマスター',
        description: '精霊と心を通わせる術者。精霊の加護でスキルを素早く繰り出す。',
        atkBonus: 16,
        defBonus: 10,
        hpBonus: 60,
        reqLevel: 50,
        atkMult: 1.1, defMult: 1.05, hpMult: 1.1, mpMult: 1.9,
        attackCooldownMult: 0.95,
        attackRange: 210,
        attackHit: 'single',
        skills: {
            50: ['spirit_lance'],
            55: ['spirit_storm'],
            60: ['spirit_communion'],
            65: ['ethereal_veil']
        }
    }),
    saint: defineJob({
        id: 'saint',
        type: 'magical',
        name: 'セイント',
        description: '奇跡を起こす聖者。癒しの力と祝福で仲間を支える。',
        atkBonus: 12,
        defBonus: 14,
        hpBonus: 90,
        reqLevel: 50,
        atkMult: 0.95, defMult: 1.1, hpMult: 1.2, mpMult: 1.7,
        attackCooldownMult: 1.0,
        attackRange: 180,
        attackHit: 'single',
        skills: {
            50: ['holy_radiance'],
            55: ['benediction'],
            60: ['divine_grace'],
            65: ['saintly_aura']
        }
    }),
    war_priest: defineJob({
        id: 'war_priest',
        type: 'magical',
        name: 'ウォープリースト',
        description: 'メイスを振るう戦う聖職者。聖なる力を近接戦闘に乗せて戦う。',
        atkBonus: 20,
        defBonus: 16,
        hpBonus: 80,
        reqLevel: 50,
        atkMult: 1.15, defMult: 1.2, hpMult: 1.2, mpMult: 1.4,
        attackCooldownMult: 0.95,
        attackRange: 110,
        attackHit: 'area',
        skills: {
            50: ['holy_smash'],
            55: ['sanctified_strike'],
            60: ['zealous_might'],
            65: ['holy_resolve']
        }
    }),
    shadow_priest: defineJob({
        id: 'shadow_priest',
        type: 'magical',
        name: 'シャドウプリースト',
        description: '闇に仕える異端の司祭。影の魔法で敵を封じ、蝕む。',
        atkBonus: 22,
        defBonus: 8,
        hpBonus: 50,
        reqLevel: 50,
        atkMult: 1.3, defMult: 0.95, hpMult: 1.0, mpMult: 1.6,
        attackCooldownMult: 1.0,
        attackRange: 200,
        attackHit: 'single',
        skills: {
            50: ['shadow_bolt'],
            55: ['void_prison'],
            60: ['dark_devotion'],
            65: ['twilight_veil']
        }
    })
};
