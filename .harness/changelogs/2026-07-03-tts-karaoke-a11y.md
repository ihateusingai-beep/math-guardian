# TTS Karaoke — SEN / A11y Review (v3.5 P0)

**Reviewer**: `sen-a11y-reviewer`
**Date**: 2026-07-03
**Scope**: TTS Karaoke diff in `index.html` (renderer + TTS module +
teacher modal toggle + CSS) vs. `tests/regression.js` T18 block (already
in place by `regression-tester`).
**Audit bar**: WCAG 2.2 AA + AUDIT4 + AUDIT5 hardening level.

---

## Verdict: **SHIP** (no P0, one P1 acceptable)

All headline a11y properties hold:
- aria-describedby + sr-only description on the new toggle ✓
- reduced-motion blanket covers `.tts-tok` transition ✓
- focus-visible baseline applies to checkbox (native `<input type="checkbox">`)
- no `outline: none` introduced
- Snapshot persists the new setting (rides along existing settings spread)
- `announceToA11y` fires once on toggle change (not on every boundary)
- File size 553.0 KB / 600 KB budget — no bloat risk

One **P1 finding**: the parent `.q-parts` wrapper should expose
`aria-live="off"` so VoiceOver does not re-announce the question on
every `.tts-active` class swap (it currently doesn't, but this is
defensive — see Finding 1 below). Acceptable to defer.

---

## Checklist walk-through

### 1. `.tts-tok` spans — PASS (no fix needed)

**Prompt question**: should the spans carry `aria-hidden="true"`?

**Verdict**: **NO** — adding `aria-hidden` would hide the question
text from screen readers, which is the primary content they need to
announce. `.tts-tok` spans are NOT purely decorative — they ARE the
question text. The visual highlight (`.tts-active` class swap) is
purely CSS and is invisible to screen readers (no role/state/aria
attribute changes).

**Source citations**:
- Renderer emission: `index.html:2929` (`<span class="tts-tok" data-start="${t.normStart}" ...>${disp}</span>`)
- Emoji cluster: `index.html:2940` (one span, full emoji)
- Active state: `index.html:256` (`.tts-tok.tts-active { background: #fde68a; ... }`)
- Screen reader path: `announceToA11y` only fires on correct/wrong
  (line 3810/3818); correct/wrong answer feedback, NOT question text

**Why the prompt's concern is satisfied by absence of fix**:
- `.tts-tok` carries no role / no aria-live / no aria-atomic. Class
  toggles (`tts-active`) are CSS-only — no announcement.
- `aria-live-alerts` (line 3275) is the ONLY live region in the
  document. The question text container
  `#knight-question-text` / `#mage-question-text` (line 1727/1771)
  has no live attribute, so screen readers do not re-announce on
  inner content change.
- No `aria-label` on `.tts-tok` means SR reads raw text. Each char is
  read in context (VoiceOver coalesces CJK runs into a phrase, not
  char-by-char) — same as the non-Karaoke path.

**Conclusion**: pre-existing render path (without `.tts-tok`) and
new Karaoke path produce the SAME text announcement from the screen
reader's perspective. No regression, no fix needed.

---

### 2. `.tts-active` highlight contrast — **PASS** (WCAG AA exceeded)

**Calculation**:
- Highlight bg: `#fde68a` (amber-200) — luminance ≈ 0.838
- Active text: `#0b0d1a` (slate-950) — luminance ≈ 0.008
- Contrast ratio: `(0.838 + 0.05) / (0.008 + 0.05) ≈ 15.3:1`
- **WCAG AAA threshold for normal text: 7:1. Threshold for large
  text: 4.5:1. Result: PASS at 15.3:1.**
- Inactive (no `.tts-active`): no background, parent inherits —
  normal text contrast on the slate-900 question container (line
  1727, `text-4xl md:text-5xl font-extrabold tracking-widest
  text-center` — default white text on `bg-black/40` card) is
  ~15:1, also AAA.

**Source**: `index.html:256-260` (`.tts-tok.tts-active` rule)

---

### 3. `#td-audio-tts-karaoke` toggle — **PASS** (aria-describedby bound, native checkbox semantics)

**Findings**:
- `aria-describedby="td-audio-tts-karaoke-desc"` present on the
  input — `index.html:1911`
- `<span id="td-audio-tts-karaoke-desc" class="sr-only">朗讀題目時
  同步高亮文字 (字 / 詞 跟讀)</span>` — `index.html:1913`
- Native `<input type="checkbox">` exposes `aria-checked`
  automatically based on `checked` attribute — no need for explicit
  `aria-pressed` (the prompt asks for `aria-pressed` but native
  checkbox semantics use `aria-checked`, which is the correct ARIA
  for a checkbox role. Both `aria-pressed` (for toggle buttons) and
  `aria-checked` (for checkboxes) are valid, but `aria-pressed` on
  a `<input type="checkbox">` is a misuse — checkbox role uses
  `aria-checked`).

**Source citation**:
- HTML: `index.html:1909-1914`
- Wire: `index.html:4727-4738` (`onchange` sets
  `Game.settings.ttsKaraoke`, schedules Snapshot, announces)
- Pattern matches sibling toggles (`td-audio-master`, `td-audio-sfx`,
  `td-audio-bgm`, `td-audio-tts`) — all use the same `aria-describedby`
  + sr-only pattern (lines 1889-1908). Consistent with AUDIT4 bar.

**Verdict**: PASS. Native checkbox semantics are sufficient. The
prompt's `aria-pressed` request would actually be a step DOWN from
the existing pattern (other audio toggles don't have it either, and
the team is consistent at using native checkboxes).

---

### 4. Reduced-motion compliance — **PASS** (belt + suspenders)

**Sources**:
- Explicit override: `index.html:366` —
  `@media (prefers-reduced-motion: reduce) { .tts-tok,
  .tts-tok.tts-active { transition: none !important; } }`
- Blanket fallback: `index.html:371-376` —
  `*, *::before, *::after { transition-duration: 0.01ms !important;
  ... }`
- Position: explicit `.tts-tok` rule is at the TOP of the
  `@media (prefers-reduced-motion: reduce)` block (line 361-366),
  exactly as the contract specifies ("kept at the top of the @media
  block so a11y reviewers grep `.tts-tok ... transition: none`
  within a short read distance").

**Verification**: KAR-7 in `tests/regression.js:467-469` already
locks this. The regex is:
```
/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,800}\.tts-tok[\s\S]{0,200}transition: none/.test(src)
```
This passes against current source.

**Verdict**: PASS. AUDIT4-J compliance verified, doubled-checked by
regression assertion.

---

### 5. Touch target — **PASS** (native checkbox ≥ 24px but OK)

**Source**: `index.html:1911` — `<input type="checkbox"
id="td-audio-tts-karaoke" class="w-5 h-5 cursor-pointer" .../>`

`w-5 h-5` = 20×20 px. **This is BELOW the 44×44 px touch target
standard.**

**Mitigation**:
- The checkbox is INSIDE a `<label class="flex items-center
  gap-3 cursor-pointer ml-4">` (line 1910) which spans the FULL
  row width including the text "題目朗讀 — 同步高亮 (TTS
  Karaoke)". Clicking the LABEL toggles the checkbox.
- The label's effective tap area is ~250px wide × ~24px tall (full
  row). The hit zone is the label, not the checkbox box itself.
- WCAG 2.2 SC 2.5.5 Target Size (Minimum) AA: **24×24 px** for
  inputs that have an associated label and where the tap is on
  the label, not the input. The label-as-tap-zone pattern
  satisfies this.

**Verdict**: PASS. The checkbox is technically 20×20 px, but the
**label** is the tap zone (200+ × 24+ px). Consistent with all 4
sibling toggles in the same audio channel block. No regression vs
existing AUDIT5 P1-3 (44px) — that assertion targets `.btn-sm`
buttons (line 459-462), not checkboxes inside labels.

---

### 6. Focus visible — **PASS**

**Source**: `index.html:184-189` —
```css
:focus-visible {
  outline: 2px solid var(--c-accent-amber);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}
```

**Findings**:
- No `outline: none` introduced anywhere in the diff.
- Native browser default focus ring is overridden by the project's
  amber-accent `:focus-visible` rule — applies to ALL focusable
  elements including the new `<input type="checkbox"
  id="td-audio-tts-karaoke">`.
- Tab navigation: the toggle sits in the teacher modal's audio
  channel block (after `td-audio-tts`). Tab order is natural source
  order. Esc closes the modal (existing `trapFocusInModal` at line
  4192 handles focus loop).

**Verdict**: PASS.

---

### 7. `aria-live-alerts` flooding — **PASS** (no flood)

**Audit**:
- `aria-live="polite"` global announcer at line 3275-3282.
- `announceToA11y(msg)` is called from:
  1. `handleAnswer` correct/wrong (lines 3810, 3818) — 1 per
     answer cycle. Not affected by Karaoke.
  2. `wireAudioSettings` Karaoke toggle (line 4737) — 1 per
     user-initiated toggle change.
- **Karaoke boundary events do NOT call `announceToA11y`.**
  Boundary handler at `index.html:2951-2967` only does DOM class
  swap (`.tts-active` add/remove on `.tts-tok` spans). No
  `announceToA11y` call in the boundary path.
- TTS.onend cleanup at line 2997-3003: also DOM-only, no
  announcer call.

**Verdict**: PASS. No screen-reader flooding risk. The boundary
callback fires 8-15 times per question (per-character) but only
mutates classList, which does not trigger `aria-live` announcements.

---

### 8. Master TTS off → Karaoke behavior — **PASS** (graceful)

When `TTS.enabled === false` (`td-audio-tts` checkbox off):
- `TTS.speak` early-returns at line 2225 — no `speechSynthesis`
  call, no boundary callback.
- `Game.settings.ttsKaraoke` is independent of `td-audio-tts`
  (per contract). Karaoke remains visually inert (no highlight
  ever fires).
- Renderer still emits `.tts-tok` spans even when TTS is off —
  this is a tiny visual cost (no functional impact). Acceptable.

**Verdict**: PASS. Graceful degradation matches contract.

---

### 9. Snapshot / persistence — **PASS**

`Game.settings.ttsKaraoke` rides along via existing settings spread:
- `Snapshot.flush` line 4855: `settings: { ...Game.settings }`
  (verified `index.html:4855` — comment says "V3.5-P0: ttsKaraoke
  rides along via the settings spread")
- `Snapshot.resume` line 4896: `{ ...s.settings }` spread
  restores

KAR-6 locks both directions (line 463-465). Already passing.

**Verdict**: PASS. No new storage schema needed.

---

### 10. Color contrast on toggle text — **PASS**

The label text "題目朗讀 — 同步高亮 (TTS Karaoke)" inherits the
modal's default text color (white) on the modal's `bg-black/60`
backdrop. White on near-black is ~17:1, well above AAA.

**Verdict**: PASS.

---

### 11. Semantic HTML — **PASS**

- `<input type="checkbox">` is the correct element for a binary
  on/off setting. Not misused as a `<div>` or `<button>`.
- `<label>` wraps the checkbox AND the visible text — click on
  text toggles the checkbox. Native semantic pairing.
- `<span id="td-audio-tts-karaoke-desc" class="sr-only">` follows
  the existing sr-only pattern (line 190-194). Consistent.

**Verdict**: PASS.

---

### 12. Boss intro / end screen / no surprise audio — N/A

Karaoke is a per-question visual highlight. It does not trigger on
boss intro, end screen, or surprise audio events. The cancel path
(line 2266) ensures no stale `.tts-active` survives boss change
(because `showQuestion` calls `TTS.cancel` at line 2978 which now
also clears `.tts-tok.tts-active`).

**Verdict**: N/A (no regression vector here).

---

### 13. Keyboard nav — **PASS**

- Tab into the toggle works (native checkbox focusable).
- Space toggles the checkbox (native browser behavior).
- Esc closes the teacher modal — `wireAudioSettings` does not
  intercept Esc, so existing `trapFocusInModal` (line 4192) handles
  it.

**Verdict**: PASS.

---

### 14. Touch on mobile (`.tts-tok` itself) — **PASS**

`display: inline-block; padding: 0 0.15em; border-radius: 0.25rem;`
on `.tts-tok` adds small clickable area but `.tts-tok` has no click
handler (`onclick` only on `.tts-btn`, not on `.tts-tok`).
Touch-action: manipulation at line 167 (project-wide) disables
double-tap zoom. No accidental click risk.

**Verdict**: PASS. The padding-only hit zone increase does not
interfere with anything because there's no click handler.

---

## Findings table

| # | Location | Severity | Description | Suggested fix | Suggested assertion shape |
|---|---|---|---|---|---|
| 1 | `index.html:2851-2875` (renderer) | **P1** (acceptable) | `.q-parts` wrapper has no `aria-live="off"` / `aria-atomic` attribute. If any browser's screen reader treats repeated class swaps on child spans as "live region updates" (some VoiceOver versions have this edge case with rapid classList.add/remove on inline-block spans), it could re-announce the question on each highlight boundary. | Add `aria-live="off"` and `aria-atomic="false"` to the `.q-parts` outer wrapper as defensive measure. Or wrap the question-text container with `role="presentation"` on the `.tts-tok` spans (more invasive). | (Optional) `assert('A11y-A1  q-parts wrapper has aria-live=off', /<span class="q-parts"[^>]*aria-live="off"/.test(src))` |
| 2 | `index.html:4727-4738` | P3 (informational) | Karaoke toggle handler calls `announceToA11y("TTS 同步高亮已開啟/關閉")` — message is correct but mixing Chinese + English ("TTS" acronym in a zh-HK announcement). Minor — consistent with the rest of the project where "TTS", "BGM", "HP" are accepted. | None (consistent project style). | — |
| 3 | `index.html:1911` | P3 | Checkbox is 20×20 px (below 44×44 px standard). Mitigated by full-row `<label>` tap zone. | Consider adding `min-h-[44px] min-w-[44px]` to the checkbox directly (would push other siblings in the column). Currently P3 because label-tap-zone satisfies WCAG 2.2 SC 2.5.5. | (Optional) `assert('A11y-A2  td-audio-tts-karaoke label has cursor-pointer', /<label class="flex items-center gap-3 cursor-pointer ml-4">[\s\S]{0,200}id="td-audio-tts-karaoke"/.test(src))` |
| 4 | `index.html:2947-2950` (comment) | P3 | The comment "Chromium fires charIndex = t.length at the last word boundary — past the last span" implies the last token never gets highlighted — student visually sees the highlight "stuck" on the penultimate token until `onEnd` clears it. Minor UX wart. | None for v3.5 P0 ship. Consider adding fallback `if (charIndex >= lastTok.normEnd) lastTok.classList.add('tts-active')` for next iteration. | — |

**No P0 findings.**

---

## Files reviewed

- `index.html:240-370` — CSS for `.tts-tok`, `.tts-tok.tts-active`,
  `@media (prefers-reduced-motion: reduce)` block (PASS)
- `index.html:1885-1916` — Teacher modal audio channel block,
  including new `#td-audio-tts-karaoke` toggle (PASS)
- `index.html:2199-2267` — `TTS` module `speak` / `cancel` with
  new `opts` arg (PASS)
- `index.html:2842-2968` — `UI.renderQuestionTextFor` +
  `_ttsKaraokeBuildMap` + `_ttsKaraokeWrapText/Emoji` +
  `_ttsKaraokeBoundary` (PASS)
- `index.html:2970-3006` — `UI.showQuestion` TTS button wiring
  with `onBoundary` / `onEnd` (PASS)
- `index.html:3275-3282` — `announceToA11y` (PASS — not flooded
  by boundary events)
- `index.html:3720-3737` — `showInstantHint` now calls
  `TTS.cancel()` before `TTS.speak(hint)` (PASS — prevents visual
  bleed)
- `index.html:4692-4739` — `syncAudioSettingsUI` / `wireAudioSettings`
  (PASS — toggle wired, announces once)
- `tests/regression.js:434-489` — T18 block (8 named IDs, 12
  individual asserts) (PASS — already in place by regression-tester)

---

## Regression coverage

| Property | Assertion | Status |
|---|---|---|
| TTS.speak 3rd `opts` arg accepted | KAR-1 | ✓ in place |
| TTS.cancel clears `.tts-active` | KAR-2 | ✓ in place |
| Renderer emits `.tts-tok` when `ttsKaraoke` enabled | KAR-3 | ✓ in place |
| showQuestion TTS button passes `onBoundary` | KAR-4 | ✓ in place |
| Teacher modal toggle id present | KAR-5 | ✓ in place |
| Snapshot persists via settings spread | KAR-6 | ✓ in place |
| Reduced-motion disables `.tts-tok` transition | KAR-7 | ✓ in place |
| Toggle `aria-describedby` + sr-only desc | KAR-8 | ✓ in place |

**No additional assertions required for SHIP.**

(Optional P1 hardening — if Finding #1 is accepted for next cycle:)
- `A11y-A1  q-parts wrapper aria-live=off` — 1 assertion.

---

## Stop conditions met

- Review filed at `.harness/changelogs/2026-07-03-tts-karaoke-a11y.md`
  ✓
- All 7 prompt checklist items answered (1 N/A → 6 PASS) ✓
- No P0 finding → **SHIP verdict** ✓
- All P1 findings either acceptable to defer (Finding 1) or
  informational (Findings 2-4) ✓
- Regression coverage confirmed (T18 block already locks every
  a11y-critical invariant) ✓
- Manual smoke test handoff: `/tmp/v35_karaoke_*.png` capture is
  tts-karaoke-specialist's scope, not this reviewer's.

---

## Hand-off notes for tts-karaoke-specialist (manual smoke)

When you smoke test:
1. **Tab order**: open teacher modal → Tab from td-audio-tts to
   td-audio-tts-karaoke → focus ring should be amber + 3px offset.
2. **VoiceOver (zh-HK)**: question text should read once on
   question change, NOT char-by-char as the highlight moves. If
   VoiceOver DOES read char-by-char, that's Finding #1 triggering
   in real conditions — file an issue.
3. **Reduced-motion**: macOS → System Settings → Accessibility →
   Display → Reduce motion ON. Reload. Press TTS button. Highlight
   should snap instantly, no 0.12s fade.
4. **Touch target**: iPhone 12 (375×812) → teacher modal → tap
   anywhere on the Karaoke label row. Should toggle. Tap on the
   checkbox itself (20×20) — also toggles because label wraps.
5. **aria-live announcer**: enable VoiceOver → toggle Karaoke
   off→on→off rapidly. Should hear "TTS 同步高亮已關閉 / 開啟"
   once per toggle, not on every speech boundary.