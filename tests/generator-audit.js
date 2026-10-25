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

// ============================================================
// T108: Adaptive ladder functional audit (cycle 108 P0 lock-in)
// ============================================================
// 背景（cycle 108 P0）：Adaptive.onCorrect 原本用
//   `TYPE_ORDER.indexOf(type) < TYPE_ORDER.length - 1`
// 做升級門檻。對「唔喺 TYPE_ORDER 嘅 type」indexOf 回 -1 → -1 < 5 = true
// → 誤判成可升級 → next = TYPE_ORDER[0] = 'add10'
// → 學生喺 easy/SEN path 連續答啱 5 題，scope 會被靜靜換成 classic 加法題。
// 實機驗證（headless Chrome + live site）：count20 → add10。
//
// 呢個係行為 bug，regex 結構測試捉唔到，所以喺呢個 functional audit 度做真實執行。

// module-level mocks（測試體同 loader 共用同一份 instance，Adaptive 改嘅就係佢）
const __adaptiveGame = { settings: { types: [] } };
const __adaptiveProfile = { data: { masteredByType: {}, statsByType: {}, adaptiveDowngrades: 0 }, save: () => {} };

function loadAdaptive() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  let body = '';
  for (const s of scripts) {
    const candidate = s.replace(/^<script>/, '').replace(/<\/script>$/, '');
    if (candidate.length > body.length) body = candidate;
  }
  if (!body) throw new Error('No <script> found in index.html');

  const orderMatch = body.match(/const TYPE_ORDER\s*=\s*\[[^\]]*\]/);
  if (!orderMatch) throw new Error('TYPE_ORDER not found');
  const orderSrc = orderMatch[0];

  const startMarker = 'const Adaptive = {';
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Adaptive not found');
  let depth = 0, endIdx = -1;
  for (let i = startIdx + startMarker.length - 1; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  if (endIdx === -1) throw new Error('Adaptive end not found');
  const adaptiveSrc = body.slice(startIdx, endIdx);

  const code = `
    ${orderSrc}
    ${adaptiveSrc}
    return { TYPE_ORDER, Adaptive };
  `;
  const fn = new Function('Game', 'Profile', 'FX', 'TEAM_META', 'TYPE_REGISTRY', 'announceToA11y', code);
  const FX = { screenAlert: () => {} };
  const TEAM_META = { knight: { name: '騎士' }, mage: { name: '法師' } };
  const TYPE_REGISTRY = {};
  return fn(__adaptiveGame, __adaptiveProfile, FX, TEAM_META, TYPE_REGISTRY, () => {});
}

console.log('\n[T108] V3.6 cycle-108 (Adaptive ladder: easy scope 唔可以被換走)');

try {
  const { TYPE_ORDER, Adaptive } = loadAdaptive();
  const Game = __adaptiveGame;   // 測試體用同一個 instance

  // --- 1. easy / SEN scope: 連續答啱 5 題都唔可以改 scope ---
  const EASY_SCOPES = ['count20', 'compareLength', 'compareHeight',
                       'orderAsc20', 'orderDesc20', 'learnL', 'findLDrink', 'findLItem'];
  for (const scope of EASY_SCOPES) {
    Game.settings.types = [scope];
    Adaptive.reset();
    for (let i = 0; i < 5; i++) Adaptive.onCorrect('knight', scope);
    check(`easy scope "${scope}" 連答啱 5 題後 scope 唔會被換走`,
      Game.settings.types.length === 1 && Game.settings.types[0] === scope,
      `types = ${JSON.stringify(Game.settings.types)}（期望 ["${scope}"]）`);
  }

  // --- 2. easy / SEN scope: 連續答錯 6 題都唔可以改 scope ---
  for (const scope of EASY_SCOPES) {
    Game.settings.types = [scope];
    Adaptive.reset();
    for (let i = 0; i < 6; i++) Adaptive.onWrong('knight', scope);
    check(`easy scope "${scope}" 連答錯 6 題後 scope 唔會被換走`,
      Game.settings.types.length === 1 && Game.settings.types[0] === scope,
      `types = ${JSON.stringify(Game.settings.types)}（期望 ["${scope}"]）`);
  }

  // --- 3. 通用 invariant：任何唔喺 TYPE_ORDER 嘅 type 都唔可以被 type 置換 ---
  //     （呢個係 bug 嘅根：indexOf 回 -1 仍然通過 < length 嘅條件）
  const nonLadderTypes = EASY_SCOPES.concat(['add20x', 'notAType', 'count10', 'groupAdd', 'compareGroup']);
  for (const type of nonLadderTypes) {
    Game.settings.types = [type];
    Adaptive.reset();
    for (let i = 0; i < 12; i++) { Adaptive.onCorrect('knight', type); Adaptive.onWrong('mage', type); }
    check(`唔喺 ladder 嘅 type "${type}" 升級/降級後都唔會改 settings.types`,
      Game.settings.types.length === 1 && Game.settings.types[0] === type,
      `types = ${JSON.stringify(Game.settings.types)}（期望 ["${type}"]）`);
  }

  // --- 4. classic ladder 行為必須保留（修復唔可以整爛原本功能）---
  Game.settings.types = ['add10'];
  Adaptive.reset();
  for (let i = 0; i < 5; i++) Adaptive.onCorrect('knight', 'add10');
  check('classic: add10 連答啱 5 題 → 升級到 sub10',
    Game.settings.types[0] === 'sub10',
    `types = ${JSON.stringify(Game.settings.types)}（期望 ["sub10"]）`);

  Game.settings.types = ['sub10'];
  Adaptive.reset();
  for (let i = 0; i < 3; i++) Adaptive.onWrong('knight', 'sub10');
  check('classic: sub10 連答錯 3 題 → 降級到 add10',
    Game.settings.types[0] === 'add10',
    `types = ${JSON.stringify(Game.settings.types)}（期望 ["add10"]）`);

  Game.settings.types = ['add10'];
  Adaptive.reset();
  for (let i = 0; i < 3; i++) Adaptive.onWrong('knight', 'add10');
  check('classic: add10 係 ladder 底部 → 唔會再降級',
    Game.settings.types[0] === 'add10',
    `types = ${JSON.stringify(Game.settings.types)}（期望 ["add10"]）`);

  Game.settings.types = ['sub2d'];
  Adaptive.reset();
  for (let i = 0; i < 8; i++) Adaptive.onCorrect('knight', 'sub2d');
  check('classic: sub2d 係 ladder 頂 → 唔會再升級',
    Game.settings.types[0] === 'sub2d',
    `types = ${JSON.stringify(Game.settings.types)}（期望 ["sub2d"]）`);

  // --- 5. TYPE_ORDER 本身必須仍然係經典 6 級（唔可以被順手改壞）---
  check('TYPE_ORDER 仍然係經典 6 級 ladder',
    JSON.stringify(TYPE_ORDER) === JSON.stringify(['add10','sub10','add20','sub20','add2d','sub2d']),
    `TYPE_ORDER = ${JSON.stringify(TYPE_ORDER)}`);
} catch (e) {
  check('T108 Adaptive audit 執行得到（唔好 throw）', false, e.message);
}

// ============================================================
// T109: Stage / 進度格 / 提示階梯 functional audit (cycle 109)
// ============================================================
// 行為 bug（進度推錯、提示層錯、局長計錯）regex 結構測試捉唔到，
// 所以喺呢度抽出真實模組、mock 環境實際執行、斷言實際數值。

function loadStageModule() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
  let body = '';
  for (const s of scripts) {
    const candidate = s.replace(/^<script>/, '').replace(/<\/script>$/, '');
    if (candidate.length > body.length) body = candidate;
  }
  if (!body) throw new Error('No <script> found in index.html');

  // balanced-brace extractor for a named function declaration
  function grabFn(name) {
    const marker = `function ${name}(`;
    const i = body.indexOf(marker);
    if (i === -1) throw new Error(`${name} not found`);
    let depth = 0, started = false, end = -1;
    for (let j = i; j < body.length; j++) {
      if (body[j] === '{') { depth++; started = true; }
      else if (body[j] === '}') { depth--; if (started && depth === 0) { end = j + 1; break; } }
    }
    if (end === -1) throw new Error(`${name} end not found`);
    return body.slice(i, end);
  }

  const consts = (body.match(/const STAGE_CELLS = 3;/) || [''])[0] + '\n' +
                 (body.match(/const CELL_UNITS = 4;/) || [''])[0];
  const fns = ['_cellUnits', '_applyStageUnits', '_stageCellFills', '_stageGoalQuestions',
               '_easyHintL1', '_easyHintL2', '_easyHintL3', '_easyHintL4', '_easyHintText']
    .map(grabFn).join('\n');

  const code = `
    ${consts}
    ${fns}
    return { STAGE_CELLS, CELL_UNITS, _cellUnits, _applyStageUnits, _stageCellFills,
             _stageGoalQuestions, _easyHintText };
  `;
  const __Game = {
    state: {
      stage: {
        knight: { index: 0, units: 0, cleared: 0 },
        mage:   { index: 0, units: 0, cleared: 0 },
      },
    },
    settings: { goalStages: 3 },
  };
  const fn = new Function('Game', code);
  return { mod: fn(__Game), Game: __Game };
}

console.log('\n[T109] V3.6 cycle-109 (Stage / 進度格 / 提示階梯 functional audit)');

try {
  const { mod, Game } = loadStageModule();
  const { STAGE_CELLS, CELL_UNITS, _cellUnits, _applyStageUnits, _stageCellFills,
          _stageGoalQuestions, _easyHintText } = mod;

  // --- 1) 一次答題填幾多段 ---
  check('答啱冇用提示 = 1 格（4 段）', _cellUnits(true, 0, false) === 4, `got ${_cellUnits(true, 0, false)}`);
  check('答啱用提示 L1 = ½ 格（2 段）', _cellUnits(true, 1, false) === 2, `got ${_cellUnits(true, 1, false)}`);
  check('答啱用提示 L2 = ½ 格（2 段）', _cellUnits(true, 2, false) === 2, `got ${_cellUnits(true, 2, false)}`);
  check('答啱用提示 L3 = ¼ 格（1 段）', _cellUnits(true, 3, false) === 1, `got ${_cellUnits(true, 3, false)}`);
  check('答啱用提示 L4 = ¼ 格（1 段）', _cellUnits(true, 4, false) === 1, `got ${_cellUnits(true, 4, false)}`);
  check('重播答啱 = ½ 格（2 段）', _cellUnits(true, 0, true) === 2, `got ${_cellUnits(true, 0, true)}`);
  check('答錯 = 0 段', _cellUnits(false, 0, false) === 0, `got ${_cellUnits(false, 0, false)}`);
  check('答錯即使有提示都係 0 段', _cellUnits(false, 4, false) === 0, `got ${_cellUnits(false, 4, false)}`);

  // --- 2) Stage 推進 + 過關 ---
  const resetStage = () => { Game.state.stage.knight = { index: 0, units: 0, cleared: 0 }; };
  resetStage();
  let r = _applyStageUnits('knight', 4);
  check('答 1 題（1 格）未過關', r.cleared === false && Game.state.stage.knight.units === 4,
    `cleared=${r.cleared} units=${Game.state.stage.knight.units}`);
  _applyStageUnits('knight', 4);
  _applyStageUnits('knight', 4);
  check('第 3 格填滿 = 過關（cleared 1, index 1）',
    Game.state.stage.knight.cleared === 1 && Game.state.stage.knight.index === 1,
    `cleared=${Game.state.stage.knight.cleared} index=${Game.state.stage.knight.index}`);

  // 過關後新 Stage 進度歸零
  check('過關後新 Stage 進度歸零', Game.state.stage.knight.units === 0, `units=${Game.state.stage.knight.units}`);

  // 半格推進
  resetStage();
  _applyStageUnits('knight', 2);
  const fillsHalf = _stageCellFills('knight');
  check('半格 → 第一格填 50%', Math.abs(fillsHalf[0] - 0.5) < 1e-9, `fills=${JSON.stringify(fillsHalf)}`);
  _applyStageUnits('knight', 4);
  const fillsFull = _stageCellFills('knight');
  check('1 格 + ½ 格 → 第一格滿、第二格 50%',
    Math.abs(fillsFull[0] - 1) < 1e-9 && Math.abs(fillsFull[1] - 0.5) < 1e-9,
    `fills=${JSON.stringify(fillsFull)}`);

  // 一次填過成個 Stage（3 格 = 12 段）→ 過關
  resetStage();
  const r2 = _applyStageUnits('knight', 12);
  check('一次填滿 3 格 = 即時過關', r2.cleared === true && Game.state.stage.knight.cleared === 1,
    `cleared=${Game.state.stage.knight.cleared}`);
  // 只填 2 格（8 段）未夠 3 格 → 唔應該過關
  resetStage();
  const r3 = _applyStageUnits('knight', 8);
  check('只填 2 格（8 段）未夠 3 格 → 唔過關',
    r3.cleared === false && Game.state.stage.knight.units === 8,
    `cleared=${r3.cleared} units=${Game.state.stage.knight.units}`);

  // 隊伍之間進度互不干擾
  resetStage();
  Game.state.stage.mage = { index: 0, units: 0, cleared: 0 };
  _applyStageUnits('knight', 4);
  check('隊伍之間進度互不干擾（knight 有進度、mage 冇）',
    Game.state.stage.knight.units === 4 && Game.state.stage.mage.units === 0,
    `knight=${Game.state.stage.knight.units} mage=${Game.state.stage.mage.units}`);

  // --- 3) 局長 = Stage 數 ---
  Game.settings.goalStages = 3;
  let g = _stageGoalQuestions();
  check('局長 3 Stage → 目標 9 題、硬上限 18 題',
    g.stages === 3 && g.target === 9 && g.hardCap === 18, JSON.stringify(g));
  Game.settings.goalStages = 1;
  g = _stageGoalQuestions();
  check('局長 1 Stage → 目標 3 題、硬上限 6 題',
    g.stages === 1 && g.target === 3 && g.hardCap === 6, JSON.stringify(g));
  Game.settings.goalStages = 0;
  g = _stageGoalQuestions();
  check('goalStages = 0 唔會出 0 Stage（fallback 到預設 3）', g.stages === 3 && g.target === 9, JSON.stringify(g));
  Game.settings.goalStages = 3;

  // --- 4) 提示階梯 4 層 ---
  const qCount = { type: 'count20', answer: 7, parts: ['🌟🌟🌟🌟🌟🌟🌟'] };
  const l1 = _easyHintText(qCount, 1);
  const l2 = _easyHintText(qCount, 2);
  const l3 = _easyHintText(qCount, 3);
  const l4 = _easyHintText(qCount, 4);
  check('提示 L1 = 重述（唔會出現答案數字）', !l1.includes('7'), l1);
  check('提示 L2 = 聚焦（唔會出現答案數字）', !l2.includes('7'), l2);
  check('提示 L3 = 部分結果（唔會出現答案數字）', !l3.includes('7'), l3);
  check('提示 L4 = 完整答案', l4.includes('7'), l4);
  check('提示 4 層係唔同內容', new Set([l1, l2, l3, l4]).size === 4, JSON.stringify([l1, l2, l3, l4]));
  check('提示層數越界會 clamp（L0 → L1、L9 → L4）',
    _easyHintText(qCount, 0) === l1 && _easyHintText(qCount, 9) === l4,
    `L0=${_easyHintText(qCount, 0)} L9=${_easyHintText(qCount, 9)}`);
  check('L4 保留舊行為（count20 → 答案係 N 個）', l4 === '答案係 7 個', l4);
  check('compareLength L4 用 optionLabels',
    _easyHintText({ type: 'compareLength', answer: '1', optionLabels: { '1': '左', '2': '右' } }, 4) === '答案係 左',
    _easyHintText({ type: 'compareLength', answer: '1', optionLabels: { '1': '左', '2': '右' } }, 4));
} catch (e) {
  check('T109 Stage audit 執行得到（唔好 throw）', false, e.message);
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
