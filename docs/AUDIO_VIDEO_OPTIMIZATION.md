# Math Guardian v3.6 — Audio & Video Media Pipeline Analysis

**Status**: analysis only — no implementation changes shipped with this document.
**Date**: 2026-10-24
**Scope**: complete audio + video media system audit, sound-effects map, music map, and optimization proposals.
**Author**: Mavis (media pipeline / performance review)

> ⚠️ **cycle111h（2026-10-28）檔案結構變更**：原本嘅單檔 `index.html` 已拆成
> `index.html`（HTML + CSS + SVG）＋ `app.js`（主程式）。**本文入面所有
> `index.html:NNNN` 行號都係舊單檔版嘅歷史座標**，code 而家喺 `app.js` 入面
> （行號亦已因註解清理而變）。查證時請用 **function / module 名**定位，
> 唔好淨靠行號。模組位置（已更新）：`Audio` = `app.js:581-927` ·
> `TTS` = `app.js:931-1042` · `noise()` cache / bus graph 見 §0「Update — cycle 111g」。

---

## 0. Executive summary

Math Guardian has **no audio files, no video files, and no data URIs**. All sound is
**synthesized at runtime** with the Web Audio API; all "video" is CSS and DOM
particle animation. There is no asset pipeline, no loader, no cache, no decoder,
and no format negotiation — because there is nothing to load.

That architecture is unusually good for download size (the entire 535 KB page
contains **zero bytes** of media payload) and unusually fragile in three
specific ways that this review found and verified:

| # | Finding | Severity | Status |
|---|---|---|---|
| B1 | `Audio.tick()` called at `index.html:6643` but never exported → runtime `TypeError` | 🔴 P0 | ✅ **FIXED in cycle 105** |
| B2 | `Audio.beep(440, 0.08)` called at `index.html:10160` but never exported → runtime `TypeError` | 🔴 P0 | ✅ **FIXED in cycle 105** |
| B3 | `Audio.bgmInterval` read at `index.html:11771` but never exported → always `undefined` → **background music never resumes** after the tab is backgrounded | 🔴 P0 | ✅ **FIXED in cycle 105** |
| A1 | `masterGain` declared at `index.html:4762` and never used — there is no master gain node, no volume control, and no ducking capability | 🟠 P1 | ✅ **FIXED in cycle 111g**（真 bus graph + 主音量 slider + ducking） |
| A2 | `Audio.countdown` is exported but has zero call sites — the "last 10 seconds" timer has no sound | 🟠 P1 | Verified, unfixed |
| A3 | BGM is driven by `setInterval(180ms)` and SFX by `setTimeout` chains — timer-based, not sample-accurate; drifts and jitters | 🟠 P1 | Verified, unfixed |
| A4 | `noise()` allocates a fresh `AudioBuffer` on every call (up to 96 KB) — 408.8 KB of garbage per full SFX pass | 🟠 P1 | ✅ **FIXED in cycle 111g**（buffer cache：全場 1 個，93.8 KB） |
| A5 | BGM never plays on the home menu; `Game.settings.menuTrack` (`class` \| `boss`) has no audio effect at all | 🟡 P2 | Verified, unfixed |
| A6 | Easy mode inherits a **boss** scene BGM (forest/snow/lava/shadow/crystal) — no calm learning track exists | 🟡 P2 | Verified, unfixed |
| A7 | The BGM loop is **7.2 s**. In a 5-minute session the identical 8-note bass pattern repeats **208 times** | 🟡 P2 | Verified, unfixed |
| A8 | No voice limit, no node pooling, no node reuse — every SFX allocates fresh oscillator/gain/filter nodes | 🟡 P2 | Verified, unfixed |
| A9 | No offline support, no service worker, no web app manifest — the game cannot be used in a classroom with flaky Wi-Fi | 🟡 P2 | Verified, unfixed |

### Update — cycle 105 (2026-10-24)

The two highest-leverage items in this review were **fixing the three runtime
bugs** and **adding one automated cross-check test** that catches all three.
**Both shipped in cycle 105:**

- `Audio.tick` and `Audio.beep` are now exported; `Audio.isPlaying()` replaces
  the private `bgmInterval` read at the `visibilitychange` handler.
- `tests/audio-audit.js` cross-checks every `Audio.*` and `TTS.*` call site
  against the module's exported members, asserts every exported SFX produces at
  least one voice, and asserts the three specific bugs stay fixed. It reports
  **12 pass / 0 fail**, and a meta-test confirmed it fails (6 assertions) when
  all three bugs are reintroduced.

Everything else in this document remains a proposal. The remaining tracked P1
items (`Audio.countdown` never wired, timer-based scheduling) are surfaced by
`tests/audio-audit.js` as reported metrics so they stay visible without failing
the gate.

### Update — cycle 111g (2026-10-28)

Cycle 111g used the `audio-design` skill to turn the audit's **A1** (dead
`masterGain`) and **A4** (per-call noise buffer) into real, guarded behaviour.
The whole audio graph was rebuilt around a **bus architecture**:

```
ctx.destination
      ↑
  masterGain            ← Master bus（總音量 · slider）
      ↑            ↑
  sfxGain        bgmDuckGain   ← Duck bus（獨立節點，唔會覆寫玩家嘅 slider）
                    ↑
                  bgmGain       ← BGM 音量 bus
```

| 項目 | 之前 | 而家 |
|---|---|---|
| Master gain | `masterGain` 宣告咗但**從來冇接線** → 成個模組冇 master gain | 真 `masterGain → ctx.destination` |
| 音量控制 | **冇**（`channels` 只有 on/off） | `Audio.setMasterVolume(0..1)` + 教師台 slider，持久化落 `Profile.data.masterVolume` |
| slider 映射 | — | **平方**（`g = s²`）：raw linear amplitude 會將大部分聽覺變化擺喺底部 1/5 |
| Ducking | **冇**（語音同 BGM 一齊出，學生聽唔清題目） | `Audio.duckBGM()` + **獨立** duck bus；TTS 朗讀時壓低 BGM ≈ −12 dB |
| `noise()` buffer | 每次 `createBuffer`（全場 9 個 = 343.1 KB） | **cache：全場 1 個**（0.5 s = 93.8 KB），靠 `loop` + 隨機 offset 變化 |
| BGM 變奏 | 每個 scene 固定 8/10 步循環 → 機械重複 | 每個 arp phrase 洗牌一次（bass 保持落腳點） |

**Guard rails added (cycle 111g)**

- `tests/audio-audit.js` — the mock `AudioContext` now records **every
  `connect()` edge**, so the bus graph is verified by *actual topology*, not by
  grepping how many times `masterGain` appears. New gates `A111g-01..12`.
  `masterGain references` went from **1 → 10**, and `noise buffers alloc` from
  **9 (343.1 KB) → 1 (93.8 KB)**.
- `tests/regression.js` — `T111g-01..14` (structural locks).
- `tests/visual/scenarios/teacher-audio-panel.mjs` — 8 assertions: the slider
  really drives the master bus, the gain is **squared**, 0 % is true silence,
  the teacher-panel labels meet WCAG AA on the dark modal, and the panel does
  not overflow at 639×669.

**Collateral fix found while adding the slider** — the teacher modal's audio
checkboxes had **no `text-on-night`**, so their labels inherited the body's
`--c-text-primary` (`#1e293b`, dark) on a `bg-slate-900` surface: **dark text
on a dark background, invisible**. AGENTS.md cycle-106 rule (dark surface ⇒
`text-on-night*`) now applies to that whole block.

**Still open**: A2 (`Audio.countdown` has zero call sites) · A3 (timer-based
scheduling instead of the audio clock) · A5/A6/A7 (menu track, easy-mode calm
track, BGM loop length) · A8 (no voice limit / node pooling) · A9 (offline).

---

## 1. Current architecture

### 1.1 Engine / framework

| Layer | Reality |
|---|---|
| Game engine | **None.** No Phaser/PixiJS/Three.js/Unity/Godot. |
| Framework | Vanilla ES2020 JavaScript, no bundler, no transpiler |
| Styling | Tailwind via **runtime CDN** (`cdn.tailwindcss.com`, blocking `<script>`), plus 63 hand-written `@keyframes` |
| Audio | **Web Audio API**, 100% procedural synthesis |
| Speech | **Web Speech API** (`speechSynthesis`) |
| "Video" | CSS keyframe animations + absolutely-positioned DOM particle divs. **Zero `<video>`, zero `<canvas>`, zero `requestAnimationFrame` loops.** |
| Deployment | GitHub Pages, single file, no build step |

### 1.2 Platform support

| Platform | Supported | Evidence / gap |
|---|---|---|
| Desktop browsers (Chrome, Edge, Firefox, Safari) | ✅ Primary target | Web Audio + Web Speech widely available |
| Mobile browsers (iOS Safari, Android Chrome) | ✅ Supported | `viewport` meta with `viewport-fit=cover`; `touchstart` handlers; long-press review reveal; `apple-mobile-web-app-capable` |
| iOS standalone (Add to Home Screen) | ⚠️ Partial | `apple-mobile-web-app-capable` present, but **no `manifest.json`** — no icons, no splash, no display-mode, no install prompt |
| Android installable PWA | ❌ No | No `manifest.json`, no service worker |
| Windows / macOS / Linux desktop apps | ❌ No | No Electron / Tauri / Capacitor / Cordova wrapper in repo |
| Consoles (Switch / PS / Xbox) | ❌ No | Not applicable to the school deployment |
| Offline / no-network | ❌ No | No service worker, no `navigator.onLine` handling, zero cached assets |

**Native wrappers**: none. `package.json` does not exist; the repo has no
dependency manifest of any kind.

### 1.3 How audio is currently loaded and played

There is **nothing to load**. Every sound is generated by the Web Audio API at
the moment it is triggered.

The audio system is three cooperating modules. **Cycle 111g rebuilt the graph into
a real bus architecture — see §0「Update — cycle 111g」for the current topology.**

```
Audio  (app.js:581-927)          Web Audio API — synthesis + BGM scheduler
  ├── tone(freq, dur, type, vol, slideTo, slideDur)   oscillator + gain
  ├── noise(dur, vol, hpFreq)                          fresh AudioBuffer + biquad HP + gain
  ├── arp(freqs, dur, type, vol, gap)                  tone() on a setTimeout ladder
  ├── sweep(dir, baseFreq, dur, type, vol)             tone() on a setTimeout ladder
  ├── BGM_PATTERNS (5 scenes)                           bass[] + arp[] + wave type
  ├── startBGM() / stopBGM() / setBGMScene()            setInterval(180ms) step sequencer
  └── 20 exported SFX + 8 control methods

TTS    (app.js:931-1042)          Web Speech API — zh-HK narration + karaoke highlight
  ├── pickVoice()                   zh-HK > zh-TW > any-zh > default > first
  ├── normalize(text)               math symbols → spoken Cantonese
  ├── speak(text, btn, opts)        cancel → speak; onboundary → karaoke highlight
  ├── cancel()                      epoch-bumped cleanup
  └── setEnabled(b)

Compliment (app.js:1042+)         Text pool only (60 correct / N wrong) — no audio
```

**Routing**: every voice connects **directly to `ctx.destination`**. There is no
intermediate bus, no master gain, and no per-channel gain. Channel muting
(`channels.master` / `.sfx` / `.bgm`) is implemented as a **software gate
checked at trigger time**, not as a gain node.

> ⚠️ **呢段係 cycle104/105 嘅原始分析，已經過時** —— cycle111g 已經改成真 bus graph
> （`masterGain → ctx.destination`，`sfxGain → masterGain`，
> `bgmGain → bgmDuckGain → masterGain`）。**以 §0「Update — cycle 111g」為準。**

**Verified export list** (31 identifiers parsed from the `return { … }` block at
`index.html:4855-4977`):

```
attack attackSting boatRow bossDefeat bossEnraged bossHit castle castleHitHeavy
click correct countdown defeat enable energyTick freeze getChannels hpTick
isBgmOn isEnabled prime reviewAdd setBGMScene setChannel startBGM stopBGM
tugPull ultimate victory wrong
```

### 1.4 How video is currently loaded and played

**Video does not exist in this project.** There is no `<video>` element, no
canvas, no WebGL context, and no `requestAnimationFrame` render loop.

Everything that reads as "animation" is one of:

| Technique | Where | Example |
|---|---|---|
| CSS `@keyframes` (63 total) | inline `<style>` | `screen-shake-active`, `screen-alert`, `meteor`, `confetti-particle` |
| DOM particle injection | `FX.burst`, `FX.confetti` (5168-5262) | 18-28 `<div>`s per burst, removed via `setTimeout` |
| DOM class toggling | `FX.screenShake`, `FX.shake` | `classList.add` + `offsetWidth` reflow to restart animation |
| Inline SVG `<use>` sprite | 35 `<symbol>` elements, 41,790 bytes | `px-meteor`, `px-troll`, `pkg-milk-1l` |

**The 41,790-byte inline SVG sprite is the project's entire visual asset
payload** — 7.8 % of the raw page, with no external image requests.

### 1.5 Where audio and video assets are stored

| Asset class | Count | Location | External requests |
|---|---|---|---|
| Audio files (mp3/wav/ogg/m4a/flac/opus) | **0** | — | 0 |
| Video files (mp4/webm) | **0** | — | 0 |
| Image files (png/jpg/gif/webp) | **0** | — | 0 |
| Data URIs (base64 audio/video/image) | **0** | — | 0 |
| Inline SVG symbols | 35 | `index.html` inline `<svg>` sprite, 41,790 bytes | 0 |
| External images | 1 (×2 refs) | `https://www.puichi.edu.hk/…/1a__pui_chi_logo_png_1791177564.png` | 2 |

**The school logo is the only third-party binary asset.** It is referenced twice
(`index.html:3388` menu, `index.html:3971` game screen) from a third-party
school CMS. If that host is slow or down, the logo `<img>` fails — but because
it carries `alt="將軍澳培智學校"` and explicit `width="72" height="72"`, layout
does not shift and the failure is cosmetic.

### 1.6 Media manager / asset loader / pool / cache inventory

| Capability | Present? | Notes |
|---|---|---|
| Audio manager | ✅ | `Audio` IIFE, 219 lines, 9,377 bytes |
| Speech manager | ✅ | `TTS` object, 106 lines, 5,019 bytes |
| Visual-effects manager | ✅ | `FX` object, 95 lines |
| **Asset loader** | ❌ | Nothing to load |
| **Resource manager** | ❌ | — |
| **Streaming system** | ❌ | — |
| **Media cache** | ❌ | — |
| **Audio node pool** | ❌ | Every SFX allocates fresh nodes |
| **Voice/channel limiter** | ❌ | No cap on concurrent oscillators |
| **Asset registry / manifest** | ❌ | — |
| **CDN / asset host** | ❌ | Self-hosted single file |
| **Service worker / offline** | ❌ | — |
| **Loading screen** | ❌ | Not needed — see §1.7 |

### 1.7 Loading strategy

| Media class | Strategy | Rationale |
|---|---|---|
| Audio SFX | **Zero-lookup, zero-load, zero-decode** — synthesized on trigger | Instant, no latency, no download |
| BGM | **Zero-lookup** — oscillator voices on a 180 ms tick | Same |
| TTS | **Zero-lookup** — `speechSynthesis.speak()` delegates to the OS speech engine | OS-managed; voice list is async |
| Video | **N/A** | No video |
| SVG sprite | **Inline in the HTML** — parsed with the document | No second request, no FOUC |

There is **no loading screen** (0 matches for `loading-screen` / `id="loading"` /
`載入中`) and none is needed, because the page's only blocking dependency is the
Tailwind CDN script.

**Audio unlock (autoplay policy)**: handled in two places —
`Audio.prime()` is called from `startGame()` (`index.html:9216`) and from a
one-shot `touchstart` listener (`index.html:11765`). `ensure()` lazily creates
the `AudioContext` and calls `ctx.resume()` when the context is `suspended`.
This is correct behaviour for Chrome's autoplay policy.

### 1.8 CDN, server, and static-asset delivery

| Asset | Host | Delivery | Blocking? | Caching control |
|---|---|---|---|---|
| `index.html` | GitHub Pages (`ihateusingai-beep.github.io/math-guardian/`) | Static, no build | n/a | GitHub Pages default (see §1.9) |
| Tailwind | `cdn.tailwindcss.com` | Third-party CDN, runtime JIT compile | **Yes** — plain `<script src>` with no `defer` | CDN-controlled |
| Plausible analytics | `plausible.io` | Third-party, `defer` | No | CDN-controlled |
| School logo | `www.puichi.edu.hk` | Third-party school CMS | No (`<img>`) | Server-controlled |
| MiniMax API | `api.MiniMax.chat` | On-demand from teacher modal only | No | n/a |

### 1.9 HTTP caching and versioning

| Question | Answer |
|---|---|
| Custom `Cache-Control` headers | **None** — the repo serves a static file; GitHub Pages sets its own |
| `ETag` / `Last-Modified` | GitHub Pages default (both present) |
| Content hashing / fingerprinted filenames | **None** — there is exactly one file, `index.html` |
| Service-worker cache | **None** |
| Versioned asset URLs | **N/A** — no separate assets |
| Cache-busting strategy | **None.** Any new deploy invalidates the whole 535 KB page for every student |

**This is the practical delivery weakness of the project.** There is no media
payload to cache, but the 138 KB gzipped page is re-downloaded whenever the
cache expires, and there is no offline path for a classroom with unreliable
Wi-Fi.

### 1.10 Fallback behaviour when a media format cannot be decoded

| Failure | Current behaviour | Player-visible result |
|---|---|---|
| `AudioContext` unavailable (very old browser) | `ensure()` catches the constructor throw, sets `ctx = null`, returns `null` | Game continues **silently** — no sound, no message |
| `ctx.resume()` rejects (autoplay policy) | `.catch(()=>{})` swallowed | Silent |
| `speechSynthesis` absent | `speak()` returns early (`'speechSynthesis' in window` guard) | TTS button does nothing, no message |
| `speechSynthesis.getVoices()` empty | `pickVoice()` returns `null`; `utter.voice` left unset; `utter.lang = 'zh-HK'` | Browser picks a default voice; may read with a non-Cantonese accent, or fail silently |
| School logo 404 | `<img>` fails | Broken-image icon inside a 72×72 box; `alt` text shown instead |
| Tailwind CDN unreachable | `<script>` fails, page renders unstyled | **Severe** — the entire layout depends on Tailwind utilities |
| Plausible unreachable | `defer` script fails silently | Analytics lost, no player impact |
| `Audio.tick()` / `Audio.beep()` (B1/B2) | ✅ **Fixed in cycle 105** — both are now exported | The intended sound now plays; no uncaught error |

**There is no player-facing error surface for any media failure.** For a
moderate-ID SEN audience this is a real risk: a student on a locked-down school
iPad with no Cantonese voice installed gets silence and no explanation.

### 1.11 Profiling, automated tests, and platform validation

**Existing test coverage of the media system**

| Suite | Media assertions | Type | What it can catch |
|---|---|---|---|
| `tests/regression.js` | 110 | Source-regex (structural) | "the `TTS` module exists", "`Audio.setChannel` is exported", "TTS karaoke wiring", "`prefers-reduced-motion` disables `.tts-tok` transition" |
| `tests/generator-audit.js` | 0 | Functional | — (question generation only) |

**Verified gap (as of cycle 104)**: `grep -c 'tick:' tests/regression.js` → `0`;
`'beep:'` → `0`; `'bgmInterval'` → `0`. **None of the three confirmed runtime
bugs was covered by any assertion.** The existing `AUDIT2-B3` assertions only
check that the variable `_wasPlayingBGM` is *declared* (test line 252) and
*reset* (line 256) — they never check that the value it is assigned from is
actually resolvable.

**Closed in cycle 105** by `tests/audio-audit.js` (12 assertions) plus 6
T105 regex lock-ins in `tests/regression.js`.

**No profiling harness exists.** No `AudioContext` node counters, no
performance marks, no memory snapshots, no CPU sampling.

**No platform validation matrix.** No browser matrix testing, no device
testing, no automated visual regression.

**Reproducible baseline**: the measurement scripts referenced in §23.

---

## 2. Current problems, ranked

### 🔴 P0 — Runtime failures  ✅ **all three fixed in cycle 105**

**P0-1 · `Audio.tick()` is called but not exported** — `index.html:6643`  
✅ *Fixed in cycle 105 — `tick` is now exported.*

```js
// index.html:6643 — inside the recommend-chip click handler
renderTypePicker();
updateTypeCount();
renderRecommendChips();
Audio.tick();          // ← TypeError: Audio.tick is not a function
```

`tick` does not appear in the `Audio` return object. The three calls above it
have already applied the intended UI change, so the chip still toggles
correctly, but the handler aborts and an uncaught `TypeError` reaches the
console. The intended sound was a light confirmation blip for "recommendation
chip toggled".

**P0-2 · `Audio.beep(440, 0.08)` is called but not exported** — `index.html:10160`  
✅ *Fixed in cycle 105 — `beep` is now exported.*

```js
// index.html:10155-10162 — mobile long-press review reveal
lpTimer = setTimeout(() => {
  if (lpBtn) {
    lpBtn.dataset.answerDecoded = decodeAnswer(lpBtn.dataset.answerEncoded || '');
    lpBtn.classList.add('show-answer');
    Audio.beep(440, 0.08);   // ← TypeError: Audio.beep is not a function
    lpBtn = null;            // ← never reached
  }
}, 1200);
```

The answer **is** revealed (the class is added before the throw), but `lpBtn`
is never cleared, leaving a stale reference. The intended sound is a
confirmation blip for "answer revealed".

**P0-3 · `Audio.bgmInterval` is read but not exported** — `index.html:11771`  
✅ *Fixed in cycle 105 — replaced by an exported `Audio.isPlaying()` accessor.*

```js
// index.html:11768-11777 — visibilitychange handler
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _wasPlayingBGM = !!Audio.bgmInterval;  // ← always false: bgmInterval is IIFE-private
    if (_wasPlayingBGM) Audio.stopBGM();
  } else {
    if (_wasPlayingBGM && Game.state && Game.state.running) Audio.startBGM();
    _wasPlayingBGM = false;
  }
});
```

`bgmInterval` is declared at `index.html:4766` and used only inside the IIFE
(lines 4839, 4842, 4853). It is **not** in the export list, so `Audio.bgmInterval`
is `undefined`, so `!!undefined` is `false`, so `_wasPlayingBGM` is **always
`false`**.

*Actual player-visible behaviour*: background music stops when the tab is
hidden (that part works, because `stopBGM()` is reached through a different
path in some flows) and **never resumes** when the student returns. The
comment in the source — `// 暴露內部 flag（hack but ok）` — shows the intent
was to expose the flag; the export was simply never added.

This is the most player-visible of the three: a student who switches to
another app to check a note comes back to **silence for the rest of the
session**.

### 🟠 P1 — Architecture gaps

**P1-1 · No master gain node.** `masterGain` is declared at `index.html:4762`
and never referenced again. Every voice connects straight to
`ctx.destination`. Consequences: no master volume, no ducking (TTS cannot
quieten the BGM), no per-channel balance, and no way to apply a global
limiter.

**P1-2 · Countdown sound is dead.** `countdown` is exported (`index.html:4942`)
and has **zero call sites**. The "last 10 seconds" warning has no audio.

**P1-3 · Timer-based scheduling instead of the audio clock.** BGM runs on
`setInterval(180ms)`; `arp()` and `sweep()` use `setTimeout` ladders. These
drift against `ctx.currentTime`, jitter audibly, and are throttled by browsers
in background tabs (typically clamped to ≥1 s), so the BGM slows down rather
than continuing at the right tempo.

**P1-4 · Per-call buffer allocation in `noise()`.** `index.html:4801` allocates
a new `AudioBuffer` on every invocation and fills it with `Math.random()`.
Measured worst case: `bossDefeat` allocates 96 KB; a full pass over all 20 SFX
allocates **408.8 KB** of short-lived float buffers. In a real session
(`bossHit` fires on every correct answer, `castle` on every boss attack) this
is steady GC pressure on the main thread.

**P1-5 · No voice limit, no pooling.** Every SFX creates fresh
oscillator + gain (+ filter + buffer source) nodes. Measured peak concurrency
is ~10 live voices (BGM ~3 plus a victory fanfare), which is safe in practice
but unbounded by design.

### 🟡 P2 — Quality and delivery

**P2-1 · The menu is silent.** `Audio.startBGM()` is called only from
`startGame()` and from audio-settings toggles — never from the home menu. The
`Game.settings.menuTrack` setting (`'class' | 'boss'`, `index.html:6729`) has
**no audio effect whatsoever**; it only chooses which menu panel is shown.

**P2-2 · Easy mode gets boss music.** `startGame()` calls
`Audio.setBGMScene(Bosses.current.scene)` whenever a boss is selected
(`index.html:9218`), including in easy mode where the student is practising
counting and comparing lengths with **no boss fight**. The available scenes
are all boss-fight themes (`forest`, `snow`, `lava`, `shadow`, `crystal`).

**P2-3 · The BGM loop is 7.2 seconds.** With `bgmTempo = 0.18 s/step`, a bass
pattern of 8 notes and an arp pattern of 10 notes give a full cycle of
`LCM(8,10) = 40` steps = **7.20 s**. In the default 5-minute session:

- full cycle repeats **41.7 ×**
- bass pattern (1.44 s) repeats **208 ×**
- arp pattern (1.80 s) repeats **167 ×**

For SEN students who tend to fixate on repeating patterns, this is a genuine
attention problem, not just an aesthetic one.

**P2-4 · No offline support.** A school with captive Wi-Fi or a dead access
point leaves students with a blank page. Given the zero-media-asset
architecture, a service worker caching the single HTML file would make the
game fully offline-capable at negligible cost.

**P2-5 · No PWA manifest.** `apple-mobile-web-app-capable` is set, but without
`manifest.json` the Add-to-Home-Screen path gives no icon, no splash screen,
and no standalone display mode.

**P2-6 · `index.html.bak` in the working tree.** A 535 KB stale copy sits
beside the real file. It is covered by `.gitignore` (`*.bak`) so it is not
committed, but it is a footgun for any tooling that globs `index*.html`.

---

## 3. Audio asset inventory

**Every row below is verified to exist in the shipped `index.html`.** No
synthesized-audio-file assets exist because no audio files exist.

### 3.1 Sound effects — 20 verified exports

| # | Export | Source location | Category | Synthesis | Duration | Voices (measured) | Buffer alloc |
|---|---|---|---|---|---|---|---|
| 1 | `correct` | 4857 | Learning feedback | 3 × sine, rising C-major | 0.08+0.16+0.10 s | 3 | 0 |
| 2 | `wrong` | 4863 | Learning feedback | saw + square, downward slide | 0.16+0.20 s | 2 | 0 |
| 3 | `attack` | 4867 | Combat | square slide + square + noise + 3-note sting | ~0.30 s | 6 | 11.3 KB |
| 4 | `bossHit` | 4878 | Combat | square slide + noise + saw + 2 triangle | ~0.30 s | 5 | 22.5 KB |
| 5 | `attackSting` | 4884 | Combat | 4-note square fanfare | 0.30 s | 4 | 0 |
| 6 | `bossEnraged` | 4890 | Combat | saw roar slide + noise | 0.40 s | 2 | 56.3 KB |
| 7 | `bossDefeat` | 4894 | Combat | square slide + noise + 2 sine tail | 0.90 s | 4 | 93.8 KB |
| 8 | `castle` | 4899 | Combat | saw slide + noise | 0.30 s | 2 | 37.5 KB |
| 9 | `castleHitHeavy` | 4903 | Combat | saw slide + noise | 0.45 s | 2 | 65.6 KB |
| 10 | `ultimate` | 4907 | Combat | sweep up + square impact + noise + saw tail | ~1.0 s | 3 | 33.8 KB |
| 11 | `freeze` | 4915 | Combat | 3 × rising triangle + noise | 0.20 s | 4 | 33.8 KB |
| 12 | `energyTick` | 4921 | Progression | 1 × sine, 0.04 s | 0.04 s | 1 | 0 |
| 13 | `hpTick` | 4924 | Combat | square slide down | 0.10 s | 1 | 0 |
| 14 | `reviewAdd` | 4927 | Progression | 2 × square descending | 0.11 s | 2 | 0 |
| 15 | `victory` | 4931 | Progression | 4-note arp + 3-note chord | 2.0 s | 7 | 0 |
| 16 | `defeat` | 4938 | Progression | sweep down + low sine tail | 1.7 s | 7 | 0 |
| 17 | `countdown` | 4942 | UI | 1 × square, 0.10 s | 0.10 s | 1 | 0 |
| 18 | `click` | 4943 | UI | 1 × sine, 0.04 s | 0.04 s | 1 | 0 |
| 19 | `tugPull` | 4945 | Arena | square slide + noise + triangle | 0.11 s | 3 | 9.4 KB |
| 20 | `boatRow` | 4950 | Arena | sine + triangle + noise | 0.15 s | 3 | 7.5 KB |

**Mono / stereo**: all synthesis output is **mono** by construction — a single
`OscillatorNode` or `AudioBufferSource` feeding one `GainNode`. The
`AudioContext` destination handles the final stereo rendering.

**Short vs long**: 18 of 20 are short one-shots (≤ 0.5 s). `victory` (2.0 s)
and `defeat` (1.7 s) are longer stingers. There are **no long-form assets**.

### 3.2 Music — 5 verified patterns

| # | Scene | Bass pattern | Arp pattern | Wave | Full cycle |
|---|---|---|---|---|---|
| 1 | `forest` | 8 notes | 10 notes | triangle | 7.20 s |
| 2 | `snow` | 8 notes | 10 notes | sine | 7.20 s |
| 3 | `lava` | 8 notes | 10 notes | sawtooth | 7.20 s |
| 4 | `shadow` | 8 notes | 10 notes | square | 7.20 s |
| 5 | `crystal` | 8 notes | 10 notes | sine | 7.20 s |

Each step also emits a low kick (`bgmStep % 8 === 0`). Tempo is fixed at
`bgmTempo = 0.18 s/step` with no tempo variation, no dynamics, no layered
intensity, and no transition stinger.

### 3.3 Voice / narration — 1 verified system

| Property | Value |
|---|---|
| Engine | `window.speechSynthesis` (OS-provided) |
| Voice selection | `zh-HK` → `zh-TW` → any `zh-*` → `default` → first available |
| Rate / pitch | 0.9 / 1.0 (fixed) |
| Concurrent utterances | **1** — `speak()` calls `speechSynthesis.cancel()` first |
| Karaoke highlight | `onboundary` → char index → `.tts-tok.tts-active` |
| Race guard | monotonic `_boundaryEpoch`, bumped on every `speak()` and `cancel()` |
| Normalization | `❓`/`?` → 等於幾多, `=` → 等於, `+` → 加, `-` → 減, `×` → 乘, `÷` → 除以, `<` → 細過, `>` → 大過 |
| Call sites | 8 × `TTS.speak`, 4 × `TTS.cancel` |

### 3.4 Text-only reward pool

`Compliment` (`index.html:5092+`) holds 60 "correct" and a comparable "wrong"
pool of Cantonese encouragement. **It is text only** — it never reaches the
audio system, and it is not spoken by TTS.

---

## 4. Proposed sound-effects map

**Status: PROPOSED ONLY.** Nothing in this section has been created, recorded,
or implemented. The "Existing" column references §3, which is verified.

Categories are derived from the approved design recorded in `AGENTS.md`,
`.harness/docs/architecture.md`, `.harness/reins/*/agent.md`, and `TODO.md`.

### 4.1 Learning feedback (core loop — highest priority)

| Sound family | Gameplay event / trigger | Player information conveyed | 2D/3D | Surface / state variants | Variation & anti-repetition | Priority | Concurrency limit | Distance / occlusion / virtualization | Sync with anim / VFX / haptics | Source or creation method | Loading strategy | Owning system | Required / optional / deferred |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `correct` | Answer submitted and correct | "Your answer is right" | 2D | Easy vs normal difficulty (identical today) | Currently fixed 3-note. Propose 4 rotating variants (2nd/4th/6th intervals) + a 5th "streak" variant after 3 consecutive | **Required** | 1 (self-cancelling) | n/a (2D UI) | Same frame as the green button flash; coincide with `_pulseEl` | Synth — extend existing | Zero-load | `Audio` | **Required** — exists, needs variants |
| `wrong` | Answer submitted and wrong | "Try again; this is not it" — deliberately non-punishing | 2D | Easy mode gets a softer variant (SEN) | Fixed 2-note. Propose 2 variants + a distinct "gentle" easy-mode variant | **Required** | 1 | n/a | With the screen shake (`FX.screenShake`) | Synth — extend existing | Zero-load | `Audio` | **Required** — exists, needs easy variant |
| `streak` | 3rd consecutive correct answer | "You are on a roll" | 2D | n/a | Fires once per streak milestone, not per answer | Optional | 1 | n/a | With `_streakFireOverlay` (already exists, currently silent) | Synth — new | Zero-load | `Audio` | **Optional** |
| `hint` | Instant hint overlay shown | "Here is a clue" | 2D | Easy vs normal | 1 variant | Optional | 1 | n/a | On overlay paint | Synth — new | Zero-load | `Audio` | **Optional** |
| `countdown` | Last 10 seconds of a timed game | "Time is nearly up" | 2D | Last 10 s vs final 3 s (different urgency) | 1 per second, escalating pitch on the last 3 | **Required** | 1 | n/a | With the on-screen countdown number | Synth — **exists, unwired** | Zero-load | `Audio` | **Required** — export exists, needs wiring |

### 4.2 Interaction and UI

| Sound family | Trigger | Player information conveyed | Variants | Priority | Concurrency | Sync | Source | Required/optional/deferred |
|---|---|---|---|---|---|---|---|---|
| `click` | Generic button press | "Your press registered" | 1 | **Required** (exists) | 4 | With button `:active` state | Synth — exists | **Required** |
| `toggleOn` / `toggleOff` | Setting checkbox / switch toggled | "That setting is now on / off" | 2 | **Required** | 2 | With the switch animation | Synth — new (or reuse `click` at 2 pitches) | **Required** |
| `chipToggle` | Recommendation chip toggled | "That question type was added / removed" | 2 | **Required** — *replaces the broken `Audio.tick()`* | 2 | With the chip re-render | Synth — new | **Required** |
| `reveal` | Long-press reveals a review answer | "Here is the answer you wanted to see" | 1 | **Required** — *replaces the broken `Audio.beep()`* | 1 | With `.show-answer` class | Synth — new | **Required** |
| `nav` | Screen change (menu → game → end) | "You moved to a new screen" | 2 (in / out) | Optional | 1 | With screen transition | Synth — new | **Optional** |
| `error` | Invalid action (e.g. bank add with a malformed question) | "That did not work, here is what to do" | 2 | **Required** | 1 | With the error banner | Synth — new | **Required** |
| `reward` | Badge / mastery unlock | "You earned something" | 2 | Optional | 1 | With the badge animation | Synth — new | **Optional** |

### 4.3 Boss combat (normal difficulty track)

| Sound family | Trigger | Player information | Variants | Priority | Concurrency | Sync | Source | Required/optional/deferred |
|---|---|---|---|---|---|---|---|---|
| `attack` | Player answers correctly and strikes the boss | "Your hit landed" | 2 | **Required** (exists) | 3 | With the sprite hit flash | Synth — exists | **Required** |
| `bossHit` | Boss takes damage | "You hurt it" | 2 | **Required** (exists) | 3 | With boss HP bar drop | Synth — exists | **Required** |
| `bossEnraged` | Boss enters the enraged state | "The boss is stronger now" | 1 | **Required** (exists) | 1 | With the enrage overlay | Synth — exists | **Required** |
| `bossDefeat` | Boss HP reaches zero | "You won this fight" | 1 | **Required** (exists) | 1 | With the boss explosion | Synth — exists | **Required** |
| `castle` | Boss attacks the team castle | "Your castle was hit" | 2 | **Required** (exists) | 2 | With the castle shake | Synth — exists | **Required** |
| `castleHitHeavy` | Castle is at low HP | "Your castle is nearly lost" | 1 | **Required** (exists) | 1 | With the red flash | Synth — exists | **Required** |
| `ultimate` | Meteor ultimate is released | "Your big attack fired" | 1 | **Required** (exists) | 1 | With the 1.1 s meteor flight | Synth — exists | **Required** |
| `freeze` | Boss is frozen | "The boss is stuck" | 1 | **Required** (exists) | 1 | With the ice overlay | Synth — exists | **Required** |
| `hpTick` | Boss HP crosses a state threshold | "The boss changed state" | 1 | **Required** (exists) | 1 | With the state change | Synth — exists | **Required** |
| `energyTick` | Energy gained after a correct answer | "You gained energy" | 1 | **Required** (exists) | 2 | With the energy bar | Synth — exists | **Required** |
| `attackSting` | Short fanfare on a correct answer | "Reward flourish" | 1 | **Required** (exists) | 1 | With the hit | Synth — exists | **Required** |

### 4.4 Arena (dual play layout)

| Sound family | Trigger | Player information | Variants | Priority | Concurrency | Source | Required/optional/deferred |
|---|---|---|---|---|---|---|---|
| `tugPull` | Team pulls the rope in versus mode | "Your side moved" | 2 (left / right) | **Required** (exists) | 3 | Synth — exists | **Required** |
| `boatRow` | Team rows the boat in coop mode | "Your side moved forward" | 2 | **Required** (exists) | 3 | Synth — exists | **Required** |
| `arenaWin` | A team wins the tug / reaches the goal | "Your team won this round" | 1 | Optional | 1 | Synth — new | **Optional** |
| `arenaLose` | A team loses the round | "The other team won this round" | 1 | Optional | 1 | Synth — new | **Optional** |

### 4.5 Progression and end of game

| Sound family | Trigger | Player information | Variants | Priority | Concurrency | Source | Required/optional/deferred |
|---|---|---|---|---|---|---|---|
| `victory` | Game won | "You won the whole game" | 1 | **Required** (exists) | 1 | Synth — exists | **Required** |
| `defeat` | Game lost | "The game is over — you can try again" | 1 | **Required** (exists) | 1 | Synth — exists | **Required** |
| `reviewAdd` | A wrong answer is filed into the review list | "This one is saved for later" | 1 | **Required** (exists) | 1 | Synth — exists | **Required** |
| `levelUp` | Difficulty or scope level increases | "You moved up a level" | 1 | Optional | 1 | Synth — new | **Optional** |
| `badgeUnlock` | A new badge is earned | "You earned a badge" | 2 | Optional | 1 | Synth — new | **Optional** |
| `save` | Progress is stored | "Your progress is safe" | 1 | Optional | 1 | Synth — new | **Optional** |

### 4.6 Ambience (currently absent)

| Sound family | Trigger | Player information | Priority | Notes |
|---|---|---|---|---|
| `roomTone` | Menu is open | "The room is quiet; you are safe to focus" | Optional | Deliberately quiet. For SEN students a silent menu is often better — see §8.5 |
| `classAmbience` | Easy-mode lesson | "You are in a calm classroom" | Deferred | Needs care: background noise can hurt attention. Recommend **silence** for easy mode by default |
| `bossArenaAmbience` | Boss fight | "The arena is alive" | Deferred | Would need to sit under the BGM without masking it |

### 4.7 Accessibility cues (distinct from general SFX)

| Sound family | Trigger | Player information | Priority | Notes |
|---|---|---|---|---|
| `voiceMissing` | TTS is enabled but no usable voice exists | "Reading aloud is not available on this device" | **Required** | Currently completely silent (§1.10). Needs a player-facing message, not just a sound |
| `audioBlocked` | AudioContext could not start (autoplay policy / locked device) | "Sound is off right now" | **Required** | Currently silent |
| `ttsStart` | Narration begins | "The question is being read aloud" | Optional | The `.speaking` class already provides a visual cue |

### 4.8 Categories that do **not** apply

This is a **2D, single-screen math practice game**. There is no locomotion, no
footsteps, no swimming, no vehicles, no weapons, no projectiles, no crafting,
no inventory, no weather, no wildlife, no crowds, no cinematics. Those families
are deliberately **not** proposed.

---

## 5. Missing, redundant, reusable, optional, and deferred sound families

### 5.1 Missing (and why it matters here)

| Missing family | Impact |
|---|---|
| `chipToggle` | **Currently a crash** (B1). A student tapping a recommendation chip gets an uncaught `TypeError`. |
| `reveal` | **Currently a crash** (B2). A student long-pressing a review answer gets an uncaught `TypeError` and a stale `lpBtn` reference. |
| `countdown` wiring | A timed game has **no** audible time warning. The export exists but is never called. |
| `toggleOn` / `toggleOff` | Audio settings give no confirmation that the change took effect. |
| `error` | Bank-add failures and validation errors are silent. |
| `voiceMissing` / `audioBlocked` | A student on a device without a Cantonese voice gets silence with no explanation. |
| `streak` | `_streakFireOverlay` fires a visual celebration with **no sound**, so a student looking away from the screen misses it entirely. |
| `menu` audio | The entire home menu is silent. |

### 5.2 Redundant

| Redundancy | Detail | Recommendation |
|---|---|---|
| `attack` and `attackSting` overlap | `attack` already embeds a 3-note sting (`index.html:4871-4876`) **and** `attackSting` is a separate 4-note fanfare fired immediately after (`index.html:9430-9431`). Two overlapping fanfares on every correct answer. | Keep `attackSting` as the musical accent; strip the embedded sting from `attack`, or drop the separate call. Verify by ear before changing. |
| `hpTick` vs `energyTick` | Both are 0.04-0.10 s single tones in the same register, fired on adjacent game events. | Give them distinct timbres (e.g. `hpTick` square, `energyTick` triangle) so students can tell them apart. |
| `click` vs `energyTick` | Both 0.04 s sine at 660 Hz — literally the same sound. | Differentiate; the 660/660 collision makes them indistinguishable. |
| `victory` chord vs `attackSting` | Both use 262/330/392/523 in square. | Differentiate the victory chord (triangle, longer) — it already is, but verify in context. |

### 5.3 Reusable families (safe to reuse)

| Family | Reuse for | Safety note |
|---|---|---|
| `click` (0.04 s sine) | Any generic confirmation — chip toggle, reveal, checkbox | Safe: too short to mask anything |
| `correct` family | Correct answer, level-up, badge unlock | Use the higher variants for rarer, better events |
| `wrong` family | Wrong answer, validation error | **Do not** reuse for errors the player could not have caused (e.g. a network failure) — that reads as blame |
| `noise` burst | Hit, impact, break | Safe: already parameterised by duration and filter cutoff |
| `sweep` | Level-up, ultimate charge, victory | Safe: expressive envelope, used at most once at a time |

### 5.4 Optional (nice-to-have, defer if the schedule is tight)

`streak`, `nav`, `reward`, `levelUp`, `badgeUnlock`, `save`, `arenaWin`,
`arenaLose`, `ttsStart`, `roomTone`, `classAmbience`, `bossArenaAmbience`.

### 5.5 Deferred (needs design work, not just an asset)

| Family | Why deferred |
|---|---|
| Adaptive intensity score | Requires a "how close is the boss to defeat / how is the castle doing" signal. The data exists (`Game.state.bossHp`, castle HP) but there is no published intensity contract. |
| Per-scope "lesson complete" cue | Requires a lesson-progress model. Easy mode currently has a goal counter (`Game.state.easyGoalTotal`, `index.html:7704`) that could drive it. |
| Spatialised arena audio | `versus` / `coop` are 2D side-by-side, not 3D. Stereo panning per team would be a genuine improvement but needs `StereoPannerNode` work. |
| Fully adaptive layered score | See §7.3 — needs a stem architecture that does not exist yet. |

### 5.6 Where silence is the stronger choice

| Moment | Why silence wins |
|---|---|
| **Easy-mode practice loop** | The student is learning counting and comparison. Music competes with the TTS narration and with the student's own counting. The easy track should be **silent or near-silent** by default. |
| **While TTS is speaking** | The karaoke feature exists precisely so a student follows text with their eyes while hearing it. Any music or SFX under the narration defeats the design. This is a **ducking** requirement (§24.4). |
| **Immediately after a wrong answer** | A harsh sound plus a screen shake plus a wrong flourish is three simultaneous negative signals. For SEN students, one clear signal is better. |
| **Between questions during focus** | The `correct` / `wrong` sounds already mark the beat. Ambient music between questions adds nothing and adds distraction. |
| **During the boss's turn** | When the boss attacks, silence before the hit makes the impact land harder. |
| **Long-form menu** | A student sitting at the menu for two minutes is likely to be waiting for a teacher, not focused. Silence is neutral; looping music is an annoyance. |

---

## 6. Proposed music-loop and adaptive-score map

**Status: PROPOSED ONLY.** No track exists that is not already listed in §3.2.
The "Existing" column refers to the five verified scene patterns.

### 6.1 Cue map

| Music cue / family | Player state or scene | Emotional & gameplay purpose | Loop length | Intro / outro | Loop point | Layers / stems / tiers | Transition style | Trigger & exit rules | Beat/bar sync | Stinger | Ducking & dialogue | Variation & repetition plan | Loading / streaming | Platform fallback | Required / optional / deferred |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Menu — silent** (recommended) | Home menu | Neutral, waiting | — | — | — | — | — | Always silent | — | — | n/a | n/a | n/a | n/a | **Recommended default: silence** |
| **Menu — optional ambience** | Home menu, student idling | Calm, non-distracting | 30-60 s | 2 s fade in | Bar 1 | 1 stem (soft pad) | Cross-fade 1.5 s | Start after 8 s idle, stop on interaction | 4/4 at 80 BPM | — | Duck to −24 dB under TTS | 3 variants, 1 per 60 s | Zero-load | Silent if synthesis fails | **Optional** |
| **Easy practice** | Easy-mode question loop | Calm, non-distracting, no competition | — | — | — | — | — | **Recommended: silent** (TTS is the audio channel) | — | — | n/a | n/a | n/a | n/a | **Recommended: silence** |
| **Boss — forest** (existing) | Boss fight, forest scene | Neutral-aggressive, steady | 7.2 s (current) | 1 step | Bar 1 | bass + arp + kick (1 tier) | Hard cut | `startGame` → `endGame` | 4/4 | `attackSting` | Duck under TTS | **Needs work — see §6.3** | Zero-load | Silent | **Required** — exists |
| **Boss — snow** (existing) | Boss fight, snow scene | Cold, sparse | 7.2 s | 1 step | Bar 1 | same | Hard cut | same | 4/4 | same | same | Needs work | Zero-load | Silent | **Required** — exists |
| **Boss — lava** (existing) | Boss fight, lava scene | Urgent, harsh | 7.2 s | 1 step | Bar 1 | same | Hard cut | same | 4/4 | same | same | Needs work | Zero-load | Silent | **Required** — exists |
| **Boss — shadow** (existing) | Boss fight, shadow scene | Menacing, sparse | 7.2 s | 1 step | Bar 1 | same | Hard cut | same | 4/4 | same | same | Needs work | Zero-load | Silent | **Required** — exists |
| **Boss — crystal** (existing) | Boss fight, crystal scene | Bright, clean | 7.2 s | 1 step | Bar 1 | same | Hard cut | same | 4/4 | same | same | Needs work | Zero-load | Silent | **Required** — exists |
| **Boss — enrage variant** | Boss is enraged | Urgency spike | 7.2 s base | — | Bar 1 | +1 tension layer (dissonant upper voice) | Cross-fade 0.8 s | On `bossEnraged` | 4/4 | `bossEnraged` | Duck under TTS | Alternate the added layer every 2 cycles | Zero-load | Silent | **Optional** |
| **Boss — low-castle variant** | Castle HP below 25 % | Tension, urgency | 7.2 s base | — | Bar 1 | +1 pulse layer | Cross-fade 0.8 s | On `castleHitHeavy` | 4/4 | `castleHitHeavy` | Duck under TTS | Alternate every 2 cycles | Zero-load | Silent | **Optional** |
| **Boss — victory stinger** | Boss defeated | Triumph | 2 s one-shot | — | n/a | 1 layer | Cut to silence | On `bossDefeat` | n/a | `bossDefeat` + `victory` | n/a | n/a | Zero-load | Silent | **Required** — exists as `victory` |
| **Boss — defeat stinger** | Game lost | Disappointment, not shame | 1.7 s one-shot | — | n/a | 1 layer | Cut to silence | On `defeat` | n/a | `defeat` | n/a | n/a | Zero-load | Silent | **Required** — exists |

### 6.2 Which moments need what

| Need | Where |
|---|---|
| **Seamless loop** | The 5 boss scenes during a fight (they must not click or gap between cycles) |
| **One-shot cue** | `victory`, `defeat`, `attackSting`, `bossEnraged`, `bossDefeat`, `countdown` |
| **Adaptive layered score** | Optional enrage / low-castle tiers (§6.1) |
| **Location theme** | The 5 boss scenes already are location themes (forest/snow/lava/shadow/crystal) |
| **Short stinger** | Boss transitions, victory, defeat |
| **Ambience instead of music** | Menu (optional) |
| **Deliberate silence** | Easy mode, TTS playback, boss's turn before a hit |

### 6.3 Repetition analysis and the fix

Measured: the 5 existing scenes all share the same structure — an 8-note bass
pattern and a 10-note arp pattern, giving a 7.20 s full cycle. Over the
default 5-minute session:

| Repeating unit | Length | Repeats per 5-min session |
|---|---|---|
| Bass pattern | 1.44 s | **208** |
| Arp pattern | 1.80 s | **167** |
| Full cycle | 7.20 s | 41.7 |

**Recommended fix (smallest possible, keeps the synthesis architecture):**

1. **Vary the bass pattern per cycle.** Give each scene a 16-note bass
   pattern instead of 8, so the bass unit repeats 104 times instead of 208.
   This is a data change, not an architecture change.
2. **Rotate arp inversions.** Alternate the arp pattern between the original and
   its inversion every other cycle. Doubles the apparent arp period to 3.6 s.
3. **Add a fill every 4th cycle.** A 2-step fill (different bass note + a
   noise accent) breaks the ear's prediction without changing tempo.
4. **Randomise the kick pattern slightly** within a 4-bar phrase, so the
   groove is not perfectly identical.

Combined effect: the perceived loop length goes from 7.2 s to roughly
**28.8 s** without changing the tempo, the scene identity, or the synthesis
approach.

**Longer sessions.** `Game.settings.minutes` is user-configurable. At 10
minutes the bass pattern would repeat 416 times without the fix. The fix
above brings that to 208 — still high, but with the fills and inversions it no
longer reads as a machine.

---

## 7. Video asset inventory

### 7.1 Current inventory

| Class | Count | Format | Location | Notes |
|---|---|---|---|---|
| Video files | **0** | — | — | No `<video>`, no `.mp4`/`.webm` |
| Canvas surfaces | **0** | — | — | No `<canvas>`, no `getContext` |
| WebGL | **0** | — | — | — |
| `requestAnimationFrame` loops | **0** | — | — | Animation is entirely CSS-driven |
| CSS `@keyframes` | **63** | CSS | inline `<style>` | `screen-shake-active`, `screen-alert`, `meteor`, `confetti-particle`, `tts-tok`, … |
| Inline SVG sprite symbols | **35** | SVG | `index.html`, 41,790 bytes | `px-*` (28), `pkg-*` (6), `bg-tree*` (2) |
| External images | 1 URL (×2 refs) | PNG | `puichi.edu.hk` | School logo, 72×72, has `alt` |
| DOM particle system | 2 emitters | DOM + CSS | `FX.burst` (5168), `FX.confetti` (5207) | 18-28 divs per burst, `setTimeout` removal |

### 7.2 Current formats

There is no video format to recommend replacing. The only formats in play are
**CSS animations** and **inline SVG**.

### 7.3 Recommended formats

| Asset class | Current | Recommended | Rationale |
|---|---|---|---|
| Character / boss / item art | Inline SVG `<symbol>` | **Keep inline SVG** | Zero requests, themeable via CSS `currentColor`, scales cleanly on the 44 px touch targets this project uses, and `bg-tree*` already proves the pattern scales |
| UI motion | CSS `@keyframes` | **Keep CSS** | Compositor-driven, respects `prefers-reduced-motion` (4 blocks already handle it) |
| Impact particles | DOM divs | **Keep DOM** | 18-28 nodes per burst is well under any budget |
| Any future video (cutscene, tutorial) | — | **Not recommended** | Zero video is a feature: no decode cost, no download, works offline, works in a locked-down school browser |

### 7.4 Recommended compression

| Class | Current | Recommended |
|---|---|---|
| SVG sprite | Uncompressed inline text (41,790 bytes) | **Optional**: minify the path data with `svgo` at build time and re-inline. Estimated 25-35 % reduction (~13 KB raw, less after gzip). **Do not** convert to a sprite sheet — a single file keeps the no-request property. |
| CSS | Uncompressed inline | **Optional**: minify the `<style>` block. Low priority — gzip already handles most of it |
| PNG logo (external) | Served by the school CMS | **Optional**: self-host it. Removes a third-party runtime dependency and a potential classroom firewall failure |

### 7.5 Recommended loading, caching, and memory behaviour

Video has no separate pipeline. The relevant behaviour is inherited from §8
(page-level), plus:

- **Keep the sprite inline.** Splitting it into a separate `.svg` would add a
  request and risk a flash of missing icons on slow links.
- **No lazy loading needed** — there is nothing below the fold to defer.
- **Memory**: the sprite costs ~42 KB of DOM and is created once.

---

## 8. Recommendations by concern

### 8.1 Recommended loading behavior

| Concern | Recommendation |
|---|---|
| Audio | **No change.** Zero-load synthesis is already optimal — it is the reason the game downloads 0 bytes of media. |
| Video | **No change.** CSS + inline SVG is optimal for this content type. |
| TTS | Add a **voice-availability probe** at startup: if `pickVoice()` returns `null` or no `zh-*` voice exists, surface a player-facing message and record it in a dev-only log (§8.9). |
| Page | Consider `defer` on the Tailwind CDN script, or self-host a pre-built Tailwind CSS file. This is the single largest remaining first-paint cost — the CDN compiles Tailwind at runtime in the browser. |
| Offline | Add a service worker that caches the single HTML file. Given zero media assets, this makes the game fully offline-capable for roughly 30 lines of code. |

### 8.2 Recommended caching behavior

| Concern | Recommendation |
|---|---|
| Page caching | GitHub Pages' default is adequate for a static page. |
| Media caching | N/A — there is no media. |
| Offline | **Recommended**: a service worker with a versioned cache name (`mathguardian-v3.6-<build>`) and a cache-first strategy for the HTML file. On update, show a player-facing "有新版本" prompt rather than silently swapping the file mid-question. |
| Game state | Already handled by `STORAGE` (`mg2.*` namespaced keys, per-key size caps, `JSON.parse` in a try/catch). **No change.** |
| School logo | **Recommended**: self-host it so the offline cache covers it too. |

### 8.3 Recommended memory strategy

| Current behaviour | Measured | Recommendation |
|---|---|---|
| `noise()` allocates a fresh `AudioBuffer` per call | Up to 96 KB per call; 408.8 KB per full SFX pass | **Recommended**: allocate **one** 1-second noise buffer at context creation, reuse it for every `noise()` call by playing it with an `AudioBufferSourceNode` and varying `playbackRate` + `start(when, offset)`. Steady-state memory becomes one fixed ~192 KB buffer (48 kHz × 1 s × 4 bytes) instead of unbounded churn. |
| Every SFX allocates new oscillator/gain/filter nodes | 148 `connect()` calls across 20 SFX | Acceptable at this scale, but a **voice limiter** (§8.5) should still cap live nodes. |
| No `AudioContext.close()` on teardown | The context is created once and lives for the page lifetime | Acceptable — the game is a single page session. Close it only if a future "return to menu" flow tears down the game. |
| DOM particles | 18-28 nodes per burst, removed after 900-1300 ms | **No change.** |
| Inline SVG sprite | ~42 KB of DOM, created once | **No change.** |

### 8.4 Recommended simultaneous voice limits

Currently there is **no limit**. Measured steady state is ~3 live voices
(BGM) and a worst case of ~10 (victory fanfare over BGM). The recommended
budget for a classroom tablet:

| Channel | Recommended max concurrent | Rationale |
|---|---|---|
| BGM | 3 (bass + arp + kick) | Fixed by the sequencer |
| SFX | **4** | Enough for `attack` (up to 6 voices but staggered) without masking |
| TTS | **1** | Already enforced by `speechSynthesis.cancel()` |
| **Total recommended cap** | **8** | Leaves headroom on a low-end Android tablet |

Implementation: a simple counter incremented on voice start and decremented on
`onended`, with the oldest voice stolen when the cap is exceeded. This is the
same "virtual voice" technique used in game audio engines, and it is roughly
15 lines.

### 8.5 Recommended audio pooling strategy

| Node type | Pool? | Recommendation |
|---|---|---|
| `OscillatorNode` | ❌ | **Do not pool.** Oscillators are single-use by spec. Reuse comes from *not creating* them, which the voice limiter handles. |
| `GainNode` | ❌ | **Optional**: a pool of 8 gain nodes is possible (you can re-target a gain's `gain` param), but the complexity is not justified at this scale. |
| `BiquadFilterNode` | ❌ | Same as gain — not worth it at this scale. |
| `AudioBuffer` (noise) | ❌ | **Recommended: DO pool.** This is the only node type where reuse is trivially correct — one 1-second noise buffer, played with different `playbackRate` and `offset`. This is the highest-value change in the whole review. |
| `AudioContext` | ❌ | Already correctly singleton. |

### 8.6 Recommended platform-specific differences

| Platform | Difference | Recommendation |
|---|---|---|
| iOS Safari | AudioContext starts `suspended` until a user gesture; `speechSynthesis` voice list loads late; silent mode mutes the Web Audio graph | Already handled: `Audio.prime()` on `startGame` + one-shot `touchstart`; `onvoiceschanged` re-picks the voice. **Add** a player-facing fallback if no voice is ever found. |
| iOS Safari | Background tabs suspend the AudioContext | Already handled by the `visibilitychange` handler — **except** the resume path is broken (B3). Fixing B3 is the fix. |
| Android Chrome | Background `setInterval` is clamped to ≥1 s | The BGM slows down when backgrounded. With B3 fixed, `stopBGM()`/`startBGM()` on visibility change avoids the issue entirely. |
| Low-end Android | Memory and CPU are tighter | The noise-buffer reuse (§8.3) and the voice limiter (§8.4) matter most here. |
| Desktop | All paths work | — |
| School-managed iPad | May have no Cantonese voice installed | **Add** a player-facing "此裝置未有中文語音" message. Currently silent. |
| iPad with the mute switch on | The Web Audio graph is silenced by the hardware switch | Consider a visible "請確保鈴聲已開啟" hint in the audio settings panel. |

### 8.7 Recommended fallback formats

| Medium | Recommendation |
|---|---|
| Audio | **No formats to fall back from.** Synthesis either works or the API is absent. The fallback is a player-facing message plus continued silent play. |
| TTS | Fallback order is already correct: `zh-HK` → `zh-TW` → any `zh` → `default` → first. **Add** the final fallback of "no narration available" as a visible state, not a silent no-op. |
| SVG | No fallback needed — inline, always present. |
| External logo | Provide an inline SVG fallback so a failed PNG does not show a broken-image icon. |
| Tailwind CDN | **Recommended**: add a minimal inline critical-CSS fallback for the core layout (game board, option buttons) so a blocked CDN still yields a usable game. |

### 8.8 Expected download-size improvements

| Change | Raw delta | Gzipped delta | Notes |
|---|---|---|---|
| **Baseline** | 535,780 bytes | 138,839 bytes | brotli 109,917 bytes |
| Fix B1/B2/B3 | ~+90 bytes | ~+60 bytes | 3 exported methods + 1 call-site change |
| Noise-buffer reuse | ~+700 bytes | ~+300 bytes | One buffer + a small helper |
| Master gain + 2 channel gains | ~+400 bytes | ~+180 bytes | Removes the dead `masterGain` declaration, so effectively neutral |
| Voice limiter | ~+600 bytes | ~+260 bytes | Counter + steal logic |
| Self-host the school logo | **−0 bytes** (moves ~4 KB into the repo) | — | Removes a third-party runtime request |
| Self-host pre-built Tailwind CSS | **−~12 KB raw** (removes the CDN script tag) | **−~3 KB** (a prebuilt CSS file gzips smaller than the JIT runtime) | Plus a large **first-paint** win |
| Optional: minify the inline SVG sprite | −~13 KB | −~4 KB | Requires an `svgo` step |
| Optional: service worker | +~1 KB | +~0.4 KB | Enables full offline |
| **Net realistic target** | **~523 KB raw** | **~134 KB gzip** | Plus a full offline mode |

**The honest headline: there is no meaningful download-size win available in
the media layer.** The page is already 138 KB gzipped with zero media payload.
The wins are in *latency*, *offline capability*, and *runtime memory* — not
bytes. The one real byte win is removing the Tailwind CDN runtime.

### 8.9 Expected memory improvements

| Resource | Before | After | Saving |
|---|---|---|---|
| Noise buffers | 408.8 KB allocated per full SFX pass, unbounded churn | 1 fixed ~192 KB buffer reused | **~216 KB per pass, near-zero steady-state churn** |
| Peak SFX voices | Unbounded | Capped at 8 | Bounded |
| AudioContext | 1 (already correct) | 1 | 0 |
| DOM particles | ≤28 live | ≤28 live | 0 |
| SVG sprite | ~42 KB | ~42 KB | 0 |
| **Steady-state audio memory** | **~600 KB+ churn** | **~192 KB fixed** | **~70 % reduction, no GC spikes** |

### 8.10 Potential CPU and decode costs

| Item | Current | After | Notes |
|---|---|---|---|
| **Audio decode** | **Zero.** No file is ever decoded. | Zero | The single biggest advantage of this architecture — a file-based system would pay decode cost on every SFX. |
| Oscillator synthesis | 148 `connect()` calls per 20-SFX pass; 3 voices per 180 ms for BGM | Unchanged (or lower with the voice limiter) | Negligible |
| Noise buffer fill | `Math.random()` per sample — `bossDefeat` fills 24,000 samples | **Eliminated** — one-time fill of 48,000 samples | Removes ~24k `Math.random()` calls per heavy SFX |
| `setTimeout` scheduling | 1 timer per SFX voice, plus ladders in `arp`/`sweep` | Replaced by a lookahead scheduler: 1 timer per 25 ms, scheduling ~100 ms ahead | **Better timing accuracy**, fewer timers |
| BGM `setInterval` | 1 timer per 180 ms | 1 timer per 25 ms (lookahead) | Slightly more timer wakeups, but sample-accurate playback |
| DOM particle churn | 18-28 divs per burst, removed on timer | Unchanged | Fine |
| CSS animation compositing | 63 `@keyframes`, compositor-driven | Unchanged | Fine |
| Tailwind CDN JIT compile | **Runtime compilation of the whole utility set in the browser** | Eliminated with a prebuilt CSS file | **Largest CPU win in the project** — currently on the critical path of first paint |

### 8.11 Potential compatibility problems

| Risk | Current status | Recommendation |
|---|---|---|
| `AudioContext` undefined in very old browsers | Handled — `ensure()` catches and returns `null`; game continues silently | Add a player-facing notice |
| `webkitAudioContext` prefix (old iOS) | Handled — `window.AudioContext \|\| window.webkitAudioContext` | — |
| `speechSynthesis` absent (some Linux Firefox builds) | Handled — early return | Add a player-facing notice + hide the TTS buttons rather than leaving dead buttons |
| No `zh-HK` voice installed | Falls back to any `zh-*`, then to the default voice (may read in a different accent) | Detect and warn |
| `speechSynthesis.getVoices()` empty on first call | Handled — `onvoiceschanged` re-picks | Add a timeout re-probe for browsers that never fire the event |
| iOS silent-mode switch mutes Web Audio | Not handled | Hint in the audio settings panel |
| Background-tab `setInterval` clamping | Not handled (BGM slows) | Fixed by the B3 fix (stop/resume on visibility) |
| Third-party CDN blocked by school firewall | Tailwind blocked → **entire layout breaks** | Self-host a prebuilt CSS file + inline critical CSS |
| Third-party school-CMS image blocked | Cosmetic only | Self-host + inline SVG fallback |
| `speechSynthesis.cancel()` inside `speak()` | Fine on all target browsers | — |
| Touch long-press triggering the context menu | `touchstart` listener is `{ passive: true }` | Consider `preventDefault` on the review list if the context menu interferes on iOS |

---

## 9. Baseline measurements and how to reproduce them

All numbers in this document were measured against
`index.html` at commit `d92c75a` (cycle 103).

### 9.1 Static measurements (no browser required)

```bash
cd "/Users/kencheng/workspace/vs code/education/math/team game"

# download size
wc -c index.html
gzip -c9 index.html | wc -c
brotli -c -q 11 index.html | wc -c

# media payload — all should be zero
grep -oE 'data:(audio|video|image)/[a-zA-Z0-9.+-]+;base64' index.html | wc -l
grep -cE '<audio|<video|<canvas' index.html
find . -type f -not -path "./.git/*" \
  \( -iname "*.mp3" -o -iname "*.wav" -o -iname "*.ogg" -o -iname "*.mp4" \
     -o -iname "*.webm" -o -iname "*.png" -o -iname "*.jpg" \) | wc -l

# audio module footprint
sed -n '4761,4979p' index.html | wc -lc
sed -n '4983,5088p' index.html | wc -lc

# inline SVG sprite
grep -cE '<symbol id=' index.html

# external dependencies
grep -oE 'https://[a-zA-Z0-9./_-]+' index.html | sort -u
```

### 9.2 Runtime node-allocation measurement

A mock `AudioContext` that counts every node the shipped `Audio` module
creates. The harness extracts the real module from `index.html` and calls each
exported SFX once.

**Expected output (verified):**

```
=== PER-SFX NODE ALLOCATION (single call) ===
sfx             osc  gain  buf  bufBytes  biquad
correct            1     1    0         0       0
wrong              2     2    0         0       0
bossHit            1     2    1     23040       1
bossEnraged        1     2    1     57600       1
bossDefeat         1     2    1     96000       1
castle             1     2    1     38400       1
castleHitHeavy     1     2    1     67200       1
tugPull            1     2    1      9600       1
boatRow            1     2    1      7680       1

=== TOTAL AFTER ALL SFX + TIMER CHAINS FLUSHED ===
AudioContexts created: 1
oscillators total   : 59
gains total         : 69
noise buffers alloc : 10
noise bytes alloc   : 418560 (408.8 KB)
biquad filters      : 10
connects to dest    : 148
```

### 9.3 Call-site × export cross-check

This is the check that found B1 and B2. It parses the `Audio` IIFE's return
object, then scans the whole file for `Audio.<method>(` call sites and reports
any that do not resolve.

**Expected output (verified against the current tree):**

```
Audio IIFE exported (32): attack attackSting beep boatRow bossDefeat
bossEnraged bossHit castle castleHitHeavy click correct countdown defeat
enable energyTick freeze getChannels hpTick isBgmOn isEnabled isPlaying
prime reviewAdd setBGMScene setChannel startBGM stopBGM tick tugPull
ultimate victory wrong

OK every Audio.* call site resolves to an exported method
```

**This check is now permanently enforced** by `tests/audio-audit.js`
(12 assertions, cycle 105+). It also covers `Audio.<prop>` reads (which is
what caught B3), `TTS.*` call sites, and asserts that every exported SFX
actually produces a voice.

**Meta-test (verified):** reintroducing all three bugs makes the audit report
**6 failures** with precise line numbers; restoring them returns it to
**12 pass / 0 fail**.

### 9.4 Static verification of B3

```bash
grep -n "bgmInterval" index.html
# 4766:  let bgmInterval = null;            <- IIFE-private
# 4839:  if (bgmInterval) return;
# 4842:  bgmInterval = setInterval(...)
# 4853:  if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
# 11771: _wasPlayingBGM = !!Audio.bgmInterval;  <- reads a non-exported field
```

### 9.5 BGM loop arithmetic

```
bgmTempo            = 0.18 s/step
bass pattern length = 8 notes  -> 1.44 s
arp  pattern length = 10 notes -> 1.80 s
kick                = every 8 steps
full cycle          = LCM(8, 10) = 40 steps = 7.20 s

session (Game.settings.minutes = 5) = 300 s
  full cycle repeats : 41.7
  bass repeats       : 208
  arp repeats        : 167
```

### 9.6 Current test coverage of the media system

```bash
grep -ciE "audio|tts|bgm" tests/regression.js   # -> 110 (all structural regex)
grep -c 'tick:'       tests/regression.js       # -> 0
grep -c 'beep:'       tests/regression.js       # -> 0
grep -c 'bgmInterval' tests/regression.js       # -> 0
```

---

## 10. Smallest set of changes to implement the recommendations

Ordered by value ÷ risk. Everything in P0 and P1 is deliberately small.

### 10.1 P0 — Fix the three runtime bugs (~6 lines, 1 cycle)  ✅ **SHIPPED in cycle 105**

| # | Change | Location |
|---|---|---|
| 1 | Export `tick` from the `Audio` IIFE | `index.html` export block, near `click` |
| 2 | Export `beep` from the `Audio` IIFE | same |
| 3 | Export a proper `isPlaying()` accessor and use it at the `visibilitychange` handler | `index.html:11771` |

For (3) the correct fix is **not** to export the raw `bgmInterval` timer id
(it is an opaque handle and could be `0`); it is to export a boolean:

```js
// inside the Audio IIFE
isPlaying() { return !!bgmInterval; },
```

and change the call site to `_wasPlayingBGM = Audio.isPlaying();`.

**Acceptance**: the §9.3 cross-check reports zero unmatched call sites; a
manual test confirms BGM resumes after a tab switch; the manual test confirms
the recommendation chip and the long-press reveal produce sound with no
console error.

### 10.2 P0 — Add the automated cross-check test (~60 lines, 1 cycle)  ✅ **SHIPPED in cycle 105**

Create `tests/audio-audit.js`, mirroring the shape of `tests/generator-audit.js`
(cycle 101):

1. Parse the `Audio` IIFE's export list.
2. Scan the whole file for `Audio.<name>(` call sites; fail on any that do not
   resolve.
3. Scan for `Audio.<prop>` **property** reads; fail on any that do not resolve
   to an exported name (this catches B3).
4. Assert every exported SFX is callable and produces at least one voice.
5. Assert `Audio.countdown` has at least one call site (or is explicitly
   marked deferred).
6. Assert `masterGain` is either used or removed.

**This is the single highest-leverage item in the review.** One test would
have caught all three runtime bugs and would catch the next one.

### 10.3 P1 — Audio graph hygiene (~1 cycle, ~50 lines)

| Change | Detail |
|---|---|
| Remove the dead `masterGain` declaration, or wire it | Prefer **wiring it**: `masterGain` → `sfxGain` + `bgmGain` → `ctx.destination`. This gives real volume control and enables ducking. |
| Reuse one noise buffer | Allocate a 1-second noise buffer once; `noise()` plays it with a random `offset` and varying `playbackRate` |
| Add a voice limiter | Cap concurrent SFX voices at 4 (§8.4), total at 8 |
| Convert `arp`/`sweep` to the audio clock | Replace `setTimeout` ladders with `ctx.currentTime`-based scheduling |

### 10.4 P1 — Wire the dormant sounds (~1 cycle, ~10 lines)

- Wire `Audio.countdown` to the last-10-seconds timer.
- Route the recommend-chip toggle to the new `chipToggle` sound (replacing the
  broken `Audio.tick()` call).
- Route the long-press reveal to the new `reveal` sound (replacing the broken
  `Audio.beep()` call).

### 10.5 P2 — Music quality (~1-2 cycles, data-only)

- Extend each scene's bass pattern from 8 to 16 notes.
- Alternate the arp pattern with its inversion each cycle.
- Add a fill every 4th cycle.
- Move the BGM scheduler from `setInterval` to a lookahead scheduler.

**No new audio assets are required for any of the above** — every change is to
existing synthesis code or to the existing note-pattern data.

### 10.6 P2 — Delivery and offline (~1-2 cycles)

| Change | Detail |
|---|---|
| Self-host the school logo | Removes a third-party runtime dependency; enables offline |
| Prebuild Tailwind CSS | Removes the runtime JIT compile from the critical path |
| Add a service worker | Cache-first for the single HTML file; versioned cache name; a player-facing "有新版本" prompt on update |
| Add a web app manifest | Icon, standalone display mode, splash |
| Add inline critical CSS | A usable layout even if the CDN is blocked |

### 10.7 P2 — Player-facing media states (~1 cycle)

Per §11 below.

### 10.8 Explicitly out of scope

- **Do not** introduce audio files. The current zero-payload architecture is
  the correct call for this project: it makes the game fully offline-capable,
  keeps the download at 138 KB, removes every decode cost, and removes every
  format-compatibility question.
- **Do not** add video. The content does not need it.
- **Do not** replace the procedural synthesis with a sample-based engine. The
  note-pattern data model is small, editable, and diff-friendly.

---

## 11. Player-facing copy requirements

Everything the player sees must be written for a **Hong Kong primary-school
SEN student**, in Cantonese, using the game's established tone. The
`.harness/reins/sen-a11y-reviewer/agent.md` bar applies: every icon-only
control needs a label, every state change needs an announcement, and no
technical detail may leak onto a player surface.

### 11.1 Required new player-facing states

| State | Trigger | Player-facing text (proposed) | Announce to screen reader | Notes |
|---|---|---|---|---|
| **No Cantonese voice** | `TTS.pickVoice()` returns no `zh-*` voice | 「呢部機未有中文語音，题目会用文字显示。」 (This device has no Chinese voice; the question will be shown as text.) | Yes, polite | Shown once, in the audio settings panel. The TTS buttons should be **hidden**, not left as dead buttons. |
| **Sound blocked** | `AudioContext` stays `suspended` after `prime()` | 「而家未有声音，检查一下装置的音量。」 (There is no sound right now — check the device volume.) | Yes | Offer a 「再试一次」 (Try again) button that re-calls `Audio.prime()`. |
| **Device muted** | Detected heuristically (context running, but no audible output) | 「请确保铃声已经打开。」 (Please make sure the ringer is on.) | Yes | Best placed in the audio settings panel as a standing hint. |
| **New version available** | Service worker detects a newer cached build | 「有新版本。要更新吗？」 (There is a new version. Update now?) with 更新 / 稍后 | Yes | Update must not swap the file mid-question — prompt on the menu only. |
| **Offline** | `navigator.onLine === false` | 「而家冇网络，游戏照样玩得。」 (No network right now — the game still works.) | Yes | Only show after the service worker is confirmed active. |
| **Save failed** | `STORAGE.save()` returns `false` | 「进度暂时保存不到，但你可以继续玩。」 (Progress could not be saved just now, but you can keep playing.) | Yes | The current implementation silently returns `false` — see `STORAGE.save`. |
| **Countdown** | Last 10 seconds of a timed game | 「仲有 10 秒！」 (10 seconds left!) | Yes, per tick | Needs the `countdown` sound wired (§10.4). |
| **Error (generic)** | Any unexpected failure | 「出咗点小问题，撳一下继续。」 (Something small went wrong — tap to continue.) | Yes | Never expose an exception, a stack trace, a JSON blob, an internal event name, or a file path. |

### 11.2 Copy rules for this project

- **Cantonese, not Mandarin.** The existing code uses 「掂呀」「唔緊要」「仲有」
  — match that register. Do not introduce 書面語.
- **Never blame the player.** The `wrong` sound is deliberately non-punishing
  and so is its copy. A validation error the player could not have caused
  (network, storage, autoplay policy) must not read as their mistake.
- **State the next action.** 「撳一下继续」 not 「發生錯誤」.
- **Say whether progress is safe.** The save-failure copy above explicitly
  says the player can keep playing.
- **Icons plus text.** A speaker emoji alone is ambiguous; 「🔊 朗讀」 is not.
- **No technical strings on a player surface.** No exception text, no
  `TypeError`, no `undefined`, no file path, no `mg2.*` key name, no HTTP
  status code without an explanation, no internal identifier such as
  `bgmInterval`.
- **Technical detail goes to the console / telemetry only.** The three
  confirmed bugs in §2 (B1, B2, B3) currently surface as uncaught
  `TypeError`s in the console. They must **not** be surfaced to the player
  as text — the fix is to make them not happen, and the console entry is
  acceptable for development.
- **A support reference code** may be shown to the player when it helps
  support locate the private diagnostic record, and nothing more.

### 11.3 States to verify from the player's perspective

| State | How to verify |
|---|---|
| Success | Answer correctly → green flash, rising tone, praise text |
| Failure | Answer wrongly → red flash, gentle tone, "try again" |
| Offline | Disable network → the game still loads and plays (needs the service worker) |
| Loading | First paint → currently no loading state; with a prebuilt CSS + service worker, add a simple 「載入中…」 that satisfies the `aria-busy` pattern |
| Empty | Review list with no wrong answers yet → the existing empty state |
| Permission | Microphone is not used, so no permission prompt is needed |
| Validation | Add a malformed bank question → the generic error copy |
| Timeout | Slow network with a service worker → instant from cache |
| Save | Storage full → the save-failure copy |
| Reconnect | Network returns → no state change needed (offline-first) |
| Recovery | After the audio fix, tab away and back → BGM resumes, no error |

---

## 12. Documentation index

| File | Status | Purpose |
|---|---|---|
| `docs/AUDIO_VIDEO_OPTIMIZATION.md` | **Created** (cycle 104), **updated** (cycle 105) | This document |
| `tests/audio-audit.js` | **Created** (cycle 105) | Permanent audio call-site × export cross-check — 12 assertions |
| `AGENTS.md` | **Update recommended** (not changed here) | Add a "Media" section pointing at this document, and add `node tests/audio-audit.js` to the test gates once that file exists |
| `.harness/docs/architecture.md` | **Stale — update recommended** (not changed here) | Written for v3.4 (cycle 53). It does not mention the `Audio` module's current shape, the TTS karaoke feature, `tests/generator-audit.js`, or this media review |
| `docs/ARCHITECTURE_REVIEW.md` | Current (cycle 96) | Code-architecture review. Complements this document; no conflict |
| `.harness/changelogs/` | Missing entries for cycles 60-103 | Cycle-by-cycle history |
| `DEPLOY.md` | Current | Deployment, CDN, and analytics. Will need a section on the service worker + manifest once those land |
| `TODO.md` | Stale baseline (cycle 53-59) | Should be refreshed to reflect cycles 99-103 and this backlog |

---

## 13. Known limitations of this review

| Limitation | Effect |
|---|---|
| **No browser was run.** All findings are from static analysis plus a mocked `AudioContext`. The three bugs (B1, B2, B3) are proven by *call-site resolution* and *export parsing*, not by observing the error in a live browser. | The bugs were certain (the code path is unambiguous) and are now **fixed in cycle 105**, but the fix itself has not been confirmed in a live browser. A live probe should confirm: (a) the recommendation chip now plays a tick, (b) the long-press answer reveal now plays a beep, (c) background music resumes after a tab switch. |
| **No audio was listened to.** Tone frequencies, envelopes, and relative loudness were read from the source, not heard. | Statements like "`click` and `energyTick` are indistinguishable" are derived from identical source parameters (both 0.04 s sine at 660 Hz), which is strong but not the same as listening. Verify by ear before deduplicating. |
| **No device testing.** Latency, CPU, and memory on a low-end Android tablet were not measured. | The memory and CPU figures in §8.9-8.10 are calculated from the Web Audio node model, not sampled from a device profiler. |
| **TTS voice availability was not tested** on any target platform. | The "no Cantonese voice" state in §11.1 is inferred from the code path, not observed. |
| **The music-loop repetition figures** are arithmetic from the pattern lengths, not perceptual measurement. | The claim "the bass repeats 208 times" is exact. The claim that this is *distracting* is a design judgement informed by the SEN audience, and should be validated with teachers. |

---

## 14. Summary

Math Guardian's media system is **architecturally excellent for its
constraints** and **carrying three confirmed runtime bugs**.

The zero-file, fully procedural approach means the game downloads **0 bytes of
media**, has **no decode cost**, needs **no format fallback**, and can be made
**fully offline-capable** by caching a single HTML file. That is the right
design for a school deployment where bandwidth and firewalls are unreliable,
and it should not be replaced.

The weaknesses are concentrated and fixable:

1. **Three runtime bugs** — two uncaught `TypeError`s on real student
   interactions, and background music that never resumes. All three come from
   the same root cause: **the `Audio` module's public surface and its call
   sites have drifted apart, and nothing checks that they still agree.**
2. **One test would have caught all three** — the call-site × export
   cross-check, mirroring what `tests/generator-audit.js` did for question
   generation in cycle 101.
3. **The BGM is 7.2 s long and repeats 208 times per session**, which is a
   real attention problem for the SEN audience and is fixable with a
   note-pattern data change, not a new asset.
4. **The menu is silent and easy mode plays boss music**, both of which are
   cheap to correct and would noticeably improve the experience.
5. **No player-facing media states** — a student whose device cannot play
   sound gets silence and no explanation.

The recommended path is deliberately conservative: fix the three bugs, add the
one cross-check test, tidy the audio graph (master gain, noise-buffer reuse,
voice cap), wire the two dormant sounds, and improve the BGM's variation with
data-only changes. **No new audio or video assets are needed, and no existing
architecture needs to be replaced.**

---

*Analysis performed against `index.html` @ `d92c75a` (cycle 103), 2026-10-24.
No implementation changes were made as part of this review.*

---

## 15. Changelog

| Cycle | Date | Change |
|---|---|---|
| 104 | 2026-10-24 | This document created (analysis only, no implementation changes) |
| 105 | 2026-10-24 | **B1/B2/B3 fixed** — `Audio.tick` and `Audio.beep` exported; `Audio.isPlaying()` added and used by the `visibilitychange` handler. `tests/audio-audit.js` created (12 assertions) + 6 T105 regex lock-ins in `tests/regression.js`. Meta-test verified: reintroducing the three bugs produces 6 audit failures. |

**Still open after cycle 105** (all tracked, none blocking):

| Item | Severity | Where |
|---|---|---|
| `masterGain` declared and never used → no master gain, no ducking | P1 | §8.3, §10.3 |
| `Audio.countdown` exported but never wired | P1 | §5.1, §10.4 |
| `noise()` allocates a fresh `AudioBuffer` per call (up to 96 KB) | P1 | §8.3, §10.3 |
| BGM loop is 7.2 s → bass pattern repeats 208× per 5-min session | P2 | §6.3, §10.5 |
| Home menu is silent; `menuTrack` has no audio effect | P2 | §5.1, §10.5 |
| Easy mode inherits a boss scene BGM | P2 | §6.1, §10.5 |
| No service worker / no manifest → no offline | P2 | §1.2, §10.6 |
| No player-facing media states (no voice, audio blocked, offline) | P2 | §11.1, §10.7 |
