# Math Guardian — Project Plan / TODO

> **For Hermes:** one cycle = one feature. Ken: `FIX ONE` unless `順序`/`順序做` = whole plan autonomous.  
> **Push** = commit + push live Pages. Gates green first.

**Goal:** 將軍澳培智中度 SEN 數學課堂可用 — 雙檔 SPA（`index.html` + `app.js`）、圖選/手勢 A-B-C、solo/dual、穩定 regression。

**Live:** https://ihateusingai-beep.github.io/math-guardian/  
**Local:** `~/workspace/vs code/education/math/team game`  
**Stack:** `index.html` + `app.js`（vanilla JS + Tailwind CDN，`defer` classic script）· `tests/` · GitHub Pages · no build

---

## 0. 現況（baseline · 2026-10-30 · post cycle 111i）

| 項 | 值 |
|---|---|
| Version | **v3.6** · cycle **111i** |
| Tests | **5728 pass / 0 fail**（933 regression + 4665 generator-audit + 24 audio-audit + 22 asset-audit + 84 visual） |
| Size | `index.html` **215,405 B**（< 260 KB）· `app.js` **383,441 B**（< 420 KB）· gzip 傳輸 **163,565 B**（< 200 KB） |
| Media payload | **0 bytes**（全部 runtime 合成） |
| Visual readiness | **6.3 / 10**（Before cycle 106 = 4.56）· 見 `docs/VISUAL_QUALITY_RUBRIC.md` |
| Core done | easy scopes · solo/dual arena · 黃/紫長短 · 數數分5 · 順序跟住 · bank v3 · 視覺 P0 修清 · **拆檔 + 註解清理** |

**Design ground truth（cycle 106 起）**
- Art direction：**2D 像素插畫 + 高對比大圖示嘅課室教學遊戲**
- 雙軌基準：UI 對教育平台（IXL / Khan Academy Kids）· 像素呈現對 2D 像素遊戲
- Token：`--c-text-on-light` / `--c-text-on-dark` / **`--c-text-on-night`**（固定淺色 · 唔跟 theme · 專為夜空深底）
- **硬規則：全檔唔准再出現 Tailwind `apply` 指令**（T106 lock-in 會捉）

---

## 1. DONE

- [x] **c37–52** （見 git log / 舊 changelog）
- [x] **c53 N1** 長短 黃條/紫條（唔撞手勢 A/B）
- [x] **c54 N2** 數數每 5 一行
- [x] **c55 N3** 順序「邊個跟住？」
- [x] **c56 N4+N5** diff-helper + 老師覆寫標
- [x] **c57 N8** 4 scope bank seed + `mg2.bank.v3`
- [x] **c58 N9–N11** AGENTS / changelog / roadmap
- [x] **c59 N6+N7** onboarding 3 步 + dual 藏 units
- [x] **c99–103** debug / math correctness / a11y linter
- [x] **c104** `docs/AUDIO_VIDEO_OPTIMIZATION.md` — media pipeline audit
- [x] **c105** 3 個 audio runtime bug 修正 + `tests/audio-audit.js`
- [x] **c106** 視覺品質 rubric + 美術/UI style guide + P0 修復（死 CSS / 高度鏈 / 對比度 / 第 0 題）
- [x] **c107** 修 deploy placeholder 域名事故（刪 `CNAME` + Plausible `data-domain` + T107 lock-in）
  —— 線上站由 2026-10-16 起一直 301 去未註冊域名（開唔到），而家回復 `.github.io`
- [x] **c108** 遊戲設計檢討 + 修 P0（Adaptive ladder guard）+ T108 behavioural lock-in
  —— easy scope 學生連答啱 5 題，scope 會被換成 classic 加法題（已修）

---

## 2. NEXT（cycle 109+ backlog）

> 來源：`docs/GAME_DESIGN_REVIEW.md`（遊戲設計層）· `docs/VISUAL_QUALITY_RUBRIC.md` §9（視覺層）。
> 詳細證據、最小改動步驟、驗證方法全部喺對應 doc，呢度只做 index。

### P0 · 遊戲設計（cycle 109 方案已出 → 等 review）

> 📌 **完整方案**：`docs/GAMEPLAY_ASSET_PROPOSAL.md`（cycle 109 proposal，未實作）
> —— 玩法（Stage / 進度格 / 接力協作 / 提示階梯 / 錯題重播 / 概念卡 / Boss 重新入場）
> + 資產（16 個新 symbol + 像素品質規格 + 預算表）+ 4 個 cycle 落地路線 + 7 條未決問題。
>
> 路線已定：**B 鞏固化 → C 結構化 → A 適應化**

- [ ] **review 方案**（Ken / 老師）→ 回饋 §7 七條未決問題（課堂長度 / 學生能力基線 / 課程要求 / 機數 / 提示政策 / 獎勵個人定班級 / 同儕比較）
- [x] **cycle 109** 玩法骨架：Stage + 進度格（3 格 · 半格）+ 局長 = Stage 數 + 提示階梯 4 層 + 錯題原地重播 + 局完重練關卡（**0 新 asset**）✅ 已 ship
- [x] **cycle 110** 協作 L1 接力（答錯傳手）+ 概念卡 4 里程碑 + 班級島進度（重用 6 個死 symbol）✅ 已 ship
      └ cycle110b 修 3 個實測 bug：①「輪到邊隊」兩個真實來源（`turnTeam` vs `currentTeam`）→ 收埋成一個
        ② `setSENTurn` toggle 咗經典 screen 嘅 `#knight-card`（easy 行 SEN screen → dead code，
        實機見到兩條題同時顯示）→ 改 `#sen-panel-*` + 單欄全寬
        ③ 接力唔跳過已完成隊伍 → 一隊做完就死鎖
      └ cycle110c end screen 喺 iPad 639×669 overflow：概念卡/島嶼提到 stats 上面 + 掣行 sticky
        + 雙隊 medal `white-space: nowrap`（之前 🥇🥇 換行疊落標題）
- [x] **cycle 111a** 像素資產品質全修 + `tests/asset-audit.js`（8 組 check）✅ 已 ship
      └ 座標全整數（7 個 symbol）· 顯示尺寸改整數倍（em/vw/clamp → px）· 35+2 symbol 加 `crispEdges`
      └ 刪走重複定義嘅 `px-castle`（舊一份永遠 render 唔到）· 清走重複 CSS rule（`.pic-card-svg` / `.boss-svg`）
      └ **修好靜靜壞咗嘅功能**：`_lPickMC` 冇傳 `svgId` → 6 個 pkg 精靈從來冇 render 過
      └ 新增 2 個精靈（`pkg-soymilk-1l` 豆漿 1L / `pkg-paint-5l` 油漆 5L）—— 之前「油漆 5L」借用
        「漂白水 2L」精靈，學生會讀到錯嘅容量
- [x] **cycle 111b** scope 內 3 級難度（生成器加 level 參數）+ 4 對升 / 3 錯降適應 + 跨課堂保留 ✅ 已 ship
      └ `ScopeLevel` 模組（`SCOPE_LEVEL_PARAMS` 表 + `_scopeLevelOf` / `_updateScopeLevel`）
      └ 級數表：count20 1–3/1–5/1–10 · compareLength/Height 1:2/1:3/1:1.5 ·
        orderAsc/Desc 步長 2/1/1+干擾 · learnL/findL* 干擾 1L+2L / 1L+1.5L / 1L+1.5L+2L
      └ **bank 題目按級數過濾**（`_bankMatchesLevel`）—— 舊 bank 種子係固定難度舊題，
        唔過濾嘅話 L1（上限 3 個）會收到 8 個蘋果嘅題，級數契約有 30%（weak type 70%）漏洞
      └ 修 pre-existing bug：「邊支飲品有 1L?」可能抽到洗潔精 / 漂白水做答案（加 `drink` 旗標）
      └ 新增 `pkg-orange-2l` 精靈（2L 飲品干擾項）· 目標容量固定 1L，prompt 統一「邊件有 1L?」
      └ T111b lock-in：generator-audit 真實執行 + regression 結構鎖 + 8 條還原驗證
- [x] **cycle 111e** 視覺驗證工具入 repo + 修 P0（SEN L 容量卡片撳唔到）✅ 已 ship
      └ `tests/visual/`（cdp.mjs + run.mjs + helpers.mjs + 4 個 scenario + README.md）
        —— 之前啲驗證工具全部喺 `/tmp`，換部機就冇晒防線
      └ ⚠️ **P0 修正**：SEN 畫面嘅 L 容量卡片（`learnL`/`findLDrink`/`findLItem`）
        由 **cycle 89 起就係冇 click handler 嘅 `<div>`** → 學生見到 4 張卡但撳唔到，
        3 個 scope 喺課堂上係死路（經典畫面一直正常，所以冇人發現）→ 改真 `<button>`
      └ 新守門：`all-scopes-answerable`（8 個 scope 都撳得到）· `end-screen-overflow`
        （639×669 唔准 overflow，cycle110b P1 終於有可執行防線）· `sen-l-capacity` · `sprite-sheet`
      └ 3 條還原驗證全部有效 · 連跑 3 次 30 pass / 0 fail（冇 flakiness）
- [x] **cycle 111f** game feel：SEN 逐個選項反饋 + verdict band 重構（P0）✅ 已 ship
      └ **補返 project §12 一直冇落地嘅 SEN 畫面反饋**（經典畫面有 ✓/✗，SEN 畫面冇）：
        答對 = 綠底 + 綠邊 + ✓ badge + squash&stretch pop + 慶祝粒子；
        答錯 = **藍灰** + 灰邊 + ✕ badge + 輕微搖，**同時揭示正確選項**（教學時刻）
      └ ⚠️ **P0 修正**：舊版全屏 overlay 置中放 5.5rem 大字「✅ 正！/💙 再試！」→
        實測 639×669 重疊 **352×91 = 32,032 px²**，答錯嗰陣**被揭示嘅正確答案完全被蓋死**。
        而且 0.5 alpha 全屏底會食掉逐個選項嘅狀態色 → 新反饋訊號失效。
        → 改成三層：① 全屏淡色 wash（0.45 → 0.12）② 頂部 verdict band（疊 absolute 嘅
        head 帶 → 零 layout shift，永不覆蓋選項掣 / 進度格）③ 逐個選項反饋（主要學習訊號）
      └ **SEN 安全**：答錯用藍灰唔用刺眼紅 · 唔做 screen shake / hit-stop · pop 只喺被撳嗰個掣
        · CSS + JS 兩層 respect `prefers-reduced-motion`
      └ 新守門：`sen-answer-feedback`（14 條，含 **band 幾何重疊 = 0** + 正確答案內容冇被遮
        + 答啱/答錯底色明顯唔同）；regression T111f-01..13
      └ **4 條還原驗證全部以正確原因 fail**（抽走接線 / band 置中 / 改紅 / 舊 stamp 復辟）
      └ ⚠️ 還原驗證捉到自己嘅守門漏洞：只斷 `band.top == panel.top` 會漏過 `inset:0` 置中復辟
        → 加斷 `band.height ≤ 100px` + 「唔覆蓋 `.sen-cell`」先捉得到
- [x] **cycle 111g** 音頻 mix 架構（用 `audio-design` skill）：真 master bus + 主音量 slider
      + BGM ducking + noise buffer cache + BGM 變奏 ✅ 已 ship
      └ **修兩個記錄咗好耐嘅 open P1**（`docs/AUDIO_VIDEO_OPTIMIZATION.md` A1 / A4）：
        - `masterGain` 死變數 → **真 bus graph**：`masterGain → ctx.destination`，
          `sfxGain → masterGain`，`bgmGain → bgmDuckGain → masterGain`（Duck 係獨立節點，
          唔會覆寫玩家嘅 slider）
        - `noise()` 每次 `createBuffer` → **cache：全場 1 個**（93.8 KB，之前 9 個 = 343.1 KB）
      └ 新功能：主音量 slider（`Audio.setMasterVolume`，**平方** gain `g = s²`）+ 持久化落
        `Profile.data.masterVolume` + TTS 朗讀時 **BGM ducking**（≈ −12 dB，帶 epoch guard）
        + BGM 每個 arp phrase 洗牌變奏（bass 保持落腳點）
      └ **Collateral 修正**：教師台 `bg-slate-900` 上嘅音效 checkbox label 冇 `text-on-night`
        → 繼承 body 深色字 → **深底深字完全睇唔到**（順手修，符合 cycle106 規則）
      └ Lock-in：audio-audit A111g-01..12（mock AudioContext 而家記錄**每條 connect edge**
        → 用**實測拓撲**驗 bus graph，唔係 grep masterGain 幾多次）+ regression T111g-01..14
        + `tests/visual/scenarios/teacher-audio-panel.mjs`（8 條：slider 真係通 / 平方 gain /
        0% 真靜音 / WCAG AA 對比度 / 639×669 唔 overflow）
      └ **5 條還原驗證全部以正確原因 fail**（拆 bus graph / linear gain / `|| default` /
        撤 ducking / 撤 buffer cache）
      └ ⚠️ **size 提示**：index.html 而家 608,481 bytes，離 600 KB 只剩 **5,919** ——
        111c（5 個 boss sprite ≈ 9,500 B）已經唔夠位 → **預算要拍板**（提到 640 KB 定 squeeze）
- [x] **cycle 111h** 拆檔 + 註解清理（預算拍板落地 · 用家問卷決定）✅ 已 ship
      └ **拆檔**：單檔 `index.html`（608 KB）→ **`index.html`（216,679 B：HTML + CSS + 37 SVG）**
        + **`app.js`（383,233 B：主程式）**，`<script defer src="app.js">` 喺 `<head>`
        - ⚠️ **唔用 `type="module"`** —— module 喺 `file://` 被 CORS 攔截，會打破
          「老師 double-click index.html 都行得到」呢個現場要求
        - 實測主程式頂層**冇即時讀 DOM 嘅 statement**（只有 `function $(id)` 定義）
          → `defer` 100% 安全，app.js 同 HTML 平行下載
        - 新增 `tests/source.js` 做 app 原始碼嘅**單一真實來源**
          （`readAppSource()` = HTML+JS 拼接 / `readAppJs()` = 淨 JS），4 個測試檔改用佢
      └ **預算改成 per-file**：`index.html` < 260 KB · `app.js` < 420 KB · **gzip < 200 KB**
        - ⚠️ **拆檔唔會加快學生下載** —— 之前以為拆檔可以救 raw 預算，
          其實 gzip 之後一樣（raw 608 KB → gzip 166 KB），拆檔只係令 per-file 預算有意義
      └ **清走 119 行 + 95 條重複嘅 cycle-by-cycle 敘述註解**（app.js −10,034 B · index.html −1,274 B），
        **保留所有「⚠️ 點解咁做」決策註解**（用家 2026-10-28 問卷決定）
      └ ⚠️ **清理過程捉到「註解文字 = 測試契約」嘅隱藏耦合**：
        - regression 有批斷言用註解做**區域定位器**（`cycle65` / `cycle66` / `cycle71` / `cycle111b`）
        - `generator-audit` 用 `// V3.6 cycle110: 概念卡 4 里程碑` 做 ScopeLevel 模組嘅
          **結束標記** → 註解一被刪就 `FATAL: ScopeLevel end marker not found`
        → 處理：① `generator-audit` 改用 **code-based marker**（`function _checkMilestones(`）
        → ② 新增 **`tools/squeeze-comments.cjs`**：逐條試改 + 跑 gate，任何一條爆就自動還原
          —— 「清註解」由人手 protected list 變成**可證明安全**
      └ 餘下 **10 條 load-bearing 註解**（測試靠佢做定位器 / meta-test 斷「記錄咗理由」）
        已寫入 AGENTS.md + T111h-13 逐條點名守門，工具會自動擋，唔會靜靜壞咗
      └ **7 條還原驗證全部以正確原因 fail**：拆檔 script tag 移除 / 刪 load-bearing 註解 /
        清理倒退（加 30 條 cycle 敘述）/ 清空 app.js / generator-audit 改回註解 marker /
        工具對 load-bearing 註解必須 KEPT / app.js 灌爆 per-file 預算
- [x] **cycle 111h（追加）** 🔴 **P0：boot 每個都 crash** —— 喺線上站揭發
      └ **症狀**：每個頁面載入都 `ReferenceError: _wirePauseOverlay is not defined`
        （app.js `setupTeacher()` 入面）→ **成個 DOMContentLoaded 之後嘅流程全部死掉**：
        `renderTypePicker` / `renderRecommendChips` / `Profile.load` /
        `Audio.setMasterVolume` / `renderBossSelect` / resume 按鈕 —— 即係
        **題型選擇器 / 推薦 chips / 學生 profile（級數·里程碑）/ 主音量 / Boss 面板
        全部失效**（教師台 pause-resume / 題庫管理 add 亦冇接線）
      └ **根因**：v3.5 refactor 把 `_wirePauseOverlay()` 拆成 `_showPauseOverlay` /
        `_hidePauseOverlay` + `_wireTeacherActions` 之後，**舊 call site 冇跟住更新**
        —— 而 `_wirePauseOverlay` **喺成個 repo 歷史從來冇定義過**
      └ **修法**：刪走 stale call（pause overlay wiring 已分散喺 `_wireTeacherActions`
        + `_showPauseOverlay`，唔使再有 `_wirePauseOverlay`）
      └ ⚠️ **為咩之前 52 條視覺守門捉唔到** → 因為 **個 runner 完全唔收集 console**
        → 新增 `tests/visual/cdp.mjs` 收集 `Runtime.exceptionThrown` + `console.error`
        + 新場景 **`boot-console-clean`**（8 條：console 零 error + Profile / 主音量 /
        題型選擇器 / 教師台接線 / 題庫管理 / Boss 面板 / 推薦 chips 逐個指名行過）
      └ Lock-in：regression T111h-14（唔准有 `_wirePauseOverlay` call/definition）+
        T111h-15（boot 順序鎖）+ T111h-16（boot 守門存在）+ 視覺場景 8 條
      └ **還原驗證**：加返 stale call → 4 條場景斷言 fail（包埋 console-clean）
- [x] **cycle 111i** 真機 playtest 檢視（`game-studio:game-playtest` skill）✅ 本地已驗
      └ **4 條真機場景入正式 gate**（全部 639×669）：`playtest-teacher-flow`(9) /
        `playtest-relay-level`(5) / `playtest-end-screen`(5) / `playtest-boss`(5) → 視覺 60 → **84**
      └ 🟠 **已修 P1：easy dual 接力開局 banner 空** —— `UI.setSENTurn` 只喺
        `_scheduleNextQuestion` 被叫 → 開局 banner 冇「輪到 X」，學生唔知邊隊先出手
        → `startGame` 喺 `applySENBoardLayout()` 之後補 `UI.setSENTurn(currentTeam)`
        → 場景由 4/5 變 **5/5 pass**
      └ 🟠 **新發現（待拍板）**：① 經典/boss 逐個選項 ✓/✗ **係死代碼**
        （實測存活只有同一 tick：`_scheduleNextQuestion` delay=0 → `area.innerHTML=''` 清走）
        ② **M4 里程碑正常單局唔可能達到**（一局 9 題 < 連對 10 題）
        ③ **畫面寫「10 題」實際 9 題**（文案冇跟 cycle109 嘅 `goalStages × 3`）
        ④ 級數階梯對中等學生幾乎冇作用（20 萬次模擬：p=50% → 終局 **L1.25**，
        每題 5.8% 變級率；推薦改「升 連3對 / 降 連5錯」→ 終局 2.65、變級率減半）
        ⑤ 經典/boss 畫面**冇題目進度格**（`.sen-cell` 只存在於 SEN 畫面）
        ⑥ 單人 boss 有**一座城塔係無主嘅**（boss 隨機攻擊、冇回血、失敗要兩座都跌到 0）
      └ **strict-xfail** 新機制（`cdp.mjs` + `run.mjs`）：已知缺陷用 `xfail: true` 標記 →
        仲係壞 = `⚠️ KNOWN-ISSUE`（唔阻 gate）；**突然 pass = ❌ 失敗**（逼人移除標記）
        → 已知缺陷唔會被鎖成「永久預期行為」
      └ Lock-in：regression **T111i-01..08** + 視覺 24 條；
        **8 條還原驗證全部以正確原因 fail**（拎走 setSENTurn / 唔讀 currentTeam /
        拎走 xfail 支援 / 拎走場景 / 改 viewport / 拎走 xfail 標記）
      └ 詳見 **`docs/PLAYTEST_REVIEW.md`**（9 條發現 + 優化機制建議 + 建議 cycle 順序）
- [ ] **cycle 111c** Boss 重新入場（進度格驅動 + HP）· 5 個 boss 守護者 sprite
      └ ✅ 預算已解：`app.js` 仲有 36,767 B 餘額（111c 約需 9,500 B）
- [ ] **cycle 111d** 4 scope icon + 3 UI icon + emoji-as-chrome 置換（合共 16 個新 symbol）
- [ ] **cycle 112** 教師台 8 項控制 + 班級模式 + 概念卡 UI
      └ ⚠️ **老師級數可見性**（cycle111b 留低嘅一項）：學生而家喺第幾級，老師喺教師台
        或結算畫面都睇唔到 → 級數系統對老師係「隱形」嘅

### P1 · 遊戲設計（細項 · 已記錄喺 design review §3）

- [ ] **B1** 錯題**同一條重播**（review item 保留完整 question payload，唔好再抽新題）— D2
- [ ] **B2** 局完加「錯題重練」關卡（連續 2 次重播都啱先移出 queue）— D5
- [ ] **B3** 局長可配（5 / 10 / 20 題）+ 教師控制台設（唔喺學生選單）— D3
- [ ] **C1** 局內 type 唔隨機跳（「全部」改成每 5 題換一個 type）— D6
- [ ] **C2** scope 選單結構化 + 教師可控局長 — D6
- [ ] **A1** 分層提示 4 級 scaffold（重述 → 聚焦 → 部分 → 完整答案）— D1
      ✅ Ken 2026-10-25 決定：**可以畀答案**，分層遞進，最後一層先講答案
- [x] **A2** scope 內難度分級 + 自適應（count20 1–3→1–10、compareLength 1:2→1:1.5）— D4
      ✅ **cycle 111b 已 ship**（4 對升 / 3 錯降 · 跨課堂保留 · bank 題目按級數過濾）
- [x] **像素品質修復**（asset 層，優先過新 asset）：座標對整數（15/35 失敗）·
      顯示尺寸用整數倍（40px/36px/em-based 全部不合格）· 加 `crispEdges`（全檔 0 次）
      ✅ **cycle 111a 已 ship**（+ `tests/asset-audit.js` 8 組 check 做長期守門）
- [ ] **emoji-as-chrome 置換**（42 種喺 UI chrome 位置）· 題目內容 emoji 保留（教學具體物體）
- [ ] **數數題固定單一水果種類**（而家 8 種混 → 減少一個認知變因）


### P0 · 殘餘對比度 / 可讀性（cycle 107 建議揀呢個）

- [ ] **Q1** 頁尾 band 改深色半透明 + `text-on-night`（`before-10-end-screen.jpg`）
- [ ] **Q2** Boss 名「森林巨魔」改 `text-amber-200`
- [ ] **Q6** 主選單 `menu-track-helper` / `scope-helper` 統一 on-night token

### P1 · Quick wins（低工時 · 高回報 · 每個 1 個 cycle 打包 2–3 項）

- [ ] **Q3** 統一 `selected` 語義色（單一 `--c-accent-selected`）
- [ ] **Q4** `.btn` 家族加 `:focus-visible` ring（3:1）
- [ ] **Q5** 移除重複 floating CTA / 改成次要動作
- [ ] **Q7** `alert()` → in-game confirm modal（3 處 · 老師面板）
- [ ] **Q8** 騎士 sprite 唔好壓住答案鈕（z-index / 位置）

### P2 · High-impact revisions（每個 = 1 個 cycle 級工時）

- [ ] **H1** 主選單重構（內容欄 580 → 900+ · staggered 構圖 · 消除 sticky 覆蓋）— **最影響 first impression**
- [ ] **H2** 跨層語言收斂（校徽圓形 mask 去白底 · emoji-as-chrome 全換 SVG symbol）— **最大單一 gap（-4）**
- [ ] **H3** 完整按鈕狀態矩陣（9 態 × 主要掣類型）
- [ ] **H4** 老師 dashboard 重做（世界觀化 · 唔再 generic card）— **最弱 critical state（5.9）**
- [ ] **H5** state transition 動畫（question enter/exit · tab switch · boss hit · reward）
- [ ] **H6** compare 類題目構圖（用中段空間 · 而家 200px 留白）
- [ ] **H7** 「雙重 A/B/C/D」清理（卡片 badge 同答案列二選一）

### P3 · Capability-based rendering profiles（規格已定 · 未實作）

- [ ] **V1** 能力偵測（dpr / cores / reduced-motion / viewportPx / deviceMemory / runtime FPS probe）
- [ ] **V2** 四個 profile（Low / Balanced / High / Ultra）落地到 CSS class
- [ ] **V3** 降級規則：hysteresis（連續 2 個 probe 先降）+ upward 需 sustained headroom（5 秒）
- [ ] **V4** 玩家 override UI + 持久化（`mg2.qualityTier`）
- [ ] **V5** 硬規則：**Ultra 唔准揭示 Low 睇唔到嘅資訊**；profile 唔准改玩法

### P4 · 需要專業 artist / 專人（AI 唔應該自動生成）

- [ ] **P1-art** 擴充 sprite 集（多 pose · 多角度 · 環境細節層級）
- [ ] **P2-art** 角色行走 / 攻擊 / 受傷 sprite sheet（取代 CSS 動畫代替品）
- [ ] **P3-art** 正式 logo + 字體授權
- [ ] **P4-art** 音效美術化（BGM loop · UI hover tick）
- [ ] **P5-art** 完整 UI 插畫化（面板材質 · 卡片材質）

### P5 · 營運 / 維護

- [ ] **自訂域名（Ken 手動 · 唔好未做 DNS 就加 CNAME）**：註冊域名 → 加 A/CNAME record →
      `dig +short` 驗到 IP → 先至加 `CNAME` file + 改 `index.html` 嘅 Plausible `data-domain` →
      再喺 Plausible dashboard 加同一個 domain（DNS TXT 或檔案驗證）。步驟見 `DEPLOY.md`
- [ ] size watch / dead code（逼近 600 KB 就要清）
- [ ] 刪 `index.html.bak`（535 KB stale 副本 · gitignored）
- [ ] classroom dogfood 修（實課後 · 特別係 H 系列 layout 改動）
- [ ] 評估 5 個未評估 state（rubric §3.2）：loading / empty / error / 全對全錯 / 雙隊慶功

### P6 願望

- [ ] Boss gallery / parent dashboard / cloud sync / 多語 TTS
- [ ] Co-op boss 2P 1 boss
- [ ] 課堂報表 PDF

---

## 3. 節奏守則

- **H 系列（layout 重排 / dashboard 重做）改完要真機 + 實課覆核**，唔可以只靠截圖 —— 學校 iPad viewport 係 639×669，唔係 1440×900。
- 每個 cycle 至少一件「可見改善」+ 一條對應 `tests/regression.js` lock-in。
- 連續 2 個 routing-layer change 60 小時內 ship 而冇 field data → **停 2–3 日**等實課回饋（見 memory rule 7）。

---

## 4. 指令

- `1` / `N12` → 單項  
- `順序` → batch  
- `Push` / `Live` → gates + commit + Pages  
- `NT-D` → 審計 only

**Gates（每 cycle 必跑）**
```
node tests/regression.js       # 825 pass / 0 fail
node tests/generator-audit.js  # 4554 pass / 0 fail
node tests/audio-audit.js      # 12 pass / 0 fail
```
改咗 UI / CSS / token → 額外：headless Chrome + CDP 重 capture 受影響 state + 重量對比度（見 `docs/VISUAL_QUALITY_RUBRIC.md` §4 驗證方法）。

**Live:** https://ihateusingai-beep.github.io/math-guardian/
