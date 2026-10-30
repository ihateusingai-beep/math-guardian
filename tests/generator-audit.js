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

const { readAppSource, readAppJs } = require('./source.js');

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
// extract a balanced statement `const X = { ... }` starting from a marker
// (naive brace counting — same approach the existing loadGenerators uses)
function extractBalancedStatement(body, marker) {
  const startIdx = body.indexOf(marker);
  if (startIdx === -1) throw new Error(`Not found: ${marker}`);
  const braceIdx = body.indexOf('{', startIdx);
  if (braceIdx === -1) throw new Error(`No brace after: ${marker}`);
  let depth = 0, endIdx = -1;
  for (let i = braceIdx; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } }
  }
  if (endIdx === -1) throw new Error(`Unbalanced braces: ${marker}`);
  return body.slice(startIdx, endIdx);
}

// V3.6 cycle111b: ScopeLevel 模組（級數階梯 + bank 過濾 + 適應）
// 由 `const SCOPE_LEVEL_MAX` 到 `_checkMilestones` 之前。
// ⚠️ cycle111h: end marker 一定要用**程式碼**（function 簽名），唔可以用註解文字 ——
//    註解係「可以隨手清理」嘅嘢，一清理呢個 module 就抽唔到（cycle111h 實測捉到：
//    `// V3.6 cycle110: 概念卡 4 里程碑` 一被刪 → FATAL: ScopeLevel end marker not found）。
function extractScopeLevelSource(body) {
  const startMarker = 'const SCOPE_LEVEL_MAX =';
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) throw new Error('SCOPE_LEVEL_MAX not found');
  const endMarker = 'function _checkMilestones(';
  const endIdx = body.indexOf(endMarker, startIdx);
  if (endIdx === -1) throw new Error('ScopeLevel end marker not found');
  return body.slice(startIdx, endIdx);
}

// extract Generators from index.html
// ============================================================

function loadGenerators() {
  const body = readAppJs();
  if (!body) throw new Error('No <script> found in index.html');

  // Capture the Generators object literal — start at "const Generators = {"
  const genSrc = extractBalancedStatement(body, 'const Generators = {');

  // V3.6 cycle111b: 長短 / 高矮嘅比例 helper（喺 Generators 上面一層）
  const comparePairSrc = extractBalancedStatement(body, 'function _comparePair(ratio) {');

  // Capture TYPE_REGISTRY similarly
  const regSrc = extractBalancedStatement(body, 'const TYPE_REGISTRY = {');

  // V3.6 cycle111b: Generators.count20 / compareLength / _nextInSeq / _lPickMC
  // 會問 _scopeLevelParams() → 一定要一齊抽 ScopeLevel 模組入嚟，
  // 否則真實執行會 ReferenceError（cycle111b 實測）。
  const scopeSrc = extractScopeLevelSource(body);

  // Wrap in a Function that injects our mocks
  const code = `
    ${regSrc}
    ${scopeSrc}
    ${comparePairSrc}
    ${genSrc}
    return { TYPE_REGISTRY, Generators };
  `;
  // The Generators object literal references randInt, shuffle, Game — all in scope via the wrapper
  const fn = new Function(
    'randInt', 'shuffle', 'Game', 'document', 'window', 'localStorage', 'AudioCtx', 'console',
    'Profile', 'FX',
    code
  );
  const Profile = { data: {}, save() {} };
  const FX = { screenAlert: () => {} };
  return fn(randInt, shuffle, Game, document, window, localStorage, AudioCtx, console_, Profile, FX);
}

// V3.6 cycle111b: 抽出真實 ScopeLevel 模組 + 真實 TYPE_REGISTRY，
// 用 mock Profile / Game / FX 實際執行，斷言實際 state 變化。
function loadScopeLevel(env) {
  const body = readAppJs();
  const scopeSrc = extractScopeLevelSource(body);
  const regSrc = extractBalancedStatement(body, 'const TYPE_REGISTRY = {');
  const code = `
    ${regSrc}
    ${scopeSrc}
    // ⚠️ cycle111j：自動升降級已移除 → LEVEL_UP_STREAK / LEVEL_DOWN_STREAK /
    //    _updateScopeLevel 已經由 app.js 刪走，呢度亦都唔再 export。
    return {
      SCOPE_LEVEL_MAX, SCOPE_LEVEL_PARAMS,
      _scopeSupportsLevel, _scopeLevelOf, _scopeLevelParams,
      _bankMatchesLevel,
    };
  `;
  const fn = new Function('Game', 'Profile', 'FX', code);
  return fn(env.Game, env.Profile, env.FX);
}

// V3.6 cycle111b: 真實 bank 種子數據（用嚟驗 _bankMatchesLevel 對住真內容）
function loadBankSeed() {
  const body = readAppJs();
  const seedSrc = extractBalancedStatement(body, 'const seed = {');
  return new Function(`${seedSrc}; return seed;`)();
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
  const body = readAppJs();
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
  const body = readAppJs();
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
               '_easyQuestionTotal',
               '_easyHintL1', '_easyHintL2', '_easyHintL3', '_easyHintL4', '_easyHintText']
    .map(grabFn).join('\n');

  const code = `
    ${consts}
    ${fns}
    return { STAGE_CELLS, CELL_UNITS, _cellUnits, _applyStageUnits, _stageCellFills,
             _stageGoalQuestions, _easyQuestionTotal, _easyHintText };
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
  // ⚠️ cycle111j：局長用 Number.isFinite + 夾值（0 → 1 關，非法值 → 預設 4）
  check('goalStages = 0 要夾返 1 關（唔係 fallback 到預設）', g.stages === 1 && g.target === 3, JSON.stringify(g));
  Game.settings.goalStages = 4;
  g = _stageGoalQuestions();
  check('局長 4 Stage → 目標 12 題、硬上限 24 題（M4 里程碑要 12 題先達得到）',
    g.stages === 4 && g.target === 12 && g.hardCap === 24, JSON.stringify(g));
  check('_easyQuestionTotal() == _stageGoalQuestions().target（畫面題數唯一真實來源）',
    mod._easyQuestionTotal() === _stageGoalQuestions().target,
    `helper=${mod._easyQuestionTotal()} target=${_stageGoalQuestions().target}`);
  // ⚠️ 預設值由真實 app 原始碼抽出（唔係 mock）——避免 mock 同真實脫節
  {
    const realSrc = readAppJs();
    const mDef = realSrc.match(/soloMode: 'bridge',[\s\S]{0,400}goalStages:\s*(\d+)/);
    check('真實 app.js 嘅預設局長 = 4 關（目標 12 題）',
      !!mDef && Number(mDef[1]) === 4, mDef ? mDef[0].slice(-40) : 'not found');
    Game.settings.goalStages = 4;
  }

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

// ============================================================
// T110: 概念卡里程碑 functional audit (cycle 110)
// ============================================================

function loadMilestoneModule() {
  const body = readAppJs();
  if (!body) throw new Error('No <script> found in index.html');
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
  const fns = ['_checkMilestones', '_applyStageUnits', '_stageCellFills', '_islandAdvance'].map(grabFn).join('\n');
  const code = `
    ${consts}
    ${fns}
    return { _checkMilestones, _applyStageUnits, _stageCellFills, _islandAdvance };
  `;
  const __Game = {
    state: { hintStreakByType: {}, sessionStreak: 0, _islandCounted: false,
             stage: { knight: { index: 0, units: 0, cleared: 0 }, mage: { index: 0, units: 0, cleared: 0 } } },
    settings: { goalStages: 3 },
  };
  const __Profile = { data: {}, save() { __Profile.saved = (__Profile.saved || 0) + 1; } };
  const __TYPE_REGISTRY = { count20: { label: '數數' } };
  const __FX = { screenAlert: () => {} };
  const fn = new Function('Game', 'Profile', 'TYPE_REGISTRY', 'FX', code);
  return { mod: fn(__Game, __Profile, __TYPE_REGISTRY, __FX), Game: __Game, Profile: __Profile };
}

console.log('\n[T110] V3.6 cycle-110 (concept-card milestone functional audit)');

try {
  const { mod, Game, Profile } = loadMilestoneModule();
  const { _checkMilestones, _applyStageUnits, _islandAdvance } = mod;

  // --- M1: 首次答啱 ---
  _checkMilestones('count20', true, 0, false);
  check('M1 首次答啱 → 解鎖', !!(Profile.data.milestonesByType && Profile.data.milestonesByType.count20 && Profile.data.milestonesByType.count20.m1),
    JSON.stringify(Profile.data.milestonesByType));
  check('M1 存咗入 Profile（持久化）', (Profile.saved || 0) >= 1, `saved=${Profile.saved}`);

  // --- M2: 冇用提示連對 5 題 ---
  Profile.data = {}; Game.state.hintStreakByType = {}; Game.state.sessionStreak = 0;
  for (let i = 0; i < 4; i++) _checkMilestones('count20', true, 0, false);
  check('M2 連對 4 題未解鎖', !(Profile.data.milestonesByType.count20 || {}).m2,
    JSON.stringify(Profile.data.milestonesByType));
  _checkMilestones('count20', true, 0, false);
  check('M2 冇提示連對 5 題 → 解鎖', !!(Profile.data.milestonesByType.count20 || {}).m2,
    JSON.stringify(Profile.data.milestonesByType));

  // --- M2 唔應該喺「用咗提示」時解鎖 ---
  Profile.data = {}; Game.state.hintStreakByType = {}; Game.state.sessionStreak = 0;
  for (let i = 0; i < 8; i++) _checkMilestones('count20', true, 2, false);
  check('M2 用咗提示 → 唔解鎖', !(Profile.data.milestonesByType.count20 || {}).m2,
    JSON.stringify(Profile.data.milestonesByType));

  // --- M3: 錯咗之後救回 ---
  Profile.data = {}; Game.state.hintStreakByType = {}; Game.state.sessionStreak = 0;
  _checkMilestones('count20', true, 0, false);
  check('M3 未救回之前未解鎖', !(Profile.data.milestonesByType.count20 || {}).m3, JSON.stringify(Profile.data.milestonesByType));
  _checkMilestones('count20', true, 0, true);
  check('M3 錯咗之後重播答啱 → 解鎖', !!(Profile.data.milestonesByType.count20 || {}).m3,
    JSON.stringify(Profile.data.milestonesByType));

  // --- M4: 同一局連對 10 題 ---
  Profile.data = {}; Game.state.hintStreakByType = {}; Game.state.sessionStreak = 0;
  for (let i = 0; i < 9; i++) _checkMilestones('count20', true, 0, false);
  check('M4 連對 9 題未解鎖', !(Profile.data.milestonesByType.count20 || {}).m4, JSON.stringify(Profile.data.milestonesByType));
  _checkMilestones('count20', true, 0, false);
  check('M4 同一局連對 10 題 → 解鎖', !!(Profile.data.milestonesByType.count20 || {}).m4,
    JSON.stringify(Profile.data.milestonesByType));

  // --- 答錯會清空連勝 ---
  Profile.data = {}; Game.state.hintStreakByType = {}; Game.state.sessionStreak = 0;
  _checkMilestones('count20', true, 0, false);
  _checkMilestones('count20', false, 0, false);
  check('答錯 → 連勝清零', Game.state.sessionStreak === 0, `streak=${Game.state.sessionStreak}`);

  // --- 里程碑唔會重複解鎖（時間戳唔變） ---
  Profile.data = {}; Game.state.hintStreakByType = {}; Game.state.sessionStreak = 0;
  _checkMilestones('count20', true, 0, false);
  const first = Profile.data.milestonesByType.count20.m1;
  _checkMilestones('count20', true, 0, false);
  check('M1 唔會被重複解鎖（時間戳唔變）', Profile.data.milestonesByType.count20.m1 === first,
    `${first} vs ${Profile.data.milestonesByType.count20.m1}`);

  // --- 扣格唔會變負 ---
  Game.state.stage.knight = { index: 0, units: 0, cleared: 0 };
  _applyStageUnits('knight', -2);
  check('扣 ½ 格喺 0 進度 → 唔會變負', Game.state.stage.knight.units === 0, `units=${Game.state.stage.knight.units}`);
  _applyStageUnits('knight', 8);
  _applyStageUnits('knight', -2);
  check('扣 ½ 格喺有進度 → 真係扣', Game.state.stage.knight.units === 6, `units=${Game.state.stage.knight.units}`);

  // --- 島嶼旅程：每局只加一次 ---
  Profile.data = {}; Game.state._islandCounted = false;
  _islandAdvance();
  _islandAdvance();
  check('島嶼旅程每局只加一次', Profile.data.islandStage === 1, `islandStage=${Profile.data.islandStage}`);
  Game.state._islandCounted = false;
  _islandAdvance();
  check('下一局再加一次', Profile.data.islandStage === 2, `islandStage=${Profile.data.islandStage}`);
} catch (e) {
  check('T110 milestone audit 執行得到（唔好 throw）', false, e.message);
}

// ============================================================
// T110b: 接力「輪到邊隊」單一真實來源 functional audit (cycle 110b)
//
// Bug shape（cycle 110 實作時引入）: 新開咗 Game.state.turnTeam 做接力，
// 但 badge（作答中/待命中）、review 重練對象、Adaptive 全部讀 currentTeam
// → 可見卡片同 currentTeam 唔一致（小美答緊但 badge 話佢待命）。
// Fix: 收埋成 currentTeam 一個欄位。
// ⚠️ regex 結構測試捉唔到「兩個欄位值唔一致」→ 必須真實執行。
// ============================================================

function loadRelayModule() {
  const body = readAppJs();
  if (!body) throw new Error('No <script> found in index.html');
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
  // object method（`setSENTurn(team) {`）—— 同一個 brace scanner
  function grabMethod(name) {
    const marker = `${name}(team) {`;
    const i = body.indexOf(marker);
    if (i === -1) throw new Error(`${name} method not found`);
    const braceStart = body.indexOf('{', i);
    let depth = 0, end = -1;
    for (let j = braceStart; j < body.length; j++) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
    }
    if (end === -1) throw new Error(`${name} method end not found`);
    return body.slice(i, end);
  }
  const code = `
    const UI = { setSENTurn: function ${grabMethod('setSENTurn')} };
    ${grabFn('_scheduleNextQuestion')}
    return { _scheduleNextQuestion, setSENTurn: UI.setSENTurn };
  `;
  return new Function('Game', '$', 'nextQuestion', 'setTimeout', code);
}

console.log('\n[T110b] V3.6 cycle-110b (relay single source of truth functional audit)');

try {
  const makeModule = loadRelayModule();

  function mkEl(id) {
    const classes = new Set();
    const el = {
      id,
      textContent: '',
      innerHTML: '',
      style: { setProperty: () => {} },
      setAttribute: () => {},
      classList: {
        toggle: (c, on) => { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
      },
    };
    return el;
  }
  function mkEnv() {
    const els = {};
    const $ = (id) => (els[id] || (els[id] = mkEl(id)));
    // 預先建立會用到嘅元素（令斷言可以「乾淨咁 fail」而唔係 throw）
    ['sen-panel-knight', 'sen-panel-mage', 'sen-turn-banner', 'sen-board',
     'knight-card', 'mage-card'].forEach((id) => { $(id); });
    const Game = {
      state: {
        current: { knight: null, mage: null },
        currentTeam: 'knight',
        running: true, ended: false,
        _easyTeamDone: { knight: false, mage: false },
        replayQ: null,
        hintLevel: { knight: 0, mage: 0 },
      },
      settings: { difficulty: 'easy', playLayout: 'dual', team: 'coop',
                   playerLabel: '小明', playerLabelRight: '小美' },
    };
    const calls = { nextQuestion: [], shown: [] };
    const UI = {
      setSENTurn: null,   // 由 module 內部 const UI 提供（外面用 Game.state 對照）
      showQuestion: (team) => calls.shown.push(team),
    };
    // setTimeout 即時執行（測試唔想等真實 delay）
    const setTimeout = (fn) => { fn(); return 0; };
    const nextQuestion = (team) => {
      calls.nextQuestion.push(team);
      Game.state.current[team] = { type: 'count20', answer: 7 };
    };
    const mod = makeModule(Game, $, nextQuestion, setTimeout);
    return { Game, $, els, calls, mod };
  }

  // --- 1. 接力切換：currentTeam 必須跟住變 ---
  {
    const { Game, els, mod } = mkEnv();
    mod._scheduleNextQuestion('knight', 0);
    check('T110b-01 接力後 currentTeam = 下一隊（mage）', Game.state.currentTeam === 'mage',
      `currentTeam=${Game.state.currentTeam}`);
    // --- 2. 可見 panel 必須同 currentTeam 一致（原本嘅 bug 就係呢度唔一致）---
    // ⚠️ 係 SEN panel（#sen-panel-*），唔係經典 game screen 嘅 #knight-card / #mage-card
    const mageVisible = !els['sen-panel-mage'].classList.contains('hidden');
    const knightHidden = els['sen-panel-knight'].classList.contains('hidden');
    check('T110b-02 可見 panel == currentTeam（mage 見、knight 隱）', mageVisible && knightHidden,
      `mageVisible=${mageVisible} knightHidden=${knightHidden} currentTeam=${Game.state.currentTeam}`);
    check('T110b-03 接力 banner 顯示「輪到 小美」', /輪到 小美/.test(els['sen-turn-banner'].textContent),
      `banner="${els['sen-turn-banner'].textContent}"`);
    // --- 3. 答完嗰隊唔可以仲有題（避免兩隊同時有題）---
    check('T110b-04 答完嗰隊冇題（current[knight] 係 null）', Game.state.current.knight === null,
      `current.knight=${JSON.stringify(Game.state.current.knight)}`);
    check('T110b-05 新題派俾 currentTeam 嗰隊', Game.state.current.mage && Game.state.current.mage.answer === 7,
      `current.mage=${JSON.stringify(Game.state.current.mage)}`);
  }

  // --- 4. 答錯嗰條題傳俾另一隊（同一條題，答案一致）---
  {
    const { Game, els, calls, mod } = mkEnv();
    const wrongQ = { type: 'count20', answer: 4 };
    Game.state.replayQ = wrongQ;
    mod._scheduleNextQuestion('knight', 0);
    check('T110b-06 答錯嗰條題原封不動傳俾下一隊', Game.state.current.mage && Game.state.current.mage.answer === 4,
      `current.mage=${JSON.stringify(Game.state.current.mage)}`);
    check('T110b-07 傳手時唔抽新題（nextQuestion 冇被叫）', calls.nextQuestion.length === 0,
      `nextQuestion calls=${JSON.stringify(calls.nextQuestion)}`);
    check('T110b-08 傳手後 currentTeam = mage', Game.state.currentTeam === 'mage',
      `currentTeam=${Game.state.currentTeam}`);
  }

  // --- 5. 唔可以存在第二個 turnTeam 欄位（漂移源）---
  {
    const { Game } = mkEnv();
    const mod_keys = Object.keys(Game.state);
    check('T110b-09 Game.state 冇 turnTeam（單一真實來源）', !mod_keys.includes('turnTeam'),
      `state keys=${JSON.stringify(mod_keys)}`);
    check('T110b-10 currentTeam 存在並且有值', Game.state.currentTeam === 'knight',
      `currentTeam=${Game.state.currentTeam}`);
  }

  // --- 6. easy solo 唔會傳手（只有 knight）---
  {
    const { Game, els, mod } = mkEnv();
    Game.settings.playLayout = 'solo';
    mod._scheduleNextQuestion('knight', 0);
    check('T110b-11 easy solo 唔傳手（currentTeam 仍然係 knight）', Game.state.currentTeam === 'knight',
      `currentTeam=${Game.state.currentTeam}`);
    check('T110b-12 easy solo 唔顯示接力 banner',
      els['sen-turn-banner'].classList.contains('hidden'),
      `banner="${els['sen-turn-banner'].textContent}"`);
    check('T110b-13 easy solo 淨係顯示 knight panel',
      !els['sen-panel-knight'].classList.contains('hidden') &&
      els['sen-panel-mage'].classList.contains('hidden'),
      `knight=${els['sen-panel-knight'].classList.contains('hidden')} mage=${els['sen-panel-mage'].classList.contains('hidden')}`);
  }

  // --- 7. 死鎖 case：一隊完成之後，接力必須跳返俾仲有進度嗰隊 ---
  //  bug shape: 小明做完 → 傳俾小美 → 小美答完 → 傳返俾小明(已完成)
  //            → setTimeout 見 _easyTeamDone[nextTeam] 就 return → 冇人再答題
  {
    const { Game, els, calls, mod } = mkEnv();
    Game.state._easyTeamDone.knight = true;   // 小明已完成
    mod._scheduleNextQuestion('mage', 0);      // 小美答完 → 應該傳返俾…小明？唔係！
    check('T110b-14 已完成嘅隊伍唔會再攞到下一條題（避免死鎖）',
      Game.state.currentTeam === 'mage' && Game.state.current.mage !== null,
      `currentTeam=${Game.state.currentTeam} current.mage=${JSON.stringify(Game.state.current.mage)} current.knight=${JSON.stringify(Game.state.current.knight)}`);
    check('T110b-15 接力仍然有題可答（唔會停喺冇題嗰隊）',
      (Game.state.current.mage || Game.state.current.knight) !== null,
      `current=${JSON.stringify(Game.state.current)}`);
  }

  // --- 8. 兩隊都完成 → 唔應該再派題 ---
  {
    const { Game, calls, mod } = mkEnv();
    Game.state._easyTeamDone.knight = true;
    Game.state._easyTeamDone.mage = true;
    Game.state.running = false;   // _easyGameComplete 會喺兩隊都完成時 set running=false
    mod._scheduleNextQuestion('knight', 0);
    check('T110b-16 兩隊都完成 → 唔再派新題', calls.nextQuestion.length === 0,
      `nextQuestion calls=${JSON.stringify(calls.nextQuestion)}`);
  }
} catch (e) {
  check('T110b relay audit 執行得到（唔好 throw）', false, e.message);
}

// ============================================================
// V3.6 cycle111b: scope 內 3 級難度 —— 真實執行
// ============================================================
console.log('\n[T111b] V3.6 cycle-111b (scope 內 3 級難度 functional audit)');

function mkScopeEnv(difficulty) {
  const Game = { settings: { difficulty: difficulty || 'easy', mode: 'choice' }, state: {} };
  const Profile = {
    data: { levelByType: {}, levelStreak: {} },
    saved: 0,
    save() { this.saved++; },
  };
  const FX = { alerts: [], screenAlert(t) { this.alerts.push(t); } };
  return { Game, Profile, FX };
}

try {
  const { Generators } = loadGenerators();
  const env0 = mkScopeEnv('easy');
  const SL = loadScopeLevel(env0);

  // --- 1. 級數階梯表完整性 ---
  {
    const LEVELS = Object.keys(SL.SCOPE_LEVEL_PARAMS);
    check('T111b-1 有級數階梯嘅 scope type = 8 個',
      LEVELS.length === 8, `got ${LEVELS.length}: ${LEVELS.join(',')}`);
    for (const t of LEVELS) {
      const params = SL.SCOPE_LEVEL_PARAMS[t];
      check(`T111b-1 級數表 ${t} 有 3 級`,
        Array.isArray(params) && params.length === 3, JSON.stringify(params));
    }
    check('T111b-1 級數上限 = 3', SL.SCOPE_LEVEL_MAX === 3);
    // ⚠️ cycle111j：自動升降級已移除（Ken 決定）—— 門檻常數同 _updateScopeLevel 唔存在。
    const appSrc111j = readAppJs();
    check('T111b-1 升/降級門檻常數已移除', !/LEVEL_UP_STREAK/.test(appSrc111j) && !/LEVEL_DOWN_STREAK/.test(appSrc111j));
    check('T111b-1 自動升降級函數已移除', !/function _updateScopeLevel/.test(appSrc111j));
    check('T111b-1 模組 export 冇 _updateScopeLevel', SL._updateScopeLevel === undefined);
    // ⚠️ 適應只准喺同一 scope 內發生 → classic type 唔可以有級數階梯
    check('T111b-1 classic type 唔支援級數',
      !SL._scopeSupportsLevel('add10') && !SL._scopeSupportsLevel('sub10') &&
      !SL._scopeSupportsLevel('ordering'));
    check('T111b-1 easy scope type 支援級數',
      SL._scopeSupportsLevel('count20') && SL._scopeSupportsLevel('compareLength') &&
      SL._scopeSupportsLevel('compareHeight') && SL._scopeSupportsLevel('orderAsc20') &&
      SL._scopeSupportsLevel('orderDesc20') && SL._scopeSupportsLevel('learnL') &&
      SL._scopeSupportsLevel('findLDrink') && SL._scopeSupportsLevel('findLItem'));
  }

  // --- 2. _scopeLevelOf 邊界（falsy default 陷阱） ---
  {
    const { Game, Profile } = mkScopeEnv('easy');
    const S = loadScopeLevel({ Game, Profile, FX: { screenAlert: () => {} } });
    check('T111b-2 classic type 一律 L1', S._scopeLevelOf('add10') === 1);
    check('T111b-2 未設定嘅 scope type = L1', S._scopeLevelOf('count20') === 1);
    // ⚠️ cycle111j：級數**固定 L1** —— 舊 profile 殘留嘅 levelByType 唔再影響行為
    //    （如果仲讀，舊學生會由 L3/L2 開局 → 違反「固定 L1」契約）。
    Profile.data.levelByType.count20 = 3;
    check('T111b-2 舊 profile 殘留 levelByType=3 → 仍然 L1', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);
    Profile.data.levelByType.count20 = 2;
    check('T111b-2 levelByType=2 → 仍然 L1', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);
    Profile.data.levelByType.count20 = 0;
    check('T111b-2 levelByType=0 → L1', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);
    Profile.data.levelByType.count20 = 99;
    check('T111b-2 越界值 → L1', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);
    Profile.data.levelByType.count20 = '2';
    check('T111b-2 string 數字 → L1', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);
    Profile.data.levelByType.count20 = NaN;
    check('T111b-2 NaN → L1', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);

    // classic mode 一律 L1（easy 嘅級數唔會漏入 classic）
    const hard = mkScopeEnv('normal');
    const S2 = loadScopeLevel(hard);
    hard.Profile.data.levelByType.count20 = 3;
    check('T111b-2 classic mode 一律 L1', S2._scopeLevelOf('count20') === 1);
  }

  // --- 3. ⚠️ cycle111j：自動升降級已移除 → 級數固定 L1 ---
  {
    const env = mkScopeEnv('easy');
    const S = loadScopeLevel(env);
    const P = env.Profile;
    const savedBefore = P.saved;
    const alertsBefore = env.FX.alerts.length;

    check('T111b-3 級數恆 L1（冇任何路徑可以升級）', S._scopeLevelOf('count20') === 1,
      `got ${S._scopeLevelOf('count20')}`);
    check('T111b-3 冇寫 levelByType',
      !P.data.levelByType || Object.keys(P.data.levelByType).length === 0,
      JSON.stringify(P.data.levelByType));
    check('T111b-3 冇 levelStreak（streak 機制已廢除）',
      !P.data.levelStreak || Object.keys(P.data.levelStreak).length === 0,
      JSON.stringify(P.data.levelStreak));
    check('T111b-3 冇存檔', P.saved === savedBefore, `saved ${savedBefore} → ${P.saved}`);
    check('T111b-3 冇升降級提示（學生唔會再見到「⬇️ 降級」）', env.FX.alerts.length === alertsBefore,
      JSON.stringify(env.FX.alerts));

    // classic mode 一樣固定 L1
    const env2 = mkScopeEnv('normal');
    const S2 = loadScopeLevel(env2);
    check('T111b-3 classic mode 都係 L1', S2._scopeLevelOf('count20') === 1);
  }

  // --- 4. 生成器真實產出符合級數 ---
  {
    // count20: L1 1–3 · L2 1–5 · L3 1–10
    const maxes = { 1: 3, 2: 5, 3: 10 };
    for (const lv of [1, 2, 3]) {
      let ok = true, detail = '';
      for (let i = 0; i < 80; i++) {
        const q = Generators.count20('choice', lv);
        if (typeof q.answer !== 'number' || q.answer < 1 || q.answer > maxes[lv]) {
          ok = false; detail = `answer=${q.answer}`; break;
        }
        // emoji 數量要同答案一致（學生靠數圖）
        const emojiLen = [...q.parts[0]].length;
        if (emojiLen !== q.answer) { ok = false; detail = `emoji=${emojiLen} answer=${q.answer}`; break; }
      }
      check(`T111b-4 count20 L${lv} 答案喺 1–${maxes[lv]} 之內（圖數 = 答案）`, ok, detail);
    }

    // compareLength / compareHeight: L1 1:2 · L2 1:3 · L3 1:1.5
    const ratios = { 1: 2, 2: 3, 3: 1.5 };
    for (const fn of ['compareLength', 'compareHeight']) {
      for (const lv of [1, 2, 3]) {
        let ok = true, detail = '';
        for (let i = 0; i < 60; i++) {
          const q = Generators[fn](lv);
          const ex = q.extra || {};
          const a = Number(ex.a), b = Number(ex.b);
          const r = Math.max(a, b) / Math.min(a, b);
          if (Math.abs(r - ratios[lv]) > 0.001) { ok = false; detail = `a=${a} b=${b} r=${r}`; break; }
          // 答案要真係對應問法
          const askLong = ex.ask === 'long' || ex.ask === 'tall';
          const shouldBe1 = askLong ? (a > b) : (a < b);
          if ((q.answer === '1') !== shouldBe1) { ok = false; detail = `answer=${q.answer} ask=${ex.ask}`; break; }
        }
        check(`T111b-4 ${fn} L${lv} 比例 = ${ratios[lv]}（答案對應問法）`, ok, detail);
      }
    }

    // 順序題: L1 步長 2 · L2/L3 步長 1
    for (const [lv, step] of [[1, 2], [2, 1], [3, 1]]) {
      let ok = true, detail = '';
      for (const dir of ['asc', 'desc']) {
        for (let i = 0; i < 60; i++) {
          const s = Generators._nextInSeq(dir, lv);
          const d = Math.abs(s.stem[1] - s.stem[0]);
          if (d !== step) { ok = false; detail = `${dir} stem=${s.stem}`; break; }
          if (Number(s.answer) !== s.stem[1] + (dir === 'asc' ? step : -step)) {
            ok = false; detail = `${dir} ans=${s.answer} stem=${s.stem}`; break;
          }
          if (s.stem[0] < 1 || s.stem[1] < 1 || s.stem[0] > 20 || s.stem[1] > 20) {
            ok = false; detail = `${dir} 範圍越界 ${s.stem}`; break;
          }
          if (!s.options.includes(String(s.answer))) {
            ok = false; detail = `${dir} 答案唔喺選項入面`; break;
          }
        }
      }
      check(`T111b-4 順序題 L${lv} 步長 = ${step}（asc + desc）`, ok, detail);
    }

    // L3 干擾數字（跳級答案）一定喺選項入面
    let decoyOK = true, decoyDetail = '';
    for (const dir of ['asc', 'desc']) {
      for (let i = 0; i < 80; i++) {
        const s = Generators._nextInSeq(dir, 3);
        const decoy = Math.max(1, Math.min(20, Number(s.answer) + (dir === 'asc' ? 2 : -2)));
        if (!s.options.map(Number).includes(decoy)) {
          decoyOK = false; decoyDetail = `${dir} ans=${s.answer} decoy=${decoy} opts=${s.options}`;
          break;
        }
      }
    }
    check('T111b-4 順序題 L3 跳級干擾數字一定出現喺選項', decoyOK, decoyDetail);

    // L 容量題: L1 → 1L vs 2L · L2 → 1L vs 1.5L · L3 → 1L vs 1.5L vs 2L
    const expectAlt = { 1: ['2L'], 2: ['1.5L'], 3: ['1.5L', '2L'] };
    for (const type of ['learnL', 'findLDrink', 'findLItem']) {
      for (const lv of [1, 2, 3]) {
        let ok = true, detail = '';
        for (let i = 0; i < 50; i++) {
          const q = Generators[type](lv);
          const items = (q.extra && q.extra.items) || [];
          if (items.length !== 4) { ok = false; detail = `items=${items.length}`; break; }
          const alts = items
            .filter((it) => /^\d+(\.\d+)?L$/.test(it.pkg) && it.pkg !== '1L')
            .map((it) => it.pkg).sort().join(',');
          const want = expectAlt[lv].slice().sort().join(',');
          if (alts !== want) { ok = false; detail = `alts=${alts} want=${want}`; break; }
          if (q.extra.answerPkg !== '1L') { ok = false; detail = `answerPkg=${q.extra.answerPkg}`; break; }
        }
        check(`T111b-4 ${type} L${lv} 干擾容量 = ${expectAlt[lv].join('+')}（共 4 選項）`, ok, detail);
      }
    }

    // ⚠️ findLDrink 答案一定係飲品（cycle111b 修 pre-existing bug：
    //    舊 code 可能抽到洗潔精 / 漂白水做答案）
    {
      const pool = Generators._lItemPool;
      let bad = null;
      for (let i = 0; i < 150; i++) {
        const q = Generators.findLDrink(1 + (i % 3));
        const it = pool.find((x) => x.name === q.extra.answerName);
        if (!it) { bad = `unknown item ${q.extra.answerName}`; break; }
        if (it.drink !== true) { bad = `${it.name}(${it.pkg}) 唔係飲品`; break; }
        if (it.pkg !== '1L') { bad = `${it.name}(${it.pkg}) 唔係 1L`; break; }
      }
      check('T111b-4 findLDrink 答案一定係「1L 飲品」（唔會抽到洗潔精）', !bad, bad || '');
    }
  }

  // --- 5. bank 過濾：對住真實 bank 種子內容 ---
  {
    const seed = loadBankSeed();
    const env = mkScopeEnv('easy');
    const S = loadScopeLevel(env);

    const countSeeds = seed.count20 || [];
    check('T111b-5 真實 bank 有 count20 種子', countSeeds.length > 0);
    for (const lv of [1, 2, 3]) {
      const max = { 1: 3, 2: 5, 3: 10 }[lv];
      const accepted = countSeeds.filter((q) => S._bankMatchesLevel('count20', q, lv));
      check(`T111b-5 count20 L${lv} 通過嘅 bank 題答案全部 ≤ ${max}`,
        accepted.every((q) => Number(q.answer) >= 1 && Number(q.answer) <= max),
        JSON.stringify(accepted.map((q) => q.answer)));
    }
    check('T111b-5 count20 L1 至少有一條 bank 題可用（過濾唔係空轉）',
      countSeeds.filter((q) => S._bankMatchesLevel('count20', q, 1)).length > 0);

    for (const t of ['compareLength', 'compareHeight']) {
      const seeds = seed[t] || [];
      check(`T111b-5 真實 bank 有 ${t} 種子`, seeds.length > 0);
      for (const lv of [1, 2, 3]) {
        const ratio = { 1: 2, 2: 3, 3: 1.5 }[lv];
        const accepted = seeds.filter((q) => S._bankMatchesLevel(t, q, lv));
        check(`T111b-5 ${t} L${lv} 通過嘅 bank 題比例全部 = ${ratio}`,
          accepted.every((q) => {
            const ex = q.extra || {};
            const a = Number(ex.a != null ? ex.a : ex.left);
            const b = Number(ex.b != null ? ex.b : ex.right);
            if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
            return Math.abs(Math.max(a, b) / Math.min(a, b) - ratio) < 0.01;
          }), JSON.stringify(accepted.map((q) => (q.extra || {}).a)));
      }
    }

    // ⚠️ 舊 order bank 種子嘅 step 同答案唔一致（例如 [4,6] → 答 11）
    //    → 唔應該通過任何級數嘅過濾（否則學生會見到「4 · 6 · ？」答 11）
    for (const t of ['orderAsc20', 'orderDesc20']) {
      const seeds = seed[t] || [];
      for (const lv of [1, 2, 3]) {
        const accepted = seeds.filter((q) => S._bankMatchesLevel(t, q, lv));
        const bad = accepted.filter((q) => {
          const stem = (q.displayNums || []).map(Number);
          if (stem.length < 2) return true;
          const step = Math.abs(stem[1] - stem[0]);
          const expected = (t === 'orderAsc20') ? stem[1] + step : stem[1] - step;
          return Number(q.answer) !== expected;
        });
        check(`T111b-5 ${t} L${lv} 通過嘅 bank 題答案一定跟得住步長`,
          bad.length === 0, JSON.stringify(bad.map((q) => [q.displayNums, q.answer])));
      }
    }

    // classic type → 級數過濾唔應該影響 bank 行為
    check('T111b-5 classic type 唔受級數過濾影響',
      S._bankMatchesLevel('add10', { answer: 99, extra: {} }, 3) === true);
    // L 容量 type 冇 bank 種子 → 過濾唔應該阻擋（行生成器）
    check('T111b-5 learnL 過濾唔阻擋（bank 冇種子 → 生成器）',
      S._bankMatchesLevel('learnL', { answer: '1', extra: { items: [] } }, 1) === true);
  }
} catch (e) {
  check('T111b scope level audit 執行得到（唔好 throw）', false, e.message);
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
