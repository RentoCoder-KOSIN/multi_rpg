// ゲーム内テキスト共通のフォント。
// 以前は「Press Start 2P」を使っていたが、このフォントには日本語の字形がなく、
// 小さいサイズでは日本語が別フォントにフォールバックして読みにくかった。
// OSに標準で入っている日本語ゴシック体を指定する（Webフォントと違い、
// Phaserのcanvas描画時に「まだ読み込み中」で反映されない問題が起きない）。
export const UI_FONT = '"Meiryo UI", "Yu Gothic UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Segoe UI", sans-serif';

// これより小さいと日本語が潰れて読みにくいので、テキストの最小サイズ(px)として使う
export const MIN_FONT_PX = 11;
