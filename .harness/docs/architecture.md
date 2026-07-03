# Architecture — Math Guardian v3.4

## File layout (single-file SPA)

```
math-guardian/
├── index.html              # 568 KB / 5166 lines — the entire runtime
│   ├── <head>              # viewport, theme-color, Tailwind CDN, tailwind.config
│   ├── <style>             # design tokens, theme-snow, btn-, snow key variants
│   ├── <body>              # all DOM, all SVG sprite defs
│   └── <script>            # all JS (line 1935 → 5163)
│       ├── TTS             # 2163 — speech synthesis wrapper, zh-HK voice
│       ├── Compliment      # 2230 — 港式粵語 encouragement pool (60/60/12) + AI upgrade
│       ├── FX              # 2306 — meteor, burst, confetti, screen shake
│       ├── TYPE_REGISTRY   # 2414 — 12 math types: id/label/mode/layout/desc
│       ├── Generators      # 2432 — per-type math problem generators
│       ├── QuestionGen     # 2517 — registry-driven dispatcher
│       ├── Game            # 2642 — settings + state machine + handleAnswer
│       ├── UI              # ~2780 — renderers, showQuestion, showInstantHint, etc.
│       ├── Snapshot        # 4652 — autosave + 24h resume
│       ├── STORAGE         # localStorage wrapper
│       ├── Bosses          # 4830 — boss registry + sprite scene theme
│       ├── BOSS_HERO       # 4830 area — AI-generated base64 portraits
│       └── announceToA11y  # 3106 — aria-live announcer
└── tests/
    └── regression.js       # 445 lines / 189 assertions — pure-Node zero-deps
```

## Module ownership

| Module | Line | Owns |
|---|---|---|
| `TTS` | 2163 | speech synthesis, normalize, cancel, setEnabled |
| `Compliment` | 2230 | encouragement pool, AI upgrade via MiniMax API |
| `FX` | 2306 | meteor, burst, confetti, screenShake |
| `TYPE_REGISTRY` | 2414 | 12 math type definitions |
| `Generators` | 2432 | per-type problem generators (numeric/parts-emoji/etc) |
| `QuestionGen` | 2517 | make(type, mode) dispatcher + choice option generation |
| `Game` | 2642 | settings, state, handleAnswer, adaptive difficulty |
| `Snapshot` | 4652 | throttled autosave + 24h expiry resume |
| `Bosses` | 4830 | boss registry, sprite, scene theme, hero portraits |
| `STORAGE` | (around 4500) | localStorage key prefix `mg2.*` |

## Game state flow

```
[menu] → startGame() → [in-game] → endGame() → [end screen]
                  ↑                  ↓
                  └── resume() ←── Snapshot (24h)
```

`startGame()` (line 3414):
- Validates `Game.settings.types` against TYPE_REGISTRY
- `TTS.cancel()` (AUDIT5)
- Resets timer state flags (`_startAt`, `_frostTickAt`)
- Hides pause-overlay
- Applies boss sprite + scene theme
- Resets adaptive difficulty
- Sets boss HP from slider, resets castle, review, ult state

`UI.showQuestion(team)` (line 2816):
- `TTS.cancel()` on every question change
- Renders text (parts-based, joined)
- Wires TTS button onclick
- Dispatches answer area by `reg.layout`:
  - `sym-button` → 3 buttons (compare10)
  - `order` → click-sequence buttons (ordering)
  - `clock` → SVG clock + numeric keypad hint
  - `shape` → SVG shape + 4 options
  - `parts-emoji` → emoji grid + 4 options OR numeric keypad
  - `numeric` → text + 4 options OR numeric keypad

`Game.handleAnswer(team, value, btn)` (line 3564):
- Triple-path compare: array (ordering) / number / string fallback
- Triggers ult if `state.pendingUlt.team === team`
- HP, energy, score, streak
- Calls `Compliment.pick('correct'|'wrong'|'streak', s)`
- Plays FX + Audio
- Optional `showInstantHint` on wrong
- `announceToA11y('答啱喇' / '答錯')`

`showInstantHint(team, q)` (line 3529):
- Layout-specific hint text
- Overlay created + cap to 1 (AUDIT3)
- TTS speaks hint if enabled
- Click-to-dismiss + 4s auto-dismiss

`endGame(victory)` (line 3857):
- Clears `paused` state (AUDIT2)
- Hides pause-overlay (AUDIT2)
- Snapshot final state
- `showEndScreen(victory)` → portrait + aria-live announce

## A11y touchpoints (AUDIT4 + AUDIT5)

- `aria-live-alerts` — global announcer (correct/wrong/boss spawn)
- `trapFocusInModal(modal)` (line 4192) — teacher modal, confirm modal
- `boss-hp-track` with `role=progressbar` + `aria-valuenow` + `aria-valuetext`
- `hp-slider` with `aria-valuenow` + `aria-valuetext` (line 316, AUDIT5)
- `opt-win / opt-mode / opt-team` with `role=radiogroup` + `aria-pressed`
- `opt-type` with `aria-label` including difficulty + selected state
- Per-channel audio: master / sfx / bgm / tts toggles in teacher modal
- TTS cancel-on-question-change + cancel-on-startGame
- `prefers-reduced-motion: reduce` blanket rule
- Touch targets: `.btn-sm` min 44×44 px
- T-key retry: `revealLatestReviewAnswer()` (line 4173)
- Boss portrait alt synced from `Bosses.current.name`
- Esc stack: pause-overlay skipped if teacher-modal open

## Snapshot schema (mg2.session.v1)

```js
{
  v: 1,
  savedAt: <ms>,
  reason: 'autosave'|'beforeunload'|'pagehide'|'manual',
  settings: { ...Game.settings },
  state: {
    bossHp, bossMaxHp, castle, teams, review, currentTeam,
    timeLeftSec, pendingUlt, pendingUltQ, current,
  }
}
```

24h expiry enforced in `Snapshot.load()`.

## File-size budget

- Current: 568 KB / 5166 lines
- Hard limit: 600 KB
- T16 assertion: `src.length / 1024 < 600`
- If a change pushes > 600 KB, ship a counterweight:
  - Drop unused SVG sprite
  - Prune a hardcoded pool (Compliment can be AI-upgraded)
  - Inline a 1-2 KB sprite instead of base64

## v3.5 P0 backlog

1. **TTS Karaoke** — word/char highlight sync to `speechSynthesis` boundary
2. **自動推薦** — recommend next math type from per-type accuracy
3. **Question Bank lite** — persist a small bank per type, rotate for weak
   students
