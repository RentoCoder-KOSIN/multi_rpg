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
abyssEnter     ///無限の深淵: ゲートから待機室へ入る（ackで結果を返す）
abyssLeave     ///待機室・ダンジョンから抜ける
abyssStart     ///待機室のホストが開始する（開始後は新しいメンバーは入れない）
abyssAdvance   ///階層クリア後、ポータルに触れて次の階へ進む
abyssSync      ///今の階層の状態を取得する（ackで返す）


サーバ送信（無限の深淵）

abyssPartyEntered  同じパーティーの誰かが待機室に入った（「参加しますか？」の通知）
abyssPartyClosed   その募集が終わった（reason: started / cancelled）
abyssRoomUpdate    待機室・挑戦中の部屋のメンバーが変わった（lastEvent: joined / left / hostChanged / rejoined）
abyssStarted       ホストが開始した（全メンバーへ。networkMapKey = abyss:<roomId>）
abyssFloorCleared  階層の敵を全滅させた（メンバーごとに抽選した報酬つき）
abyssFloorStarted  次の階層が始まった
abyssRunInvalid    参加資格の無い（終了済み・開始後の）挑戦に入ろうとした


無限の深淵のしくみ

・部屋のID = パーティーID（パーティーに入っていなければ solo-<playerId>）
・待機室 = サーバー上の居場所 abyss_lobby（Tiledのマップは無い。クライアントは AbyssLobbyScene）
・挑戦中 = マップキー abyss:<roomId> のインスタンス。敵はサーバーが出し、部屋のメンバー全員で共有する
・開始後に入れるのは、開始時の参加者本人の再接続だけ（abyssEnter で status:"started" が返る）

