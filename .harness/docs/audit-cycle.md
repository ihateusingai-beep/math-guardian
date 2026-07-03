# 5-Round Audit Cycle

Math Guardian ships through a **5-round audit cycle** per minor version.
Each round is a focused bug-hunt + lock-in pass with a single category
of fixes. The pattern is what makes v3.4 stable enough to ship 189
regression assertions in 5 cycles.

## The 5 rounds

| Round | Focus | Example (v3.4) |
|---|---|---|
| 1 | **Closure / hoisting / dead code** | TDZ on `_wasPlayingBGM`, hoisted `slider`/`display` jQuery refs, dead `STORAGE._cap` removed |
| 2 | **State-machine / race / mobile** | `endGame` clears `paused`, `startGame` resets `_startAt` / `_frostTickAt`, confirm-modal Esc cleanup, touch event delegation |
| 3 | **Async / TTS / DOM pile / image fallback** | TTS `.speaking` global clear, `screenAlert` cap 1, instant-hint cap 1, boss hero portrait `onerror` |
| 4 | **A11y / keyboard / reduced-motion / screen-reader** | viewport user-scaling, role=dialog + aria-modal, trapFocusInModal, boss portrait alt sync, ARIA on keypad/sym/clock, sr-only utility, reduced-motion blanket rule |
| 5 | **Polish / a11y announce / per-channel audio / T-key** | per-sfx mute, beforeunload guard, touch-target 44px, T-key retry, Esc stack (skip pause when teacher-modal open), aria-valuetext on HP slider, `announceToA11y` helper, progressbar role, opt radiogroup roles, resume timer elapsed |

## How a round works

1. **Survey**: read the source top-to-bottom (single file, 5166 lines).
   Take notes on: stale state, dead refs, missing cancel handlers,
   keyboard traps, ARIA gaps, animation bloat, hardcoded magic numbers.
2. **Triage**: bucket findings into the 5 round categories. Most findings
   fall into multiple — pick the dominant one.
3. **Fix + lock**: for each finding, write the fix in `index.html` AND
   a regression assertion in `tests/regression.js`. Both land in the
   same commit.
4. **Manual smoke**: open in browser, run a session, screenshot
   `/tmp/v3X_*.png` for visual diff.
5. **Commit**: `git commit -m "Math Guardian v3.X — audit cycle N
   (M fixes + K test assertions)"` matching the existing commit
   style (see `git log --oneline`).

## Why 5 rounds, not 1

A single big-bang audit tends to:
- Miss patterns (you fix one TDZ but not the next).
- Mix concerns (a11y fix lands tangled with a state-machine fix).
- Bloat the diff (impossible to review).
- Skip tests (no time to assert after 30 fixes).

5 small rounds = 5 small diffs = 5 small reviews = 5 small PRs.
The audit cycle IS the release cadence for this project.

## Lock-in discipline (the 189 number)

Every assertion is **structural** (regex on source, function-name
match, string-literal match). No mocks, no DOM, no network. The
suite reads `index.html` as a string and runs in `node tests/regression.js`
with zero dependencies. Exit 0 = pass.

When the assertion count drops or a test regresses:
- The diff for the fix is wrong.
- The fix moved code around without updating the assertion.
- The fix is incomplete (cosmetic, not structural).

The lock-in is the contract: the next developer can't accidentally
revert the fix without the test catching it.

## Cycle-to-assertion map

| Cycle | Commits | Assertion count delta |
|---|---|---|
| pre-cycle-1 | v3.1 → v3.4 baselines | 0 → ~80 |
| Cycle 1 | f95d682-ish | +5 (T12) |
| Cycle 2 | 4c5ce72 | +14 (T13) |
| Cycle 3 | 7419857 | +6 (T14) |
| Cycle 4 | 4c2087c | +26 (T15) |
| Cycle 5 | f95d682 | +35 (T17) |
| **Total** | | **~189** |

## What's next

v3.5 is the **TTS Karaoke + 自動推薦 + Question Bank lite** sprint.
The cycle pattern repeats — expect another 5 rounds once those
features land, with T18+ assertion sections.
