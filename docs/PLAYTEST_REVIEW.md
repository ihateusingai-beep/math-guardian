# 真機 Playtest 檢視報告（cycle 111i）

> 用 `game-studio:game-playtest` skill 做真機（headless Chrome + CDP）playtest，
> 目標係**捉實況問題**，再出遊戲機制層面嘅優化建議 —— 唔係 code review。
>
> 日期：2026-10-30 · 對象：Math Guardian v3.6（`index.html` 215,405 B + `app.js` 383,441 B）
> 場地：學校 iPad **639×669**（全部 11 條視覺場景都用呢個 viewport）

---

## 0. 一頁講晒

| 項目 | 結果 |
|---|---|
| 真機 playtest 場景 | **4 條新場景**（教師台 / 接力+級數 / 結算 / Boss），已變成正式守門 |
| 總發現 | **8 條**（P0×1 · P1×4 · P2×2 · P3×1） |
| Ken 拍板 | 2026-10-30 揀咗 **4 條**落地（F3 / F4 / F5 / F6）→ **cycle 111j** |
| 已修 | **6 條**（P0 boot crash · P1 開局 banner · P1 F3 · P1 F4 · P1 F5 · P2 F6） |
| 仍未做 | **2 條**（F7 boss 進度格 · F8 單人 boss 無主城塔） |
| 新守門 | regression **+17 條**（T111i-01..08 · T111j-01..09）· 視覺 **+28 條** · 加咗 **strict-xfail** 機制 |
| Gate | **5738 pass / 0 fail**（regression 942 · generator 4662 · audio 24 · asset 22 · visual 88） |

**最重要嘅一句**：呢個版本嘅核心玩法（Stage 進度格 / 接力 / 級數階梯 / 概念卡 / 島嶼旅程）
**全部真機行得通、冇死鎖、冇 crash**；但有 **3 個「學生見唔到」嘅隱形缺陷**
（開局 banner、經典畫面逐個選項反饋、M4 死里程碑），同 **1 個數據對唔上**
（寫「10 題」其實 9 題）。呢四條都係 **regex 測試捉唔到** 嘅 —— 必須真機行。

---

## 1. 方法

### 1.1 點做

| 步驟 | 工具 | 產出 |
|---|---|---|
| 揀流程 | `game-studio:game-playtest` skill | 4 條涵蓋教師台 / 玩法 / 結算 / Boss 嘅場景 |
| 實機執行 | `tests/visual/`（headless Chrome + CDP，`cdp.mjs`） | 每條場景真係開 app、撳掣、讀 runtime 狀態 |
| 視覺證據 | `Page.captureScreenshot` → `tests/visual/.out/*.png` | 12 張截圖 |
| runtime 行為 | `Runtime.exceptionThrown` + `console.error` 收集 | boot 零 error |
| 量化 | Node 蒙地卡羅模擬（20 萬次） | 級數階梯 4 種設計對比表 |

### 1.2 三個「測試寫錯 vs 產品有 bug」嘅分辨法

呢輪捉到 **2 條係我哋自己測試寫錯**，唔係產品缺陷。分辨方法：

| 現象 | 唔好亂猜 | 正確做法 |
|---|---|---|
| boss「答錯反饋」斷言 fail | 唔好即刻改產品 | 讀返 source：`highlightBtn` 700ms 就 remove class，但場景等咗 1100ms → **測試 timing 錯** |
| boss「城堡進度格」搵唔到 | 唔好即刻加 class | 讀返 markup：嗰個係**城塔 HP 條**（`#castle-left/right-fill`），唔係進度格 → **測試 selector 錯** |
| 逐個選項 ✓/✗ 學生睇唔到 | 唔好靠推理 | **實測量生存時間**：t0=1 → 120ms=0 → 證實係產品 bug（選項區被 `innerHTML=''` 清走） |

⚠️ **通則**：斷言 fail 嘅第一反應唔應該係「改產品」，而係「**先量時間軸、再讀 source**」。
今輪 3 條 fail 入面，1 條真 bug、2 條測試自己錯。

---

## 2. 發現清單

### F1 · 🔴 P0 · boot 每個都 crash（已修 · commit `be1f109`）

- **重現**：開任何頁面 → console `ReferenceError: _wirePauseOverlay is not defined`
- **後果**：`setupTeacher()` throw → **成個 DOMContentLoaded 之後嘅流程全部死掉**
  （`renderTypePicker` / `renderRecommendChips` / `Profile.load` / `Audio.setMasterVolume` /
  `renderBossSelect` / resume 按鈕）→ 題型選擇器、推薦 chips、學生 profile（級數·里程碑）、
  主音量、Boss 面板、教師台 pause-resume、題庫管理 add **全部失效**
- **根因**：v3.5 refactor 把 `_wirePauseOverlay()` 拆成 `_showPauseOverlay` / `_hidePauseOverlay`
  + `_wireTeacherActions`，**舊 call site 冇跟住更新**；而 `_wirePauseOverlay`
  **喺成個 repo 歷史從來冇定義過**（`git log -S` 確認）
- **狀態**：✅ 已修 + 新守門 `boot-console-clean` 場景（8 條）+ T111h-14..16

---

### F2 · 🟠 P1 · easy dual 接力**開局 banner 空**（已修 · cycle 111i）

- **重現**：主頁揀「雙人接力」→ 開始 → 畫面頂部**冇「輪到 X」**
- **證據**：截圖 `playtest-relay-1-start.png` —— 只有「← 同學」+「🏆 平手 0:0」+ arena 條
- **根因**：`UI.setSENTurn` **只喺 `_scheduleNextQuestion`（app.js:5741）被叫**，
  即係「答完一題」嗰陣。開局從來冇叫過 → `applySENBoardLayout`（app.js:3632-3636）
  只收埋右隊 panel，`sen-turn-banner` 文字係空
- **學生後果**：**唔知輪到邊隊先出手**，要等答完第一題先出現提示
  → 兩人一齊撳 / 撳錯掣
- **修法**：`startGame` 喺 `applySENBoardLayout()` 之後補 `UI.setSENTurn(Game.state.currentTeam)`
- **守門**：regression T111i-01..04 + `playtest-relay-level` 真機場景（banner 斷言）
- **狀態**：✅ 已修 · 場景由 **4/5 → 5/5 pass**

---

### F3 · 🟠 P1 · 經典 / boss 畫面「逐個選項 ✓/✗」係**死代碼**

- **重現**：boss 模式答錯 → 學生**睇唔到**自己揀嗰個掣標咗 ✗、正確答案邊個標咗 ✓
- **實測（唔係推理）**：
  | 量測點 | marked 選項數 |
  |---|---|
  | 點擊同一個 tick | **1** |
  | +0 ms（下一個 macrotask） | **0** |
  | +16 ms / +116 ms / +816 ms | 0 / 0 / 0 |
- **根因鏈**：`highlightBtn()` 加 `.correct`/`.wrong`（app.js:6157-6162，名義上保留 700ms）
  → 經典路徑 `_scheduleNextQuestion(team)` **delay = 0**（app.js:5719）
  → `nextQuestion` → `UI.showQuestion` → **`area.innerHTML = ''`**（app.js:3559-3560）
  → 選項區即刻被清走 → class 只存活「同一個 tick」
- **學生實際見到嘅**：全屏 `instant-hint` 浮層（黃色卡寫住「💡 3 + 4 = 7」+「（點擊關閉）」）
  —— 即係**答案直出**，但唔係「我揀錯咗 / 邊個啱」嘅選項反饋
- **⚠️ 同 cycle111f 嘅假設矛盾**：AGENTS.md 同 cycle111f 註解都寫「經典畫面一直有
  `.option-btn.correct/.wrong` + ✓/✗」—— 實際上**學生從來未見過**
- **狀態**：✅ **cycle111j 已修** —— Ken 拍板「加 ~650ms 延遲（跟 SEN 一致）」
  - 經典路徑答完 **650ms（答啱）/ 1000ms（答錯）**（SEN 路徑一直係咁）
  - `highlightBtn` class 移除時間 700 → **2200ms**（要覆蓋到下一題出現，否則標記會喺學生仲望住嗰條題嗰陣消失）
  - 真機驗證：`playtest-boss` 場景「逐個選項 ✓/✗ 可見」由 **fail → pass**
  - ⚠️ 副作用：嗰 1 秒內 `Game.state.current[team]` 係 null（`_scheduleNextQuestion` 會即刻清空）
    → 測試要等下一題出現；玩家喺呢段時間撳掣會被安全忽略（`handleAnswer` 見 `!q` 就 return）

---

### F4 · 🟠 P1 · M4 里程碑喺正常單局**數學上不可能**達到

- **重現**：玩完一局（正常流程）→ 結算畫面概念卡恆顯示 **● ● ● ○**
- **算術**：M4 條件 = `st.sessionStreak >= 10`（app.js:5960，即「同一局連對 10 題」）
  · 一局 = `goalStages(3)` × `STAGE_CELLS(3)` = **9 題**（app.js:2720 / 5769）
  · `sessionStreak` 錯一次就清零（app.js:5950）
  → **正常流程 9 < 10，永远達唔到**；只有撞 hardCap 18 嘅延長局先可能
- **學生後果**：4 粒里程碑圓點永遠填唔滿 → 「概念卡」機制**永遠差一格**
- **補充**：`goalStages` 係 hardcode，**冇任何 UI 可以調**（proposal §3.7 原本設計係老師可設 5/10/20 題）
- **狀態**：✅ **cycle111j 已修** —— Ken 拍板「保留 M4 + 局長改 12 題」
  - `Game.settings.goalStages` 預設 **3 → 4**（4 關 × 3 格 = **12 題**）
  - 一局 12 題 → `sessionStreak >= 10` 正常流程達得到
  - 真機驗證：完整跑一局（雙隊各 12 題 = 24 題全對）→ `milestonesByType.count20.m4` **有時間戳**
  - 概念卡維持 **4 粒圓點**（唔使拎走 M4）

---

### F5 · 🟠 P1 · 級數階梯對「中等學生」實際幾乎冇作用

> ⚠️ 我第一版嘅手推結論（「50% 學生長期跌級多過升級」）**係錯嘅** ——
> 模擬之後升降幾乎 1:1。以下係實測數據。

- **模擬**（20 萬題 / 每個答對率，100 次重複）：現行設計 = 升 連4對 · 降 連3錯 · 錯 1 次清零連對

  | 答對率 | 期望最終級數 | 升 / 降（每 5000 題） | 每題變級率 | 到 L3 中位題數 |
  |---|---|---|---|---|
  | 50% | **1.25** | 144 / 144 | **5.8%** | 82 |
  | 60% | 2.17 | 162 / 161 | 6.5% | 38 |
  | 70% | 2.73 | 96 / 95 | 3.8% | 20 |
  | 80% | 2.95 | 33 / 31 | 1.3% | 13 |

- **兩個問題**：
  1. **L3 對目標學生係裝飾級** —— 50% 答對率學生期望停喺 **L1.25**（即係 count20 個數上限 3），
     要 80% 答對率先穩定到 L3（上限 10 個）。proposal §7 Q2 講「學生實際掌握到邊個 scope」
     未答之前，3 級階梯可能只做咗 1.5 級嘅效果
  2. **級數震盪** —— 每題 5.8% 變級率 ≈ **每 17 題震盪一次**；一局 9 題 → **約一半機會**彈出
     `⬆️ 升級` / `⬇️ 降級` 提示（`FX.screenAlert`，app.js:5932-5934）。
     對 SEN 學生，**「⬇️ 降級」係令人挫敗嘅標籤**，而佢出現嘅頻率同學生表現無關
- **推薦**：改用**方案 A**（升 = 連 3 對 / 降 = 連 5 錯，保留清零）——
  只改兩個常數、同一個 state machine、**變級率減半、50% 學生終局級數 1.25 → 2.65**：

  | 設計 | p=50% 終局級數 | p=50% 變級率 | 到 L3 中位題數 | 改動量 |
  |---|---|---|---|---|
  | 現行（升4對/降3錯） | 1.25 | 5.8% | 82 | — |
  | **方案 A（升3對/降5錯）** | **2.65** | **3.1%** | **38** | 2 個常數 |
  | 方案 B（最近 10 題 8 對升 / 4 對降） | 1.38 | 4.2% | 84 | state 唔同，收益低 |
  | 方案 C（累計淨分 ≥+3 升 / ≤−4 降） | 2.23 | **0.7%** | 90 | state 唔同，升級太慢 |

- **狀態**：✅ **cycle111j 已處理** —— Ken 拍板「移除自動升降級（級數固定 L1）」
  - 刪走 `_updateScopeLevel` / `LEVEL_UP_STREAK` / `LEVEL_DOWN_STREAK`
  - `_scopeLevelOf()` 恆返 1（**唔讀** `Profile.data.levelByType` —— 舊 profile 殘留值唔可以影響行為）
  - `Profile.data.levelByType` / `levelStreak` 一齊移除
  - **學生唔會再見到「⬇️ 降級」挫敗提示**
  - ⚠️ `SCOPE_LEVEL_PARAMS` 嘅 L2/L3 參數**暫時冇用**（留俾 cycle 112 老師手動設級）
  - 真機驗證：`playtest-relay-level` 場景改成「級數固定 L1」（舊 profile 殘留 L3 都唔會升級）

---

### F6 · 🟡 P2 · 畫面一律寫「10 題」，實際係 **9 題**

- **實測**：`_stageGoalQuestions()` → `target = 9`；畫面出現嘅題數 = **10**
- **出錯位置**：`index.html:3891` / `3898` / `3902` · `app.js:4510-4515`（arena 文案）/
  `4537` / `4805` / `4839` / `4920` / `5111-5113`（onboarding）
- **根因**：舊版 `easyGoalTotal = 10` 寫死 → cycle 109 改成 `goalStages × 3`（自然變 3/6/9/12 題）
  但**文案冇跟住改**；proposal §3.7 原本設計就係「局長 = 5/10/20 題，**教師控制台設**」
- **學生/老師後果**：學生見「10 題」但只玩 9 題；**老師點題時會唔對數**
- **狀態**：✅ **cycle111j 已修** —— Ken 拍板「做」
  - 新增 `_easyQuestionTotal()` = `goalStages × STAGE_CELLS` → 畫面所有「N 題」嘅**唯一真實來源**
  - 改咗 **8 處**寫死「10 題」嘅文案（index.html 3 處 + app.js 5 處）
  - **教師台加「局長」控制**（`#td-goal-stages`：1/2/3/4 關 = 3/6/9/12 題）→ 持久化落 `Profile.data.goalStages`
  - 改局長即刻刷新選單文案（`_refreshMenuQuestionCopy()`）
  - 真機驗證：`playtest-end-screen`「畫面宣稱嘅題數 == 實際題數」由 **fail → pass**

---

### F7 · 🟡 P2 · 經典 / boss 畫面**冇題目進度格**

- **現實**：Stage 進度格 `.sen-cell` 只存在於 **SEN 畫面**（`index.html:4283` / `4309`）
  → 經典畫面（boss）**完全冇**「答到第幾題 / 仲有幾多題」
- **學生後果**：boss 學生淨係見到 boss HP 條同兩條城塔，**唔知自己進度**
- **對齊**：proposal §3.9「Boss 重新入場」原本就係要用**進度格驅動 boss**（HP = 3 格），
  呢部分**未做**
- **狀態**：📋 建議 · 併入 cycle 111c

---

### F8 · 🟡 P2 · 單人 boss 有**一座城塔係「無主」嘅**

- **現實**：`bossAttackCastle()`（app.js:6290-6328）**隨機**打 `left` 或 `right`；
  城塔 HP **只有跌、冇任何回血機制**（只有 `startGame` 重設 100，app.js:5403-5404）
- **單人模式**：只有騎士作答（右隊 panel 收埋，app.js:5348），
  但**右塔照樣被 boss 隨機攻擊**，而失敗條件係 `castle.left <= 0 && castle.right <= 0`（app.js:6325）
  → **約 50% 嘅 HP 流失係學生控制唔到嘅**，而且學生會見到一座「自己點都救唔到」嘅塔跌落去
- **狀態**：📋 建議（單人 boss 應該淨顯示一座塔 / 或兩隊都控制得到）

---

### F9 · ⚪ P3 · 已知 audio backlog（playtest 未覆蓋）

`Audio.countdown` 0 call sites · BGM 用 `setInterval` 排程（唔係 audio clock）·
menu track / easy 安靜曲未做 · 冇 voice limit / node pooling · 離線支援
→ 詳見 `docs/AUDIO_VIDEO_OPTIMIZATION.md`

---

## 3. 優化機制建議（對應 proposal §5）

### 3.1 建議 cycle 順序

| 建議 cycle | 內容 | 對應 | 依據 | 風險 | 建議做唔做 |
|---|---|---|---|---|---|
| **111i** | 修 F2 開局 banner · 4 條 playtest 場景入守門 · strict-xfail | — | F2 | 低 | ✅ 已做 |
| **111j** | **F3 + F4 + F5 + F6 全部落地**（Ken 拍板）：經典逐個選項反饋延遲 · 局長 12 題令 M4 可達 · 移除自動升降級 · 動態題數 + 教師台局長控制 | §3.6 §3.7 §3.9 | F3 F4 F5 F6 | 中 | ✅ **已做** |
| **111c** | **F7 boss 進度格**：boss HP 綁 Stage 進度格（proposal §3.9 原設計） | §3.9 | F7 | 中 | ⏸ 併入原定 cycle 111c |
| **111n** | **F8 單人 boss 城塔**：單人淨顯示一座 / 或加回血 | §3.9 | F8 | 中 | ⏸ 要 Ken 拍板 |
| **112** | 教師台 8 項控制 + 班級模式 + 概念卡 UI + **老師手動設級**（L1/L2/L3 通道而家留咗） | §3.10 | F5 | 中 | 原定 |
| **111d** | 4 scope + 3 UI icon + emoji-as-chrome 置換（asset） | §4.3-4.5 | 資產 | 低 | 原定 |
| **112** | 教師台 8 項控制 + 班級模式 + 概念卡 UI + **重設級數掣** | §3.10 | 教師 | 中 | 原定 |

### 3.2 cycle 111j 之後嘅下一步

1. **試教驗證 F5 嘅決定** —— 「固定 L1」係一個**冇 field data 嘅資訊決定**：
   Ken 根據 20 萬次模擬 + 學生體感揀咗「唔好因為答錯就降級」。
   → 下次上堂記低幾個學生嘅答對率同級數變化，再決定要不要開放老師手動設級（cycle 112）
2. **F7 boss 進度格**（cycle 111c）—— boss 學生而家仍然唔知自己答到第幾題
3. **F8 單人 boss 城塔** —— 有一座塔係學生控制唔到嘅

> ⚠️ **Memory rule 7**：連續 2 個 routing-layer change 60 小時內 ship + 冇 field data
> → pause 2-3 日，等 ≥50 routing decisions telemetry。cycle 111j 動咗 F5（routing-layer），
> 所以 **cycle 111c/111n 之前建議先試教一輪**。

### 3.3 建議唔好做

- **同儕比較 / 進度榜**（proposal §7 Q7）—— 中度學生比較會造成壓力，我傾向唔做
- **boss HP = 答題傷害（15–20）**（proposal §3.9 已指出無意義）—— 應該綁進度格
- **為咗慳位刪 feature** —— 預算仲有：index.html 餘 44,595 B · app.js 餘 36,559 B ·
  gzip（index.html + app.js 拼接）**163,565 B** < 200 KB

---

## 4. 守門化：呢輪新增咗咩

### 4.1 4 條真機 playtest 場景（入正式 gate）

| 場景 | 條數 | 覆蓋 |
|---|---|---|
| `playtest-teacher-flow.mjs` | 9 | 密碼 challenge → 答錯有 error → 答啱解鎖 → 儀表板有數據 → 題庫管理有內容 → 主音量 slider 真通 → 關閉 focus 還原 → 暫停 overlay → 續玩收埋 |
| `playtest-relay-level.mjs` | 5 | 接力開局 banner + 只顯示輪到嗰隊 → 答啱傳手 → 答錯傳另一隊救（重播槽）→ 級數連 4 對升 L2 → 級數跨 reload 保留 |
| `playtest-end-screen.mjs` | 5 | 題數文案 vs 實際（xfail）→ 一隊做完跳過佢唔死鎖 → 概念卡 4 粒圓點 → 島嶼 pips 8 格 → M4 可達性（xfail） |
| `playtest-boss.mjs` | 5 | Boss 面板 + HP 條 render → 答啱 HP 真跌 → 城堡 HP 條 render → 答錯見到正確答案 + 錯題入 review → 逐個選項 ✓/✗ 可見性（xfail） |

### 4.1b 已知缺陷索引（xfail 標記嘅 label 一定要喺呢度有記錄）

> `tests/regression.js` T111i-08 會掃描全部 `playtest-*.mjs` 入面嘅 `xfail: true` 標記，
> 逐條 label 喺呢個檔搵唔到就 **fail** → 已知缺陷唔會被靜靜清走。

| 發現 | 狀態 | 對應守門 |
|---|---|---|
| F3 經典/boss 逐個選項 ✓/✗ 學生睇唔到 | ✅ cycle111j 已修（650/1000ms 延遲） | T111j-05 + `playtest-boss` |
| F4 M4 里程碑正常單局唔可能達到 | ✅ cycle111j 已修（局長 12 題） | T111j-02 + `playtest-end-screen` |
| F6 畫面寫「10 題」實際 9 題 | ✅ cycle111j 已修（動態文案） | T111j-01/06 + `playtest-end-screen` |
| F5 級數階梯對中等學生冇作用 | ✅ cycle111j 已處理（移除自動升降級 → 固定 L1） | T111j-04 + `playtest-relay-level` |
| F7 boss 畫面冇題目進度格 | 🟡 未做（併入 cycle 111c） | — |
| F8 單人 boss 有一座城塔無主 | 🟡 未做（待 Ken 拍板） | — |

**cycle111j 現況：0 個 xfail 標記**（3 條已知缺陷全部修好，行為已升級做正式 lock-in）。

### 4.2 strict-xfail：已知缺陷唔可以鎖成「永久預期行為」

之前冇呢個機制，壞嘅嘢只可以「當 pass 咗算」或者「擺低唔理」。而家：

- `assert: { label, expr, xfail: true }`
- 仲係壞（assert fail）→ 報 **⚠️ KNOWN-ISSUE（xfail）**，唔阻 gate
- **突然 pass（bug 修好咗）→ 報 ❌ 失敗**，逼人移除 `xfail` 標記

→ 令 F3 / F4 / F6 三條已知缺陷**明文追蹤**，而唔會喺將來被遺忘。

### 4.3 還原驗證（每條新 lock-in 都做過）

`/tmp/mg-revert-111i.cjs` —— **8 / 8 case PASS**，每個 case 都係「還原舊 code → gate 必須 fail」：

| case | 還原乜 | 期望 |
|---|---|---|
| 1 | 拎走開局 `setSENTurn` | regression fail |
| 2 | `setSENTurn` 唔讀 `currentTeam` | T111i-04 fail |
| 3 | `cdp.mjs` 拎走 xfail 支援 | T111i-07 fail |
| 4 | `run.mjs` 拎走 strict-xfail | T111i-07 fail |
| 5 | 拎走一個 playtest 場景 | T111i-05 fail |
| 6 | 場景 viewport 唔再 639×669 | T111i-06 fail |
| 7 | 拎走所有 xfail 標記 | T111i-08 fail |
| 8 | 拎走開局 `setSENTurn` | `playtest-relay-level` banner 斷言 fail |

---

## 5. 仲要 Ken / 老師答（proposal §7 未決問題，未變）

| # | 問題 | 影響今輪邊條發現 |
|---|---|---|
| **Q1** | 一堂課實際幾多鐘？ | → `goalStages` 應該幾多（F6 / F4） |
| **Q2** | 學生實際掌握到邊個 scope？ | → 級數階梯嘅 L1 預設（F5：50% 學生停喺 L1.25） |
| **Q4** | 機數同學生數：1 機 1 人 定 1 機 2 人？ | → 接力係預設定 L3 分工 |
| **Q5** | 提示層 4（畀答案）預設開定關？ | → 影響答錯率 → 影響 F5 級數 |
| **Q6** | 獎勵個人化定班級化？ | → 概念卡 vs 班級島 |
| **Q7** | 要唔要同儕比較？ | 傾向**唔做** |

---

## 6. Changelog

- **cycle 111i** — 真機 playtest 檢視：4 條場景入守門 · 修 F2 開局 banner ·
  加 strict-xfail · regression T111i-01..08 · 視覺 60 → **84**
- **cycle 111j** — Ken 拍板 4 條發現落地：
  **F3** 經典/boss 逐個選項 ✓/✗ 真正可見（650/1000ms 延遲 + highlight 2200ms）·
  **F4** M4 保留（局長 4 關 = 12 題 → 正常單局達得到，真機驗證有時間戳）·
  **F5** 移除自動升降級 → 級數固定 L1（刪 `_updateScopeLevel` + Profile 欄位）·
  **F6** 畫面「N 題」改動態 + 教師台加「局長」控制（1/2/3/4 關）·
  regression **T111j-01..09** + T111b/T109/PLAN/T111h-15 更新 · generator-audit +3 functional ·
  視覺 84 → **88** · **13 條還原驗證全部以正確原因 fail**
