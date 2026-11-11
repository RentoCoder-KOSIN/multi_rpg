// 無限の深淵（パーティー対応）のSocketイベント。ロジックは services/abyssService.js
//
//   abyssEnter   ゲートから待機室へ入る（ack: { ok, status, room | run, error }）
//   abyssLeave   待機室・ダンジョンから抜ける
//   abyssStart   ホストが開始する（ack: { ok, error }）
//   abyssAdvance 階層クリア後、ポータルに触れて次の階へ進む（{ floor }）
//   abyssSync    今の階層の状態を取得する（ack: { ok, floor, cleared, remaining, room }）
module.exports = function registerAbyssHandlers(socket, { abyssService }) {
    const playerId = socket.data.playerId;
    const reply = (ack, result) => { if (typeof ack === "function") ack(result); };

    socket.on("abyssEnter", (_data, ack) => {
        reply(ack, abyssService.enter(socket));
    });

    socket.on("abyssLeave", (_data, ack) => {
        reply(ack, abyssService.leave(playerId));
    });

    socket.on("abyssStart", (_data, ack) => {
        reply(ack, abyssService.start(playerId));
    });

    socket.on("abyssAdvance", (data) => {
        abyssService.advance(playerId, Number(data?.floor));
    });

    socket.on("abyssSync", (_data, ack) => {
        reply(ack, abyssService.sync(playerId));
    });
};
