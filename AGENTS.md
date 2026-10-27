# AGENTS.md

Math Guardian (數學守護者：精準訓練版 **v3.6**) — single-file HTML SPA
for Hong Kong moderate-ID SEN math practice (easy scopes + dual board).
Vanilla JS + Tailwind CDN, no build, GitHub Pages.

## Setup

- Open `index.html` or `python3 -m http.server 8000`
- Tests:
  - `node tests/regression.js` → **895 pass / 0 fail** (structural regex lock-in, cycle 53–111f)
  - `node tests/generator-audit.js` → **4665 pass / 0 fail** (functional truth-table, cycle 101+ · T108 Adaptive ladder · T109 Stage/提示階梯 · T110 里程碑 · T110b 接力 · T111b 級數階梯)
  - `node tests/audio-audit.js` → **12 pass / 0 fail** (audio call-site × export cross-check, cycle 105+)
  - `node tests/asset-audit.js` → **22 pass / 0 fail** (像素資產品質, cycle 111a — 座標 / 倍率 / crispEdges / 死 symbol)
  - `node tests/visual/run.mjs` → **44 pass / 0 fail** (實機視覺驗證, cycle 111e — 8 scope 可答 / 639×669 overflow / L 容量 / sprite；cycle 111f — SEN 逐個選項反饋 + verdict band 幾何守門；冇 Chrome 會 SKIP)
- No lint / typecheck / build
- Live: https://ihateusingai-beep.github.io/math-guardian/
- **Deploy domain**: `CNAME` file 已移除(cycle 107)—— 站喺 `.github.io` 服務。
  **唔好喺域名未註冊 / DNS 未生效之前加返 `CNAME`**,GitHub Pages 會即刻 301 轉過去,
  令線上站開唔到(cycle 96 就係咁擺咗 9 日)。詳見 `DEPLOY.md`。

## Layout

```
.
├── index.html              # entire runtime (~575 KB raw / ~154 KB gzip)
├── TODO.md                 # project plan / next backlog
├── docs/                   # current engineering docs
│   ├── VISUAL_QUALITY_RUBRIC.md   # cycle106 — 視覺 rubric + 評分 + state matrix + profiles
│   ├── ART_STYLE_GUIDE.md         # cycle106 — 美術實作規則 (grid / palette / timing / export)
│   ├── UI_STYLE_GUIDE.md          # cycle106 — 遊戲 UI 規則 (構圖 / 掣狀態 / a11y)
│   ├── GAME_DESIGN_REVIEW.md      # cycle108 — 遊戲設計檢討 (核心 loop + 6 個設計缺口)
│   ├── GAMEPLAY_ASSET_PROPOSAL.md # cycle109p — 玩法 + 資產設計方案 (cycle 109 開始實作)
│   ├── AUDIO_VIDEO_OPTIMIZATION.md # cycle104/105 — media pipeline audit
│   ├── ARCHITECTURE_REVIEW.md     # cycle96 — code architecture review
│   └── screenshots/                # cycle106 — before/after evidence 幀 (17 張 JPEG)
├── tests/regression.js     # structural regex lock-in
├── tests/generator-audit.js # functional truth-table (generators × 30 trials + T108 Adaptive ladder + T111b 級數階梯)
├── tests/audio-audit.js    # audio pipeline audit (call-site × export cross-check)
├── tests/asset-audit.js    # 像素資產品質 audit (cycle111a — 8 組 check: viewBox / 重複 id / 座標 / 整數倍 / 死 symbol / crispEdges)
├── tests/visual/           # 實機視覺驗證 (cycle111e — headless Chrome + CDP；4 個 scenario；見 tests/visual/README.md)
└── .harness/               # changelogs, docs, plans
```

## Gates (every cycle)

1. `node tests/regression.js` → 0 fail  
1b. `node tests/generator-audit.js` → 0 fail  
1c. `node tests/audio-audit.js` → 0 fail  
1d. `node tests/asset-audit.js` → 0 fail（改咗 sprite / icon 尺寸就要跑）  
1e. `node tests/visual/run.mjs` → 0 fail（**改咗 UI / 版面 / 答題互動就要跑**，見下）  
2. Extract largest inline `<script>` → `node --check`  
3. Optional live probe: easy startGame per scope + dual arena  
3b. **Visual change? → re-capture affected states + re-measure contrast** (見下)  
4. One cycle = one commit message style: `Math Guardian v3.6 — cycle N (…)`  
5. Ken **`Push`/`Live`/`順序`** = commit + push `main` (Pages). AGENTS “don’t push” overridden by Ken.

### Visual verification (cycle 106 起 · cycle111e 工具化)

任何改動 UI / CSS / token 嘅 cycle,要用 headless Chrome + CDP 覆核,唔好靠肉眼。

**cycle111e 起有咗自動化版本**（工具喺 repo 內,唔係 /tmp）:

```bash
node tests/visual/run.mjs                           # 跑晒 scenario
node tests/visual/run.mjs --scenario end-screen-overflow
```

- 自己起 static server(random port)· 冇 Chrome → SKIP + exit 0(唔阻其他 gate)· 有 Chrome 但 assert 過 → exit 1
- 現有 4 個 scenario:
  - **`all-scopes-answerable`** —— 8 個 easy scope 學生都撳得到答案
    ⚠️ cycle111e 實測捉到 P0:L 容量卡片曾經係**冇 click handler 嘅 `<div>`**,
    由 cycle 89 起 3 個 L scope 喺 SEN 畫面就係死路(經典畫面正常所以冇人發現)
  - **`end-screen-overflow`** —— 結算畫面喺 639×669 唔准 overflow(cycle110b P1 守門)
  - **`sen-l-capacity`** —— L 容量級數干擾項 + 答案係飲品 + 精靈真係 render
  - **`sprite-sheet`** —— 每個 `<symbol>` 都真係 render 到(唔係死 symbol)

⚠️ **寫 scenario 嘅兩個陷阱**（cycle111e 實測踩過）:
1. **答題目標唔止一種**:一般 MC 係 `.sen-opt-btn`、長短/高矮係 `.len-pair-hit[data-side]`、
   L 容量卡片係 `.pic-card-mini` → **用 `tests/visual/helpers.mjs` 嘅 `ANSWER_TARGET_SRC`,唔好各寫一份**
   （各寫一份 → 其中一份漏咗 pic-grid → 每逢 random 到 findLDrink 就 stall、場景 flaky）
2. **場景要有「唔會 stall」嘅斷言**:答題 loop 搵唔到目標會空轉到 timeout,
   症狀係「screen-end 仲係 hidden」而唔係「答案撳錯」——睇落似另一個問題

### 手動視覺覆核（最低要求）

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
- File budget: `index.html` raw **< 600 KB** (current: ~585 KB / 598,798 bytes · 餘 15,602)
- **Functional truth-table** (`tests/generator-audit.js`) catches arithmetic / math correctness
  bugs that regex tests cannot see (e.g. cycle55 orderAsc/Desc20 random-as-arithmetic).
  Runs all 23 generators x 30 trials with deterministic randInt -- catches infinite loops,
  out-of-range values, broken arithmetic invariants.
- **Visual lock-in** (cycle106, T106): dead CSS / 高度鏈 / 對比度 / off-by-one 全部有 assertion。
  最重要嗰條: **全檔唔准再出現 Tailwind `apply` 指令**(見 Design system)。
- **Gameplay lock-in** (cycle109, T109): Stage 進度格 / 提示階梯 / 局長 嘅數值邏輯
  同樣要真實執行（`tests/generator-audit.js` T109 抽出 `_cellUnits` / `_applyStageUnits` /
  `_stageGoalQuestions` / `_easyHintText` 實際跑）。
  ⚠️ **唔可以用 `Number(x) || default`** —— `0` 係 falsy 會被當成 default
  （cycle 109 實測：`Number(layer) || 4` 令 layer=0 跳去第 4 層直接講答案）。
  要用 `Number.isFinite(n) ? n : default`。
- **Behavioural lock-in** (cycle108, T108): 涉及**狀態被改寫**嘅 bug,regex 結構檢查 100% 捉唔到
  (cycle 108 P0: easy scope 被 Adaptive 換成 `add10`,實測先見到)。
  → 喺 `tests/generator-audit.js` 抽出**真實模組**、用 mock 環境**實際執行**、斷言實際 state 變化。
  每條新 lock-in 都要試過「還原舊 code → fail → 修復 → pass」先算有效。
  Adaptive 嘅 `TYPE_ORDER` ladder 同 easy scope **唔可以互換** —— 適應只准喺同一個 scope 內發生。
- **Relay lock-in** (cycle110, T110/T110b): easy dual「接力」嘅數值邏輯同 panel 切換要真實執行
  (`tests/generator-audit.js` T110b 抽出 `_scheduleNextQuestion` + `UI.setSENTurn`,用 mock DOM 實際跑)。
  三個 cycle110b 實測捉到嘅 bug（全部有 lock-in）:
  1. **兩個「輪到邊隊」真實來源** —— `turnTeam` vs `currentTeam` → badge / review / Adaptive 同可見 panel 唔一致。
     → 已收埋成 `currentTeam` 一個欄位；`tests/regression.js` T110-13 **全檔唔准再出現第二個欄位**。
  2. **`setSENTurn` toggle 咗錯嘅元素** —— `#knight-card` / `#mage-card` 係「經典 game screen」嘅面板，
     easy 行嘅係 SEN screen（`#sen-panel-*`）→ 舊 code 對 SEN 板完全冇效果（dead code），
     實機截圖見到**兩條題同時顯示**，學生唔知輪到邊個。→ 改 toggle `#sen-panel-*`。
  3. **接力唔會跳過已完成嘅隊伍** → 一隊做完後傳手畀佢 → setTimeout 見 `_easyTeamDone` 就 return
     → 冇人再答題 = **死鎖**。→ 接力要先 `if (done[nextTeam]) nextTeam = other`。
  ⚠️ **新 screen / 新 panel 加落去嘅時候,要確認係同一個 screen** ——
  classic game screen 同 SEN screen 兩套 DOM,唔好照抄 selector。
- **Scope-level lock-in** (cycle111b, T111b): scope 內 3 級難度（proposal §3.6）
  要真實執行（`tests/generator-audit.js` T111b 抽出 `ScopeLevel` 模組 + `Generators`，
  用 mock `Profile` / `Game` / `FX` 實際跑）。結構鎖喺 `tests/regression.js` T111b。
  1. **級數只有一個真實來源** = `_scopeLevelOf(type)`。生成器路徑同 bank 路徑都讀佢，
     唔好各自開一個 level 欄位（cycle110b `turnTeam`/`currentTeam` 教訓）。
  2. ⚠️ **bank 題目一定要按級數過濾**（`_bankMatchesLevel`）—— bank 種子係固定難度舊題
     （count20 答案 1–8、compareLength 全部 1:2、順序題 step 2–6），
     唔過濾嘅話 **L1（上限 3 個）會收到 8 個蘋果嘅題**，級數契約有 30%（weak type 70%）漏洞。
     過濾唔啱 → `pickFromBank` 返 `null` → 交俾生成器（契約 100% 成立）。
  3. ⚠️ **比較題嘅 bank 題 ratio < 2 一律唔用** —— `_normalizeBankQuestion` 嘅
     「ensure visible 1:2」會改寫成 1:2，改完就唔喺原本級數 → L3（1:1.5）一律行生成器。
  4. ⚠️ **適應只准喺同一個 scope 內發生**（同 cycle108 教訓）：`SCOPE_LEVEL_PARAMS` 只收
     easy scope type；classic type 唔准入表，`_scopeSupportsLevel()` 一律 false。
  5. **`Profile.data.levelByType` / `levelStreak` 要 lazy-init**（`Profile.load()`），
     跟 V3.5-AUDIT8-F11 慣例，唔好靠呼叫點即場 `= {}`。
- **End-screen lock-in** (cycle110b, T110-19..21): 學校 iPad 係 **639×669**,end screen 內容一多就 overflow。
  → 概念卡 / 島嶼要喺 `end-stats` **上面**；掣行 `position: sticky; bottom: 0`（唔使捲到底先撳到）。
  → 雙隊 medal 係兩個 emoji 併埋（🥇🥇）,`.end-medal` 一定要 `white-space: nowrap`
    （之前喺窄 box 換行,疊落標題「完成！」上面）。
- **Pixel asset lock-in** (cycle111a, T111 + `tests/asset-audit.js`): 像素品質缺陷 **regex 同數值測試都捉唔到**
  （座標非整數 / 顯示倍率非整數 → 淨係畫面睇得出「邊緣有灰」）。所以有獨立嘅 `tests/asset-audit.js`:
  1. viewBox ∈ 4 個標準 2. 冇重複 symbol id 3. 座標全整數（path d / x / y / cx / cy / r / width / height）
  4. width/height 整數 5. bytes ≤ 預算 6. 冇死 symbol 7. 顯示尺寸 = viewBox × 整數倍 8. 每個 symbol 有 `crispEdges`
  ⚠️ **寫 asset-audit 時踩過嘅坑（唔好再犯）**：
  - `stroke-width` **唔係座標** —— 唔可以用 `\b(width|height)` 配對（會匹配 `stroke-width`）。
    `stroke-width="0.5"` 喺 2× 顯示 = 1 個 device px,係**正確**嘅像素畫法,唔好改。
  - CSS cascade：**同一個 selector 出現多次 → 最後一個贏**。讀第一個會「假通過」
    （實測 `.pic-card-svg` 84px 版本喺後面贏咗,audit 話 OK 但畫面係 84px）。
  - 抽 CSS rule 前要**先剝註解 + 剝 @keyframes/@media 嵌套**,否則 selector capture 會連註解一齊食埋。
  - 像素 icon 容器**唔可以用 em / vw / clamp** → 隨父字體 / 視窗浮動,非整數倍。
    16×16 → 16 / 32 / 48px（1× / 2× / 3×）。
- **Game-feel lock-in** (cycle111f, T111f + `tests/visual/scenarios/sen-answer-feedback.mjs`):
  SEN 畫面嘅**逐個選項反饋**（project §12 規格一直冇喺 SEN 畫面落地 ——
  經典畫面有 `.option-btn.correct/.wrong` + ✓/✗，SEN 畫面冇）:
  1. **反饋層唔可以遮住學習訊號層**（本 cycle 最重要嘅教訓）。
     舊版全屏 overlay 置中放 5.5rem 大字 → 實測 639×669 重疊 **32,032 px²**，
     答錯嗰陣被揭示嘅正確答案完全被蓋死。而家三層：
     **① 全屏淡色 wash（0.45 → 0.12，唔食掉狀態色）② 頂部 verdict band ③ 逐個選項反饋**。
     → band 同任何一個選項掣嘅重疊必須係 **0**，由視覺場景實時量 `getBoundingClientRect()` 守門。
     ⚠️ **幾何守門要斷「高度」唔可以只斷「top」**：只查 `band.top == panel.top` 會漏過
     `inset:0` 置中復辟（top 一樣都係 88）→ 必須同時斷 `band.height ≤ 100px`
     同「唔覆蓋 `.sen-cell` 進度格」。
  2. **SEN 安全上限**：答錯用**藍灰** `#e2e8f0`（唔准刺眼紅）· 唔做 screen shake / hit-stop
     · pop 只喺被撳嗰個掣 · 一定要返原狀 · CSS + JS 兩層 respect `prefers-reduced-motion`。
  3. **時序**：逐個選項反饋一定要喺 `_senShowFeedback` **之前**（聲音同動畫同一幀起點）。
  4. ⚠️ **同一個概念有兩條 render 路徑**（classic / SEN）→ 兩條都要有 lock-in
     （cycle111e 已經捉到一次：經典畫面正常、SEN 畫面壞咗）。
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

### Easy scope 級數階梯 (cycle 111b)
- 每個 easy scope 有 **3 級**（`SCOPE_LEVEL_PARAMS`）：連續 **4 對 → 升級** · 連續 **3 錯 → 降級**
  · 級數存 `Profile.data.levelByType[type]`（跨課堂保留）
- **級數只改同一個 type 嘅難度**（`count20` 個數上限 · `compareLength/Height` 比例 ·
  `orderAsc/Desc` 步長 · `learnL/findL*` L 容量干擾項數量），**永遠唔換 scope**
- 目標容量固定 **1L** → prompt 唔使跟級數改文案（「邊件有 1L?」）
- **唯一真實來源 = `_scopeLevelOf(type)`**（生成器路徑 + bank 路徑共用）
- 級數表：`count20` 1–3 / 1–5 / 1–10 · `compare*` 1:2 / 1:3 / 1:1.5 ·
  `order*` 步長 2 / 1 / 1+干擾 · `L` 干擾 1L+2L / 1L+1.5L / 1L+1.5L+2L

### Easy dual 接力 (cycle 110)
- **接力**: easy dual 每答完一題就**傳手**（之前同一隊一直答,第二個學生根本冇得出手）。
  - 答錯嗰條題**傳俾另一隊救**（同一條題,唔抽新題）→ `Game.state.replayQ`（單一重播槽）
  - 答錯第 2 次 → 扣 ½ 格(`_applyStageUnits(team, -2)`)+ 換新題（避免無限卡住）
  - 接力**必須跳過已完成嘅隊伍**,否則一隊做完就死鎖
- **可見性**: 只顯示「輪到嗰隊」嘅 **SEN panel**（`#sen-panel-*`），單欄全寬（`.sen-board-relay`）
  + 頂部 banner「輪到 X」/「✅ X 完成咗 · 輪到 Y」
- **「輪到邊隊」唯一真實來源 = `Game.state.currentTeam`**（badge / review / Adaptive / 可見 panel 全部讀佢）
- **概念卡 4 里程碑**（persisted 落 `Profile.data.milestonesByType`）:
  M1 首次答啱 · M2 冇用提示連對 5 題 · M3 錯咗之後救回 · M4 同一局連對 10 題
  結算畫面用 `renderEndConceptCards` 顯示（重用現有 `px-abacus` / `px-badge-*` 死 symbol,零新 asset）
- **島嶼旅程**: 跨課堂累積（`Profile.data.islandStage`），結算畫面 CSS pips bar

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
