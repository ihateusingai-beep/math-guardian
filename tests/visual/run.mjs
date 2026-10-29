#!/usr/bin/env node
// tests/visual/run.mjs — 實機視覺驗證 runner
//
// 做咩：
//   1. 自己起一個 static server 喺 random port（唔靠 :8811 有人開住）
//   2. 跑 tests/visual/scenarios/ 入面每個 scenario（headless Chrome）
//   3. 逐個 assert 收 pass/fail → 總結 → exit 0 / exit 1
//
// 用法：
//   node tests/visual/run.mjs                      # 跑全部
//   node tests/visual/run.mjs --scenario sen-l-capacity
//   node tests/visual/run.mjs --keep-shots         # 保留截圖 + Chrome profile
//   node tests/visual/run.mjs --verbose            # 印埋 eval 結果（debug 用）
//
// ⚠️ 冇 Chrome 嘅機器 → 印 SKIP + exit 0（唔好阻住其他 gate）。
//    有 Chrome 但 assert 過 → exit 1。

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScenario, findChrome } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SCENARIO_DIR = path.join(HERE, 'scenarios');
const OUT_DIR = path.join(HERE, '.out');

const argv = process.argv.slice(2);
const onlyScenario = argv.includes('--scenario') ? argv[argv.indexOf('--scenario') + 1] : null;
const keepShots = argv.includes('--keep-shots');
const verbose = argv.includes('--verbose');   // 印 eval 結果（debug 用）

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function startServer(root) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.resolve(root, '.' + rel);
    if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function loadScenarios() {
  if (!fs.existsSync(SCENARIO_DIR)) return [];
  return fs.readdirSync(SCENARIO_DIR)
    .filter((f) => f.endsWith('.mjs'))
    .sort()
    .map((f) => ({
      file: f,
      path: path.join(SCENARIO_DIR, f),
    }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const scenarios = loadScenarios().filter((s) => !onlyScenario || s.file.includes(onlyScenario));
  if (!scenarios.length) {
    console.error(`❌ 搵唔到 scenario${onlyScenario ? `：${onlyScenario}` : ''}`);
    process.exit(1);
  }

  if (!findChrome()) {
    console.log('\n⏭️  SKIP — 呢部機冇搵到 Chrome（headless）。');
    console.log('    裝 Chrome 或者 set CHROME_PATH=<chrome path> 再試。');
    console.log('    冇 Chrome 唔算 fail —— 淨係呢個 gate 跳過，唔阻其他 gate。\n');
    process.exit(0);
  }

  const server = await startServer(ROOT);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  console.log(`\n🌐 static server → ${url}  (root: ${ROOT})`);
  console.log(`📋 ${scenarios.length} 個 scenario\n`);

  let totalPass = 0;
  let totalFail = 0;
  const failedScenarios = [];

  for (const s of scenarios) {
    const mod = await import(s.path);
    const scenario = mod.default;
    const name = scenario.name || s.file.replace(/\.mjs$/, '');
    const title = scenario.title || '';
    const vp = (scenario.viewport || [1440, 900]).join('×');

    process.stdout.write(`▶ ${name}  [${vp}]  ${title}\n`);
    const res = await runScenario(scenario, { url, outDir: OUT_DIR, keepShots });

    if (res.error === 'CHROME_NOT_FOUND') {
      console.log('   ⏭️ SKIP (no chrome)\n');
      continue;
    }
    if (res.error) {
      console.log(`   ❌ 執行失敗：${res.error}\n`);
      totalFail++;
      failedScenarios.push(name);
      continue;
    }

    for (const c of res.checks) {
      // ⚠️ strict-xfail：已知缺陷嘅 characterisation。
      //    仲係壞 → KNOWN-ISSUE（唔阻 gate）；突然 pass → 當 FAIL，
      //    逼人喺 bug 修好嗰陣移除 xfail 標記（唔好將 bug 鎖成永久預期行為）。
      if (c.xfail) {
        if (c.ok) {
          totalFail++;
          failedScenarios.push(`${name} :: ${c.label} (xfail 意外通過 — bug 修好咗？請移除 xfail 標記)`);
          console.log(`   ❌ ${c.label}  → XFAIL 意外通過（bug 修好咗？）${c.detail ? '  ' + c.detail : ''}`);
        } else {
          totalPass++;
          console.log(`   ⚠️ ${c.label}  → KNOWN-ISSUE（xfail）${c.detail ? '  ' + c.detail : ''}`);
        }
        continue;
      }
      if (c.ok) { totalPass++; console.log(`   ✅ ${c.label}`); }
      else {
        totalFail++;
        failedScenarios.push(`${name} :: ${c.label}`);
        console.log(`   ❌ ${c.label}${c.detail ? '  → ' + c.detail : ''}`);
      }
    }
    if (res.logs.length) {
      for (const l of res.logs) {
        if (l.startsWith('SHOT')) console.log('   📸 ' + l.replace('SHOT: ', ''));
        else if (verbose) console.log('   ℹ ' + l);
      }
    }
    console.log('');
    await sleep(200);
  }

  server.close();

  console.log('════════════════════════════════════════');
  console.log(`  ${totalPass} pass / ${totalFail} fail`);
  if (failedScenarios.length) {
    console.log('\n  Failures:');
    for (const f of failedScenarios) console.log(`   ✗ ${f}`);
  }
  console.log(`  截圖 → ${OUT_DIR}`);
  console.log('════════════════════════════════════════\n');

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
