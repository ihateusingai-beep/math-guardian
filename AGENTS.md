# AGENTS.md

Math Guardian (數學守護者：精準訓練版 **v3.6**) — two-file HTML SPA
(`index.html` + `app.js`) for Hong Kong moderate-ID SEN math practice
(easy scopes + dual board).
Vanilla JS + Tailwind CDN, no build, GitHub Pages.

## Setup

- Open `index.html` (double-click 都得 —— `app.js` 係 `<script defer>`,**唔係** `type="module"`) or `python3 -m http.server 8000`
- Tests:
  - `node tests/regression.js` → **964 pass / 0 fail** (structural regex lock-in, cycle 53–111n)
  - `node tests/generator-audit.js` → **4709 pass / 0 fail** (functional truth-table, cycle 101+ · T108 Adaptive ladder · T109 Stage/提示階梯 · T110 里程碑 · T110b 接力 · T111b 級數階梯 · T111c 守護者 species/HP · T111n 城塔數量/HP/失敗語義)
  - `node tests/audio-audit.js` → **24 pass / 0 fail** (audio call-site × export cross-check, cycle 105+ · cycle 111g **bus graph 拓撲**守門)
  - `node tests/asset-audit.js` → **23 pass / 0 fail** (像素資產品質, cycle 111a — 座標 / 倍率 / crispEdges / 死 symbol)
  - `node tests/visual/run.mjs` → **92 pass / 0 fail** (實機視覺驗證, cycle 111e — 8 scope 可答 / 639×669 overflow / L 容量 / sprite；cycle 111f — SEN 逐個選項反饋 + verdict band 幾何守門；cycle 111g — 教師台主音量 slider + 深底對比度；cycle 111h — **boot console 乾淨**；cycle 111i — **4 條真機 playtest 場景**（教師台 / 接力+級數 / 結算 / Boss）；cycle 111j — **局長可調 + 動態題數 + 級數固定 L1 + 經典逐個選項反饋**；cycle 111c — **關卡守護者（HP = Stage 進度格）+ F7 經典/boss 進度格**；cycle 111n — **F8 單人 boss 一座城塔 + 窄屏 compact 模式**；冇 Chrome 會 SKIP)
- **總計 5817 pass / 0 fail**（cycle 111n）
- No lint / typecheck / build
- Live: https://ihateusingai-beep.github.io/math-guardian/
- **Deploy domain**: `CNAME` file 已移除(cycle 107)—— 站喺 `.github.io` 服務。
  **唔好喺域名未註冊 / DNS 未生效之前加返 `CNAME`**,GitHub Pages 會即刻 301 轉過去,
  令線上站開唔到(cycle 96 就係咁擺咗 9 日)。詳見 `DEPLOY.md`。

## Layout

```
.
├── index.html              # HTML + inline CSS + 37 inline SVG symbol (~210 KB raw)
├── app.js                  # 主程式邏輯（~373 KB raw）· `<script defer src="app.js">`
├── TODO.md                 # project plan / next backlog
├── docs/                   # current engineering docs
│   ├── VISUAL_QUALITY_RUBRIC.md   # cycle106 — 視覺 rubric + 評分 + state matrix + profiles
│   ├── ART_STYLE_GUIDE.md         # cycle106 — 美術實作規則 (grid / palette / timing / export)
│   ├── UI_STYLE_GUIDE.md          # cycle106 — 遊戲 UI 規則 (構圖 / 掣狀態 / a11y)
│   ├── GAME_DESIGN_REVIEW.md      # cycle108 — 遊戲設計檢討 (核心 loop + 6 個設計缺口)
│   ├── GAMEPLAY_ASSET_PROPOSAL.md # cycle109p — 玩法 + 資產設計方案 (cycle 109 開始實作)
│   ├── PLAYTEST_REVIEW.md       # cycle111i — 真機 playtest 檢視報告 (9 條發現 + 優化機制建議)
│   ├── AUDIO_VIDEO_OPTIMIZATION.md # cycle104/105 — media pipeline audit
│   ├── ARCHITECTURE_REVIEW.md     # cycle96 — code architecture review
│   └── screenshots/                # cycle106 — before/after evidence 幀 (17 張 JPEG)
├── tests/source.js         # cycle111h — app 原始碼嘅**單一真實來源** (readAppSource / readAppJs)
├── tests/regression.js     # structural regex lock-in
├── tests/generator-audit.js # functional truth-table (generators × 30 trials + T108 Adaptive ladder + T111b 級數階梯)
├── tests/audio-audit.js    # audio pipeline audit (call-site × export cross-check)
├── tests/asset-audit.js    # 像素資產品質 audit (cycle111a — 8 組 check: viewBox / 重複 id / 座標 / 整數倍 / 死 symbol / crispEdges)
├── tests/visual/           # 實機視覺驗證 (cycle111e — headless Chrome + CDP；13 個 scenario；見 tests/visual/README.md)
├── tools/squeeze-comments.cjs # cycle111h — 安全註解清理器（gate-aware，見下）
└── .harness/               # changelogs, docs, plans
```

## Gates (every cycle)

1. `node tests/regression.js` → 0 fail  
1b. `node tests/generator-audit.js` → 0 fail  
1c. `node tests/audio-audit.js` → 0 fail  
1d. `node tests/asset-audit.js` → 0 fail（改咗 sprite / icon 尺寸就要跑）  
1e. `node tests/visual/run.mjs` → 0 fail（**改咗 UI / 版面 / 答題互動就要跑**，見下）  
2. `node --check app.js`（拆檔之後**唔好再抽最大 inline `<script>`** —— 會抽到 tailwind config）  
3. Optional live probe: easy startGame per scope + dual arena  
3b. **Visual change? → re-capture affected states + re-measure contrast** (見下)  
4. One cycle = one commit message style: `Math Guardian v3.6 — cycle N (…)`  
5. Ken **`Push`/`Live`/`順序`** = commit + push `main` (Pages). AGENTS “don’t push” overridden by Ken.

### 拆檔規則（cycle 111h 起 · 雙檔）

- `index.html` = HTML + inline `<style>` + inline SVG symbol；`app.js` = 全部主程式邏輯
- `<script defer src="app.js">` 放喺 `<head>`（1 個 RTT · 唔阻 render · app.js 同 HTML 平行下載）
- ⚠️ **唔可以用 `type="module"`** —— module 喺 `file://` 會被 CORS 攔截，
  打破「老師直接 double-click `index.html` 都行得到」呢個現場要求
- ⚠️ **唔可以改 `<script defer>` 嘅位置** —— `defer` 保證喺 DOM ready 之後先執行，
  所以主程式頂層**唔准有即時讀 DOM 嘅 statement**（得 `function $(id)` 定義就得）
- 測試要讀 app 原始碼 → 一律用 **`tests/source.js`** 嘅 `readAppSource()`（HTML+JS 拼接）
  或 `readAppJs()`（淨係 JS）。**唔好各測試檔各寫一份拼接邏輯**（cycle111e 教訓）
- ⚠️ 模組抽取嘅 end marker **一定要用程式碼**（function 簽名），**唔可以用註解文字** ——
  `tests/generator-audit.js` 原本用 `// V3.6 cycle110: 概念卡 4 里程碑` 做 ScopeLevel 模組
  嘅結束標記，註解一被清理就 `FATAL: ScopeLevel end marker not found`（cycle111h 實測）
  → 已改成 `function _checkMilestones(`


### Visual verification (cycle 106 起 · cycle111e 工具化)

任何改動 UI / CSS / token 嘅 cycle,要用 headless Chrome + CDP 覆核,唔好靠肉眼。

**cycle111e 起有咗自動化版本**（工具喺 repo 內,唔係 /tmp）:

```bash
node tests/visual/run.mjs                           # 跑晒 scenario
node tests/visual/run.mjs --scenario end-screen-overflow
```

- 自己起 static server(random port)· 冇 Chrome → SKIP + exit 0(唔阻其他 gate)· 有 Chrome 但 assert 過 → exit 1
- 現有 7 個 scenario:
  - **`all-scopes-answerable`** —— 8 個 easy scope 學生都撳得到答案
    ⚠️ cycle111e 實測捉到 P0:L 容量卡片曾經係**冇 click handler 嘅 `<div>`**,
    由 cycle 89 起 3 個 L scope 喺 SEN 畫面就係死路(經典畫面正常所以冇人發現)
  - **`end-screen-overflow`** —— 結算畫面喺 639×669 唔准 overflow(cycle110b P1 守門)
  - **`sen-l-capacity`** —— L 容量級數干擾項 + 答案係飲品 + 精靈真係 render
  - **`sprite-sheet`** —— 每個 `<symbol>` 都真係 render 到(唔係死 symbol)
  - **`sen-answer-feedback`** —— SEN 逐個選項反饋 + verdict band 幾何重疊 = 0
  - **`teacher-audio-panel`** —— 教師台主音量 slider 真係通 + 深底對比度
  - **`boot-console-clean`** —— **boot 零 console error + 關鍵 boot 步驟真係行過**（cycle111h）

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
- **File budget（cycle111h 起 · per-file，唔再係單檔 600 KB）**
  - `index.html` raw **< 260,000 bytes**（current: 223,187 · 餘 **36,813**）
  - `app.js` raw **< 420,000 bytes**（current: 392,537 · 餘 **27,463**）
  - 傳輸量（真正限制學生下載速度嘅係呢個）：**gzip < 200,000 bytes**
    （實測 raw 608 KB → gzip **166,135 bytes**；cycle111h 剝完註解 + 拆檔後 → raw 597,552 · gzip **160,607 bytes**；cycle111c 加完 5 隻守護者 → gzip **166,327 bytes**）
  - ⚠️ **拆檔唔會加快學生下載** —— 之前以為拆檔可以救 raw 預算，
    其實 gzip 之後兩者一樣，拆檔只係令 **per-file 預算** 有意義
  - 唔好為咗慳位刪 feature（cycle111a 教訓）；慳位優先用 `tools/squeeze-comments.cjs`

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
- **Audio-bus lock-in** (cycle111g, T111g + `tests/audio-audit.js` A111g-01..12):
  音頻圖由「宣告咗但冇接線嘅死變數」改成真 bus graph：
  `masterGain → ctx.destination` · `sfxGain → masterGain` · `bgmGain → bgmDuckGain → masterGain`。
  1. ⚠️ **拓撲要實測，唔可以只 grep**：`masterGain` 出現幾多次同「有冇接線」無關
     （宣告咗 20 次都係死變數都唔會捉到）。`tests/audio-audit.js` 嘅 mock AudioContext
     而家會記錄**每條 `connect()` edge** → 斷「得一個 gain 直連 destination」
     +「master 有 ≥2 個上游 bus」+「存在 gain→gain 鏈」。
  2. **slider → 平方 gain**（`g = s²`）：raw linear amplitude 會將大部分聽覺變化擺喺底部 1/5。
  3. **Ducking 要用獨立 bus**（`bgmDuckGain`），唔可以直接改 `bgmGain` ——
     否則 un-duck 會覆寫玩家自己嘅 BGM 音量設定。
  4. **TTS duck 要帶 epoch guard**：`speechSynthesis.cancel()` 會令**舊** utterance 嘅
     `onend` 觸發，唔 check `TTS._boundaryEpoch` 就會喺新一句講緊時提早 unduck。
  5. `noise()` buffer **cache**（全場 1 個）+ `loop` / 隨機 offset 變化。
  6. ⚠️ **音量 API 唔可以用 `Number(v) || default`**（0 係 falsy → 靜音會變返 100%）
     → 一律 `Number.isFinite(n) ? n : default`。
  7. **深色 surface 一律 `text-on-night*`**：教師台 `bg-slate-900` 上嘅音效 checkbox label
     之前冇呢個 class → 繼承 body 嘅深色字 → **深底深字完全睇唔到**（cycle111g 順手修）。
- **Boot lock-in** (cycle111h, T111h-14..16 + `tests/visual/scenarios/boot-console-clean.mjs`):
  - ⚠️ **v3.5 至 cycle111h 期間，每個頁面載入都 `ReferenceError: _wirePauseOverlay is not defined`**
    —— `setupTeacher()` 叫咗一個**從來冇定義過**嘅函數（v3.5 refactor 拆咗佢之後
    舊 call site 冇跟住更新）→ **成個 DOMContentLoaded 之後嘅流程全部死掉**
    （`renderTypePicker` / `renderRecommendChips` / `Profile.load` /
    `Audio.setMasterVolume` / `renderBossSelect` / resume 按鈕）
  - ⚠️ **之前 52 條視覺守門捉唔到**，因為 `tests/visual/cdp.mjs` **完全唔收集 console**
    → 而家收集 `Runtime.exceptionThrown` + `console.error`，新場景 `boot-console-clean`
    逐個指名每個 boot 步驟真係行過
  - **通則：守門一定要驗 runtime 嘅真實行為（console / 例外），唔可以淨睇 DOM 結構。**
    一個「boot 到一半 throw 咗」嘅 P0 可以喺線上存在**幾個 cycle**而所有 gate 都全綠。
  - 新增/改名 helper 之後，**一定要確認舊 call site 冇殘留**（grep 新名 + 舊名）
- **Playtest lock-in** (cycle111i, T111i-01..08 + 4 條 `tests/visual/scenarios/playtest-*.mjs`):
  - 用 `game-studio:game-playtest` skill 做**真機 playtest**，4 條流程入咗正式 gate：
    `playtest-teacher-flow`（9）/ `playtest-relay-level`（5）/ `playtest-end-screen`（5）/
    `playtest-boss`（5）—— 全部用學校 iPad **639×669** viewport
  - ⚠️ **呢輪捉到 3 條「學生見唔到」嘅隱形缺陷，regex 測試 100% 捉唔到**：
    ① easy dual **開局 banner 空**（`UI.setSENTurn` 只喺 `_scheduleNextQuestion` 被叫，
    開局從來冇叫過 → 學生唔知輪到邊隊）—— ✅ 已修
    ② 經典/boss 畫面「逐個選項 ✓/✗」**係死代碼**（`highlightBtn` 加咗 class，但
    `_scheduleNextQuestion` delay=0 → `area.innerHTML=''` 清走選項區 → **存活只有同一 tick**）
    ③ **M4 里程碑正常單局數學上唔可能達到**（一局 9 題 < 連對 10 題）
  - **通則：核心玩法一定要有「真機跑一次完整流程」嘅守門，唔可以淨靠 regex + mock。**
    Stage 進度格 / 接力 / 級數階梯 / 概念卡 / 島嶼旅程全部係「狀態被改寫」，
    mock 執行捉唔到「學生見唔到」呢類問題。
  - **strict-xfail**（cycle111i 新增，`cdp.mjs` + `run.mjs`）：
    `assert: { label, expr, xfail: true }` → 仲係壞 = `⚠️ KNOWN-ISSUE`（唔阻 gate）；
    **突然 pass = ❌ 失敗**（逼人移除標記）→ 已知缺陷唔會被鎖成「永久預期行為」。
  - ⚠️ **斷言 fail 唔等於產品有 bug**：今輪 3 條 fail 入面 2 條係**測試自己寫錯**
    （等咗 1100ms 但 class 700ms 就冇咗 / 揀錯 selector）→ **先量時間軸、再讀 source**。
- **Mechanism lock-in** (cycle111j, T111j-01..09 + 更新 T111b / T109 / PLAN / T111h-15):
  - ⚠️ **Ken 2026-10-30 拍板**（cycle111i playtest 9 條發現揀 4 條）：
    **F3 做**（經典畫面加延遲）· **F4 保留 M4**（靠 F6 局長 12 題）·
    **F5 移除自動升降級**（級數固定 L1）· **F6 做**（動態題數 + 局長可調）
  - **F6 · 局長（Stage 數）**：`_easyQuestionTotal()` = `goalStages × STAGE_CELLS` 係
    畫面所有「N 題」文案嘅**唯一真實來源**（之前寫死「10 題」→ 實際 9 題 → 對唔上）
    - `Game.settings.goalStages` 預設 **4**（= 12 題，令 M4 里程碑正常單局達得到）
    - 教師台 `#td-goal-stages` selector（1/2/3/4 關 = 3/6/9/12 題）→ 持久化落
      `Profile.data.goalStages`（lazy-init，**用 `Number.isFinite`** + 夾 1..4）
    - 改完即刻刷新選單文案（`_refreshMenuQuestionCopy()`）—— 唔會等到下次 render
  - **F4 · M4 里程碑**：`sessionStreak >= 10`，而家一局 12 題 → **正常流程達得到**
    （真機驗證：完整局 24 題（雙隊各 12）→ `milestonesByType[type].m4` 有時間戳）
  - **F5 · 級數階梯**：**自動升降級已移除** → 級數**固定 L1**
    - 刪走 `_updateScopeLevel` / `LEVEL_UP_STREAK` / `LEVEL_DOWN_STREAK`
    - `_scopeLevelOf()` 恆返 1（**唔讀** `Profile.data.levelByType` —— 舊 profile
      殘留值唔可以影響行為）；`Profile.data.levelByType` / `levelStreak` 一齊移除
    - ⚠️ `SCOPE_LEVEL_PARAMS` 嘅 L2/L3 參數**暫時冇用**（留俾 cycle 112 老師手動設級）
  - **F3 · 經典/boss 逐個選項 ✓/✗**：之前 delay=0 → `area.innerHTML=''` 即刻清走
    → 標記只存活同一個 tick。→ 經典路徑答完 **650ms（答啱）/ 1000ms（答錯）**（跟 SEN）
    + `highlightBtn` 移除時間 700 → **2200ms**（覆蓋到下一題出現）
    - ⚠️ 副作用：嗰 1 秒內 `Game.state.current[team]` 係 null（`_scheduleNextQuestion`
      會即刻清空）→ 測試要等下一題出現
- **Guardian lock-in** (cycle111c, T111c-01..13 + generator-audit T111c-1..4 + 視覺 `guardian-stage`):
  - **關卡守護者**（proposal §3.9「Boss 重新入場」+ F7）：easy 畫面每關有一隻守護者，
    **HP = Stage 進度格 3 格** → 答啱填 1 格 = 打守護者 1 格；3 格填滿 = 守護者退場 = 過關
  - ⚠️ **HP 唔係獨立欄位** —— 唯一真實來源 = `.sen-cell` 進度格
    （`GUARDIAN_BY_FAMILY` / `TYPE_GUARDIAN_FAMILY` / `_renderStageCells`）
    → 全檔唔准出現 `guardianHp` 之類嘅第二個 HP 欄位（T111c-05 / T111c-4）
  - ⚠️ **species 係 per-Stage 鎖定**（唔係 per-question）：鎖喺 `showQuestionSEN()`
    顯示新題嗰刻；過關時 `_applyStageUnits()` 清空 `s.family` → 下一關換新守護者
    - 冇 per-Stage 鎖 → 每條題都換守護者 = 學生見唔到「同一隻被打」
    - 喺答題之後鎖 → `current[team]` 仲係舊題 → 每關都鎖錯 family
  - ⚠️ **跨檔接線**要真實驗（generator-audit T111c-1）：`GUARDIAN_BY_FAMILY` 嘅每個值
    都要喺 `index.html` 真係有 `<symbol id="...">` —— 呢條正正捉「宣告咗但冇接線」
    （cycle111h `_wirePauseOverlay` 事故同類）
  - **F7 · 經典/boss 畫面進度格**：原本 `.sen-cell` **只存在於 SEN 畫面** → boss 學生
    唔知自己答到第幾題。→ classic 路徑接 `_applyStageUnits(team, CELL_UNITS)`
    （喺 `UI.updateTeam()` **之前**，唔會慢一拍）+ `#classic-cells-{team}` markup
  - ⚠️ **進度格 render 單一真實來源**：`_renderStageCells(wrapId, team)` 兩個畫面共用
    （之前 SEN 嗰邊有一份、classic 又寫一份 → 一定會走樣）
  - **SEN 安全**：守護者動畫只係守護者自己郁（冇 screen shake / hit-stop）
    + CSS + JS 兩層 respect `prefers-reduced-motion`
  - 5 隻守護者 sprite：`px-boss-count` / `px-boss-length` / `px-boss-height` /
    `px-boss-order` / `px-boss-capacity`（16×16 · 整數座標 · crispEdges · 48px 顯示）
- **Castle lock-in** (cycle111n, T111n-01..09 + generator-audit T111n-1..4 + 視覺 `castle-solo`):
  - **F8 · 單人 boss 淨一座城塔**（右隊 panel 收埋 → 右塔根本冇人控制，
    之前約 50% 嘅 HP 流失學生阻唔到，而且失敗條件要「兩座都跌到 0」）
  - ⚠️ **城塔數量 / HP 上限 / 失敗條件全部收埋成單一真實來源**：
    `_castleSides()` / `_castleMax()` / `_castleAlive()` / `_castleFallen()`
    → 全檔唔准再出現硬寫嘅 `castle.left > 0 && castle.right > 0`（T111n-03）
  - ⚠️ **單人嗰座塔 HP = 200**（= 舊版兩座加埋）—— 保住原本嘅生存時間預算；
    如果淨收細做一座 100 血塔，生存時間會砍半 ≈ 62s，學生根本打唔死 boss（T111n-1）
  - ⚠️ **雙隊語義唔可以順手改**：跌一座**唔即刻輸**（要兩座都跌先算倒）；
    `_castleAlive()`（守住）同 `_castleFallen()`（倒塌）**唔係純粹相反**（T111n-2）
  - **塔同受傷角色綁定**（左翼→騎士 / 右翼→法師）—— 之前兩者各自 random，
    會出現「法師動畫 + 左翼塔掉血」嘅矛盾（T111n-05）
  - **窄屏 compact 模式（≤767px）· F8b**：boss / 經典畫面之前喺學校 iPad
    **boss panel 被 flex-shrink 壓到 26px**（HP 條 + boss 圖溢出蓋住 team card
    → 學生**完全睇唔到 boss HP 條**）
    - ① `#screen-game > *` 唔准 shrink（內容高過 viewport 就滾動，唔好 squeeze）
    - ② boss panel 改「細格」：sprite 96→48（16×3 整數倍），名字 + HP 條排右邊（263 → 80px）
    - ③ 城塔條改一行細條（icon 48→32）+ **sticky 喺底部**（城塔 HP 條 always 見到）
    - ⚠️ 唔好加 `padding-bottom` 落 `#screen-game` —— sticky 條嘅底線係相對 scrollport
      **content box**，加 padding 會把佢推上去、反而遮住答案掣（實測重疊 89px）
    - ⚠️ compact 嘅 `display:flex` 規則一定要寫 `:not(.hidden)` —— 佢嘅 specificity
      高過 Tailwind 嘅 `.hidden{display:none}`，唔加就會令「隱藏右塔」完全失效（T111n-08）
  - ⚠️ **舊 lock-in 會反映舊行為** —— F8 改完，`playtest-boss` 條「右塔 HP > 0」斷言
    必然 fail（單人模式右塔依家隱藏 + HP 0）→ 改成 layout-aware（單人一座 / 雙隊兩座）
- Student UI: **no** stigma「SEN」label; MC **A/B/C** badges by **render order**
- `startGame`/resume helpers must be **module scope** (not nested in `setupMenu`)

## 註解契約 + 註解清理（cycle 111h）

**用家決定（2026-10-28 問卷）**：清走重複嘅 **cycle-by-cycle 敘述**註解，
但**保留所有「⚠️ 點解咁做」決策註解**。

⚠️ **本專案嘅註解文字係測試契約的一部分** —— `tests/regression.js` 有批斷言用註解
做**區域定位器**（例如 `/cycle65: boss dual only[\s\S]{0,120}playLayout === 'dual'/`
用嚟指定「断言講緊邊個 branch」）。一刀切清理就會爆 gate，而且爆得莫名其妙。
→ **所以唔可以人手維護 protected list**，要用工具實測。

### `tools/squeeze-comments.cjs`（安全註解清理器）

```bash
node tools/squeeze-comments.cjs --dry     # 只報告，唔改檔
node tools/squeeze-comments.cjs           # 實際清理（逐條改動都過 gate）
node tools/squeeze-comments.cjs --file app.js
```

- **A** 剝走註解入面嘅 **cycle 標記**（`V3.6 cycle83 C2:` · `cycle44/76/89:` · `cycle72 —` ·
  `V3.5-cycle16:` · `cycle69 punchier`），**保留描述文字**
- **B** 剝完之後註解冇內容 → 整段刪
- **C** 含決策理由標記（⚠️ / 點解 / 唔可以 / 必須 / 否則 / 之前 / 原本 …）→ **完全唔郁**
- 支援三種註解：`//` 行註解（含行尾）、`/* */` / `/** */` block 註解、HTML `<!-- -->` 註解
- 每次改動後跑 4 個 gate → 任何一條爆 → **自動還原原文**並記低「load-bearing」
- template literal 內嘅行唔郁（backtick parity + 內容前後比對）；`<script>` 區內嘅 markup 註解唔郁
- ⚠️ `tests/regression.js` 嘅 **T111h-09** 係「清理完成」end-state 斷言，清理進行中必然未成立
  → 工具會設 `MG_SQUEEZE_IN_PROGRESS=1` 暫時豁免（否則工具會被自己嘅守門擋死）

### 已知 load-bearing 註解（唔好手動刪）

- `cycle65` boss dual only · `cycle66` boss campaign must have a selected boss ·
  `cycle66` resume boss · `cycle66` after Profile.load · `cycle71` solo 唔輪換到 mage ·
  `cycle111b` scope 內 3 級難度適應 · `cycle55` 舊版用 3 random numbers ·
  `cycle100` 提取 _seqFill3 · `cycle102` 用 _pickRandomDistinct ·
  `cycle105` 呢兩個之前被 call 但冇 export · `cycle84 C3`（haptic）·
  `cycle83` 用 challenge 取代 hardcoded pwd · `V3.5-cycle16` archiveReport
- 前幾條係**區域定位器**（刻意用嚟指定斷言講邊個 branch —— 改成 code-only 錨點會令
  斷言變弱：同一個 code pattern 喺檔案入面出現 2 次，冇錨點就分唔出邊個 branch）
- 一部分係 **meta-test**（`T100-09` / `T102` / `T105` / `T99-07` / `C3-02` / `BUG-A-4`
  明確斷「呢段註解記錄咗 refactor 理由」）→ 呢啲**就係決策理由註解**，同用家決定一致，保留
- ⚠️ 刪任何一條 → 相應斷言會 fail（工具會自動擋，唔會靜靜壞咗）

### 新增註解嘅時候

- 講**點解** → 用 `⚠️` 開頭（或包含「之前 / 原本 / 否則 / 唔可以」），工具會自動保護
- 講**做咗乜**（cycle-by-cycle 敘述）→ **唔好寫**，docs/ 同 git history 已經有
- 模組抽取 marker → 用**程式碼**（function 簽名），唔好用註解（見「拆檔規則」）


## Media (audio / video)

**No audio files, no video files, no data URIs.** All sound is synthesized at
runtime via Web Audio API (`Audio` IIFE, app.js:581-930); narration uses
the Web Speech API (`TTS`, app.js:931-1050); all "video" is CSS `@keyframes`
(64 total) + DOM particles. The only visual asset payload is 37 inline SVG
symbols (~42 KB). Media payload downloaded: **0 bytes**.

- Full audit + sound-effects map + music map: **`docs/AUDIO_VIDEO_OPTIMIZATION.md`**
- 3 runtime bugs **FIXED in cycle 105**:
  - `Audio.tick()` called @6643 but not exported -> TypeError  (now exported)
  - `Audio.beep(440, 0.08)` called @10160 but not exported -> TypeError  (now exported)
  - private `bgmInterval` read @11771 -> always `undefined` -> BGM never
    resumed after tab background (now `Audio.isPlaying()` accessor)
- `tests/audio-audit.js` cross-checks every `Audio.*` / `TTS.*` call site
  against the module exports -- would have caught all 3 bugs
- **2 more P1s FIXED in cycle 111g** (用 `audio-design` skill 重建 bus graph):
  - `masterGain` 死變數 → **真 bus graph**：`masterGain → ctx.destination`，
    `sfxGain → masterGain`，`bgmGain → bgmDuckGain → masterGain`
  - `noise()` 每次 `createBuffer` → **cache：全場 1 個**（0.5 s = 93.8 KB，之前 9 個 = 343.1 KB）
  - 新增：主音量 slider（`Audio.setMasterVolume`，**平方** gain）+ TTS 朗讀時 **BGM ducking**
    （獨立 duck bus，唔會覆寫玩家嘅 slider）+ BGM 每 phrase 洗牌變奏
- Still open (tracked P1, see docs/AUDIO_VIDEO_OPTIMIZATION.md):
  - `Audio.countdown` exported but has zero call sites
  - BGM 用 `setInterval` timer 排程（唔係 audio clock）
  - A2/A3/A5–A9：menu track · easy 模式安靜曲 · BGM loop 過短 · 冇 voice limit / node pooling · 離線支援

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
