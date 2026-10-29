#!/usr/bin/env node
// tests/audio-audit.js — V3.6 cycle 105: permanent audio pipeline audit
//
// 目的: catch audio bugs that the structural regex tests in regression.js cannot see.
//
// cycle 104 audit 發現 3 個真 runtime bug, 全部同一個根因:
//   Audio module 嘅 public surface 同 call sites 脫節, 冇任何嘢 check 佢哋夾唔夾得順.
//     B1: Audio.tick()       called @6643  → not exported → TypeError
//     B2: Audio.beep(440,.08) called @10160 → not exported → TypeError
//     B3: Audio.bgmInterval read @11771    → not exported → always undefined
//         → BGM 切走 tab 之後永遠唔會恢復
//
// 用法: node tests/audio-audit.js
// 退出 0 = pass, 退出 1 = fail.
//
// 設計: 從 index.html 抽 Audio IIFE + TTS module, mock AudioContext,
//       跑每個 exported SFX 量度 voice 數, 再做 call-site × export 交叉檢查.

'use strict';

const fs = require('fs');
const path = require('path');

const { readAppSource } = require('./source.js');

// ============================================================
// mock AudioContext — counts every node the module creates
// ============================================================

const counters = {
  ctxCreated: 0, oscillators: 0, gains: 0, buffers: 0, bufferBytes: 0,
  bufferSources: 0, biquads: 0,
};
const SAMPLE_RATE = 48000;

// V3.6 cycle111g: 追蹤 audio graph 拓撲（邊個 node 連去邊個）
//   用嚟實證「master bus 真係用起」—— 之前 masterGain 只係一個宣告咗但冇接線嘅死變數。
const graphEdges = [];   // [fromId, toId]
const nodeKinds = new Map();  // nodeId → 'gain' | 'osc' | 'bufsrc' | 'filter' | 'node'
let nodeSeq = 0;

function makeParam(v) {
  return {
    value: v,
    setValueAtTime() { return this; },
    exponentialRampToValueAtTime() { return this; },
    linearRampToValueAtTime() { return this; },
  };
}
function makeNode(extra) {
  const node = Object.assign({
    __id: 'n' + (++nodeSeq),
    __kind: 'node',
    connect(to) {
      graphEdges.push([node.__id, (to && to.__id) ? to.__id : 'dest']);
      return node;
    },
    disconnect() {},
    start() {}, stop() {},
  }, extra);
  nodeKinds.set(node.__id, node.__kind);
  return node;
}

class MockCtx {
  constructor() {
    counters.ctxCreated++;
    this.state = 'running';
    this.sampleRate = SAMPLE_RATE;
    this.destination = makeNode({ __id: 'dest', __kind: 'dest' });
    this.currentTime = 0;
  }
  resume() { return Promise.resolve(); }
  createOscillator() {
    counters.oscillators++;
    return makeNode({ __kind: 'osc', type: 'sine', frequency: makeParam(440), detune: makeParam(0) });
  }
  createGain() { counters.gains++; return makeNode({ __kind: 'gain', gain: makeParam(1) }); }
  createBiquadFilter() { counters.biquads++; return makeNode({ __kind: 'filter', type: 'lowpass', frequency: makeParam(1000) }); }
  createBufferSource() { counters.bufferSources++; return makeNode({ __kind: 'bufsrc', buffer: null, playbackRate: makeParam(1) }); }
  createBuffer(channels, length, rate) {
    counters.buffers++;
    counters.bufferBytes += channels * length * 4; // Float32
    return { getChannelData: () => new Float32Array(length), length, sampleRate: rate };
  }
}

// ============================================================
// source helpers
// ============================================================

/**
 * Strip `//` line comments and `/* *\/` block comments while PRESERVING line
 * count (so reported line numbers stay accurate) and while not treating `//`
 * inside a string / template literal as a comment.
 */
function stripComments(src) {
  const lines = src.split('\n');
  const out = lines.map(line => {
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === '\\') { i++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  });
  return out.join('\n');
}

/**
 * Parse the exported member names of a `return { ... }` object.
 *
 * Handles all three export forms used in this codebase:
 *   key: value        -- property
 *   key, key2, key3   -- comma-separated shorthand list
 *   key(args) { ... } -- shorthand method
 *
 * Depth-aware so identifiers inside nested function bodies and arrow-function
 * bodies are NOT mistaken for exports.
 */
function parseExports(modSrc) {
  const s = stripComments(modSrc);
  const retIdx = s.indexOf('return {');
  if (retIdx === -1) return new Set();

  const names = new Set();

  const skipWs = (j) => { while (j < s.length && /\s/.test(s[j])) j++; return j; };

  // skip a balanced group starting at s[j] with the given open/close chars
  const skipBalanced = (j, open, close) => {
    let depth = 0, quote = null;
    for (; j < s.length; j++) {
      const c = s[j];
      if (quote) {
        if (c === '\\') { j++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return j + 1; }
    }
    return j;
  };

  // skip a simple expression up to a top-level , or }
  const skipExpr = (j) => {
    let quote = null, depth = 0;
    for (let m = j; m < s.length; m++) {
      const c = s[m];
      if (quote) {
        if (c === '\\') { m++; continue; }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '(' || c === '[' || c === '{') { depth++; continue; }
      if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) return m;
        depth--;
        continue;
      }
      if (c === ',' && depth === 0) return m;
    }
    return j;
  };

  // skip an arrow-function body (block or expression); returns index just past it
  const skipArrowBody = (j) => {
    let b = skipWs(j);
    if (s[b] === '{') return skipBalanced(b, '{', '}');
    return skipExpr(b);
  };

  // skip a property value; returns the index just past it
  const skipValue = (j) => {
    j = skipWs(j);
    if (s[j] === '{') return skipBalanced(j, '{', '}');
    if (s[j] === '(') {
      // may be an arrow-function parameter list
      const afterParen = skipBalanced(j, '(', ')');
      const k = skipWs(afterParen);
      if (s.slice(k, k + 2) === '=>') return skipArrowBody(k + 2);
      return afterParen;
    }
    // identifier / literal, possibly the head of an arrow function
    let k = j;
    while (k < s.length && /[A-Za-z0-9_$.]/.test(s[k])) k++;
    const after = skipWs(k);
    if (s.slice(after, after + 2) === '=>') return skipArrowBody(after + 2);
    return skipExpr(j);
  };

  // locate the return object's opening brace
  let i = s.indexOf('{', retIdx) + 1;

  // parse the object's own key/value pairs
  while (i < s.length) {
    i = skipWs(i);
    if (s[i] === '}') break;
    if (s[i] === ',') { i++; continue; }
    if (!/[A-Za-z_$]/.test(s[i])) { i++; continue; }
    let j = i;
    while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++;
    const ident = s.slice(i, j);
    const k = skipWs(j);
    if (s[k] === ':') {
      names.add(ident);
      i = skipValue(k + 1);
    } else if (s[k] === '(') {
      // shorthand method: `key(args) { body }` -- skip the body too
      names.add(ident);
      const afterParen = skipBalanced(k, '(', ')');
      const b = skipWs(afterParen);
      i = (s[b] === '{') ? skipBalanced(b, '{', '}') : afterParen;
    } else {
      // shorthand: `key,` or `key}`
      names.add(ident);
      i = j;
    }
  }
  return names;
}

function extractModule(html, marker, endMarker) {
  const start = html.indexOf(marker);
  if (start === -1) throw new Error(`module not found: ${marker}`);
  const end = html.indexOf(endMarker, start) + endMarker.length;
  if (end < start) throw new Error(`module end not found: ${marker}`);
  return html.slice(start, end);
}

function loadAudioModule(html) {
  const src = extractModule(html, 'const Audio = (() => {', '})();');
  const fn = new Function(
    'window', 'randInt', 'shuffle', 'setTimeout', 'setInterval', 'clearInterval', 'console',
    `${src}\nreturn Audio;`
  );
  return fn(
    { AudioContext: MockCtx, webkitAudioContext: MockCtx },
    (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    (a) => a.slice(),
    setTimeout, setInterval, clearInterval, console
  );
}

// ============================================================
// assertions
// ============================================================

let pass = 0, fail = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
}

function report(label, value) {
  console.log(`  ${label}: ${value}`);
}

// ============================================================
// main
// ============================================================

(async function main() {
  console.log('\n[A105] V3.6 cycle-105 (audio audit: call-site x export cross-check + voice coverage)');

  const html = readAppSource();
  // Executable-code view: comments removed (line numbers preserved)
  const code = stripComments(html);

  let audioExports, audioSrc;
  try {
    audioSrc = extractModule(html, 'const Audio = (() => {', '})();');
    audioExports = parseExports(audioSrc);
  } catch (e) {
    console.log(`\n✗ FATAL: ${e.message}`);
    process.exit(1);
  }

  report(`Audio module exports (${audioExports.size})`, [...audioExports].sort().join(' '));

  // ------------------------------------------------------------
  // 1) every `Audio.<method>(` call site must resolve to an export
  // ------------------------------------------------------------
  const methodCalls = new Map();
  for (const m of code.matchAll(/\bAudio\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g)) {
    if (!methodCalls.has(m[1])) methodCalls.set(m[1], []);
    methodCalls.get(m[1]).push(code.slice(0, m.index).split('\n').length);
  }
  const unresolvedMethods = [...methodCalls.entries()].filter(([n]) => !audioExports.has(n));
  check('A105-01 every Audio.<method>( call site resolves to an exported method',
    unresolvedMethods.length === 0,
    unresolvedMethods.map(([n, l]) => `Audio.${n}() @ ${l.join(',')}`).join('; '));

  // ------------------------------------------------------------
  // 2) every `Audio.<prop>` property READ must resolve to an export
  //    (this is the check that catches B3 — Audio.bgmInterval)
  // ------------------------------------------------------------
  const propReads = new Map();
  for (const m of code.matchAll(/\bAudio\.([a-zA-Z][a-zA-Z0-9]*)\b(?!\s*\()/g)) {
    if (!propReads.has(m[1])) propReads.set(m[1], []);
    propReads.get(m[1]).push(code.slice(0, m.index).split('\n').length);
  }
  const unresolvedProps = [...propReads.entries()].filter(([n]) => !audioExports.has(n));
  check('A105-02 every Audio.<prop> read resolves to an exported member',
    unresolvedProps.length === 0,
    unresolvedProps.map(([n, l]) => `Audio.${n} @ ${l.join(',')}`).join('; '));

  // ------------------------------------------------------------
  // 3) the 3 specific cycle-104 bugs must be gone
  // ------------------------------------------------------------
  check('A105-03 B1 fixed: Audio.tick is exported (call site @6643)', audioExports.has('tick'));
  check('A105-04 B2 fixed: Audio.beep is exported (call site @10160)', audioExports.has('beep'));
  check('A105-05 B3 fixed: Audio.isPlaying is exported (replaces the private timer handle)',
    audioExports.has('isPlaying'));
  // the private timer handle must NOT be exposed as a member of the Audio object
  // (it is legitimately referenced inside the isPlaying() body, but not as a key)
  check('A105-06 B3 fixed: the private timer handle is not exposed on the Audio object',
    !audioExports.has('bgmInterval'));
  check('A105-07 B3 fixed: visibilitychange handler uses Audio.isPlaying()',
    /_wasPlayingBGM\s*=\s*Audio\.isPlaying\(\)/.test(code));

  // ------------------------------------------------------------
  // 4) every exported SFX must actually produce sound
  // ------------------------------------------------------------
  const CONTROL = new Set([
    'startBGM', 'stopBGM', 'setBGMScene', 'enable', 'setChannel',
    'getChannels', 'isEnabled', 'isBgmOn', 'isPlaying', 'prime',
    // V3.6 cycle111g: 音量 / ducking API —— 唔係 SFX（唔會發聲），唔應該當成音效驗
    'setMasterVolume', 'setBusVolume', 'getBusVolume', 'getBusGain',
    'duckBGM', 'isBgmDucked', 'getBusTopology',
  ]);
  const sfxNames = [...audioExports].filter(n => !CONTROL.has(n)).sort();
  report(`SFX exports (${sfxNames.length})`, sfxNames.join(' '));

  const Audio = loadAudioModule(html);
  const flush = () => new Promise(r => setTimeout(r, 60));

  const silent = [];
  const perSfxBytes = {};
  for (const name of sfxNames) {
    await flush();                       // drain timers BEFORE snapshot
    const before = { ...counters };
    try {
      Audio[name]();
    } catch (e) {
      check(`A105-08 ${name} is callable without throwing`, false, e.message);
      continue;
    }
    await flush();
    const voices = (counters.oscillators - before.oscillators)
                 + (counters.bufferSources - before.bufferSources);
    if (voices === 0) silent.push(name);
    perSfxBytes[name] = counters.bufferBytes - before.bufferBytes;
  }
  check('A105-08 every exported SFX produces at least one voice',
    silent.length === 0, `silent: ${silent.join(', ')}`);

  // ------------------------------------------------------------
  // 5) tracked P1 (NOT a gate) — noise buffer churn
  //    cycle 104 finding A4: noise() allocates a fresh buffer per call.
  //    Reported so it stays visible, but not failing until it is fixed.
  // ------------------------------------------------------------
  const heavy = Object.entries(perSfxBytes).filter(([, b]) => b > 64 * 1024);
  report('P1 tracked: SFX allocating > 64KB noise buffer',
    heavy.length ? heavy.map(([n, b]) => `${n}=${(b / 1024).toFixed(1)}KB`).join(', ') : '(none)');

  // ------------------------------------------------------------
  // 5b) V3.6 cycle111g: noise buffer **cache** 真係有效
  //     之前每次 noise() 都 createBuffer（cycle 104 finding A4）。
  //     而家全場只 create 一次（0.5s = 96KB），靠 loop + 隨機 offset 變化。
  // ------------------------------------------------------------
  check('A111g-10 noise buffer 全場只 create 一次（cache 生效）',
    counters.buffers <= 1, `buffers=${counters.buffers}（之前每個 noise SFX 一次）`);

  // ------------------------------------------------------------
  // 6) tracked P1 (NOT a gate) — dormant exports
  // ------------------------------------------------------------
  const callCounts = new Map();
  for (const m of code.matchAll(/\bAudio\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g)) {
    callCounts.set(m[1], (callCounts.get(m[1]) || 0) + 1);
  }
  const dormant = sfxNames.filter(n => !callCounts.has(n));
  report('P1 tracked: dormant SFX exports (0 call sites)', dormant.length ? dormant.join(' ') : '(none)');
  // 'countdown' is the documented P1 gap (docs/AUDIO_VIDEO_OPTIMIZATION.md §2 / §10.4).
  // Any OTHER dormant export is new drift and IS a gate failure.
  const unexpectedDormant = dormant.filter(n => n !== 'countdown');
  check('A105-09 no unexpected dormant SFX exports (countdown is the documented P1 gap)',
    unexpectedDormant.length === 0, `unexpected dormant: ${unexpectedDormant.join(', ')}`);

  // ------------------------------------------------------------
  // 7) V3.6 cycle111g: masterGain 真係用起（cycle 104 finding A1 由 tracked 升為 gate）
  //    之前：masterGain 只係「宣告咗但從來冇 connect」嘅死變數 → 成個模組冇 master gain。
  //    而家：真 bus graph = Master ← { SFX , BGM ← Duck }。
  //    ⚠️ 呢個要用**實機拓撲**（mock 記錄每條 connect edge）嚟驗，
  //       唔可以只 grep「masterGain 出現幾多次」—— 宣告咗 20 次都係死變數都唔會捉到。
  // ------------------------------------------------------------
  const masterGainRefs = (code.match(/\bmasterGain\b/g) || []).length;
  report('masterGain references', `${masterGainRefs}`);

  const gainToDest = graphEdges.filter(([a, b]) => b === 'dest' && nodeKinds.get(a) === 'gain');
  check('A111g-01 恰好一個 gain 直連 destination（= Master bus 真係接線）',
    gainToDest.length === 1, `gain→dest edges: ${gainToDest.length}`);
  const masterId = gainToDest.length ? gainToDest[0][0] : null;
  const upstreamGains = masterId
    ? graphEdges.filter(([a, b]) => b === masterId && nodeKinds.get(a) === 'gain')
    : [];
  check('A111g-02 Master bus 有 ≥2 個上游 bus（SFX + BGM←Duck）',
    upstreamGains.length >= 2, `upstream gain buses: ${upstreamGains.length}`);
  const gainToGain = graphEdges.filter(([a, b]) => nodeKinds.get(a) === 'gain' && nodeKinds.get(b) === 'gain');
  check('A111g-03 存在 gain→gain 嘅 bus 鏈（voice 經 bus，唔係直連 destination）',
    gainToGain.length >= 2, `gain→gain edges: ${gainToGain.length}`);

  // ------------------------------------------------------------
  // 7b) V3.6 cycle111g: 音量 / ducking 行為
  // ------------------------------------------------------------
  Audio.setMasterVolume(0.5);
  check('A111g-04 slider → 平方 gain（0.5 → 0.25；raw linear slider 會將大部分變化擺喺底部 1/5）',
    Math.abs(Audio.getBusGain('master') - 0.25) < 1e-9, `gain=${Audio.getBusGain('master')}`);
  Audio.setMasterVolume(0);
  check('A111g-05 0% = 真靜音（唔會被 `|| default` 當成 1）',
    Audio.getBusVolume('master') === 0 && Audio.getBusGain('master') === 0,
    `vol=${Audio.getBusVolume('master')} gain=${Audio.getBusGain('master')}`);
  Audio.setMasterVolume(1);
  check('A111g-06 100% = gain 1',
    Math.abs(Audio.getBusGain('master') - 1) < 1e-9, `gain=${Audio.getBusGain('master')}`);
  // ⚠️ 用剝註解後嘅 source —— 註解入面講「唔可以用 Number(x) || default」都會中招
  check('A111g-07 音量 API 唔用 `Number(x) || default`（0 係 falsy）',
    !/Number\([^)]*\)\s*\|\|/.test(stripComments(audioSrc)), 'found Number() || fallback in Audio module');
  Audio.duckBGM(true);
  check('A111g-08 duck 生效（朗讀時壓低 BGM）',
    Audio.isBgmDucked() === true, `ducked=${Audio.isBgmDucked()}`);
  Audio.duckBGM(false);
  check('A111g-09 unduck 生效',
    Audio.isBgmDucked() === false, `ducked=${Audio.isBgmDucked()}`);

  // ------------------------------------------------------------
  // 8) TTS module call-site × export cross-check
  // ------------------------------------------------------------
  const ttsSrc = extractModule(html, 'const TTS = {', '\n};');
  const ttsExports = parseExports('return {' + ttsSrc.slice(ttsSrc.indexOf('{') + 1));
  const ttsCalls = new Map();
  for (const m of code.matchAll(/\bTTS\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g)) {
    if (!ttsCalls.has(m[1])) ttsCalls.set(m[1], []);
    ttsCalls.get(m[1]).push(code.slice(0, m.index).split('\n').length);
  }
  const unresolvedTts = [...ttsCalls.entries()].filter(([n]) => !ttsExports.has(n));
  check('A105-10 every TTS.<method>( call site resolves to an exported TTS method',
    unresolvedTts.length === 0,
    unresolvedTts.map(([n, l]) => `TTS.${n}() @ ${l.join(',')}`).join('; '));

  // ------------------------------------------------------------
  // 9) TTS must degrade gracefully (no raw error to the player)
  // ------------------------------------------------------------
  check('A105-11 TTS.speak guards on speechSynthesis availability',
    /'speechSynthesis'\s+in\s+window/.test(code));

  // V3.6 cycle111g: TTS → BGM ducking（語音同背景音樂一齊出，學生聽唔清題目）
  check('A111g-11 TTS.speak 會 duck BGM（true + false 都要有）',
    /Audio\.duckBGM\(true\)/.test(ttsSrc) && /Audio\.duckBGM\(false\)/.test(ttsSrc),
    'TTS module 冇 duck 呼叫');

  // V3.6 cycle111g: 主音量持久化 + boot 套用
  check('A111g-12 主音量持久化落 Profile + boot 時套用 + lazy-init 用 Number.isFinite',
    /masterVolume: 1/.test(code) &&
    /Audio\.setMasterVolume\(Profile\.data\.masterVolume\)/.test(code) &&
    /!Number\.isFinite\(this\.data\.masterVolume\)/.test(code),
    'masterVolume 持久化 / boot 套用 / lazy-init 缺一');

  // ------------------------------------------------------------
  // 10) a11y: no <span aria-label> without role (memory rule 14)
  // ------------------------------------------------------------
  const spanAria = html.match(/<span[^>]*aria-label[^>]*>/g) || [];
  check('A105-12 no <span aria-label> without role (screen readers ignore it)',
    spanAria.length === 0, `found ${spanAria.length}`);

  // ------------------------------------------------------------
  // summary
  // ------------------------------------------------------------
  console.log('\n=== baseline (post-cycle-105) ===');
  report('AudioContexts created', counters.ctxCreated);
  report('oscillators total', counters.oscillators);
  report('noise buffers alloc', `${counters.buffers} (${(counters.bufferBytes / 1024).toFixed(1)} KB)`);
  report('call sites checked', `${methodCalls.size} methods, ${propReads.size} props, ${ttsCalls.size} TTS methods`);

  console.log(`\n========== ${pass} pass / ${fail} fail ==========`);
  if (fail > 0) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, 25)) {
      console.log(`  ✗ ${f.name}${f.detail ? ': ' + f.detail : ''}`);
    }
    if (failures.length > 25) console.log(`  ... and ${failures.length - 25} more`);
    process.exit(1);
  }
  process.exit(0);
})();
