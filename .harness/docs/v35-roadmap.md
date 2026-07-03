# v3.5 Roadmap — P0 Backlog

v3.4 is shipped and locked in (189 assertions). v3.5 is the next
sprint. Three P0 features, in priority order:

## 1. TTS Karaoke (P0)

**Goal**: when a question is read aloud, highlight the on-screen text
in sync with the live `speechSynthesis` utterance.

**Why**: SEN students (dyslexia, ADHD, low literacy) benefit from a
visual channel alongside audio-only TTS. Same pattern as Duolingo
stories / Khan Academy Kids.

**Design sketch**:
- Wrap question text in `<span class="tts-tok" data-i="N" data-start="M" data-end="K">…</span>`
  per token (word for en, character for zh-HK).
- Extend `TTS.speak(text, btn, opts)` with `opts.onBoundary(charIndex)`.
- Wire `utter.onboundary = (e) => opts.onBoundary?.(e.charIndex)`.
- `onBoundary` finds the matching token by char range, toggles
  `.tts-active` class.
- `TTS.cancel()` removes `.tts-active` from all tokens (parallel to
  `.speaking` cleanup).
- New setting: `Game.settings.ttsKaraoke` (default `true`), persisted
  in `Snapshot` schema.
- New audio toggle: `td-audio-tts-karaoke` in teacher modal (per-user).
- Reduced-motion: `.tts-active { transition: none; }`.

**Owner**: `tts-karaoke-specialist` (design) + `math-spa-developer`
(implementation) + `regression-tester` (+ 8 assertions in T18)
+ `sen-a11y-reviewer` (review).

**Acceptance**:
- TTS reads question, text highlights token-by-token.
- 12 TYPE_REGISTRY entries all show clean highlight (numeric / parts-emoji /
  sym-button / clock / shape / order).
- Cancel-on-question-change works.
- Reduced-motion users see no transition flicker.
- File size delta < 4 KB.
- All 197 assertions pass.

## 2. 自動推薦 (P0)

**Goal**: based on per-team, per-type accuracy from `Game.state.teams`
+ adaptive difficulty state, recommend 3-5 next math types to practice.

**Why**: teachers (and parents) want the game to suggest a focused
training path, not just "pick any 6 of 12 types".

**Design sketch**:
- Compute per-type accuracy for current session + last 10 sessions
  (from STORAGE).
- Sort by: lowest accuracy first, then most-attempted, then
  adaptive-difficulty level.
- Surface as 3-5 chips in the type-picker area with "✨ 建議" tag.
- Tap a chip → toggles the type, adds visual cue.
- Persist recommendation in STORAGE so the user can disable it.

**Owner**: `math-spa-developer` (data + UI) + `regression-tester`
(+ 6 assertions) + `sen-a11y-reviewer` (review).

**Acceptance**:
- Cold start (no history) → default recommendation = 5 easiest types.
- After 1 session → recommendation reflects the session's weak types.
- All 203 assertions pass.

## 3. Question Bank lite (P0)

**Goal**: persist a small curated bank of "good questions" per type
(10-20 per type), rotate them for weak students so they see the same
scaffolded questions twice before randomization takes over.

**Why**: students who struggle with a type benefit from repetition with
minor variation (scaffolding), not full randomization.

**Design sketch**:
- `STORAGE.bank = { [typeId]: Question[] }` (max 20 per type).
- On `startGame`, for each selected type, seed 5 from bank + 5 from
  `Generators[type]()` (50/50 mix).
- After 3 correct of the same type → promote 1 from the bank to
  "mastered", reduce bank weight.
- Reset bank: settings menu option "重設題庫".

**Owner**: `math-spa-developer` (data + persistence) + `regression-tester`
(+ 5 assertions).

**Acceptance**:
- Bank persists across sessions (mg2.bank.v1).
- 50/50 mix is visible in `state.review` after a session.
- Reset clears the bank.
- All 208 assertions pass.

## P1 backlog (deferred)

- Boss gallery (post-boss-defeat progress recap)
- Multi-language TTS (en, zh-CN, zh-TW)
- Parent dashboard (vs teacher)
- Cloud sync (cross-device resume)
- Co-op boss (2 players, 1 boss)
