// tests/source.js — app 完整原始碼嘅**單一真實來源**
//
// V3.6 cycle111h: 專案由「單檔 HTML」拆成 `index.html`（HTML + CSS + inline SVG）
// + `app.js`（主程式邏輯）。四個測試檔都要讀 app 嘅原始碼做結構/行為斷言，
// 所以呢度提供一個共用讀取器 —— **唔好各測試檔各寫一份拼接邏輯**
// （cycle111e 教訓：同一個概念有兩條路徑 → 一定會走樣）。
//
// ⚠️ 拼接順序 = HTML 先、JS 後（同原本單檔嘅順序），
//    所以跨 HTML→JS 嘅 regex（例如 `id="td-bank-inventory" ... QuestionBank.PER_TYPE_CAP`）
//    嘅距離窗口依然成立。

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const APP = path.join(ROOT, 'app.js');

/** app 完整原始碼：index.html（+ CSS + inline SVG） + app.js，按檔案順序拼接 */
function readAppSource() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const app = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8') : '';
  return html + '\n' + app;
}

/**
 * app.js 嘅內容（主程式邏輯）。
 * 拆檔之前，測試係靠「搵 HTML 入面最大嘅 inline <script>」嚟抽 module 嘅 ——
 * 拆咗之後咁做就會抽到 tailwind config，所以要改成直接讀 app.js。
 */
function readAppJs() {
  if (!fs.existsSync(APP)) return '';
  return fs.readFileSync(APP, 'utf8');
}

/**
 * 淨係 index.html（HTML + inline CSS + inline SVG symbol）。
 * ⚠️ 跨檔接線嘅斷言（例如「某個 sprite id 真係喺 index.html 有 <symbol>」）
 *    要用呢個，唔好用 readAppSource() —— 咁樣會混入 app.js，regex 會搵錯地方。
 */
function readIndexHtml() {
  return fs.readFileSync(INDEX, 'utf8');
}

module.exports = { ROOT, INDEX, APP, readAppSource, readAppJs, readIndexHtml };
