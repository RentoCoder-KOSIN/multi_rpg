/**
 * トレードハンドラー
 * 2プレイヤー間のアイテム交換を仲介・同期する。
 */
const { findSocketByPlayerId } = require('../utils/socketUtils');

// トレードセッション: { [sessionKey]: { playerA, playerB, offerA, offerB, readyA, readyB } }
const tradeSessions = {};

function getSessionKey(a, b) {
    return [a, b].sort().join('::');
}

module.exports = function registerTradeHandlers(socket, { io }) {
    const playerId = socket.data.playerId;

    // トレードリクエスト送信
    socket.on('tradeRequest', ({ targetId }) => {
        if (!targetId || targetId === playerId) return;
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (!targetSocket) {
            socket.emit('tradeCancelled', { reason: '相手が見つかりません' });
            return;
        }
        if (targetSocket.data.map !== socket.data.map) {
            socket.emit('tradeCancelled', { reason: '同じマップにいる相手とのみトレードできます' });
            return;
        }
        targetSocket.emit('tradeRequestReceived', {
            fromId: playerId,
            fromName: socket.data.username || playerId,
        });
    });

    // 承認
    socket.on('tradeAccept', ({ targetId }) => {
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (!targetSocket) {
            socket.emit('tradeCancelled', { reason: '相手が見つかりません' });
            return;
        }
        const key = getSessionKey(playerId, targetId);
        tradeSessions[key] = {
            playerA: playerId, playerB: targetId,
            offerA: [], offerB: [],
            readyA: false, readyB: false,
        };
        socket.emit('tradeStarted', {
            partnerId: targetId,
            partnerName: targetSocket.data.username || targetId,
        });
        targetSocket.emit('tradeStarted', {
            partnerId: playerId,
            partnerName: socket.data.username || playerId,
        });
    });

    // 拒否
    socket.on('tradeDecline', ({ targetId }) => {
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) targetSocket.emit('tradeDeclined');
    });

    // 提供内容更新
    socket.on('tradeOffer', ({ targetId, offer }) => {
        const key = getSessionKey(playerId, targetId);
        const session = tradeSessions[key];
        if (!session) return;
        const isA = session.playerA === playerId;
        if (isA && session.readyA) return;
        if (!isA && session.readyB) return;
        if (isA) session.offerA = offer;
        else session.offerB = offer;

        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) targetSocket.emit('tradeOfferUpdated', { offer });
    });

    // 確定
    socket.on('tradeConfirm', ({ targetId }) => {
        const key = getSessionKey(playerId, targetId);
        const session = tradeSessions[key];
        if (!session) return;
        const isA = session.playerA === playerId;
        if (isA) session.readyA = true;
        else session.readyB = true;

        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) targetSocket.emit('tradePartnerReady');

        // 両者確定でトレード実行
        if (session.readyA && session.readyB) {
            socket.emit('tradeCompleted', {
                lostItems: session.offerA,
                gainedItems: session.offerB
            });
            if (targetSocket) {
                targetSocket.emit('tradeCompleted', {
                    lostItems: session.offerB,
                    gainedItems: session.offerA
                });
            }
            delete tradeSessions[key];
        }
    });

    // キャンセル
    socket.on('tradeCancel', ({ targetId }) => {
        const key = getSessionKey(playerId, targetId);
        delete tradeSessions[key];
        const targetSocket = findSocketByPlayerId(io, targetId);
        if (targetSocket) targetSocket.emit('tradeCancelled', { reason: '相手がキャンセルしました' });
    });

    // 切断時
    socket.on('disconnect', () => {
        Object.entries(tradeSessions).forEach(([key, session]) => {
            if (session.playerA === playerId || session.playerB === playerId) {
                const otherId = session.playerA === playerId ? session.playerB : session.playerA;
                const otherSocket = findSocketByPlayerId(io, otherId);
                if (otherSocket) otherSocket.emit('tradeCancelled', { reason: '相手が切断しました' });
                delete tradeSessions[key];
            }
        });
    });
};
