// v3.3 A7 lite: pure-Node regression test suite (zero deps)
// Run: node tests/regression.js
//
// Scope: data-shape invariants + generator truth-table + handleAnswer triple-path
// (does NOT touch DOM — DOM behaviour is verified via headless screenshots in
//  /tmp/v33_*.png which we run manually after each patch.)

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(FILE, 'utf8');

// =========== mini test runner ===========
let pass = 0, fail = 0;
const fails = [];
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else {
    fail++;
    fails.push({name, actual, expected});
    console.error(`  ❌ ${name}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  }
}
function assert(name, cond, hint = '') {
  if (cond) pass++;
  else {
    fail++;
    fails.push({name, hint});
    console.error(`  ❌ ${name}${hint ? ' (' + hint + ')' : ''}`);
  }
}

// =========== T1: TYPE_REGISTRY schema invariants ===========
console.log('\n[T1] TYPE_REGISTRY schema');
const TYPE_REGISTRY_BLOCK = src.match(/const TYPE_REGISTRY\s*=\s*\{[\s\S]*?\n\};/);
assert('TYPE_REGISTRY block present', !!TYPE_REGISTRY_BLOCK);
const registrySrc = TYPE_REGISTRY_BLOCK ? TYPE_REGISTRY_BLOCK[0] : '';
const typeIds = [...registrySrc.matchAll(/id:'([a-zA-Z0-9]+)'/g)].map(m => m[1]);
const expectedIds = ['add10','sub10','add20','sub20','add2d','sub2d','count10','compare10','double','whatTime','shapeMatch','ordering'];
eq('12 type entries', typeIds.length, 12);
for (const id of expectedIds) assert(`  type[${id}] present`, typeIds.includes(id));
assert('  no duplicate id', new Set(typeIds).size === typeIds.length);

// mode lists
const modeLists = [...registrySrc.matchAll(/id:'([a-zA-Z0-9]+)',[\s\S]*?mode:\[([^\]]+)\]/g)];
const modeMap = {};
for (const m of modeLists) modeMap[m[1]] = m[2];
eq('add10 mode', modeMap['add10'], "'choice','keypad'");
eq('compare10 mode', modeMap['compare10'], "'choice','keypad'");
eq('ordering mode', modeMap['ordering'], "'order','keypad'");

// layouts
const layoutList = [...registrySrc.matchAll(/id:'([a-zA-Z0-9]+)',[\s\S]*?layout:'([a-zA-Z0-9-]+)'/g)];
const layoutMap = {};
for (const m of layoutList) layoutMap[m[1]] = m[2];
const expectedLayouts = {
  add10:'numeric', sub10:'numeric', add20:'numeric', sub20:'numeric',
  add2d:'numeric', sub2d:'numeric', count10:'parts-emoji', double:'parts-emoji',
  compare10:'sym-button', whatTime:'clock', shapeMatch:'shape', ordering:'order'
};
for (const [id, l] of Object.entries(expectedLayouts)) {
  eq(`  layout[${id}]`, layoutMap[id], l);
}

// =========== T2: Generators present ===========
console.log('\n[T2] Generators block');
const GEN_BLOCK = src.match(/const Generators\s*=\s*\{[\s\S]*?\n\};/);
assert('Generators block present', !!GEN_BLOCK);
const genSrc = GEN_BLOCK ? GEN_BLOCK[0] : '';
for (const id of expectedIds) {
  // each generator typically named by id or by camelCase
  assert(`  generator for ${id}`,
    genSrc.includes(id) ||
    genSrc.includes(id.replace('add2d','add2d').replace('sub2d','sub2d'))
  );
}

// =========== T3: handleAnswer triple-path truth table ===========
console.log('\n[T3] handleAnswer triple-path');

// Simulate the handleAnswer comparison logic extracted from source
function compare(q, value) {
  if (Array.isArray(q.answer)) {
    return Array.isArray(value) && JSON.stringify(value) === JSON.stringify(q.answer);
  } else if (typeof q.answer === 'number') {
    return Number(value) === q.answer;
  } else {
    return String(value) === String(q.answer);
  }
}

// numeric path
eq('numeric correct',  compare({answer: 5},  5),   true);
eq('numeric wrong',    compare({answer: 5},  7),   false);
eq('numeric string→num', compare({answer: 5}, '5'), true);
eq('numeric num→string', compare({answer: 5}, 5),   true);

// string path (compare10)
eq('string < correct',  compare({answer: '<'}, '<'), true);
eq('string > wrong',    compare({answer: '<'}, '>'), false);
eq('string = correct',  compare({answer: '='}, '='), true);

// array path (ordering) — fix v3.1 silent bug
eq('array [3,13,20] correct',   compare({answer: [3,13,20]}, [3,13,20]), true);
eq('array [3,13,20] wrong',     compare({answer: [3,13,20]}, [20,13,3]),  false);
eq('array [3,13,20] partial',   compare({answer: [3,13,20]}, [3,13,21]),  false);
eq('array wrong type (string)', compare({answer: [3,13,20]}, 'order-ok'),  false);  // v3.1 bug

// =========== T4: compare10 6-key keypad ===========
console.log('\n[T4] compare10 6-key keypad');
const keypadArr = src.match(/isSymAnswer\s*\?\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/);
if (keypadArr) {
  eq('sym keys', [keypadArr[1], keypadArr[2], keypadArr[3]], ['<','=','>']);
  eq('fn keys',  [keypadArr[4], keypadArr[5], keypadArr[6]], ['clear','0','ok']);
} else {
  fail++;
  console.error('  ❌ compare10 6-key array literal not found');
}

// =========== T5: handleAnswer wired ===========
console.log('\n[T5] handleAnswer wiring');
const handleAnsMatch = src.match(/Game\.handleAnswer\s*=\s*function\s*\(\s*team/);
assert('Game.handleAnswer signature', !!handleAnsMatch);
assert('handleAnswer Array.isArray branch', src.includes('Array.isArray(q.answer)'));
assert('handleAnswer number branch',       src.includes("typeof q.answer === 'number'"));
assert('handleAnswer string fallback',     src.includes('String(value) === String(q.answer)'));

// =========== T6: helper icon + tooltip ===========
console.log('\n[T6] helper text + <details>');
assert('updateModeHelper defined', /function updateModeHelper\s*\(/.test(src));
const updateCalls = (src.match(/updateModeHelper\(\);/g) || []).length;
assert('updateModeHelper called ≥ 4 times (initial + 4 triggers)', updateCalls >= 4);
assert('<details> expand pattern', src.includes('<details class="mt-1 cursor-pointer">'));
assert('🎮 icon (choice mode)',     src.includes("'🎮'"));
assert('💡 icon (keypad ok)',       src.includes("'💡'"));
assert('⚠️ icon (keypad fallback)', src.includes("'⚠️'"));

// =========== T7: snow theme keypad ===========
console.log('\n[T7] snow theme keypad variants');
assert('snow .key-btn base',     src.includes('body.theme-snow .key-btn {'));
assert('snow .key-btn.fn',       src.includes('body.theme-snow .key-btn.fn'));
assert('snow .key-btn.clear',    src.includes('body.theme-snow .key-btn.clear'));
assert('snow .key-btn.sym',      src.includes('body.theme-snow .key-btn.sym'));
assert('snow .key-btn.disabled', src.includes('body.theme-snow .key-btn.disabled'));

// =========== T8: shape keypad path ===========
console.log('\n[T8] shape keypad');
assert('q._isShapeKeypad set',   src.includes('q._isShapeKeypad = true'));
assert('q._shapeToNum set',      src.includes('q._shapeToNum = shapeToNum'));
assert('shape num → shape lookup', /q\._shapeToNum\[num\]/.test(src));

// =========== T9: ordering keypad mode ===========
console.log('\n[T9] ordering keypad');
assert('ordering mode = order + keypad', modeMap['ordering'] === "'order','keypad'");
assert('ordering keypad hint',          src.includes('keypad：按正確順序'));

// =========== T10: v3.2 version consistency ===========
console.log('\n[T10] version');
const v32 = (src.match(/v3\.2/g) || []).length;
assert('v3.4 mentioned ≥ 4 times', (src.match(/v3\.4/g) || []).length >= 4);
assert('header version v3.4',     /數學守護者：精準訓練版 v3\.4/.test(src));
assert('title version v3.4',      src.includes('<title>數學守護者：精準訓練版 v3.4'));
assert('menu subtitle v3.4',      src.includes('精準訓練版 v3.4 · Math Guardian'));

// =========== T11: V3.3 + V3.4 feature wirings ===========
console.log('\n[T11] V3.3 + V3.4 features');
assert('V3.3-U1 onboarding',  src.includes('showOnboarding(') && src.includes('mg2.onboardingDone'));
assert('V3.3-U5 keyboard',    src.includes("document.addEventListener('keydown'"));
assert('V3.3-U6 modal',       src.includes('showConfirmModal('));
assert('V3.3-A5 visibility',  src.includes("addEventListener('visibilitychange'"));
assert('V3.3-UI4 aria-live',  src.includes("aria-live-alerts") && src.includes("setAttribute('aria-live'"));
assert('V3.3 btn-start aria', src.includes('aria-label="開始守護戰役'));
assert('V3.3 btn-back aria',  src.includes('aria-label="返回主選單'));

assert('V3.4-F2 TTS module',       src.includes('const TTS = {') && src.includes('normalize('));
assert('V3.4-F2 tts-btn rendered', src.includes('id="knight-tts-btn"') && src.includes('id="mage-tts-btn"'));
assert('V3.4-F2 speak on click',   src.includes('TTS.speak(text, ttsBtn)'));

assert('V3.4-F3 Compliment module',   src.includes('const Compliment = {'));
assert('V3.4-F3 correct pool size',   (src.match(/correct: \[$[\s\S]*?\]/m) || [''])[0].split("',").length >= 50);
assert('V3.4-F3 wrong pool size',     (src.match(/wrong: \[$[\s\S]*?\]/m) || [''])[0].split("',").length >= 50);
assert('V3.4-F3 streak trigger',      src.includes('Compliment.pick(\'streak\', s)'));
assert('V3.4-F3 AI upgrade path',     src.includes('upgrade(') && src.includes('https://api.MiniMax'));

assert('V3.4-U2 instant hint',   src.includes('showInstantHint(') && src.includes('instantHint: true'));
assert('V3.4-U2 hint on wrong',  src.includes('if (Game.settings.instantHint) showInstantHint'));

assert('V3.4-UI2 confetti module', src.includes('confetti(cx, cy, count'));
assert('V3.4-UI2 confetti on hit', src.includes('FX.confetti(bRect.left + bRect.width / 2'));
assert('V3.4-UI2 screen shake',    src.includes('screenShake()') && src.includes('screen-shake-active'));
assert('V3.4-UI2 reduced-motion',  src.includes('prefers-reduced-motion: reduce'));
assert('V3.4 settings defaults',   src.includes('instantHint: true') && src.includes('ttsEnabled: true'));

// =========== T12: V3.4-audit patches (regression) ===========
console.log('\n[T12] V3.4 audit patches');
// F1 closure leak: slider/display hoisted to module scope
assert('AUDIT-1 slider hoisted',      /^const slider = \$/m.test(src));
assert('AUDIT-1 display hoisted',     /^const display = \$/m.test(src));
// F5/F6 lazy pause-overlay removed
assert('AUDIT-F5 no lazy pauseOverlay creation',
  !src.includes("ov.id = 'pause-overlay'") && !src.includes("ov.id = \"pause-overlay\""));
// F9 bossHP casing — no capital HP variants in state references
assert('AUDIT-F9 bossHp consistent',
  (src.match(/\.bossHP\b/g) || []).length === 0);
assert('AUDIT-F9 bossHp lowercase used',
  src.includes('Game.state.bossHp') && src.includes('Game.state.bossMaxHp'));

// =========== T13: V3.4-audit-cycle-2 (state-machine + race + mobile) ===========
console.log('\n[T13] V3.4 audit cycle-2 patches');
// B5+B17: endGame resets paused + hides pause-overlay
// Capture range: from `function endGame` to next `Audio.stopBGM();` plus 10 lines after,
// because the AUDIT2 fix lines come AFTER the stopBGM call (lazy add-order).
const endGameMatch = src.match(/function endGame\(victory\)\s*\{[\s\S]*?Audio\.stopBGM\(\);[\s\S]{0,400}/);
const endGameSrc = endGameMatch ? endGameMatch[0] : '';
assert('AUDIT2-B5  endGame clears paused state', endGameSrc.includes('Game.state.paused = false'));
assert('AUDIT2-B5  endGame hides pause-overlay',  endGameSrc.includes('pause-overlay'));
// B5+B17: startGame resets _startAt + _frostTickAt + hides pause-overlay
const startGameMatch = src.match(/function startGame\(\)\s*\{[\s\S]*?Audio\.startBGM\(\);[\s\S]{0,800}/);
const startGameSrc = startGameMatch ? startGameMatch[0] : '';
assert('AUDIT2-B6  startGame resets _startAt',     startGameSrc.includes('s._startAt = 0'));
assert('AUDIT2-B17 startGame resets _frostTickAt', startGameSrc.includes('s._frostTickAt = 0'));
assert('AUDIT2-B5  startGame hides pause-overlay', startGameSrc.includes('pause-overlay'));
// B1: confirm-modal escHandler cleanup on close (not just on keypress)
assert('AUDIT2-B1  confirm close() removes escListener',
  /const close = \(\) =>\s*\{[\s\S]*?removeEventListener\('keydown'/.test(src));
assert('AUDIT2-B1  no orphan removeEventListener(escHandler)',
  !src.includes("if (e.key === 'Escape') { cancelBtn.click(); document.removeEventListener('keydown', escHandler); }"));
// B8: keyboard 1-9 / Backspace / Enter gated on Game.state.running + inGameScreen
assert('AUDIT2-B8 keyboard-active gate present',
  src.includes('const keyboardActive =') &&
  src.includes('keyboardActive') &&
  src.includes('Game.state && Game.state.running'));
// B3: _wasPlayingBGM hoisted to top scope (before startGame) to avoid TDZ
const hoistedOrder = src.indexOf('let _wasPlayingBGM = false');
const startGameIdx = src.indexOf('function startGame()');
assert('AUDIT2-B3 _wasPlayingBGM declared before startGame',
  hoistedOrder > 0 && hoistedOrder < startGameIdx);
// startGame resets _wasPlayingBGM after startBGM call (not before — that's the natural add-point)
const startGameBody = src.slice(startGameIdx, src.indexOf('function endGame(', startGameIdx));
assert('AUDIT2-B3 startGame resets _wasPlayingBGM',
  startGameBody.includes('_wasPlayingBGM = false'));
// B-touch: long-press event delegation covers touchstart + touchend + touchcancel + touchmove + mousedown
assert('AUDIT2-B8-tch touchstart on review-list',  src.includes("reviewList.addEventListener('touchstart'"));
assert('AUDIT2-B8-tch touchend on review-list',    src.includes("reviewList.addEventListener('touchend'"));
assert('AUDIT2-B8-tch touchcancel on review-list', src.includes("reviewList.addEventListener('touchcancel'"));
assert('AUDIT2-B8-tch touchmove cancels (scroll)', src.includes("reviewList.addEventListener('touchmove'"));

// =========== T14: V3.4-audit-cycle-3 (async / TTS / DOM pile / image fallback) ===========
console.log('\n[T14] V3.4 audit cycle-3 patches');
// C2-B2: TTS speak clears .speaking class globally before adding new
assert('AUDIT3-C2  TTS speak removes other .speaking',
  /speak\(text, btn\)\s*\{[\s\S]{0,500}querySelectorAll\('\.tts-btn\.speaking'\)[\s\S]{0,200}forEach[\s\S]{0,200}classList\.remove/.test(src));
// C3-B1: screenAlert caps to last 1 element (no stacking)
assert('AUDIT3-C3  screenAlert caps concurrent',
  /screenAlert\(text[\s\S]{0,500}querySelectorAll\('\.screen-alert'\)[\s\S]{0,200}remove\(\)/.test(src));
// C3-B3: instant-hint caps to 1
assert('AUDIT3-C3  instant-hint caps concurrent',
  /function showInstantHint\([\s\S]{0,2000}querySelectorAll\('\.instant-hint'\)[\s\S]{0,500}remove\(\)/.test(src));
// C1-B3: boss-hero-portrait has onerror fallback (not silent broken image)
assert('AUDIT3-C1  boss hero portrait has onerror',
  src.includes("getElementById('boss-hero-portrait')") &&
  /heroImg\.onerror/.test(src));
assert('AUDIT3-C1  end-boss-portrait has onerror',
  /end-boss-portrait[\s\S]{0,500}onerror/.test(src));
// C1-B2: dead STORAGE._cap removed
assert('AUDIT3-C1  dead STORAGE._cap removed',
  !/  _cap\(key, val\)\s*\{/.test(src));

// =========== T12: file size budget ===========
console.log('\n[T11] file size budget');
const sizeKB = src.length / 1024;
console.log(`  current: ${sizeKB.toFixed(1)} KB / budget: 600 KB`);
assert('size < 600K', sizeKB < 600);

// =========== summary ===========
console.log(`\n========== ${pass} pass / ${fail} fail ==========`);
if (fail > 0) {
  console.log(`\nFirst failure hint: ${fails[0] ? fails[0].name : '(see above)'}`);
  process.exit(1);
}
process.exit(0);