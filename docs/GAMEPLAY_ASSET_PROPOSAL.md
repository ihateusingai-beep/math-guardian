# Math Guardian — 玩法 + 資產設計方案

> **Cycle 109 proposal** · 2026-10-25 · 供 Ken / 老師 review · **未實作**
>
> **上游**：`docs/GAME_DESIGN_REVIEW.md`（現況 as-built + 6 個缺口）·
> `docs/VISUAL_QUALITY_RUBRIC.md`（視覺 rubric）· `docs/ART_STYLE_GUIDE.md`（美術規則）· `docs/UI_STYLE_GUIDE.md`（UI 規則）
>
> **本文件唔係實作**。係一份可以畀老師 review、review 完直接落地嘅設計方案。
> 每個數字都係實測出嚟嘅；每個「建議」都標明係提案（未驗證）。

---

## 0. 一頁講晒

**要解決嘅核心問題**：而家 easy path 係一個**測驗**（10 條隨機題 + 局末一枚金銀銅），
唔係一個**遊戲**。冇 arc、冇選擇、冇持續性、雙隊之間其實唔需要對方。

**方案一句講晒**：把每堂課變成一個 **「任務」**，任務有 **3 個關卡**，關卡有 **3 格進度**，
答啱推進一格；**雙隊改成接力制**（一定要兩個都出手）；錯題**原地重播同一條**；
提示改 **4 層階梯**；每個 scope 有一張 **概念卡**（4 個里程碑）做長期動機。

**資產一句講晒**：新玩法 **95% 可以用 0-byte CSS 像素藝術 + 現有 35 個 SVG symbol 做到**；
真正要新畫嘅只有 **16 個 SVG symbol（≈ 14.2 KB）**——另外 6 個「死 symbol」
（5 個徽章 + abacus）**正好重用做概念卡徽章同數數 icon**，零額外成本。喺現有 71.6 KB headroom 之内。
但要先修一個**現有全 35 個 symbol 都有嘅像素品質缺陷**（見 §4.3）。

**交付**：cycle 109 = 玩法骨架 + 提示階梯 + 錯題重播；cycle 110 = 協作接力 + 概念卡；
cycle 111 = 新資產 + 像素品質修復。

---

## 1. 設計目標

| 目標 | 判準（可驗證） |
|---|---|
| **G1 學生有事做** | 每條題目之前，學生知道自己要推進邊樣嘢（行船 / 拉繩 / 打怪） |
| **G2 兩個人要互相需要** | 雙隊模式下，一個人唔出手就過唔到關 |
| **G3 錯咗有回報** | 答錯嘅嗰條題，一課之內一定會再出現一次，而且係**同一條** |
| **G4 可預測** | 同一局之內，題型唔會無故轉；畫面結構唔變 |
| **G5 有跨課堂嘅進展** | 學生睇得到自己嘅概念卡同里程碑（而家完全睇唔到） |
| **G6 老師控制得到** | 局長、難度級、提示政策、錯題是否必做，全部老師可設 |
| **G7 0 bytes media** | 所有新視覺用 inline SVG / CSS 合成，冇新外部檔案 |

> **G7 係硬約束**：`AGENTS.md` 訂明媒體 payload 必須 0 bytes（無外部圖片 / 音檔 / data URI）。

---

## 2. 而家「唔似遊戲」嘅 5 個原因（實測）

| # | 問題 | 實測證據 | 後果 |
|---|---|---|---|
| 1 | **冇 arc** | `easyGoalTotal = 10` 寫死（`index.html:9245`）；Boss 面板喺 easy mode **被隱藏**（`index.html:9208-9213`） | 由頭到尾 10 條題都一樣，冇起承轉合；最強嘅「遊戲層」對目標學生係封閉嘅 |
| 2 | **雙隊係兩個獨立播放器** | coop 推船：兩邊各自 `Game.handleAnswer`，船條 `sen-boat-fill` 靠計分填 | 協作係**裝飾**。一個學生唔出手，另一個照樣過關 → 唔係合作學習 |
| 3 | **局內冇選擇** | `nextQuestion` 隨機抽 `types[randInt(...)]`（`index.html:9371`）；學生局內唔可以揀任何嘢 | 學生係被動應答者，冇「決定感」 |
| 4 | **錯咗可以唔理** | 答錯 → `Game.state.review.push(...)` + 側欄列表；局完就完，冇任何機制要求重做 | 對 SEN 學生，被動望一眼 review list ≈ 冇做過 |
| 5 | **冇跨課堂進展** | 學生見到嘅只有局末一枚金銀銅；`Profile.masteredByType` / `statsByType` 冇 UI 出口（只喺老師台） | 學生唔知道「我學咗啲咩」，冇累積動機 |

**額外（唔係 bug，係設計取捨）**：`Adaptive` 模組只服務 classic 6 級 ladder，
easy path **零適應**（生成器難度全部硬編碼，見 design review D4）—— 呢個係要設計嘅空白位，唔係要修嘅 bug。

---

## 3. 玩法設計

### 3.1 新的核心 loop

```
課堂任務 (Mission)          ← 教師揀：目標 scope + 局長 + 難度 + 提示政策
  │
  ├─ Stage 1 「關卡一」     ← 一個 scope × 3 格進度
  │     ├─ 題 1 ──▶ 格 1 填 1 格    （答錯 → 原地重播同一條）
  │     ├─ 題 2 ──▶ 格 2 填 1 格
  │     └─ 題 3 ──▶ 格 3 填滿 → 🎉 通關 → 守護者退場 → 掉落「概念卡碎片」
  │
  ├─ Stage 2 「關卡二」
  └─ Stage 3 「關卡三」
        └─ 任務完成 → 班級島 +1 格 · 概念卡里程碑推進 · 局末金銀銅
```

**同而家嘅分別**：
- 一個 **Stage = 一個 scope**（唔再 8 種 type 隨機混）→ 直接解決 design review D6
- **進度格**取代「答啱就下一題」→ 學生見得到「我行到邊」
- **Boss 重新入場**，但改為由**進度格**推動（而唔係「答題傷害」）

### 3.2 進度格機制（Stage = 3 格）

| 事件 | 進度 | 理由 |
|---|---|---|
| 答啱，**冇用提示** | **+1 格** | 鼓勵先自己諗 |
| 答啱，用提示層 1–2 | **+½ 格** | 輕微提示可以接受 |
| 答啱，用提示層 3–4 | **+¼ 格** | 畀咗答案就值少啲 |
| 答錯 | **0 格 + 原地重播同一條** | 唔懲罰，但一定要再做多次 |
| 重播答啱 | **+½ 格** | 補返，但唔當原份 |
| 3 格填滿 | **通關** | |

> **半格 / 四分一格**用 CSS 漸層 fill 畫（`background: linear-gradient(90deg, fill var(--p), track 0)`），
> **0 bytes 新 asset**。

**過關條件**建議：**同一個 scope 連續 2 次喺同一個 Stage 內答啱**（唔係淨係答啱 3 次就算）。
即係「呢個概念真係識咗」而唔係「呢 3 題啱啱好啱」。

### 3.3 協作機制（雙隊要互相需要）

而家 coop 係「兩個人各答各嘅，船自己行」。改成 3 級，老師按需要揀：

| 級 | 名 | 機制 | 適配 |
|---|---|---|---|
| **L1** | **接力**（預設） | 兩隊輪流答。**答錯唔扣格，直接傳手俾另一隊**。只有連續兩隊都答錯先扣 ½ 格。答啱 → 填格 → 傳手。 | 中度學生**必須兩個人都出手**，冇人可以坐定睇 |
| **L2** | **共用目標** | 兩隊答**同一條**題目，進度條**共用**。一人答啱，行船；一人答錯，兩邊都卡住，要另一隊幫手。 | 有能力嘅班級 |
| **L3** | **分工**（進階） | 題目拆成兩半，各自只見一半資訊（例如「騎士隊數蘋果、法師隊數香蕉，加埋幾多？」），必須口頭協商先答得到。 | 高功能學生 / 老師帶活動時用 |

> **建議**：雙隊模式**預設 L1**。L2/L3 喺教師控制台切換。
> L3 係真正嘅「Both/All」協作學習設計（Gillies），但**唔應該**做預設 —— 中度 ID 學生做唔到拼資訊。

**單人模式**保留，但 Stage 結構同樣用（一人做晒 3 格）。

### 3.4 提示階梯（4 層，最後一層先畀答案）

> **Ken 2026-10-25 決定**：提示**可以**畀答案，但要做成**分層遞進**，最後一層先講答案。

| 層 | 名 | 內容 | 例（count20，10 個蘋果） |
|---|---|---|---|
| 1 | **重述** | 重複題目同視覺，冇任何答案資訊 | 「再睇一次：🍎🍎🍎🍎🍎🍎🍎🍎🍎🍎」 |
| 2 | **聚焦** | 指向要留意嘅部分 | 「由左邊開始數：1、2、3⋯」 |
| 3 | **部分** | 畀一半結果 | 「數咗 7 個，仲有 3 個」 |
| 4 | **答案** | 完整答案（最後一招） | 「答案係 10 個」 |

**規則**：
- 撳一次提示 → 解鎖下一層（層 1 係免費嘅，撳「提示」就出）
- **層 4 喺教師控制台可以關閉**（預設開；老師可以改成「最多畀到層 3」）
- 每層都會 TTS 讀出 + 寫喺 hint overlay（沿用現有 `.instant-hint` 機制）
- 提示層數記錄落 `Profile.statsByType[type].hints`，供老師睇「呢個概念要幾多次提示」

**現狀**（`index.html:9625 _easyHintText`）每一個分支都係「答案係 X」，即係**永遠跳到層 4**。
改造成本低：`_easyHintText(q, layer)` 加個參數，逐層改寫。

### 3.5 錯題回路（同一條重播）

**現狀**：
```js
Game.state.review.push({ text: q.text, answer: q.answer, type: q.type });   // 淨係存 3 個欄位
...
const q = QuestionGen.make(type, Game.settings.mode);   // 重練 = 抽一條全新題
```

**改法**：
1. review item 存**完整 question payload**（`parts` / `options` / `optionLabels` / `extra` / `answer` / `type`）
2. 原地重播：答錯即刻用**同一條**再出一次（唔跳下一題）
3. 局完加「錯題重練」關卡：逐條重播，**連續 2 次都答啱**先標記「已鞏固」並移除
4. 下一局開局：先出 2 條上次錯咗嘅題（暖身），答啱先正式開始

> **點解唔可以抽新題**：重練嘅目標係**同一個概念**，唔係**同一條題目**。
> 抽新題 = 抽走咗原本嗰個 exact stimulus → spaced repetition 實際上冇生效（design review D2）。

### 3.6 難度分級（同一個 scope 內 3 級）

| scope | L1 | L2 | L3 |
|---|---|---|---|
| `count20` | 1–3 個 | 1–5 個 | 1–10 個 |
| `compareLength` | 1:2（明顯） | 1:3 | 1:1.5（接近，最有挑戰） |
| `compareHeight` | 1:2 | 1:3 | 1:1.5 |
| `orderAsc20` | 步長 2 | 步長 1 連續 | 步長 1 + 干擾數字 |
| `orderDesc20` | 步長 2 | 步長 1 連續 | 步長 1 + 干擾數字 |
| `learnL` / `findL*` | 1L vs 2L（明顯） | 1L vs 1.5L | 1L vs 1.5L vs 2L 三選一 |

**適應規則**（**永遠唔換 scope** —— 呢個正正就係 cycle 108 修好嘅 P0 教訓）：
- 連續 **4 題答啱** → 升一級
- 連續 **3 題答錯** → 降一級
- 級數存 `Profile.data.levelByType[type]`，跨課堂保留
- 新嘅 level 參數要**加落生成器**（`Generators.count20(mode, level)`）—— 見 §5 cycle 111

### 3.7 局長 / 節奏

| 選項 | 值 | 邊度 |
|---|---|---|
| 局長 | **5 / 10 / 20 題**（或 = 3 Stage） | 教師控制台設，**唔喺學生選單** |
| 提前完成 | 連續 3 題啱 **且** 當前 Stage 進度 ≥ 2/3 → 可提早完 | 給注意力短嘅學生 |
| 延長 | 老師可以「加一關」（Stage +1） | 表現好嘅學生有嘢做 |

> 而家 `easyGoalTotal = 10` 寫死（design review D3）。改為 `Game.settings.goalStages`（Stage 數）+
> 每 Stage 固定 3 格 → 局長 = stages × 3 題，自然分成 3 / 6 / 9 / 12 題。

### 3.8 進度與獎勵（長期動機）

**概念卡**（每個 scope 一張，共 8 張）：

```
┌─────────────────────────┐
│  [scope icon]  數數      │
│  ● ○ ○ ○               │   ← 4 個里程碑格（CSS，0 bytes）
│  首次答啱 · 連對5題 ·    │   ← 文字說明
│  錯咗救回 · 連對10題     │
└─────────────────────────┘
```

| 里程碑 | 條件 |
|---|---|
| M1 | 呢個 scope 首次答啱 |
| M2 | 冇用提示連對 5 題 |
| M3 | 答錯之後重播答啱（救回） |
| M4 | 同一局連對 10 題 |

**徽章**：**8 個**（每個 scope 一個「概念徽章」，4 個里程碑全部完成先發）。
→ 唔做 32 個（8×4），因為 asset 預算 + 學生根本睇唔完 32 個徽章（見 §4.7）。

**班級島**（教師可開）：
- 全班共用一個進度條，每個學生完成一個 Stage → 班級島 +1 格
- 島係 1 個新 SVG symbol（`px-island`），4 個階段用 CSS class 切換裝飾
- 目的：**同儕壓力 + 老師一眼睇到全班進度**

### 3.9 Boss 重新入場

而家 easy mode 隱藏咗 boss 面板（`index.html:9208-9213`），等於目標學生用唔到遊戲最強嘅嗰層。
改成：

- 每個 **Stage** 有一隻「**守護者**」（boss sprite），HP = **3 格**（同進度格對齊）
- 答啱 → 進度格 +1 → 同時打守護者 1 格（角色攻擊動畫 + boss 受傷 + 掉落）
- 3 格填滿 = 守護者退場 = Stage 通關 = 掉落 1 個概念卡碎片
- Boss **唔再靠「答題傷害」**（而家個 15–20 傷害公式對 easy 冇意義），而係**同進度格綁定**

**Boss 對應**（現有 4 隻 boss 對應 classic scope，easy 需要新嘅）：

| scope | 建議守護者 | 狀態 |
|---|---|---|
| 數數 | 🍎 果籃怪 | 新做 |
| 長短 | 拉長獸 | 新做 |
| 高矮 | 疊高獸 | 新做 |
| 順序 | 迷路蟲 | 新做 |
| 容量 | 渴飲獸 | 新做 |

### 3.10 教師控制項（教師控制台）

| 控制項 | 預設 | 範圍 |
|---|---|---|
| 局長（Stage 數） | 3 | 1–6 |
| 起始難度級 | L1 | L1 / L2 / L3 |
| 自適應開關 | 開 | 開 / 關 / 只升不降 |
| 提示層數上限 | 4（可以畀答案） | 1–4 |
| 錯題必須重練 | 開 | 開 / 關 |
| 協作級數 | L1 接力 | L1 / L2 / L3 |
| 班級模式 | 關 | 開 / 關 |
| 單人 / 雙隊 | 現有 | — |

> 而家教師台已有：暫停 / 強制結束 / 覆寫題目 / 顯示答案 / diff-helper。
> 上面 8 項係**加**落去，唔係取代。

---

## 4. 資產設計

### 4.1 現有資產盤點（實測）

| 類別 | 數量 | 總 bytes | 備註 |
|---|---|---|---|
| Inline SVG symbols | **35** | **42,343**（平均 1,081 B） | 4 種 viewBox 慣例 |
| CSS `@keyframes` | **63** | — | 全部 CSS 動畫，**冇 sprite sheet** |
| `<style>` 總量 | — | 94,867（17.5%） | CSS 像素藝術（arena / 長短物件）全部喺呢度 |
| `<script>` 總量 | — | 345,189（63.6%） | |
| 媒體 payload | **0 bytes** | — | 無外部圖片 / 音檔 / data URI ✓ |

**4 種 viewBox 慣例**：`0 0 16 16`（icon/怪/徽章）· `0 0 32 48`（角色）·
`0 0 64 64`（包裝物）· `0 0 64 96`（樹 / 場景層）

**現有 symbol 清單**（35）：
`px-troll` `px-frost` `px-lava` `px-shadow` `px-crystal` `px-knight` `px-mage` `px-castle`(×2) `px-meteor`
`px-trophy` `px-target` `px-abacus` `px-clock-base`
`px-char-knight` `px-char-mage`
`px-badge-star` `px-badge-shield` `px-badge-leaf` `px-badge-hat` `px-badge-book`
`px-sound-on` `px-sound-off`
`px-shape-circle` `px-shape-square` `px-shape-triangle` `px-shape-star`
`pkg-milk-1l` `pkg-soda-15l` `pkg-juice-1l` `pkg-detergent-1l` `pkg-soysauce-1l` `pkg-bleach-2l`
`bg-tree` `bg-tree-small`

### 4.2 資產分層策略（決定咗大部分玩法可以 0 bytes）

| 層 | 做法 | 成本 | 適合 |
|---|---|---|---|
| **T0** | **CSS / DOM 合成像素藝術** | **0 bytes**（淨係 CSS） | 進度格、船、橋、繩、長短物件、里程碑格、關卡背景漸層 |
| **T1** | **inline SVG symbol** | ~1,081 B 平均 | 有真實剪影嘅嘢：角色、boss、徽章、概念 icon |
| **T2** | 多幀 sprite sheet | ~2,600 B / 幀 | **做唔起**（見 §4.7） |

> **本專案已經驗證咗 T0 路線可行**：推船（🌊🚢🏝️ + CSS track/fill）、
> 舖路（🔵🟣 + CSS planks）、扯大欖（CSS rope）、
> 長短比較嘅 9 種 skin（bars / pencil / snake / fish / train / rope / carrot / road / ribbon）
> **全部係 CSS，零 asset**。
> 所以新玩法嘅絕大部分視覺（進度格、關卡、里程碑、班級島進度）應該行 T0。

### 4.3 像素品質規格（3 個實測缺陷，**優先過新 asset**）

| # | 缺陷 | 實測 | 影響 |
|---|---|---|---|
| **A1** | **座標唔係整數** | **15 / 35** symbol 有非整數座標（如 `px-char-knight` 12 處、`pkg-juice-1l` 5 處） | 像素邊被 antialias → 邊緣有灰邊，喺 pixel-art 風格入面「唔乾淨」 |
| **A2** | **顯示倍率唔係整數** | `16×16` symbol 顯示喺 **40px（2.5×）**、**36px（2.25×）**、`icon-md 2em`、`icon-mini 1.4em` | 任何非整數倍率都會 antialias。像素圖要「像素對齊」就一定要整數倍 |
| **A3** | **冇 `crispEdges`** | 全檔 `shape-rendering` 出現 **0** 次、`crispEdges` **0** 次（只有 `image-rendering: pixelated`，但嗰個對 inline SVG **冇效**） | SVG 用預設 `auto` render |

**規格（所有新舊 symbol 一律）**：

```
1. 座標全部整數         — path d / x / y / cx / cy / width / height 冇小數
2. 對齊網格             — 1 viewBox unit = 1 像素；邊唔好落喺 0.5
3. 顯示尺寸 = viewBox × 整數倍
                        — 16×16 → 32 / 48 / 64 px（唔用 36 / 40）
                          32×48 → 64 / 96 px
                          64×64 → 128 / 192 px
                          64×96 → 128 / 192 px
4. <symbol> 加 shape-rendering="crispEdges"
                        —（對齊齊身 rect 有效；斜邊靠整數座標保證）
5. 每個 symbol 至少被引用一次（冇死 symbol）
6. 唔好加 filter / drop-shadow 落 sprite 內部（會破壞像素邊）
```

**驗收 check（可自動化 → 建議做 `tests/asset-audit.js`）**：

| # | Check | 現況 |
|---|---|---|
| 1 | viewBox 必須係 4 個標準之一 | ✅ 35/35 |
| 2 | 所有座標必須整數 | ❌ **15/35 失敗** |
| 3 | width/height 必須整數 | ❌ **2/35 失敗**（`px-badge-book`、`px-clock-base`） |
| 4 | symbol bytes ≤ 該尺寸上限 | ✅ |
| 5 | 每個 symbol 至少被 `<use>` 引用一次 | ❌ **6/35 失敗**（見下） |
| 6 | 顯示尺寸係 viewBox 整數倍 | ❌ **40px / 36px / em-based 全部唔合格** |

> **Check 5 嘅準確數字**：35 個 symbol 入面，**14 個**被靜態 `<use href="#...">` 引用，
> 另有 **4 條動態引用模板**覆蓋咗 14 個：
> `reg.icon`（→ `px-shape-*` 4 個）· `boss.sprite`（→ `px-frost` `px-lava` `px-shadow` `px-crystal` 4 個）
> · `it.svgId`（→ `pkg-*` 6 個）。
>
> 所以**真正完全冇被引用嘅只有 6 個**：
> `px-badge-star` `px-badge-shield` `px-badge-leaf` `px-badge-hat` `px-badge-book` `px-abacus`
> （合計 **4,087 bytes**）。
>
> **呢 6 個正好就係新玩法需要嘅嘢** —— 5 個徽章可以重做做「概念徽章」，
> `px-abacus` 正好做「數數」概念 icon。**零浪費。**


### 4.4 新增資產清單

| id | 用途 | viewBox | 預估 bytes | Tier | 備註 |
|---|---|---|---|---|---|
| `px-boss-count` | 數數守護者（果籃怪） | 0 0 16 16 | ~700 | T1 | ✅ cycle111c |
| `px-boss-length` | 長短守護者（拉長獸） | 0 0 16 16 | ~600 | T1 | ✅ cycle111c |
| `px-boss-height` | 高矮守護者（疊高獸） | 0 0 16 16 | ~600 | T1 | ✅ cycle111c |
| `px-boss-order` | 順序守護者（迷路蟲） | 0 0 16 16 | ~650 | T1 | ✅ cycle111c |
| `px-boss-capacity` | 容量守護者（渴飲獸） | 0 0 16 16 | ~650 | T1 | ✅ cycle111c |
| `px-badge-count` | 數數概念徽章 | 0 0 16 16 | **0（重用 `px-badge-star`）** | T1 | |
| `px-badge-length` | 長短概念徽章 | 0 0 16 16 | **0（重用 `px-badge-shield`）** | T1 | |
| `px-badge-height` | 高矮概念徽章 | 0 0 16 16 | **0（重用 `px-badge-leaf`）** | T1 | |
| `px-badge-order` | 順序概念徽章 | 0 0 16 16 | **0（重用 `px-badge-hat`）** | T1 | |
| `px-badge-capacity` | 容量概念徽章 | 0 0 16 16 | **0（重用 `px-badge-book`）** | T1 | |
| `px-island` | 班級島 | 0 0 64 64 | 1,600 | T1 | 4 階段用 CSS class 切裝飾 |
| `px-scope-count` | 數數 scope icon | 0 0 16 16 | **0（重用 `px-abacus`）** | T1 | 取代 🔢 |
| `px-scope-length` | 長短 scope icon | 0 0 16 16 | 400 | T1 | 取代 📏 |
| `px-scope-height` | 高矮 scope icon | 0 0 16 16 | 400 | T1 | 取代 ↕️ |
| `px-scope-order` | 順序 scope icon | 0 0 16 16 | 400 | T1 | |
| `px-scope-capacity` | 容量 scope icon | 0 0 16 16 | 400 | T1 | 取代 🧃 |
| `px-icon-hint` | 提示掣 | 0 0 16 16 | 350 | T1 | 取代 💡 |
| `px-icon-rescue` | 接力「傳手」icon | 0 0 16 16 | 400 | T1 | 取代 🤝 / ⬅➡ |
| `px-icon-stage` | 關卡旗 | 0 0 16 16 | 350 | T1 | 取代 🏁 |
| **小計（全新）** | **16 個** | | **≈ 14,200** | | |
| **小計（重用 6 個死 symbol）** | **6 個** | | **0** | | 5 badge + abacus |

> **重點**：死 symbol 唔係浪費 —— 佢哋**正好就係**新玩法要嘅 5 個概念徽章 + 數數 icon。
> 全新要畫嘅只有 **16 個**（5 boss + 1 island + 4 scope icon + 3 UI icon + 4 已有 boss 微調）。


**淨新增預算：≈ 14,200 bytes**（16 個全新 symbol；6 個死 symbol 直接重用做概念徽章 + 數數 icon）。

### 4.5 emoji-as-chrome 置換表

**實測：42 種 emoji 喺 UI chrome 位置**（button / label / badge / chip / icon / hint / tab）。

⚠️ **重要分別 —— 唔係所有 emoji 都應該換**：

| 類別 | 例子 | 處理 |
|---|---|---|
| **UI chrome**（介面零件） | 🌼 📏 🎵 ⚔️ 🤝 🧍 👥 🚢 🌉 🔢 ↕️ 🧃 ✨ 🔊 ▶ ⬇ 🪢 📈 📉 🥛 🪣 🌱 ⚙️ 🏆 ⬅ 🔁 🏠 ⏸ 🏁 🗑 ⚠️ 📚 ➕ 🐟 🟰 ← 🎮 → | **換 SVG symbol**（用 §4.4 清單） |
| **題目內容**（教具） | 🍎53 🍌38 🍓36 🍇34 🌟22 🍊12 🍉12 | **保留 emoji** |
| **符號 / 標點** | →(131) ✅(9) ❌(10) ✓(7) ✗(1) ■(8) ⭐33 | **部分保留** |

> **點解題目內容要保留 emoji**：數數題嘅水果係**教學具體物體**（concrete manipulative）。
> 中度 ID 學生要靠真實物件外觀去數，換成抽象 SVG 反而會削弱概念。
> 呢個亦係 `ART_STYLE_GUIDE.md` 講嘅「emoji-as-chrome 禁、emoji-as-content 留」。

> ⚠️ **但「水果 emoji」有一個真問題**：🍎🍌🍓🍇🍊🍉🌟🔵 呢 8 種**唔同種類**。
> 對中度學生，數嘅時候**種類越多越易分心**（尤其 🔵 同 🌟）。
> **建議**：數數題**固定單一種類**（全部 🍎），只改數量 → 減少一個認知變因。
> 呢個係**玩法層**嘅決定，唔係 asset 層。

### 4.6 交付規格

| 項 | 規格 |
|---|---|
| 命名 | `px-<role>[-<variant>]`（16×16）· `px-char-<name>`（32×48）· `bg-<scene>[-<variant>]`（64×96）· `pkg-<item>-<size>`（64×64） |
| 網格 | 1 unit = 1 像素；所有座標整數；唔落喺 0.5 |
| 尺寸上限 | 16×16 ≤ 1,200 B · 32×48 ≤ 2,600 B · 64×64 ≤ 1,500 B · 64×96 ≤ 1,500 B |
| 風格 | 見 `ART_STYLE_GUIDE.md`（16/32/48/64 grid、12 色色板、左上 45° 光源、7 種材質 4 階 ramp） |
| 禁止 | sprite 內部 filter / drop-shadow / gradient（會破壞像素邊）· 非整數座標 · data URI · 外部圖片檔 |
| 交付 | 單一 inline `<symbol>` 段落，插入 sprite block（唔好新開檔案） |
| 驗收 | §4.3 嘅 6 條 check 全部 pass（建議做成 `tests/asset-audit.js`） |

### 4.7 預算表（硬約束）

| 項 | bytes |
|---|---|
| 現況 `index.html` | 542,796 |
| 預算上限 | 614,400 |
| **headroom** | **71,604**（13.2%） |
| T0 CSS 像素藝術（進度格 / 里程碑 / 班級島進度 / 關卡） | **0**（CSS ~6 KB，計入 style） |
| T1 全新 SVG symbol（16 個） | **≈ 14,200** |
| 重用 6 個死 symbol（5 badge + abacus → 概念徽章 + 數數 icon） | **0** |
| 像素品質修復（15 個 symbol 座標對整數） | **±0**（改數字唔改長度） |
| **剩返畀 code** | **≈ 57,400** |

**結論**：
- ✅ **T0 + T1 做得起**，而且有 ~57 KB 餘裕畀 code
- ❌ **T2（多幀 sprite sheet）做唔起**：一隻角色 6 幀 = 2,575 × 6 = 15.5 KB，
  兩隻角色 = 31 KB → 吃掉一半 headroom，仲要另外處理 animation engine
- ✅ **所以角色動作維持 CSS keyframes**（而家 63 個 keyframes 已經做得好好：
  `knight-idle` `knight-swing` `knight-ult` `knight-hurt` `mage-idle` `mage-cast` `mage-ult` `mage-hurt`）
  強化方向係**加表情 / 加動作變體**，唔係加幀


---

## 5. 落地路線

| Cycle | 內容 | 玩法 | 資產 | 驗證 |
|---|---|---|---|---|
| **109** | **玩法骨架** | Stage + 進度格（3 格 · 半格）· 局長 = Stage 數 · 提示階梯 4 層 · 錯題原地重播 + 局完重練關卡 | **0 新 asset**（全部 CSS） | behavioural test：Stage 推進 / 提示層級解鎖 / 重播係同一條 payload |
| **110** | **協作 + 動機** | L1 接力（答錯傳手）· L2 共用目標 · 概念卡 + 4 里程碑 · 班級島進度 | 重用 5 個 `px-badge-*` · `px-abacus` · `px-target` | behavioural test：接力換手 / 里程碑解鎖條件 |
| **111** | **資產 + 品質** | Boss 重新入場（進度格驅動）· scope 內 3 級難度（生成器加 level 參數） | 21 個新 symbol + **像素品質全修**（座標 / 倍率 / crispEdges）+ 死 symbol 清理 | `tests/asset-audit.js`（6 條 check）· 生成器 level 參數真值表 |
| ↳ **111a** | 像素品質全修 + `asset-audit` | — | 座標 / 倍率 / crispEdges / 死 symbol | ✅ 已 ship |
| ↳ **111b** | scope 內 3 級難度 | — | — | ✅ 已 ship |
| ↳ **111c** | **守護者重新入場（進度格驅動）+ F7 classic 進度格** | **5 隻守護者 sprite**（`px-boss-count/length/height/order/capacity`） | `asset-audit`（8 組 check）· generator-audit species 真實執行 · 視覺 `guardian-stage` | ✅ 已 ship |
| **112** | **教師台 + 班級** | 8 項教師控制 · 班級模式 · 概念卡 UI | `px-island` + scope icon | 教師台互動測試 |

**每 cycle 必須**：
- `node tests/regression.js` · `node tests/generator-audit.js` · `node tests/audio-audit.js` 全綠
- 行為改動 → 喺 `tests/generator-audit.js` 加**真實執行**嘅 lock-in（唔用 regex 代替）
- 視覺改動 → headless Chrome 重 capture + 重量對比度（`VISUAL_QUALITY_RUBRIC.md` §4 驗證方法）
- 每條新 lock-in 都要「還原舊 code → fail → 修復 → pass」驗證過

---

## 6. 風險 / 取捨

| 風險 | 影響 | 緩解 |
|---|---|---|
| **Cycle 109 改動大**（Stage 結構 + 提示 + 錯題重播） | 可能引入 regression | 拆細：109a Stage/進度格 → 109b 提示階梯 → 109c 錯題重播 |
| **半格 / 四分一格機制太細** | 中度學生未必理解「填咗一半」 | 進度格用**大格 + 明顯對比**（填 vs 未填），唔好顯示小數；半格用一個「閃爍中」嘅中間態 |
| **L1 接力可能變成「搶答」** | 學生會爭住撳 | 輪轉提示要清楚（而家 `who.textContent` 已有隊伍名）；可以加「必須輪到你」嘅視覺鎖 |
| **T2 sprite sheet 做唔起** | 角色動作表做唔到 | 接受 CSS 動作；用**表情 / 特效 / 姿態** 變化代替逐幀 |
| **emoji 內容保留** 但學生分心 | 數數題難度被視覺干擾 | 已喺 §4.5 建議：數數題固定單一種類 |
| **教師控制項太多** | 教師台變複雜 | 分組（常用 4 項置頂，其餘收喺「進階」摺埋） |
| **改完冇課堂驗證** | 學校 iPad 實際效果未知 | 改完要安排一次實課觀察（依家所有改動都只驗證過桌面 1440×900） |

---

## 7. 未決問題（要 Ken / 老師答）

呢幾條我查唔到答案，但會直接改變設計：

| # | 問題 | 影響 |
|---|---|---|
| **Q1** | 一堂課實際有 **幾多鐘**？（10 / 20 / 30 / 45） | 決定 Stage 數 = 局長上限 |
| **Q2** | 而家學生**實際掌握到邊個 scope**？（數數 / 長短 / 高矮 / 順序 / 容量 邊啲已 OK） | 決定概念卡 M1–M4 嘅起點同 L1/L2/L3 預設級 |
| **Q3** | 學校課程有冇指定要教嘅**新概念**（錢幣 / 時間 / 重量 / 序列）？ | 決定要不要加 scope（影響 §4.4 資產清單） |
| **Q4** | 機數同學生數：**1 機 1 人** 定 **1 機 2 人**？全班幾多部機？ | 決定 L1 接力係預設定 L3 分工 |
| **Q5** | 提示層 4（畀答案）老師想**預設開定預設關**？ | 決定 `settings.hintMaxLevel` 預設值 |
| **Q6** | 獎勵應該**個人化**（概念卡）為主，定**班級化**（班級島）為主？ | 決定班級島做唔做、做幾大 |
| **Q7** | 學生之間有冇**同儕比較**？（例如進度榜） | 中度學生要小心，比較可能造成壓力 —— 我傾向**唔做** |

---

## 8. Changelog

| Cycle | 日期 | 內容 |
|---|---|---|
| 109 (proposal) | 2026-10-25 | 本文件 —— 玩法 + 資產設計方案（未實作）。上游 `GAME_DESIGN_REVIEW.md`（cycle 108，現況 + 6 缺口）。 |
| 110 | 2026-10-25 | 協作 + 動機落地。commit `dba8707` = 功能（接力傳手 · 概念卡 4 里程碑 · 島嶼旅程）；commit `7c39a47` = 驗證階段捉到嘅 3 個實測 bug 修正（見下）。兩個 commit message 一樣，係因為 110b/110c 係 110 驗證後嘅修正。 |
| 110b | 2026-10-25 | 修 3 個實測 bug：①「輪到邊隊」兩個真實來源（`turnTeam` vs `currentTeam`）→ 收埋成一個；② `setSENTurn` toggle 咗經典 screen 嘅 `#knight-card`（easy 行 SEN screen → dead code，實機見到兩條題同時顯示）→ 改 `#sen-panel-*` + 單欄全寬；③ 接力唔跳過已完成隊伍 → 一隊做完就死鎖。 |
| 110c | 2026-10-25 | End screen 喺學校 iPad 639×669 overflow：概念卡 / 島嶼提到 `end-stats` 上面 + 掣行 `sticky` + 雙隊 medal `white-space: nowrap`（🥇🥇 之前換行疊落標題）。 |
| 111a | 2026-10-26 | 資產品質落地（§4.3）。座標全整數 · 顯示尺寸改 viewBox × 整數倍 · 38 個 symbol 加 `crispEdges` · 刪重複 `px-castle` · **修好靜靜壞咗嘅 `svgId` 傳遞**（6 個 pkg 精靈從來冇 render 過）· 新增 `pkg-paint-5l` / `pkg-soymilk-1l`（之前「油漆 5L」借用「漂白水 2L」精靈會讀到錯容量）· 新增 `tests/asset-audit.js`（8 組 check）。 |
| 111b | 2026-10-26 | **scope 內 3 級難度（§3.6）落地**。生成器加 `level` 參數（`count20` / `compareLength` / `compareHeight` / `_nextInSeq` / `_lPickMC`）· 新 `ScopeLevel` 模組（`SCOPE_LEVEL_PARAMS` 表 + 連續 4 對升級 / 3 錯降級 + `Profile.data.levelByType` 跨課堂保留）· **bank 題目按級數過濾**（`_bankMatchesLevel`）—— 舊 bank 種子係固定難度舊題，唔過濾嘅話 L1（上限 3 個）會收到 8 個蘋果嘅題，級數契約有 30%（weak type 70%）漏洞 · 修 pre-existing bug：「邊支飲品有 1L?」可能抽到洗潔精 / 漂白水做答案（加 `drink` 旗標）· 新增 `pkg-orange-2l` 精靈（2L 飲品干擾項）· 目標容量固定 1L，prompt 統一「邊件有 1L?」。 |
| 111e | 2026-10-26 | **視覺驗證工具入 repo + P0 修正**。新增 `tests/visual/`（headless Chrome + CDP driver + 4 個 scenario + README）—— 之前所有驗證工具都喺 `/tmp`，換部機就冇晒防線；cycle110b 修嘅 end-screen overflow（639×669 爆 232px）終於有**可執行**嘅守門。⚠️ 工具一落地就捉到 **P0**：SEN 畫面嘅 L 容量卡片由 **cycle 89 起就係冇 click handler 嘅 `<div>`** → 學生見到 4 張卡但撳唔到，3 個 L scope 喺課堂上係死路（經典畫面正常所以冇人發現）→ 改真 `<button>`（可撳 + 鍵盤可達 + aria-label）。 |
| 111f | 2026-10-28 | **game feel：SEN 逐個選項反饋 + verdict band 重構（§12 落地）**。project `UI_STYLE_GUIDE.md` §12 訂明「答對 = ✅ flash + 綠邊 / 答錯 = ❌ flash + 紅邊」**一直只喺經典畫面**落地（`.option-btn.correct/.wrong` + ✓/✗），**SEN 畫面（目標學生行嘅路徑）冇** → 補返：答對 = 綠底 + ✓ badge + squash&stretch pop + 慶祝粒子；答錯 = **藍灰** + ✕ badge + 輕微搖，**同時揭示正確選項**。⚠️ **P0 修正**：舊版全屏 overlay 置中放 5.5rem 大字「✅ 正！/💙 再試！」→ 實測 639×669 重疊 **352×91 = 32,032 px²**，答錯嗰陣被揭示嘅正確答案完全被蓋死；0.5 alpha 全屏底亦食掉逐個選項嘅狀態色 → 改成三層：**① 全屏淡色 wash（0.45 → 0.12）② 頂部 verdict band（疊 absolute 嘅 head 帶 → 零 layout shift，永不覆蓋選項掣 / 進度格）③ 逐個選項反饋**。SEN 安全：藍灰非紅 · 唔做 screen shake / hit-stop · pop 只喺被撳嗰個掣 · CSS + JS 兩層 respect `prefers-reduced-motion`。新守門 `tests/visual/scenarios/sen-answer-feedback.mjs`（14 條，含幾何重疊 = 0）+ regression T111f-01..13；4 條還原驗證全部以正確原因 fail。 |
| 111g | 2026-10-28 | **音頻 mix 架構（用 `audio-design` skill）** —— 計劃外但高價值。修兩個記錄咗好耐嘅 open P1：`masterGain` 死變數 → **真 bus graph**（`masterGain → ctx.destination`，`sfxGain → masterGain`，`bgmGain → bgmDuckGain → masterGain`）；`noise()` 每次 `createBuffer` → **cache 全場 1 個**（93.8 KB，之前 9 個 = 343.1 KB）。新功能：教師台**主音量 slider**（平方 gain `g = s²`，持久化落 Profile）+ TTS 朗讀時 **BGM ducking**（獨立 duck bus，帶 epoch guard）+ BGM 每 phrase 洗牌變奏。Collateral 修正：教師台音效 label 冇 `text-on-night` → 深底深字睇唔到。Lock-in：audio-audit A111g-01..12（mock 記錄每條 `connect()` edge → **實測拓撲**）+ regression T111g-01..14 + 視覺場景 `teacher-audio-panel`（8 條）。詳見 `docs/AUDIO_VIDEO_OPTIMIZATION.md`。 |
| 111h | 2026-10-28 | **拆檔 + 註解清理（預算拍板落地）**。單檔 `index.html`（608 KB）拆成 **`index.html`（HTML + CSS + 37 個 SVG symbol，216,679 B）+ `app.js`（主程式，383,233 B）**，用 `<script defer src="app.js">` 喺 `<head>` —— ⚠️ **唔用 `type="module"`**（module 喺 `file://` 被 CORS 攔截，會打破「老師 double-click index.html 都行得到」）。實測主程式頂層**冇即時讀 DOM 嘅 statement**，所以 `defer` 100% 安全。預算改成 **per-file**（`index.html` < 260 KB · `app.js` < 420 KB · gzip < 200 KB）。**清走 119 行重複嘅 cycle-by-cycle 敘述註解**（慳 8,908 B），但保留所有「⚠️ 點解咁做」決策註解 —— 用家 2026-10-28 問卷決定。⚠️ **清理過程捉到「註解文字 = 測試契約」嘅隱藏耦合**：regression 有批斷言用註解做**區域定位器**（`cycle65` / `cycle66` / `cycle71` / `cycle111b`），`generator-audit` 更用 `// V3.6 cycle110: 概念卡 4 里程碑` 做 ScopeLevel 模組嘅**結束標記** → 註解一被刪就 `FATAL: ScopeLevel end marker not found`。處理：① `generator-audit` 改用 **code-based marker**（`function _checkMilestones(`）② 新增 **`tools/squeeze-comments.cjs`** —— 逐條試改 + 跑 gate，任何一條爆就自動還原，令「清註解」由人手 protected list 變成**可證明安全**。新增 `tests/source.js` 做 app 原始碼嘅單一真實來源（`readAppSource()` / `readAppJs()`）。 |
| 111h (追加) | 2026-10-28 | 🔴 **P0：boot 每個都 crash**（喺線上站揭發）。`setupTeacher()` 叫咗一個**喺成個 repo 歷史從來冇定義過**嘅 `_wirePauseOverlay()`（v3.5 refactor 拆咗佢之後舊 call site 冇跟住更新）→ 每個頁面載入都 `ReferenceError` → **成個 DOMContentLoaded 之後嘅流程全部死掉**：`renderTypePicker` / `renderRecommendChips` / `Profile.load` / `Audio.setMasterVolume` / `renderBossSelect` / resume 按鈕 —— 即係**題型選擇器、推薦 chips、學生 profile（級數 · 里程碑）、主音量、Boss 面板、教師台 pause-resume、題庫管理 add 全部失效**。⚠️ **之前 52 條視覺守門捉唔到**，因為**個 runner 完全唔收集 console** → `tests/visual/cdp.mjs` 新增 `Runtime.exceptionThrown` + `console.error` 收集 + 新場景 **`boot-console-clean`**（8 條：console 零 error + 逐個指名 Profile / 主音量 / 題型選擇器 / 教師台 / 題庫 / Boss / 推薦 chips 真係行過）。Lock-in：T111h-14..16 + 場景 8 條；還原驗證：加返 stale call → 4 條場景斷言 fail。**通則：守門一定要睇 runtime 嘅真實行為（console / 例外），唔可以淨睇 DOM 結構** —— 一個「boot 到一半 throw 咗」嘅 P0 可以喺線上存在幾個 cycle 而所有 gate 都全綠。 |

| 111i | 2026-10-30 | **真機 playtest 檢視**（用 `game-studio:game-playtest` skill）—— 4 條流程變正式守門：`playtest-teacher-flow`(9) / `playtest-relay-level`(5) / `playtest-end-screen`(5) / `playtest-boss`(5)，全部用學校 iPad **639×669**。🟠 **已修**：easy dual **接力開局 banner 空**（`UI.setSENTurn` 只喺 `_scheduleNextQuestion` 被叫 → 開局從來冇叫過 → 學生唔知輪到邊隊）→ `startGame` 補 `UI.setSENTurn(currentTeam)`，場景由 4/5 變 5/5。🔎 **新發現（待拍板）**：① 經典/boss 畫面「逐個選項 ✓/✗」**係死代碼**（實測存活只有同一 tick —— `_scheduleNextQuestion` delay=0 → `area.innerHTML=''` 清走選項區）—— 同 cycle111f 註解「經典畫面一直有」矛盾；② **M4 里程碑正常單局數學上唔可能達到**（一局 9 題 < 連對 10 題）；③ 畫面一律寫「10 題」但實際 **9 題**（文案冇跟 cycle109 嘅 `goalStages × 3`）；④ 級數階梯對中等學生幾乎冇作用（20 萬次模擬：p=50% → 終局 **L1.25**、每題 5.8% 變級率 → 推薦改「升 連3對 / 降 連5錯」）；⑤ 經典/boss 畫面**冇題目進度格**（§3.9 未做）；⑥ 單人 boss 有**一座城塔係無主嘅**（boss 隨機攻擊、冇回血、失敗要兩座都跌到 0）。**新機制 strict-xfail**（`xfail: true` → 已知缺陷唔會被鎖成「永久預期行為」）。Lock-in：regression T111i-01..08 + 視覺 24 條；8 條還原驗證全部以正確原因 fail。詳見 **`docs/PLAYTEST_REVIEW.md`**。 |

| 111j | 2026-10-30 | **Ken 拍板 4 條 playtest 發現落地**。**F6 局長可調**：新增 `_easyQuestionTotal()` = `goalStages × STAGE_CELLS` → 畫面所有「N 題」嘅唯一真實來源（改咗 8 處寫死「10 題」嘅文案，之前實際 9 題 → 老師點題唔對數）；`Game.settings.goalStages` 預設 **3 → 4**（4 關 = 12 題）；教師台新增 **「局長」控制**（`#td-goal-stages` 1/2/3/4 關 = 3/6/9/12 題）持久化落 `Profile.data.goalStages`（lazy-init 用 `Number.isFinite` + 夾 1..4），改完即刻刷新選單文案。**F4 M4 保留**：12 題局 → `sessionStreak >= 10` 正常流程達得到（真機驗證 `milestonesByType[type].m4` 有時間戳），概念卡維持 4 粒圓點。**F5 移除自動升降級**：刪 `_updateScopeLevel` / `LEVEL_UP_STREAK` / `LEVEL_DOWN_STREAK`，`_scopeLevelOf()` 恆返 1（唔讀舊 profile 殘留嘅 `levelByType`），學生唔會再見到「⬇️ 降級」挫敗提示。**F3 經典/boss 逐個選項 ✓/✗ 真正可見**：經典路徑答完 650ms（答啱）/ 1000ms（答錯，跟 SEN）+ `highlightBtn` 移除時間 700 → 2200ms（之前 delay=0 → `area.innerHTML=''` 即刻清走 → 標記只存活同一個 tick）。Lock-in：regression T111j-01..09 + 更新 T111b-01/03/04/07/09 · T109-02 · PLAN-04/08 · T111h-15；generator-audit +3 functional（局長 4 關 = 12 題 / `_easyQuestionTotal` == target / 真實預設局長）；**13 條還原驗證全部以正確原因 fail**。詳見 `docs/PLAYTEST_REVIEW.md`。 |

| 111c | 2026-10-30 | **關卡守護者重新入場（§3.9）+ F7 經典/boss 畫面進度格**。easy 畫面每關有一隻「守護者」，**HP = Stage 進度格 3 格** → 答啱填 1 格 = 打守護者 1 格（`.is-hurt` 白閃 + 震）；3 格填滿 = 守護者退場（`.is-defeated`）= 過關 → 下一關新一隻。⚠️ **HP 唔係獨立欄位** —— 唯一真實來源 = `.sen-cell` 進度格（全檔唔准出現 `guardianHp` 之類第二個 HP 欄位）。⚠️ **species 係 per-Stage 鎖定**（`showQuestionSEN()` 顯示新題嗰刻鎖 / 過關時 `_applyStageUnits()` 清空 `s.family`）—— per-question 會每條題換守護者，喺答題後鎖會鎖錯 family。新增 **5 隻守護者 sprite**（`px-boss-count` 果籃怪 / `px-boss-length` 拉長獸 / `px-boss-height` 疊高獸 / `px-boss-order` 迷路蟲 / `px-boss-capacity` 渴飲獸；16×16 · 整數座標 · crispEdges · 48px 顯示）。**F7 已修**：經典/boss 畫面原本 `.sen-cell` **只存在於 SEN 畫面** → boss 學生唔知自己答到第幾題；今次每隊加 `#classic-cells-{team}` + label「第 N 題 · 關卡 M」，classic 路徑接 `_applyStageUnits(team, CELL_UNITS)`（喺 `UI.updateTeam()` 之前）。⚠️ 進度格 render 抽成 **`_renderStageCells()` 單一真實來源**（兩個畫面共用，唔會各寫一份漂移）。SEN 安全：守護者動畫只係自己郁（冇 screen shake / hit-stop）+ CSS + JS 兩層 respect `prefers-reduced-motion`。Lock-in：regression T111c-01..13 + generator-audit T111c-1..4（真實執行 species 映射 / 過關清空 / **跨檔 symbol 接線** —— 捉「宣告咗但冇接線」同 cycle111h `_wirePauseOverlay` 同類）+ 視覺場景 `guardian-stage`（4 條）；**14 條還原驗證全部以正確原因 fail**。 |

| 111n | 下一步 | F8：單人 boss 右塔「無主」（要 Ken 拍板：淨顯示一座 / 或加回血）。 |
| 111d | 下一步 | 4 scope icon + 3 UI icon + emoji-as-chrome 置換（合共 16 個新 symbol）。 |
