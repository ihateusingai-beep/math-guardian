# Math Guardian v3.6 — Senior Engineer Architecture Review

> Author: new senior engineer onboarding
> Date: 2026-10-17
> Scope: 11,719 LoC single-file HTML SPA + 2,016 LoC regression tests
> Goal: surface structural problems, propose refactors, **preserve functionality**.

---

## 1. Architecture Summary

### 1.1 File structure

```
index.html  (11,719 LoC, 528 KB)
  ├─ <head>          : 1-40          (meta, Tailwind CDN, Plausible, OG tags)
  ├─ <style>         : 41-3112       (3,072 LoC of CSS — design tokens, themes, components, animations)
  ├─ <body>          : 3113-4217     (1,105 LoC of static HTML — screens, modals, SVG defs)
  └─ <script>        : 4218-11719    (7,502 LoC of JS — all logic)
       ├─ [1] Constants / utils     (565 LoC)
       ├─ [2] Audio (Web Audio)      (221 LoC)
       ├─ [3] Visual FX             (355 LoC)
       ├─ [4] Question generators   (731 LoC)
       ├─ [4.5/4.6] Type picker + Bank (594 LoC)
       ├─ [5] Game state            (204 LoC)
       ├─ [6] UI Updates            (1,196 LoC)
       ├─ [7] Event handlers / main flow (2,789 LoC) ← LARGEST
       ├─ [7.5] Snapshot / Resume   (647 LoC)
       ├─ [8] Boot                  (321 LoC)
       └─ inline: Profile, Adaptive, Bosses, TTS, Teacher, Audio
```

### 1.2 Data flow

```
[1] Constants & assets
        ↓
[2-3] Audio + Visual FX modules (singleton)
        ↓
[4] Generators[type] → Question object { parts, answer, options, extra, type }
        ↓
[4.5] Type picker UI ←→ Profile (mastery tracking)
        ↓
[4.6] Bank (mg2.bank.v4 localStorage) → pickFromBank(type) → Question
        ↓
[5] Game.settings (difficulty, scopes, types, playLayout, team)
[5] Game.state (running, paused, ended, history, scores, bossHp, etc.)
        ↓
[6] QuestionRenderer[layout](q, team, area)
    └─ branches: numeric / parts-emoji / bars / height / seq-choice / clock / shape / order / pic-grid / sym-button
        ↓
[7] showQuestion(team)  → startGame / nextQuestion / handleAnswer / endGame
[7.5] Snapshot.schedule → localStorage mg2.snapshot
        ↓
UI: DOM mutation via createElement / innerHTML
Audio: Web Audio API beeps + BGM
TTS: SpeechSynthesis
Plausible: game_start / game_end events
```

### 1.3 External dependencies

- Tailwind 3.x via CDN (no build)
- Plausible analytics
- Web Audio API (no external)
- Web Speech API (no external)
- 1 external image: school logo (`puichi.edu.hk`)
- 0 npm packages, 0 build step

### 1.4 Test surface

`tests/regression.js` (2,016 LoC, 703 assertions):
- 100% regex-based static source code checks
- 0 DOM / 0 browser / 0 behavior tests
- Runs in pure Node, 0 deps, <1s
- Format: `eq(name, actual, expected)` + `assert(name, cond)`
- Comments admit: "DOM behaviour is verified via headless screenshots in /tmp/v33_*.png which we run manually after each patch" — **this is a known gap**.

---

## 2. Problem Areas (ranked by severity)

### 🔴 P0 — Architectural risks

#### P0.1 Single file approaching cognitive ceiling

- **11,719 LoC** in one file. Largest section [7] alone is **2,789 LoC**.
- Section [7] includes `startGame`, `nextQuestion`, `handleAnswer`, `endGame`, `showEndScreen` — all interconnected.
- **Symptom**: 2 accidental overwrites in cycles 93/94 (px-castle content replaced with mage; px-char-mage duplicated).
- **Why bad**: Refactor tools don't scale, code review is hard, blame is hard, no module boundary means every change is global.

#### P0.2 703 regex tests give false confidence

- 100% static source checks. **Zero behavior tests.**
- Concrete failure: cycle 90/92/95 fixed contrast 3 times; regex tests all said PASS after each "fix" because they only check class names exist.
- **Why bad**: Tests prevent regression of *form* (regex matches), not *function* (user can read the result). Misleading green checkmarks are worse than no tests.
- **Symptom**: User has filed ≥3 contrast complaints over 6 cycles; each cycle test passes. Tests aren't catching the actual user-visible problem.

#### P0.3 `q.type` if-else chain duplicated 5+ times

Across 16 type IDs, `q.type === 'compareLength'` is checked:
- 6× in showQuestionSEN
- 6× in handleAnswer / _normalizeBankQuestion / hint / QuestionRenderer dispatch / etc.

Every new type forces a search-and-edit across 5–6 functions. **Add 1 type → 6 places to update.** No central dispatch table.

#### P0.4 SVG defs duplicated and inconsistent

- 30 `<symbol>` definitions inline at lines 1-3,000 (in `<body>` before `<script>`).
- Cycle 93 + 94 inadvertently overwrote `px-castle` content with `px-char-mage` content (mismatch still partially latent).
- Boss sprites (`px-troll`, `px-frost`, `px-lava`, `px-shadow`, `px-crystal`) all 16×16 — but knight/mage were upgraded to 32×48 in cycle 94. **Visual asymmetry.**

#### P0.5 Hardcoded inline styles leak theme logic

55 `style="..."` attributes in the HTML. Examples:
- `style="background:rgba(88,28,135,0.25);border-color:rgba(196,181,253,0.35);"` on the menu track card
- `style="filter:brightness(0.55);"` on end-screen bg
- 10+ gradient/shadow styles on the start button
- `style="min-width:3rem;text-align:center;"` on q-count badge

These override the design system and re-introduce contrast bugs (cycle 95 fixed `screen-end` precisely because inline `bg-white/10` + dark image = invisible text).

---

### 🟠 P1 — Code quality issues

#### P1.1 Dead code: 15 legacy type IDs

`TYPE_REGISTRY` has 23 entries; home scope picker uses 8 (`count20`, `compareLength`, `compareHeight`, `orderAsc20`, `orderDesc20`, `learnL`, `findLDrink`, `findLItem`).

The 15 unused ones (`add10`, `sub10`, `add20`, `sub20`, `add2d`, `sub2d`, `count10`, `count1to3`, `groupAdd`, `compareGroup`, `compare10`, `double`, `whatTime`, `shapeMatch`, `ordering`):
- Still rendered in the boss panel's "advanced" type picker
- Still have generators + bank entries + normalize code
- Each one is 30–80 LoC of maintenance burden
- Are intended for "Keypad mode" — but the home picker is "Choice mode" only

**Cost**: ~1,200 LoC of code paths nobody uses.

#### P1.2 showQuestionSEN = 159-line if-else

```js
function showQuestionSEN(q, team) {
  if ((q.type === 'compareLength' || q.type === 'compareHeight') && q.extra && emojiEl) { ... }
  else if (q.type === 'whatTime' && q.extra && emojiEl) { ... }
  else if (q.type === 'shapeMatch' && emojiEl) { ... }
  else if ((q.type === 'count10' || q.type === 'count20' || q.type === 'count1to3') && emojiEl) { ... }
  else if ((q.type === 'learnL' || q.type === 'findLDrink' || q.type === 'findLItem') && emojiEl) { ... }
  else if (q.parts) {
    if (q.type === 'orderAsc20' || ...) { ... }
    else if (q.type === 'compare10') { ... }
    else if (q.type === 'groupAdd' || q.type === 'double') { ... }
    else if (q.type === 'compareGroup') { ... }
    else { ... }
  } else { ... }
  // then 4 more branches for option buttons
}
```

**This is a router pattern. Should be a dispatch table.**

#### P1.3 Three "B key" files in three formats

- `startGame` lives at line 8901, declares types, resets state, applies Bosses.current, fires analytics
- `nextQuestion` at 9118: prepares question, calls render, sets up timer
- `handleAnswer` somewhere around 9300s: validates, updates state, fires FX, calls nextQuestion

None of them have explicit "phases" documented. Adding a new feature means tracing through 3 of them.

#### P1.4 ANSWER_KEY XOR encoding is dev-only but shipped

```js
/* ============== P0-2: 答案 XOR 編碼 (dev-only) ==============
   NOT SECURITY — 純 client-side，學生打開 DevTools 仍可 decode。
   目的：擋 casual quick-inspect（家長/同學偶然瞄到）。
   Safe to remove: deleting these 4 lines makes answers always visible in DevTools...
*/
const ANSWER_KEY = 0x5A;
function encodeAnswer(s) { ... }
function decodeAnswer(hex) { ... }
```

It's labeled "dev-only" but lives in the shipped bundle. **Either remove (simpler) or commit to it as a real (still fake) deterrent.** The middle ground is maintenance debt.

#### P1.5 Test count growth is linear, not log

Each new feature adds 5–20 tests. Cycle 88–96 added 87 tests (~12/cycle avg). At this rate, tests will overtake code within 2 years. The tests don't compound value; they only snapshot the current shape.

---

### 🟡 P2 — Performance & polish

#### P2.1 No backpressure on audio context

`Audio` module creates Web Audio contexts on first use. If user navigates screens rapidly, no debounce. (Mild issue — only relevant on slow devices.)

#### P2.2 Snapshot.schedule debounce missing

`Snapshot.schedule('boss-hit')` is called on every boss hit, but the only protection is the `_resetQuotaFlag`. **No time-based debounce** — rapid hits queue up localStorage writes. localStorage is synchronous; 100 rapid hits = 100ms of main-thread blocking.

#### P2.3 CSS specificity wars

`!important` appears 30+ times. Mostly used to override `.btn-ghost` or to enforce selected states. Suggests the underlying cascade is fighting itself. A proper design system (utility classes with proper precedence) would reduce this to 0.

#### P2.4 No CSS reset / normalize

Tailwind's preflight does some, but custom CSS in `<style>` doesn't follow BEM or any naming convention. We have:
- `.sen-opt-btn`, `.sen-opt-letter`, `.sen-opt-val`
- `.pic-card-btn`, `.pic-card-mini`, `.pic-card-svg`, `.pic-card-name`, `.pic-card-pkg`
- `.lbl-tone-yellow`, `.lbl-c-yellow`

Mix of semantic names, BEM-ish, and ad-hoc suffixes. No documented convention.

---

## 3. Refactoring Strategies

I propose **3 refactor waves**, each independently shippable, each preserving 100% of current behavior. Total: ~3 weeks of work for one engineer.

### Wave 1: De-risk (2-3 days)

**Goal**: Stop the test-failure & visual-breakage bleed. No new features.

1. **Extract CSS variables for all colors.** Define `--text-on-light`, `--text-on-dark`, `--bg-on-light-card`, `--bg-on-dark-card`. Replace every `text-amber-700/300` and `text-slate-600/700` with these tokens. Theme overrides auto-flip. (Cuts future contrast bugs to ~0.)
2. **Move 55 inline `style="..."` to CSS classes.** Most are already unique (school logo, end-bg gradient, pic-card sizing). One class per usage.
3. **Add behavior smoke test (Playwright, 30 LoC).** Visit the page, click "Start", assert 1 question renders, assert 1 button has text. **Catches the kind of bug cycle 95 was.** ~50 LoC.
4. **Add `// @ts-check` JSDoc to top of `index.html` with `any` everywhere.** Zero cost, gets VS Code type hints. Optional.

**Risk**: Low. CSS variables are mechanical replacements. Playwright is one new file.

### Wave 2: Module split (1 week)

**Goal**: Reduce cognitive load, make code review tractable.

Split `index.html` into:

```
index.html       (HTML shell only, ~500 LoC)
src/
  ├─ constants.js     (~300 LoC — TYPE_REGISTRY, SCOPE_CATALOG, SEN_COPY, etc.)
  ├─ generators.js    (~700 LoC — Generators object)
  ├─ renderers.js     (~600 LoC — QuestionRenderer)
  ├─ ui.js            (~1,200 LoC — showQuestionSEN, refreshSENScreen, etc.)
  ├─ game.js          (~500 LoC — startGame, nextQuestion, handleAnswer, endGame)
  ├─ fx.js            (~400 LoC — Audio, TTS, Visual FX)
  └─ main.js          (~200 LoC — entry, wireEventListeners)
```

Use ES modules (`<script type="module">`). No build step. GitHub Pages serves it natively.

**Risk**: Medium. The first day is figuring out the import graph (currently everything is one closure). But ES modules support this directly with `type="module"`.

**Benefit**:
- 11,719 LoC file → 7 files of 200-1,200 LoC each. Top file: ~500 LoC.
- Can write per-module tests (still regex, but smaller surface).
- Cycle 93/94-style accidental overwrites become impossible (different files for sprite definitions vs character art).

### Wave 3: Behavior tests + dispatch table (1 week)

**Goal**: Replace regex tests with real behavior tests; eliminate the 5× duplicated if-else.

1. **Add Playwright test suite (5-10 tests).** Cover:
   - Page loads
   - Menu renders 8 scope buttons
   - Click "Start" → 1 question visible
   - Each scope type can be played
   - Boss victory → end screen
   - localStorage persists state
2. **Add type dispatch table** (data-driven):
   ```js
   const TYPE_DISPATCH = {
     compareLength: { show: renderLengthBars, answer: handlePairTap, normalize: normLength, ... },
     count20:       { show: renderCountGrid,  answer: handleMC,        normalize: normCount,  ... },
     // ...
   };
   ```
   Then `showQuestionSEN` becomes:
   ```js
   const handler = TYPE_DISPATCH[q.type];
   if (handler) handler.show(q, team, area);
   else renderDefaultMC(q, team, area);
   ```
3. **Remove 15 legacy type IDs from TYPE_REGISTRY** (or hide behind `LEGACY_TYPES = true` flag).
4. **Prune ANSWER_KEY XOR encoding** — pick a side: remove (simpler) or keep + add a JSDoc note saying "intentionally fake".

**Risk**: Low to medium. Dispatch table is mechanical. Playwright tests need a CI runner (GitHub Actions is free).

---

## 4. Refactor-1 Example: CSS variables

This is a focused 30-min refactor that I can show as code.

### Before (current)

```css
/* ============== Design Tokens (P0) ============== */
:root {
  --c-bg-deep: #fce7f3;
  --c-bg-mid: #f5d0fe;
  --c-bg-bright: #bae6fd;
  --c-accent-amber: #fbbf24;
  --c-text-primary: #1e293b;
  --c-text-muted: rgba(30,41,59,0.7);
  --c-knight: #3b82f6;
  --c-mage: #a855f7;
  --c-boss: #dc2626;
}
.theme-snow {
  --c-text-primary: #f0f9ff;
}
```

```html
<span class="text-sm font-bold text-amber-700 mb-2 block">① 挑戰 Boss</span>
```

When user switches to snow theme, `--c-text-primary` becomes light, but the hardcoded `text-amber-700` stays dark. **This is why contrast breaks on theme change.**

### After (proposed)

```css
:root {
  /* existing tokens */
  --c-bg-deep: #fce7f3;
  --c-bg-mid: #f5d0fe;
  --c-bg-bright: #bae6fd;
  --c-text-primary: #1e293b;
  --c-text-muted: rgba(30,41,59,0.7);
  --c-text-on-card-light: #1e293b;   /* dark text on light card */
  --c-text-on-card-dark:  #fef3c7;   /* light text on dark card */
  --c-text-on-card-dark-muted: #fde68a;
  --c-bg-card-light: #ffffff;
  --c-bg-card-dark:  #1e293b;
  --c-border-light: rgba(30,41,59,0.18);
  --c-border-dark:  rgba(255,255,255,0.18);
}
.theme-snow {
  --c-text-primary: #f0f9ff;
  /* snow = darker cards/panels → flip */
  --c-text-on-card-light: #f0f9ff;  /* dark on snow = light text */
  --c-text-on-card-dark:  #fef3c7;
  --c-text-on-card-dark-muted: #fde68a;
  --c-bg-card-light: #1e293b;
  --c-bg-card-dark:  #ffffff;
  --c-border-light: rgba(255,255,255,0.18);
  --c-border-dark:  rgba(30,41,59,0.25);
}
```

```css
/* Utility classes — these auto-flip with theme */
.text-on-light   { color: var(--c-text-on-card-light); }
.text-on-dark    { color: var(--c-text-on-card-dark); }
.text-on-dark-muted { color: var(--c-text-on-card-dark-muted); }
.bg-card-light   { background: var(--c-bg-card-light); }
.bg-card-dark    { background: var(--c-bg-card-dark); }
.border-light    { border-color: var(--c-border-light); }
.border-dark     { border-color: var(--c-border-dark); }
```

```html
<!-- Before -->
<span class="text-sm font-bold text-amber-700 mb-2 block">① 挑戰 Boss</span>

<!-- After (1) — utility class -->
<span class="text-sm font-bold text-on-light mb-2 block">① 挑戰 Boss</span>

<!-- After (2) — for elements on dark cards (teacher modal, end screen) -->
<span class="text-sm font-bold text-on-dark mb-2 block">Boss 結果</span>
```

### Why this works

- Theme flip is **automatic**. If `body.theme-snow` is active, `--c-text-on-card-light` becomes light, and `.text-on-light` becomes light.
- **No more guessing** which class works in which context. Use `text-on-light` on light cards, `text-on-dark` on dark cards. Period.
- Future contrast bugs eliminated at the design system level, not patched one site at a time.
- Adds 12 lines of CSS, removes ~30 raw color usages.

### Lock-in test (T97)

```js
// Add to tests/regression.js
assert('T97-01 design tokens define text-on-card-light/dark',
  /--c-text-on-card-light:\s*#1e293b/.test(src) &&
  /--c-text-on-card-dark:\s*#fef3c7/.test(src));
assert('T97-02 utility classes defined',
  /\.text-on-light\s*\{/.test(src) &&
  /\.text-on-dark\s*\{/.test(src));
assert('T97-03 snow theme overrides text-on-card-light to light',
  /\.theme-snow[\s\S]{0,200}--c-text-on-card-light:\s*#f0f9ff/.test(src));
assert('T97-04 zero raw text-amber-700 outside menu (was 21)',
  (src.match(/text-amber-700/g) || []).length < 5);
```

---

## 5. Refactor-2 Example: Dispatch table

### Before

```js
function showQuestionSEN(q, team) {
  if ((q.type === 'compareLength' || q.type === 'compareHeight') && q.extra && emojiEl) { ... 30 lines ... }
  else if (q.type === 'whatTime' && q.extra && emojiEl) { ... 20 lines ... }
  else if (q.type === 'shapeMatch' && emojiEl) { ... }
  else if ((q.type === 'count10' || q.type === 'count20' || q.type === 'count1to3') && emojiEl) { ... }
  else if ((q.type === 'learnL' || q.type === 'findLDrink' || q.type === 'findLItem') && emojiEl) { ... }
  else if (q.parts) {
    if (q.type === 'orderAsc20' || q.type === 'orderDesc20' || q.type === 'ordering') { ... }
    else if (q.type === 'compare10') { ... }
    else if (q.type === 'groupAdd' || q.type === 'double') { ... }
    else if (q.type === 'compareGroup') { ... }
    else { ... }
  } else { ... }
  // ... 80 more lines for option building
}
```

### After

```js
// Data-driven: declare per-type behavior ONCE
const SEN_DISPATCH = {
  compareLength: { kind: 'pair-bar', render: (q, ctx) => renderLengthBars(q, ctx), options: () => null },
  compareHeight: { kind: 'pair-bar-vert', render: (q, ctx) => renderHeightPair(q, ctx), options: () => null },
  whatTime:      { kind: 'clock', render: renderClockFace, options: renderMCOptionsFromQA },
  shapeMatch:    { kind: 'shape', render: renderShapeSVG, options: () => null /* answered by tap-on-shape */ },
  count20:       { kind: 'count-grid', render: renderCountGrid, options: renderMCOptionsFromQA },
  count1to3:     { kind: 'count-grid', render: renderCountGrid, options: renderMCOptionsFromQA },
  count10:       { kind: 'count-grid', render: renderCountGrid, options: renderMCOptionsFromQA },
  learnL:        { kind: 'pic-grid',  render: renderPicGrid,  options: () => null },
  findLDrink:    { kind: 'pic-grid',  render: renderPicGrid,  options: () => null },
  findLItem:     { kind: 'pic-grid',  render: renderPicGrid,  options: () => null },
  orderAsc20:    { kind: 'seq-choice', render: renderSeqChoice, options: renderMCOptionsFromQA },
  orderDesc20:   { kind: 'seq-choice', render: renderSeqChoice, options: renderMCOptionsFromQA },
  ordering:      { kind: 'seq-choice', render: renderSeqChoice, options: renderMCOptionsFromQA },
  compare10:     { kind: 'sym-button', render: renderSymButton, options: () => null },
  groupAdd:      { kind: 'parts-emoji', render: renderPartsEmoji, options: renderMCOptionsFromQA },
  compareGroup:  { kind: 'parts-emoji', render: renderPartsEmoji, options: renderMCOptionsFromQA },
  double:        { kind: 'parts-emoji', render: renderPartsEmoji, options: renderMCOptionsFromQA },
};

function showQuestionSEN(q, team) {
  const ctx = UI._senEls(team);
  const handler = SEN_DISPATCH[q.type];
  if (handler) {
    if (handler.render) handler.render(q, ctx);
    if (handler.options) handler.options(q, ctx);
  } else {
    renderDefaultMC(q, ctx);   // 4-line fallback for unrecognized types
    console.warn(`[SEN_DISPATCH] unknown type "${q.type}"`);
  }
  // TTS
  if (Game.settings.ttsEnabled && Game.settings.playLayout !== 'dual') {
    const text = _senCopyTTS(q);
    if (text) TTS.speak(text, null, {});
  }
}
```

### Why this works

- **Adding a new type** = adding 1 row to `SEN_DISPATCH`. No more search-and-edit across 5 functions.
- **The default case is explicit.** Unknown types render the fallback + log a warning (T92-style invariant).
- **Easier to test**: each `renderFoo` can be unit-tested independently.
- Reduces 159 lines → ~50 lines for `showQuestionSEN` + 30 lines for the dispatch table (which is just data).

### Lock-in test (T98)

```js
assert('T98-01 SEN_DISPATCH table exists with ≥ 8 entries',
  /const\s+SEN_DISPATCH\s*=\s*\{[\s\S]{0,3000}\}/.test(src) &&
  (src.match(/SEN_DISPATCH[\s\S]{0,3000}/)[0].match(/^\s*\w+:\s*\{/gm) || []).length >= 8);
assert('T98-02 showQuestionSEN uses dispatch (no nested if-else for q.type)',
  /function showQuestionSEN[\s\S]{0,3000}SEN_DISPATCH/.test(src) &&
  !/showQuestionSEN[\s\S]{0,3000}q\.type === 'compareLength'/.test(src));
assert('T98-03 unknown type falls back to default + warns',
  /console\.warn\(`\[SEN_DISPATCH\]/.test(src) ||
  /console\.warn\(['"]\[SEN_DISPATCH\]/.test(src));
```

---

## 6. Maintainability Risks Summary

| Risk | Severity | Likelihood | Wave |
|---|---|---|---|
| Cycle 95-style "fix contrast again" cycle | 🔴 High | Already happened 3× | Wave 1 |
| Accidental SVG overwrite (cycle 93/94) | 🔴 High | Already happened 2× | Wave 2 |
| New type requires 5+ place edits | 🟠 Medium | Every type add | Wave 3 |
| Regex tests don't catch user-visible bugs | 🔴 High | Already happening | Wave 1+3 |
| 15 dead type IDs | 🟡 Low | Maintenance tax | Wave 3 |
| Single 11k+ LoC file | 🟠 Medium | All future changes | Wave 2 |
| ANSWER_KEY XOR (dev-only but shipped) | 🟢 None | Confusing only | Wave 3 |
| 55 inline `style=` overrides | 🟡 Low | Theme bugs | Wave 1 |
| No debounce on localStorage writes | 🟡 Low | Edge case | Wave 2 |

---

## 7. Recommendation

**Don't ship any new features until Wave 1 is done.**

Wave 1 (3 days) gives us:
- 1 design-system bug class eliminated forever
- 1 Playwright smoke test that catches real bugs
- AGENTS.md updated to point to the new tokens

After Wave 1, *then* consider features based on:
- Plausible field data (cycle 96, 2-4 weeks in)
- User testing sessions (5-min scripts with real SEN students)
- The user's actual feedback after they see a real polished release

Wave 2 and 3 are longer-term. They unblock the project for the next 2 years, but are not urgent if user testing in Wave 1 shows the current product is good enough.

---

## 8. Functionality Preservation

**Every refactor in this document preserves user-visible behavior 100%.**

Wave 1 changes only CSS variables and adds a smoke test. Zero behavior change.

Wave 2 splits a file. Functionally identical. The only user-visible risk is: if GitHub Pages caches the old HTML, users see stale. Mitigation: cache-bust via Plausible event or a version param.

Wave 3 adds dispatch table + Playwright. Each render function is preserved exactly. Only the routing mechanism changes.

---

## 9. What I would NOT refactor

- **The 30 SVG symbols** — they work, they're well-named, splitting them would add import overhead. Keep inline.
- **The Tailwind CDN setup** — single dependency, no build. Don't add a bundler.
- **The localStorage key scheme (`mg2.*`)** — already namespaced. Don't change.
- **The boss unlock progression** — game design decision, not an architecture issue.

---

## TL;DR

- **P0**: 11k+ LoC single file + 703 regex tests + 5× duplicated `q.type` if-else chain = fragile, test-passing-but-buggy code.
- **Wave 1 (3 days)**: design tokens + behavior smoke test. Eliminates the contrast-bug cycle.
- **Wave 2 (1 week)**: split into 7 ES modules. Makes code review tractable.
- **Wave 3 (1 week)**: dispatch table + Playwright + prune dead types. Adds real safety net.
- **Don't ship features in parallel.** Field data + user testing first.
