# AGENTS.md

Math Guardian (數學守護者：精準訓練版 v3.4) — a single-file HTML
SPA for Hong Kong K1–K3 SEN (Special Educational Needs) students to
practice math in a team-battle game format. Vanilla JS + Tailwind
(CDN), no build step, GitHub Pages deploy.

## Setup commands

- **No install step** — pure static files. Open `index.html` in a
  browser, or serve with any static server
  (`python3 -m http.server 8000`).
- Run tests:   `node tests/regression.js`
- Lint:        none (no linter configured; project relies on
  structural assertions in the regression suite).
- Typecheck:   none (vanilla JS, no types).
- Build:       none (no build step; ship `index.html` as-is).

## Project layout

```
.
├── index.html              # 568 KB / 5166 lines — entire runtime
│                           #   TTS / Compliment / FX (2163–2413)
│                           #   TYPE_REGISTRY / Generators / QuestionGen (2414–2641)
│                           #   Game state + UI renderers + Snapshot (2642–4849)
│                           #   Bosses + BOSS_HERO (4830–end)
└── tests/
    └── regression.js       # 445 lines / 189 assertions — pure-Node, zero-deps
```

`.harness/` holds the Mavis multi-agent team (orchestrator + 4 reins
+ docs + changelogs). Not user-facing — see `.harness/agent.md` for
the team definition.

## Testing instructions

- **Unit/structural**: `node tests/regression.js` — exits 0 on
  pass. Reads `index.html` as a string and runs 189 structural
  assertions (regex on source, function-name match, ARIA attribute
  presence, file-size budget, etc.). ~0.3s.
- **DOM / visual**: open `index.html` in browser, play 2–3 questions
  (one correct, one wrong), screenshot to `/tmp/v3X_*.png` for visual
  diff. The suite does NOT touch the DOM.
- **All 189 assertions must pass** before opening a PR / committing
  a cycle. The `T16: file size budget` assertion enforces
  `index.html < 600 KB` raw.
- **Add a test for every new behavior** — see `.harness/docs/regression-discipline.md`
  for the lock-in rules. The 189-assertion count is the project's
  quality bar.

## PR & commit conventions

- Branch from `main`; never push to it directly.
- Commit message: `Math Guardian v3.X — audit cycle N (M fixes + K
  test assertions)` matching the existing git log style. See
  `git log --oneline` for examples.
- One cycle = one commit. Don't bundle cycles.
- Don't run `git push` — the user commits and pushes.
- Update `.harness/changelogs/YYYY-MM-DD.md` with the cycle's
  findings + assertion count delta.

## The 5-round audit cycle

Every minor version (v3.1, v3.2, v3.4, v3.5…) ships through a
**5-round audit cycle** with one focused category of fixes per round:

1. **Closure / hoisting / dead code** (TDZ, hoisted jQuery refs)
2. **State-machine / race / mobile** (startGame/endGame, Esc stack)
3. **Async / TTS / DOM pile / image fallback** (capping, onerror)
4. **A11y / keyboard / reduced-motion / screen-reader** (ARIA,
   focus, sr-only, blanket reduced-motion)
5. **Polish / a11y announce / per-channel audio / T-key**
   (announceToA11y, per-sfx mute, touch-target 44px)

Each round lands a `console.log('\n[T##] ...')` block in
`tests/regression.js` with 5–35 new assertions. The 189 number is
the running total across v3.1 baselines + 5 audit cycles.

Full details: `.harness/docs/audit-cycle.md`.

## 189-assertion lock-in discipline

Every bug fix in `index.html` MUST land a corresponding assertion
in `tests/regression.js` in the same commit. Assertions are
**structural** (regex / function-name / string-literal on the
source), never behavioral, never DOM-touching, never network.
The suite is zero-deps, ~0.3s, deterministic.

When you fix a bug:
1. Add the fix in `index.html`.
2. Add the matching assertion in `tests/regression.js` under a
   new `T##` block (T1–T17 used; next is T18).
3. Run `node tests/regression.js` and confirm exit 0.
4. Report the new total in the commit message and changelog.

Full rules + naming convention: `.harness/docs/regression-discipline.md`.

## Current architecture (v3.4 ground truth)

**Question flow**:
- `TYPE_REGISTRY` (line 2414) — 12 math types
  (add10/sub10/add20/sub20/add2d/sub2d + count10/compare10/double/whatTime/shapeMatch/ordering).
  Each has `id / label / emoji / difficulty / mode[] / layout / desc`.
- `Generators` (line 2432) — per-type math problem generators.
  `numeric(type, mode)` for arithmetic, named generators for
  visual types.
- `QuestionGen.make(type, mode)` (line 2517) — registry-driven
  dispatcher. Returns `{ text, parts, answer, type, options? }`.
  `q.text` is legacy-compat; new code reads `q.parts.join('')`.
- `Game.handleAnswer(team, value, btn)` (line 3564) — triple-path
  compare: array (ordering) / number / string fallback. The
  `Array.isArray(q.answer)` branch is the v3.1 fix that
  eliminated the silent order-bug.

**TTS** (line 2163) — `speechSynthesis` wrapper, zh-HK voice
detection (zh-HK > zh-TW > zh-CN fallback), `normalize()` turns
math symbols into Cantonese (加/減/等於/細過/大過), `speak()` with
`.speaking` class tracking, AUDIT5 added `cancel()` for explicit
cleanup + `setEnabled()` for the per-channel audio toggle.

**TTS buttons**: `knight-tts-btn` (line 1705), `mage-tts-btn` (line
1749). Onclick reads `q.parts.join('')`. AUDIT5 added
`TTS.cancel()` in `showQuestion` (line 2824) and `startGame` (line
3422) to clear stale utterances on question change / new game.

**Instant hint** (`showInstantHint`, line 3529) — fires on wrong
answer if `Game.settings.instantHint` (default `true`). Layout-aware
hint text (numeric = full equation, parts-emoji = "答案係 N",
clock = "時鐘顯示 X 點", etc.). AUDIT3 capped to 1 overlay (no
stacking on consecutive wrong). Also calls `TTS.speak` to read the
hint aloud. Click-to-dismiss + 4s auto-dismiss.

**Highlight** — currently used for keypad keys (purple/pink
border on `key-btn` for sym/clear/fn variants), correct/wrong
option buttons (`✓ / ✗` non-color icon in `::before`), and
`.speaking` pulse on TTS button. **There is NO token-level text
highlight synced to TTS boundary events yet** — that's the v3.5
TTS Karaoke feature.

**A11y surface** (AUDIT4 + AUDIT5):
- `aria-live-alerts` global announcer
- `announceToA11y(msg)` helper (line 3106) — called on correct/wrong
- `trapFocusInModal(modal)` (line 4192) — teacher / confirm modals
- `role=progressbar` + `aria-valuenow` + `aria-valuetext` on HP
  bar + slider
- `role=radiogroup` + `aria-pressed` on opt-win / opt-mode / opt-team
- `prefers-reduced-motion: reduce` blanket rule
- Touch targets ≥ 44×44 px via `.btn-sm` class
- `T-key` retry via `revealLatestReviewAnswer()` (line 4173)
- Esc stack: pause-overlay skipped if teacher-modal open
- Boss portrait `alt` synced from `Bosses.current.name`

**Snapshot** (line 4652) — throttled 800ms autosave to
`mg2.session.v1`, 24h expiry, full state + settings restore.
AUDIT5 added `beforeunload` + `pagehide` flushes (mobile Safari
doesn't fire `beforeunload`). AUDIT5-P2 reduced `timeLeftSec` by
elapsed since `savedAt` on resume (prevents over-counting after
overnight reload).

## v3.5 P0 backlog

Three features in priority order. **DO NOT start implementing until
v3.4 is fully committed and the user signals "go"**:

1. **TTS Karaoke** — wrap question text in
   `<span class="tts-tok" data-i="N" data-start="M" data-end="K">`,
   extend `TTS.speak(text, btn, opts)` with `opts.onBoundary(charIndex)`,
   highlight the matching token as `speechSynthesis` fires
   `utter.onboundary`. zh-HK = per-character segmentation. TTS
   Karaoke toggle in teacher modal. Reduced-motion: no transition.
   Est. +8 assertions (T18 block).

2. **自動推薦** — recommend 3–5 next math types based on per-team,
   per-type accuracy from `Game.state.teams` + adaptive difficulty
   state + last 10 sessions. Surface as "✨ 建議" chips in the
   type-picker area. Est. +6 assertions.

3. **Question Bank lite** — persist a small curated bank of
   10–20 good questions per type, rotate 50/50 with random
   generators for weak students. `STORAGE.bank = { [typeId]: Question[] }`,
   reset in settings. Est. +5 assertions.

Full design sketches: `.harness/docs/v35-roadmap.md`.

## Security

- No secrets in source. Compliment module references
  `https://api.MiniMax.chat/v1/chat/completions` for the optional
  AI-upgrade path; the user pastes their own API key into the
  teacher modal at runtime — never stored in source.
- `.env`-style secrets don't apply (no build, no server).
- localStorage keys are namespaced `mg2.*` (session, settings,
  stats, bank). No PII.
- `.gitignore` covers macOS metadata (`.DS_Store`, `._*`) and
  editor backups.
