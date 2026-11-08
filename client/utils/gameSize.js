// ゲームの論理解像度。
// 高さは固定(640)で、幅だけを表示領域(#game-root)の縦横比に合わせて決める。
// こうすると Phaser.Scale.FIT でも左右に余白(背景の青)が出ず、ウィンドウいっぱいに表示できる。
// 高さを以前の720から640に下げた分、同じウィンドウでは全体が大きく(文字も大きく)表示される。
// ウィンドウ類の最大の高さは560(鍛冶屋)なので、640に収まる。
export const GAME_HEIGHT = 640;
const MIN_WIDTH = 800;
const MAX_WIDTH = 1800;

export function computeGameSize(el) {
    const cw = (el && el.clientWidth) || window.innerWidth;
    const ch = (el && el.clientHeight) || window.innerHeight;
    const w = Math.round(GAME_HEIGHT * cw / ch);
    return { width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)), height: GAME_HEIGHT };
}
