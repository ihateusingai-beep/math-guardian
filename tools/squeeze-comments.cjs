'use strict';
// tools/squeeze-comments.cjs — 安全嘅註解清理器（cycle111h）
//
// 點解要有呢個工具：
//   專案測試有一批斷言用**註解文字做定位器**（例如 `/cycle65: boss dual only .../`）。
//   即係話「註解內容」係測試契約一部分 → 一刀切清理就會爆 gate，而且爆得莫名其妙。
//   ⚠️ 同一個原理亦見 `tests/generator-audit.js` 嘅 module 抽取（已改成 code-based marker）。
//
// 做法（**靠 gate 實測，唔靠人手維護 protected list**）：
//   逐條候選改動 → 寫檔 → 跑 gate → 任何一條爆 → 還原原文 → 記低「load-bearing」
//   ⇒ 測試靠嚟定位嘅註解會自動保住，而且唔使人知道佢係邊條。
//
// 用法：
//   node tools/squeeze-comments.cjs --dry            # 只報告，唔改檔
//   node tools/squeeze-comments.cjs                  # 實際清理
//   node tools/squeeze-comments.cjs --file app.js    # 只處理指定檔（可重複）
//
// 規則：
//   A) 註解內嘅 **cycle 標記**（`V3.6 cycle83 C2:` / `cycle44/76/89:` / `cycle72 —` …）
//      → 剝走標記 + 分隔符，**保留描述文字**
//   B) 剝完之後註解冇內容 → 整段刪
//   C) 含決策理由標記嘅註解 → **完全唔郁**（用家決定：保留所有「⚠️ 點解咁做」註解）
//
// 安全：
//   - template literal 內嘅行唔郁（backtick parity 掃描 + 內容前後比對）
//   - `<script>` 區內嘅 markup 註解唔郁（HTML 入面 JS 字串唔會被當註解改）
//   - 每次改動後跑 gate（regression / generator-audit / asset-audit / audio-audit）
//   - 完咗跑 `node --check app.js`
//
// 退出碼：0 = 成功（部分註解會因 gate 而保留）；1 = 有 gate 爆 / 語法錯。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GATES = ['regression', 'generator-audit', 'asset-audit', 'audio-audit'];

// ---- 決策理由標記：命中即「唔准郁」----
const RATIONALE = new RegExp([
  '⚠️', '點解', '因為', '原因', '唔可以', '唔好', '唔准', '唔應', '必須',
  '注意', '否則', '避免', '防止', '只准', '唔會', '應該', '切勿', '一旦',
  '除非', '要小心', 'hardcode', '唔好喺', '唔好改', '唔好動', '唔好再',
  '唔好意思', '唔好亂', '唔好隨便', '保住', '守門', '唔好手改',
  '之前', '原本', '原來', '所以', '取代', '已修', '修正'
].join('|'));

// ---- cycle 標記（統一）----
// 支援：`V3.6 cycle83 C2:` · `cycle44/76/89:` · `cycle72 —` · `V3.5-cycle16:` · `cycle69 punchier`
const CYCLE_MARK = /(?:V3\.[56](?:\s*-\s*|\s+))?cycle\d+[a-z]?(?:\s*(?:\/|,|\s)\s*[A-Za-z]?\d+)*\s*(?:[:：—–-]\s*)?/i;
const HAS_CYCLE = /cycle\d/i;

// ---- template literal 掃描 ----
// ⚠️ offset 一定要用「行首絕對位置 + 行內索引」計 —— 逐字累加會令 pos 漂移，
//    刪一行就錯位（cycle111h 實測踩過，差啲全部改動被 template guard 誤殺）。
function templateRegions(text) {
  const lines = text.split('\n');
  const starts = [];
  let off = 0;
  for (const L of lines) { starts.push(off); off += L.length + 1; }
  const regions = [];
  let inTpl = false, start = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], base = starts[i];
    for (let j = 0; j < L.length; j++) {
      const c = L[j];
      if (inTpl) {
        if (c === '\\') { j++; continue; }
        if (c === '`') { inTpl = false; regions.push(text.slice(start, base + j)); }
        continue;
      }
      if (c === '/' && L[j + 1] === '/') break;
      if (c === '`') { inTpl = true; start = base + j; }
    }
  }
  if (inTpl) regions.push(text.slice(start));
  return regions;
}

function templateMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let inTpl = false;
  for (let i = 0; i < lines.length; i++) {
    mask[i] = inTpl;
    const L = lines[i];
    for (let j = 0; j < L.length; j++) {
      const c = L[j];
      if (inTpl) {
        if (c === '\\') { j++; continue; }
        if (c === '`') inTpl = false;
        continue;
      }
      if (c === '/' && L[j + 1] === '/') break;
      if (c === '`') inTpl = true;
    }
  }
  return mask;
}

// `<script>...</script>` 區段（markup 註解掃描要跳過）
function scriptRegions(text) {
  const re = /<script\b[\s\S]*?<\/script>/gi;
  const out = [];
  let m;
  while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
  return out;
}

function runGate(name) {
  try {
    execFileSync('node', [path.join(ROOT, 'tests', name + '.js')], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT,
      // MG_SQUEEZE_IN_PROGRESS：畀 regression 嘅 T111h-09（「清理完成」end-state 斷言）
      // 暫時豁免 —— 否則工具會被自己嘅守門擋死（每改一條 → gate 爆 → 全部還原）。
      env: Object.assign({}, process.env, { MG_SQUEEZE_IN_PROGRESS: '1' })
    });
    return null;
  } catch (e) {
    const out = String(e.stdout || '') + String(e.stderr || '');
    return {
      gate: name,
      fails: out.split('\n').filter((l) => l.includes('❌') || l.includes('✗')).slice(0, 4)
    };
  }
}

function gatesAllOk() {
  for (const g of GATES) {
    const err = runGate(g);
    if (err) return err;
  }
  return null;
}

// ---- args ----
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const fileArgs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--file' && argv[i + 1]) { fileArgs.push(argv[++i]); }
}
const TARGETS = (fileArgs.length ? fileArgs : ['app.js', 'index.html']).map((f) => path.join(ROOT, f));

const report = [];
let exitCode = 0;

/** 剝走註解內容入面嘅 cycle 標記；回傳 null = 冇得改 */
function stripCycleFromContent(content) {
  if (!HAS_CYCLE.test(content)) return null;
  if (RATIONALE.test(content)) return null;      // Rule C：完全唔郁
  const next = content.replace(CYCLE_MARK, '');
  if (next === content) return null;
  const tidy = next.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
  return tidy;
}

// ===== markup 註解（`<!-- -->` / `/* */`，只限 HTML 檔、且唔喺 <script> 內）=====
function markupCandidates(text) {
  const scripts = scriptRegions(text);
  const inScript = (pos) => scripts.some((r) => pos >= r[0] && pos < r[1]);
  const re = /<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    if (inScript(m.index)) continue;
    const isHtml = m[0].startsWith('<!--');
    const open = isHtml ? '<!--' : '/*';
    const close = isHtml ? '-->' : '*/';
    const inner = m[0].slice(open.length, m[0].length - close.length);
    const nlIdx = inner.indexOf('\n');
    const head = nlIdx === -1 ? inner : inner.slice(0, nlIdx);
    const tail = nlIdx === -1 ? '' : inner.slice(nlIdx);
    const newHead = stripCycleFromContent(head);
    if (newHead === null) continue;
    const newInner = newHead + tail;
    const out2 = newInner.trim() === '' ? '' : open + newInner + close;
    out.push({ start: m.index, end: m.index + m[0].length, raw: m[0], next: out2 });
  }
  return out;
}

// ===== JS 行註解 =====
function jsCandidates(lines, mask) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (mask[i]) continue;                 // template literal 內 → 唔郁
    if (line.includes('`')) continue;      // 有 backtick → 保守唔郁
    const trimmed = line.trim();

    // (1) 整行 block 註解 `/* ... */` / `/** ... */`
    const block = /^(\s*)(\/\*\*?)([\s\S]*?)(\*\/)\s*$/.exec(line);
    if (block) {
      const next = stripCycleFromContent(block[3]);
      // ⚠️ block[1]=縮排 · block[2]=開頭 `/*` · block[3]=內容 · block[4]=結尾 `*/`
      //    —— 漏咗 block[2] 就會整段變成「淨低 */」→ syntax error（cycle111h 實測）
      if (next !== null) out.push({
        i, kind: 'block',
        next: next === '' ? null : block[1] + block[2] + ' ' + next + ' ' + block[4]
      });
      continue;
    }

    // (2) 整行 `//` 註解
    if (trimmed.startsWith('//')) {
      const indent = line.slice(0, line.length - line.trimStart().length);
      const content = trimmed.replace(/^\/+\s*/, '');
      const next = stripCycleFromContent(content);
      if (next === null) continue;
      out.push({ i, kind: 'full', next: next === '' ? null : indent + '// ' + next });
      continue;
    }

    // (3) 行尾 `//` 註解（`://` 唔算）
    const idx = findTrailComment(line);
    if (idx === -1) continue;
    const content = line.slice(idx + 2);
    const next = stripCycleFromContent(content);
    if (next === null) continue;
    out.push({
      i, kind: 'trail',
      next: next === '' ? line.slice(0, idx).replace(/[ \t]+$/, '')
        : line.slice(0, idx) + '// ' + next
    });
  }
  return out;
}

/** 搵行尾 `//` 嘅位置（跳過 `://` 同引號入面嘅 `//`）；搵唔到返 -1 */
function findTrailComment(line) {
  let inS = null, inT = false;
  for (let j = 0; j < line.length - 1; j++) {
    const c = line[j];
    if (inT) { if (c === '\\') { j++; continue; } if (c === '`') inT = false; continue; }
    if (inS) { if (c === '\\') { j++; continue; } if (c === inS) inS = null; continue; }
    if (c === '`') { inT = true; continue; }
    if (c === '"' || c === "'") { inS = c; continue; }
    if (c === '/' && line[j + 1] === '/') {
      if (j > 0 && line[j - 1] === ':') continue;   // `://`
      return j;
    }
  }
  return -1;
}

function applyJsTransform(lines, cand) {
  if (cand.next === null) {
    // 註解清空 → 整行刪
    return lines.slice(0, cand.i).concat(lines.slice(cand.i + 1));
  }
  const out = lines.slice();
  out[cand.i] = cand.next;
  return out;
}

for (const TARGET of TARGETS) {
  if (!fs.existsSync(TARGET)) {
    console.log('SKIP (唔存在): ' + path.relative(ROOT, TARGET));
    continue;
  }
  const isHtml = TARGET.endsWith('.html');
  const orig = fs.readFileSync(TARGET, 'utf8');

  if (isHtml) {
    // ===== markup 註解 =====
    const cands = markupCandidates(orig);
    let text = orig;
    for (let k = cands.length - 1; k >= 0; k--) {
      const c = cands[k];
      if (c.next === c.raw) continue;
      const trial = text.slice(0, c.start) + c.next + text.slice(c.end);
      if (!DRY) fs.writeFileSync(TARGET, trial);
      const failed = DRY ? null : gatesAllOk();
      if (failed) {
        if (!DRY) fs.writeFileSync(TARGET, text);
        report.push({
          file: path.relative(ROOT, TARGET), line: 0, kind: 'markup', status: 'KEPT',
          text: c.raw.replace(/\s+/g, ' ').slice(0, 70),
          why: (failed.fails || []).join(' | ').slice(0, 200)
        });
      } else {
        text = trial;
        report.push({
          file: path.relative(ROOT, TARGET), line: 0, kind: 'markup',
          status: c.next === '' ? 'DELETED' : 'NORMALIZED',
          text: c.raw.replace(/\s+/g, ' ').slice(0, 70)
        });
      }
    }
    if (!DRY) fs.writeFileSync(TARGET, text);
    console.log(path.relative(ROOT, TARGET) + ': ' + fs.statSync(TARGET).size + ' bytes' +
      (DRY ? ' (dry run，冇改)' : ''));
    continue;
  }

  // ===== JS 行註解 =====
  // ⚠️ 候選一定要**由尾行往前**處理 —— 刪行會令之後嘅索引偏移，
  //    正向迭代會將 transform 套落錯行（cycle111h 實測：搞到 syntax error，
  //    守門捉到先還原，但會白白 miss 好多條）。
  const origRegions = templateRegions(orig);
  const origLines = orig.split('\n');
  const mask = templateMask(origLines);
  let current = origLines.slice();
  const cands = jsCandidates(current, mask);

  for (let n = cands.length - 1; n >= 0; n--) {
    const cand = cands[n];
    const line = current[cand.i];
    if (line === undefined) continue;
    const trialLines = applyJsTransform(current, cand);
    if (!trialLines) continue;

    if (!DRY) fs.writeFileSync(TARGET, trialLines.join('\n'));

    let failed = null;
    const regions = templateRegions(trialLines.join('\n'));
    if (JSON.stringify(regions) !== JSON.stringify(origRegions)) {
      failed = { gate: 'template-guard', fails: ['template literal 內容被改動'] };
    } else if (!DRY) {
      failed = gatesAllOk();
    }

    if (failed) {
      if (!DRY) {
        fs.writeFileSync(TARGET, current.join('\n'));
        // debug：dump 令 gate 爆嘅 trial（用嚟查語法/索引問題）
        try { fs.writeFileSync('/tmp/mg-squeeze-fail.js', trialLines.join('\n')); } catch (e) {}
      }
      report.push({
        file: path.relative(ROOT, TARGET), line: cand.i + 1, kind: cand.kind, status: 'KEPT',
        text: line.trim().slice(0, 70), why: (failed.fails || []).join(' | ').slice(0, 200)
      });
    } else {
      current = trialLines;
      report.push({
        file: path.relative(ROOT, TARGET), line: cand.i + 1, kind: cand.kind,
        status: cand.kind === 'delete' ? 'DELETED' : 'NORMALIZED', text: line.trim().slice(0, 70)
      });
    }
  }

  if (!DRY) {
    fs.writeFileSync(TARGET, current.join('\n'));
    try {
      if (TARGET.endsWith('.js')) execFileSync('node', ['--check', TARGET], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      exitCode = 1;
      console.log('❌ node --check 失敗: ' + path.relative(ROOT, TARGET));
      console.log(String(e.stderr || e.stdout).slice(0, 400));
    }
  }
  console.log(path.relative(ROOT, TARGET) + ': ' + fs.statSync(TARGET).size + ' bytes' +
    (DRY ? ' (dry run，冇改)' : ''));
}

const cnt = (s) => report.filter((r) => r.status === s).length;
console.log('\nDELETED=' + cnt('DELETED') + '  NORMALIZED=' + cnt('NORMALIZED') + '  KEPT=' + cnt('KEPT'));
console.log('\n=== KEPT（gate 話唔可以郁 —— 測試靠呢段註解做定位器）===');
for (const r of report.filter((x) => x.status === 'KEPT')) {
  console.log('  ' + r.file + (r.line ? ':' + r.line : '') + '  ' + r.text);
  if (r.why) console.log('      → ' + r.why);
}
if (DRY) console.log('\n(dry run：冇改任何檔案)');

process.exit(exitCode);
