#!/usr/bin/env node
// tests/visual/cdp.mjs — headless Chrome + CDP driver
//
// 點解要入 repo（唔係擺 /tmp）：
//   cycle110b 修嘅 end-screen overflow（學校 iPad 639×669 爆 232px）之前**淨係靠
//   AGENTS.md 一行文字守住** —— 冇任何可執行嘅 check。工具擺 /tmp 就等於「驗證唔到」：
//   換部機、換個 agent 接手、/tmp 清咗，個防線就冇咗。
//
// Step 格式：
//   { eval: '<js>' }                 → 喺頁面執行，print 結果（除錯用）
//   { wait: 600 }                   → 等 ms
//   { assert: { label, expr } }     → expr 喺頁面執行，必須 truthy
//                                     expr 可以回傳 boolean 或者 { ok, detail }
//   { shot: 'name' }                → 截圖去 OUT
//   { shot: 'name', full: true }    → 連內容高度都截
//
// 用法（一般唔使直接叫）：
//   node tests/visual/run.mjs
//   node tests/visual/run.mjs --scenario end-screen-overflow
//   node tests/visual/run.mjs --keep-shots

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

export function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { if (p && fs.existsSync(p)) return p; } catch { /* ignore */ }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 跑一個 scenario。
 * @param {object} scenario  { name, title, viewport:[w,h], steps:[...] }
 * @param {object} opts      { url, outDir, keepShots }
 * @returns {Promise<{checks:Array, logs:Array, error:string|null}>}
 */
export async function runScenario(scenario, opts = {}) {
  const url = opts.url;
  const outDir = opts.outDir || path.join(process.cwd(), 'tests', 'visual', '.out');
  const [W, H] = scenario.viewport || [1440, 900];
  const checks = [];
  const logs = [];
  let error = null;

  const chrome = findChrome();
  if (!chrome) {
    return { checks, logs, error: 'CHROME_NOT_FOUND' };
  }

  fs.mkdirSync(outDir, { recursive: true });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-visual-'));

  // --remote-debugging-port=0 → 叫 Chrome 自己揀 port，寫入 DevToolsActivePort。
  // 咁就唔會撞 port（之前 /tmp 版本硬編碼 9333，撞到就死）。
  const proc = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,MediaRouter',
    `--user-data-dir=${userDataDir}`,
    '--remote-debugging-port=0',
    `--window-size=${W},${H}`, '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });

  let ws = null;
  try {
    // 1) 等 DevToolsActivePort
    let port = null;
    for (let i = 0; i < 100; i++) {
      const f = path.join(userDataDir, 'DevToolsActivePort');
      if (fs.existsSync(f)) {
        const t = fs.readFileSync(f, 'utf8').split('\n');
        if (t[0] && t[0].trim()) { port = Number(t[0].trim()); break; }
      }
      await sleep(120);
    }
    if (!port) throw new Error('Chrome 冇起 DevTools port');

    // 2) 攞 page target
    let target = null;
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await r.json();
        target = list.find((t) => t.type === 'page');
        if (target) break;
      } catch { /* 仲未起好 */ }
      await sleep(200);
    }
    if (!target) throw new Error('攞唔到 Chrome page target');

    // 3) CDP 連線
    ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await new Promise((r, rej) => {
      ws.addEventListener('open', r);
      ws.addEventListener('error', () => rej(new Error('CDP WebSocket error')));
      setTimeout(() => rej(new Error('CDP WebSocket timeout')), 10000);
    });
    const send = (method, params = {}) => {
      const mid = ++id;
      return new Promise((res) => { pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: W, height: H, deviceScaleFactor: 1, mobile: false,
    });
    await send('Page.navigate', { url });
    // 等頁面 init（Tailwind CDN + 遊戲 boot）
    await sleep(2800);

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: expr, awaitPromise: true, returnByValue: true,
      });
      const ex = r.result?.exceptionDetails;
      if (ex) {
        throw new Error(ex.exception?.description || JSON.stringify(ex).slice(0, 300));
      }
      return r.result?.result?.value;
    };

    // 4) 行 steps
    for (const step of scenario.steps) {
      if (step.eval) {
        try {
          const v = await evaluate(step.eval);
          if (v !== undefined && v !== null) {
            const s = typeof v === 'string' ? v : JSON.stringify(v);
            logs.push(s.slice(0, 8000));
          }
        } catch (e) {
          logs.push('EVAL-ERR: ' + e.message);
        }
      }
      if (step.wait) await sleep(step.wait);
      if (step.assert) {
        const { label, expr } = step.assert;
        let ok = false;
        let detail = '';
        try {
          const v = await evaluate(expr);
          if (v && typeof v === 'object' && 'ok' in v) {
            ok = !!v.ok;
            detail = v.detail || '';
          } else {
            ok = !!v;
            detail = v === undefined ? 'expr 回傳 undefined' : '';
          }
        } catch (e) {
          detail = 'evaluate error: ' + e.message;
        }
        checks.push({ label, ok, detail });
      }
      if (step.shot) {
        let params = { format: 'png' };
        if (step.full) {
          const lm = await send('Page.getLayoutMetrics');
          const cs = lm.result?.contentSize || { width: W, height: H };
          params = {
            format: 'png', captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: Math.ceil(cs.width), height: Math.ceil(cs.height), scale: 1 },
          };
        }
        const r = await send('Page.captureScreenshot', params);
        if (r.result?.data) {
          fs.writeFileSync(path.join(outDir, `${step.shot}.png`), Buffer.from(r.result.data, 'base64'));
          logs.push('SHOT: ' + step.shot);
        } else {
          logs.push('SHOT-FAIL: ' + step.shot);
        }
      }
    }
  } catch (e) {
    error = e.message;
  } finally {
    try { if (ws) ws.close(); } catch { /* ignore */ }
    try { proc.kill('SIGTERM'); } catch { /* ignore */ }
    await sleep(250);
    if (!opts.keepShots) {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  return { checks, logs, error };
}
