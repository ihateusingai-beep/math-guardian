# Regression Lock-In Discipline (189 assertions)

The 189-assertion count is the project's quality bar. Every cycle adds
to it; no cycle subtracts. This doc explains the rules for landing a
new assertion.

## What "lock in" means

An assertion is "locked in" when:

1. It exists in `tests/regression.js`.
2. It references a real source-level invariant (string literal, function
   name, regex on the source).
3. It is grouped under a labelled `console.log('\n[T##] ...')` block.
4. It has a clear failure message that points the next developer at the
   source location.
5. The count is mentioned in `changelogs/YYYY-MM-DD.md` for the cycle it
   landed in.

## The runner

```bash
cd /Users/kencheng/workspace/vs\ code/education/math/team\ game
node tests/regression.js
```

Pure-Node. Zero deps. Reads `index.html` as a string with
`fs.readFileSync`. ~0.3s runtime.

Output:
```
[T1] TYPE_REGISTRY schema
  ✓ TYPE_REGISTRY block present
  ✓ 12 type entries
  ...
[T17] V3.4 audit cycle-5 patches
  ✓ AUDIT5-P1  Audio channels state object present
  ...

========== 189 pass / 0 fail ==========
```

## Assertion shapes

Three flavours:

### 1. `eq(name, actual, expected)` — exact JSON equality

```js
eq('sym keys', [keypadArr[1], keypadArr[2], keypadArr[3]], ['<','=','>']);
```

Use for: literal arrays, string content, count of matched groups.

### 2. `assert(name, cond, hint)` — boolean

```js
assert('AUDIT5-P1  TTS cancel-on-question-change',
  /showQuestion\(team\) \{[\s\S]{0,300}TTS\.cancel\(\)/.test(src));
```

Use for: source-pattern presence, regex matches, count thresholds.

### 3. Multi-line slice for context-sensitive checks

```js
const endGameMatch = src.match(/function endGame\(victory\)\s*\{[\s\S]*?Audio\.stopBGM\(\);[\s\S]{0,400}/);
const endGameSrc = endGameMatch ? endGameMatch[0] : '';
assert('AUDIT2-B5  endGame clears paused state', endGameSrc.includes('Game.state.paused = false'));
```

Use for: asserting that a fix lives inside a specific function body
without false positives from other places in the source.

## Naming convention

`AUDIT{N}-{letter}  {short description}` — e.g. `AUDIT5-P1  HP slider
aria-valuetext initial`. The audit-number anchors the assertion to the
cycle, the letter is the sub-bucket.

## Grouping convention

```js
// =========== T18: V3.5 TTS Karaoke ===========
console.log('\n[T18] V3.5 TTS Karaoke');
// (assertions)
```

T-sections are sequential. T1–T17 used. Next is T18.

## What NOT to assert

- ❌ Behavior that needs DOM (use a screenshot instead)
- ❌ Network behavior (no fetch mocks in the suite)
- ❌ Random-number ranges (the generators are deterministic enough —
  assert the generator function exists, not its output)
- ❌ Eager: don't assert that something is NOT in the source unless
  the absence is the contract. Negative assertions are fragile
  (refactor triggers false fail).
- ❌ Comments / whitespace / line numbers (refactor breaks these)

## What TO assert

- ✓ Function names exist (`/function showInstantHint\(/.test(src)`)
- ✓ State machine transitions (state setters inside known function
  bodies)
- ✓ ARIA attributes on known element IDs
- ✓ TTS / Audio / Snapshot API shape
- ✓ CSS rules that back up a behavioral claim
- ✓ Module exports (`Audio.setChannel`, `TTS.cancel`, etc.)
- ✓ `T16: file size budget` — single line, prevents bloat drift

## Cycle handoff

When a cycle closes, the regression-tester rein:
1. Confirms `node tests/regression.js` exits 0.
2. Reports the new total: "189 → 197 pass / 0 fail".
3. Adds a line to `changelogs/YYYY-MM-DD.md`:
   ```
   ## Cycle 6 — v3.5 TTS Karaoke (197 assertions, +8)
   ```
4. Tags the commit with the same `+N` deltas as the assertion
   expansion.
