# AGENTS.md

Math Guardian (數學守護者：精準訓練版 **v3.6**) — single-file HTML SPA
for Hong Kong moderate-ID SEN math practice (easy scopes + dual board).
Vanilla JS + Tailwind CDN, no build, GitHub Pages.

## Setup

- Open `index.html` or `python3 -m http.server 8000`
- Tests:
  - `node tests/regression.js` → **797 pass / 0 fail** (structural regex lock-in, cycle 53–106)
  - `node tests/generator-audit.js` → **4493 pass / 0 fail** (functional truth-table, cycle 101+)
  - `node tests/audio-audit.js` → **12 pass / 0 fail** (audio call-site × export cross-check, cycle 105+)
- No lint / typecheck / build
- Live: https://ihateusingai-beep.github.io/math-guardian/

## Layout

```
.
├── index.html              # entire runtime (~529 KB raw / ~136 KB gzip)
├── TODO.md                 # project plan / next backlog
├── docs/                   # current engineering docs
│   ├── VISUAL_QUALITY_RUBRIC.md   # cycle106 — 視覺 rubric + 評分 + state matrix + profiles
│   ├── ART_STYLE_GUIDE.md         # cycle106 — 美術實作規則 (grid / palette / timing / export)
│   ├── UI_STYLE_GUIDE.md          # cycle106 — 遊戲 UI 規則 (構圖 / 掣狀態 / a11y)
│   ├── AUDIO_VIDEO_OPTIMIZATION.md # cycle104/105 — media pipeline audit
│   ├── ARCHITECTURE_REVIEW.md     # cycle96 — code architecture review
│   └── screenshots/                # cycle106 — before/after evidence 幀 (17 張 JPEG)
├── tests/regression.js     # structural regex lock-in
├── tests/generator-audit.js # functional truth-table (generators × 30 trials)
├── tests/audio-audit.js    # audio pipeline audit (call-site × export cross-check)
└── .harness/               # changelogs, docs, plans
```

## Gates (every cycle)

1. `node tests/regression.js` → 0 fail  
1b. `node tests/generator-audit.js` → 0 fail  
1c. `node tests/audio-audit.js` → 0 fail  
2. Extract largest inline `<script>` → `node --check`  
3. Optional live probe: easy startGame per scope + dual arena  
3b. **Visual change? → re-capture affected states + re-measure contrast** (見下)  
4. One cycle = one commit message style: `Math Guardian v3.6 — cycle N (…)`  
5. Ken **`Push`/`Live`/`順序`** = commit + push `main` (Pages). AGENTS “don’t push” overridden by Ken.

### Visual verification (cycle 106 起)

任何改動 UI / CSS / token 嘅 cycle,要用 headless Chrome + CDP 覆核,唔好靠肉眼:

```bash
# 1. 起 local server
python3 -m http.server 8811 &
# 2. Chrome --headless=new --remote-debugging-port=9333 → CDP
#    Emulation.setDeviceMetricsOverride(1440×900) + Page.captureScreenshot
#    Runtime.evaluate → getComputedStyle / getBoundingClientRect
# 3. 對 PNG 取樣計 WCAG 對比度(見 docs/VISUAL_QUALITY_RUBRIC.md §4)
```

最低要求:改咗對比度/掣/版面,起碼量一次 `getComputedStyle` + 影一張受影響 state。
Rubric / 目標風格 / 基準喺 **`docs/VISUAL_QUALITY_RUBRIC.md`**。

## Lock-in discipline

- Every behavior change lands a matching assertion in `tests/regression.js`
- Assertions = source regex only (no DOM)
- File budget: `index.html` raw **< 600 KB** (current: ~529 KB / 541,798 bytes)
- **Functional truth-table** (`tests/generator-audit.js`) catches arithmetic / math correctness
  bugs that regex tests cannot see (e.g. cycle55 orderAsc/Desc20 random-as-arithmetic).
  Runs all 23 generators x 30 trials with deterministic randInt -- catches infinite loops,
  out-of-range values, broken arithmetic invariants.
- **Visual lock-in** (cycle106, T106): dead CSS / 高度鏈 / 對比度 / off-by-one 全部有 assertion。
  最重要嗰條: **全檔唔准再出現 Tailwind `apply` 指令**(見 Design system)。
- Student UI: **no** stigma「SEN」label; MC **A/B/C** badges by **render order**
- `startGame`/resume helpers must be **module scope** (not nested in `setupMenu`)

## Media (audio / video)

**No audio files, no video files, no data URIs.** All sound is synthesized at
runtime via Web Audio API (`Audio` IIFE, index.html:4761-4979); narration uses
the Web Speech API (`TTS`, index.html:4983-5088); all "video" is CSS `@keyframes`
(63 total) + DOM particles. The only visual asset payload is 35 inline SVG
symbols (~42 KB). Media payload downloaded: **0 bytes**.

- Full audit + sound-effects map + music map: **`docs/AUDIO_VIDEO_OPTIMIZATION.md`**
- 3 runtime bugs **FIXED in cycle 105**:
  - `Audio.tick()` called @6643 but not exported -> TypeError  (now exported)
  - `Audio.beep(440, 0.08)` called @10160 but not exported -> TypeError  (now exported)
  - private `bgmInterval` read @11771 -> always `undefined` -> BGM never
    resumed after tab background (now `Audio.isPlaying()` accessor)
- `tests/audio-audit.js` cross-checks every `Audio.*` / `TTS.*` call site
  against the module exports -- would have caught all 3 bugs
- Still open (tracked P1, see docs/AUDIO_VIDEO_OPTIMIZATION.md):
  - `masterGain` (index.html:4762) declared and never used -> no master gain
  - `Audio.countdown` exported but has zero call sites
  - `noise()` allocates a fresh AudioBuffer per call (up to 96 KB)

## Design system (v3.6 cycle97)

**Use semantic utility classes — not raw color.**

| Token | Default (粉藍) | Snow theme | 用途 |
|---|---|---|---|
| `--c-text-on-light` | `#1e293b` (dark) | `#f0f9ff` (light) | 暗 text 喺淺 card |
| `--c-text-on-dark` | `#f0f9ff` (light) | `#1e293b` (dark) | 淺 text 喺暗 card |
| `--c-bg-card-light-translucent` | `rgba(255,255,255,0.55)` | `rgba(15,23,42,0.55)` | 淺 card 半透明 |
| `--c-border-light` | `rgba(30,41,59,0.18)` | `rgba(255,255,255,0.18)` | 淺 border |
| `--c-text-on-night` | `#e2e8f0` (light) | **同樣 light**(唔翻轉) | **夜晚場景 / 固定深色 surface** |
| `--c-text-on-night-muted` | `rgba(226,232,240,0.75)` | 同樣 | 同上,次要文字 |

**Apply via utility classes** (auto-flip with theme):
- `class="text-on-light"` / `text-on-dark` / `text-on-light-muted` / `text-on-dark-muted`
- `class="bg-card-light-translucent"` / `bg-card-dark-translucent`
- `class="border-light"` / `border-dark`

**唔跟 theme 翻轉嘅深色 surface**(夜晚場景、`bg-slate-800/900` modal、`.sen-panel`、對戰 panel):
- 用 `class="text-on-night"` / `text-on-night-muted`
- ⚠️ **cycle 106 教訓**:判斷用邊個 token 要**睇實際背景,唔好睇 theme 名**。
  cycle 81 假設 menu 背景係粉藍淺色所以用 `text-slate-800`,但實際渲染係夜空深藍 → 對比度 1.06:1 完全隐形。
  `bg-slate-800/900` modal 唔跟 theme 變,所以用會翻轉嘅 `text-on-dark` 一樣會喺 snow theme 失效。

**Do NOT** use raw `text-amber-700` / `text-slate-700` — they don't flip with theme. See cycle 95 history.
**cycle 106 再加**:raw `text-slate-600/700/800` 落深色 surface 亦都要換成 `text-on-night*`(已遷移 44 處)。

**Do NOT** use Tailwind `apply` 指令喺呢個 `<style>`(cycle 106 P0-A):
- 本 `<style>` **冇** `type="text/tailwindcss"` → Tailwind Play CDN **唔會 process** `apply` → 該 rule 直接死掉
- 實測後果:onboarding 進度掣 / 老師面板掣 / Boss 答案掣全部隐形或變形
- 改法:寫原生 CSS(數值 = Tailwind v3 對應 utility),見 `index.html` 按鈕區註釋
- `tests/regression.js` T106 有 lock-in:**全檔唔准再出現 apply 指令**

**Already-migrated**:
- `.menu-section-card` (cycle97)
- `.opt-scope-preset` (cycle97)
- `.opt-track/.opt-play/.opt-solo-skin/.opt-mode/.opt-bridge/.opt-scope` unselected (cycle97)
- end-screen, teacher modal, review section, sen-done-mask (cycle95)
- teacher modal / Boss panel / confirm modal / 夜晚場景 header (cycle106 → `text-on-night*`)

**Refactor roadmap**: see `docs/ARCHITECTURE_REVIEW.md` (cycle96) · 視覺規則見 `docs/UI_STYLE_GUIDE.md` (cycle106)

## Architecture ground truth (v3.6)

### Easy main path
- Home **scopes**: `count20` (1–10) · `compareLength` · `orderAsc20` · `orderDesc20`
- One-click start: `types = scopes` · 10 Q goal · identity card · 金銀銅
- Play: `solo` | `dual` touch-board；dual arena `versus` 扯大欖 / `coop` 推船
- **cycle52**: dual easy-start must **keep** versus/coop pick (never force coop)

### Question pipeline
- `TYPE_REGISTRY` + `Generators` + `QuestionGen.make` + bank rotate (`mg2.bank.v3`)
- Layouts: numeric / parts-emoji / bars / seq-choice / clock / shape / order / …
- `QuestionRenderer` must cover every layout used
- SEN screen: `showQuestionSEN` + `SEN_COPY` + visuals (`_countVisualHTML`, `_lengthBarsHTML`)

### cycle53–59 (TODO batch)
| # | Change |
|---|--------|
| 53 | 長短答案 **黃條/紫條**（唔用 A/B 撞手勢） |
| 54 | 數數 grid **每 5 一行** |
| 55 | 順序 = 兩數後 **邊個跟住？** |
| 56 | diff-helper + 進階「老師覆寫」 |
| 57 | scope bank seeds + bank v3 |
| 59 | onboarding 3 步；dual 藏 length units |

### Shared helpers (do not duplicate)
`_lengthBarsHTML` · `_appendChoiceGrid` · `_countVisualHTML` · `_isEasyMode/_isDualPlay/_isCoopTeam` · `_teamEmoji` · `_pulseEl` · `SEN_COPY`

## Testing notes

- Structural only; body growth may need **wider** regex windows (see EASY/F-17 history)
- New type → update T1 `expectedIds` + layouts + EASY lock-ins

## Security

- No secrets in source. Optional MiniMax key only via teacher modal runtime paste.
- localStorage `mg2.*` namespaced; no PII required.

## Plan pointer

- Active backlog: `TODO.md`
- Historical v3.5 P0 (TTS karaoke / 推薦 / bank) = **SHIPPED** — see `.harness/docs/v35-roadmap.md`
