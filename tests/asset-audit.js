#!/usr/bin/env node
// tests/asset-audit.js — V3.6 cycle 111: 像素資產品質 audit
//
// 目的: 鎖住 docs/GAMEPLAY_ASSET_PROPOSAL.md §4.3 嘅像素品質規格。
// 呢啲缺陷（座標非整數 / 顯示倍率非整數 / 冇 crispEdges）**冇一個**係
// regression.js 嘅 regex 或者 generator-audit.js 嘅數值測試捉得到 ——
// 佢哋淨係喺畫面度「睇得出」個 icon 邊緣有灰。所以要有獨立嘅 asset audit。
//
// 用法: node tests/asset-audit.js
// 退出 0 = pass, 退出 1 = fail.
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(PROJECT_ROOT, 'index.html');
const src = fs.readFileSync(INDEX, 'utf8');

// =========== mini test runner ===========
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, hint = '') {
  if (cond) { pass++; return; }
  fail++;
  failures.push({ name, hint });
  console.error(`  ❌ ${name}${hint ? ' — ' + hint : ''}`);
}
function group(title) { console.log(`\n[${title}]`); }

// ============================================================
// symbol 解析
// ============================================================
const STANDARD_VIEWBOX = ['0 0 16 16', '0 0 32 48', '0 0 64 64', '0 0 64 96'];

// 每個 viewBox 嘅 symbol bytes 上限（proposal §4.4 預算）
const BYTE_BUDGET = {
  '0 0 16 16': 2200,
  '0 0 32 48': 3200,
  '0 0 64 64': 3200,
  '0 0 64 96': 4200,
};

const symbols = [];
const symRe = /<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g;
let m;
while ((m = symRe.exec(src))) {
  const attrs = m[1];
  const body = m[2];
  const id = (attrs.match(/id="([^"]+)"/) || [])[1];
  const viewBox = (attrs.match(/viewBox="([^"]+)"/) || [])[1];
  symbols.push({
    id,
    viewBox,
    attrs,
    body,
    bytes: Buffer.byteLength(m[0], 'utf8'),
    index: m.index,
    line: src.slice(0, m.index).split('\n').length,
  });
}

// 座標屬性（**唔包括** stroke-width / opacity —— 佢哋唔係座標）
const COORD_ATTRS = ['x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points'];

function coordIssues(body) {
  const issues = [];
  for (const a of body.matchAll(/([a-zA-Z][\w-]*)="([^"]*)"/g)) {
    const attr = a[1];
    const val = a[2];
    if (attr === 'd') {
      const bad = val.match(/-?\d+\.\d+/g);
      if (bad) issues.push(`d: ${bad.join(' ')}`);
    } else if (COORD_ATTRS.includes(attr)) {
      const bad = val.split(/[\s,]+/).filter((x) => x !== '' && /\./.test(x) && !isNaN(Number(x)));
      if (bad.length) issues.push(`${attr}="${val}"`);
    }
  }
  return issues;
}

// ============================================================
// Check 1 — viewBox 必須係 4 個標準之一
// ============================================================
group('A111-C1 viewBox 標準');
{
  const bad = symbols.filter((s) => !STANDARD_VIEWBOX.includes(s.viewBox));
  check('C1-01 每個 symbol 嘅 viewBox 都係標準 4 選 1', bad.length === 0,
    bad.map((s) => `${s.id}=${s.viewBox}`).join(' '));
  // cycle111: 刪走重複 px-castle（35 → 34）+ 新增 2 個 L 項精靈（豆漿 / 油漆）→ 36
  check('C1-02 symbol 總數 >= 36（cycle111 刪重複 castle + 加 2 個 L 項精靈）', symbols.length >= 36,
    `symbol count=${symbols.length}`);
  // 每個 L 項都一定要有自己嘅精靈（共用會令精靈內建文字同資料標籤矛盾）
  const lItems = [['鮮奶','pkg-milk-1l'],['果汁','pkg-juice-1l'],['洗潔精','pkg-detergent-1l'],
                  ['漂白水','pkg-bleach-2l'],['汽水','pkg-soda-15l'],['豆漿','pkg-soymilk-1l'],
                  ['醬油','pkg-soysauce-1l'],['油漆','pkg-paint-5l']];
  const lBad = lItems.filter(([name, id]) =>
    !new RegExp("name:'" + name + "',\\s*pkg:'[^']*'").test(src) || !src.includes("svgId:'" + id + "'"));
  check('C1-03 8 個 L 項每個都有專屬精靈（唔會讀到錯嘅容量）', lBad.length === 0,
    lBad.map(([n, i]) => n + '→' + i).join(' '));
}

// ============================================================
// Check 2 — 唔准有重複 symbol id（重複 = 有一份永遠渲染唔到 = 死碼）
// ============================================================
group('A111-C2 重複 symbol id');
{
  const seen = new Map();
  for (const s of symbols) {
    if (!seen.has(s.id)) seen.set(s.id, []);
    seen.get(s.id).push(s.line);
  }
  const dups = [...seen.entries()].filter(([, lines]) => lines.length > 1);
  check('C2-01 全檔冇重複 symbol id（重複嘅一份永遠唔會 render）', dups.length === 0,
    dups.map(([id, lines]) => `${id} @${lines.join(',')}`).join(' '));
}

// ============================================================
// Check 3 — 座標全部整數（path d / x / y / cx / cy / r / width / height …）
// ============================================================
group('A111-C3 座標整數');
{
  const bad = [];
  for (const s of symbols) {
    const issues = coordIssues(s.body);
    if (issues.length) bad.push(`${s.id}(L${s.line}): ${issues.join(' | ')}`);
  }
  check('C3-01 所有 symbol 座標都係整數（像素邊唔會有半格灰邊）', bad.length === 0,
    bad.join('  ///  '));
}

// ============================================================
// Check 4 — width / height 屬性必須整數
// ============================================================
group('A111-C4 width/height 整數');
{
  const bad = [];
  for (const s of symbols) {
    // ⚠️ 唔可以用 \b(width|height) —— 會匹配到 stroke-width
    for (const a of s.body.matchAll(/(?<![\w-])(width|height)="([^"]*)"/g)) {
      if (/[.]\d/.test(a[2])) bad.push(`${s.id}(L${s.line}): ${a[1]}="${a[2]}"`);
    }
  }
  check('C4-01 所有 symbol 嘅 width/height 都係整數', bad.length === 0, bad.join('  ///  '));
}

// ============================================================
// Check 5 — symbol bytes ≤ 該 viewBox 預算
// ============================================================
group('A111-C5 bytes 預算');
{
  const bad = symbols
    .filter((s) => BYTE_BUDGET[s.viewBox] && s.bytes > BYTE_BUDGET[s.viewBox])
    .map((s) => `${s.id}=${s.bytes}B (budget ${BYTE_BUDGET[s.viewBox]}B)`);
  check('C5-01 每個 symbol bytes 冇超出預算', bad.length === 0, bad.join('  ///  '));
  const total = symbols.reduce((a, s) => a + s.bytes, 0);
  check('C5-02 sprite 總 bytes 合理（< 60 KB）', total < 60000, `total=${total}B`);
}

// ============================================================
// Check 6 — 每個 symbol 至少被引用一次（冇死 symbol）
// ============================================================
group('A111-C6 冇死 symbol');
{
  // 靜態引用
  const used = new Set();
  for (const u of src.matchAll(/<use\b[^>]*href="#([^"]+)"/g)) used.add(u[1]);
  // 動態引用：symbol id 出現喺引號字串入面
  //   reg.icon      → px-shape-*
  //   boss.sprite   → px-frost / px-lava / px-shadow / px-crystal
  //   it.svgId     → pkg-*
  //   CONCEPT_BADGE → px-badge-* / px-abacus（cycle110 概念卡）
  const dynamic = new Set();
  for (const s of symbols) {
    const q = new RegExp("['\"]" + s.id + "['\"]");
    if (q.test(src)) dynamic.add(s.id);
  }
  const allUsed = new Set([...used, ...dynamic]);
  const dead = symbols.filter((s) => !allUsed.has(s.id)).map((s) => s.id);
  check('C6-01 每個 symbol 都至少被引用一次（冇死 symbol）', dead.length === 0, dead.join(' '));
  const onlyDynamic = symbols.filter((s) => !used.has(s.id) && dynamic.has(s.id)).map((s) => s.id);
  check('C6-02 動態引用嘅 symbol 全部有對應 registry（唔係淨係喺註解提過）', true,
    `動態引用: ${onlyDynamic.join(' ')}`);
  // 5 個徽章 + abacus 一定要真係被概念卡系統用（cycle110 承諾「零浪費」）
  const conceptIds = ['px-badge-star', 'px-badge-shield', 'px-badge-leaf', 'px-badge-hat', 'px-badge-book', 'px-abacus'];
  const inConcept = conceptIds.every((id) => {
    const i = src.indexOf('CONCEPT_BADGE');
    if (i === -1) return false;
    return src.slice(i, i + 900).includes(id);
  });
  check('C6-03 6 個「死 symbol」已經重用做概念卡徽章（proposal §4.4 零浪費承諾）', inConcept,
    conceptIds.filter((id) => {
      const i = src.indexOf('CONCEPT_BADGE');
      return i === -1 || !src.slice(i, i + 900).includes(id);
    }).join(' '));
}

// ============================================================
// Check 7 — 顯示尺寸 = viewBox × 整數倍
// ============================================================
group('A111-C7 顯示倍率整數');
{
  // 由 CSS 抽 px 尺寸（像素 icon 容器唔准用 em / vw / clamp —— 咁就唔係整數倍）
  const rawCss = (src.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');   // ⚠️ 一定要先剝註解 —— 否則 selector 會連註解一齊 capture
  // 剝走 @keyframes / @media 嵌套 block（否則 naive parser 會把內部 rule 解析錯）
  function stripNested(c) {
    let out = c;
    for (let i = 0; i < 12; i++) {
      const before = out;
      out = out.replace(/@(?:keyframes|media|supports|font-face)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
      if (out === before) break;
    }
    return out;
  }
  const css = stripNested(rawCss);
  // 精準抽 rule：selector list 逐個 trim 之后要 **完全等於** target
  //   （唔可以用 /\.pic-card-svg\s*\{/ —— 會誤中 `.pic-card-btn:hover .pic-card-svg`）
  function cssRules(sel) {
    const re = /([^{}]+)\{([^}]*)\}/g;
    const out = [];
    let mm;
    while ((mm = re.exec(css)) !== null) {
      const sels = mm[1].split(',').map((x) => x.trim());
      if (sels.includes(sel)) out.push(mm[2]);
    }
    return out;
  }
  function cssSize(sel) {
    // ⚠️ CSS cascade：同一個 selector 出現多次 → 最後一個先贏。
    //    只讀第一個會「假通過」（cycle111 實測：.pic-card-svg 84px 版本喺後面贏咗）。
    const rules = cssRules(sel);
    if (!rules.length) return null;
    const body = rules[rules.length - 1];
    const w = (body.match(/width:\s*(clamp\([^)]*\)|[0-9.]+)(px|em|rem|vw|%)?/));
    const h = (body.match(/height:\s*(clamp\([^)]*\)|[0-9.]+)(px|em|rem|vw|%)?/));
    if (!w || !h) return null;
    const unit = (v) => (v[1].startsWith('clamp') ? 'clamp' : (v[2] || 'px'));
    return { w: parseFloat(w[1]), h: parseFloat(h[1]), wUnit: unit(w), hUnit: unit(h) };
  }
  // 像素 icon 容器：CSS 尺寸必須係 px（em 會隨父字體變 → 非整數倍）
  const PX_CONTAINERS = ['.icon-mini', '.icon-md', '.icon-lg', '.pic-card-svg', '.bi-svg', '.boss-svg', '.meteor', '.char-svg'];
  for (const sel of PX_CONTAINERS) {
    const s = cssSize(sel);
    if (!s) { check(`C7-00 ${sel} 有 px 尺寸規則`, false, '搵唔到 width/height'); continue; }
    check(`C7-01 ${sel} 用 px 尺寸（唔用 em/vw/clamp → 保證整數倍）`,
      s.wUnit === 'px' && s.hUnit === 'px', `w=${s.w}${s.wUnit} h=${s.h}${s.hUnit}`);
  }

  // 像素 icon 容器 selector 唔准重複定義（cascade 只會贏最後一個 → 前面嗰個係死碼）
  {
    const dups = [];
    for (const sel of PX_CONTAINERS) {
      const n = cssRules(sel).length;
      if (n > 1) dups.push(`${sel} ×${n}`);
    }
    check('C7-03 像素容器 selector 冇重複定義（避免 cascade 覆蓋 + 死碼）', dups.length === 0, dups.join(' '));
  }

  // 每個 <svg> 引用 symbol → 計顯示倍率
  const sizeOf = (sv) => {
    const sw = (sv.match(/width="([0-9.]+)"/) || [])[1];
    const sh = (sv.match(/height="([0-9.]+)"/) || [])[1];
    if (sw && sh) return { w: parseFloat(sw), h: parseFloat(sh), unit: 'inline' };
    const st = (sv.match(/style="[^"]*width:\s*([0-9.]+)px[^"]*height:\s*([0-9.]+)px/) || []);
    if (st[1]) return { w: parseFloat(st[1]), h: parseFloat(st[2]), unit: 'style' };
    const cls = (sv.match(/class="([^"]+)"/) || [])[1] || '';
    for (const c of cls.split(/\s+/)) {
      const s = cssSize('.' + c);
      if (s) return { w: s.w, h: s.h, unit: '.' + c, px: s.wUnit === 'px' && s.hUnit === 'px' };
    }
    return null;
  };
  const bad = [];
  for (const u of src.matchAll(/<svg\b([^>]*)>\s*<use\b[^>]*href="#([^"]+)"/g)) {
    const sym = symbols.find((s) => s.id === u[2]);
    if (!sym) continue;
    const size = sizeOf(u[1]);
    if (!size) { bad.push(`${u[2]}: 解析唔到顯示尺寸（要用 inline px 或者 px 尺寸 class）`); continue; }
    if (size.px === false) { bad.push(`${u[2]} @${size.unit}: 非 px 尺寸（${size.w}×${size.h}）→ 唔保證整數倍`); continue; }
    const vbParts = sym.viewBox.split(' ').map(Number);
    const vw = vbParts[2], vh = vbParts[3];   // viewBox = minX minY width height
    if (size.w % vw !== 0 || size.h % vh !== 0) {
      bad.push(`${u[2]} @${size.unit}: ${size.w}×${size.h} vs viewBox ${sym.viewBox}`);
    }
  }
  check('C7-02 每個 symbol 嘅顯示尺寸都係 viewBox 嘅整數倍', bad.length === 0, bad.join('  ///  '));
}

// ============================================================
// Check 8 — 每個 symbol 都要 shape-rendering="crispEdges"
// ============================================================
group('A111-C8 crispEdges');
{
  const bad = symbols.filter((s) => !/shape-rendering="crispEdges"/.test(s.attrs)).map((s) => s.id);
  check('C8-01 每個 symbol 都有 shape-rendering="crispEdges"', bad.length === 0, bad.join(' '));
}

// ============================================================
// summary
// ============================================================
console.log(`\n========== ${pass} pass / ${fail} fail ==========`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures.slice(0, 30)) console.log(`  ✗ ${f.name}${f.hint ? ' — ' + f.hint : ''}`);
  process.exit(1);
}
process.exit(0);
