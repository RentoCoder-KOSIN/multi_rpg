const { DEFAULT_PARTY_ID, PARTY_BROADCAST_DELAY } = require("../config");
const { players, playerNames, parties, playerToParty } = require("../state");
const { findSocketByPlayerId } = require("../utils/socketUtils");

function createPartyService({ io }) {
    // パーティーメンバー全員に最新の状態を送る
    function broadcastPartyUpdate(partyId) {
        const party = parties[partyId];
        if (!party) return;

        const memberData = party.members.map(memberId => {
            const p = players[memberId];
            return {
                id: memberId,
                name: playerNames[memberId] || "Unknown",
                hp: p?.hp || 0,
                maxHp: p?.maxHp || 0,
                mp: p?.mp || 0,
                maxMp: p?.maxMp || 0,
                level: p?.level || 1,
                map: p?.map || "unknown"
            };
        });

        party.members.forEach(memberId => {
            const memberSocket = findSocketByPlayerId(io, memberId);
            if (memberSocket) {
                memberSocket.emit("partyUpdate", {
                    partyId,
                    leader: party.leader,
                    members: memberData
                });
            }
        });
    }

    function leaveParty(playerId) {
        const partyId = playerToParty[playerId];
        if (!partyId || !parties[partyId]) return;

        const party = parties[partyId];
        party.members = party.members.filter(id => id !== playerId);
        delete playerToParty[playerId];

        if (party.members.length === 0) {
            delete parties[partyId];
            return;
        }

        // リーダーが抜けた場合は次の人をリーダーに
        if (party.leader === playerId) {
            party.leader = party.members[0];
        }
        broadcastPartyUpdate(partyId);
    }

    function joinParty(playerId, partyId) {
        // 既に別のパーティーにいる場合は抜ける
        if (playerToParty[playerId]) {
            leaveParty(playerId);
        }

        // 新規パーティー作成（partyId は "party-<リーダーのID>" 形式）
        if (!parties[partyId]) {
            parties[partyId] = {
                leader: partyId.replace("party-", ""),
                members: []
            };
        }
        const party = parties[partyId];

        // リーダーがまだ入っていない場合は先に追加
        if (!party.members.includes(party.leader)) {
            party.members.push(party.leader);
            playerToParty[party.leader] = partyId;
        }

        if (!party.members.includes(playerId)) {
            party.members.push(playerId);
            playerToParty[playerId] = partyId;
        }

        broadcastPartyUpdate(partyId);
    }

    // 接続時に全員を同じ既定パーティーへ自動参加させる
    function autoJoinDefaultParty(playerId) {
        if (!parties[DEFAULT_PARTY_ID]) {
            parties[DEFAULT_PARTY_ID] = { leader: playerId, members: [] };
        }

        if (!playerToParty[playerId]) {
            if (!parties[DEFAULT_PARTY_ID].members.includes(playerId)) {
                parties[DEFAULT_PARTY_ID].members.push(playerId);
            }
            playerToParty[playerId] = DEFAULT_PARTY_ID;
            console.log(`[AutoJoin] ${playerId} joined ${DEFAULT_PARTY_ID}`);
        } else {
            // 既に別パーティーにいる場合は、そのパーティーの状態を再送
            const currentPartyId = playerToParty[playerId];
            setTimeout(() => broadcastPartyUpdate(currentPartyId), PARTY_BROADCAST_DELAY);
        }

        // 他のメンバーにも更新通知
        setTimeout(() => broadcastPartyUpdate(DEFAULT_PARTY_ID), PARTY_BROADCAST_DELAY);
    }

    return { broadcastPartyUpdate, leaveParty, joinParty, autoJoinDefaultParty };
}

module.exports = { createPartyService };
