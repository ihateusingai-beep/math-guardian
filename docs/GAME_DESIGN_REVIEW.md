# Math Guardian — Game Design Review（遊戲設計檢討）

> **Cycle 108** · 2026-10-25 · 對應 `docs/VISUAL_QUALITY_RUBRIC.md`（視覺層）嘅設計層 counterpart
>
> **本文件嘅地位**：呢份係**現況 + 缺口**嘅事實記錄同改善方案。
> `docs/VISUAL_QUALITY_RUBRIC.md` 講「睇落點」；呢份講「玩落點」。
> 兩份唔重疊、互相 cross-link。

---

## 0. TL;DR

1. **搵到同修復咗一個 P0 設計 bug**（cycle 108）：easy/SEN path 嘅 scope 會喺學生連續答啱 5 題之後被**靜靜換成 classic 加法題**（`count20` → `add10`）。已修 + 已加 functional lock-in。
2. **easy path 基本上冇適應能力**。`Adaptive` 模組只服務 classic 難度嘅 6 級算術 ladder（`TYPE_ORDER`），同 easy 嘅 8 個 scope **完全冇交集**。生成器亦全部硬編碼難度。
3. **提示機制違反 errorless learning**：答錯之後直接顯示正確答案（中度學生唔使思考）。
4. **錯題重練係「出新題」而唔係「重做錯嗰條概念」** → spaced repetition 機制實際上失效。
5. **局長固定 10 題**，冇短局選項；中度學生嘅持續注意力長度同 10 題唔一定夾得啱。

---

## 1. 目標玩家同使用情境

| 項 | 值 | 來源 |
|---|---|---|
| 玩家 | 中度智障（moderate ID）SEN 學生 | 專案目標 |
| 場景 | 課室，教師主导，一機一屏或一機兩屏 | `AGENTS.md` |
| 目標 | 數數 / 長短 / 高矮 / 順序 / 容量(L) 嘅基礎概念鞏固 | 現有 8 個 easy type |
| 教師介入 | 老師控制台（暫停 / 強制結束 / 覆寫題目 / 顯示答案） | `index.html` 教師 modal |
| 評估需求 | 邊個 type 掌握咗、邊個要重練 | `Profile.statsByType` / `masteredByType` / `review` queue |

> ⚠️ **未經老師確認嘅假設**：以下設計原則（errorless learning、scaffold 層級、spaced repetition）
> 係基於中度 ID 教學嘅一般做法，**未同學校實際課程對齊**。
> 揀方案之前應該同 Ken / 老師確認：學生現時嘅能力基線、課程要求、每堂課可用時間。

---

## 2. 現時核心 loop（as-built）

以 code 為準，唔係設計意圖：

```
主選單
  └─ 揀 scope preset（5 個：只數數 / 只長短 / 只高矮 / 只容量 / 全部）
       └─ 揀身份卡（8 隻動物，圖選唔打字）
            └─ startGame()
                 ├─ Game.settings.types = senTypes   （8 個 easy type，index.html:8858）
                 ├─ Game.state.easyGoalTotal = 10   （index.html:9245）
                 ├─ Adaptive.reset()                （index.html:9243）
                 └─ nextQuestion(team)
                      ├─ type = types[randInt(...)]  （隨機抽，index.html:9371）
                      └─ UI.showQuestion(team)  → SEN 畫面（3-4 個大掣 + 視覺輔助）
                           └─ Game.handleAnswer()
                                ├─ 啱 → _applyCorrectEffects: energy +8~14、30% 大絕充能、
                                │        傷害 boss 15-20、streak 3/5/10 火焰、Adaptive.onCorrect
                                └─ 錯 → _applyWrongEffects: 受傷動畫、畫面搖、
                                         instantHint（= 直接畀答案）、入 review queue、
                                         boss 反擊、Adaptive.onWrong
                                     └─ 下一題（easy delay 700ms，_scheduleNextQuestion）
                                          └─ 10 題完 → 結算：金 ≥90% / 銀 ≥70% / 銅 ≥50% / 加油
```

**關鍵事實**：
- `Game.settings.types` 喺 easy path 係 **8 個 type 嘅集合**，每題隨機抽 → 學生揀咗「只數數」
  一定只會出 `count20`；但揀「全部」就係 8 種隨機混合。
- Boss 面板 / 城堡條 / energy 列喺 easy mode **全部隱藏**（`index.html:9208-9223`）→ easy = 純練習，冇 boss。
- `Adaptive` 喺 easy path **每題都會被呼叫**，但佢嘅 ladder（`TYPE_ORDER = ['add10','sub10','add20','sub20','add2d','sub2d']`）
  唔包含任何 easy type。

---

## 3. 設計缺口（每個都有證據）

### D0 · P0 · easy path 嘅 scope 會被 Adaptive 污染 ✅ 已修（cycle 108）

**症狀**：學生喺 easy path 連續答啱 5 題之後，`Game.settings.types` 由 `['count20']` 變成 `['add10']`。
由第 6 題開始，學生做緊「數數」但收到 classic 加法題（`10 + 10 = ?`）。

**根因**：`Adaptive.onCorrect` 用
`TYPE_ORDER.indexOf(type) < TYPE_ORDER.length - 1` 做升級門檻。
對「唔喺 TYPE_ORDER 嘅 type」，`indexOf` 回 **-1**，而 `-1 < 5` 為真 → 誤判成可升級 →
`next = TYPE_ORDER[0] = 'add10'`。

**實機驗證**（headless Chrome，live site，1440×900）：

```
before: ["count20"]   indexOf('count20') = -1
after 5 次 onCorrect: ["add10"]     ← scope 被換走
classic 對照組: ["add10"] → 5 次 onCorrect → ["sub10"]  （classic 正常）
easy 連錯 6 次: ["count20"] → ["count20"]   （easy 完全冇降級能力）
```

**修復**：`onCorrect` / `onWrong` 開頭加明確嘅 ladder membership guard
（`idx < 0` / `idx <= 0` → 直接 return，唔做任何 type 置換）。
classic 原有嘅升級 / 降級 / 邊界行為完全保留。

**Lock-in**：
- `tests/generator-audit.js` T108 —— **真實執行** Adaptive 模組，斷言 8 個 easy scope
  連答啱 5 題 / 連答錯 6 題之後 scope 唔會被換走；同時斷言 classic 升級降級仍然 work。
  （已驗證：還原舊 code → 21 fail；修復後 → 0 fail）
- `tests/regression.js` T108 —— 結構鎖，防止 guard 被日後 refactor 拆走。

---

### D1 · 提示直接畀答案，違反 errorless learning

**現況**：`_easyHintText()` 每一個分支都係「答案係 X」。
`showInstantHint()`（classic path）更加係 `💡 ${text} = ${q.answer}`。

```js
// index.html:9625 _easyHintText
if (q.type === 'count1to3' || ...) return `答案係 ${q.answer} 個`;
if (q.type === 'groupAdd')        return `答案係 ${q.answer}`;
...
```

**問題**：中度 ID 學生嘅學習多數靠 **errorless learning**（避免見到錯答案，
改為逐步收窄選項 / 提供線索令佢自己答啱）。而家只要撳「提示」就即刻拎到答案，
學生完全唔需要思考 —— 練習變成抄答案。

**可行改法**：分層 scaffold，由弱到強，學生撳得越多次提示先揭得越深：
1. **重述**（無答案）：「再睇一次：🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎」
2. **聚焦**（無答案）：「由左至右數：一、二、三……」
3. **部分答案**：「數咗 7 個，仲有 ___ 個」
4. **完整答案**（最後一招）：「答案係 10 個」

> 需 Ken / 老師確認：學校係咪容許「撳到最後直接畀答案」？定係應該完全唔畀答案？

---

### D2 · 錯題重練係出「新題」，唔係重做「錯嗰條概念」

**現況**：
```js
// index.html:9660 Game.askReReview
Game.state.review.push({ text: q.text, answer: q.answer, type: q.type });   // 錯題入 queue
...
const q = QuestionGen.make(type, Game.settings.mode);   // 重練 = 生成全新一條同 type 題
```

**問題**：重練目標係**同一個概念**（例如「10 個蘋果點數」），唔係**同一條題目**。
抽新題 = 抽走咗原本嗰個 exact stimulus → spaced repetition 機制實際上冇生效。

**可行改法**：review item 保留完整嘅 question payload（`parts` / `extra` / `options`），
重練時**重播同一條**（換順序可，內容唔可），並且記錄 `retryCount` + `retryCorrect`。
只有連續兩次重播都啱，先從 queue 移除。

---

### D3 · 局長固定 10 題，冇短局

**現況**：`Game.state.easyGoalTotal = isEasy ? 10 : 0;`（`index.html:9245`），寫死。

**問題**：中度學生嘅持續注意力長度差異極大。10 題可能：
- 太短 → 唔夠覆蓋同一個概念（尤其重點練習某個 type）
- 太長 → 中段失去专注、準確率斷崖式下跌

**可行改法**：
- 局長選項 5 / 10 / 20 題（教師喺控制台設，唔喺學生選單）
- 或者「做到達標為止」模式：連續 3 題啱就自動完（達 mastery 即收）

---

### D4 · easy path 完全冇適應能力（生成器難度全部硬編碼）

**現況**：所有 easy 生成器都係固定難度：

| Type | 難度參數 | 位置 |
|---|---|---|
| `count20` | `randInt(1, 10)` — 硬編碼 1–10 | `index.html:5644` |
| `compareLength` | `shortN = randInt(2,4)`；`longN = shortN * 2`（上限 8）— 固定 ≥2:1 | `index.html:5651-5654` |
| `compareHeight` | 同上 | — |
| `orderAsc20` / `orderDesc20` | `_nextInSeq('asc'/'desc')` — 固定步長/範圍 | `index.html:5825/5835` |

而 `Adaptive` 又只識 `TYPE_ORDER` 入面嘅 6 個 classic type。

**後果**：一個連錯 5 次嘅學生同一個連對 5 次嘅學生，收到的題目**完全一樣**。

**可行改法（scope 內適應，而唔係換 scope）**：
- `count20`：L1 = 1–3 個 · L2 = 1–5 · L3 = 1–7 · L4 = 1–10
- `compareLength`：L1 = 1:2（明顯）· L2 = 1:3+ · L3 = 1:1.5（接近，最有挑戰性）
- `orderAsc20`：L1 = 步長 2 · L2 = 步長 1 但唔連續 · L3 = 步長 1 + 干擾數字
- 適應粒度：**同一個 scope 內**調整難度，**永遠唔換 scope**（呢個正正就係 D0 修好嘅設計原則）

---

### D5 · 錯咗可以唔理

**現況**：答錯 → `Game.state.review.push(...)` + `UI.renderReview()`，
只係畫面旁邊嘅一個 review 列表，**冇任何機制要求學生重做**。
局完就完，錯題留落 Profile 但唔會喺下一局出現。

**問題**：對 SEN 學生，被動睇一次 review list 幾乎等於冇做過。

**可行改法**：
- 局完前加一道「錯題重練」關卡（用 D2 嘅同一條重播）
- 或者將錯題帶入下一局：下一局開局先出 2 條上次錯咗嘅題（暖身）

---

### D6 · 5 題之内最多 8 種 type 隨機混合（可預測性低）

**現況**：`nextQuestion` 隨機抽 `types[randInt(0, types.length-1)]`。
揀「全部」→ 8 種 type 輪流隨機。

**問題**：中度學生每次都要重新閱讀 + 重新分類題型（數數？長短？順序？），
工作記憶負擔高。已知自己揀咗「只數數」嘅學生就唔使。

**可行改法**：
- 保留「全部」選項，但將佢變成**分階段**：先 5 題同一 type，再換下一個 type
  （一局之內 type 唔隨機跳）
- 或者喺 easy path 預設關閉「全部」，改為「每局揀 1–2 個 type」

---

## 4. 設計原則（SEN 教學設計）

揀方案時用呢 4 條做判斷標準：

1. **可預測 > 驚喜**：同一局之內，畫面結構、掣位置、題型唔好無故轉變。
2. **唔好畀錯答案**：寧願畀線索、縮窄選項，都好過直接攞答案（errorless learning）。
3. **難度要跟住學生行**：適應方向一定係**同一個概念內**調整，唔係換概念。
4. **每個錯都要有回報**：錯過嘅題一定要喺之後再出現，而且要係同一條。

---

## 5. 三條優化路線（方案選項）

> 📌 **已出方案**：`docs/GAMEPLAY_ASSET_PROPOSAL.md`（cycle 109 proposal）——
> 玩法（Stage / 進度格 / 接力協作 / 提示階梯 / 錯題重播 / 概念卡）
> + 資產（16 個新 symbol + 像素品質規格 + 預算表）。
> 呢份揀咗 **B → C → A** 嘅路線同 §5 一致。

| 路線 | 做咩 | 影響 | 工時 | 對象 |
|---|---|---|---|---|
| **A. 適應化** | D0(已修) + D4 scope 內適應 + D1 分層提示 | 教學價值最高、影響每個學生 | 大（生成器 + 狀態 + UI） | 中度學生進步 |
| **B. 鞏固化** | D2 同一條重播 + D5 錯題必重練 + D3 短局 | 針對「錯咗冇回報」嘅漏洞 | 中 | 補救基礎概念 |
| **C. 結構化** | D6 局內 type 唔隨機 + 一致嘅 scope 選單 + 教師可控局長 | 降低認知負荷 | 中小 | 專注力 / 工作記憶 |

> **建議次序**：B → C → A。
> 理由：B 嘅三項係「機制漏洞」（錯咗冇回報、重練抽走咗 stimulus），
> 成本低、對象明確；C 係低風險嘅負重減輕；A 改動最深、但要喺 B/C 穩定咗先值得做，
> 否則適應邏輯會喺每次內容重整時都要重寫。

---

## 6. 優先計劃

| # | 項目 | 對應缺口 | 狀態 |
|---|---|---|---|
| 1 | Adaptive ladder guard | D0 | ✅ **cycle 108 已修 + locked** |
| 2 | 錯題同一條重播（保留 payload） | D2 | 待做 |
| 3 | 局完錯題重練關卡 | D5 | 待做 |
| 4 | 局長可配（5/10/20）+ 教師控制台 | D3 | 待做 |
| 5 | 局內 type 唔隨機跳 | D6 | 待做 |
| 6 | 分層提示（4 級 scaffold） | D1 | 待做（需先定「最後一招係咪畀答案」）|
| 7 | scope 內難度分級 + 自適應 | D4 | 待做（最大項）|

---

## 7. 驗證方法（每項都要真機 + 行為測試）

- **行為測試**：`tests/generator-audit.js` 已經有 T108 嘅範本 —— 抽出真實模組、用 mock 環境
  **實際執行**，斷言實際數值 / 實際 state 變化。唔好用 regex 代替。
  （教訓：D0 呢個 bug 結構測試 100% 捉唔到，只有真實執行先見到 `["count20"] → ["add10"]`。）
- **還原驗證**：每條新 lock-in 都要試過「還原舊 code → 測試 fail → 修復 → 測試 pass」，
  先算有效 lock-in。
- **實機**：學校 iPad viewport 係 **639×669**（唔係 1440×900）；觸控路徑要用真 touch 事件
  （`page.mouse.click()` 唔會派發 `touchstart`）。
- **課堂**：改動要經老師實課觀察，唔可以只靠截圖。

---

## 8. Changelog

| Cycle | 日期 | 內容 |
|---|---|---|
| 108 | 2026-10-25 | 本文件 + 修 D0（Adaptive ladder guard）+ T108 lock-in（regression 6 條 + generator-audit 34 條） |
| 106 | 2026-10-24 | 視覺層 rubric + P0 視覺修復（見 `VISUAL_QUALITY_RUBRIC.md`） |
