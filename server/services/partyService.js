const crypto = require("crypto");
const { players, playerNames, parties, playerToParty } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

const MAX_PARTY_NAME_LENGTH = 24;
const MAX_PARTY_MEMBERS = 8;

function createPartyService({ io }) {
    function partySummary(partyId, party) {
        return {
            partyId,
            name: party.name || "Party",
            leader: party.leader,
            leaderName: playerNames[party.leader] || "Unknown",
            memberCount: party.members.length,
            maxMembers: MAX_PARTY_MEMBERS,
            hasPassword: !!party.passwordHash,
        };
    }

    function listParties() {
        return Object.entries(parties)
            .filter(([, party]) => party?.members?.length)
            .map(([partyId, party]) => partySummary(partyId, party));
    }

    function broadcastPartyList() {
        io.emit("partyList", listParties());
    }

    function sendPartyUpdate(playerId) {
        const partyId = playerToParty[playerId];
        const socket = findSocketByPlayerId(io, playerId);
        if (!socket) return;
        if (!partyId || !parties[partyId]) {
            socket.emit("partyUpdate", null);
            return;
        }
        broadcastPartyUpdate(partyId);
    }

    function broadcastPartyUpdate(partyId) {
        const party = parties[partyId];
        if (!party) return;
        const members = party.members.map(memberId => {
            const p = players[memberId];
            return {
                id: memberId,
                name: playerNames[memberId] || "Unknown",
                hp: p?.hp || 0,
                maxHp: p?.maxHp || 0,
                mp: p?.mp || 0,
                maxMp: p?.maxMp || 0,
                level: p?.level || 1,
                job: p?.job || "none",
                map: p?.map || "unknown"
            };
        });

        party.members.forEach(memberId => {
            const memberSocket = findSocketByPlayerId(io, memberId);
            if (memberSocket) memberSocket.emit("partyUpdate", {
                partyId, name: party.name, leader: party.leader, members
            });
        });
    }

    function leaveParty(playerId) {
        const partyId = playerToParty[playerId];
        if (!partyId || !parties[partyId]) {
            sendPartyUpdate(playerId);
            return { ok: false, error: "パーティーに参加していません" };
        }
        const party = parties[partyId];
        party.members = party.members.filter(id => id !== playerId);
        delete playerToParty[playerId];

        if (party.members.length === 0) delete parties[partyId];
        else {
            if (party.leader === playerId) party.leader = party.members[0];
            broadcastPartyUpdate(partyId);
        }
        sendPartyUpdate(playerId);
        broadcastPartyList();
        return { ok: true };
    }

    function createParty(playerId, rawName, password) {
        const name = String(rawName || "").trim().slice(0, MAX_PARTY_NAME_LENGTH) || `${playerNames[playerId] || "Player"}のパーティー`;
        const rawPassword = String(password || "");
        if (rawPassword.length > 64) return { ok: false, error: "パスワードは64文字以内にしてください" };
        leaveParty(playerId);

        const partyId = `party-${crypto.randomBytes(6).toString("hex")}`;
        const passwordSalt = rawPassword ? crypto.randomBytes(16).toString("hex") : null;
        parties[partyId] = {
            name, leader: playerId, members: [playerId], passwordSalt,
            passwordHash: rawPassword ? crypto.scryptSync(rawPassword, passwordSalt, 32).toString("hex") : null,
        };
        playerToParty[playerId] = partyId;
        broadcastPartyUpdate(partyId);
        broadcastPartyList();
        return { ok: true, partyId };
    }

    function passwordMatches(party, password) {
        if (!party.passwordHash) return true;
        const actual = crypto.scryptSync(String(password || ""), party.passwordSalt, 32).toString("hex");
        return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(party.passwordHash, "hex"));
    }

    function joinParty(playerId, partyId, password = "") {
        const party = parties[partyId];
        if (!party) return { ok: false, error: "パーティーが見つかりません" };
        if (party.members.includes(playerId)) return { ok: true, partyId };
        if (party.members.length >= MAX_PARTY_MEMBERS) return { ok: false, error: "パーティーが満員です" };
        if (!passwordMatches(party, password)) return { ok: false, error: "パスワードが違います" };

        leaveParty(playerId);
        party.members.push(playerId);
        playerToParty[playerId] = partyId;
        broadcastPartyUpdate(partyId);
        broadcastPartyList();
        return { ok: true, partyId };
    }

    function inviteToParty(playerId, targetId) {
        const partyId = playerToParty[playerId];
        const party = parties[partyId];
        if (!party) return { ok: false, error: "先にパーティーを作成してください" };
        if (party.leader !== playerId) return { ok: false, error: "招待できるのはリーダーだけです" };
        if (party.members.length >= MAX_PARTY_MEMBERS) return { ok: false, error: "パーティーが満員です" };
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (!targetSocket) return { ok: false, error: "対象プレイヤーは接続していません" };
        targetSocket.emit("partyInvited", {
            fromId: playerId, fromName: playerNames[playerId] || "Unknown",
            partyId, partyName: party.name, hasPassword: !!party.passwordHash,
        });
        return { ok: true };
    }

    function kickMember(playerId, targetId) {
        const partyId = playerToParty[playerId];
        const party = parties[partyId];
        if (!party) return { ok: false, error: "パーティーが見つかりません" };
        if (party.leader !== playerId) return { ok: false, error: "追放できるのはリーダーだけです" };
        if (targetId === playerId || !party.members.includes(targetId)) return { ok: false, error: "そのメンバーは追放できません" };
        party.members = party.members.filter(id => id !== targetId);
        delete playerToParty[targetId];
        sendPartyUpdate(targetId);
        broadcastPartyUpdate(partyId);
        broadcastPartyList();
        return { ok: true };
    }

    // 既定パーティーへの自動参加は行わず、未所属の状態で一覧から自由に参加する。
    function autoJoinDefaultParty(playerId) {
        sendPartyUpdate(playerId);
        broadcastPartyList();
    }

    return {
        broadcastPartyUpdate, broadcastPartyList, listParties, createParty,
        leaveParty, joinParty, inviteToParty, kickMember, autoJoinDefaultParty
    };
}

module.exports = { createPartyService };
