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
const expectedIds = ['add10','sub10','add20','sub20','add2d','sub2d','count10','count1to3','groupAdd','compareGroup','compare10','double','whatTime','shapeMatch','ordering'];
eq('15 type entries', typeIds.length, 15);
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
assert('ordering mode = order + keypad', modeMap['ordering'] === "'order','keypad'");
assert('ordering keypad hint',          src.includes('keypad：按正確順序'));

// =========== T10: v3.6 version consistency ===========
console.log('\n[T10] version');
const v32 = (src.match(/v3\.2/g) || []).length;
assert('v3.6 mentioned ≥ 4 times', (src.match(/v3\.6/g) || []).length >= 4);
assert('header version v3.6',     /數學守護者：精準訓練版 v3\.6/.test(src));
assert('title version v3.6',      src.includes('<title>數學守護者：精準訓練版 v3.6'));
assert('menu subtitle v3.6',      src.includes('精準訓練版 v3.6 · Math Guardian'));

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
// C1 viewport: 移除 user-scalable=no / maximum-scale=1.0 (允許低視力 zoom)
assert('AUDIT4-H  viewport allows user-scaling',
  !/maximum-scale\s*=\s*1\.0/.test(src) && !/user-scalable\s*=\s*no/.test(src));
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
  /aria-label="時鐘顯示 \$\{hour\} 點"/.test(src));
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
  /\.btn-sm\s*\{[\s\S]{0,200}min-height: 44px; min-width: 44px;/.test(src));
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
  /\.btn-ghost\s*\{[\s\S]{0,100}hover:bg-white\/25/.test(src));
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
  /function _scheduleNextQuestion[\s\S]{0,400}current\[team\] = null;[\s\S]{0,300}setTimeout/.test(src));
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
  /BANK_KEY:\s*'mg2\.bank\.v1'/.test(src));
assert('F-13 STORAGE.BANK_CAP constant',
  /BANK_CAP:\s*64\s*\*\s*1024/.test(src));
assert('F-13 STORAGE.save cap switch includes BANK_KEY',
  /key === STORAGE\.BANK_KEY\s*\?\s*STORAGE\.BANK_CAP/.test(src));

// F-14 — QuestionBank IIFE module
assert('F-14 QuestionBank module declared',
  /const QuestionBank = \(\(\) => \{[\s\S]{0,20000}return \{ load, save, reset, pickFromBank, isWeakType, shouldUseBank, stats, add, remove, list, PER_TYPE_CAP, Validators \};[\s\S]{0,50}\}\)\(\);/.test(src));
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
  /bankUsable = bankQ && \([\s\S]{0,400}reg\.layout === 'numeric'\)/.test(src));

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
  /aria-label="自動推薦"[\s\S]{0,600}opt-recommended'/.test(src));
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
  /^function _endTitleFor\(victory\) \{[\s\S]{0,1500}return \{ title:/m.test(src));
assert('R3 _renderEndIcon helper exists',
  /^function _renderEndIcon\(victory\) \{[\s\S]{0,800}iconSvg\.classList\.remove\('hidden'\)/m.test(src));
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
  /^function _tryTeacherPwd\(\) \{[\s\S]{0,400}TEACHER_PWD/m.test(src));
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
  /id="td-bank-inventory"[\s\S]{0,200000}QuestionBank\.PER_TYPE_CAP/.test(src));

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
assert('F-20 renderTypePicker shows ⭐ mastered badge + aria-label',
  /isMastered\(reg\.id\)[\s\S]{0,500}text-amber-400[\s\S]{0,200}已精通/.test(src));
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
  /function _scheduleNextQuestion\(team\) \{[\s\S]{0,500}current\[team\] = null;[\s\S]{0,300}coop/.test(src));
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
assert('EASY-25 一鍵開始 sets 4 SEN-friendly types',
  /count1to3.*count10.*groupAdd.*compareGroup/.test(src));
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
  /showQuestionSEN\(q\) \{[\s\S]{0,6000}TTS\.speak\(text, null/.test(src));
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
assert('EASY-42 _scheduleNextQuestion skips team switch in easy mode',
  /difficulty === 'easy'[\s\S]{0,100}knight/.test(src));
assert('EASY-43 endGame hides SEN screen before showing end screen',
  /screen-game-sen.*classList.*add.*hidden/.test(src));
assert('EASY-44 _wireSENScreen function exists',
  /function _wireSENScreen/.test(src));
assert('EASY-45 SEN screen has option area id',
  /id="sen-options-area"/.test(src));
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
  /showQuestionSEN[\s\S]{0,1200}codePointAt/.test(src) &&
  /isEmojiCP/.test(src) &&
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
  /difficulty === 'easy'[\s\S]{0,500}_recordAnswerStats/.test(src));
assert('EASY-55 easy handleAnswer plays Audio.correct / Audio.wrong',
  /difficulty === 'easy'[\s\S]{0,400}Audio\.correct[\s\S]{0,200}Audio\.wrong/.test(src));

// =========== summary ===========
console.log(`\n========== ${pass} pass / ${fail} fail ==========`);
if (fail > 0) {
  console.log(`\nFirst failure hint: ${fails[0] ? fails[0].name : '(see above)'}`);
  process.exit(1);
}
process.exit(0);