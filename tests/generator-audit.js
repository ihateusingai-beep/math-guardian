#!/usr/bin/env node
// tests/generator-audit.js — V3.6 cycle 101: permanent functional audit
//
// 目的: catch arithmetic / math correctness bugs in any Generators[type]
// that the structural regex tests in regression.js cannot see.
// Cycle55 bug: orderAsc/Desc20 用 random numbers 假裝 arithmetic sequence,
// 喺 regex test 入面 "answer 係 string" 即過, 但 stem[1]-stem[0] ≠ answer-stem[1].
//
// 用法: node tests/generator-audit.js
// 退出 0 = pass, 退出 1 = fail.
//
// 設計: extract Generators + minimal deps from index.html, mock randInt (deterministic),
// 跑每個 TYPE_REGISTRY type N 次, assert 結構 + 語意 invariant。

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(PROJECT_ROOT, 'index.html');

// ============================================================
// mock layer
// ============================================================

// 1) DOM stub: $() returns null, document/window are no-op objects
const noopEl = new Proxy({}, { get: () => () => '' });
const document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    setAttribute: () => {}, appendChild: () => {}, addEventListener: () => {},
    style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  }),
  addEventListener: () => {},
  body: noopEl,
  head: noopEl,
};
const window = { addEventListener: () => {}, devicePixelRatio: 1 };
const localStorage = (() => {
  const s = {};
  return {
    getItem: (k) => s[k] ?? null,
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: (k) => { delete s[k]; },
  };
})();

// 2) randInt — deterministic cycle-through. 每次 call 都遞增,
//    跨 min..max 循環。咁可以 expose 邊界 case + 防 infinite loop。
let __randCalls = 0;
function randInt(min, max) {
  __randCalls++;
  const range = max - min + 1;
  return ((__randCalls - 1) % range) + min;
}

// 3) shuffle — deterministic Fisher-Yates with the same PRNG seed
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor((__randCalls++ & 0x7fffffff) * (i + 1) / 0x7fffffff);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 4) Game stub — Generators.numeric 需要 Game.settings.difficulty
const Game = {
  settings: { difficulty: 'easy', mode: 'choice' },
  state: {},
};

// 5) Audio stub — some generators might call Audio/sound effects
const AudioCtx = function () {};
AudioCtx.prototype = { createOscillator: () => ({ connect: () => {}, start: () => {} }), destination: {} };

const console_ = { log: () => {}, warn: () => {}, error: () => {} };

// ============================================================
// extract Generators from index.html
// ============================================================

function loadGenerators() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  let body = '';
  for (const s of scripts) {
    const candidate = s.replace(/^<script>/, '').replace(/<\/script>$/, '');
    if (candidate.length > body.length) body = candidate;
  }
  if (!body) throw new Error('No <script> found in index.html');

  // Capture the Generators object literal — start at "const Generators = {"
  // and balance braces to find the end.
  const startMarker = 'const Generators = {';
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Generators not found');
  let depth = 0, endIdx = -1;
  for (let i = startIdx + startMarker.length - 1; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  if (endIdx === -1) throw new Error('Generators end not found');
  const genSrc = body.slice(startIdx, endIdx);

  // Capture TYPE_REGISTRY similarly
  const regMarker = 'const TYPE_REGISTRY = {';
  const regStart = body.indexOf(regMarker);
  if (regStart === -1) throw new Error('TYPE_REGISTRY not found');
  let regEnd = -1; depth = 0;
  for (let i = regStart + regMarker.length - 1; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') { depth--; if (depth === 0) { regEnd = i + 1; break; } }
  }
  const regSrc = body.slice(regStart, regEnd);

  // Wrap in a Function that injects our mocks
  const code = `
    ${regSrc}
    ${genSrc}
    return { TYPE_REGISTRY, Generators };
  `;
  // The Generators object literal references randInt, shuffle, Game — all in scope via the wrapper
  const fn = new Function(
    'randInt', 'shuffle', 'Game', 'document', 'window', 'localStorage', 'AudioCtx', 'console',
    code
  );
  return fn(randInt, shuffle, Game, document, window, localStorage, AudioCtx, console_);
}

// ============================================================
// assertions
// ============================================================

let pass = 0, fail = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) { pass++; }
  else { fail++; failures.push({ name, detail }); }
}

// ============================================================
// per-type semantic checks
// ============================================================

const EASY_MAX = { add10: 10, sub10: 10, add20: 20, sub20: 20 };

// Generic structural check: every generator output has the right shape
function structuralCheck(name, out) {
  check(`${name} has parts (array)`, Array.isArray(out.parts));
  check(`${name} has answer (string|number)`, typeof out.answer !== 'undefined');
  check(`${name} has type (string)`, typeof out.type === 'string' || typeof out.typeId === 'string');
  if (out.options !== undefined) {
    check(`${name} options is array`, Array.isArray(out.options));
    // MC options size: 3 (most), 4 (whatTime), 2 (binary compare/sym-button)
    check(`${name} options size 2-4 (if MC)`, out.options.length === 0 || (out.options.length >= 2 && out.options.length <= 4));
    check(`${name} options unique`, new Set(out.options).size === out.options.length);
    check(`${name} answer in options (if MC)`, out.options.length === 0 || out.options.includes(out.answer) || out.options.includes(String(out.answer)));
  }
}

// Per-type semantic check (where derivable from output)
function semanticCheck(type, out) {
  switch (type) {
    case 'add10':
    case 'add20':
    case 'add2d': {
      // Find 'a + b = answer' in parts
      const m = (out.parts[0] || '').match(/(\d+)\s*\+\s*(\d+)/);
      if (m) {
        const a = Number(m[1]), b = Number(m[2]);
        const expected = a + b;
        check(`${type} answer = a + b`, Number(out.answer) === expected, `a=${a} b=${b} expected=${expected} got=${out.answer}`);
        // Range check
        if (type === 'add10') check(`${type} ≤ 10`, expected <= EASY_MAX.add10);
        if (type === 'add20') check(`${type} ≤ 20`, expected <= EASY_MAX.add20);
      }
      break;
    }
    case 'sub10':
    case 'sub20':
    case 'sub2d': {
      const m = (out.parts[0] || '').match(/(\d+)\s*-\s*(\d+)/);
      if (m) {
        const a = Number(m[1]), b = Number(m[2]);
        const expected = a - b;
        check(`${type} answer = a - b`, Number(out.answer) === expected, `a=${a} b=${b} expected=${expected} got=${out.answer}`);
        check(`${type} non-negative`, expected >= 0);
        if (type === 'sub10') check(`${type} a ≤ 10`, a <= EASY_MAX.sub10);
        if (type === 'sub20') check(`${type} a ≤ 20`, a <= EASY_MAX.sub20);
      }
      break;
    }
    case 'orderAsc20':
    case 'orderDesc20': {
      // The cycle99 fix: real arithmetic sequence with d ∈ [1,3] (absolute value)
      const rawDiff = Number(out.displayNums[1]) - Number(out.displayNums[0]);
      const d = Math.abs(rawDiff);
      const expectedAnswer = type === 'orderAsc20'
        ? Number(out.displayNums[1]) + d
        : Number(out.displayNums[1]) - d;
      check(`${type} d ∈ [1,3] (absolute)`, d >= 1 && d <= 3, `d=${d} raw=${rawDiff}`);
      check(`${type} answer = stem[1] ± d (arithmetic invariant)`,
        Number(out.answer) === expectedAnswer,
        `stem=${out.displayNums} d=${d} expected=${expectedAnswer} got=${out.answer}`);
      // Range check
      const all = [...out.displayNums.map(Number), Number(out.answer)];
      check(`${type} all values in [1,20]`, all.every(v => v >= 1 && v <= 20));
      // T100 safety: must terminate (took < 1s)
      check(`${type} generated within budget (<1s)`, Date.now() - startTime[type] < 1000);
      break;
    }
    case 'count10':
    case 'count1to3':
    case 'count20':
    case 'double':
    case 'groupAdd': {
      // Count-related: answer should be small positive integer ≤ 10 or 20
      const a = Number(out.answer);
      check(`${type} answer is positive integer`, Number.isInteger(a) && a > 0);
      if (type !== 'groupAdd' && type !== 'double') {
        check(`${type} answer ≤ 10`, a <= 10);
      }
      break;
    }
    case 'compareGroup':
    case 'compareLength':
    case 'compareHeight': {
      // answer should be in {left, right, equal/same, A, B} — generic check
      check(`${type} answer present`, typeof out.answer === 'string' || typeof out.answer === 'number');
      break;
    }
    case 'compare10': {
      // answer should be <, >, or =
      check(`${type} answer in {<, >, =}`, ['<', '>', '='].includes(out.answer));
      break;
    }
    case 'whatTime': {
      // answer should be 1-12
      const a = Number(out.answer);
      check(`${type} answer in [1,12]`, a >= 1 && a <= 12);
      break;
    }
    case 'shapeMatch': {
      check(`${type} answer is shape name`, typeof out.answer === 'string' && out.answer.length > 0);
      break;
    }
    case 'ordering': {
      // answer is the sorted string
      check(`${type} answer is "X → Y → Z" format`, typeof out.answer === 'string' && out.answer.includes('→'));
      break;
    }
  }
}

// ============================================================
// main
// ============================================================

console.log('\n[T101] V3.6 cycle-101 (functional audit: all generators × 30 runs)');

const startTime = {};
const N_RUNS = 30;

try {
  const { TYPE_REGISTRY, Generators } = loadGenerators();
  const types = Object.keys(TYPE_REGISTRY);
  console.log(`  found ${types.length} types in TYPE_REGISTRY`);

  for (const type of types) {
    __randCalls = 0;
    startTime[type] = Date.now();
    let ranOk = 0;
    for (let i = 0; i < N_RUNS; i++) {
      try {
        // Arithmetic types route through Generators.numeric(type, mode)
        const ARITHMETIC = ['add10','sub10','add20','sub20','add2d','sub2d'];
        let gen;
        if (ARITHMETIC.includes(type)) {
          gen = (mode) => Generators.numeric(type, mode);
        } else {
          gen = Generators[type];
        }
        if (typeof gen !== 'function') {
          check(`${type} is a function`, false, 'not a function');
          break;
        }
        // Most generators take (mode) or () — try both
        let out;
        try { out = gen(i % 2 === 0 ? 'choice' : 'keypad'); }
        catch (e1) {
          try { out = gen(); }
          catch (e2) { check(`${type} runnable`, false, e2.message); continue; }
        }
        structuralCheck(type, out);
        semanticCheck(type, out);
        ranOk++;
      } catch (e) {
        check(`${type} run #${i} no throw`, false, e.message);
        break;
      }
    }
    check(`${type} ran ${N_RUNS} times without infinite loop`, ranOk >= Math.min(5, N_RUNS));
  }
} catch (e) {
  console.log(`\n✗ FATAL: ${e.message}`);
  process.exit(1);
}

// summary
console.log(`\n========== ${pass} pass / ${fail} fail ==========`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures.slice(0, 20)) {
    console.log(`  ✗ ${f.name}: ${f.detail || ''}`);
  }
  if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
  process.exit(1);
}
process.exit(0);
