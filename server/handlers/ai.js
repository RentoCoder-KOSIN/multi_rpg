// 敵AI（強化学習）の学習データ送受信
module.exports = function registerAIHandlers(socket, { io, aiManager }) {
    // クライアントの学習データをサーバーのAIにマージ（集合知）し、全クライアントへ配信する
    // 保存は aiManager.checkAutoSave が定期的に行う
    socket.on("aiLearnSync", ({ enemyType, qTableData }) => {
        if (!enemyType || !qTableData) return;

        aiManager.mergeClientData(enemyType, qTableData);

        io.emit("aiSharedUpdate", {
            enemyType,
            qTableData: aiManager.getAgent(enemyType).toJSON()
        });
    });

    socket.on("getSharedAI", ({ enemyType }) => {
        if (!enemyType) return;

        socket.emit("aiSharedUpdate", {
            enemyType,
            qTableData: aiManager.getAgent(enemyType).toJSON()
        });
    });

    socket.on("getAIStats", () => {
        socket.emit("aiStats", aiManager.getAllStats());
    });
};
