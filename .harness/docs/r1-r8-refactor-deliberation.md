# Math Guardian v3.5 — R1-R8 refactor deliberation (2026-07-07)

**Context**: Previous session transcript (containing prior 7-item list) was lost in
session repair. This document derives a fresh refactor list from current codebase
state. Items below are evidence-based, not carried-over guesses.

**Codebase ground truth** (post-cycle-10 / commit 3025f0b):
- index.html: 5834 lines, 574.6 KB
- tests/regression.js: 636 lines, 249 assertions
- 12 math types, ~13 module-level IIFEs, ~30 top-level functions

## Methodology

Scan for:
1. **Module size** — single IIFE / function > 200 lines
2. **Cyclomatic complexity** — nested `if/else` depth > 3 in single function
3. **Duplicated patterns** — same boilerplate in 3+ callsites
4. **Coupling** — module touches Game.state / STORAGE / DOM without boundary

## Candidate list (8 items, ordered by ROI)

| ID | Surface | Size | Type | Difficulty | Value | Risk |
|---|---|---|---|---|---|---|
| **R1** | `UI` IIFE | **1646 LoC** | monolith split | Medium-High | High | Medium |
| **R2** | `setupTeacher` function | 142 LoC | function split (6 concerns inline) | Low | Medium | Low |
| **R3** | `showEndScreen` | 113 LoC | function split (icon/badges/stats) | Low | Medium | Low |
| **R4** | `startGame` | 104 LoC | function split (validate / reset / boss / audio / UI) | Medium | High | Medium |
| **R5** | `Game.handleAnswer` | 146 LoC | branch extraction (ult / correct / wrong / array-compare) | Medium | Medium | Medium |
| **R6** | `AI_ASSETS` + `BOSS_HERO` modules | 255 + 260 LoC | base64 blob extraction to separate file OR keep inline (file size trade-off) | High (build step?) or Low (keep) | Low | Low |
| **R7** | `Compliment` IIFE | 349 LoC | mostly data array — extract to `data/compliments.js` style (pure-data) OR keep inline | Low | Low | Low |
| **R8** | `Adaptive` IIFE | 321 LoC | extract downgrades heuristics to pure functions | Medium | Medium | Low |

## What I would NOT touch (intentional skips)

- **STORAGE / Profile / Snapshot** — already lazy-migrated (cycle 9 F-11), tests lock
  the invariants, premature refactor would regress
- **TYPE_REGISTRY / Generators / QuestionGen / QuestionBank** — registry-driven
  pattern is the architectural backbone; tests assert the shape
- **TTS** — `cancel()` + `_boundaryEpoch` (cycle 8 F-06) is delicate, leave alone
- **FX / Audio** — side-effect modules, splitting risks timing bugs in setTimeout chains

## My recommendation: Start with R2 / R3 / R4 (low-risk splits, fast wins)

**Why these three first**:
- **Low coupling** — `setupTeacher` / `showEndScreen` / `startGame` are mostly
  orchestration glue, no deep shared state, low regression risk
- **Small diff** — each ~100 lines, can land in one cycle
- **High readability win** — splitting into ~6 named subfunctions per file makes
  the next 3 cycles of features (Adaptive.nextType, Bank expansion) land faster

**R1 (UI monolith) is the elephant**:
- 1646 LoC in one IIFE — would benefit from per-screen submodules
  (UI.menu / UI.game / UI.end / UI.modals / UI.teacher / UI.dashboard)
- But: largest blast radius if any UI render path regresses, requires careful
  regression test expansion (maybe 30+ new assertions to lock render shapes)
- **Defer to cycle 13+** when adaptive.nextType work is done; we'll need
  UI.menu + UI.game expansion anyway, so combining R1 with that work is more
  efficient than doing R1 standalone.

**R5 / R8 (handleAnswer / Adaptive)** — both touch `Game.state.*` deeply,
so refactor needs parallel test expansion. Better to do AFTER cycle 11
Adaptive.nextType, when the Adaptive API is stable.

**R6 / R7 (data blobs)** — net negative ROI. Extracting to separate file
requires build step or multiple HTTP requests on GitHub Pages. Keep inline
unless file size budget forces hand.

## Estimated effort

| Combo | Cycles | Assert delta | File size delta | Risk |
|---|---|---|---|---|
| R2 + R3 (low-risk pair) | 1 cycle | +5-8 | -0 KB (split, no new logic) | Low |
| R4 (medium-risk) | 1 cycle | +3-5 | +0 KB | Medium |
| R5 (post-Adaptive.nextType) | 1 cycle | +8-12 | -0 to +2 KB | Medium |
| R8 (Adaptive refactor) | bundled with cycle 11 | +5-8 | +2-4 KB | Low |
| R1 (UI monolith) | 2-3 cycles | +20-30 | -10 KB (net of inline shrink) | High |

## Question to user

1. **Start with R2 + R3** (low-risk pair, ships in 1 cycle)?
2. **Skip R1 until Adaptive.nextType lands** (combining R1 with that cycle is more efficient)?
3. **Skip R6 / R7** (keep data blobs inline — file size budget is fine)?
4. Other priorities I missed?

## Note on previous R-list

I don't have the original 7-item list (session was repaired mid-flow). If you
remember specific items, share them and I'll re-add to this doc. Otherwise
this 8-item list is the fresh evidence-based cut.