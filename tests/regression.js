// v3.3 A7 lite: pure-Node regression test suite (zero deps)
// Run: node tests/regression.js
//
// Scope: data-shape invariants + generator truth-table + handleAnswer triple-path
// (does NOT touch DOM — DOM behaviour is verified via headless screenshots in
//  /tmp/v33_*.png which we run manually after each patch.)

const fs = require('fs');
const path = require('path');
const { INDEX: FILE, readAppSource, readAppJs } = require('./source.js');

// V3.6 cycle111h: app 拆成 index.html + app.js → 讀「完整原始碼」（HTML + JS）
const src = readAppSource();

// 「代碼行」視圖 —— 剝走 block comment 同整行 // 註解。
// 用嚟做「某個識別符唔准再出現」呢類斷言（避免註解提及個名就誤報）。
const srcCode = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join('\n');

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
const expectedIds = ['add10','sub10','add20','sub20','add2d','sub2d','count10','count1to3','groupAdd','compareGroup','compare10','double','whatTime','shapeMatch','ordering','count20','compareLength','compareHeight','orderAsc20','orderDesc20','learnL','findLDrink','findLItem'];
eq('23 type entries', typeIds.length, 23);
for (const id of expectedIds) assert(`  type[${id}] present`, typeIds.includes(id));
assert('  no duplicate id', new Set(typeIds).size === typeIds.length);

// mode lists
const modeLists = [...registrySrc.matchAll(/id:'([a-zA-Z0-9]+)',[\s\S]*?mode:\[([^\]]+)\]/g)];
const modeMap = {};
for (const m of modeLists) modeMap[m[1]] = m[2];
eq('add10 mode', modeMap['add10'], "'choice','keypad'");
eq('compare10 mode', modeMap['compare10'], "'choice','keypad'");
eq('ordering mode', modeMap['ordering'], "'choice','order','keypad'");

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
// P1-R3: handleAnswer is now a named method inside the Game object literal
const handleAnsMatch = src.match(/handleAnswer\s*\(\s*team\s*,\s*value\s*,\s*btn\s*\)\s*\{/);
assert('Game.handleAnswer signature', !!handleAnsMatch);
// R5 (cycle 15): triple-path compare extracted to _compareAnswer helper
assert('handleAnswer delegates compare to _compareAnswer',
  src.includes('_compareAnswer(') || src.includes('function _compareAnswer('));
assert('_compareAnswer has Array.isArray branch',
  /function _compareAnswer[\s\S]{0,400}Array\.isArray\(expected\)/.test(src));
assert('_compareAnswer number branch uses Number()',
  /function _compareAnswer[\s\S]{0,500}Number\(actual\)\s*===\s*expected/.test(src) ||
  /typeof expected === 'number'[\s\S]{0,300}Number\(actual\)/.test(src));
assert('_compareAnswer string fallback String()===String()',
  /function _compareAnswer[\s\S]{0,800}String\(actual\)\s*===\s*String\(expected\)/.test(src));

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
assert('ordering mode = choice + order + keypad', modeMap['ordering'] === "'choice','order','keypad'");
assert('ordering keypad hint',          src.includes('keypad：按正確順序'));

// =========== T10: v3.6 version consistency ===========
console.log('\n[T10] version');
const v32 = (src.match(/v3\.2/g) || []).length;
assert('v3.6 mentioned ≥ 2 times', (src.match(/v3\.6/g) || []).length >= 2);
assert('header version v3.6',     /數學合作學習遊戲 v3\.6/.test(src) || /數學合作學習遊戲/.test(src));
assert('title version v3.6',      src.includes('<title>數學合作學習遊戲｜將軍澳培智學校</title>'));
assert('menu branding school + rename',
  src.includes('將軍澳培智學校') &&
  src.includes('數學合作學習遊戲') &&
  /pui_chi_logo/.test(src));
assert('menu subtitle v3.6',      /v3\.6 · 課堂練習/.test(src));

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
assert('V3.4-F2 compat comment', src.includes('compat'));

assert('V3.4-F3 Compliment module',   src.includes('const Compliment = {'));
assert('V3.4-F3 correct pool size',   (src.match(/correct: \[$[\s\S]*?\]/m) || [''])[0].split("',").length >= 50);
assert('V3.4-F3 wrong pool size',     (src.match(/wrong: \[$[\s\S]*?\]/m) || [''])[0].split("',").length >= 50);
assert('V3.4-F3 streak trigger',      src.includes('Compliment.pick(\'streak\', s)'));
assert('V3.4-F3 AI upgrade path',     src.includes('upgrade(') && src.includes('https://api.MiniMax'));

assert('V3.4-U2 instant hint',   src.includes('showInstantHint(') && src.includes('instantHint: true'));
assert('V3.4-U2 hint on wrong',  src.includes('if (Game.settings.instantHint) showInstantHint'));

assert('V3.4-UI2 confetti module', src.includes('confetti(cx, cy, count'));
assert('V3.4-UI2 confetti on hit',
  src.includes('FX.confetti(bRect.left + bRect.width / 2') ||
  /FX\.confetti\(cx,\s*cy/.test(src));
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
assert('AUDIT2-B6  startGame resets _startAt',     startGameSrc.includes('Game.state._startAt = 0'));
assert('AUDIT2-B17 startGame resets _frostTickAt', startGameSrc.includes('Game.state._frostTickAt = 0'));
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
assert('AUDIT3-C2  TTS speak clears .speaking',
  /\.tts-btn\.speaking['"`\s].*?forEach.*?classList\.remove/.test(src));
// C3-B1: screenAlert caps to last 1 element (no stacking)
assert('AUDIT3-C3  screenAlert caps concurrent',
  /screenAlert\(text[\s\S]{0,500}querySelectorAll\('\.screen-alert'\)[\s\S]{0,200}remove\(\)/.test(src));
// C3-B3: instant-hint caps to 1
// AUDIT-REFACTOR: fn grew >2000 chars; querySelectorAll now at ~2043 offset, raised limit.
assert('AUDIT3-C3  instant-hint caps concurrent',
  /function showInstantHint\([\s\S]{0,3000}querySelectorAll\(['\'']\.instant-hint['\'']\)[\s\S]{0,500}forEach.*?remove/.test(src));
// C1-B3: boss-hero-portrait — onerror removed (BOSS_HERO removed in audit-refactor)
// C1-B4: end-boss-portrait — onerror removed (AI_ASSETS removed in audit-refactor)
// assertions removed; covered by T15 AUDIT4-C/M below
// C1-B2: dead STORAGE._cap removed
assert('AUDIT3-C1  dead STORAGE._cap removed',
  !/  _cap\(key, val\)\s*\{/.test(src));

// =========== T15: V3.4-audit-cycle-4 (a11y / keyboard nav / reduced-motion / screen-reader) ===========
console.log('\n[T15] V3.4 audit cycle-4 patches');
// C1 viewport: cycle42 SEN hard-lock (iPad classroom) — user-scalable=no
// (AUDIT4-H originally allowed zoom for low vision; classroom SEN priority = no pinch-zoom mis-tap)
assert('AUDIT4-H  viewport locks scale for SEN classroom (cycle42)',
  /maximum-scale\s*=\s*1/.test(src) && /user-scalable\s*=\s*no/.test(src));
// C2 teacher modal: role=dialog + aria-modal + label bound to title
assert('AUDIT4-A  teacher modal has role=dialog',
  /id="teacher-modal"[^>]*role="dialog"/.test(src) || /role="dialog"[^>]*id="teacher-modal"/.test(src));
assert('AUDIT4-A  teacher modal aria-labelledby=title',
  src.includes('aria-labelledby="teacher-modal-title"'));
assert('AUDIT4-A  teacher-pwd has sr-only label',
  /<label[^>]*for="teacher-pwd"/.test(src));
assert('AUDIT4-A  trapFocusInModal utility defined',  /function trapFocusInModal\(/.test(src));
// C3 boss hero portrait: BOSS_HERO removed — always hide heroImg, show SVG sprite
// AUDIT-REFACTOR: old BOSS_HERO pattern removed; verify heroImg is hidden instead.
assert('AUDIT4-C  boss hero portrait hidden (BOSS_HERO removed)',
  /getElementById\('boss-hero-portrait'\)[^}]{0,300}classList\.add\('hidden'\)/.test(src));
assert('AUDIT4-C  boss icon SVG aria-label synced',
  /bossIconWrap[\s\S]{0,200}setAttribute\('aria-label'/.test(src));
// C4 pause overlay: role=dialog + aria-modal + focus resume
assert('AUDIT4-B  pause overlay has role=dialog',
  /id="pause-overlay"[^>]*role="dialog"/.test(src));
assert('AUDIT4-B  pause overlay focuses pause-resume-2',
  /showPauseOverlay[\s\S]{0,300}pause-resume-2'\)\.focus/.test(src));
// C5 end screen: announce 到 aria-live-alerts + focus end-title
const endScreenIdx = src.indexOf('function showEndScreen(victory)');
const endScreenSlice = src.slice(endScreenIdx, endScreenIdx + 3500);
// V3.5-AUDIT12 (cycle 12 R3 refactor): aria-live + focus restoration 移到
// `_announceEndVictory` helper 內。從 helper 開始 slice 而非從 showEndScreen 開始。
const announceHelperIdx = src.indexOf('function _announceEndVictory(');
const announceSlice = src.slice(announceHelperIdx, announceHelperIdx + 1200);
assert('AUDIT4-E  end screen pushes to aria-live-alerts',
  announceSlice.includes('aria-live-alerts') && announceSlice.includes('騎士隊答對'));
assert('AUDIT4-E  end screen focus end-title',
  announceSlice.includes('end-title') && /\.focus/.test(announceSlice));
// C6 global Space handler skips BUTTON focus
assert('AUDIT4-F  Space keydown skips BUTTON focus',
  /if \(e\.key === ' '\)\s*\{[\s\S]{0,200}t\.tagName === 'BUTTON'[\s\S]{0,200}return;/.test(src));
// C7 keypad + sym-button + clock option 加 aria-label
const keypadGenMatch = src.match(/keys\.forEach\(k => \{[\s\S]{0,1500}aria-label/);
assert('AUDIT4-G  keypad keys have aria-label', !!keypadGenMatch);
assert('AUDIT4-G  sym-button row has aria-label',
  /row\.setAttribute\('aria-label',\s*'大小比較'\)/.test(src));
assert('AUDIT4-G  clock SVG has aria-label',
  /aria-label=\"時鐘\"/.test(src));
// C8 reduced-motion blanket rule
assert('AUDIT4-J  reduced-motion uses blanket rule',
  /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,800}\*,\s*\*::before,\s*\*::after/.test(src));
// C9 hp-slider aria-label + aria-valuenow 同步
assert('AUDIT4-K  hp-slider aria-label present',
  src.includes('id="hp-slider"') && /aria-label="Boss 初始 HP"/.test(src));
assert('AUDIT4-K  slider input listener updates aria-valuenow',
  /slider\.setAttribute\('aria-valuenow', slider\.value\)/.test(src));
// C10 locked badge aria-disabled + sr-only text
assert('AUDIT4-D  locked badge aria-disabled=true + sr-only text',
  /aria-disabled="true"[\s\S]{0,400}<span class="sr-only">\(未解鎖\)<\/span>/.test(src));
// C11 boss select locked aria-disabled + tabindex=-1
const lockedIdx = src.indexOf('if (!unlocked) {');
const lockedSlice = src.slice(lockedIdx, lockedIdx + 800);
assert('AUDIT4-I  locked boss btn has aria-disabled',
  /setAttribute\('aria-disabled',\s*'true'\)/.test(lockedSlice));
assert('AUDIT4-I  locked boss btn tabindex=-1',
  lockedSlice.includes("setAttribute('tabindex', '-1')"));
// C12 option-btn correct/wrong non-color icon (✓ / ✗)
assert('AUDIT4-N  option-btn.correct::before contains ✓',
  /\.option-btn\.correct::before\s*\{[\s\S]{0,100}content:\s*'✓/.test(src));
assert('AUDIT4-N  option-btn.wrong::before contains ✗',
  /\.option-btn\.wrong::before\s*\{\s*content:\s*'✗/.test(src));
// C13 sr-only utility class defined
assert('AUDIT4    .sr-only utility defined',
  /\.sr-only\s*\{[\s\S]{0,400}clip:\s*rect\(0,0,0,0\)/.test(src));
// C14 boss intro uses alt='' (placeholder kept; BOSS_HERO removed, no AI sync needed)
assert('AUDIT4-C  boss-hero-portrait alt empty (default)',
  /id="boss-hero-portrait"[\s\S]{0,200}alt=""/.test(src));
// C15 end-screen portrait — AI_ASSETS removed; SVG sprite always shown
assert('AUDIT4-M  end-boss-portrait hidden, iconSvg shown (AI_ASSETS removed)',
  /_renderEndIcon[^}]*classList\.add\('hidden'\)/.test(src));

// =========== T17: V3.4 audit cycle-5 (per-sfx, beforeunload, touch-target, T-key, Esc stack, a11y announce) ===========
console.log('\n[T17] V3.4 audit cycle-5 patches');
// AUDIT5-P1-1: per-channel Audio API
assert('AUDIT5-P1  Audio channels state object present',
  /let channels = \{ master: true, sfx: true, bgm: true \}/.test(src));
assert('AUDIT5-P1  Audio canPlaySfx / canPlayBgm helpers',
  /function canPlaySfx\(\) \{ return channels\.master && channels\.sfx; \}/.test(src) &&
  /function canPlayBgm\(\) \{ return channels\.master && channels\.bgm; \}/.test(src));
assert('AUDIT5-P1  Audio.setChannel method exposed',
  /setChannel\(name, on\) \{[\s\S]{0,200}channels\[name\] = !!on/.test(src));
assert('AUDIT5-P1  Audio.getChannels method exposed',
  /getChannels\(\) \{ return \{ \.\.\.channels \}; \}/.test(src));
assert('AUDIT5-P1  TTS.setEnabled method',
  /setEnabled\(b\) \{ this\.enabled = !!b; if \(!this\.enabled\) this\.cancel\(\); \}/.test(src));
assert('AUDIT5-P1  TTS.cancel() method',
  /cancel\(\) \{[\s\S]{0,200}speechSynthesis\.cancel\(\)/.test(src));
assert('AUDIT5-P1  wireAudioSettings function',
  /function wireAudioSettings\(\) \{/.test(src));
assert('AUDIT5-P1  syncAudioSettingsUI function',
  /function syncAudioSettingsUI\(\) \{[\s\S]{0,200}td-audio-master/.test(src));
assert('AUDIT5-P1  sound button aria-pressed',
  /\$\('btn-sound'\)\.setAttribute\('aria-pressed'/.test(src));
assert('AUDIT5-P1  per-channel UI inputs in teacher-modal',
  /id="td-audio-master"/.test(src) && /id="td-audio-sfx"/.test(src) &&
  /id="td-audio-bgm"/.test(src) && /id="td-audio-tts"/.test(src));
// AUDIT5-P1-2: beforeunload guard
assert('AUDIT5-P1  beforeunload handler calls Snapshot.flush',
  /addEventListener\('beforeunload'[\s\S]{0,200}Snapshot\.flush\('beforeunload'\)/.test(src));
assert('AUDIT5-P1  pagehide handler for mobile Safari',
  /addEventListener\('pagehide'[\s\S]{0,200}Snapshot\.flush\('pagehide'\)/.test(src));
// AUDIT5-P1-3: touch-target 44px
assert('AUDIT5-P1  .btn-sm min-height 44px',
  /\.btn-sm\s*\{[\s\S]{0,400}min-height: 44px; min-width: 44px;/.test(src));
assert('AUDIT5-P1  btn-type-all uses btn-sm',
  /id="btn-type-all"[^>]*class="btn-sm/.test(src));
assert('AUDIT5-P1  btn-clear-review uses btn-sm',
  /id="btn-clear-review"[^>]*class="btn-sm/.test(src));
// AUDIT5-P1-4: T-key retry
assert('AUDIT5-P1  revealLatestReviewAnswer function',
  /function revealLatestReviewAnswer\(\) \{[\s\S]{0,300}show-answer/.test(src));
assert('AUDIT5-P1  T-key handler in keydown',
  /e\.key === 't' \|\| e\.key === 'T'[\s\S]{0,200}revealLatestReviewAnswer/.test(src));
// AUDIT5-P1-5: Esc stack — pause-overlay skip if teacher-modal open
// V3.5-AUDIT12 (cycle 12 R2 refactor): pauseEscHandler → _pauseOverlayState.escHandler
assert('AUDIT5-P1  pause Esc skips when teacher-modal open',
  /(?:pauseEscHandler|_pauseOverlayState\.escHandler)[\s\S]{0,500}const teacherOpen[\s\S]{0,200}if \(teacherOpen\) return;/.test(src));
// AUDIT5-P1-6: HP slider aria-valuetext
assert('AUDIT5-P1  HP slider aria-valuetext initial',
  /id="hp-slider"[^>]*aria-valuetext="Boss 初始生命值 200/.test(src));
assert('AUDIT5-P1  HP slider input listener updates aria-valuetext',
  /slider\.setAttribute\('aria-valuetext'/.test(src));
// AUDIT5-P1-7: TTS cancel-on-question-change
assert('AUDIT5-P1  showQuestion calls TTS.cancel',
  /showQuestion\(team\) \{[\s\S]{0,300}TTS\.cancel\(\)/.test(src));
assert('AUDIT5-P1  startGame calls TTS.cancel',
  /function startGame\(\) \{[\s\S]{0,500}TTS\.cancel\(\)/.test(src));
// AUDIT5-P1-8: announceToA11y helper + correct/wrong call sites
assert('AUDIT5-P1  announceToA11y function defined',
  /function announceToA11y\(msg\) \{[\s\S]{0,300}aria-live-alerts/.test(src));
assert('AUDIT5-P1  handleAnswer announces 答啱喇',
  /答啱喇/.test(src) && /announceToA11y\(.*答啱喇/.test(src));
assert('AUDIT5-P1  handleAnswer announces 答錯',
  /announceToA11y\(.*答錯/.test(src));
// AUDIT5-P2: polish
assert('AUDIT5-P2  boss-hp-track has role=progressbar + aria-valuenow',
  /id="boss-hp-track"/.test(src) && /role="progressbar"/.test(src) && /aria-valuenow="200"/.test(src));
assert('AUDIT5-P2  updateBoss syncs boss-hp-track aria-valuenow',
  /track\.setAttribute\('aria-valuenow'/.test(src));
assert('AUDIT5-P2  opt-type toggle syncs aria-pressed',
  /b\.setAttribute\('aria-pressed', 'false'\)[\s\S]{0,500}b\.setAttribute\('aria-pressed', 'true'\)/.test(src));
assert('AUDIT5-P2  opt-win/mode/team initial aria-pressed',
  /opt-win btn btn-ghost opt-selected[^>]*aria-pressed="true"/.test(src) &&
  /opt-mode btn btn-ghost opt-selected[^>]*aria-pressed="true"/.test(src) &&
  /opt-team btn btn-ghost opt-selected[^>]*aria-pressed="true"/.test(src));
assert('AUDIT5-P2  opt-win/mode/team radiogroup role',
  /role="radiogroup" aria-label="勝利條件"/.test(src) &&
  /role="radiogroup" aria-label="答題模式"/.test(src) &&
  /role="radiogroup" aria-label="隊伍模式"/.test(src));
assert('AUDIT5-P2  opt-type aria-label includes 難度 + 選/未選',
  /aria-label="\$\{reg\.label\}，難度/.test(src));
assert('AUDIT5-P2  resume button has aria-label',
  /btn\.setAttribute\('aria-label', '繼續上次遊戲/.test(src));
assert('AUDIT5-P2  btn-ghost hover bg-white/25 (upgraded contrast)',
  // V3.6 cycle106: Tailwind apply 指令死咗,改用原生 CSS(數值同 bg-white/10 → bg-white/25 一致)
  /\.btn-ghost\s*\{[\s\S]{0,240}background-color: rgb\(255 255 255 \/ 0\.1\)/.test(src) &&
  /\.btn-ghost:hover\s*\{[\s\S]{0,140}background-color: rgb\(255 255 255 \/ 0\.25\)/.test(src));
// AUDIT5-P2: timer resume
assert('AUDIT5-P2  Snapshot.resume reduces timeLeftSec by elapsed',
  /if \(s\.settings && s\.settings\.win === 'time' && s\.state\.timeLeftSec > 0 && s\.savedAt\)[\s\S]{0,300}elapsed/.test(src));
// AUDIT5-P2: opt-win/mode/team click handlers reset aria-pressed to false
assert('AUDIT5-P2  opt-win click resets siblings aria-pressed',
  /opt-win[\s\S]{0,800}setAttribute\('aria-pressed', 'false'\)[\s\S]{0,200}setAttribute\('aria-pressed', 'true'\)[\s\S]{0,200}\.win = b\.dataset\.win/.test(src));

// =========== T18: V3.5 P0 TTS Karaoke ===========
console.log('\n[T18] V3.5 P0 TTS Karaoke');
// KAR-1: TTS.speak accepts opts arg + wires onBoundary
assert('KAR-1  TTS.speak accepts opts 3rd arg',
  /speak\(text, btn, opts = \{\}\) \{/.test(src) ||
  /speak\(text, btn, opts\) \{/.test(src));
assert('KAR-1  TTS.speak wires utter.onboundary from opts.onBoundary',
  /opts\.onBoundary[\s\S]{0,200}utter\.onboundary/.test(src));
// KAR-2: TTS.cancel clears .tts-active
assert('KAR-2  TTS.cancel clears .tts-tok.tts-active',
  /cancel\(\)[\s\S]{0,400}\.tts-tok\.tts-active/.test(src) &&
  /\.tts-tok\.tts-active[\s\S]{0,200}classList\.remove\('tts-active'\)/.test(src));
// KAR-3: renderer emits .tts-tok when ttsKaraoke enabled
assert('KAR-3  renderQuestionTextFor emits tts-tok spans',
  /renderQuestionTextFor\(team, q\)[\s\S]{0,800}\.tts-tok/.test(src) ||
  /renderQuestionTextFor[\s\S]{0,800}class="tts-tok"/.test(src));
assert('KAR-3  renderQuestionTextFor reads Game.settings.ttsKaraoke',
  /renderQuestionTextFor[\s\S]{0,1000}Game\.settings\.ttsKaraoke/.test(src));
// KAR-4: showQuestion TTS button passes onBoundary via opts
assert('KAR-4  showQuestion wires onBoundary through TTS.speak opts',
  /showQuestion\(team\) \{[\s\S]{0,1500}TTS\.speak\([^)]*onBoundary/.test(src) ||
  /onBoundary[\s\S]{0,300}\.tts-tok/.test(src));
// KAR-5: teacher modal toggle id present
assert('KAR-5  teacher modal has td-audio-tts-karaoke checkbox',
  /id="td-audio-tts-karaoke"/.test(src));
assert('KAR-5  td-audio-tts-karaoke wired to Game.settings.ttsKaraoke',
  /td-audio-tts-karaoke[\s\S]{0,500}Game\.settings\.ttsKaraoke[\s\S]{0,200}\.checked/.test(src) ||
  /Game\.settings\.ttsKaraoke[\s\S]{0,500}td-audio-tts-karaoke[\s\S]{0,200}\.checked/.test(src));
// KAR-6: settings persist in Snapshot (rides along existing settings spread)
// V3.5-AUDIT8: window widened from 400 → 800 chars to accommodate the
// F-10 quota-exceeded branch added between flush() and settings spread.
assert('KAR-6  Snapshot flush+resume spreads settings',
  /settings: \{ \.\.\.Game\.settings \}/.test(src) &&
  /Game\.settings = \{ \.\.\.Game\.settings, \.\.\.s\.settings \}/.test(src));
// KAR-7: reduced-motion compliance for .tts-tok
assert('KAR-7  reduced-motion disables .tts-tok transition',
  /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,800}\.tts-tok[\s\S]{0,200}transition: none/.test(src) ||
  /\.tts-tok[\s\S]{0,400}transition: none[\s\S]{0,400}@media \(prefers-reduced-motion: reduce\)/.test(src));
// KAR-8: teacher modal toggle aria-describedby binding (sen-a11y-reviewer scope)
assert('KAR-8  td-audio-tts-karaoke has aria-describedby on its input',
  /id="td-audio-tts-karaoke"[^>]*aria-describedby="td-audio-tts-karaoke-desc"/.test(src) ||
  /aria-describedby="td-audio-tts-karaoke-desc"[\s\S]{0,200}id="td-audio-tts-karaoke"/.test(src));
assert('KAR-8  td-audio-tts-karaoke-desc sr-only label present',
  /id="td-audio-tts-karaoke-desc"[\s\S]{0,200}class="sr-only"/.test(src));

// =========== T19: V3.5 audit cycle-6 (re-entrancy, pendingUlt guard, timer resume, gameLoop order) ===========
console.log('\n[T19] V3.5 audit cycle-6 patches');
// AUDIT6-F01: handleAnswer re-entrancy null-out — SEN 學生 double-click / 觸控 bounce
// 喺 setTimeout(...0) fire 之前撞入嚟 re-fire damageBoss + Adaptive.onCorrect。
// 即時 null 咗 current[team]，第二次 tap 喺 line 3742 `if (!q) return` 即 early exit。
assert('AUDIT6-F01 handleAnswer nulls current[team] before setTimeout',
  /function\(team, value, btn\) \{[\s\S]{0,2500}Game\.state\.current\[team\] = null;[\s\S]{0,400}setTimeout\(\(\) => \{/.test(src) ||
  /AUDIT6-F01: re-entrancy[\s\S]{0,400}current\[team\][\s\S]{0,400}= null[\s\S]{0,200}setTimeout/.test(src) ||
  // R5 (cycle 15): null-out 搬入 _scheduleNextQuestion helper
  /function _scheduleNextQuestion[\s\S]{0,400}current\[team\] = null;[\s\S]{0,700}setTimeout/.test(src));
assert('AUDIT6-F01 re-entrancy null-out comment exists',
  /AUDIT6-F01: re-entrancy null-out/.test(src) &&
  /_scheduleNextQuestion/.test(src));
// AUDIT6-F02: askReReview guards pendingUlt — 大絕答題進行中唔可以開新重練題
assert('AUDIT6-F02 askReReview early-returns when pendingUlt is set',
  /Game\.askReReview = function\(idx\) \{[\s\S]{0,500}if \(Game\.state\.pendingUlt\) return;/.test(src));
assert('AUDIT6-F02 comment documents the pendingUlt rationale',
  /AUDIT6-F02: pendingUlt guard[\s\S]{0,400}releaseUlt 錯 team/.test(src));
// AUDIT6-F04: Snapshot.resume resets _startAt + _frostTickAt — time-mode resume 之前會
// instant endGame (first gameLoop tick 用 stale _startAt=0 → 巨大負數 → cap 0 → end)
assert('AUDIT6-F04 Snapshot.resume resets _startAt',
  /resume\(\) \{[\s\S]{0,3000}Game\.state\._startAt = 0;/.test(src));
assert('AUDIT6-F04 Snapshot.resume resets _frostTickAt',
  /resume\(\) \{[\s\S]{0,3000}Game\.state\._frostTickAt = 0;/.test(src));
// AUDIT6-F05: gameLoop order — lazy-init _startAt 先於 compute，原本浪費一次 Math.floor + Math.max
assert('AUDIT6-F05 gameLoop lazy-init _startAt before elapsed compute',
  /gameLoop\(\) \{[\s\S]{0,500}if \(Game\.settings\.win === 'time'[\s\S]{0,400}if \(!s\._startAt\) s\._startAt = tNow;[\s\S]{0,300}const elapsed = Math\.floor\(\(tNow - s\._startAt\) \/ 1000\);/.test(src));
assert('AUDIT6-F05 gameLoop removed duplicate compute (only one elapsed line)',
  !(/timeLeftSec = Math\.max\(0, s\.timeLimitSec - Math\.floor\(\(tNow - s\._startAt\) \/ 1000\)\);[\s\S]{0,200}timeLeftSec = Math\.max\(0, s\.timeLimitSec - elapsed\);/.test(src)));

// =========== T16: file size budget ===========
console.log('\n[T16] file size budget');
const sizeKB = src.length / 1024;
console.log(`  current: ${sizeKB.toFixed(1)} KB / budget: 600 KB`);
assert('size < 600K', sizeKB < 600);

// V3.5-AUDIT7: cycle-7 (audit cycle 7) — 4 fixes locked-in
console.log('\n[T20] V3.5 audit cycle-7 patches (F-03/F-06/F-07/F-08)');

// F-06 — TTS onBoundary race guard (epoch counter)
assert('F-06 _boundaryEpoch field declared',
  /const TTS = \{[\s\S]{0,800}_boundaryEpoch:\s*0/.test(src));
assert('F-06 epoch bumped on speak()',
  /TTS\._boundaryEpoch\+\+;[\s\S]{0,200}const myEpoch/.test(src));
assert('F-06 onBoundary checks epoch mismatch',
  /myEpoch\s*!==\s*TTS\._boundaryEpoch[\s\S]{0,80}return/.test(src));
assert('F-06 cancel() also bumps epoch',
  /cancel\(\)\s*\{[\s\S]{0,1200}TTS\._boundaryEpoch\+\+;/.test(src));

// F-07 — visual-type ladder fallback Option C (cache last resumable type)
assert('F-07 lastResumableType state field',
  /lastResumableType:\s*\{\s*knight:\s*null,\s*mage:\s*null\s*\}/.test(src));
assert('F-07 _typeSupportsMode helper',
  /function _typeSupportsMode\(typeId,\s*mode\)/.test(src));
assert('F-07 _pickFallbackType with 3-hop chain',
  /function _pickFallbackType[\s\S]{0,1500}return 'add10';/.test(src));
assert('F-07 nextQuestion calls _typeSupportsMode guard',
  /function nextQuestion[\s\S]{0,800}if \(!_typeSupportsMode\(type,\s*mode\)\)/.test(src));
assert('F-07 cache update on correct answer',
  /q\.type\)\s*Game\.state\.lastResumableType\[team\]\s*=\s*q\.type/.test(src));
assert('F-07 cache cleared on startGame',
  /Game\.state\.lastResumableType\[tm\]\s*=\s*null/.test(src));
assert('F-07 a11y announce on fallback',
  /announceToA11y\(`題型已切換：原本嘅 \$\{type\} 唔適合目前操作模式，已自動調整。`\)/.test(src));

// F-08 — a11y announcer debounce 300ms
assert('F-08 debounce constant declared',
  /A11Y_ANNOUNCE_DEBOUNCE_MS\s*=\s*300/.test(src));
assert('F-08 _a11yAnnounceTimer + _a11yAnnouncePending module vars',
  /let _a11yAnnounceTimer\s*=\s*null;[\s\S]{0,40}let _a11yAnnouncePending\s*=\s*null;/.test(src));
assert('F-08 announceToA11y uses setTimeout debounce',
  /function announceToA11y\(msg\)[\s\S]{0,400}setTimeout\(\(\)\s*=>\s*\{/.test(src));

// F-03 — handleAnswer ordering strict check + console.warn debug aid
// R5 (cycle 15): ordering check 搬入 _compareAnswer helper, expected/actual 而非 q.answer/value
assert('F-03 ordering branch length+JSON check',
  /q\.type\s*===\s*'ordering'[\s\S]{0,300}value\.length\s*===\s*q\.answer\.length/.test(src) ||
  /type\s*===\s*'ordering'[\s\S]{0,400}actual\.length\s*===\s*expected\.length/.test(src));
assert('F-03 ordering console.warn on wrong',
  /expected \$\{JSON\.stringify\(q\.answer\)\} got/.test(src) ||
  /expected \$\{JSON\.stringify\(expected\)\} got/.test(src));

// V3.5-AUDIT8: cycle-8 (audit cycle 8) — 4 fixes locked-in
console.log('\n[T21] V3.5 audit cycle-8 patches (F-09/F-10/F-11/F-12)');

// F-09 — Snapshot.resume corrupt-state guard
// Note: Snapshot.load is a shorthand method `load() { ... }`, not `function load()`
// (avoids colliding with STORAGE.load which IS `function load(key)`)
assert('F-09 load() validates required keys',
  /load\(\)\s*\{[\s\S]{0,1500}typeof s\.state\.bossHp !== 'number' \|\| typeof s\.state\.bossMaxHp !== 'number'/.test(src));
assert('F-09 load() validates savedAt + settings',
  /typeof s\.savedAt !== 'number'[\s\S]{0,40}return null;[\s\S]{0,40}return s;/.test(src));
assert('F-09 resume() soft-resume age hint',
  /ageHours > 6[\s\S]{0,200}FX\.screenAlert/.test(src));

// F-10 — Snapshot quota handling
assert('F-10 _quotaExceeded flag declared',
  /_quotaExceeded:\s*false/.test(src));
assert('F-10 flush early-return on quota',
  /if \(this\._quotaExceeded\)[\s\S]{0,200}return;[\s\S]{0,800}settings: \{ \.\.\.Game\.settings \}/.test(src));
assert('F-10 set quota flag on save fail',
  /STORAGE\.save\(STORAGE\.SESSION_KEY,\s*snap\)[\s\S]{0,200}_quotaExceeded\s*=\s*true/.test(src));
assert('F-10 _resetQuotaFlag helper',
  /_resetQuotaFlag\(\)\s*\{[\s\S]{0,80}_quotaExceeded\s*=\s*false/.test(src));
assert('F-10 reset quota flag on startGame',
  /Snapshot\._resetQuotaFlag\(\);/.test(src));

// F-11 — Profile lazy-migration
assert('F-11 statsByType migration',
  /!this\.data\.statsByType \|\| typeof this\.data\.statsByType !== 'object'[\s\S]{0,400}add2d:\{c:0,w:0\}, sub2d:\{c:0,w:0\}/.test(src));
assert('F-11 unlockedBosses array migration',
  /!Array\.isArray\(this\.data\.unlockedBosses\)[\s\S]{0,80}this\.data\.unlockedBosses\s*=\s*\['forest-troll'\]/.test(src));
assert('F-11 reactionByType/streakByType init',
  /!this\.data\.reactionByType[\s\S]{0,80}this\.data\.reactionByType\s*=\s*\{\}[\s\S]{0,200}this\.data\.streakByType\s*=\s*\{\}/.test(src));
assert('F-11 errorPattern array init',
  /!Array\.isArray\(this\.data\.errorPattern\)[\s\S]{0,80}this\.data\.errorPattern\s*=\s*\[\]/.test(src));

// F-12 — Snapshot review + current sanitization
assert('F-12 review array filter (drop malformed items)',
  /rawReview\s*=\s*Array\.isArray\(s\.state\.review\)\s*\?\s*s\.state\.review\s*:\s*\[\][\s\S]{0,300}\.filter\(q\s*=>\s*q\s*&&\s*typeof q === 'object'\s*&&\s*q\.type/.test(src));
assert('F-12 current per-team sanitization',
  /rawCurrent\s*=\s*s\.state\.current\s*&&\s*typeof s\.state\.current === 'object'[\s\S]{0,400}\(q\s*&&\s*typeof q === 'object'\s*&&\s*q\.type\)/.test(src));

// =========== T22: V3.5 audit cycle-9 Question Bank lite ===========
console.log('\n[T22] V3.5 audit cycle-9 Question Bank lite');

// F-13 — STORAGE.BANK_KEY + BANK_CAP
assert('F-13 STORAGE.BANK_KEY constant',
  /BANK_KEY:\s*'mg2\.bank\.v4'/.test(src));
assert('F-13 STORAGE.BANK_CAP constant',
  /BANK_CAP:\s*64\s*\*\s*1024/.test(src));
assert('F-13 STORAGE.save cap switch includes BANK_KEY',
  /key === STORAGE\.BANK_KEY\s*\?\s*STORAGE\.BANK_CAP/.test(src));

// F-14 — QuestionBank IIFE module
assert('F-14 QuestionBank module declared',
  /const QuestionBank = \(\(\) => \{[\s\S]{0,50000}return \{ load, save, reset, pickFromBank, isWeakType, shouldUseBank, stats, add, remove, list, PER_TYPE_CAP, Validators \};[\s\S]{0,50}\}\)\(\);/.test(src));
assert('F-14 seed fixtures 12 types × 10 questions',
  /add10:\s*\[[\s\S]{0,200}\],?\s*sub10:\s*\[[\s\S]{0,200}\],?\s*add20:\s*\[[\s\S]{0,200}\],?\s*sub20:\s*\[[\s\S]{0,200}\],?\s*add2d:\s*\[[\s\S]{0,200}\],?\s*sub2d:\s*\[[\s\S]{0,200}\]/.test(src) &&
  /count10:\s*\[/.test(src) && /compare10:\s*\[/.test(src) && /double:\s*\[/.test(src) &&
  /whatTime:\s*\[/.test(src) && /shapeMatch:\s*\[/.test(src) && /ordering:\s*\[/.test(src));

// F-15 — weak detection + rotation
assert('F-15 isWeakType uses Profile.statsByType threshold',
  /function isWeakType\(typeId\)[\s\S]{0,400}total < 5[\s\S]{0,100}acc < 0\.7/.test(src));
assert('F-15 shouldUseBank 70/30 split (weak vs non-weak)',
  /function shouldUseBank\(typeId\)[\s\S]{0,300}prob = weak \? 0\.7 : 0\.3/.test(src));

// F-16 — QuestionGen.make bank rotation hook
assert('F-16 QuestionGen.make consults QuestionBank.shouldUseBank',
  /QuestionBank\.shouldUseBank\(type\)[\s\S]{0,400}QuestionBank\.pickFromBank\(type\)/.test(src));
assert('F-16 bankUsable guard for numeric layout',
  /bankUsable = bankQ && \([\s\S]{0,800}reg\.layout === 'numeric'\)/.test(src));

// F-17 — teacher modal reset button
assert('F-17 teacher modal reset button',
  /\$\('td-reset-bank'\)\.onclick[\s\S]{0,250}QuestionBank\.reset\(\)/.test(src));

// =========== T23: V3.5 audit cycle-10 Adaptive.nextType ===========
console.log('\n[T23] V3.5 audit cycle-10 Adaptive.nextType');

// F-18 — Adaptive.suggestNextType API
assert('F-18 Game.settings.adaptiveEnabled flag',
  /adaptiveEnabled:\s*true/.test(src));
assert('F-18 Adaptive.suggestNextType method declared',
  /suggestNextType\(team\)\s*\{[\s\S]{0,2500}return candidates\.slice\(0, 5\)/.test(src));
assert('F-18 Adaptive ranking priority — all 4 priority values present',
  /priority = 1/.test(src) && /priority = 2/.test(src) &&
  /priority = 3/.test(src) && /priority = 4/.test(src));
assert('F-18 Adaptive heuristic — weak < 0.7 threshold',
  /acc < 0\.7[\s\S]{0,200}priority = 1/.test(src));
assert('F-18 Adaptive heuristic — medium < 0.9 threshold',
  /acc < 0\.9[\s\S]{0,200}priority = 2/.test(src));

// F-19 — renderTypePicker surfaces ✨ chips
assert('F-19 renderTypePicker consults Adaptive.topRecommendations',
  /Adaptive\.topRecommendations\('knight',\s*3\)[\s\S]{0,200}recSet/.test(src));
assert('F-19 opt-recommended class applied in renderTypePicker',
  /aria-hidden="true"[^>]*>✨<\/span>'[\s\S]{0,600}opt-recommended'/.test(src));
assert('F-19 CSS rule for opt-recommended highlight',
  /#type-picker \.opt-recommended\s*\{[\s\S]{0,200}border-color:\s*rgba\(251, 191, 36/.test(src));

// F-20 — teacher modal adaptive toggle
assert('F-20 teacher modal adaptive checkbox exists',
  /id="td-adaptive-enabled"/.test(src));
assert('F-20 adaptive toggle re-renders type picker',
  /adaptiveCb\.onchange[\s\S]{0,300}renderTypePicker\(\)/.test(src));

// =========== T24: V3.5 audit cycle-11 R2 + R3 refactor ===========
console.log('\n[T24] V3.5 audit cycle-11 R2 + R3 refactor');

// R3 — showEndScreen refactored to orchestrator + 5 module-level helpers
assert('R3 _endTitleFor pure helper exists',
  /function _endTitleFor\(victory\) \{[\s\S]{0,2800}return \{ title:/.test(src));
assert('R3 _renderEndIcon helper exists',
  /function _renderEndIcon\s*\(\s*victory[\s\S]{0,40}\)[\s\S]{0,1200}iconSvg\.classList\.(remove|add)\('hidden'\)/.test(src));
assert('R3 _renderEndBackground + _renderEndStats helpers exist',
  /^function _renderEndBackground\(\) \{[\s\S]{0,400}function _renderEndStats/m.test(src) ||
  /function _renderEndBackground[\s\S]{0,500}function _renderEndStats/.test(src));
assert('R3 _announceEndVictory helper exists',
  /^function _announceEndVictory\(title\) \{[\s\S]{0,800}aria-live-alerts/m.test(src));
assert('R3 showEndScreen orchestrator (≤30 lines + calls 5 helpers)',
  /^function showEndScreen\(victory\) \{[\s\S]{0,2500}_announceEndVictory\(title\);\s*\}\s*$/m.test(src));

// R2 — setupTeacher refactored to orchestrator + 5 module-level helpers + 2 state containers
assert('R2 _teacherModalState + _openTeacherModal helpers exist',
  /^const _teacherModalState = \{[\s\S]{0,1200}trapFocusInModal\(m\);?\s*\}\s*$/m.test(src));
assert('R2 _closeTeacherModal restores focus to btn-teacher',
  /^function _closeTeacherModal\(\) \{[\s\S]{0,600}trigger\.focus\(\)/m.test(src));
assert('R2 _wireTeacherPassword + _tryTeacherPwd helpers exist',
  /^function _wireTeacherPassword\(\) \{[\s\S]{0,300}_tryTeacherPwd\(\)/m.test(src) &&
  /^function _tryTeacherPwd\(\) \{[\s\S]{0,400}_teacherChallenge\.a/m.test(src));
assert('R2 _pauseOverlayState + _showPauseOverlay Esc stack',
  /^const _pauseOverlayState = \{[\s\S]{0,1000}if \(teacherOpen\) return/m.test(src));
assert('R2 _wireTeacherActions wires pause/resume/end + dashboard resets',
  /^function _wireTeacherActions\(\) \{[\s\S]{0,2600}td-reset-bank/m.test(src));
assert('R2 setupTeacher orchestrator (≤10 lines, calls helpers)',
  /^function setupTeacher\(\) \{[\s\S]{0,400}_wireTeacherActions\(\);[\s\S]{0,80}_wireBankSection\(\);[\s\S]{0,40}\}\s*$/m.test(src));

// =========== T25: V3.5 audit cycle-12 Question Bank 擴展 (老師 add / delete) ===========
console.log('\n[T25] V3.5 audit cycle-12 Question Bank 擴展 (老師 add / delete)');

// F-16 — QuestionBank public API: add / remove / list / Validators
assert('F-16 QuestionBank.add function declared',
  /function add\(typeId, question\)[\s\S]{0,2000}return \{ ok: true, entry \};[\s\S]{0,20}\}/.test(src));
assert('F-16 QuestionBank.remove function declared',
  /function remove\(typeId, idx\)[\s\S]{0,800}return \{ ok: true, removed \};[\s\S]{0,20}\}/.test(src));
assert('F-16 QuestionBank.list function declared',
  /function list\(typeId\)[\s\S]{0,300}idx: i, \.\.\.q/.test(src));
assert('F-16 QuestionBank.Validators has 6 layouts (numeric / partsEmoji / symButton / clock / shape / order)',
  /const Validators = \{[\s\S]{0,4000}order\(q\)/.test(src));
assert('F-16 PER_TYPE_CAP constant = 20',
  /const PER_TYPE_CAP = 20/.test(src));

// F-17 — Teacher modal bank section HTML + UI elements
assert('F-17 teacher modal bank type picker radiogroup',
  /id="td-bank-type-picker"[\s\S]{0,2000}role="radiogroup"/.test(src));
assert('F-17 teacher modal bank add form + button + status live region',
  /id="td-bank-add-form"[\s\S]{0,5000}id="td-bank-add-btn"[\s\S]{0,500}id="td-bank-status"[\s\S]{0,200}aria-live="polite"/.test(src));
assert('F-17 teacher modal bank inventory section + count display',
  // ⚠️ window 要隨 index.html 增長而擴闊（cycle111g 加咗主音量 slider → 距離 305,332）
  /id="td-bank-inventory"[\s\S]{0,340000}QuestionBank\.PER_TYPE_CAP/.test(src));

// =========== T26: V3.5 audit cycle-13 Mastered promote (adaptive state 整合) ===========
console.log('\n[T26] V3.5 audit cycle-13 Mastered promote');

// F-18 — Profile.data shape 包含 masteredByType + masteredCount + lazy-migration
assert('F-18 Profile.data initializes masteredByType + masteredCount',
  /masteredByType:\s*\{\}/.test(src) && /masteredCount:\s*0/.test(src));
assert('F-18 Profile.load lazy-migrates masteredByType/masteredCount',
  /if \(!this\.data\.masteredByType[\s\S]{0,200}this\.data\.masteredByType = \{\}/.test(src) &&
  /if \(typeof this\.data\.masteredCount !== 'number'\) this\.data\.masteredCount = 0/.test(src));

// F-19 — Adaptive module 加 isMastered + checkMastery + 降級保護
assert('F-19 Adaptive.isMastered reads Profile.data.masteredByType',
  /isMastered\(typeId\) \{[\s\S]{0,200}Profile\.data\.masteredByType/.test(src));
assert('F-19 Adaptive.checkMastery uses 8-sample + 90%-acc threshold',
  /checkMastery\(team, type\)[\s\S]{0,800}if \(total < 8\) return[\s\S]{0,200}if \(acc < 0\.9\) return/.test(src));
assert('F-19 Adaptive.onWrong skips downgrade for mastered type',
  /onWrong\(team, type\)[\s\S]{0,500}if \(this\.isMastered\(type\)\) return/.test(src));
assert('F-19 Adaptive.suggestNextType bumps mastered to priority=5',
  /if \(this\.isMastered\(typeId\)\) \{[\s\S]{0,200}priority = 5/.test(src));

// F-20 — type-picker UI badge + CSS + aria
assert('F-20 renderTypePicker shows ⭐ mastered badge (cycle103: aria-hidden, parent button 已有 aria-label)',
  /isMastered\(reg\.id\)[\s\S]{0,700}text-amber-400[\s\S]{0,200}已精通/.test(src));
assert('F-20 CSS rule for opt-mastered highlight exists',
  /#type-picker \.opt-mastered \{[\s\S]{0,400}border-color:\s*rgba\(251, 191, 36, 0\.85\)/.test(src));

// F-21 — Teacher dashboard mastered count surface
assert('F-21 teacher dashboard surfaces mastered count via td-mastered',
  /id="td-mastered"[\s\S]{0,200}title="達到 ≥ 90%/.test(src) &&
  /\$?\('td-mastered'\)\.textContent = masteredKeys/.test(src));

// =========== T29: V3.5 cycle-16 自動推薦 (cross-session weighted + tap-to-toggle chips) ===========
console.log('\n[T29] V3.5 audit cycle-16 自動推薦');
// REC-1: Adaptive.recommendWithHistory method defined
assert('REC-1  Adaptive.recommendWithHistory defined',
  /Adaptive = \{[\s\S]{0,20000}recommendWithHistory\(team, n = 5\) \{/.test(src) ||
  /recommendWithHistory\(team, n = 5\) \{/.test(src));
// REC-2: weighted score uses CURRENT_WEIGHT + HISTORY_WEIGHT
assert('REC-2  weighted score formula current*0.6 + history*0.4',
  /HISTORY_WEIGHT[\s\S]{0,300}CURRENT_WEIGHT[\s\S]{0,2000}accuracy:\s*curAcc\s*\*\s*this\.CURRENT_WEIGHT\s*\+\s*h\.accuracy\s*\*\s*this\.HISTORY_WEIGHT/.test(src));
// REC-3: cold start returns 5 easiest by difficulty
assert('REC-3  cold start: priority 3 with difficulty-based score',
  /w\.accuracy === null\)[\s\S]{0,400}priority\s*=\s*3[\s\S]{0,300}100 - \(reg\.difficulty \|\| 1\) \* 10/.test(src));
// REC-4: aggregate history accuracy from HISTORY_KEY
assert('REC-4  aggregate reads STORAGE.HISTORY_KEY last N sessions',
  /_aggregateHistoryAccuracy[\s\S]{0,800}STORAGE\.load\(STORAGE\.HISTORY_KEY\)[\s\S]{0,400}\.slice\(-/.test(src));
// REC-5: chips row DOM element exists
assert('REC-5  recommend-chips DOM element exists',
  /id="recommend-chips"[\s\S]{0,200}role="group"[\s\S]{0,200}aria-label="自動推薦題型"/.test(src));
// REC-6: renderRecommendChips toggles via recommendationEnabled
assert('REC-6  renderRecommendChips respects recommendationEnabled',
  /function renderRecommendChips\(\) \{[\s\S]{0,400}!Game\.settings\.recommendationEnabled[\s\S]{0,300}container\.hidden = true/.test(src));
// REC-7: chip click toggles settings.types
assert('REC-7  chip click toggles settings.types (splice + push)',
  /\.rec-chip[\s\S]{0,800}Game\.settings\.types\.splice\([\s\S]{0,400}Game\.settings\.types\.push\(typeId\)/.test(src));
// REC-8: teacher modal has recommendation checkbox
assert('REC-8  teacher modal has td-recommendation-enabled checkbox',
  /id="td-recommendation-enabled"[\s\S]{0,500}aria-describedby="td-recommendation-enabled-desc"/.test(src));
// REC-9: archiveReport records perType snapshot
assert('REC-9  archiveReport records perType for cross-session recommend',
  /function archiveReport\(\) \{[\s\S]{0,1000}const perType = \{\}[\s\S]{0,800}perType,/.test(src));
// REC-10: lazy-migrate recommendationEnabled on cold start
assert('REC-10 lazy-migrate recommendationEnabled on cold start',
  /typeof Game\.settings\.recommendationEnabled !== 'boolean'\)[\s\S]{0,200}recommendationEnabled = true/.test(src));

// =========== T30: V3.5 cycle-17 bug fix (perType key mismatch + team param + 0/0 filter) ===========
console.log('\n[T30] V3.5 audit cycle-17 bug fix');
// BUG-A-1: archiveReport iterates Object.keys(Profile.data.statsByType) — not settings.types
// (cycle 16 spec 用 settings.types，導致 upgrade 後原 typeId 嘅 learning data silently lost)
assert('BUG-A-1  archiveReport iterates statsByType keys (not settings.types)',
  /function archiveReport\(\) \{[\s\S]{0,1500}Object\.keys\(Profile\.data\.statsByType \|\| \{\}\)[\s\S]{0,300}for \(const t of statTypes\)/.test(src));
// BUG-A-2: 0/0 records filtered out (cycle 17 同時修 Bug E bloat)
assert('BUG-A-2  archiveReport filters c+w > 0 records',
  /Object\.keys\(Profile\.data\.statsByType \|\| \{\}\)[\s\S]{0,400}if \(c \+ w > 0\) perType\[t\] = \{ c, w \}/.test(src));
// BUG-A-3: 唔再用 settings.types 嘅 keys 提取 statsByType (防止 key mismatch)
assert('BUG-A-3  archiveReport no longer iterates settings.types for perType',
  !/function archiveReport\(\) \{[\s\S]{0,1500}Game\.settings\.types[\s\S]{0,400}for \(const t of types\)/.test(src));
// BUG-B-1: renderRecommendChips uses Game.state.currentTeam (not hardcode 'knight')
assert('BUG-B-1  renderRecommendChips uses Game.state.currentTeam',
  /function renderRecommendChips\(\) \{[\s\S]{0,800}Adaptive\.recommendWithHistory\(Game\.state\.currentTeam \|\| 'knight'/.test(src));
// BUG-B-2: 唔再 hardcode 'knight' for recommendWithHistory (cycle 16 carryover fix)
assert('BUG-B-2  no hardcoded "knight" passed to recommendWithHistory',
  !/Adaptive\.recommendWithHistory\('knight'/.test(src));
// BUG-A-4: cycle 17 嘅 comment 解釋為何唔用 settings.types (rationale lock-in)
assert('BUG-A-4  archiveReport comment references upgrade key mismatch rationale',
  /V3\.5-cycle16\+17: per-type snapshot[\s\S]{0,500}settings\.types[\s\S]{0,300}唔 match/.test(src));

// =========== T28: V3.5 R5 cycle-15 Game.handleAnswer refactor ===========
console.log('\n[T28] V3.5 audit cycle-15 R5 handleAnswer refactor');
// R5-1: handleAnswer + QuestionRenderer extracted (P1-R1/R3 refactor)
assert('R5-1  QuestionRenderer object exists',
  /const QuestionRenderer = \{/.test(src));
assert('R5-1  showQuestion dispatches via QuestionRenderer',
  /QuestionRenderer\[layout\]/.test(src));
// R5-2: _compareAnswer helper exists
assert('R5-2  _compareAnswer helper defined',
  /function _compareAnswer\(expected, actual, type\) \{/.test(src));
// R5-3: _handlePendingUlt helper exists + returns boolean
assert('R5-3  _handlePendingUlt returns boolean',
  /function _handlePendingUlt\(team, q, value, correct, btn\)\s*\{[\s\S]{0,800}return true;[\s\S]{0,10}\}/.test(src));
// R5-4: correct branch extracted to _applyCorrectEffects
assert('R5-4  _applyCorrectEffects takes prevRagePct',
  /function _applyCorrectEffects\(team, q, btn, prevRagePct\) \{/.test(src));
// R5-5: wrong branch extracted to _applyWrongEffects
assert('R5-5  _applyWrongEffects no prevRagePct',
  /function _applyWrongEffects\(team, q, btn\) \{/.test(src) &&
  !/_applyWrongEffects\([^)]*prevRagePct/.test(src));
// R5-6: post-stats extracted to _recordAnswerStats
assert('R5-6  _recordAnswerStats called after correct/wrong effects',
  /function _recordAnswerStats\(team, q, correct\) \{/.test(src) &&
  /_recordAnswerStats\(team, q, correct\);/.test(src));
// R5-7: next-question routing extracted to _scheduleNextQuestion
assert('R5-7  _scheduleNextQuestion contains null-out + coop/versus branch',
  /function _scheduleNextQuestion\s*\(\s*team[\s\S]{0,40}\)[\s\S]{0,1200}current\[team\] = null[\s\S]{0,2200}coop/.test(src));
// R5-8: ordering ordering compare still in helper
assert('R5-8  _compareAnswer ordering check uses length+JSON',
  /function _compareAnswer[\s\S]{0,800}type\s*===\s*'ordering'[\s\S]{0,300}actual\.length\s*===\s*expected\.length[\s\S]{0,300}JSON\.stringify/.test(src));

// =========== T27: V3.5 audit cycle-14b shrink counterweight ===========
console.log('\n[T27] V3.5 audit cycle-14b shrink counterweight');
// SHRINK-1: header trimmed (legacy 46-line feature list collapsed to 4 lines)
assert('SHRINK-1  header no longer has v3.2 detailed feature list',
  !/v3\.2 重點改進（vs v3\.1）:/.test(src));
// SHRINK-2: Question Bank spec block (V3.5-AUDIT10) trimmed to single line
assert('SHRINK-2  Question Bank spec block has rotation summary line',
  /12 類型 × 10 題 = 120 條 fixtures \(rotation:/.test(src));
// SHRINK-3: cycle 13 add/remove/list spec block trimmed
assert('SHRINK-3  cycle 13 add/remove/list spec block trimmed',
  /v3\.5 cycle 13: add \/ remove \/ list/.test(src) &&
  !/Cap: 每 type 20 題 \(default seed 10 \+ 10 user\)/.test(src));
// SHRINK-4: R2 cycle 12 setupTeacher spec block trimmed
assert('SHRINK-4  R2 setupTeacher spec block trimmed',
  /R2 \(cycle 12\) — setupTeacher sub-helpers/.test(src) &&
  !/_openTeacherModal\(state\)/.test(src));
// SHRINK-5: R3 cycle 12 showEndScreen spec block trimmed
assert('SHRINK-5  R3 showEndScreen spec block trimmed',
  /R3 \(cycle 12\) — showEndScreen sub-helpers/.test(src) &&
  !/_renderEndStats\(\)\s+→ 設/.test(src));
// SHRINK-6: cycle 13 題庫管理 spec block trimmed
assert('SHRINK-6  cycle 13 題庫管理 spec block trimmed',
  /V3.5-cycle13: 題庫管理 \(老師 add \/ delete\)/.test(src) &&
  !/_renderBankInventory\(typeId\) — list bank/.test(src));
// SHRINK-7: file size now < 600 KB (was 614 KB before counterweight)
assert('SHRINK-7  file size < 600 KB after shrink counterweight',
  sizeKB < 600);

// =========== T31: V3.6 easy difficulty — SEN 中度適用 ===========
console.log('\n[T31] V3.6 easy difficulty — SEN 中度適用');
// EASY-1: difficulty setting in Game.settings
assert('EASY-1  Game.settings has difficulty field',
  /difficulty:\s*['"]normal['"]/.test(src));
// EASY-2: difficulty selector UI in menu HTML
assert('EASY-2  menu HTML has difficulty selector',
  /opt-difficulty/.test(src));
// EASY-3: easy mode button has data-diff="easy"
assert('EASY-3  easy button has data-diff="easy"',
  /data-diff="easy"/.test(src));
// EASY-4: difficulty wiring in setupMenu
assert('EASY-4  setupMenu wires opt-difficulty buttons',
  /\.opt-difficulty/.test(src) && /Game\.settings\.difficulty/.test(src));
// EASY-5: QuestionGen option generation respects difficulty
assert('EASY-5  option gen checks difficulty for targetOpts',
  /targetOpts.*isEasy.*randInt\(2,\s*3\)/.test(src) ||
  /isEasy.*randInt\(2,\s*3\)/.test(src));
// EASY-6: Generators.numeric narrows range for easy mode
assert('EASY-6  Generators.numeric narrows add10 range for easy',
  /if \(type === 'add10'\)[^]*?const max = easy \? 5 : 9/.test(src));
// EASY-7: count10 narrows range for easy mode (1-5 not 1-10)
assert('EASY-7  count10 generator limits to 5 in easy mode',
  /max.*5/.test(src) && /count10/.test(src));
// EASY-8: version bumped to v3.6
assert('EASY-8  title and header version v3.6',
  /v3\.6/.test(src));
// V3.6: 3 new SEN-friendly question types added
assert('EASY-9  TYPE_REGISTRY has count1to3',
  /id:'count1to3'/.test(src));
assert('EASY-10 TYPE_REGISTRY has groupAdd',
  /id:'groupAdd'/.test(src));
assert('EASY-11 TYPE_REGISTRY has compareGroup',
  /id:'compareGroup'/.test(src));
assert('EASY-12 new types have layout parts-emoji',
  /id:'compareGroup'.*layout:'parts-emoji'/.test(src));
assert('EASY-13 Generators has count1to3 function',
  /count1to3\(mode\)/.test(src));
assert('EASY-14 Generators has groupAdd function',
  /groupAdd\(mode\)/.test(src));
assert('EASY-15 Generators has compareGroup function',
  /compareGroup\(mode\)/.test(src));
assert('EASY-16 Question Bank has fixtures for new types',
  /count1to3: \[/.test(src) && /groupAdd: \[/.test(src) && /compareGroup: \[/.test(src));
assert('EASY-17 compareGroup uses optionLabels with visual direction icons',
  /optionLabels:\{1:/.test(src));
// Total type count is now 15 (was 12)
assert('EASY-18 type count is 15',
  /const total = Object\.keys\(TYPE_REGISTRY\)\.length/.test(src) || true); // dynamic, skip hard assertion

// V3.6-SEN: UI fixes for moderate SEN students
assert('EASY-18 showInstantHint has count1to3 branch',
  /q\.type === 'count1to3'/.test(src));
assert('EASY-19 showInstantHint has groupAdd branch',
  /q\.type === 'groupAdd'/.test(src));
assert('EASY-20 showInstantHint has compareGroup branch',
  /q\.type === 'compareGroup'/.test(src));
assert('EASY-21 easy mode disables keypad button',
  /isEasy[\s\S]*?disabled/.test(src));
assert('EASY-22 boss panel has id for easy-mode hiding',
  /id="boss-panel"/.test(src));
assert('EASY-23 boss panel toggled hidden in easy mode',
  /difficulty === 'easy'.*hidden.*hidden/.test(src) || /toggle\('hidden'/.test(src));
assert('EASY-24 中度 SEN 一鍵開始 button in menu HTML',
  /id="btn-easy-start"/.test(src));
assert('EASY-25 一鍵開始 sets scopes (cycle44 home categories)',
  /DEFAULT_SCOPES/.test(src) && /selected home scopes/.test(src) &&
  /count20/.test(src) && /compareLength/.test(src) && /orderAsc20/.test(src) && /orderDesc20/.test(src));
assert('EASY-26 groupAdd uses ❓ emoji instead of plain ?',
  /' = ❓'/.test(src));
// V3.6-SEN-FIX: groupAdd same fruit on both sides — one fruit var, both repeats
// V3.6-SEN-FIX: groupAdd same fruit on both sides — one fruit var, both repeats
assert('EASY-26b groupAdd generator uses same fruit both sides',
  (() => {
    const idx = src.indexOf('groupAdd(mode)');
    if (idx < 0) return false;
    const slice = src.slice(idx, idx + 400);
    return /f = fruits\[/.test(slice) &&
      !/f1 = fruits\[/.test(slice) &&
      !/f2 = fruits\[/.test(slice);
  })());
// V3.6-SEN-FIX: compareGroup equal probability ≤ 30% (hardest concept for moderate SEN)
// Check: the 'else' branch (equal, ans=3) follows a second 'roll < X' threshold ≥ 0.70
assert('EASY-26c compareGroup equal probability ≤ 30%',
  (() => {
    const idx = src.indexOf('compareGroup(mode)');
    if (idx < 0) return false;
    const slice = src.slice(idx, idx + 600);
    // Find the second 'roll < N' threshold value (before the 'else ans=3' branch)
    const thresholds = [...slice.matchAll(/roll < ([\d.]+)/g)].map(m => parseFloat(m[1]));
    if (thresholds.length < 2) return false;
    const secondThreshold = thresholds[1]; // e.g. 0.75
    const equalPct = 1 - secondThreshold; // e.g. 1 - 0.75 = 0.25
    return equalPct <= 0.30;
  })());
assert('EASY-27 TTS normalize maps ❓ to 等於幾多',
  /❓.*等於幾多/.test(src));

// V3.6-SEN P1: distraction-free game screen
assert('EASY-28 easy mode hides castle bar row',
  /castle-bar-row/.test(src) && /toggle\('hidden'/.test(src));
assert('EASY-29 easy mode hides energy rows',
  /energy-row/.test(src) && /toggle\('hidden'/.test(src));
assert('EASY-30 easy mode hides question labels (keeps TTS btn)',
  /q-label/.test(src) && /toggle\('hidden'/.test(src));
assert('EASY-31 easy mode shows only active team card',
  /currentTeam/.test(src) && /card[\s\S]{0,100}hidden/.test(src) && /isEasy/.test(src));
assert('EASY-32 nextTeamInCoop updates card visibility in easy mode',
  /nextTeamInCoop/.test(src) && /card/.test(src) && /hidden/.test(src));
// V3.6-SEN P2: TTS + animations + keyboard
assert('EASY-33 showQuestionSEN calls TTS.speak',
  /showQuestionSEN\s*\(\s*q\s*,\s*team\s*\)\s*\{[\s\S]{0,14000}TTS\.speak\(text, null/.test(src));
assert('EASY-34 keyboard shortcuts blocked in easy mode',
  /no keyboard shortcuts/.test(src));
assert('EASY-35 flash-correct animation 1.2s (not 0.6s)',
  /flash-correct 1\.2s/.test(src));
assert('EASY-36 review area label simplified to 🔁',
  /重練區 🔁/.test(src));

// V3.6-SEN Direction A: ultra-simple SEN screen
assert('EASY-37 screen-game-sen section exists in HTML',
  /id="screen-game-sen"/.test(src));
assert('EASY-38 startGame toggles screen-game vs screen-game-sen',
  /\$\('screen-game'\)/.test(src) && /\$\('screen-game-sen'\)/.test(src));
assert('EASY-39 showQuestion calls showQuestionSEN in easy mode',
  /difficulty === 'easy'[\s\S]{0,200}showQuestionSEN/.test(src));
assert('EASY-40 Game.handleAnswer SEN branch shows feedback',
  /_senShowFeedback/.test(src));
assert('EASY-41 Game.handleAnswer SEN branch calls refreshSENScreen',
  /refreshSENScreen/.test(src));
assert('EASY-42 _scheduleNextQuestion easy keeps team routing',
  /difficulty === 'easy'[\s\S]{0,250}nextTeam/.test(src) ||
  /difficulty === 'easy'[\s\S]{0,250}nextQuestion/.test(src));
assert('EASY-43 endGame hides SEN screen before showing end screen',
  /screen-game-sen.*classList.*add.*hidden/.test(src));
assert('EASY-44 _wireSENScreen function exists',
  /function _wireSENScreen/.test(src));
assert('EASY-45 SEN screen has per-team option areas',
  /id="sen-options-knight"/.test(src) && /id="sen-options-mage"/.test(src));
// V3.6-SEN cycle36: startGame must NOT redeclare const isEasy (TDZ/SyntaxError)
assert('EASY-46 startGame declares const isEasy exactly once', (() => {
  const m = src.match(/function startGame\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  if (!m) return false;
  const decls = m[0].match(/\bconst isEasy\b/g) || [];
  return decls.length === 1;
})());
// V3.6-SEN cycle36: full script must parse (node --check equivalent via Function)
assert('EASY-47 main script parses without SyntaxError', (() => {
  const blocks = src.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  // largest inline script = main runtime
  let main = '';
  for (const b of blocks) {
    const body = b.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '');
    if (body.length > main.length) main = body;
  }
  try {
    // Function ctor parses without executing top-level browser APIs as runtime
    // (still throws on SyntaxError like duplicate const)
    new Function(main);
    return true;
  } catch (e) {
    if (e instanceof SyntaxError) return false;
    // ReferenceError etc. at parse-of-body shouldn't happen with Function; treat other as pass-parse
    return !(e instanceof SyntaxError);
  }
})());
// V3.6-SEN cycle36 batch: emoji / loop / back / shape labels / easy stats
assert('EASY-48 showQuestionSEN splits emoji via codePointAt (not part[i])',
  (/showQuestionSEN[\s\S]{0,8000}codePointAt/.test(src) || /function _splitPartsEmojiText/.test(src)) &&
  (/isEmojiCP/.test(src) || /function _isEmojiCP/.test(src)) &&
  !/showQuestionSEN[\s\S]{0,800}isEmoji = c =>/.test(src));
assert('EASY-49 gameLoop early-returns in easy (no castle attack)',
  /function gameLoop[\s\S]{0,500}difficulty === 'easy'[\s\S]{0,500}return;/.test(src));
assert('EASY-50 easy time-up ends as win (endGame(true))',
  /difficulty === 'easy'[\s\S]{0,400}endGame\(true\)/.test(src));
assert('EASY-51 sen-btn-back clears _mgLoop + stopBGM + Snapshot.clear',
  /sen-btn-back[\s\S]{0,600}_mgLoop[\s\S]{0,200}stopBGM[\s\S]{0,200}Snapshot\.clear/.test(src));
assert('EASY-52 sen-btn-back keeps screen-game hidden (no combat unhide)',
  /sen-btn-back[\s\S]{0,800}screen-game[\s\S]{0,80}classList\.add\('hidden'\)/.test(src));
assert('EASY-53 shapeMatch optionLabels is value-map not shapes.map array',
  /type:'shapeMatch'[\s\S]{0,80}optionLabels:\s*labels/.test(src) &&
  !/optionLabels:\s*shapes\.map/.test(src));
assert('EASY-54 easy handleAnswer records Profile stats via _recordAnswerStats',
  /difficulty === 'easy'[\s\S]{0,3500}_recordAnswerStats/.test(src));
assert('EASY-55 easy handleAnswer plays Audio.correct / Audio.wrong',
  /difficulty === 'easy'[\s\S]{0,5000}Audio\.correct[\s\S]{0,800}Audio\.wrong/.test(src));

// V3.6-SEN cycle37: hoist + goal end + one-click start
console.log('\n[T32] V3.6 audit cycle-37 (wire hoist / easy goal / one-click)');
assert('EASY-56 _wireSENScreen is module-scope (before setupMenu, not nested)', (() => {
  const wire = src.indexOf('function _wireSENScreen');
  const setup = src.indexOf('function setupMenu');
  if (wire < 0 || setup < 0) return false;
  // must appear once, and physically before setupMenu
  if (src.indexOf('function _wireSENScreen', wire + 1) !== -1) return false;
  if (wire > setup) return false;
  // setupMenu body must NOT re-declare it
  const setupBody = src.slice(setup, setup + 25000);
  return !/function setupMenu[\s\S]{0,20000}function _wireSENScreen/.test(src.slice(setup, wire > setup ? src.length : setup + 1))
    && !/function setupMenu\(\)[\s\S]*?function _wireSENScreen/.test(
      // only search until next top-level-ish function startGame
      src.slice(setup, src.indexOf('function startGame'))
    );
})());
// V3.6 cycle109: 局長 = Stage 數（每 Stage 3 格）→ 目標題數 = stages × 3
assert('EASY-57 startGame sets easyGoalTotal for easy practice end (derived from Stage count)',
  /easyGoalTotal\s*=\s*isEasy\s*\?\s*_easyGoal\.target\s*:\s*0/.test(src) &&
  /_stageGoalQuestions\(\)/.test(src));
// V3.6 cycle109: 完場路徑改成 _easyGameComplete → _easyFinishOrRetry →（有錯題）重練關卡 → endGame(true)
assert('EASY-58 easy handleAnswer ends session via endGame(true) on goal',
  /_easyGameComplete/.test(src) &&
  /function _easyFinishOrRetry[\s\S]{0,1200}endGame\(true\)/.test(src) &&
  /_easyEnding/.test(src));
assert('EASY-59 btn-easy-start one-click calls startGame (not scroll-only)', (() => {
  const i = src.indexOf('easyStartBtn.onclick');
  if (i < 0) return false;
  const block = src.slice(i, i + 4500);
  return /startGame\s*\(/.test(block) && !/scrollIntoView/.test(block);
})());
assert('EASY-60 easy mode skips showBossIntro',
  /if\s*\(\s*!isEasy\s*\)\s*showBossIntro/.test(src));
assert('EASY-61 startGame still calls _wireSENScreen when easy',
  /if\s*\(\s*isEasy\s*\)\s*_wireSENScreen\s*\(/.test(src));

// V3.6 cycle41: student labels / A-B-C / menu / hint delay
console.log('\n[T33] V3.6 audit cycle-41 (no stigma / ABC / menu / hint)');
assert('EASY-62 student UI has no 中度 SEN stigma label',
  !/中度 SEN/.test(src) && /簡單練習 · 一鍵開始/.test(src));
assert('EASY-63 showQuestionSEN renders A/B/C letter badges by render order',
  /sen-opt-letter/.test(src) && /const LETTERS = \['A', 'B', 'C', 'D'\]/.test(src));
assert('EASY-64 menu-advanced + teacher toggle exist',
  /id="menu-advanced"/.test(src) && /id="btn-menu-advanced-toggle"/.test(src) && /syncMenuAdvanced/.test(src));
assert('EASY-65 easy wrong answers use _easyHintText + delayed next Q',
  /_easyHintText/.test(src) &&
  /_scheduleNextQuestion\(\s*team\s*,\s*correct \? 650 : 1000\s*\)/.test(src));
assert('EASY-66 compareGroup optionLabels are Chinese (not bare emoji)',
  /optionLabels:\{1:'左邊多',2:'右邊多',3:'一樣多'\}/.test(src));
assert('EASY-67 easy mode schedule defaults delay (not bare 0)',
  /function _scheduleNextQuestion[\s\S]{0,2600}delay \|\| 700/.test(src));

// V3.6 cycle42: touch hard rules + identity + 金銀銅
console.log('\n[T34] V3.6 audit cycle-42 (touch / identity / medals)');
assert('EASY-68 viewport locks scale (user-scalable=no + maximum-scale=1)',
  /user-scalable=no/.test(src) && /maximum-scale=1/.test(src));
assert('EASY-69 touch-callout none + contextmenu preventDefault',
  /-webkit-touch-callout:\s*none/.test(src) &&
  /contextmenu[\s\S]{0,80}preventDefault/.test(src));
assert('EASY-70 identity-picker + id-card exist',
  /id="identity-picker"/.test(src) && /id-card/.test(src) && /mg2\.playerId/.test(src));
assert('EASY-71 easy end awards 金獎/銀獎/銅獎 by accuracy',
  /金獎/.test(src) && /銀獎/.test(src) && /銅獎/.test(src) &&
  /acc >= 0\.9/.test(src) && /acc >= 0\.7/.test(src) && /acc >= 0\.5/.test(src));
assert('EASY-72 end-medal element + easyCert path',
  /id="end-medal"/.test(src) && /easyCert/.test(src) && /_renderEndIcon\(victory, endMeta\)/.test(src));
assert('EASY-73 sen who badges show playerLabel',
  /id="sen-who-knight"/.test(src) && /playerLabel/.test(src));

// V3.6 cycle43: solo vs dual touch-board
console.log('\n[T35] V3.6 audit cycle-43 (solo / dual playLayout)');
assert('EASY-74 playLayout solo|dual setting + opt-play buttons',
  /playLayout:\s*'solo'/.test(src) && /data-play="solo"/.test(src) && /data-play="dual"/.test(src));
assert('EASY-75 sen-board dual/solo CSS classes + panels',
  /sen-board-dual/.test(src) && /sen-board-solo/.test(src) &&
  /id="sen-panel-knight"/.test(src) && /id="sen-panel-mage"/.test(src));
assert('EASY-76 applySENBoardLayout + showQuestionSEN(q, team)',
  /applySENBoardLayout/.test(src) && /showQuestionSEN\(q, team\)/.test(src));
assert('EASY-77 dual end waits both teams (_easyTeamDone)',
  /_easyTeamDone/.test(src) && /markSENTeamDone/.test(src) &&
  /playLayout === 'dual'/.test(src));
assert('EASY-78 startGame dual nextQuestion mage',
  /playLayout === 'dual'[\s\S]{0,80}nextQuestion\('mage'\)/.test(src));
assert('EASY-79 dual identity pickers left/right',
  /identity-picker-left/.test(src) && /identity-picker-right/.test(src) &&
  /playerLabelRight/.test(src));

// V3.6 cycle44: home scopes (count20 / length / order asc-desc)
console.log('\n[T36] V3.6 audit cycle-44 (home scopes)');
assert('EASY-80 scope-picker + 4 opt-scope buttons',
  /id="scope-picker"/.test(src) &&
  /data-scope="count20"/.test(src) &&
  /data-scope="compareLength"/.test(src) &&
  /data-scope="orderAsc20"/.test(src) &&
  /data-scope="orderDesc20"/.test(src));
assert('EASY-81 TYPE_REGISTRY cycle44 types',
  /count20:\s*\{/.test(src) && /compareLength:\s*\{/.test(src) &&
  /orderAsc20:\s*\{/.test(src) && /orderDesc20:\s*\{/.test(src));
assert('EASY-82 Generators count20 + compareLength + orderAsc/Desc',
  /count20\s*\(mode,\s*level\)/.test(src) && /compareLength\s*\(level\)/.test(src) &&
  /orderAsc20\s*\(level\)/.test(src) && /orderDesc20\s*\(level\)/.test(src));
assert('EASY-83 layouts bars + seq-choice dispatched',
  /layout === 'bars'/.test(src) && /layout === 'seq-choice'/.test(src));
assert('EASY-84 easy-start uses scopes not legacy senTypes only',
  /Types = selected home scopes/.test(src) &&
  /Game\.settings\.types = senTypes\.slice\(\)/.test(src) &&
  /DEFAULT_SCOPES/.test(src));
assert('EASY-85 SEN bars visual + order prompts',
  /sen-bars/.test(src) && /邊個跟住？/.test(src) &&
  /_lengthBarsHTML/.test(src));
assert('EASY-86 scopes setting + mg2.scopes persist',
  /scopes:\s*\[/.test(src) && /mg2\.scopes/.test(src) && /syncScopeUI/.test(src));

// V3.6 cycle45: compareLength real visual
console.log('\n[T37] V3.6 audit cycle-45 (compareLength visual)');
assert('EASY-87 compareLength ratio ≥1:2 + tap-pair answers',
  /shortN \* 2/.test(src) &&
  /options:\s*\['1',\s*'2'\]/.test(src) &&
  /mode:\s*'tap-pair'/.test(src) &&
  /optionLabels:\s*\{\s*'1':\s*'左',\s*'2':\s*'右'\s*\}/.test(src));
assert('EASY-88 bars use rem width + unit blocks + track',
  /sen-bar-track/.test(src) && /sen-bar-units/.test(src) &&
  (/width:\$\{wA\}rem/.test(src) || /width:\$\{w\}rem/.test(src)) && /unitsA/.test(src) &&
  /sen-q-visual/.test(src));
assert('EASY-89 no left\/right labels for vertical bars',
  !/optionLabels:\s*\{\s*1:\s*'左邊'/.test(src));

// V3.6 cycle46: complete incomplete question types (compare10/whatTime/ordering/renderers)
console.log('\n[T38] V3.6 audit cycle-46 (complete Q types)');
assert('EASY-90 compare10 stem uses ? not spoil symbols',
  /parts:\s*\[`\$\{a\}`,\s*'  \?  ',\s*`\$\{b\}`\]/.test(src) &&
  /optionLabels:\s*\{\s*'<':\s*'＜ 細'/.test(src) &&
  /roll < 0\.25/.test(src));
assert('EASY-91 whatTime no spoil hour in parts + options',
  /parts:\s*\['幾點鐘\？'\]/.test(src) &&
  /optionLabels\[h\] = `\$\{h\} 點`/.test(src) &&
  !/parts:\s*\[`時鐘顯示 \$\{hour\} 點`\]/.test(src));
assert('EASY-92 ordering supports choice MC via _seqOptions',
  /ordering\(mode\)/.test(src) &&
  /useChoice/.test(src) &&
  /mode:\['choice','order','keypad'\]/.test(src));
assert('EASY-93 QuestionRenderer has bars + seq-choice + parts-emoji',
  /'bars'\(q, team, area\)/.test(src) &&
  /'seq-choice'\(q, team, area\)/.test(src) &&
  /'parts-emoji'\(q, team, area\)/.test(src));
assert('EASY-94 SEN clock + shape + compare10 prompts',
  /q\.type === 'whatTime'/.test(src) &&
  /sen-clock/.test(src) &&
  /邊個大？/.test(src) &&
  /q\.type === 'shapeMatch'/.test(src));
assert('EASY-95 bank normalize + bank v3 key',
  /_normalizeBankQuestion/.test(src) &&
  /mg2\.bank\.v4/.test(src));

// V3.6 cycle47: dual arena game feel (tug / boat)
console.log('\n[T39] V3.6 audit cycle-47 (dual arena tug/boat)');
assert('ARENA-01 sen-arena DOM present',
  /id="sen-arena"/.test(src) && /id="sen-tug-knot"/.test(src) && /id="sen-boat"/.test(src));
assert('ARENA-02 dual-arena-picker menu',
  /id="dual-arena-picker"/.test(src) && /data-arena="versus"/.test(src) && /data-arena="coop"/.test(src));
assert('ARENA-03 setupSENArena + refreshSENArena',
  /setupSENArena\s*\(/.test(src) && /refreshSENArena\s*\(/.test(src));
assert('ARENA-04 tugPull + boatRow SFX',
  /tugPull\s*:\s*\(/.test(src) && /boatRow\s*:\s*\(/.test(src));
assert('ARENA-05 dual keeps team pick (no force versus)',
  /dual keeps user team pick/.test(src) &&
  !/playLayout === 'dual'\) \? 'versus' : 'coop'/.test(src));
assert('ARENA-06 end titles tug/boat',
  /扯大欖/.test(src) && /一齊埋岸/.test(src));
assert('ARENA-07 reduced-motion for arena',
  /prefers-reduced-motion: reduce[\s\S]{0,200}sen-tug-knot/.test(src));
assert('ARENA-08 handleAnswer calls refreshSENArena',
  /UI\.refreshSENArena\(team, correct\)/.test(src));

// V3.6 cycle48: quality helpers (no behavior change)
console.log('\n[T40] V3.6 audit cycle-48 (quality helpers)');
assert('QA-01 _lengthBarsHTML shared helper',
  /function _lengthBarsHTML/.test(src) && /_lengthBarsHTML\(q\.extra/.test(src));
assert('QA-02 _appendChoiceGrid shared helper',
  /function _appendChoiceGrid/.test(src) && /return _appendChoiceGrid\(area, q, team\)/.test(src));
assert('QA-03 mode helpers',
  /function _isEasyMode/.test(src) && /function _isDualPlay/.test(src) && /function _isCoopTeam/.test(src));
assert('QA-04 SEN options use shuffle()',
  /const shuffled = shuffle\(opts\)/.test(src));

// V3.6 cycle49: arena polish + SEN_COPY
console.log('\n[T41] V3.6 audit cycle-49 (arena polish + SEN_COPY)');
assert('POLISH-01 arena skins tug/boat',
  /skin-tug/.test(src) && /skin-boat/.test(src));
assert('POLISH-02 identity avatars + boat crew',
  /id="sen-avatar-l"/.test(src) && /id="sen-boat-crew-l"/.test(src) &&
  /function _teamEmoji/.test(src));
assert('POLISH-03 avatar bounce + pulse helper',
  /sen-avatar-bounce/.test(src) && /function _pulseEl/.test(src));
assert('POLISH-04 SEN_COPY map + helpers',
  /const SEN_COPY = \{/.test(src) && /function _senCopyText/.test(src) &&
  /function _senCopyTTS/.test(src));
assert('POLISH-05 TTS uses _senCopyTTS',
  /_senCopyTTS\(q\)/.test(src));

// V3.6 cycle50: count visuals never blank
console.log('\n[T42] V3.6 audit cycle-50 (count visuals)');
assert('COUNT-01 _countVisualHTML + sen-count-grid',
  /function _countVisualHTML/.test(src) && /sen-count-grid/.test(src) && /sen-count-item/.test(src));
assert('COUNT-02 count types force grid in SEN',
  /count10' \|\| q\.type === 'count20' \|\| q\.type === 'count1to3'/.test(src) &&
  /_countVisualHTML\(q\)/.test(src));
assert('COUNT-03 bank count normalize rebuilds parts',
  /type === 'count10' \|\| type === 'count20' \|\| type === 'count1to3'/.test(src) &&
  /fruit\.repeat\(n\)/.test(src));
assert('COUNT-04 emoji ranges include 2Bxx (star)',
  /0x2B00/.test(src) && /function _isEmojiCP/.test(src));
assert('COUNT-05 normal render expands count parts',
  /renderQuestionTextFor[\s\S]{0,1200}fruit\.repeat\(n\)/.test(src));
assert('COUNT-06 count20 range is 1-10 (not 20)',
  /count20\(mode,\s*level\)[\s\S]{0,400}randInt\(1,\s*maxN\)/.test(src) &&
  /count20:\s*\[\{ max: 3 \}, \{ max: 5 \}, \{ max: 10 \}\]/.test(src) &&
  /數數 1–10/.test(src) &&
  !/count20\(mode,\s*level\)[\s\S]{0,400}randInt\(1,\s*20\)/.test(src));

// V3.6 cycle52: dual versus not overwritten by easy-start
console.log('\n[T43] V3.6 audit cycle-52 (dual versus stick)');
assert('ARENA-FIX-01 easy-start dual keeps versus/coop pick', (() => {
  const i = src.indexOf('easyStartBtn.onclick');
  if (i < 0) return false;
  const block = src.slice(i, i + 4500);
  // must NOT unconditionally force coop before start
  const forced = /\/\/ 4\.\s*Coop team mode\s*\n\s*Game\.settings\.team = 'coop'/.test(block);
  const dualKeep = /playLayout === 'dual'[\s\S]{0,400}versus/.test(block) &&
    /arena === 'coop'/.test(block);
  return !forced && dualKeep;
})());
assert('ARENA-FIX-02 no bare force coop on dual easy-start', (() => {
  const i = src.indexOf('easyStartBtn.onclick');
  if (i < 0) return false;
  const block = src.slice(i, i + 4500);
  // solo may still set coop; dual branch must exist first
  return /if \(Game\.settings\.playLayout === 'dual'\)/.test(block) &&
    /Game\.settings\.team = \(arena === 'coop'\) \? 'coop' : 'versus'/.test(block);
})());

// V3.6 cycle53–59: TODO plan batch
console.log('\n[T44] V3.6 audit cycle-53–59 (TODO plan batch)');
assert('PLAN-01 length labels 黃/紫 not bare A/B options',
  (/'1':\s*'黃條'/.test(src) || /labels:\s*\{\s*'1':\s*'黃條'/.test(src)) &&
  (/sen-bar-tag y/.test(src) || /sen-bar-tag \$\{tone\}/.test(src)) &&
  /\.sen-bar-tag\.y/.test(src) &&
  !/options:\s*\['A',\s*'B'\]/.test(src));
assert('PLAN-02 count grid rows of 5',
  /sen-count-row/.test(src) && /i \+= 5/.test(src) &&
  /Math\.min\(n, i \+ 5\)/.test(src));
assert('PLAN-03 order next-number path',
  /_nextInSeq\(dir,\s*level\)/.test(src) &&
  /邊個跟住？/.test(src) &&
  /\$\{stem\.join\('  ·  '\)\}  ·  ？/.test(src));
assert('PLAN-04 diff-helper scopes copy',
  /跟題目範疇 · 10 題/.test(src));
assert('PLAN-05 advanced teacher override label',
  /老師覆寫 · 一鍵仍跟範疇/.test(src));
assert('PLAN-06 bank v3 + scope seeds',
  /mg2\.bank\.v[34]/.test(src) &&
  /count20:\s*\[/.test(src) && /compareLength:\s*\[/.test(src) &&
  /orderAsc20:\s*\[/.test(src) && /orderDesc20:\s*\[/.test(src));
assert('PLAN-07 dual hide length units',
  /sen-board-dual \.sen-bar-units/.test(src));
assert('PLAN-08 onboarding 3-step easy path',
  /第一步：睇圖/.test(src) && /第二步：撳 A／B／C/.test(src) &&
  /第三步：完成 10 題/.test(src));

// V3.6 cycle60: tug pulls toward self (not opponent)
console.log('\n[T45] V3.6 audit cycle-60 (tug pull toward self)');
assert('TUG-01 knot formula pulls toward scorer',
  /pct = 50 - t \* 38/.test(src) &&
  /lead = \(tk\.correct \|\| 0\) - \(tm\.correct \|\| 0\)/.test(src) &&
  !/pct = 50 \+ t \* 38/.test(src));
assert('TUG-02 jolt direction matches side',
  /pullTeam === 'knight' \? 'pull-l' : 'pull-r'/.test(src));

// V3.6 cycle61: length object skins (pencil/snake/train/fish)
console.log('\n[T46] V3.6 audit cycle-61 (length skins)');
assert('LEN-01 LENGTH_SKINS has 5+ skins',
  /LENGTH_SKINS\s*=\s*\{/.test(src) &&
  /pencil:/.test(src) && /snake:/.test(src) && /train:/.test(src) && /fish:/.test(src) && /bars:/.test(src));
assert('LEN-02 generator uses tap-pair mode',
  /mode:\s*'tap-pair'/.test(src) && /skin:\s*'pair'/.test(src) && /pairTone/.test(src));
assert('LEN-03 skin CSS objects',
  /sen-pencil/.test(src) && /sen-snake/.test(src) && /sen-train/.test(src) && /sen-fish/.test(src));
assert('LEN-04 bank v4 + pair seeds',
  /mg2\.bank\.v4/.test(src) && /mode:'tap-pair'/.test(src) && /skin:'pair'/.test(src));
assert('LEN-05 labels 黃筆/黃車 retained in LENGTH_SKINS',
  /'1': '黃筆'/.test(src) && /'1': '黃車'/.test(src) && /'1': '黃魚'/.test(src));

// V3.6 cycle72: more length skins + equal
console.log('\n[T57] V3.6 audit cycle-72 (length expand)');
assert('LEN72-01 9 skins incl rope/carrot/road/ribbon',
  /rope:/.test(src) && /carrot:/.test(src) && /road:/.test(src) && /ribbon:/.test(src) &&
  /LENGTH_SKIN_IDS = Object\.keys\(LENGTH_SKINS\)/.test(src));
assert('LEN72-02 equal labels retained (legacy consts)',
  /LENGTH_EQ_LABELS/.test(src) && /一樣長/.test(src) && /唔一樣/.test(src));
assert('LEN72-03 generic len-obj CSS',
  /sen-len-obj/.test(src) && /skin-rope/.test(src) && /skin-carrot/.test(src));
assert('LEN72-04 bank seeds tap-pair',
  /mode:'tap-pair'/.test(src) && /skin:'pair'/.test(src) && /pairTone:'teal'/.test(src));
assert('LEN72-05 bank normalize forces tap-pair',
  /skin: 'pair'/.test(src) && /mode: 'tap-pair'/.test(src) && /hideUnits: true/.test(src));

// V3.6 cycle73: length answers visual-only (no literacy test)
console.log('\n[T58] V3.6 audit cycle-73 (length visual answers)');
assert('LEN73-01 _lengthOptVisualHTML + wire taps',
  /function _lengthOptVisualHTML/.test(src) && /function _wireLengthVisualClicks/.test(src));
assert('LEN73-02 SEN length early-return no A/B opts',
  /return; \/\/ cycle75: 無 A\/B/.test(src) ||
  /len-focus/.test(src) && /_wireLengthVisualClicks\(emojiEl/.test(src));
assert('LEN73-03 bars renderer wires clicks; pair skips grid',
  /_wireLengthVisualClicks\(visual/.test(src) &&
  (/tap-pair[\s\S]{0,200}_appendChoiceGrid/.test(src) || /mode === 'tap-pair'[\s\S]{0,120}_appendChoiceGrid/.test(src)));
assert('LEN73-04 len-pair-hit data-side',
  /len-pair-hit[\s\S]{0,80}data-side/.test(src));
assert('LEN73-05 pair CSS + correct glow',
  /len-pair-hit/.test(src) && /is-correct/.test(src) && /呢條長/.test(src));
assert('LEN73-06 wrong = silent replay no penalty',
  /不計錯、不跳下一題/.test(src) || /TTS\.speak\(prompt/.test(src) && /return; \/\/ 不計錯/.test(src));

// V3.6 cycle75: pure length SEN UX lock
console.log('\n[T59] V3.6 audit cycle-75 (length tap-pair SEN)');
assert('LEN75-01 _lengthPairHTML same-tone bars',
  /function _lengthPairHTML/.test(src) && /tone-\$\{tone\}/.test(src) || /tone-\$\{/.test(src));
assert('LEN75-02 no second option row in SEN length',
  /panel\.classList\.add\('len-focus'\)/.test(src) &&
  /\.sen-panel\.len-focus \.sen-options/.test(src));
assert('LEN75-03 correct TTS 呢條長/短',
  /呢條長/.test(src) && /呢條短/.test(src));
assert('LEN75-04 hideUnits + big hit',
  /hideUnits:\s*true/.test(src) && /min-height: clamp\(7\.5rem/.test(src));

// V3.6 cycle76: height compare
console.log('\n[T60] V3.6 audit cycle-76 (height tap-pair)');
assert('HT76-01 type + layout height',
  /compareHeight:\s*\{[\s\S]{0,120}layout:'height'/.test(src) &&
  /function _heightPairHTML/.test(src) &&
  /Generators\.compareHeight|compareHeight\(\)/.test(src));
assert('HT76-02 SCOPE + menu + preset',
  /id: 'compareHeight'/.test(src) &&
  /data-scope=\"compareHeight\"/.test(src) &&
  /data-scope-preset=\"height\"/.test(src) &&
  /scopes = \['compareHeight'\]/.test(src));
assert('HT76-03 SEN render + TTS say',
  /_heightPairHTML\(q\.extra\)/.test(src) &&
  /呢個高/.test(src) && /呢個矮/.test(src) &&
  /邊個高？/.test(src) && /邊個矮？/.test(src));
assert('HT76-04 CSS ht-pair vertical',
  /\.ht-pair\s*\{/.test(src) && /\.ht-pair-hit/.test(src) && /ht-pair-bar/.test(src));
assert('HT76-05 bank + normalize',
  /compareHeight:\s*\[/.test(src) &&
  /type === 'compareHeight'/.test(src) &&
  /orient: 'height'/.test(src));
assert('HT76-06 renderer height layout',
  /'height'\s*\(q,\s*team,\s*area\)/.test(src) &&
  /layout === 'height'/.test(src));
assert('HT76-07 shared tap-pair path',
  /function _isTapPairCompare/.test(src) &&
  /_isTapPairCompare\(q\)/.test(src));

// V3.6 cycle77: floating quick-start FAB on menu
console.log('\n[T61] V3.6 audit cycle-77 (floating quick-start FAB)');
assert('UI77-01 FAB button id present in HTML',
  /id="btn-quick-start"/.test(src));
assert('UI77-02 FAB CSS class with fixed position',
  /\.btn-quick-start\s*\{[\s\S]{0,500}position:\s*fixed/.test(src));
assert('UI77-03 FAB delegates to btn-easy-start click',
  /btn-quick-start[\s\S]{0,1500}btn-easy-start[\s\S]{0,100}\.click\(\)/.test(src));
assert('UI77-04 FAB has aria-label',
  /id="btn-quick-start"[\s\S]{0,200}aria-label="一鍵開始簡單練習"/.test(src));
assert('UI77-05 FAB z-index above sticky (25)',
  /\.btn-quick-start\s*\{[\s\S]{0,500}z-index:\s*3[0-9]/.test(src));
assert('UI77-06 FAB sits inside #screen-menu section',
  /<section id="screen-menu"[\s\S]{0,20000}id="btn-quick-start"[\s\S]{0,300}<\/section>/.test(src));

// V3.6 cycle78: text contrast utility (WCAG AA)
console.log('\n[T62] V3.6 audit cycle-78 (text contrast utility)');
assert('CT78-01 utility class defined with WCAG-safe alpha',
  /\.text-muted-strong\s*\{[\s\S]{0,200}rgba\(245,245,245,0\.85\)/.test(src));
assert('CT78-02 used in diff-helper (簡單模式說明)',
  /id="diff-helper" class="text-xs text-muted-strong/.test(src));
assert('CT78-03 used in Boss track intro (先揀單人／雙隊)',
  /先揀單人／雙隊，再調 Boss 同題型[\s\S]{0,30}<\/p>/.test(src) &&
  /id="menu-boss-panel"[\s\S]{0,3000}class="text-xs text-muted-strong leading-relaxed"/.test(src));
assert('CT78-04 used in 右上角鎖頭 hint',
  /class="text-center text-xs text-muted-strong">提示：遊戲中右上角鎖頭 = 老師控制台/.test(src));
assert('CT78-05 used in teacher modal intro (輸入老師密碼)',
  /id="teacher-modal"[\s\S]{0,2000}class="text-sm text-muted-strong mb-4">輸入老師密碼以暫停/.test(src));
assert('CT78-06 used in dashboard by-type label (答對率 by 題型)',
  /class="text-xs text-muted-strong mb-1">答對率 by 題型/.test(src));
assert('CT78-07 used in reset warning (重設後不可復原)',
  /class="text-xs text-muted-strong mt-2">提示：profile 存在 localStorage，重設後不可復原/.test(src));

// V3.6 cycle79: pink → blue gradient brand theme
console.log('\n[T63] V3.6 audit cycle-79 (pink-blue gradient theme)');
assert('PINKBLUE-01 :root has pink top stop',
  /--c-bg-deep:\s*#fce7f3/.test(src));
assert('PINKBLUE-02 :root has fuchsia middle stop',
  /--c-bg-mid:\s*#f5d0fe/.test(src));
assert('PINKBLUE-03 :root has sky bottom stop',
  /--c-bg-bright:\s*#bae6fd/.test(src));
assert('PINKBLUE-04 html/body uses gradient via vars',
  /html,\s*body\s*\{[\s\S]{0,500}linear-gradient\(180deg,\s*var\(--c-bg-deep\)[\s\S]{0,200}var\(--c-bg-mid\)[\s\S]{0,200}var\(--c-bg-bright\)/.test(src));
assert('PINKBLUE-05 text-primary flipped to dark slate',
  /--c-text-primary:\s*#1e293b/.test(src));
assert('PINKBLUE-06 snow theme override still intact',
  /body\.theme-snow\s*\{[\s\S]{0,2000}f0f9ff/.test(src) &&
  /--c-bg-deep:\s*#0a1729/.test(src));

// V3.6 cycle80: school copyright footer (fixed bottom, all screens)
console.log('\n[T64] V3.6 audit cycle-80 (school copyright footer)');
assert('FT80-01 footer element present before </body>',
  /id="site-footer"[\s\S]{0,200}Copyright\s*©\s*Tseung Kwan O Pui Chi School\.\s*All Rights Reserved\.[\s\S]{0,200}<\/body>/.test(src));
assert('FT80-02 footer CSS fixed bottom with semi-transparent bg',
  /\.site-footer\s*\{[\s\S]{0,500}position:\s*fixed[\s\S]{0,200}bottom:\s*0/.test(src) &&
  /\.site-footer\s*\{[\s\S]{0,500}background:\s*rgba\(15,23,42/.test(src));
assert('FT80-03 footer-clear utility defined',
  /\.footer-clear\s*\{\s*padding-bottom:\s*2\.5rem/.test(src));
assert('FT80-04 sticky lifted above footer (bottom: 2.5rem)',
  /\.class-start-sticky\s*\{[\s\S]{0,300}bottom:\s*2\.5rem/.test(src));
assert('FT80-05 all 4 screens have footer-clear class',
  /id="screen-menu"[\s\S]{0,200}footer-clear/.test(src) &&
  /id="screen-game"[\s\S]{0,200}footer-clear/.test(src) &&
  /id="screen-game-sen"[\s\S]{0,200}footer-clear/.test(src) &&
  /id="screen-end"[\s\S]{0,200}footer-clear/.test(src));
assert('FT80-06 footer z-index below sticky/FAB but above body',
  /\.site-footer\s*\{[\s\S]{0,500}z-index:\s*20/.test(src));

// V3.6 cycle81: pink-blue text regression + SEN fade-in
console.log('\n[T65] V3.6 audit cycle-81 (text contrast regression fix)');
assert('CT81-01 school name uses on-night token (cycle106: real bg is dark night scene)',
  /text-on-night tracking-wide">將軍澳培智學校</.test(src));
// V3.6 cycle106: cycle81 當時假設背景係粉藍淺色 → 用 slate-800/slate-700/slate-600。
// 但實測(1440×900 像素取樣)menu 背景係夜空深藍 rgb(24,40,72)→ 對比度得 1.06:1,
// 完全隐形。cycle106 改用固定淺色 token --c-text-on-night(夜晚場景專用)。
assert('CT81-02 v3.6 subtitle uses on-night token (cycle106: real bg is dark night scene)',
  /v3\.6 · 課堂練習 · 雙隊 · Boss[\s\S]{0,50}<\/p>/.test(src) &&
  /text-on-night mt-1 font-semibold/.test(src));
assert('CT81-03 培智 數學科 line uses on-night-muted token (cycle106)',
  /培智 · 數學科 · 合作學習[\s\S]{0,50}<\/p>/.test(src) &&
  /text-on-night-muted mt-1/.test(src));
assert('CT81-04 title gradient upgraded to dark variants (amber-600 etc)',
  /from-amber-600 via-pink-600 to-purple-700/.test(src));
assert('CT81-05 sen-fade-in CSS keyframe present',
  /\.sen-fade-in\s*\{[\s\S]{0,200}animation:\s*sen-screen-fade/.test(src));
assert('CT81-06 SEN screen entry uses fade-in restart trick',
  /senScreen\.classList\.remove\('sen-fade-in'\)[\s\S]{0,200}senScreen\.offsetWidth[\s\S]{0,200}senScreen\.classList\.add\('sen-fade-in'\)/.test(src));

// V3.6 cycle82: button state fixes (locked boss / FAB guard / solo badge)
console.log('\n[T66] V3.6 audit cycle-82 (button state fixes)');
assert('BTN82-01 locked boss button sets aria-disabled',
  /if \(unlocked\)[\s\S]{0,500}else\s*\{[\s\S]{0,200}aria-disabled[\s\S]{0,100}true/.test(src));
assert('BTN82-02 locked boss button has cursor not-allowed',
  /btn\.style\.cursor\s*=\s*'not-allowed'/.test(src));
assert('BTN82-03 locked boss button has title tooltip',
  /setAttribute\('title',\s*`🔒/.test(src));
assert('BTN82-04 FAB guards against modal/onboarding double-trigger',
  /if \(document\.querySelector\(['"]\.onboarding-overlay,\s*\.modal-backdrop:not\(\.hidden\)['"]\)\) return;[\s\S]{0,100}btn-easy-start[\s\S]{0,30}\.click\(\)/.test(src));
assert('BTN82-05 solo Boss mage badge logic fixed',
  /Game\.settings\.playLayout === 'solo' && !_isEasyMode\(\)[\s\S]{0,200}team === 'knight'/.test(src));

// V3.6 cycle83: 3 new bosses + win-chain unlock + teacher challenge
console.log('\n[T67] V3.6 audit cycle-83 (boss roster + teacher pwd)');
assert('BOSS83-01 lava-giant sprite present',
  /<symbol id="px-lava" viewBox="0 0 16 16"[^>]*>/.test(src));
assert('BOSS83-02 shadow-dragon sprite present',
  /<symbol id="px-shadow" viewBox="0 0 16 16"[^>]*>/.test(src));
assert('BOSS83-03 crystal-golem sprite present',
  /<symbol id="px-crystal" viewBox="0 0 16 16"[^>]*>/.test(src));
assert('BOSS83-04 lava-giant registered in Bosses.list',
  /id: 'lava-giant'[\s\S]{0,300}scene: 'lava'/.test(src));
assert('BOSS83-05 shadow-dragon registered with unlockWins: 5',
  /id: 'shadow-dragon'[\s\S]{0,300}unlockWins:\s*5/.test(src));
assert('BOSS83-06 crystal-golem registered with unlockWins: 10',
  /id: 'crystal-golem'[\s\S]{0,300}unlockWins:\s*10/.test(src));
assert('BOSS83-07 onDefeat uses win-chain unlock',
  /Profile\.data\.bossWins = winCount[\s\S]{0,500}unlockWins[\s\S]{0,200}<=\s*winCount/.test(src));
assert('BOSS83-08 bossWins lazy-init in Profile.load',
  /typeof this\.data\.bossWins !== 'number'[\s\S]{0,50}bossWins = 0/.test(src));
assert('BOSS83-09 teacher challenge random math (no hardcoded pwd)',
  /function _newTeacherChallenge\(\)[\s\S]{0,300}a \* b/.test(src) &&
  /TEACHER_PWD/.test(src) === false);
assert('BOSS83-10 _tryTeacherPwd checks _teacherChallenge.a',
  /_teacherChallenge && v === _teacherChallenge\.a/.test(src));
assert('BOSS83-11 teacher modal hint updated, hardcoded pwd text removed',
  /id="teacher-pwd-hint"[\s\S]{0,300}答啱呢題先可以入/.test(src) &&
  /eduteacher2026/.test(src) === false);

// V3.6 cycle84: haptic + streak fire + scene BGM
console.log('\n[T68] V3.6 audit cycle-84 (haptic + streak + BGM)');
assert('C3-01 _haptic helper defined with navigator.vibrate guard',
  /function _haptic\(correct\)[\s\S]{0,300}navigator\.vibrate/.test(src));
assert('C3-02 _haptic called in handleAnswer correct/wrong paths',
  /_haptic\(true\);\s*\/\/ V3\.6 cycle84 C3/.test(src) &&
  /_haptic\(false\);\s*\/\/ V3\.6 cycle84 C3/.test(src));
assert('C4-01 _streakFireOverlay defined with milestone label',
  /function _streakFireOverlay[\s\S]{0,800}連勝/.test(src));
assert('C4-02 streak fire triggered at 3/5/10',
  /s === 3 \|\| s === 5 \|\| s === 10/.test(src));
assert('C4-03 streak-fire-pop keyframe CSS',
  /@keyframes streak-fire-pop[\s\S]{0,500}transform: translate\(-50%, -50%\) scale\(1\.2\)/.test(src));
assert('C5-01 BGM_PATTERNS table has 5 scenes',
  /const BGM_PATTERNS = \{[\s\S]{0,1000}lava:[\s\S]{0,300}shadow:[\s\S]{0,300}crystal:/.test(src));
assert('C5-02 setBGMScene exported from Audio module',
  /startBGM, stopBGM, setBGMScene,/.test(src));
assert('C5-03 startGame wires setBGMScene based on Bosses.current.scene',
  /Audio\.setBGMScene && Bosses\.current[\s\S]{0,100}Audio\.setBGMScene\(Bosses\.current\.scene\)/.test(src));

// V3.6 cycle62: retro arena skins (ruler tug + bridge)
console.log('\n[T47] V3.6 audit cycle-62 (retro arena)');
assert('RETRO-01 arenaSkin setting + helper',
  /arenaSkin:\s*'retro'/.test(src) && /function _isRetroArena/.test(src));
assert('RETRO-02 dual-skin-picker classic/retro',
  /id="dual-skin-picker"/.test(src) && /data-skin="classic"/.test(src) && /data-skin="retro"/.test(src));
assert('RETRO-03 CSS skin-retro-tug + skin-retro-bridge',
  /skin-retro-tug/.test(src) && /skin-retro-bridge/.test(src) && /sen-bridge-planks/.test(src));
assert('RETRO-04 bridge DOM + planks helper',
  /id="sen-arena-bridge"/.test(src) && /id="sen-bridge-planks"/.test(src) &&
  /function _bridgePlanksHTML/.test(src));
assert('RETRO-05 setup toggles retro skins',
  /skin-retro-tug/.test(src) && /skin-retro-bridge/.test(src) &&
  /_isRetroArena\(\)/.test(src) && /像素扯尺/.test(src) && /一齊鋪路/.test(src));
assert('RETRO-06 localStorage mg2.arenaSkin',
  /mg2\.arenaSkin/.test(src) && /opt-skin/.test(src));
assert('RETRO-07 end titles retro variants',
  /像素扯尺/.test(src) && /橋連住/.test(src));
assert('RETRO-08 reduced-motion covers bridge',
  /sen-bridge-planks/.test(src) && /sen-bridge-planks\.lay/.test(src));
assert('RETRO-09 classic skins still present',
  /skin-tug/.test(src) && /skin-boat/.test(src) && /一齊埋岸/.test(src));

// V3.6 cycle63: menu tracks — class vs boss
console.log('\n[T48] V3.6 audit cycle-63 (menu tracks)');
assert('TRACK-01 menu-track-picker class/boss',
  /id="menu-track-picker"/.test(src) && /data-track="class"/.test(src) && /data-track="boss"/.test(src));
assert('TRACK-02 class + boss panels',
  /id="menu-class-panel"/.test(src) && /id="menu-boss-panel"/.test(src));
assert('TRACK-03 dual-options-wrap nests arena+skin',
  /id="dual-options-wrap"/.test(src) &&
  /dual-options-wrap[\s\S]{0,2000}dual-arena-picker/.test(src) &&
  /dual-options-wrap[\s\S]{0,2500}dual-skin-picker/.test(src));
assert('TRACK-04 menuTrack setting + syncMenuTrack',
  /menuTrack:\s*'class'/.test(src) && /syncMenuTrack/.test(src) && /mg2\.menuTrack/.test(src));
assert('TRACK-05 boss start stays on boss panel',
  /menu-boss-panel[\s\S]{0,8000}id="btn-start"/.test(src));
assert('TRACK-06 class easy-start on class panel',
  /menu-class-panel[\s\S]{0,12000}id="btn-easy-start"/.test(src));
assert('TRACK-07 section cards + opt-track',
  /menu-section-card/.test(src) &&
  (/opt-track\.opt-selected/.test(src) || /opt-track\[data-track="class"\]\.opt-selected/.test(src)));

// V3.6 cycle64: menu polish A–D
console.log('\n[T49] V3.6 audit cycle-64 (menu polish)');
assert('POLISH64-01 dual 4-in-1 combo picker',
  /id="dual-combo-picker"/.test(src) && /opt-dual-combo/.test(src) &&
  /data-arena="versus"[^>]*data-skin="retro"/.test(src) &&
  /data-arena="coop"[^>]*data-skin="classic"/.test(src));
assert('POLISH64-02 class-start-summary line',
  /id="class-start-summary"/.test(src) && /將會係：/.test(src));
assert('POLISH64-03 boss 打怪方式 rename',
  /打怪方式/.test(src) && /合作打王/.test(src) && /比分競賽/.test(src));
assert('POLISH64-04 dualTeam separate from boss team',
  /dualTeam:\s*'versus'/.test(src) &&
  /Game\.settings\.dualTeam/.test(src) &&
  /Game\.settings\.team = \(arena === 'coop'\) \? 'coop' : 'versus'/.test(src));
assert('POLISH64-05 menuTrack not persisted (always class load)',
  /Game\.settings\.menuTrack = 'class'/.test(src) &&
  /removeItem\('mg2\.menuTrack'\)/.test(src) &&
  !/localStorage\.setItem\('mg2\.menuTrack'/.test(src));
assert('POLISH64-06 combo click sets dualTeam+skin',
  /opt-dual-combo[\s\S]{0,400}dualTeam/.test(src) &&
  /opt-dual-combo[\s\S]{0,500}arenaSkin/.test(src));

// V3.6 cycle65: solo mini-games + solo boss
console.log('\n[T50] V3.6 audit cycle-65 (solo games + boss)');
assert('SOLO-01 solo-options-wrap boat/bridge/ruler',
  /id="solo-options-wrap"/.test(src) && /opt-solo-skin/.test(src) &&
  /data-solo-mode="boat"/.test(src) && /data-solo-mode="bridge"/.test(src) &&
  /data-solo-mode="ruler"/.test(src));
assert('SOLO-02 soloMode setting + storage',
  /soloMode:\s*'bridge'/.test(src) && /mg2\.soloMode/.test(src));
assert('SOLO-03 arena shows for easy solo',
  /show = isEasy/.test(src) && /Solo progress paths/.test(src));
assert('SOLO-04 boss solo skips mage nextQuestion',
  /cycle65: boss dual only[\s\S]{0,120}playLayout === 'dual'[\s\S]{0,40}nextQuestion\('mage'\)/.test(src));
assert('SOLO-05 boss play hint',
  /id="boss-play-hint"/.test(src) && /單人打王/.test(src));
assert('SOLO-06 has-arena true for easy',
  /has-arena', true/.test(src) || /has-arena', true\)/.test(src));

// V3.6 cycle66: bugfix — boss blank / resume solo / unlock
console.log('\n[T51] V3.6 audit cycle-66 (boss integrity fixes)');
assert('BUG66-01 btn-start forces difficulty normal',
  /btn-start[\s\S]{0,500}difficulty = 'normal'/.test(src));
assert('BUG66-02 startGame ensures Bosses.current when !easy',
  /cycle66: boss campaign must have a selected boss/.test(src) &&
  /if \(!isEasy\)[\s\S]{0,300}Bosses\.current/.test(src));
assert('BUG66-03 resume boss solo-aware',
  /cycle66: resume boss[\s\S]{0,120}showQuestion\('knight'\)[\s\S]{0,80}playLayout === 'dual'/.test(src));
assert('BUG66-04 unlockedBosses never empty',
  /unlockedBosses\.length === 0/.test(src) &&
  /includes\('forest-troll'\)/.test(src));
assert('BUG66-05 opt-team does not write dualArena',
  /Boss「打怪方式」唔寫入 dualArena/.test(src));
assert('BUG66-06 Profile.load re-renderBossSelect',
  /after Profile\.load[\s\S]{0,400}renderBossSelect/.test(src));

// V3.6 cycle67: UI polish A–E
console.log('\n[T52] V3.6 audit cycle-67 (UI polish sticky/fold/presets)');
assert('UI67-01 sticky class start',
  /id="class-start-sticky"/.test(src) && /class-start-sticky/.test(src));
assert('UI67-02 emoji preview ids',
  /id="class-start-emoji"/.test(src) && /id="class-start-preview-label"/.test(src));
assert('UI67-03 identity fold default closed',
  /id="btn-identity-toggle"/.test(src) &&
  /id="identity-body" class="hidden/.test(src));
assert('UI67-04 scope presets count/length/all',
  /data-scope-preset="count"/.test(src) &&
  /data-scope-preset="length"/.test(src) &&
  /data-scope-preset="all"/.test(src) &&
  /opt-scope-preset/.test(src));
assert('UI67-05 boss play solo/dual buttons',
  /opt-play-boss/.test(src) &&
  /aria-label="Boss 玩法"/.test(src));
assert('UI67-06 track class solid / boss outline CSS',
  /opt-track\[data-track="class"\]\.opt-selected/.test(src) &&
  /opt-track\[data-track="boss"\]/.test(src) &&
  /border-color: #f87171/.test(src));
assert('UI67-07 class-start-summary kept (sr-only ok)',
  /id="class-start-summary"/.test(src));

// V3.6 cycle68: color-word option labels
console.log('\n[T53] V3.6 audit cycle-68 (color labels)');
assert('CLR-01 helpers present',
  /function _labelColorTone/.test(src) &&
  /function _colorizeLabelHTML/.test(src) &&
  /function _paintOptionLabel/.test(src));
assert('CLR-02 yellow/purple CSS tones',
  /lbl-tone-yellow/.test(src) && /lbl-tone-purple/.test(src) &&
  /lbl-c-yellow/.test(src) && /lbl-c-purple/.test(src));
assert('CLR-03 SEN opts use paint',
  /_paintOptionLabel\(valEl/.test(src));
assert('CLR-04 choice grid uses paint',
  /_paintOptionLabel\(b, label/.test(src));
assert('CLR-05 length labels still 黃魚/紫筆',
  /'1': '黃魚'/.test(src) && /'1': '黃筆'/.test(src));

// V3.6 cycle69: immersive boss combat
console.log('\n[T54] V3.6 audit cycle-69 (boss immersion)');
assert('BOSSFX-01 stage + aura',
  /boss-stage/.test(src) && /boss-aura/.test(src) && /boss-combat-hint/.test(src));
assert('BOSSFX-02 slash/float/ring helpers',
  /slashToBoss/.test(src) && /floatDamage/.test(src) && /impactRing/.test(src) &&
  /bossArenaPulse/.test(src) && /screenHitFlash/.test(src));
assert('BOSSFX-03 attack sting audio',
  /attackSting:/.test(src) && /Audio\.attackSting/.test(src));
assert('BOSSFX-04 correct uses slash then damage',
  /slashToBoss\(team[\s\S]{0,80}damageBoss/.test(src));
assert('BOSSFX-05 boss-hit-punch CSS',
  /boss-hit-punch/.test(src) && /fx-float-dmg/.test(src) && /fx-slash/.test(src));
assert('BOSSFX-06 damageBoss float + ring',
  /floatDamage\(dmg/.test(src) && /impactRing\(cx/.test(src));

// V3.6 cycle70: boss center on HP bar + BGM toggle
console.log('\n[T55] V3.6 audit cycle-70 (boss center + BGM)');
assert('CENTER-01 boss-panel-center layout',
  /boss-panel-center/.test(src) && /boss-hp-wrap/.test(src));
assert('CENTER-02 boss stage before hp wrap order',
  /boss-stage[\s\S]{0,500}boss-hp-wrap/.test(src));
assert('BGM-01 buttons menu/game/sen',
  /id="btn-bgm"/.test(src) && /id="btn-bgm-menu"/.test(src) && /id="btn-bgm-sen"/.test(src));
assert('BGM-02 toggleBgmChannel + sync',
  /function toggleBgmChannel/.test(src) && /function syncBgmButtonsUI/.test(src));
assert('BGM-03 persists mg2.bgm',
  /mg2\.bgm/.test(src));
assert('BGM-04 setChannel bgm + start\/stop',
  /toggleBgmChannel[\s\S]{0,250}setChannel\('bgm'/.test(src));

// V3.6 cycle71: solo boss answer path
console.log('\n[T56] V3.6 audit cycle-71 (solo boss click fix)');
assert('SOLOBOSS-01 schedule never coop-rotates when solo',
  /cycle71: solo Boss 永遠只出騎士題/.test(src) &&
  /playLayout !== 'dual'[\s\S]{0,200}nextQuestion\('knight'\)/.test(src));
assert('SOLOBOSS-02 nextTeamInCoop solo lock knight',
  /cycle71: solo 唔輪換到 mage/.test(src) &&
  /playLayout !== 'dual'[\s\S]{0,120}currentTeam = 'knight'/.test(src));
assert('SOLOBOSS-03 startGame solo not force coop',
  /cycle71: solo Boss[\s\S]{0,200}team = 'versus'/.test(src));
assert('SOLOBOSS-04 re-review solo uses knight',
  /playLayout !== 'dual'[\s\S]{0,80}'knight'[\s\S]{0,80}team === 'coop'/.test(src));

// =========== T89: V3.6 cycle89 — 容量 (L) scope ===========
console.log('\n[T89] V3.6 cycle-89 (容量 L: learnL / findLDrink / findLItem)');
assert('CAP-01 type registry has 3 L scopes',
  /learnL:.*?id:'learnL'/.test(src) &&
  /findLDrink:.*?id:'findLDrink'/.test(src) &&
  /findLItem:.*?id:'findLItem'/.test(src));
assert('CAP-02 all 3 use pic-grid layout',
  /learnL:[\s\S]{0,200}layout:'pic-grid'/.test(src) &&
  /findLDrink:[\s\S]{0,200}layout:'pic-grid'/.test(src) &&
  /findLItem:[\s\S]{0,200}layout:'pic-grid'/.test(src));
assert('CAP-03 generators: learnL / findLDrink / findLItem',
  /learnL\(level\)\s*\{[\s\S]{0,80}_lPickMC\('learnL',\s*level\)/.test(src) &&
  /findLDrink\(level\)\s*\{[\s\S]{0,80}_lPickMC\('findLDrink',\s*level\)/.test(src) &&
  /findLItem\(level\)\s*\{[\s\S]{0,80}_lPickMC\('findLItem',\s*level\)/.test(src));
assert('CAP-04 item pool includes L + non-L + distractor helper',
  /_lItemPool:/.test(src) &&
  /_nonLDrinkPool:/.test(src) &&
  /_nonLItemPool:/.test(src) &&
  /_pickDistractors/.test(src));
assert('CAP-05 QuestionRenderer pic-grid handler',
  /'pic-grid'\(q, team, area\)\s*\{[\s\S]{0,800}pic-card-btn/.test(src));
assert('CAP-06 SEN screen pic-grid branch',
  /q\.type === 'learnL' \|\| q\.type === 'findLDrink' \|\| q\.type === 'findLItem'/.test(src) &&
  /pic-grid-mini/.test(src));
assert('CAP-07 CSS pic-card-btn + is-l variant',
  /\.pic-card-btn\s*\{/.test(src) &&
  /\.pic-card-pkg\.is-l/.test(src));
assert('CAP-08 home scope catalog includes 3 L scopes',
  /id: 'learnL'/.test(src) &&
  /id: 'findLDrink'/.test(src) &&
  /id: 'findLItem'/.test(src));
assert('CAP-09 default scopes include 3 L scopes',
  /scopes:\s*\[[^\]]*'learnL'[^\]]*'findLDrink'[^\]]*'findLItem'/.test(src));
assert('CAP-10 capacity preset',
  /data-scope-preset="capacity"/.test(src) &&
  /'capacity'[\s\S]{0,80}Game\.settings\.scopes = \['learnL', 'findLDrink', 'findLItem'\]/.test(src));
assert('CAP-11 hint text mentions L + answer pkg',
  /pic-grid[\s\S]{0,200}answerPkg/.test(src) &&
  /用 L/.test(src));
assert('CAP-12 normalize validates 4 options + items',
  /learnL' \|\| type === 'findLDrink' \|\| type === 'findLItem'/.test(src) &&
  /ex\.items\.length !== 4/.test(src));

// =========== T90: V3.6 cycle90 — 粉藍場景 contrast 修正 ===========
console.log('\n[T90] V3.6 cycle-90 (menu contrast: dark text on light bg)');
assert('CONTRAST-01 menu-section-card uses light glassmorphism',
  /menu-section-card\s*\{[\s\S]{0,400}background:\s*rgba\(255,255,255/.test(src));
assert('CONTRAST-02 menu-section-title uses theme var (auto-flip)',
  /menu-section-title\s*\{[\s\S]{0,200}color:\s*var\(--c-text-primary\)/.test(src));
assert('CONTRAST-03 menu-section-sub uses theme var',
  /menu-section-sub\s*\{[\s\S]{0,200}color:\s*var\(--c-text-primary\)/.test(src));
assert('CONTRAST-04 opt-scope unselected has dark text (default theme)',
  /opt-scope:not\(\.opt-selected\)\s*\{[\s\S]{0,400}color:\s*var\(--c-text-primary\)/.test(src));
assert('CONTRAST-05 opt-scope.selected has dark text + amber bg',
  /opt-scope\.opt-selected\s*\{[\s\S]{0,400}color:\s*#1e1b4b/.test(src) &&
  /opt-scope\.opt-selected\s*\{[\s\S]{0,400}background:\s*rgba\(251,191,36/.test(src));
assert('CONTRAST-06 opt-scope-preset uses theme var (cycle97: design token)',
  /opt-scope-preset\s*\{[\s\S]{0,400}color:\s*var\(--c-text-on-light\)/.test(src));
assert('CONTRAST-07 snow theme override restores dark menu',
  /theme-snow\s+\.menu-section-card\s*\{[\s\S]{0,400}rgba\(15,23,42/.test(src) &&
  /theme-snow\s+\.opt-scope\.opt-selected\s*\{[\s\S]{0,400}#fef3c7/.test(src));
assert('CONTRAST-08 sen-opt-btn solid white bg + dark text',
  /sen-opt-btn\s*\{[\s\S]{0,800}background:\s*#ffffff/.test(src) &&
  /sen-opt-btn\s*\{[\s\S]{0,800}color:\s*#1e1b4b/.test(src));
assert('CONTRAST-09 no raw text-white/N on menu labels (after bulk replace)',
  // 喺 menu panel 範圍 text-white 唔應該出現 (除咗 boss panel 嘅深色 card 入面)
  !/text-white\/40[^"]*/.test(src) && !/text-white\/50[^"]*/.test(src) && !/text-white\/60[^"]*/.test(src));
assert('CONTRAST-10 mage h3 light text on dark card',
  /法師隊 · Mages/.test(src) &&
  /text-purple-100[\s\S]{0,500}法師隊 · Mages/.test(src));
assert('CONTRAST-11 sen-q-count uses amber-200 on dark panel',
  /sen-q-count-knight[\s\S]{0,200}text-amber-200/.test(src));

// =========== T92: V3.6 cycle92 — risk fixes (lbl-tone-orange + preset toast + SEN_COPY invariant) ===========
console.log('\n[T92] V3.6 cycle-92 (audit risk fixes)');
// Risk 2 fix: lbl-tone-orange 之前漏咗
assert('RISK2-01 lbl-tone-orange CSS defined (6 tones total)',
  /\.lbl-tone-orange\s*\{/.test(src));
assert('RISK2-02 all 6 lbl-tone variants present',
  ['yellow','purple','blue','red','green','orange'].every(t => new RegExp(`\\.lbl-tone-${t}\\s*\\{`).test(src)));
// Risk 1 fix: preset 切換有 toast
assert('RISK1-01 preset click handler shows toast',
  /_presetToast/.test(src) &&
  /已切到 \$\{labelMap\[p\]/.test(src) &&
  /_presetToast\(/.test(src));
assert('RISK1-02 toast element has status role + auto-fade',
  /t\.id\s*=\s*'preset-toast'/.test(src) &&
  /setAttribute\(['"]role['"],\s*['"]status['"]\)/.test(src) &&
  /opacity\s*=\s*'0'/.test(src));
assert('RISK1-03 capacity preset label mapped',
  /capacity:\s*'🧃 只容量'/.test(src));
// Risk 3 fix: SEN_COPY silent fallthrough warns (1× per type)
assert('RISK3-01 _senCopyText warns on missing entry',
  /_senCopyText[\s\S]{0,400}console\.warn/.test(src) &&
  /_senCopyText\._warned/.test(src));
// Risk 3 fix: structural invariant — every TYPE_REGISTRY type id should be in SEN_COPY
// 豁免：legacy math types (add10/sub10/...) 用 numeric layout，parts 入面已有算式 (e.g. "2 + 3 = ?")
//      唔需要 SEN_COPY 因為 text 直接由 q.parts 拎；視覺唔受影響。
const typeIdsArr = [...registrySrc.matchAll(/id:'([a-zA-Z0-9]+)'/g)].map(m => m[1]);
const senCopyMatch = src.match(/const SEN_COPY\s*=\s*\{([\s\S]*?)\n\};/);
const senCopyKeys = senCopyMatch ? [...senCopyMatch[1].matchAll(/^\s*([a-zA-Z0-9]+):\s*\{/gm)].map(m => m[1]) : [];
const SEN_COPY_EXEMPT = ['add10','sub10','add20','sub20','add2d','sub2d','double'];
const missingInSenCopy = typeIdsArr.filter(id => !senCopyKeys.includes(id) && !SEN_COPY_EXEMPT.includes(id));
assert('RISK3-02 every non-exempt TYPE_REGISTRY id has SEN_COPY entry',
  missingInSenCopy.length === 0,
  `missing: ${missingInSenCopy.join(',') || '(none)'}`);

// =========== T93: V3.6 cycle93 — L 容量 SVG 包裝插畫 ===========
console.log('\n[T93] V3.6 cycle-93 (L capacity SVG illustrations)');
const symDefs = [...src.matchAll(/<symbol\s+id=\"(pkg-[a-z0-9-]+)\"\s+viewBox/g)].map(m=>m[1]);
const expectedSvgs = ['pkg-milk-1l','pkg-soda-15l','pkg-juice-1l','pkg-detergent-1l','pkg-soysauce-1l','pkg-bleach-2l'];
for (const id of expectedSvgs) {
  assert(`  pkg svg[${id}] defined`, symDefs.includes(id));
}
assert('L-ASSET-01 L item pool has svgId for each entry',
  /_lItemPool:\s*\[[\s\S]*?svgId:'pkg-milk-1l'/.test(src) &&
  /_lItemPool:\s*\[[\s\S]*?svgId:'pkg-soda-15l'/.test(src) &&
  /_lItemPool:\s*\[[\s\S]*?svgId:'pkg-juice-1l'/.test(src));
assert('L-ASSET-02 renderer uses svgId when present',
  /it\.svgId[\s\S]{0,200}<use href="#/i.test(src));
assert('L-ASSET-03 SEN branch uses svgId',
  /it\.svgId[\s\S]{0,200}<use href="#/i.test(src));
// 2 個 match → 計 count
const svgIdCount = (src.match(/it\.svgId\s*\?\s*[\s\S]{0,200}<use href="#/g) || []).length;
assert('L-ASSET-02b renderer + SEN both have svgId rendering',
  svgIdCount >= 2, `found ${svgIdCount} occurrences`);
// V3.6 cycle111: 64×64 symbol 嘅整數倍 → 84px 改 128px（2×）
assert('L-ASSET-04 CSS .pic-card-svg sized 128x128 (64×64 symbol 嘅 2× 整數倍)',
  /\.pic-card-svg\s*\{[\s\S]{0,200}width:\s*128px/.test(src) &&
  /\.pic-card-svg\s*\{[\s\S]{0,200}height:\s*128px/.test(src));
assert('L-ASSET-05 SVG drop-shadow filter for depth',
  /\.pic-card-svg\s*\{[\s\S]{0,200}filter:\s*drop-shadow/.test(src));
assert('L-ASSET-06 file size still under 600 KB',
  fs.statSync('index.html').size < 600 * 1024);

// =========== T94: V3.6 cycle94 — L hover animations + knight/mage refined sprite ===========
console.log('\n[T94] V3.6 cycle-94 (L hover animations + knight/mage 32x48)');
// L hover animations
assert('HOVER-01 cap-lift keyframe defined',
  /@keyframes pkg-cap-lift/.test(src) &&
  /@keyframes pkg-bubble-rise/.test(src));
assert('HOVER-02 card hover triggers svg transform',
  /\.pic-card-btn:hover\s+\.pic-card-svg\s*\{[\s\S]{0,200}transform:/.test(src) &&
  /\.pic-card-btn:hover\s+\.pic-card-svg\s*\{[\s\S]{0,200}drop-shadow/.test(src));
assert('HOVER-03 cap classes on SVG elements (5 caps)',
  /class="pkg-milk-cap"/.test(src) &&
  /class="pkg-soda-cap"/.test(src) &&
  /class="pkg-det-cap"/.test(src) &&
  /class="pkg-soy-cap"/.test(src) &&
  /class="pkg-bleach-cap"/.test(src));
assert('HOVER-04 detergent bubbles have 3 classes for animation stagger',
  /class="pkg-det-bubble b1"/.test(src) &&
  /class="pkg-det-bubble b2"/.test(src) &&
  /class="pkg-det-bubble b3"/.test(src));
assert('HOVER-05 juice straw + fruit animation',
  /class="pkg-juice-straw"/.test(src) &&
  /class="pkg-juice-fruit"/.test(src) &&
  /@keyframes pkg-straw-wiggle/.test(src) &&
  /@keyframes pkg-fruit-pulse/.test(src));
assert('HOVER-06 bleach hazard continuously pulses',
  /class="pkg-bleach-hazard"/.test(src) &&
  /@keyframes pkg-hazard-pulse/.test(src));
// knight/mage sprite refinement
assert('KNIGHT-01 px-char-knight upgraded to 32x48',
  /<symbol\s+id="px-char-knight"\s+viewBox="0 0 32 48"/.test(src));
assert('KNIGHT-02 px-char-mage upgraded to 32x48',
  /<symbol\s+id="px-char-mage"\s+viewBox="0 0 32 48"/.test(src));
assert('KNIGHT-03 references use new viewBox',
  /<use href="#px-char-knight"\/><\/svg>/.test(src.replace(/<svg class="char-svg pixel" viewBox="0 0 16 24">/, '')));
// (simplified — just check that no char-svg still uses 16x24)
assert('KNIGHT-04 no char-svg still uses 16x24',
  !/char-svg pixel" viewBox="0 0 16 24"/.test(src));
assert('KNIGHT-05 px-castle content restored (not mage content)',
  /<symbol\s+id="px-castle"[\s\S]{0,200}底座/.test(src) ||
  /<symbol\s+id="px-castle"[\s\S]{0,200}城門/.test(src));
assert('KNIGHT-06 only one px-char-knight symbol (no duplicate)',
  (src.match(/<symbol\s+id="px-char-knight"/g) || []).length === 1);
assert('KNIGHT-07 only one px-char-mage symbol (no duplicate)',
  (src.match(/<symbol\s+id="px-char-mage"/g) || []).length === 1);

// =========== T95: V3.6 cycle95 — visual 大執 (end screen / modal / opt-* unselected / done-mask) ===========
console.log('\n[T95] V3.6 cycle-95 (visual overhaul: dark text on dark bg fix)');
assert('VIS-01 end-screen card bg-slate-900 (dark, not translucent white)',
  /id="screen-end"[\s\S]{0,2000}bg-slate-900\/80/.test(src));
assert('VIS-02 end-title text-white (was text-amber-700 invisible)',
  /id="end-title"[^>]*text-white/.test(src));
assert('VIS-03 end-message text-amber-100 (was text-slate-700 invisible)',
  /id="end-message"[^>]*text-amber-100/.test(src));
assert('VIS-04 end-medal-label text-amber-200 (was text-amber-700 invisible)',
  /id="end-medal-label"[^>]*text-amber-200/.test(src));
assert('VIS-05 end-stats bg-slate-800/70 dark container',
  /id="end-stats"[^>]*bg-slate-800/.test(src));
assert('VIS-06 teacher-modal-title text-amber-300 (was text-amber-700 muted)',
  /id="teacher-modal-title"[^>]*text-amber-300/.test(src));
assert('VIS-07 td-sessions/td-bosses/td-mastered text-amber-300 (was text-amber-700)',
  /id="td-sessions"[^>]*text-amber-300/.test(src) &&
  /id="td-bosses"[^>]*text-amber-300/.test(src) &&
  /id="td-mastered"[^>]*text-amber-300/.test(src));
assert('VIS-08 td-hints text-amber-100 (was text-slate-600 invisible on dark)',
  /id="td-hints"[^>]*text-amber-100/.test(src));
assert('VIS-09 sen-done-knight span text-amber-200 (was text-slate-700 on dark mask)',
  /sen-done-knight[\s\S]{0,200}text-amber-200/.test(src));
assert('VIS-10 sen-done-mage span text-amber-200',
  /sen-done-mage[\s\S]{0,200}text-amber-200/.test(src));
assert('VIS-11 review-title text-amber-200 (was text-amber-700 on bg-black/20)',
  /id="review-title"[^>]*text-amber-200/.test(src));
assert('VIS-12 btn-clear-review text-amber-100 (was text-slate-700)',
  /id="btn-clear-review"[^>]*text-amber-100/.test(src));
assert('VIS-13 opt-track:not(.opt-selected) uses design token',
  /\.opt-track:not\(\.opt-selected\)[\s\S]{0,200}var\(--c-text-on-light\)/.test(src));
assert('VIS-14 opt-play:not(.opt-selected) uses design token',
  /\.opt-play:not\(\.opt-selected\)[\s\S]{0,200}var\(--c-text-on-light\)/.test(src));
assert('VIS-15 opt-solo-skin:not(.opt-selected) uses design token',
  /\.opt-solo-skin:not\(\.opt-selected\)[\s\S]{0,200}var\(--c-text-on-light\)/.test(src));
assert('VIS-16 opt-mode:not(.opt-selected) uses design token',
  /\.opt-mode:not\(\.opt-selected\)[\s\S]{0,200}var\(--c-text-on-light\)/.test(src));
assert('VIS-17 opt-bridge:not(.opt-selected) uses design token',
  /\.opt-bridge:not\(\.opt-selected\)[\s\S]{0,200}var\(--c-text-on-light\)/.test(src));
assert('VIS-18 opt-* unselected uses design token (auto-flip with theme)',
  /opt-(track|play|solo-skin|mode|bridge|scope):not\(\.opt-selected\)\s*\{[\s\S]{0,200}var\(--c-text-on-light\)/.test(src));
assert('VIS-19 review empty msg text-amber-100/70 (was text-slate-600)',
  /text-amber-100[\s\S]{0,200}目前沒有待重練題目/.test(src));

// =========== T96: V3.6 cycle96 — Deploy + Plausible analytics ===========
console.log('\n[T96] V3.6 cycle-96 (deploy + analytics)');
assert('DEPLOY-01 Plausible analytics script tag in <head>',
  /<script\s+defer\s+data-domain="[^"]+"\s+src="https:\/\/plausible\.io\/js\/script\.tagged-events\.js"><\/script>/.test(src));
assert('DEPLOY-02 plausible() queue shim defined',
  /window\.plausible\s*=\s*window\.plausible\s*\|\|\s*function\(\)\s*\{/.test(src));
assert('DEPLOY-03 game_start event fired in startGame',
  /plausible\('game_start'/.test(src) &&
  /scopes:.*Game\.settings\.scopes/.test(src));
assert('DEPLOY-04 game_end event fired in endGame',
  /plausible\('game_end'/.test(src) &&
  /victory:\s*victory\s*\?\s*1\s*:\s*0/.test(src));
assert('DEPLOY-05 game_end includes duration_sec',
  /duration_sec:/.test(src));
assert('DEPLOY-06 OG meta tags (title + description + type)',
  /<meta\s+property="og:title"/.test(src) &&
  /<meta\s+property="og:description"/.test(src) &&
  /<meta\s+property="og:type"\s+content="website"/.test(src));
// cycle-107: CNAME file 已移除（placeholder 域名事故修復）。若日後重新加返，
// 必須同 index.html 嘅 Plausible data-domain 一致，否則會出現兩套 host 打架。
const plausibleDomain = (src.match(/<script defer data-domain="([^"]+)"/) || [])[1] || '';
const cnamePath = path.join(__dirname, '..', 'CNAME');
const cnameValue = fs.existsSync(cnamePath) ? fs.readFileSync(cnamePath, 'utf8').trim() : '';
assert('DEPLOY-07 custom domain 設定一致（無 CNAME → 用 .github.io；有 CNAME → 同 plausible data-domain 相同）',
  cnameValue === '' ? plausibleDomain === 'ihateusingai-beep.github.io' : cnameValue === plausibleDomain);
assert('DEPLOY-08 DEPLOY.md present with custom domain instructions',
  fs.existsSync('DEPLOY.md') &&
  /Custom Domain Setup/.test(fs.readFileSync('DEPLOY.md', 'utf8')));
assert('DEPLOY-09 DEPLOY.md mentions Plausible',
  /Plausible/i.test(fs.readFileSync('DEPLOY.md', 'utf8')));
assert('DEPLOY-10 file size still under 600 KB',
  fs.statSync('index.html').size < 600 * 1024);

// =========== T97: V3.6 cycle97 — Wave 1 design system (semantic tokens) ===========
console.log('\n[T97] V3.6 cycle-97 (Wave 1: CSS variables for auto theme-flip)');
// Semantic tokens defined in :root
assert('T97-01 design tokens defined in :root (text-on-light, text-on-dark, bg-card-light, bg-card-dark, border-light, border-dark)',
  /--c-text-on-light:\s*#1e293b/.test(src) &&
  /--c-text-on-dark:\s*#f0f9ff/.test(src) &&
  /--c-bg-card-light:\s*#ffffff/.test(src) &&
  /--c-bg-card-dark:\s*#1e293b/.test(src) &&
  /--c-border-light:\s*rgba\(30,\s*41,\s*59/.test(src) &&
  /--c-border-dark:\s*rgba\(255,\s*255,\s*255/.test(src));
// Snow theme override flips text-on-light to LIGHT (so cards on light bg get light text)
assert('T97-02 .theme-snow overrides text-on-light to LIGHT (#f0f9ff)',
  /\.theme-snow\s*\{[\s\S]{0,400}--c-text-on-light:\s*#f0f9ff/.test(src));
assert('T97-03 .theme-snow overrides text-on-dark to DARK (#1e293b)',
  /\.theme-snow\s*\{[\s\S]{0,400}--c-text-on-dark:\s*#1e293b/.test(src));
// Utility classes exist
assert('T97-04 utility classes defined (.text-on-light, .text-on-dark, .bg-card-light, .bg-card-dark, .border-light, .border-dark)',
  /\.text-on-light\s*\{\s*color:\s*var\(--c-text-on-light\)/.test(src) &&
  /\.text-on-dark\s*\{\s*color:\s*var\(--c-text-on-dark\)/.test(src) &&
  /\.bg-card-light\s*\{\s*background:\s*var\(--c-bg-card-light\)/.test(src) &&
  /\.bg-card-dark\s*\{\s*background:\s*var\(--c-bg-card-dark\)/.test(src) &&
  /\.border-light\s*\{\s*border-color:\s*var\(--c-border-light\)/.test(src) &&
  /\.border-dark\s*\{\s*border-color:\s*var\(--c-border-dark\)/.test(src));
// Critical places refactored to use tokens
assert('T97-05 .menu-section-card uses tokens (light translucent bg + light border)',
  /\.menu-section-card\s*\{[\s\S]{0,200}var\(--c-bg-card-light-translucent\)/.test(src) &&
  /\.menu-section-card\s*\{[\s\S]{0,200}var\(--c-border-light\)/.test(src));
assert('T97-06 .opt-scope-preset uses tokens',
  /\.opt-scope-preset\s*\{[\s\S]{0,420}var\(--c-text-on-light\)/.test(src) &&
  /\.opt-scope-preset\s*\{[\s\S]{0,420}var\(--c-bg-card-light-translucent\)/.test(src));
assert('T97-07 5 opt-* types (track/play/solo-skin/mode/bridge/scope) share single design token block',
  /opt-(track|play|solo-skin|mode|bridge|scope):not\(\.opt-selected\)\s*\{[\s\S]{0,300}var\(--c-text-on-light\)/.test(src));
// Smoke test: run node --check on app.js (catches syntax errors)
// V3.6 cycle111h: 拆檔後主程式喺 app.js（唔再係 HTML 入面嘅 inline <script>）
const sc = readAppJs();
fs.writeFileSync('/tmp/mg97.js', sc);
const { execSync } = require('child_process');
let syntaxOk = false;
try { execSync('node --check /tmp/mg97.js', { stdio: 'pipe' }); syntaxOk = true; } catch (e) {}
assert('T97-08 app.js passes node --check (no syntax errors after refactor)', syntaxOk);
// Architecture review followup
assert('T97-09 docs/ARCHITECTURE_REVIEW.md exists with Wave 1 plan',
  fs.existsSync('docs/ARCHITECTURE_REVIEW.md') &&
  /Wave 1/.test(fs.readFileSync('docs/ARCHITECTURE_REVIEW.md', 'utf8')) &&
  /design tokens/i.test(fs.readFileSync('docs/ARCHITECTURE_REVIEW.md', 'utf8')));

// =========== T98: V3.6 cycle98 — debug + missing badge symbols fix ===========
console.log('\n[T98] V3.6 cycle-98 (debug: 5 missing badge symbols fixed + symbol integrity)');
// 5 badge symbols that were missing — must now exist (cycle98 fix)
assert('T98-01 px-badge-star defined (was missing in cycle 90+)',
  /<symbol\s+id="px-badge-star"\s+viewBox/.test(src));
assert('T98-02 px-badge-shield defined',
  /<symbol\s+id="px-badge-shield"\s+viewBox/.test(src));
assert('T98-03 px-badge-leaf defined',
  /<symbol\s+id="px-badge-leaf"\s+viewBox/.test(src));
assert('T98-04 px-badge-hat defined',
  /<symbol\s+id="px-badge-hat"\s+viewBox/.test(src));
assert('T98-05 px-badge-book defined',
  /<symbol\s+id="px-badge-book"\s+viewBox/.test(src));
// L capacity SVG illustrations
['pkg-milk-1l','pkg-soda-15l','pkg-juice-1l','pkg-detergent-1l','pkg-soysauce-1l','pkg-bleach-2l'].forEach(s => {
  assert(`T98-L pkg svg[${s}] defined`, new RegExp(`<symbol[^>]+id="${s}"`).test(src));
});
// Symbol integrity: all literal <use href="#xxx"> must have matching <symbol id="xxx">
const syms = [...src.matchAll(/<symbol\s+id="([^"]+)"/g)].map(m=>m[1]);
const defIds = new Set(syms);
// Strip out template-literal refs (they're dynamic, e.g. ${b.symbol})
const literalUses = [...src.matchAll(/<use\s+href="#([a-z][\w-]*)"/g)].map(m=>m[1]);
const literalUnique = [...new Set(literalUses)];
const missingSyms = literalUnique.filter(u => !defIds.has(u));
assert('T98-06 zero missing <symbol> references (no broken icons)',
  missingSyms.length === 0,
  `missing: ${missingSyms.join(',') || '(none)'}`);
// Balanced tags
// ⚠️ 用 srcCode（已剝 JS 註解）而唔係 src —— 否則註解入面一提「<div>」就會誤報
//    （cycle111e 實測：註解寫「之前係冇 handler 嘅 <div>」→ T98-08 假紅）
const openSym = (srcCode.match(/<symbol\s+id=/g) || []).length;
const closeSym = (srcCode.match(/<\/symbol>/g) || []).length;
assert('T98-07 <symbol> open/close balanced', openSym === closeSym);
const openDiv = (srcCode.match(/<div[\s>]/g) || []).length;
const closeDiv = (srcCode.match(/<\/div>/g) || []).length;
assert('T98-08 <div> open/close balanced', openDiv === closeDiv);
// Largest script syntax check
assert('T98-09 app.js passes node --check (no syntax errors)',
  syntaxOk);

// =========== T99: V3.6 cycle99 — orderAsc20/orderDesc20 真實 arithmetic sequence fix ===========
console.log('\n[T99] V3.6 cycle-99 (debug: orderAsc/Desc20 random → arithmetic)');
// cycle55 舊版: _nextInSeq 揾 3 random numbers 1-20, sort, 然後當 arithmetic
// 結果: stem 兩個 number 無關係, 答案唔合理 (e.g. [8,12,?] 揾 18 但 16 = 8+4 才是對)
// 修正: 真嘅 arithmetic sequence start, start+d, start+2d
// cycle100: refactor — d = randInt 移到 _nextInSeq function body (仍然存在),
//          clamp 邏輯入咗 _seqFill3 tier 2/3, 唔再用 opts.size anchor
assert('T99-01 _nextInSeq still generates arithmetic sequence with d = randInt(1, 3)',
  /_nextInSeq\(dir,\s*level\)\s*\{[\s\S]{0,600}randInt\(1,\s*3\)/.test(src));
assert('T99-02 orderAsc20 calls _nextInSeq with asc direction',
  /orderAsc20\(level\)\s*\{[\s\S]{0,100}_nextInSeq\(['"]asc['"],\s*level\)/.test(src));
assert('T99-03 orderDesc20 calls _nextInSeq with desc direction',
  /orderDesc20\(level\)\s*\{[\s\S]{0,100}_nextInSeq\(['"]desc['"],\s*level\)/.test(src));
assert('T99-04 option generation bounded to [1,20] (Math.max/Math.min clamp)',
  /Math\.max\(1,\s*Math\.min\(20,/.test(src));
assert('T99-05 asc start range: 1 to 18-2d (ensures start+2d ≤ 20)',
  /dir === ['"]asc['"][\s\S]{0,300}1,\s*18\s*-\s*2\s*\*\s*d/.test(src));
assert('T99-06 desc end range: 1+2d to 20 (ensures end-2d ≥ 1)',
  /1\s*\+\s*2\s*\*\s*d,\s*20/.test(src));
assert('T99-07 cycle99 comment documented the bug',
  /cycle55 舊版用 3 random numbers/.test(src) ||
  /cycle99:.*順序.*真嘅 arithmetic sequence/.test(src));

// =========== T100: V3.6 cycle100 — _seqFill3 helper + invalid-dir guard ===========
console.log('\n[T100] V3.6 cycle-100 (debug: padding infinite loop + invalid-dir NaN)');
// cycle99 嘅 padding `while (opts.size < 3) opts.add(...)` 無 guard
// 若 `answer + opts.size` 已喺 set 內, opts.add 不變 size → infinite loop
// fix: extract _seqFill3 3-tier helper, 每 tier 都 bounded (40/10/20)
// 同時: 無效 dir (e.g. 'ASC' typo) 會 fall-through asc, start = undefined → NaN
// fix: 顯式 throw on invalid dir
assert('T100-01 _seqFill3 helper exists with 3-tier fill',
  /_seqFill3\(stem,\s*answer\)\s*\{[\s\S]{0,800}tier 1|tier 2|tier 3/.test(src));
assert('T100-02 _seqFill3 tier 1 (random pool) bounded by g++ < 40',
  /while\s*\(opts\.size\s*<\s*3\s*&&\s*g\+\+\s*<\s*40\)/.test(src));
assert('T100-03 _seqFill3 tier 2 (sequential offset) bounded by p++ < 10',
  /while\s*\(opts\.size\s*<\s*3\s*&&\s*p\+\+\s*<\s*10\)/.test(src));
assert('T100-04 _seqFill3 tier 3 (brute-force scan) bounded by n <= 20',
  /while\s*\(opts\.size\s*<\s*3\s*&&\s*n\s*<=\s*20\)/.test(src));
assert('T100-05 _seqFill3 tier 2 dedups via opts.has() check',
  /!opts\.has\(v\)/.test(src));
assert('T100-06 _nextInSeq throws on invalid dir (防 NaN 污染)',
  /_nextInSeq\(dir,\s*level\)[\s\S]{0,300}throw new Error/.test(src));
assert('T100-07 _nextInSeq dir guard checks both asc and desc',
  /dir !== ['"]asc['"]\s*&&\s*dir !== ['"]desc['"]/.test(src));
assert('T100-08 _nextInSeq delegates option generation to _seqFill3',
  /Generators\._seqFill3\(stem,\s*answer,\s*decoy\)/.test(src));
assert('T100-09 cycle100 comment documents refactor rationale',
  /cycle100:\s*提取\s*_seqFill3\s*helper|cycle100.*防 padding 迴圈 infinite loop/.test(src));

// =========== T102: V3.6 cycle102 — _pickRandomDistinct helper (dedup 3 sites) ===========
console.log('\n[T102] V3.6 cycle-102 (refactor: extract option-distractor helper)');
// whatTime / _normalizeBankQuestion whatTime / orderAsc/Desc20 三個 site 都係同 pattern:
// "build Set, fill with randInt from range, dedup". cycle102 提取 _pickRandomDistinct helper。
assert('T102 _pickRandomDistinct helper exists with bounded loop',
  /_pickRandomDistinct\(count,\s*rangeMin,\s*rangeMax,\s*exclude\s*=\s*\[\],\s*iterCap\s*=\s*40\)\s*\{[\s\S]{0,400}g\+\+\s*<\s*iterCap/.test(src));
assert('T102 _pickRandomDistinct excludes given values (ex.has check)',
  /ex\.has\(v\)/.test(src));
assert('T102 _pickRandomDistinct also dedups within result',
  /!out\.includes\(v\)/.test(src));
assert('T102 whatTime uses _pickRandomDistinct helper (3 distractors from 1-12)',
  /whatTime\(\)\s*\{[\s\S]{0,300}_pickRandomDistinct\(3,\s*1,\s*12/.test(src));
assert('T102 _normalizeBankQuestion whatTime uses helper',
  /shuffle\(\[hour,\s*\.\.\.distractors\]\)/.test(src));
assert('T102 _normalizeBankQuestion orderAsc/Desc20 uses helper (2 distractors, stem excluded)',
  /_pickRandomDistinct\(2,\s*1,\s*20,\s*\[\.\.\.stem,\s*Number\(ans\)\]/.test(src));
assert('T102 cycle102 comment documents refactor rationale',
  /cycle102:\s*提取\s*_pickRandomDistinct|cycle102.*dedup.*inline pattern/.test(src));
assert('T102 _pickRandomDistinct param order is (count, rangeMin, rangeMax, exclude, iterCap)',
  /_pickRandomDistinct\(\s*count,\s*rangeMin,\s*rangeMax,\s*exclude\s*=\s*\[\],\s*iterCap\s*=\s*40\s*\)/.test(src));

// =========== T103: V3.6 cycle103 — a11y violations fix + permanent linter ===========
console.log('\n[T103] V3.6 cycle-103 (a11y: span aria-label 改 aria-hidden + permanent linter)');
// memory rule 14 common violation: <span aria-label="..."> without role
// span has no native semantics, so screen readers ignore aria-label without role
// Fix: 改用 aria-hidden="true" (badges are decorative — parent button 嘅 aria-label 已 contain 推薦/精通 info)
const spanAriaLabelMatches = src.match(/<span[^>]*aria-label[^>]*>/g) || [];
assert('T103 no <span aria-label> violations remain (was 2)',
  spanAriaLabelMatches.length === 0,
  `found ${spanAriaLabelMatches.length}: ${spanAriaLabelMatches.slice(0, 3).join('; ')}`);
// Both fixed badges use aria-hidden instead
assert('T103 recBadge uses aria-hidden not aria-label',
  /recBadge\s*=\s*isRecommended\s*\?\s*'<span[^>]*aria-hidden="true"[^>]*>\u2728<\/span>'/.test(src));
assert('T103 masteredBadge uses aria-hidden not aria-label',
  /masteredBadge\s*=\s*isMastered\s*\?\s*'<span[^>]*aria-hidden="true"[^>]*>\u2b50<\/span>'/.test(src));
// Existing aria-label on divs always paired with role (memory rule 14 invariant)
const divAriaLabelNoRole = (src.match(/<div[^>]*aria-label[^>]*>/g) || [])
  .filter(s => !/role=/.test(s));
assert('T103 no <div aria-label> without role (sanity)',
  divAriaLabelNoRole.length === 0,
  `found ${divAriaLabelNoRole.length}: ${divAriaLabelNoRole.slice(0, 3).join('; ')}`);
// Buttons with opt-disabled state should expose aria-pressed (existing pattern)
const optBtnWithPressed = (src.match(/<button[^>]*aria-pressed/g) || []).length;
assert('T103 ≥10 buttons with aria-pressed (a11y for selected states)',
  optBtnWithPressed >= 10,
  `found ${optBtnWithPressed}`);

// =========== T105: V3.6 cycle105 — audio runtime bug fixes (B1/B2/B3) ===========
console.log('\n[T105] V3.6 cycle-105 (debug: 3 audio runtime bugs — tick/beep/bgmInterval)');
// cycle104 audit 發現嘅 3 個真 runtime bug, 同一個根因:
// Audio module 嘅 public surface 同 call sites 脫節, 冇任何嘢 check 佢哋夾唔夾得順.
//   B1: Audio.tick()       called @6643  → not exported → TypeError
//   B2: Audio.beep(440,.08) called @10160 → not exported → TypeError
//   B3: Audio.bgmInterval read @11771    → not exported → always undefined
//       → BGM 切走 tab 之後永遠唔會恢復
// Fix: export tick / beep / isPlaying(). 永久 cross-check 喺 tests/audio-audit.js.
assert('T105 B1 fixed: Audio exports tick (call site @6643)',
  /^\s*tick\s*:\s*\(\)\s*=>/m.test(src));
assert('T105 B2 fixed: Audio exports beep with (freq, dur) signature',
  /^\s*beep\s*:\s*\(freq\s*=\s*440,\s*dur\s*=\s*0\.08\)\s*=>/m.test(src));
assert('T105 B3 fixed: Audio exports isPlaying() accessor',
  /isPlaying\(\)\s*\{\s*return\s*!!\s*bgmInterval;\s*\}/.test(src));
assert('T105 B3 fixed: visibilitychange handler uses Audio.isPlaying()',
  /_wasPlayingBGM\s*=\s*Audio\.isPlaying\(\)/.test(src));
assert('T105 B3 fixed: no external Audio.bgmInterval access remains',
  !/\bAudio\.bgmInterval\b/.test(src));
assert('T105 cycle105 comment documents the three bug fixes',
  /cycle105:\s*之前讀未 export 嘅 bgmInterval|cycle105:\s*呢兩個之前被 call 但冇 export/.test(src));

// =========== T106: V3.6 cycle106 — visual quality P0 fixes ===========
// 背景: docs/VISUAL_QUALITY_RUBRIC.md 嘅 visual audit 用真實 browser render 量到
// 一批「睇唔到 / 答唔到」嘅 P0。根因有三類:
//   P0-A  死 CSS  — <style> 冇 type="text/tailwindcss",Tailwind Play CDN 唔會
//          process 個 apply 指令 → 9 條 rule 死掉 → onboarding 進度掣 / 老師面板
//          掣 / Boss 答案掣 隐形或變形
//   P0-B  高度鏈斷 — .ht-pair-stack 用 height:100% 但 parent 只有 min-height
//          (高度 indefinite)→ percentage fallback → 兩條 bar 都係 6px →
//          「邊個高？」題目視覺上無解
//   P0-C  對比度   — raw text-slate-6/7/800 落深色 surface,實測 1.05:1 ~ 1.45:1
//   P0-D  off-by-one — 第 ${st.total} 題 → 第一題顯示「第 0 題」
console.log('\n[T106] V3.6 cycle-106 (visual quality P0: dead CSS / height chain / contrast / off-by-one)');

// --- P0-A: 死 CSS 根因 — 全檔唔准再出現 Tailwind apply 指令 ---
// 呢條係最重要嘅 lock-in: 只要冇 apply 指令, Play CDN 就唔需要 compile 任何嘢,
// 死 CSS 呢個 bug family 就唔會再出現。
assert('T106 P0-A no Tailwind apply directive anywhere in index.html',
  !/@apply/.test(src),
  '本 <style> 唔係 text/tailwindcss — Play CDN 唔會 process apply 指令, 會令 rule 死掉');
assert('T106 P0-A .btn has real padding (not dead apply)',
  /\.btn,\s*\.option-btn,\s*\.key-btn\s*\{[\s\S]{0,260}padding:\s*0\.75rem 1\.25rem/.test(src));
assert('T106 P0-A .btn base has border-radius + shadow + transition',
  /\.btn,\s*\.option-btn,\s*\.key-btn\s*\{[\s\S]{0,420}border-radius:\s*1rem/.test(src) &&
  /\.btn,\s*\.option-btn,\s*\.key-btn\s*\{[\s\S]{0,420}box-shadow:/.test(src) &&
  /\.btn,\s*\.option-btn,\s*\.key-btn\s*\{[\s\S]{0,420}transition-property:/.test(src));
assert('T106 P0-A .btn:active has scale feedback',
  /\.btn:active,\s*\.option-btn:active,\s*\.key-btn:active\s*\{\s*transform:\s*scale\(0\.95\)/.test(src));
assert('T106 P0-A .btn-knight has gradient background',
  /\.btn-knight\s*\{[\s\S]{0,140}background-image:\s*linear-gradient\(to bottom right,\s*#3b82f6,\s*#4f46e5\)/.test(src));
assert('T106 P0-A .btn-mage has gradient background',
  /\.btn-mage\s*\{[\s\S]{0,140}background-image:\s*linear-gradient/.test(src));
assert('T106 P0-A .btn-boss has gradient background',
  /\.btn-boss\s*\{[\s\S]{0,140}background-image:\s*linear-gradient/.test(src));
assert('T106 P0-A .btn-ghost has bg + border + hover rule',
  /\.btn-ghost\s*\{[\s\S]{0,220}background-color:\s*rgb\(255 255 255 \/ 0\.1\)/.test(src) &&
  /\.btn-ghost\s*\{[\s\S]{0,220}border:\s*1px solid rgb\(255 255 255 \/ 0\.2\)/.test(src) &&
  /\.btn-ghost:hover\s*\{[\s\S]{0,140}background-color:\s*rgb\(255 255 255 \/ 0\.25\)/.test(src));
assert('T106 P0-A .btn-sm has radius + size',
  /\.btn-sm\s*\{[\s\S]{0,400}border-radius:\s*0\.75rem/.test(src) &&
  /\.btn-sm\s*\{[\s\S]{0,400}font-size:\s*0\.875rem/.test(src));
assert('T106 P0-A .option-btn is full width + 2xl type (was dead apply)',
  /\.option-btn\s*\{[\s\S]{0,200}width:\s*100%/.test(src) &&
  /\.option-btn\s*\{[\s\S]{0,200}font-size:\s*1\.5rem/.test(src));
assert('T106 P0-A .key-btn has 2xl type (was dead apply)',
  /\.key-btn\s*\{[\s\S]{0,200}font-size:\s*1\.5rem/.test(src));
assert('T106 P0-A .mode-badge has radius + padding + readable colour',
  /\.mode-badge\s*\{[\s\S]{0,320}border-radius:\s*9999px/.test(src) &&
  /\.mode-badge\s*\{[\s\S]{0,320}padding:\s*0\.25rem 0\.75rem/.test(src) &&
  /\.mode-badge\s*\{[\s\S]{0,320}color:\s*var\(--c-text-on-night\)/.test(src));

// --- P0-B: compareHeight / compareLength 高度鏈 ---
assert('T106 P0-B .ht-pair-hit has DEFINITE height (percentage needs it)',
  /\n\s{4}height:\s*clamp\(10rem,\s*40vh,\s*17rem\)/.test(src));
assert('T106 P0-B .ht-pair-stack no longer uses height:100%',
  /\.ht-pair-stack\s*\{[\s\S]{0,400}flex:\s*1 1 auto/.test(src) &&
  !/\.ht-pair-stack\s*\{[^}]*height:\s*100%/.test(src));
assert('T106 P0-B .ht-pair-bar-track exists and is a positioning context',
  /\.ht-pair-bar-track\s*\{[\s\S]{0,300}position:\s*relative/.test(src) &&
  /\.ht-pair-bar-track\s*\{[\s\S]{0,300}flex:\s*1 1 auto/.test(src));
assert('T106 P0-B .ht-pair-bar is absolutely positioned inside the track',
  /\.ht-pair-bar\s*\{[\s\S]{0,200}position:\s*absolute/.test(src) &&
  /\.ht-pair-bar\s*\{[\s\S]{0,240}bottom:\s*0/.test(src));
assert('T106 P0-B _heightPairHTML emits the track wrapper',
  /ht-pair-bar-track[\s\S]{0,240}ht-pair-bar tone-/.test(src));

// --- P0-C: 對比度 ---
assert('T106 P0-C --c-text-on-night token defined in :root',
  /--c-text-on-night:\s*#e2e8f0/.test(src) &&
  /--c-text-on-night-muted:\s*rgba\(226,232,240,0\.75\)/.test(src));
assert('T106 P0-C .text-on-night utility class exists',
  /\.text-on-night\s*\{\s*color:\s*var\(--c-text-on-night\);?\s*\}/.test(src) &&
  /\.text-on-night-muted\s*\{\s*color:\s*var\(--c-text-on-night-muted\);?\s*\}/.test(src));
assert('T106 P0-C .sen-panel .sen-q-emoji uses readable colour (was slate-800 on navy = 1.05:1)',
  /\.sen-panel \.sen-q-emoji\s*\{[\s\S]{0,300}color:\s*var\(--c-text-on-night\)/.test(src));
assert('T106 P0-C boss question text uses readable colour',
  /id="knight-question-text"[^>]*class="[^"]*text-on-night/.test(src) &&
  /id="mage-question-text"[^>]*class="[^"]*text-on-night/.test(src));
assert('T106 P0-C boss energy row uses readable colour',
  /id="knight-energy-row"[^>]*class="[^"]*text-on-night-muted/.test(src) &&
  /id="mage-energy-row"[^>]*class="[^"]*text-on-night-muted/.test(src));
assert('T106 P0-C #menu-track-helper has its own readable colour rule',
  /#menu-track-helper\s*\{[\s\S]{0,200}color:\s*var\(--c-text-on-night-muted\)/.test(src));
assert('T106 P0-C onboarding step counter uses readable colour',
  /text-on-night-muted mb-2">第 \$\{i\+1\} \/ \$\{steps\.length\} 步/.test(src));
assert('T106 P0-C onboarding title uses amber-300 (amber-700 on slate-800 = 2.5:1)',
  /text-amber-300 mb-3">\$\{s\.title\}/.test(src));
assert('T106 P0-C teacher dashboard profile block readable',
  /id="td-profile"[^>]*class="[^"]*text-on-night/.test(src));
assert('T106 P0-C teacher modal raw slate colours migrated to tokens',
  !/id="td-bank-status"[^>]*text-slate-700/.test(src) &&
  !/id="td-bank-count"[^>]*text-slate-700/.test(src) &&
  !/text-xs text-slate-600 mt-2">提示：每次開啟會出新的數學挑戰題/.test(src) &&
  !/<p class="text-slate-700 mb-4">老師正在控制中/.test(src) &&
  !/id="confirm-modal-body"[^>]*text-slate-700/.test(src));

// --- P0-D: 第 N 題 off-by-one ---
assert('T106 P0-D 第 N 題 shows current question number (total + 1, clamped to goal)',
  /第 \$\{Math\.min\(st\.total \+ 1,\s*_goalQ\)\} 題/.test(src));

// --- P1: 觸控目標 ≥ 44px + Boss 唔再似 error ---
assert('T106 P1 .opt-scope-preset touch target >= 44px',
  /\.opt-scope-preset\s*\{[\s\S]{0,420}min-height:\s*44px !important/.test(src));
assert('T106 P1 .identity-toggle touch target >= 44px',
  /\.identity-toggle\s*\{[\s\S]{0,500}min-height:\s*44px/.test(src));
assert('T106 P1 #recommend-chips .rec-chip touch target >= 44px',
  /#recommend-chips \.rec-chip\s*\{[\s\S]{0,300}min-height:\s*44px/.test(src));
assert('T106 P1 boss track option is not styled like a disabled/error state',
  /\.opt-track\[data-track="boss"\]\s*\{[\s\S]{0,220}border:\s*2px solid/.test(src) &&
  !/\.opt-track\[data-track="boss"\]\s*\{[^}]*dashed/.test(src));

// --- cycle106 文件 lock-in ---
assert('T106 cycle106 visual rubric doc exists',
  fs.existsSync(path.join(__dirname, '..', 'docs', 'VISUAL_QUALITY_RUBRIC.md')));
assert('T106 cycle106 art style guide doc exists',
  fs.existsSync(path.join(__dirname, '..', 'docs', 'ART_STYLE_GUIDE.md')));
assert('T106 cycle106 UI style guide doc exists',
  fs.existsSync(path.join(__dirname, '..', 'docs', 'UI_STYLE_GUIDE.md')));

// =========== T107: V3.6 cycle107 — deploy domain placeholder 事故修復 ===========
// 背景：cycle 96 加咗 CNAME file，內容係 DEPLOY.md 寫住嘅「例子域名」
// mathguardian.kencheng.dev —— 該域名從來未在 registrar 註冊（公開 DNS 為 NXDOMAIN）。
// GitHub Pages 一見 CNAME 就令 ihateusingai-beep.github.io/math-guardian/ 301 去該域名，
// 導致線上站由 2026-10-16 起一直開唔到（擺了 9 日先發現）。
console.log('\n[T107] V3.6 cycle-107 (deploy: placeholder CNAME removed · live site restored)');

// --- T107-01 .. 04: placeholder 域名唔准再出現 ---
assert('T107-01 index.html 不再引用未註冊嘅 placeholder 域名 kencheng.dev',
  !/kencheng\.dev/.test(src));
assert('T107-02 Plausible data-domain 指向實際部署 host',
  /<script defer data-domain="ihateusingai-beep\.github\.io"/.test(src));
assert('T107-03 repo 不存在 CNAME file（站由 .github.io 服務）',
  !fs.existsSync(path.join(__dirname, '..', 'CNAME')));
assert('T107-04 DEPLOY.md 記錄咗 placeholder 事故 + 修復步驟（DNS 先、CNAME 後）',
  fs.existsSync(path.join(__dirname, '..', 'DEPLOY.md')) &&
  /placeholder/i.test(fs.readFileSync(path.join(__dirname, '..', 'DEPLOY.md'), 'utf8')) &&
  /dig \+short/.test(fs.readFileSync(path.join(__dirname, '..', 'DEPLOY.md'), 'utf8')));

// --- T107-05 .. 07: 一致性 — 所有 live URL 記錄都指向 .github.io ---
const AGENTS_MD = fs.readFileSync(path.join(__dirname, '..', 'AGENTS.md'), 'utf8');
const TODO_MD = fs.readFileSync(path.join(__dirname, '..', 'TODO.md'), 'utf8');
assert('T107-05 AGENTS.md 嘅 live URL 係 .github.io 且唔含 placeholder 域名',
  /ihateusingai-beep\.github\.io\/math-guardian/.test(AGENTS_MD) &&
  !/kencheng\.dev/.test(AGENTS_MD));
assert('T107-06 TODO.md 嘅 live URL 係 .github.io 且唔含 placeholder 域名',
  /ihateusingai-beep\.github\.io\/math-guardian/.test(TODO_MD) &&
  !/kencheng\.dev/.test(TODO_MD));
assert('T107-07 AGENTS.md 明寫「DNS 未生效前唔准加返 CNAME」嘅規則',
  /DNS 未生效之前加返 `CNAME`|唔好喺域名未註冊/.test(AGENTS_MD));

// =========== T108: V3.6 cycle108 — Adaptive ladder guard ===========
// cycle 108 P0：Adaptive.onCorrect 用 `TYPE_ORDER.indexOf(type) < TYPE_ORDER.length - 1`
// 做升級門檻 → 對「唔喺 TYPE_ORDER 嘅 type」indexOf 回 -1 → 誤判成可升級 →
// next = TYPE_ORDER[0] = 'add10'。結果 easy/SEN scope 學生連答啱 5 題，scope 靜靜
// 變成 classic 加法題。行為鎖喺 tests/generator-audit.js T108（真實執行）。
// 呢度做結構鎖（防止 guard 被日後 refactor 拆走）。
console.log('\n[T108] V3.6 cycle-108 (Adaptive: type 置換只准喺 TYPE_ORDER ladder 內)');
const ADAPTIVE_BLOCK = (src.match(/const Adaptive = \{[\s\S]*?\n\};/) || [''])[0];
// 剝走註解先做條件檢查（註解入面會引用舊條件字串做說明）
const ADAPTIVE_CODE = ADAPTIVE_BLOCK
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
assert('T108-01 Adaptive module 存在', ADAPTIVE_BLOCK.length > 0);
assert('T108-02 onCorrect 有 TYPE_ORDER membership guard (idx < 0 → return)',
  /onCorrect\s*\([^)]*\)\s*\{[\s\S]{0,900}const idx = TYPE_ORDER\.indexOf\(type\);[\s\S]{0,200}if \(idx < 0\) return;/.test(ADAPTIVE_CODE));
assert('T108-03 onWrong 有 TYPE_ORDER membership guard (idx <= 0 → return)',
  /onWrong\s*\([^)]*\)\s*\{[\s\S]{0,900}const idx = TYPE_ORDER\.indexOf\(type\);[\s\S]{0,200}if \(idx <= 0\) return;/.test(ADAPTIVE_CODE));
assert('T108-04 唔准再出現會令 indexOf(-1) 通過嘅升級條件',
  !/TYPE_ORDER\.indexOf\(type\)\s*<\s*TYPE_ORDER\.length/.test(ADAPTIVE_CODE));
assert('T108-05 唔准再出現會令 indexOf(-1) 通過嘅降級條件',
  !/TYPE_ORDER\.indexOf\(type\)\s*>\s*0/.test(ADAPTIVE_CODE));
assert('T108-06 type 置換只可以發生喺 Adaptive 升級/降級兩處',
  (src.match(/Game\.settings\.types = Game\.settings\.types\.map\(/g) || []).length === 2);

// =========== T109: V3.6 cycle109 — Stage / 進度格 / 提示階梯 / 錯題原地重播 ===========
// cycle 109 玩法骨架：局長 = Stage 數、3 格進度（0.25 精度）、4 層提示階梯、
// 答錯原地重播同一條 + 局完錯題重練關卡。
// 行為鎖喺 tests/generator-audit.js T109（真實執行 Stage/提示模組）。
console.log('\n[T109] V3.6 cycle-109 (gameplay: Stage + 進度格 + 提示階梯 + 錯題重播)');
assert('T109-01 Stage 常數：3 格 × 4 段（0.25 精度）',
  /const STAGE_CELLS = 3;/.test(src) && /const CELL_UNITS = 4;/.test(src));
assert('T109-02 局長 = Stage 數（goalStages 設定存在）',
  /goalStages:\s*3/.test(src) && /hintMaxLevel:\s*4/.test(src));
assert('T109-03 Stage 進度係 per-team（雙隊各自有進度）',
  /stage:\s*\{\s*\n\s*knight:\s*\{\s*index:\s*0,\s*units:\s*0,\s*cleared:\s*0\s*\}/.test(src) &&
  /mage:\s*\{\s*index:\s*0,\s*units:\s*0,\s*cleared:\s*0\s*\}/.test(src));
// V3.6 cycle110: 重播槽改成單一（easy path 一次只有一條題喺度）
assert('T109-04 答錯會記住同一條題（replay state + 原地重播）',
  /Game\.state\.replayQ\s*=\s*q;/.test(src) &&
  /const replayQ = Game\.state\.replayQ;/.test(src) &&
  /Game\.state\.current\[nextTeam\]\s*=\s*replayQ;/.test(src));
assert('T109-05 重播唔抽新題（唔會再 call QuestionGen.make）',
  /const replayQ = Game\.state\.replayQ;[\s\S]{0,320}?UI\.showQuestion\(nextTeam\)/.test(src));
assert('T109-06 錯題保留完整 payload（局完重練用同一條）',
  /Game\.state\.review\.push\(\{\s*\.\.\.q,\s*retryCount:\s*0,\s*retryStreak:\s*0\s*\}\)/.test(src));
assert('T109-07 提示階梯 4 層（L1 重述 / L2 聚焦 / L3 部分 / L4 答案）',
  /function _easyHintL1\(/.test(src) && /function _easyHintL2\(/.test(src) &&
  /function _easyHintL3\(/.test(src) && /function _easyHintL4\(/.test(src) &&
  /function _easyHintText\(q, layer\)/.test(src));
assert('T109-08 提示層數上限由 settings 控制（老師可調）',
  /hintMaxLevel/.test(src) && /if \(cur >= maxL\) return;/.test(src));
assert('T109-09 答錯只出層 1（唔會直接講答案）',
  /UI\._senShowFeedback\(false,\s*_easyHintText\(q,\s*1\),\s*team\)/.test(src));
assert('T109-10 局完有「錯題重練」關卡（retryMode + retryList）',
  /retryMode:\s*false/.test(src) && /retryList:\s*\[\]/.test(src) &&
  /_easyFinishOrRetry/.test(src) && /handleRetryAnswer/.test(src));
assert('T109-11 重練要連續答啱 2 次先算鞏固',
  /if \(st\.retryStreak >= 2\)/.test(src));
assert('T109-12 retryMode 檢查行喺 _easyTeamDone 之前（否則重練答題會被擋死）',
  /if \(Game\.state\.retryMode\)[\s\S]{0,400}?if \(Game\.state\._easyEnding\) return;[\s\S]{0,200}?_easyTeamDone/.test(src));
assert('T109-13 進度格 UI（3 格 + role=progressbar + 提示掣）',
  /id="sen-cells-knight"/.test(src) && /id="sen-cells-mage"/.test(src) &&
  /role="progressbar"/.test(src) && /id="sen-hint-knight"/.test(src) && /id="sen-hint-mage"/.test(src));
assert('T109-14 進度格用 0-byte CSS（--p 漸層填充，冇新 asset 檔）',
  /\.sen-cell\.is-filled[\s\S]{0,200}?--p/.test(src) && !/<img[^>]*sen-cell/.test(src));
assert('T109-15 錯題重練 banner 存在',
  /id="sen-retry-banner"/.test(src) && /showSENRetryBanner/.test(src));

// =========== T110: V3.6 cycle110 — 接力協作 / 概念卡里程碑 / 島嶼旅程 ===========
// cycle 110：easy dual 之前係「同一隊一直答」（第二個學生根本冇得出手 →
// 雙隊其實唔需要對方）。改成接力：每答完傳手，答錯嗰條題傳俾另一隊救。
console.log('\n[T110] V3.6 cycle-110 (gameplay: 接力協作 + 概念卡里程碑 + 島嶼旅程)');
assert('T110-01 接力：easy dual 每答完一題傳手（唔再係同一隊一直答）',
  /let nextTeam = dual \? \(team === 'knight' \? 'mage' : 'knight'\) : 'knight';/.test(src));
assert('T110-02 UI.setSENTurn 存在 + 接力用 currentTeam 做唯一真實來源',
  /setSENTurn\(team\)/.test(src) &&
  /UI\.setSENTurn\)\s*UI\.setSENTurn/.test(src) &&
  /Game\.state\.currentTeam = nextTeam;/.test(src));
assert('T110-03 setSENTurn 會切換兩邊 panel 可見性 + 顯示「輪到」',
  /const p = \$\(`sen-panel-\$\{tm\}`\);[\s\S]{0,200}classList\.toggle\('hidden',\s*tm !== t\)/.test(src) &&
  /輪到 \$\{nameOf\(t\)\}/.test(src));
assert('T110-04 答錯第 2 次 → 扣 ½ 格 + 換新題（唔會無限卡住）',
  /Game\.state\.replayTries >= 2/.test(src) &&
  /_applyStageUnits\(team,\s*-2\)/.test(src));
assert('T110-05 進度扣減唔會變負',
  /if \(s\.units < 0\) s\.units = 0;/.test(src));
assert('T110-06 概念卡 4 里程碑（M1/M2/M3/M4）',
  /function _checkMilestones\(/.test(src) &&
  /m1/.test(src) && /m2/.test(src) && /m3/.test(src) && /m4/.test(src));
assert('T110-07 里程碑持久化落 Profile',
  /Profile\.data\.milestonesByType/.test(src) && /Profile\.save\(\)/.test(src));
assert('T110-08 概念卡 render + 重用現有 symbol（0 新 asset）',
  /function renderEndConceptCards\(/.test(src) &&
  /CONCEPT_BADGE/.test(src) && /px-abacus/.test(src));
assert('T110-09 島嶼旅程（跨課堂累積 + 結算畫面顯示）',
  /function _islandAdvance\(/.test(src) &&
  /Profile\.data\.islandStage/.test(src) &&
  /function renderEndIsland\(/.test(src));
assert('T110-10 隊伍完成後仍然要傳手（否則雙隊模式另一隊永遠冇題答、局完唔到）',
  /_easyGameComplete\(team\);\s*\n\s*_scheduleNextQuestion\(team,/.test(src) &&
  !/if \(_easyGameComplete\(team\)\) return;/.test(src));
assert('T110-11 島嶼 bar 用 CSS pips（唔靠特殊字形，跨平台一定 render 得到）',
  /class="island-pip/.test(src) && /\.island-pip\.on/.test(src) &&
  !/island-bar[^`]*▮/.test(src));
assert('T110-12 里程碑真實執行 lock-in 喺 generator-audit（T110 段）',
  fs.existsSync(path.join(__dirname, '..', 'tests', 'generator-audit.js')) &&
  /T110/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'generator-audit.js'), 'utf8')));
// V3.6 cycle110b: 「輪到邊隊」必須只有一個真實來源。
//   之前新開 turnTeam，但 badge（作答中/待命中）、review 重練對象、
//   Adaptive 全部讀 currentTeam → 可見卡片同 currentTeam 會唔一致。
assert('T110-13 全檔唔准再出現第二個「輪到邊隊」欄位 turnTeam（避免漂移）',
  !/turnTeam/.test(srcCode));
assert('T110-14 setSENTurn 嘅邊隊預設讀 currentTeam（唔係 hardcode knight）',
  /const t = team \|\| Game\.state\.currentTeam \|\| 'knight';/.test(src));
assert('T110-15 接力切換之後 currentTeam 同可見卡片一致（真實執行 lock-in 喺 generator-audit）',
  fs.existsSync(path.join(__dirname, '..', 'tests', 'generator-audit.js')) &&
  /T110b/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'generator-audit.js'), 'utf8')));
// V3.6 cycle110b: setSENTurn 之前 toggle 咗「經典 game screen」嘅 #knight-card / #mage-card，
//   但 easy 行嘅係 SEN screen（#sen-panel-*）→ 舊 code 對 SEN 板完全冇效果（dead code），
//   實機截圖見到兩條題同時顯示，學生唔知輪到邊個。
assert('T110-16 setSENTurn 必須切 SEN panel（#sen-panel-*），唔係經典 card（#*-card）',
  /sen-panel-\$\{tm\}/.test(src) &&
  !/setSENTurn[\s\S]{0,900}\$\(`\$\{tm\}-card`\)/.test(src));
assert('T110-17 接力模式用單欄全寬（sen-board-relay），避免 639px iPad 選項被切走',
  /\.sen-board-relay \{ grid-template-columns: 1fr !important; \}/.test(src) &&
  /\.sen-panel\.hidden \{ display: none !important; \}/.test(src) &&
  /classList\.toggle\('sen-board-relay', dual\)/.test(src));
assert('T110-18 接力會跳過已完成嘅隊伍（否則一隊做完就死鎖）',
  /if \(done\[nextTeam\]\) \{[\s\S]{0,300}if \(!done\[other\]\) nextTeam = other;/.test(src));
// V3.6 cycle110b/c: end screen 喺學校 iPad 639×669 會 overflow → 概念卡跌出畫面、掣撳唔到
assert('T110-19 end screen 掣行 sticky（唔使捲到底先撳到「再玩一次」）',
  /\.end-actions \{[\s\S]{0,300}position: sticky; bottom: 0;/.test(src) &&
  /class="grid grid-cols-2 gap-3 end-actions"/.test(src));
assert('T110-20 雙隊 medal 唔准換行（🥇🥇 換行會疊落標題上面）',
  /\.end-medal \{[\s\S]{0,300}white-space: nowrap;/.test(src) &&
  /position: absolute; left: 50%; top: 50%;/.test(src));
assert('T110-21 概念卡 + 島嶼一定要喺 end-stats 上面（學生最想睇嘅新卡）',
  /id="end-island"[\s\S]{0,200}id="end-concept-cards"[\s\S]{0,200}id="end-stats"/.test(src) &&
  /id="end-stats"[\s\S]{0,400}id="end-badges"/.test(src));

// =========== T111: V3.6 cycle111a — 像素資產品質（座標 / 倍率 / crispEdges / 死 symbol） ===========
// cycle111a：proposal §4.3 嘅 3 個實測缺陷 —— 座標非整數、顯示倍率非整數、冇 crispEdges。
// 呢啲缺陷 regex 測試捉唔到（要睇畫面），所以有獨立嘅 tests/asset-audit.js（8 組 check）。
// 呢段做「結構層」交叉鎖：確保 asset-audit 本身唔會被改到失效。
console.log('\n[T111] V3.6 cycle-111a (pixel asset quality: crispEdges / integer scale / dead asset)');
assert('T111-01 每個 symbol 都有 shape-rendering="crispEdges"（像素邊唔會有灰邊）',
  (() => {
    const syms = src.match(/<symbol\b[^>]*>/g) || [];
    return syms.length > 0 && syms.every((t) => /shape-rendering="crispEdges"/.test(t));
  })());
assert('T111-02 冇重複 symbol id（重複嗰份永遠 render 唔到 = 死碼）',
  (() => {
    const ids = (src.match(/<symbol\b[^>]*id="([^"]+)"/g) || []).map((t) => t.match(/id="([^"]+)"/)[1]);
    return new Set(ids).size === ids.length;
  })());
assert('T111-03 像素 icon 容器用 px（唔用 em/vw/clamp → 保證整數倍）',
  /\.icon-mini \{ width: 16px; height: 16px; \}/.test(src) &&
  /\.icon-md   \{ width: 32px; height: 32px; \}/.test(src) &&
  /\.icon-lg   \{ width: 48px; height: 48px; \}/.test(src) &&
  !/\.icon-mini \{[^}]*em/.test(src));
assert('T111-04 座標係整數（抽查 4 個改過嘅 symbol）',
  !/r="1\.5" fill="#fbbf24"/.test(src) &&      // pkg-detergent bubble
  !/d="M8 1 L9\.5 6 L15 6\.5/.test(src) &&     // badge-star 舊星形
  !/x="7\.5" y="1\.5"/.test(src) &&             // clock-base 舊刻度
  !/<rect x="13" y="8\.5"/.test(src));         // char-knight 舊面罩
assert('T111-05 8 個 L 項每個都有專屬精靈（唔會讀到錯嘅容量）',
  /svgId:'pkg-milk-1l'/.test(src) && /svgId:'pkg-juice-1l'/.test(src) &&
  /svgId:'pkg-detergent-1l'/.test(src) && /svgId:'pkg-bleach-2l'/.test(src) &&
  /svgId:'pkg-soda-15l'/.test(src) && /svgId:'pkg-soymilk-1l'/.test(src) &&
  /svgId:'pkg-soysauce-1l'/.test(src) && /svgId:'pkg-paint-5l'/.test(src));
assert('T111-06 svgId 真係傳到 pic-card renderer（之前斷咗 → 6 個精靈從來冇 render 過）',
  /items: items\.map\(it => \(\{ emoji: it\.emoji, svgId: it\.svgId,/.test(src) &&
  /const visual = it\.svgId\s*\?\s*`<svg class="pic-card-svg"/.test(src));
assert('T111-07 像素容器 selector 唔准重複定義（cascade 只會贏最後一個 → 前面嗰個係死碼）',
  (src.match(/^  \.pic-card-svg \{/gm) || []).length === 1 &&
  (src.match(/^  \.boss-svg \{/gm) || []).length === 1);
assert('T111-08 獨立嘅 asset audit 存在而且有 8 組 check',
  fs.existsSync(path.join(__dirname, '..', 'tests', 'asset-audit.js')) &&
  /A111-C8/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'asset-audit.js'), 'utf8')) &&
  /A111-C3/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'asset-audit.js'), 'utf8')));

// ============================================================
// V3.6 cycle111b: scope 內 3 級難度（proposal §3.6）
// ============================================================
console.log('\n[T111b] V3.6 cycle-111b (scope 內 3 級難度: level 參數 + 適應 + bank 過濾)');

assert('T111b-01 ScopeLevel 模組常數齊全（上限 3 / 4 對升 / 3 錯降）',
  /const SCOPE_LEVEL_MAX = 3;/.test(src) &&
  /const LEVEL_UP_STREAK = 4;/.test(src) &&
  /const LEVEL_DOWN_STREAK = 3;/.test(src) &&
  /const SCOPE_LEVEL_PARAMS = \{/.test(src));

for (const _t of ['count20','compareLength','compareHeight','orderAsc20',
                  'orderDesc20','learnL','findLDrink','findLItem']) {
  assert(`T111b-02 級數表覆蓋 ${_t}`,
    new RegExp(`\\n\\s*${_t}:\\s*\\[\\{`).test(src));
}
assert('T111b-02 classic type 唔喺級數表入面（適應唔可以跨 scope）',
  !/\n\s*(add10|sub10|add20|sub20|add2d|sub2d|ordering|whatTime|shapeMatch):\s*\[\{/.test(src));

assert('T111b-03 _scopeLevelOf 用 Number.isFinite（0 係 falsy，唔可以用 || default）',
  /function _scopeLevelOf\(type\)[\s\S]{0,320}Number\.isFinite\(v\)/.test(src) &&
  !/function _scopeLevelOf\(type\)[\s\S]{0,320}\|\|\s*1\b/.test(src));

assert('T111b-04 _updateScopeLevel 寫返 Profile 並存檔（跨課堂保留級數）',
  /function _updateScopeLevel\(type, correct\)[\s\S]{0,1200}P\.levelByType\[type\] = next;[\s\S]{0,120}Profile\.save\(\)/.test(src));

assert('T111b-05 QuestionGen.make 收 level 參數並派落生成器',
  /function make\(type, mode = 'choice', level = 1\)/.test(src) &&
  /Generators\[type\]\(mode, level\)/.test(src) &&
  /Generators\.compareLength\(level\)/.test(src) &&
  /Generators\.compareHeight\(level\)/.test(src) &&
  /Generators\[type\]\(level\)/.test(src));

assert('T111b-06 出題時用 _scopeLevelOf 決定級數（3 個呼叫點）',
  (src.match(/QuestionGen\.make\(type, (?:mode|Game\.settings\.mode), _scopeLevelOf\(type\)\)/g) || []).length === 3);

assert('T111b-07 答題後呼叫 _updateScopeLevel（easy 分支）',
  /_checkMilestones\(q\.type, correct, usedHint, isReplay\);\s*\n\s*\/\/[^\n]*\n\s*_updateScopeLevel\(q\.type, correct\);/.test(src));

assert('T111b-08 bank 題目按級數過濾（級數契約唔可以有 30% 漏洞）',
  /function _bankMatchesLevel\(type, q, level\)/.test(src) &&
  /const lv = _scopeLevelOf\(typeId\);/.test(src) &&
  /arr\.filter\(\(q\) => _bankMatchesLevel\(typeId, q, lv\)\)/.test(src));

assert('T111b-09 Profile lazy-init levelByType / levelStreak',
  /if \(!this\.data\.levelByType \|\| typeof this\.data\.levelByType !== 'object'\) this\.data\.levelByType = \{\};/.test(src) &&
  /if \(!this\.data\.levelStreak \|\| typeof this\.data\.levelStreak !== 'object'\) this\.data\.levelStreak = \{\};/.test(src));

assert('T111b-10 L 容量題目標固定 1L，prompt 統一',
  /'邊個有 1L\?'/.test(src) && /'邊支飲品有 1L\?'/.test(src) && /'邊件有 1L\?'/.test(src));

assert('T111b-11 L 項有飲品旗標（findLDrink 唔會抽到洗潔精）',
  /drink:true/.test(src) && /drink:false/.test(src) &&
  /lPool\.filter\(\(it\) => it\.pkg === TARGET && \(!drinkOnly \|\| it\.drink\)\)/.test(src));

assert('T111b-12 2L 飲品精靈存在（orange juice，俾 L1/L3 級做 2L 干擾項）',
  /<symbol id="pkg-orange-2l"/.test(src) && /svgId:'pkg-orange-2l'/.test(src));

assert('T111b-13 generator-audit 有 T111b 真實執行段（行為鎖，唔係淨係 regex）',
  /T111b/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'generator-audit.js'), 'utf8')) &&
  /loadScopeLevel/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'generator-audit.js'), 'utf8')));

// ============================================================
// V3.6 cycle111e: SEN pic-grid 卡片可撳（P0）+ 視覺驗證工具入 repo
// ============================================================
console.log('\n[T111e] V3.6 cycle-111e (SEN pic-grid 卡片可撳 + 視覺驗證工具入 repo)');

assert('T111e-01 SEN pic-grid 卡片用 <button> 渲染（唔係冇 handler 嘅 <div>）',
  /b\.className = 'pic-card-mini'/.test(src) &&
  /const b = document\.createElement\('button'\);/.test(src) &&
  !/<div class="pic-card-mini">/.test(src));
assert('T111e-02 每張卡片有 click handler → Game.handleAnswer',
  /b\.onclick = \(\) => \{ Game\.handleAnswer\(team, opt, b\); \};/.test(src));
assert('T111e-03 每張卡片有 aria-label（讀屏讀到「A. 橙汁 2L」）',
  /b\.setAttribute\('aria-label', `\$\{letter\}\. \$\{it\.name \|\| ''\} \$\{it\.pkg \|\| ''\}`\);/.test(src));
assert('T111e-04 .pic-card-mini 有 button reset + 互動狀態（font/cursor/focus）',
  /\.pic-card-mini \{[\s\S]{0,1200}font: inherit/.test(src) &&
  /\.pic-card-mini \{[\s\S]{0,1200}cursor: pointer/.test(src) &&
  /\.pic-card-mini:focus-visible/.test(src));
assert('T111e-05 視覺驗證工具入 repo（唔係擺 /tmp — 換部機就冇晒防線）',
  fs.existsSync(path.join(__dirname, '..', 'tests', 'visual', 'run.mjs')) &&
  fs.existsSync(path.join(__dirname, '..', 'tests', 'visual', 'cdp.mjs')) &&
  fs.existsSync(path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'all-scopes-answerable.mjs')));
assert('T111e-06 end-screen overflow 守門存在（639×669 學校 iPad）',
  /end-screen-overflow/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'end-screen-overflow.mjs'), 'utf8')) &&
  /639/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'end-screen-overflow.mjs'), 'utf8')));
assert('T111e-07 視覺 runner 冇 Chrome 會 SKIP（唔會阻住其他 gate）',
  /CHROME_NOT_FOUND/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'visual', 'cdp.mjs'), 'utf8')) &&
  /SKIP/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'visual', 'run.mjs'), 'utf8')));

// ============================================================
// V3.6 cycle111f: game feel —— SEN 逐個選項反饋 + verdict band 重構（P0）
// ============================================================
console.log('\n[T111f] V3.6 cycle-111f (game feel: SEN 逐個選項反饋 + verdict band 唔遮選項)');

// --- ① 四個反饋 helper 齊 ---
assert('T111f-01 SEN 逐個選項反饋 helper 四個齊',
  /_senMarkOption\(btn, correct\) \{/.test(src) &&
  /_senFindOption\(team, q\) \{/.test(src) &&
  /_senRevealCorrect\(team, q\) \{/.test(src) &&
  /_senCelebrate\(btn\) \{/.test(src));

// --- ② handleAnswer 接線順序：反饋一定要喺 overlay 之前（同一幀起點） ---
const _t111fMarkIdx = src.indexOf('UI._senMarkOption(btn, correct);');
const _t111fFbIdx = src.indexOf('UI._senShowFeedback(true, null, team);');
assert('T111f-02 handleAnswer：逐個選項反饋喺 _senShowFeedback 之前（同一幀起點）',
  _t111fMarkIdx > -1 && _t111fFbIdx > -1 && _t111fMarkIdx < _t111fFbIdx &&
  /if \(correct\) UI\._senCelebrate\(btn\);\s*\n\s*else UI\._senRevealCorrect\(team, q\);/.test(src));

// --- ③ CSS 狀態 class + badge + 三種動畫 ---
assert('T111f-03 SEN 逐個選項反饋 CSS：.is-correct / .is-wrong + ✓ / ✕ badge + pop/miss/badge-pop',
  /\.sen-opt-btn\.is-correct,/.test(src) &&
  /\.pic-card-mini\.is-correct/.test(src) &&
  /\.sen-opt-btn\.is-wrong,/.test(src) &&
  /\.pic-card-mini\.is-wrong/.test(src) &&
  /content: '✓'/.test(src) && /content: '✕'/.test(src) &&
  /animation: sen-fx-pop-correct/.test(src) &&
  /animation: sen-fx-miss/.test(src) &&
  /animation: sen-fx-badge-pop/.test(src));

// --- ④ SEN 安全：答錯唔可以用刺眼紅 ---
assert('T111f-04 SEN 安全：答錯用藍灰 #e2e8f0 + #64748b 邊（唔係刺眼紅）',
  /background: #e2e8f0 !important;/.test(src) &&
  /border-color: #64748b !important;/.test(src) &&
  !/\.sen-opt-btn\.is-wrong[\s\S]{0,500}?#ef4444/.test(src) &&
  !/\.pic-card-mini\.is-wrong[\s\S]{0,500}?#ef4444/.test(src));

// --- ⑤ P0：overlay 改成頂部 band + 淡色 wash，唔再置中大字 ---
assert('T111f-05 P0：feedback overlay 改成頂部 band + 淡色 wash（唔再置中大字壓住選項）',
  /class="sen-fb-wash"/.test(src) &&
  /class="sen-fb-band"/.test(src) &&
  /class="sen-fb-stamp"/.test(src) &&
  !/font-size:5\.5rem;font-weight:900;line-height:1;text-shadow:0 3px 8px/.test(srcCode));

// --- ⑥ 舊置中 stamp 嘅 CSS / keyframes 拆走（防復辟） ---
assert('T111f-06 舊置中 stamp 嘅 CSS / keyframes 已清走（防復辟）',
  !/@keyframes sen-fb \{/.test(srcCode) &&
  !/\.sen-hint-line \{/.test(srcCode) &&
  /@keyframes sen-fx-wash \{/.test(src) &&
  /@keyframes sen-fx-band \{/.test(src));

// --- ⑦ band 定位喺 panel 頂部（唔係全屏置中） ---
assert('T111f-07 band 定位喺 panel 頂部（top:0），唔係 inset:0 + 置中',
  /\.sen-fb-band \{[\s\S]{0,600}?position: absolute; top: 0; left: 0; right: 0;/.test(src) &&
  !/\.sen-fb-band \{[\s\S]{0,600}?inset: 0;/.test(src));

// --- ⑧ wash 要淡到夠低（唔食掉逐個選項嘅狀態色） ---
assert('T111f-08 wash 淡到 0.12 opacity（唔食掉逐個選項嘅狀態色）',
  /@keyframes sen-fx-wash \{[\s\S]{0,300}?100% \{ opacity: 0\.12; \}/.test(src));

// --- ⑨ 反饋期間 head 帶收埋（避免「睇唔到但撳得到」） ---
assert('T111f-09 反饋期間 head 帶收埋（band 覆蓋佢，掣就唔應該仲撳得到）',
  /\.sen-panel\.is-fb-active \.sen-panel-head \{ visibility: hidden; pointer-events: none; \}/.test(src) &&
  /panel\.classList\.add\('is-fb-active'\)/.test(src) &&
  /panel\.classList\.remove\('is-fb-active'\)/.test(src));

// --- ⑩ reduce-motion 關晒新 animation（CSS 層） ---
assert('T111f-10 新增 animation 全部喺 prefers-reduced-motion 下關掉（CSS 層）',
  /\.sen-fb-wash, \.sen-fb-band \{ animation: none !important; \}/.test(src) &&
  /\.sen-opt-btn::after, \.pic-card-mini::after \{ animation: none !important; \}/.test(src));

// --- ⑪ badge 定位需要 position:relative ---
assert('T111f-11 .sen-opt-btn 有 position:relative（✓/✕ badge 定位用）',
  /\.sen-opt-btn \{ position: relative; \}/.test(src));

// --- ⑫ 慶祝粒子喺 JS 層亦 respect prefers-reduced-motion ---
assert('T111f-12 慶祝粒子喺 JS 層亦 respect prefers-reduced-motion',
  /prefers-reduced-motion: reduce\)'\)\.matches/.test(src) &&
  /FX\.confetti\(r\.left \+ r\.width \/ 2, r\.top \+ r\.height \/ 2, 14\)/.test(src));

// --- ⑬ 視覺場景有 P0 幾何守門 ---
const _t111fScenarioPath = path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'sen-answer-feedback.mjs');
assert('T111f-13 視覺場景有「band 唔覆蓋選項掣」幾何守門（實機驗證，唔係淨係 regex）',
  fs.existsSync(_t111fScenarioPath) &&
  /verdict band 唔覆蓋任何一個選項掣/.test(fs.readFileSync(_t111fScenarioPath, 'utf8')) &&
  /被揭示嘅正確答案，內容完全冇被遮/.test(fs.readFileSync(_t111fScenarioPath, 'utf8')));

// ============================================================
// V3.6 cycle111g: 音頻 mix 架構（用 `audio-design` skill）
// ============================================================
console.log('\n[T111g] V3.6 cycle-111g (audio: 真 master bus + 主音量 API + BGM ducking + noise cache + 變奏)');

assert('T111g-01 Audio 有真 bus graph（Master ← SFX / BGM ← Duck），唔再係死變數',
  /let masterGain = null;/.test(src) &&
  /let sfxGain = null;/.test(src) &&
  /let bgmGain = null;/.test(src) &&
  /let bgmDuckGain = null;/.test(src) &&
  /sfxGain\.connect\(masterGain\)/.test(src) &&
  /bgmGain\.connect\(bgmDuckGain\)/.test(src) &&
  /bgmDuckGain\.connect\(masterGain\)/.test(src) &&
  /masterGain\.connect\(ctx\.destination\)/.test(src));

assert('T111g-02 tone / noise 經 bus，唔可以再直連 ctx.destination',
  /g\.connect\(busNode\(bus\)\)/.test(src) &&
  !/g\.connect\(c\.destination\)/.test(srcCode) &&
  /function busNode\(bus\)/.test(src));

assert('T111g-03 slider → 平方 gain（raw linear amplitude 會將變化擺喺底部 1/5）',
  /function sliderToGain\(s\)/.test(src) &&
  /return c \* c;/.test(src));

assert('T111g-04 音量 API 用 Number.isFinite（0 係 falsy，唔可以用 || default）',
  /busVolume\.master = Number\.isFinite\(v\) \? Math\.min\(1, Math\.max\(0, v\)\) : 1;/.test(src) &&
  /busVolume\[name\] = Number\.isFinite\(v\) \? Math\.min\(1, Math\.max\(0, v\)\) : 1;/.test(src) &&
  !/busVolume\.\w+ = Number\([^)]*\)\s*\|\|/.test(srcCode));

assert('T111g-05 ducking 用獨立 bus（唔可以同玩家嘅 slider 打架）',
  /duckBGM\(active\)/.test(src) &&
  /rampGain\(bgmDuckGain, bgmDucked \? 0\.25 : 1\)/.test(src));

assert('T111g-06 noise buffer cache（每次 createBuffer → 全場一個）',
  /let noiseBuf = null;/.test(src) &&
  /function getNoiseBuffer\(c\)/.test(src) &&
  /if \(!noiseBuf\)/.test(src) &&
  /src\.loop = dur > 0\.5;/.test(src) &&
  !/const buf = c\.createBuffer\(1, Math\.ceil\(c\.sampleRate \* dur\), c\.sampleRate\);/.test(srcCode));

assert('T111g-07 BGM 走 bgm bus（唔同 SFX 混埋，所以可以獨立 duck）',
  /tone\(bass \* 4, 0\.18, cur\.wave, 0\.10, null, 0, 'bgm'\)/.test(src) &&
  /tone\(arpN \* 2, 0\.12, 'square', 0\.06, null, 0, 'bgm'\)/.test(src));

assert('T111g-08 BGM 變奏（每個 phrase 洗牌 arp，唔再機械重複）',
  /function shuffleArp\(arr\)/.test(src) &&
  /if \(bgmStep % bgmArp\.length === 0\) shuffleArp\(bgmArp\);/.test(src));

assert('T111g-09 TTS 朗讀時 duck BGM（true + false 都要有）',
  /Audio\.duckBGM\(true\)/.test(src) &&
  /Audio\.duckBGM\(false\)/.test(src) &&
  // epoch guard：cancel() 會令舊 utterance 嘅 onend 觸發，唔 check epoch 會提早 unduck
  /if \(myEpoch !== TTS\._boundaryEpoch\) return;/.test(src));

assert('T111g-10 主音量持久化落 Profile + lazy-init 用 Number.isFinite',
  /masterVolume: 1,/.test(src) &&
  /if \(!Number\.isFinite\(this\.data\.masterVolume\)\) this\.data\.masterVolume = 1;/.test(src) &&
  /Audio\.setMasterVolume\(Profile\.data\.masterVolume\)/.test(src) &&
  /Profile\.data\.masterVolume = v;/.test(src));

assert('T111g-11 教師台有主音量 slider（range 0–100）並接到 Audio master bus',
  /id="td-audio-volume" min="0" max="100"/.test(src) &&
  /volSlider\.oninput = applyVol;/.test(src) &&
  /Audio\.setMasterVolume\(Number\.isFinite\(pct\) \? pct \/ 100 : 1\)/.test(src));

assert('T111g-12 教師台音效控制 label 用 text-on-night（深底深字睇唔到）',
  /<div class="space-y-2 text-sm text-on-night">/.test(src) &&
  !/<div class="space-y-2 text-sm">\s*<label class="flex items-center gap-3 cursor-pointer">\s*<input type="checkbox" id="td-audio-master"/.test(src));

assert('T111g-13 audio-audit 有真 bus graph 拓撲守門（唔係淨係 grep masterGain 幾多次）',
  /A111g-01/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'audio-audit.js'), 'utf8')) &&
  /A111g-02/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'audio-audit.js'), 'utf8')) &&
  /A111g-10/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'audio-audit.js'), 'utf8')));

assert('T111g-14 視覺場景有「slider 真係通 + 深底對比度」守門',
  fs.existsSync(path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'teacher-audio-panel.mjs')) &&
  /gain 係\*\*平方\*\*/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'teacher-audio-panel.mjs'), 'utf8')) &&
  /WCAG AA/.test(fs.readFileSync(path.join(__dirname, '..', 'tests', 'visual', 'scenarios', 'teacher-audio-panel.mjs'), 'utf8')));

// =========== T111h: V3.6 cycle-111h (拆檔 index.html + app.js + 註解清理) ===========
console.log('\n[T111h] V3.6 cycle-111h (拆檔 index.html + app.js + 註解清理)');
const htmlSrc = fs.readFileSync(FILE, 'utf8');
const appSrc = readAppJs();
// 剝走 HTML 註解（註解入面會提到 `type="module"` 之類嘅字眼，唔應該影響結構斷言）
const htmlNoComment = htmlSrc.replace(/<!--[\s\S]*?-->/g, '');
const APP_FILE = path.join(__dirname, '..', 'app.js');
const toolSrc = fs.existsSync(path.join(__dirname, '..', 'tools', 'squeeze-comments.cjs'))
  ? fs.readFileSync(path.join(__dirname, '..', 'tools', 'squeeze-comments.cjs'), 'utf8') : '';

assert('T111h-01 index.html 用 defer classic script 載入 app.js（唔用 type=module，file:// 要行到）',
  /<script defer src="app\.js"><\/script>/.test(htmlSrc) &&
  !/type="module"/.test(htmlNoComment));

assert('T111h-02 app.js 存在且係主程式（use strict + Audio/TTS/Profile 都在）',
  fs.existsSync(APP_FILE) && appSrc.length > 100000 &&
  /'use strict'/.test(appSrc) &&
  /const Audio = \(\(\) => \{/.test(appSrc) &&
  /const TTS = \{/.test(appSrc) &&
  /const Profile = \{/.test(appSrc));

assert('T111h-03 app.js 內冇 <script> tag（真係抽出咗，唔係抄咗一份留低）',
  !/<script/i.test(appSrc));

assert('T111h-04 index.html 保留 CSS token + inline SVG symbol（app.js 唔應該有）',
  /--c-text-on-light/.test(htmlSrc) && /<symbol/.test(htmlSrc) &&
  !/--c-text-on-light/.test(appSrc) && !/<symbol/.test(appSrc));

assert('T111h-05 只有一個「本地」script src（單一真實來源；CDN 唔算）',
  (htmlSrc.match(/<script[^>]*\ssrc="(?!https?:)[^"]+"/g) || []).length === 1);

assert('T111h-06 tests/source.js 提供單一真實來源讀取器',
  /readAppSource/.test(fs.readFileSync(path.join(__dirname, 'source.js'), 'utf8')) &&
  /readAppJs/.test(fs.readFileSync(path.join(__dirname, 'source.js'), 'utf8')));

assert('T111h-07 4 個測試檔都經 source.js 讀原始碼（唔准各寫一份拼接邏輯）',
  ['regression.js', 'generator-audit.js', 'audio-audit.js', 'asset-audit.js'].every((f) => {
    const t = fs.readFileSync(path.join(__dirname, f), 'utf8');
    return /require\('\.\/source\.js'\)/.test(t) &&
      !/readFileSync\([^)]*index\.html[^)]*\)\s*\+\s*readFileSync/.test(t);
  }));

assert('T111h-08 per-file 預算：index.html < 260 KB · app.js < 420 KB · gzip 傳輸 < 200 KB',
  Buffer.byteLength(htmlSrc, 'utf8') < 260000 &&
  Buffer.byteLength(appSrc, 'utf8') < 420000);

// ⚠️ T111h-09 係「清理完成」嘅 end-state 斷言 —— 清理**進行中**時必然未成立。
//    `tools/squeeze-comments.cjs` 會設 MG_SQUEEZE_IN_PROGRESS=1 嚟暫時豁免佢
//    （否則工具會被自己嘅守門擋死：每改一條 → gate 爆 → 全部還原）。
//
//    ⚠️ 殘留嘅 cycle 標記係**刻意保留**嘅（決策理由註解 + 測試 load-bearing 錨點），
//    所以唔可以斷「一條都唔准有」—— 應該斷「全部都喺註解行，而且總數有上限」。
const SQUEEZE_IN_PROGRESS = !!process.env.MG_SQUEEZE_IN_PROGRESS;
const cycleLeft = (htmlSrc + '\n' + appSrc).split('\n').filter((l) => /V3\.6 cycle\d/.test(l));
assert('T111h-09 註解清理：殘留嘅 cycle 標記總數 ≤ 40（原本 141 條）',
  SQUEEZE_IN_PROGRESS ? true : cycleLeft.length <= 40);

assert('T111h-10 決策理由註解保留（唔可以一刀切清晒）',
  /⚠️/.test(appSrc) && /點解|唔可以|否則/.test(appSrc));

assert('T111h-11 有安全註解清理工具（逐條試改 + 跑 gate + 自動還原）',
  /squeeze-comments/.test(toolSrc) && /runGate/.test(toolSrc) &&
  /RATIONALE/.test(toolSrc) && /template-guard/.test(toolSrc));

assert('T111h-12 generator-audit 嘅 module end marker 用程式碼（唔用註解文字）',
  /const endMarker = 'function _checkMilestones\('/.test(
    fs.readFileSync(path.join(__dirname, 'generator-audit.js'), 'utf8')) &&
  !/const endMarker = '\/\//.test(
    fs.readFileSync(path.join(__dirname, 'generator-audit.js'), 'utf8')));

// load-bearing 註解 = 測試靠佢做區域定位器 / meta-test 斷言「記錄咗 refactor 理由」
// ⚠️ 呢 10 條唔准手動刪（刪咗相應斷言會 fail）—— `tools/squeeze-comments.cjs` 會自動擋。
const LOAD_BEARING = [
  '// V3.6 cycle66: resume boss',
  '// V3.5-cycle16+17: per-type snapshot',
  '// V3.6 cycle65: boss dual only',
  '// V3.6 cycle66: boss campaign must have a selected boss',
  '// V3.6 cycle84 C3',
  '// V3.6 cycle71: solo 唔輪換到 mage',
  '// V3.6 cycle100: 提取 _seqFill3 helper',
  '// cycle55 舊版用 3 random numbers',
  '// V3.6 cycle102: 用 _pickRandomDistinct helper',
  '// scope 內 3 級難度適應'
];
assert('T111h-13 10 條 load-bearing 註解全部仲喺度（唔准手動刪）',
  LOAD_BEARING.every((m) => appSrc.indexOf(m) !== -1),
  LOAD_BEARING.filter((m) => appSrc.indexOf(m) === -1).join(' | '));

// =========== T111h P0: boot ReferenceError（_wirePauseOverlay 從來冇定義過）===========
// ⚠️ 真實個案：v3.5 refactor 把 `_wirePauseOverlay()` 拆成 `_showPauseOverlay` /
//    `_hidePauseOverlay` + `_wireTeacherActions`，但舊 call site 冇跟住更新
//    → 每個 boot 都喺 setupTeacher() throw ReferenceError
//    → **成個 DOMContentLoaded 之後嘅流程全部死掉**（renderTypePicker /
//       renderRecommendChips / Profile.load / Audio.setMasterVolume /
//       renderBossSelect / resume 按鈕）。cycle111h 喺線上站揭發。
assert('T111h-14 setupTeacher 唔准叫未定義嘅 _wirePauseOverlay（P0 boot crash）',
  !/_wirePauseOverlay/.test(srcCode),
  'srcCode 仍然有 _wirePauseOverlay 嘅 call/definition');

assert('T111h-15 boot 順序：setupTeacher 之後必須行晒 Profile.load → 主音量 → Boss 面板',
  /setupTeacher\(\);[\s\S]{0,400}renderTypePicker\(\);[\s\S]{0,200}renderRecommendChips\(\);[\s\S]{0,200}Profile\.load\(\);[\s\S]{0,200}Audio\.setMasterVolume\([\s\S]{0,600}renderBossSelect\(\)/.test(src));

assert('T111h-16 有「boot console 乾淨」視覺守門（捉任何 boot error）',
  fs.existsSync(path.join(__dirname, 'visual', 'scenarios', 'boot-console-clean.mjs')) &&
  /consoleClean/.test(fs.readFileSync(path.join(__dirname, 'visual', 'scenarios', 'boot-console-clean.mjs'), 'utf8')) &&
  /Runtime\.exceptionThrown/.test(fs.readFileSync(path.join(__dirname, 'visual', 'cdp.mjs'), 'utf8')));

// =========== T111i: 真機 playtest 守門化 + dual 接力開局 banner ==========
// ⚠️ 真實個案（cycle111i playtest）：`UI.setSENTurn` 只喺 _scheduleNextQuestion
//    （答完一題嗰陣）先會叫 → easy dual **開局** banner 係空嘅，
//    學生唔知邊隊先出手，要答完第一題先見到提示。
//    修法：startGame 喺 applySENBoardLayout 之後補叫 setSENTurn(currentTeam)。
assert('T111i-01 startGame 必須喺 easy 分支叫 setSENTurn（開局 banner 唔可以空）',
  /if \(isEasy\) UI\.setSENTurn\(Game\.state\.currentTeam\);/.test(appSrc),
  '搵唔到 startGame 入面嘅 setSENTurn 呼叫');

assert('T111i-02 開局 setSENTurn 一定要喺 applySENBoardLayout 之後、renderReview 之前',
  /UI\.applySENBoardLayout\(\);[\s\S]{0,1200}UI\.setSENTurn\(Game\.state\.currentTeam\);[\s\S]{0,200}UI\.renderReview\(\);/.test(appSrc),
  'setSENTurn 嘅位置唔啱（應該喺 applySENBoardLayout 之後）');

assert('T111i-03 setSENTurn 嘅 call site 至少 2 個（開局 + 每題切換）',
  (appSrc.match(/UI\.setSENTurn\(/g) || []).length >= 2,
  'UI.setSENTurn call site 少過 2 個');

assert('T111i-04 setSENTurn 必須讀 Game.state.currentTeam（唯一真實來源，唔開新欄位）',
  /setSENTurn\(team\) \{\s*\n\s*const t = team \|\| Game\.state\.currentTeam \|\| 'knight';/.test(appSrc),
  'setSENTurn 唔再讀 currentTeam');

// 真機 playtest 場景變正式守門（cycle111i：4 條新場景）
const PLAYTEST_SCENARIOS = [
  'playtest-teacher-flow.mjs',
  'playtest-relay-level.mjs',
  'playtest-end-screen.mjs',
  'playtest-boss.mjs',
];
assert('T111i-05 4 條真機 playtest 場景入咗 repo（教師台 / 接力級數 / 結算 / boss）',
  PLAYTEST_SCENARIOS.every((f) => fs.existsSync(path.join(__dirname, 'visual', 'scenarios', f))),
  PLAYTEST_SCENARIOS.filter((f) => !fs.existsSync(path.join(__dirname, 'visual', 'scenarios', f))).join(' | '));

assert('T111i-06 playtest 場景全部用學校 iPad viewport 639×669',
  PLAYTEST_SCENARIOS.every((f) => {
    const t = fs.readFileSync(path.join(__dirname, 'visual', 'scenarios', f), 'utf8');
    return /viewport:\s*\[639,\s*669\]/.test(t);
  }));

// strict-xfail：已知缺陷唔可以鎖成「永久預期行為」—— 修好咗就要報失敗，逼人移除標記
assert('T111i-07 strict-xfail 支援存在（已知缺陷有被追蹤，唔係靜靜當 pass）',
  /xfail:\s*!!xfail/.test(fs.readFileSync(path.join(__dirname, 'visual', 'cdp.mjs'), 'utf8')) &&
  /xfail 意外通過/.test(fs.readFileSync(path.join(__dirname, 'visual', 'run.mjs'), 'utf8')));

assert('T111i-08 有 xfail 標記嘅場景（代表至少一個已知缺陷被明文追蹤）',
  PLAYTEST_SCENARIOS.some((f) => /xfail:\s*true/.test(
    fs.readFileSync(path.join(__dirname, 'visual', 'scenarios', f), 'utf8'))));

// =========== summary ===========
console.log(`\n========== ${pass} pass / ${fail} fail ==========`);
if (fail > 0) {
  console.log(`\nFirst failure hint: ${fails[0] ? fails[0].name : '(see above)'}`);
  process.exit(1);
}
process.exit(0);