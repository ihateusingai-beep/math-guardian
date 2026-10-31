#!/usr/bin/env node
// tools/asset-inventory.cjs — 資產 + 動畫盤點
//
// 為咩要入 repo（cycle111e）：
//   docs/VISUAL_QUALITY_RUBRIC.md §9 嘅改善計劃，之前係**寫喺紙上**，
//   冇任何可執行嘅方法知道「而家仲剩幾多 emoji-as-chrome」「幾多 sprite 離色板」
//   「有邊啲 keyframes 係死嘅」→ 計劃會過時，冇人可以驗證。
//   ⚠️ 呢個 repo 嘅教訓（cycle110b / 111e）：驗證工具擺 /tmp = 換部機就冇晒防線。
//
// 用法:
//   node tools/asset-inventory.cjs            # 人讀嘅報告
//   node tools/asset-inventory.cjs --json     # 機器讀（將來做 gate 用）
//
// 退出 0 = 跑完（呢個係「盤點」唔係「守門」；守門係 tests/asset-audit.js）

'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const src = html + '\n' + js;

// docs/ART_STYLE_GUIDE.md §4.1 核心 12 色 + §4.2 材質 ramp
const PALETTE = new Set([
  '#0a1729', '#1e3a5f', '#4a6fa5', '#f0f9ff', '#cbd5e1', '#475569',
  '#0f172a', '#fbbf24', '#3b82f6', '#a855f7', '#dc2626',
  '#e2e8f0', '#94a3b8', '#64748b', '#1e293b',
  '#fcd34d', '#d97706', '#78350f',
  '#fde68a', '#b45309',
  '#93c5fd', '#1e3a8a',
  '#bae6fd', '#38bdf8', '#0369a1',
  '#fda4af', '#ef4444', '#991b1b', '#450a0a',
]);

// ---------- symbol 盤點 ----------
const symbols = [];
for (const m of html.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
  const attrs = m[1], body = m[2];
  const id = (attrs.match(/id="([^"]+)"/) || [])[1];
  const viewBox = (attrs.match(/viewBox="([^"]+)"/) || [])[1];
  const cols = [...new Set((body.match(/#[0-9a-fA-F]{6}/g) || []).map(c => c.toLowerCase()))];
  symbols.push({
    id, viewBox,
    bytes: Buffer.byteLength(m[0], 'utf8'),
    offPalette: cols.filter(c => !PALETTE.has(c)),
    shapes: (body.match(/<rect\b/g) || []).length + (body.match(/<path\b/g) || []).length,
  });
}

// 引用：靜態 <use href> + 動態（字串）
const staticUse = {};
for (const m of src.matchAll(/<use\b[^>]*href="#([^"]+)"/g)) {
  staticUse[m[1]] = (staticUse[m[1]] || 0) + 1;
}
for (const s of symbols) {
  s.staticRefs = staticUse[s.id] || 0;
  s.dynamicRefs = new RegExp(`['"]${s.id}['"]`).test(src) ? 1 : 0;
  s.totalRefs = s.staticRefs + s.dynamicRefs;
}

// ---------- keyframes 盤點 ----------
const keyframes = [...html.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)\s*\{/g)].map(m => m[1]);
// animation / animation-name shorthand 值入面嘅第一個 token 就係動畫名
const animNames = new Set();
for (const m of src.matchAll(/animation(?:-name)?\s*:\s*([^;{}]+)/g)) {
  for (const tok of m[1].matchAll(/([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    if (keyframes.includes(tok[1])) animNames.add(tok[1]);
  }
}
// JS inline cssText 都可能用 animation
for (const m of js.matchAll(/animation\s*:\s*([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
  if (keyframes.includes(m[1])) animNames.add(m[1]);
}
// ⚠️ JS 可以用 property 賦值掛動畫（`el.style.animation = 'screen-alert 1.6s'`）
//    —— 淨捉 CSS 嘅 `animation:` 會把呢類誤判成死 keyframes。
for (const m of js.matchAll(/style\.animation\s*=\s*['"]([^'"]+)['"]/g)) {
  for (const tok of m[1].matchAll(/([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    if (keyframes.includes(tok[1])) animNames.add(tok[1]);
  }
}
const deadKeyframes = keyframes.filter(k => !animNames.has(k));

// ---------- emoji-as-chrome 盤點 ----------
const isEmoji = (cp) =>
  (cp >= 0x1F000 && cp <= 0x1FAFF) || (cp >= 0x2600 && cp <= 0x27BF) ||
  (cp >= 0x2B00 && cp <= 0x2BFF) || (cp >= 0x2190 && cp <= 0x21FF);
const SKIP = new Set([0xFE0F, 0x200D, 0x20E3]);
const emojisIn = (t) => [...t].filter(c => isEmoji(c.codePointAt(0)) && !SKIP.has(c.codePointAt(0)));

// <button> 內嘅 emoji（CSS 註解入面嘅假陽性要剔走）
const commentRanges = [];
for (const m of html.matchAll(/\/\*[\s\S]*?\*\//g)) commentRanges.push([m.index, m.index + m[0].length]);
for (const m of html.matchAll(/<!--[\s\S]*?-->/g)) commentRanges.push([m.index, m.index + m[0].length]);
const inComment = (i) => commentRanges.some(([a, b]) => i >= a && i < b);

const buttonEmoji = [];
for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
  if (inComment(m.index)) continue;
  const es = emojisIn(m[1]);
  if (!es.length) continue;
  const attrs = m[0].slice(0, m[0].indexOf('>'));
  const id = (attrs.match(/id="([^"]+)"/) || [])[1] || '';
  const cls = (attrs.match(/class="([^"]+)"/) || [])[1] || '';
  buttonEmoji.push({ id, cls: cls.split(/\s+/).slice(0, 2).join(' '), emoji: [...new Set(es)].join('') });
}

// ---------- 報告 ----------
const report = {
  symbols: {
    total: symbols.length,
    offPalette: symbols.filter(s => s.offPalette.length).length,
    offPaletteBytes: symbols.filter(s => s.offPalette.length).reduce((a, s) => a + s.bytes, 0),
    deadRefs: symbols.filter(s => s.totalRefs === 0).map(s => s.id),
    lowRefs: symbols.filter(s => s.totalRefs <= 1).map(s => s.id),
  },
  keyframes: {
    total: keyframes.length,
    referenced: animNames.size,
    dead: deadKeyframes,
  },
  emojiChrome: {
    buttons: buttonEmoji.length,
    distinct: [...new Set(buttonEmoji.flatMap(b => [...b.emoji]))].length,
    items: buttonEmoji,
  },
  css: {
    animationShorthand: (src.match(/animation\s*:/g) || []).length,
    transition: (src.match(/(?<![\w-])transition\s*:/g) || []).length,
    transform: (src.match(/(?<![\w-])transform\s*:/g) || []).length,
    filter: (src.match(/(?<![\w-])filter\s*:/g) || []).length,
    willChange: (src.match(/will-change\s*:/g) || []).length,
    contain: (src.match(/(?<![\w-])contain\s*:/g) || []).length,
    reducedMotionBlocks: (src.match(/prefers-reduced-motion/g) || []).length,
  },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const L = (t) => console.log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72));

L('【A】SPRITE');
console.log(`  總數              ${report.symbols.total}`);
console.log(`  離 §4 色板        ${report.symbols.offPalette} 隻 / ${report.symbols.offPaletteBytes} B`);
console.log(`  冇任何引用        ${report.symbols.deadRefs.length} 隻 ${report.symbols.deadRefs.join(' ') || '—'}`);
console.log(`  只出現 ≤1 次      ${report.symbols.lowRefs.length} 隻`);

L('【B】ANIMATION');
console.log(`  @keyframes 總數   ${report.keyframes.total}`);
console.log(`  有引用            ${report.keyframes.referenced}`);
console.log(`  ⚠️ 死 keyframes   ${report.keyframes.dead.length} 個 → ${report.keyframes.dead.join(', ') || '—'}`);

L('【C】EMOJI-AS-CHROME（HTML <button> 內）');
console.log(`  仲帶 emoji 嘅掣   ${report.emojiChrome.buttons}`);
console.log(`  涉及唔同 emoji     ${report.emojiChrome.distinct} 種`);
for (const b of report.emojiChrome.items) {
  console.log(`    ${b.emoji.padEnd(4)} ${(b.id || b.cls).slice(0, 34).padEnd(34)}`);
}

L('【D】CSS 動畫屬性');
for (const [k, v] of Object.entries(report.css)) {
  console.log(`  ${k.padEnd(20)} ${v}`);
}
console.log('\n（守門 = tests/asset-audit.js · 呢個工具只做盤點）\n');
