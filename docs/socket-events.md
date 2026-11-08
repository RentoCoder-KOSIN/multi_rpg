前提知識
socket.onは受信(イベント待ち)

socket.emitは自分だけに送る

socket.to.emitは自分以外に送る

io.to.emitは全員に送る


サーバ受信一覧



・・・socket.on・・・

connection
lobbyJoin
playerNameUpdate
lobbyReady
lobbyKick   ///機能していない
lobbyStartGame
playerMove
playerStatsUpdate
summonUpdate
newPlayer
mapChange
enemyHit    
partyInvite ///機能していない
partyJoin
partyLeave
playerHeal
playerBuff
playerSkill
disconnect