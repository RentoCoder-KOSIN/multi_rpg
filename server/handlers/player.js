const { players, playerToParty, enemies } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");
const { ADMIN_PASSWORD } = require("../config");
const { cleanJobId } = require("../utils/sanitize");

module.exports = function registerPlayerHandlers(socket, { io, partyService }) {
    const playerId = socket.data.playerId;

    // 同じマップの他プレイヤーへ送る
    const toOthersOnMap = () => socket.to(`map:${socket.data.map}`);

    socket.on("playerMove", ({ x, y }) => {
        const player = players[playerId];
        if (!player) return;

        player.x = x;
        player.y = y;

        toOthersOnMap().emit("playerMoved", { id: playerId, pos: { x, y } });
    });

    socket.on("playerStatsUpdate", ({ hp, maxHp, level, mp, maxMp, job }) => {
        const player = players[playerId];
        if (!player) return;

        if (hp !== undefined) player.hp = hp;
        if (maxHp !== undefined) player.maxHp = maxHp;
        if (level !== undefined) player.level = level;
        if (mp !== undefined) player.mp = mp;
        if (maxMp !== undefined) player.maxMp = maxMp;
        const cleanJob = cleanJobId(job);
        if (cleanJob) player.job = cleanJob;

        toOthersOnMap().emit("playerStatUpdate", {
            id: playerId,
            hp: player.hp,
            maxHp: player.maxHp,
            level: player.level,
            mp: player.mp,
            maxMp: player.maxMp
        });

        // パーティーメンバーにも通知
        const partyId = playerToParty[playerId];
        if (partyId) {
            partyService.broadcastPartyUpdate(partyId);
        }
    });

    // タンクの挑発・引き寄せ、レンジャーの煙幕など、サーバーが持つ「敵の挙動」に影響するスキル効果。
    // 敵のターゲット選定・位置・命中判定はすべてサーバー側にあるため、クライアントの見た目だけでは効かない。
    // 値はクライアントから来るので範囲を絞り、連打も弾く。
    let lastAreaEffectAt = 0;
    socket.on("playerAreaEffect", (data) => {
        const player = players[playerId];
        const mapKey = socket.data.map;
        if (!player || !mapKey || !data || player.hp <= 0) return;

        const now = Date.now();
        if (now - lastAreaEffectAt < 500) return;
        lastAreaEffectAt = now;

        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0));
        const range = clamp(data.range, 0, 500);
        const duration = clamp(data.duration, 0, 15000);
        const mapEnemies = enemies[mapKey];
        if (!mapEnemies || range <= 0) return;

        for (const enemy of Object.values(mapEnemies)) {
            const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (d > range) continue;

            if (data.type === "provoke") {
                if (duration > 0) {
                    enemy.tauntTargetId = playerId;
                    enemy.tauntUntil = now + duration;
                }
                if (data.pull === true && d > 40) {
                    // 術者の手前40pxまで、最大120px引き寄せる（重なって押し合わない距離を残す）
                    const move = Math.min(120, d - 40);
                    enemy.x += (player.x - enemy.x) / d * move;
                    enemy.y += (player.y - enemy.y) / d * move;
                    io.to(`map:${mapKey}`).emit("enemyMoved", { id: enemy.id, x: enemy.x, y: enemy.y, action: "chase" });
                }
            } else if (data.type === "smoke") {
                enemy.missChance = clamp(data.missChance, 0, 0.9);
                enemy.missUntil = now + duration;
            }
        }
    });

    socket.on("summonUpdate", (data) => {
        const player = players[playerId];
        if (!player) return;

        if (data.type === "spawn") {
            player.summon = { active: true, isMega: data.isMega, x: data.x, y: data.y };
        } else if (data.type === "move") {
            if (player.summon) {
                player.summon.x = data.x;
                player.summon.y = data.y;
            }
        } else if (data.type === "despawn") {
            player.summon = null;
        }

        toOthersOnMap().emit("summonUpdate", { id: playerId, ...data });
    });

    socket.on("playerHeal", ({ targetId, amount }) => {
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) {
            targetSocket.emit("playerHealed", { amount, fromId: playerId });
        }
    });

    socket.on("playerBuff", ({ targetId, type, value, duration }) => {
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) {
            targetSocket.emit("playerBuffApplied", { type, value, duration, fromId: playerId });
        }
    });

    // 管理者パネルから対象プレイヤーのクライアントへ操作を転送する。
    // 管理者認証は現状クライアント側の開発用機能なので、ここでは接続中の対象だけを許可する。
    socket.on("adminAction", ({ targetId, action, payload, password }) => {
        if (typeof targetId !== "string" || typeof action !== "string") return;
        if (password !== ADMIN_PASSWORD) return;
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) targetSocket.emit("adminAction", { action, payload, fromId: playerId });
    });

    // 同じマップにいる他のプレイヤーにスキル使用を通知
    socket.on("playerSkill", (data) => {
        if (!socket.data.map) return;

        toOthersOnMap().emit("playerSkillUsed", {
            id: playerId,
            skillId: data.skillId,
            x: data.x,
            y: data.y,
            direction: data.direction,
            // 向きベクトル（縦・斜め対応）。数値以外は捨てる
            aimX: Number.isFinite(data.aimX) ? data.aimX : undefined,
            aimY: Number.isFinite(data.aimY) ? data.aimY : undefined
        });
    });

    socket.on("playerTitleUpdate", ({ title, color }) => {
        const player = players[playerId];
        if (player) {
            player.activeTitle = title;
            player.activeTitleColor = color;
        }
        toOthersOnMap().emit("playerTitleUpdated", {
            id: playerId,
            title,
            color
        });
    });
};
