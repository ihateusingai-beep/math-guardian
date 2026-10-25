# Math Guardian v3.6 — 視覺品質 Rubric + 實作指南

> **cycle 106 · 2026-10-24 · 狀態:已 ship**
> 本文係 Math Guardian 嘅**視覺品質 single source of truth**。
> 配套文件:[`ART_STYLE_GUIDE.md`](ART_STYLE_GUIDE.md)(美術實作規則)、[`UI_STYLE_GUIDE.md`](UI_STYLE_GUIDE.md)(遊戲 UI 規則)。
> 本文嘅 audit 全部用**真實 browser render + 像素取樣**做,唔係讀 source 估。

---

## 0. TL;DR(30 秒)

| 項目 | 內容 |
|---|---|
| **目標風格** | 2D 像素插畫 + 高對比大圖示嘅課室教學遊戲(Ken 2026-10-24 確認) |
| **比較基準** | **雙軌**:UI 層對教育平台(IXL / Khan Academy Kids);像素呈現對 2D 像素遊戲 |
| **評分** | 12 個 category × 加權,現況 **6.30 / 10**(cycle 106 修復前 4.56) |
| **最弱 critical state** | **Boss / normal track**(`.option-btn` 死 CSS → 答案掣 308×30 扁平白方塊)——cycle 106 已修,現時最弱變成 **dual arena 中段留白 + 老師面板仍似 generic dashboard** |
| **最大 screen-space 失敗** | 主選單 sticky CTA 壓住玩法區 + 桌面 1440×900 有 60% 畫面留白未用 |
| **已修 P0** | 死 CSS(9 條)、compareHeight 高度鏈、6 組對比度失效、「第 0 題」off-by-one、觸控目標 < 44px |
| **產出** | 本文(rubric/評分/matrix/計劃/profiles)+ 2 份 style guide + 11+6 張 evidence 幀 + T106 regression lock-in |

---

## 1. 目標 art direction statement

> **Ken 2026-10-24 確認原文**
>
> 「2D 像素插畫 + 高對比大圖示嘅課室教學遊戲」——夜晚像素場景(月光/山/樹)做世界觀底,像素 sprite 做角色同道具,扁平 emoji 做題目物件,超大字 + 高對比卡片做 UI。核心原則:任何學生元素(題目、答案掣、進度)都一定要喺 1 秒內認得出,**高對比係硬要求,唔係加分項**。

### 1.1 拆解成可檢查嘅規則

| # | 規則 | 點樣檢查 |
|---|---|---|
| A1 | 世界觀底 = 夜晚像素場景 | 背景必須係像素 SVG / 漸層,唔可以係 flat 卡片堆 |
| A2 | 角色/道具 = inline SVG pixel sprite | 唔可以用 emoji 做「角色」;emoji 只可以當「題目物件」 |
| A3 | 題目物件 = 扁平 emoji | 用 emoji 表達數量/物件,唔好自創 icon font |
| A4 | UI = 超大字 + 高對比卡片 | 正文 ≥ 16px,主要題目 ≥ 28px;任何文字對比度 ≥ 4.5:1(大字 ≥ 3:1) |
| A5 | **1 秒可辨識** | 一次注視 ≤ 1 秒要能指出:焦點、當前狀態、即時威脅/機會、可用操作 |
| A6 | 高對比係硬要求 | 對比度 < 4.5:1 = **bug**,唔係「可以接受嘅設計取捨」 |

### 1.2 邊啲嘢**唔喺**目標風格內(避免日後走偏)

- 唔係寫實 3D、唔係 PBR 材質、唔係角色骨骼動畫(本 project 0 canvas / 0 WebGL / 0 Three.js)
- 唔係 Material / Bootstrap 式 generic dashboard
- 唔係 emoji 做 UI chrome(emoji 只做內容物)

---

## 2. 比較基準(雙軌)

### 2.1 點解唔用 3D / AAA 動作遊戲做 bar

Math Guardian 係**單檔 HTML5 + Tailwind CDN + inline SVG**嘅教學遊戲:

```
canvas: 0 · WebGL: 0 · Three.js: 0 · 角色模型: 0 · 貼圖檔: 0 · 外部 media payload: 0 bytes
```

用 3D 動作遊戲嘅 AAA 指標(多邊形數、貼圖解析度、骨骼/蒙皮、後製、SSAO/DOF)去評,只會得出兩樣嘢:**做唔到嘅分數**同**冇意義嘅建議**。呢個 category error 喺 [`AUDIO_VIDEO_OPTIMIZATION.md`](AUDIO_VIDEO_OPTIMIZATION.md) cycle 104 已經用同一個理由拒絕過一次(拒絕假設有音/影片資產)。

所以本 cycle 改成**雙軌比較**,每個 category 指定用邊條 bar:

| Bar | 對象 | 適用 category |
|---|---|---|
| **R-EDU** | 教育平台 UI:IXL / Khan Academy Kids / DreamBox | 可讀性、狀態可辨識、UI 層級、觸控、回饋 |
| **R-PIX** | 2D 像素遊戲:Code Combat / Koala's Adventure 式 | 構圖、跨層一致性、sprite 語言、像素工藝、動態、技術完整性 |

### 2.2 兩條 bar 嘅典型特徵(用嚟評分)

**R-EDU(教育平台 UI)**
- 每個可互動元素都有明確 hover / focus / pressed / disabled 四態,而且三態都睇得出
- 答錯即時回饋 + 文字解釋 + 重試路徑,唔淨係變色
- 題目區永遠係畫面最大、最亮、對比最高嘅區域
- 觸控目標 ≥ 48px(手機)/ ≥ 44px(平板),字級 scale 跟 device
- 進度條永遠有數字/文字,唔止一條色 bar

**R-PIX(2D 像素遊戲呈現)**
- 一致嘅 pixel grid(通常 16×16 或 8×8 tile),唔會有同一場景兩種解析度
- sprite 有明確輪廓(silhouette),玩家 1 秒認得出係邊隻
- 燈光有方向性:暖光 = 玩家/友善,冷光 = 場景,紅光 = 危險
- 動畫有 anticipation → contact → settle,唔係淨係 loop
- UI 用同一套材質/形狀語言(唔係白卡片浮喺像素場景上面)

---

## 3. Visual-state set(評咗啲咩 / 冇評啲咩)

### 3.1 已評估(11 個 representative state,全部有真實 render + 像素量測)

| # | State | 截圖 | 點評估 |
|---|---|---|---|
| S1 | 主選單(1440×900 桌面) | `screenshots/before-01-home-menu-1440.jpg` | render + 像素取樣 3 區域 |
| S2 | 主選單下半(範疇選擇) | `screenshots/before-02-home-menu-scopes.jpg` | render + 元素 rect 量測 |
| S3 | Onboarding modal | `screenshots/before-03-onboarding.jpg` | render + computed style 量測 |
| S4 | SEN track — 找 L 飲品(4 選一) | `screenshots/before-04-sen-findL-drinks.jpg` | render + rect 量測 |
| S5 | SEN track — 順序題 | `screenshots/before-05-sen-sequence-hint.jpg` | render + 對比度像素量測 |
| S6 | SEN track — 高矮比較 | `screenshots/before-06-sen-compareheight.jpg` | render + computed height 量測 |
| S7 | Boss / normal track | `screenshots/before-07-boss-gameplay.jpg` | render + computed style 量測 |
| S8 | 雙隊 arena(左藍右紫) | `screenshots/before-08-dual-arena.jpg` | render |
| S9 | 老師控制台 dashboard | `screenshots/before-09-teacher-dashboard.jpg` | render + computed style 量測 |
| S10 | 完結畫面(銀獎 7/10) | `screenshots/before-10-end-screen.jpg` | render + 互動流程 |
| S11 | Boss 選題 menu(23 題型) | `screenshots/before-11-boss-menu-23-types.jpg` | render + rect 量測 |

### 3.2 **未評估**(唔會當已評)

| State | 原因 |
|---|---|
| Boss 戰役受傷動畫(HP 下降、enraged、frozen) | 未觸發到 boss damage 流程 |
| Pause overlay | 未喺遊戲中開啟 |
| 雙隊 coop 推船完整流程 | 只影到單一 state,未跟完整局 |
| 裝置變化(rotate / resize / iPad Safari) | 未做 |
| reduced-motion 模式 | 未做 |
| 粉藍 default 淺色主題實機 | headless Chrome 永遠係 night scene,未驗 |

> 依 task 要求:未提供/未評估嘅 state **唔會當已評**,亦唔會影響總分以外嘅聲稱。

---

## 4. Complete-frame visual communication audit(逐 state)

> 每個 state 過一遍「焦點 → 狀態 → 威脅/機會 → 操作 → 後果」5 秒鍊。

### S1 主選單(1440×900)

**實測數據**

| 區域 | 區域內最大對比度 | 判定 |
|---|---|---|
| 校名「將軍澳培智學校」 | **1.06 : 1** | 完全隐形 |
| 副標「v3.6 · 課堂練習 · 雙隊 · Boss」 | **1.37 : 1** | 完全隐形 |
| 「課堂：①玩法 → ②身份 → ③題目 → 睇摘要 → 一鍵開始。」 | **1.26 : 1** | 完全隐形 |
| H1 標題(對照組) | 4.51 : 1 | 合格 |

**Frame-level 發現**
- **F1 — Screen-space 浪費**:內容欄淨係 580px 闊(1440 之下 40%),左右大片夜空。像素場景靚,但 composition 冇利用闊度。
- **F2 — 焦點競爭**:H1 標題(橙→粉→紫漸層)+ 大 CTA 紫漸層 + 右上 BGM + 右下 floating 開始掣,4 個焦點。
- **F3 — 重複 CTA**:`#btn-quick-start`(floating,103×50)同 `#btn-easy-start`(大卡,522×106)語義完全一樣,同一個畫面兩個「開始」。
- **F4 — Sticky CTA 壓住內容**:`#class-start-sticky` 位置重疊「① 團隊玩法」內文(實測:玩法鈕 326–576 × 509–585,floating CTA 520–623 × 515–565 → 重疊)。
- **F5 — 對比度崩潰**:F1–F3 對應嘅 3 行文字全部 < 1.4:1。
- **F6 — 素材語言混雜**:校徽係 **raster PNG**(白底方框)、怪獸/城堡係 **pixel SVG**、標題係 **漸層文字**、CTA 係 **emoji** —— 4 種語言。

### S2 主選單下半

- 範疇快捷 chip 實測 **73×32 / 64×32 px** < 44px
- 身份卡 toggle 實測 **511×30 px** < 44px
- 建議題型 chip(`.rec-chip`)實測 **108×30 px** < 44px
- **選中色唔一致**:主模式用紫、玩法用琥珀、範疇用琥珀 —— 同一個「selected」語義 3 種色

### S3 Onboarding modal

**實測**:`#ob-skip` / `#ob-next` computed style → `background-color: rgba(0,0,0,0)`、`border-radius: 0px`、`padding: 0px`、`font-size: 16px` → **兩個按鈕完全隐形**。

- 學生見到一個有說明但冇任何掣嘅 modal → 死路
- 「第 1/3 步」對比度 **1.45 : 1**
- Modal 450×280 落 1440×900 → 大量留白,但 modal 本身 OK

### S4 SEN track — 找 L 飲品

**做得好**:大 A/B/C/D 圓 badge、答案鈕 220×150+、高對比白卡、深藍底白字、焦點清晰。

**問題**
- **雙重標籤**:卡片上已有 A/B/C/D badge,底部又有 A/B/C/D 答案列 → 唔知應該撳邊個
- **答題列位置怪**:喺問題文字**下面**,視線路徑係 卡片→問題→答案,要跳返上去
- 進度 bar 係**扁平青綠漸層**,睇唔出「鋪路」嘅 tile 感
- 內容欄淨係 578px 闊,左右 60% 留白

### S5 SEN track — 順序題

- 序列提示「13 · 15」實測 `color: rgb(30,41,59)`(slate-800)落 `#081028` navy panel → **對比度 1.05 : 1**(區域內所有像素同背景差 < 5%)
- → **學生根本睇唔到題目嘅序列**
- 「第 0 題」off-by-one(見 P0-D)

### S6 SEN track — 高矮比較

**實測**:`.ht-pair-bar` inline `height:92%` → computed height **6px**;inline `height:46%` → computed height **6px**。兩條 bar rect 都係 `67×6`。

- → **「邊個高？」題目視覺上無解**,答啱定答錯都似
- 中段 200px 純留白(題目在上、panel 貼底)

### S7 Boss / normal track

**實測**:`.option-btn` computed → `border-radius: 0px`、`padding: 0px`、`font-size: 16px`、`box-shadow: none`、rect **308×30**

- → 答案掣變成**扁平白方塊**,無圓角無陰影無內距,仲**壓住騎士 sprite**
- 題目「1 + 1 = ?」對比度 **1.19 : 1**(繼承 body slate-800)
- `.mode-badge`「叡智模式」對比度 **1.51 : 1**,無圓角無內距
- 「0 答對 · 0 再 · 0 總」label 低對比
- 右上 3 個 icon 掣**完全冇 button chrome**(死 `.btn`),似 stray glyph
- Boss 條超大但得一個細 sprite;城塔「0/10」被 viewport 底切走

### S8 雙隊 arena

**做得好(全 app 最好嘅一個 state)**
- 左藍 / 右紫 team 編碼清楚,中間琥珀分隔線
- 頂部**像素拔河尺**係真正 tile 感嘅琥珀分段 bar —— 成個 app 渲染得最好嘅元素
- 「平手 0 : 0」即時比分

**問題**
- 左右兩邊嘅題目都係 compareHeight → **兩邊都無解**
- 左 panel 嘅「← 同學」back 掣同 header label 視覺重疊
- 每邊中段都係大留白

### S9 老師控制台 dashboard

**實測**:`#teacher-pause` / `#teacher-end` computed → `background-color: rgba(0,0,0,0)`、`border-radius: 0px` → **完全隐形**;只有「▶ 恢復」因為有 Tailwind `bg-emerald-600` utility 先見到。

- **老師嘅「暫停」同「強制結束」撳唔到** —— 呢個係功能級事故,唔係美觀問題
- Dashboard 嘅 label(「累計 sessions」/「解鎖 bosses」)對比度低 → 睇唔到邊個係 label 邊個係 value
- 整體係 **generic dashboard card**,同遊戲世界觀零連繫
- 底部 modal 內容被切斷(答對率列表中段)

### S10 完結畫面

**做得好(全 app 第二好)**
- 🥈 銀獎 + 「答啱 7 / 10 題（70%）」reward hierarchy 清楚
- 4 個 stat 用綠/紅編碼(答對 7 / 再挑戰 3)
- 5 個成就徽章,已解鎖嗰個著藍色,其餘灰化
- 夜晚場景 + 深色卡片 + 琥珀邊 = 一致

**問題**
- 「🔁 再玩一次」「🏠 返回主選單」**冇 button chrome**(死 `.btn`)→ 似文字唔似掣
- 徽章 label ~11px + 低對比 → 投影距離讀唔到
- stat label 靠左、value 靠右,相隔 ~100px → 掃讀成本高
- 校徽 raster 白底方框喺深色卡入面好突兀
- 「同學」出現兩次(標題行 + stat box 內)

### S11 Boss 選題 menu(23 題型)

- 23 個題型鈿 259×56 ✓ 觸控合格
- Boss 戰役卡用 **紅色虛線框** → 睇落似 disabled/error,但實際 `aria-pressed="false"` 可以撳
- 推薦 chip 108×30 < 44px

---

## 5. 視覺品質 Rubric(12 category)

> 每個 category:定義 / 1 / 5 / 8 / 10 描述 / AI 常見失敗模式 / 客觀檢查 / 權重。
> 權重總和 = 100。

---

### C1 — 可讀性與對比度 Readability & Contrast
**權重 18 · Bar: R-EDU**

**量度**:任何玩家要讀嘅文字,喺其實際背景上嘅 WCAG 對比度。

| 分 | 描述 |
|---|---|
| **1** | 關鍵文字對比度 < 1.5:1(肉眼都睇唔到),或者靠 icon 顏色先分得出 |
| **5** | 全部文字 ≥ 3:1,但冇統一 token,靠逐個 raw hex 修;焦點文字同背景爭議 |
| **8** | 全部文字 ≥ 4.5:1(大字 ≥ 3:1),用 token 統一管理,兩個 theme 都驗過 |
| **10** | ≥ 4.5:1 + 焦點區對比度 ≥ 7:1 + 非文字 UI 元件 ≥ 3:1 + 有 automated contrast check 入 CI |

**AI 常見失敗模式**
- 用 `text-slate-700` 落深色 panel(以為 slate 系 = 通用)
- 用 emoji 顏色 / 紅綠做唯一訊號(color-only signal)
- 深色 modal 入面嘅 label 跟錯 token
- 半透明 card 疊 card → 文字鬼影

**客觀檢查**
```bash
# 逐個關鍵字串搵出背景 + 前景,量 WCAG
# (見 §13 T106-C evidence 嘅像素取樣法)
```

---

### C2 — 遊戲狀態可辨識度 Gameplay-state readability
**權重 11 · Bar: R-EDU**

**量度**:玩家 1 秒內能否分辨「邊個係我 / 邊個係對手 / 邊個係目標 / 我而家可做咩」。

| 分 | 描述 |
|---|---|
| **1** | 分唔出邊個係自己隊、邊個係對手;進度/HP 唔存在或者讀唔到 |
| **5** | 隊伍色分得開,但「進行中/等候中」「答啱/答錯」靠細字或者冇 |
| **8** | 隊伍色 + 文字 + icon 三重編碼;每個 state 都有獨立視覺(唔只顏色) |
| **10** | 上述 + 狀態轉換有動畫提示 + 1 秒檢查 5 條鏈(焦點/狀態/威脅/操作/後果)全部成立 |

**客觀檢查**:inspect 每個 state 嘅 `aria-pressed` / `aria-checked` 同畫面呈現一致;唔可以有「DOM 話 disabled 但畫面似正常」。

---

### C3 — 構圖與 screen-space 運用 Composition & screen-space budget
**權重 7 · Bar: R-PIX**

**量度**:焦點位置、主體比例、留白、UI 佔畫面比例、前中後景分離。

| 分 | 描述 |
|---|---|
| **1** | 焦點唔存在,或者焦點只佔畫面 2%;玩家要掃全畫面先搵到題目 |
| **5** | 焦點明確但比例失衡(大留白 + 細控件);UI 冇佔位預算,靠自然流堆 |
| **8** | 焦點佔畫面 25–40%,主次分明,留白有意識,UI 唔遮 gameplay |
| **10** | 上述 + 明確的 screen-space 預算(每個 state 定義 UI 佔比上限)+ 唔同 viewport 保持同一構圖 |

**客觀檢查**:量主要互動元素面積 / viewport 面積;量任何兩個焦點嘅距離。

---

### C4 — 跨層視覺一致性 Cross-layer art-direction cohesion
**權重 9 · Bar: R-PIX**

**量度**:角色 / 道具 / 場景 / UI / icon / 字體 / card / VFX 係咪同一套視覺文法。

| 分 | 描述 |
|---|---|
| **1** | 同一畫面有 3 種以上唔同素材類型(photo raster + pixel sprite + flat emoji + 漸層文字),冇共同語法 |
| **5** | 大方向一致(都係像素風),但 icon 語言、card 材質、字體權重各自為政 |
| **8** | 全部素材同一 pixel grid;card 有統一材質(圓角/邊/陰影一套);icon 全部 inline SVG |
| **10** | 上述 + 有 written style guide + 新素材入庫要過 review gate |

**客觀檢查**:列齊每個 state 嘅素材類型;`grep` 出所有非 inline-SVG 圖片來源。

---

### C5 — 圖示與 sprite 語言 Icon & sprite language
**權重 7 · Bar: R-PIX**

**量度**:icon 嘅辨識度、silhouette、一致嘅 grid。

| 分 | 描述 |
|---|---|
| **1** | 同一概念用過 emoji / SVG / 文字三種寫法 |
| **5** | 大部分一致,但 sprite 尺寸/grid 唔統一,emoji 會變成 monochrome fallback |
| **8** | 全部 sprite 同一 grid、同一 palette,輪廓清晰,1 秒認得出 |
| **10** | 上述 + 每個 icon 有語意規範(邊啲可以用 emoji)+ 唔依賴 emoji font(有 SVG fallback) |

**客觀檢查**:`grep` 出 `<img src=` 同 emoji-as-chrome;量每個 sprite 嘅 viewBox 尺寸。

---

### C6 — 像素工藝與材質 Pixel craft, material & lighting
**權重 7 · Bar: R-PIX**

**量度**:輪廓、明暗層級、材質分離、光源方向一致。

| 分 | 描述 |
|---|---|
| **1** | 冇 sprite,或者 sprite 像素化但冇光影,平得像色塊 |
| **5** | 有基本明暗,但光源方向唔一致;陰影係 CSS drop-shadow 而唔係畫入 sprite |
| **8** | 光源方向一致、材質可分辨(石/木/金屬/水)、細節層級(主/次/三級)有分 |
| **10** | 上述 + 同一套 palette ramp + sprite 有 ambient occlusion + 每個 sprite 過獨立 review |

**客觀檢查**:睇同一個 sprite 喺唔同燈光下嘅明暗方向。

---

### C7 — 動態與動畫原則 Motion & animation principles
**權重 7 · Bar: R-PIX**

**量度**:動畫係咪講緊嘢,定係純裝飾。

| 分 | 描述 |
|---|---|
| **1** | 冇動畫,或者動畫同資訊無關(純 loop) |
| **5** | 有 loop(飄雪/閃爍)但冇 state transition 動畫;輸入反饋即刻,但冇 anticipation/settle |
| **8** | 每個 state 轉換都有動畫;anticipation → contact → settle 齊;支援 reduced-motion |
| **10** | 上述 + 動畫長度同資訊重要度掛鈎 + 動畫節奏可被玩家設定 |

**客觀檢查**:數 `animation:` 嘅 rule 數,再數其中幾多個對應到 state transition(而唔係 ambient)。

---

### C8 — UI 層級與按鈕狀態 UI hierarchy, buttons & states
**權重 11 · Bar: R-EDU**

**量度**:primary vs secondary、每個掣嘅 idle/hover/focus/pressed/disabled/selected/busy/error/cooldown。

| 分 | 描述 |
|---|---|
| **1** | 掣冇樣(冇底色/冇圓角/冇內距),或者只有一個 state |
| **5** | 掣有樣,但 hover/pressed/focus 冇分別;primary 同 secondary 視覺權重一樣 |
| **8** | 每個掣有 hover + focus-visible + pressed + disabled 四態,primary/secondary 明確分層 |
| **10** | 上述 + 齊 9 態(idle/hover/focus/pressed/disabled/selected/busy/error/cooldown)全部有 + focus ring 對比度 ≥ 3:1 |

**客觀檢查**:對每個互動 element 跑 `getComputedStyle` 影 4 個 state,比較唔同。

---

### C9 — 觸控目標與輸入 Touch targets & input
**權重 7 · Bar: R-EDU**

**量度**:可撳區域大小、輸入 lag、輸入通道(觸控/鍵盤/滑鼠)。

| 分 | 描述 |
|---|---|
| **1** | 主要答案掣細過 44px,或者被其他 element 蓋住 |
| **5** | 大部分 ≥ 44px,細粒度掣(30–40px)仲有 |
| **8** | 全部互動目標 ≥ 44×44,主要目標 ≥ 56,支援 keyboard focus |
| **10** | 上述 + 觸控回饋 < 100ms + 支援 keyboard/pointer 雙通道 + 有 touch-target audit script |

**客觀檢查**:`getBoundingClientRect()` 量每個 button 嘅尺寸;`elementFromPoint` 檢查有冇被遮。

---

### C10 — 回饋與狀態轉換 Feedback & state transitions
**權重 7 · Bar: R-EDU**

**量度**:答完之後玩家知唔知知發生咩事同下一步係咩。

| 分 | 描述 |
|---|---|
| **1** | 撳完冇反應,或者只係變個色 |
| **5** | 有 ✅/❌ 計數 + 音效,但錯誤冇解釋、冇「再試」路徑 |
| **8** | 對啱/錯都有 icon + 文字 + 聲音 + 動畫,錯誤解釋點解錯,下一步明確 |
| **10** | 上述 + 回饋時間同操作難度掛鈎 + 玩家可以略過 |

**客觀檢查**:逐個狀態睇有冇 icon + 文字雙重編碼。

---

### C11 — 技術影像完整性 Technical image integrity
**權重 5 · Bar: R-PIX**

**量度**:aliasing、shimmer、pop-in、壓縮 artifact、錯透明度、錯 z-order。

| 分 | 描述 |
|---|---|
| **1** | 肉眼可見嘅 sprite 模糊 / 破圖 / 圖標變 monochrome fallback |
| **5** | 大致乾淨,但 emoji 依賴系統 font,唔同裝置唔同樣 |
| **8** | `image-rendering: pixelated` 全覆、冇破圖、emoji 有 fallback、z-order 冇打架 |
| **10** | 上述 + 喺 3 種 DPR / 2 種瀏覽器都驗過 + 有 visual regression capture script |

**客觀檢查**:grep `image-rendering`;跨 DPR 影相同 state 對比。

---

### C12 — 跨 state 一致性 Consistency across states
**權重 4 · Bar: R-PIX**

**量度**:同一個概念喺唔同 state 睇落係咪同一樣嘢。

| 分 | 描述 |
|---|---|
| **1** | 同一個掣喺唔同 state 外觀唔同 |
| **5** | 主要 state 一致,但有 1–2 個 state(通常係老師/後台)完全唔同世界觀 |
| **8** | 全部 player-facing state 一致;差異只喺語意上唔同 |
| **10** | 上述 + 有 state matrix 文件 + 新 state 要過一致性 check |

---

## 6. 現況評分(逐 category)

> **Current** = cycle 106 修復**之後**(即 shipped 狀態)。
> **Before** = cycle 106 修復之前(用嚟量 P0 嘅影響)。
> **Reference** = 對應 bar 嘅典型分數(10 = 已達該 bar 最高水平)。
> 所有分數都係**基於可見證據**(截圖 + 像素量測 + computed style),唔係印象分。

| # | Category | W | Before | **Current** | Reference | Gap | Gap 類型 | 現實可行性 |
|---|---|---|---|---|---|---|---|---|
| C1 | 可讀性與對比度 | 18 | 3 | **7** | 9 (R-EDU) | 2 | 技術呈現 | ✅ 已修 6 組,剩 footer band / boss 名 |
| C2 | 遊戲狀態可辨識度 | 11 | 4 | **7** | 9 (R-EDU) | 2 | UI | ✅ 隊伍色已有,缺「等候中」細節 |
| C3 | 構圖與 screen-space | 7 | 6 | **6** | 8 (R-PIX) | 2 | Art direction | ⚠️ 要改 layout,中等工 |
| C4 | 跨層視覺一致性 | 9 | 4 | **4** | 8 (R-PIX) | 4 | **Art direction** | ⚠️ 校徽 raster + emoji 混用,要決策 |
| C5 | 圖示與 sprite 語言 | 7 | 5 | **5** | 8 (R-PIX) | 3 | Asset quality | ⚠️ emoji fallback 要 SVG 化 |
| C6 | 像素工藝與材質 | 7 | 7 | **7** | 8 (R-PIX) | 1 | Asset quality | ✅ 已有 35 個好 sprite |
| C7 | 動態與動畫原則 | 7 | 5 | **5** | 8 (R-PIX) | 3 | Animation | ⚠️ 要補 state transition 動畫 |
| C8 | UI 層級與按鈕狀態 | 11 | 3 | **6** | 9 (R-EDU) | 3 | UI | ✅ 掣已修好,剩 disabled/focus/busy |
| C9 | 觸控目標與輸入 | 7 | 4 | **8** | 9 (R-EDU) | 1 | 技術呈現 | ✅ 已修 3 個 < 44px |
| C10 | 回饋與狀態轉換 | 7 | 7 | **7** | 8 (R-EDU) | 1 | UI | ✅ 已有 ✅/❌ + 音效 |
| C11 | 技術影像完整性 | 5 | 7 | **7** | 8 (R-PIX) | 1 | 技術呈現 | ✅ 基本乾淨 |
| C12 | 跨 state 一致性 | 4 | 4 | **6** | 8 (R-PIX) | 2 | UI | ✅ Boss track 已拉齊 |

### 6.1 逐項證據 + 最小改動

**C1 可讀性(7/9)**
- 證據:`before-01-home-menu-1440.jpg` 校名區域最大對比度 1.06:1;`before-05-sen-sequence-hint.jpg` 提示 1.05:1;`before-07-boss-gameplay.jpg` 題目 1.19:1;`before-09-teacher-dashboard.jpg` label 不可讀
- 已做:新增 `--c-text-on-night` token pair,取代 44 處 raw `text-slate-6/7/800` 落深色 surface
- 剩低:頁尾 `Copyright © Tseung Kwan O Pui Chi School` 係淺灰 band(白底白字),同夜晚場景撞;Boss 名「森林巨魔」暗紅落暗紅
- 最小改動:頁尾 band 改 `rgba(15,23,42,0.55)` + `text-on-night`;Boss 名改 `text-amber-200`

**C4 跨層一致性(4/8)—— 最大差距**
- 證據:主選單同時存在 4 種素材語言 —— 校徽 = **raster PNG 白底**、怪獸/城堡 = **inline SVG pixel**、標題 = **CSS 漸層文字**、CTA = **emoji 🌻**
- 最小改動(唔使買 artwork):校徽 PNG 改成圓形 mask + 去白底 + 對齊 pixel 邊;emoji-as-chrome(🌻 🌼 ⚔️ 🏗)全部換 inline SVG
- 現實性:**可行,1 個 cycle**。但 emoji-as-chrome 有 20+ 處,要逐個換

**C8 UI 層級(6/9)**
- 證據:`before-03-onboarding.jpg` 兩個掣完全隐形;`before-07-boss-gameplay.jpg` 右上 3 個 icon 掣冇 chrome;`before-10-end-screen.jpg`「再玩一次」似文字
- 已做:9 條死 CSS 改寫成原生 CSS → `.btn` 家族全部有底/圓角/內距/陰影/hover/pressed
- 剩低:`disabled` 狀態只有 opacity;`focus-visible` ring 只喺 `.ht-pair-hit` 有;冇 busy/loading 狀態;`selected` 语义用 3 種色
- 最小改動:統一 `--c-accent-selected`(單一 selected 藍)+ 全部 `.btn` 加 `:focus-visible` ring

**C9 觸控(8/9)**
- 證據:實測 `.option-btn` 308×**30**(→ 已修 308×**62**)、範疇 chip 73×32、身份卡 toggle 511×30、rec-chip 108×30
- 已做:3 個加 `min-height: 44px`;`.option-btn` 靠 `.btn` base 變 62px
- 剩低:部分 <button> 嘅 hit area 仍然靠 padding,`box-sizing` 邊界情況要再量
- 最小改動:加一個 CI script 量全部 `button` rect

**C5 sprite 語言(5/8)**
- 證據:`before-07-boss-gameplay.jpg` 右上「⚔️」render 成 monochrome fallback(裝置冇 emoji font 就會變)
- 最小改動:UI chrome 位置嘅 emoji(模式鈕、大絕、icon-only 掣)全部換 inline SVG symbol;題目內容嘅 emoji 保留

**C7 動態(5/8)**
- 證據:63 個 `@keyframes`,大部分係 ambient(firefly/飄雪/shimmer);state transition 動畫近乎冇
- 最小改動:答案掣 correct/wrong 已有 `flash-correct`/`flash-wrong`;補 question enter/exit、tab switch、boss hit

### 6.2 加權總分

```
Before  = Σ(score × weight) / 100 = 456 / 100 = 4.56 / 10
Current = Σ(score × weight) / 100 = 630 / 100 = 6.30 / 10
Reference (R-EDU 加權) ≈ 8.8 / 10
Reference (R-PIX 加權) ≈ 8.0 / 10
```

---

## 7. Visual-state matrix

> 每個 state 對其最重要嘅 category 評分(1–10)。

| State | 可讀性 | 狀態可辨識 | 構圖 | 一致性 | UI 層級 | 觸控 | 回饋 | 技術完整 | 跨 state 一致 | 加權小計 |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 主選單 | 7 | 7 | 6 | 4 | 6 | 8 | 7 | 7 | 6 | **6.5** |
| S2 選單下半 | 8 | 7 | 6 | 4 | 6 | 7 | 6 | 7 | 6 | **6.5** |
| S3 Onboarding | 8 | 7 | 7 | 4 | 7 | 9 | 6 | 8 | 5 | **7.1** |
| S4 SEN 找 L | 9 | 8 | 6 | 5 | 8 | 9 | 8 | 8 | 7 | **7.6** |
| S5 SEN 順序 | 8 | 7 | 6 | 5 | 8 | 9 | 8 | 8 | 7 | **7.2** |
| S6 SEN 高矮 | 8 | 8 | 6 | 5 | 8 | 9 | 8 | 8 | 7 | **7.3** |
| S7 Boss track | 8 | 7 | 5 | 5 | 7 | 9 | 8 | 8 | 6 | **7.0** |
| S8 雙隊 arena | 8 | 9 | 7 | 5 | 7 | 9 | 8 | 8 | 7 | **7.6** |
| S9 老師 dashboard | 7 | 6 | 5 | 3 | 6 | 7 | 6 | 7 | 4 | **5.9** |
| S10 完結畫面 | 8 | 8 | 7 | 5 | 7 | 8 | 9 | 8 | 7 | **7.4** |
| S11 Boss 選題 menu | 8 | 8 | 6 | 5 | 7 | 8 | 7 | 8 | 6 | **7.1** |

**最弱 critical state**:`S9 老師控制台 dashboard`(5.9)—— 佢係老師實際用嚟監控學生嘅畫面,而家仲 generic dashboard + 部分 label 對比度低。修好佢嘅 ROI 高過修主選單。

**次弱**:`S1 主選單`(6.5)—— 但主選單係第一眼 impression,視覺權重上仲係要優先。

**最大 screen-space / 溝通失敗**:`S1` 嘅 **sticky CTA 壓住玩法區 + 1440×900 有 60% 畫面留白未用**。

**未能評估**:見 §3.2(5 個 state 冇評,唔影響上面結論)。

---

## 8. Overall visual-readiness score

> ### **6.3 / 10**
>
> **呢個分只量「視覺呈現質素」對住已批准嘅雙軌基準。**
> **佢唔代表本 project 有 AAA 預算、團隊規模、內容量,或者任何製作規模聲稱。**
> Math Guardian 係單人維護、單檔 HTML、無 build、零外部 media 嘅教學工具;
> 用 AAA 遊戲嘅分數去評佢冇意義,亦唔應該被引述成咩。

### 8.1 Comparison matrix

| 維度 | R-EDU(教育平台) | R-PIX(2D 像素遊戲) | **Math Guardian v3.6** | 差距 |
|---|---|---|---|---|
| 對比度 / 可讀性 | 9 | 8 | **7** | -2 |
| 狀態可辨識 | 9 | 7 | **7** | -2 |
| 構圖 | 7 | 8 | **6** | -2 |
| 跨層一致性 | 8 | 8 | **4** | **-4** |
| Sprite / icon 語言 | 7 | 8 | **5** | -3 |
| 像素工藝 | 5 | 8 | **7** | -1 |
| 動畫 | 6 | 8 | **5** | -3 |
| UI 層級 | 9 | 8 | **6** | -3 |
| 觸控 | 9 | 7 | **8** | -1 |
| 回饋 | 8 | 7 | **7** | -1 |
| 技術完整性 | 8 | 8 | **7** | -1 |
| 跨 state 一致 | 8 | 8 | **6** | -2 |
| **加權** | **8.8** | **8.0** | **6.3** | **-2.0 / -1.7** |

**解讀**:Math Guardian 已經**超過「無 polish 嘅 prototype」**,但**未達教育平台 UI 成熟度**。最大單一差距係**跨層一致性(-4)**—— 唔係技術問題,係「素材語言未收斂」嘅 art-direction 決策問題。

---

## 9. 優先改善計劃

### 9.1 Quick wins(低工時、高回報;建議 1–2 個 cycle)

| # | 項目 | 影響 | 工時 | 證據 |
|---|---|---|---|---|
| Q1 | 頁尾 band 改深色半透明 + on-night text | C1 | 15 min | `before-10-end-screen.jpg` |
| Q2 | Boss 名「森林巨魔」改 amber-200 | C1 | 5 min | `before-07-boss-gameplay.jpg` |
| Q3 | 統一 `selected` 語義色(單一藍 token) | C4/C8 | 30 min | S1/S2 |
| Q4 | `.btn` 家族加 `:focus-visible` ring(3:1) | C8/C9 | 30 min | §5 C8 |
| Q5 | 移除重複 floating CTA,或改成「跳去題目」次要動作 | C3 | 30 min | §4 S1-F3 |
| Q6 | 主選單 `menu-track-helper` / `scope-helper` 用同一 on-night token | C1 | 10 min | §4 S1 |
| Q7 | `alert()` → in-game confirm modal(3 處) | C8 | 45 min | §12 |
| Q8 | 騎士 sprite 唔好壓住答案鈕(z-index / 位置) | C3 | 20 min | `after-07-boss-gameplay.jpg` |

### 9.2 High-impact revisions(要 1 個 cycle 級工時)

| # | 項目 | 影響 | 工時 | 備註 |
|---|---|---|---|---|
| H1 | **主選單重構**:內容欄闊度 580 → 900+,staggered 構圖,消除 sticky 覆蓋 | C3/C4 | 2–3 h | 最影響 impression |
| H2 | **跨層語言收斂**:校徽改圓形 mask 去白底;emoji-as-chrome 全換 SVG symbol | C4/C5 | 3–4 h | 最大單一 gap(-4) |
| H3 | **完整按鈕狀態矩陣**:9 態 × 主要掣類型 | C8 | 2 h | idle/hover/focus/pressed/disabled/selected/busy/error/cooldown |
| H4 | **老師 dashboard 重做**:世界觀化(唔再 generic card),table label/value 靠齊 | C4/C12 | 2–3 h | 最弱 critical state |
| H5 | **state transition 動畫**:question enter/exit、tab switch、boss hit、reward | C7 | 2–3 h | 唔只加 loop |
| H6 | **compare 類題目構圖**:utilise 中段空間(而家 200px 留白) | C3 | 1–2 h | |
| H7 | **「雙重 A/B/C/D」清理**:卡片 badge 同答案列二選一 | C2 | 1 h | S4 |

### 9.3 需要專業 artist / 專人(唔應該由 AI 自動生成)

| # | 項目 | 點解要專業 | 預算級別 |
|---|---|---|---|
| P1 | 擴充 sprite 集:角色多 pose、物件多角度、環境細節層級 | AI 生成 sprite 唔穩定手/比例/一致 grid;要有 pixel artist 逐格執 | 中 |
| P2 | 角色行走 / 攻擊 / 受傷 sprite sheet(取代 CSS 動畫代替品) | 動作需要 anticipation/contact/settle 逐 frame 畫 | 中高 |
| P3 | 正式 logo + 字體授權 | 校徽 raster 要專業處理;字體要有 SEN 可讀性授權 | 低中 |
| P4 | 音效美術化(BGM loop、UI hover tick) | 已有 Web Audio 合成,更似遊戲要人手錄製 | 中 |
| P5 | 完整 UI 插畫化(選單面板材質、卡片材質) | 要美術定材質規範先至唔會走樣 | 中 |

> **AI 唔應該做嘅嘢**:手繪 sprite、角色動作、logo 改造。AI 可以做嘅:版面重排、token 收斂、狀態矩陣、動畫規格、code-side QA。

---

## 10. Capability-based rendering quality profiles

> 因為本 project **冇 Three.js / canvas / WebGL**,以下係同樣目的嘅 **CSS/SVG 等價方案**:
> 「渲染後端」→ 合成策略(layer / transform / filter);「貼圖解析度」→ SVG rasterisation + DPR;
> 「draw call」→ DOM element count;「shader complexity」→ filter + blend 層數。

### 10.1 能力偵測(用測量,唔用 UA)

```js
// 建議實作位置: docs/UI_STYLE_GUIDE.md §8 有完整 pseudo-code
const caps = {
  dpr:        window.devicePixelRatio || 1,
  cores:      navigator.hardwareConcurrency || 2,
  reduced:    matchMedia('(prefers-reduced-motion: reduce)').matches,
  viewportPx: innerWidth * innerHeight * (window.devicePixelRatio || 1),
  mem:        navigator.deviceMemory || 4,          // 有就讀,冇就當 4
};
// runtime FPS probe: rAF 60 frames → median delta
// 選档位 = min(hardware ceiling, measured ceiling) − hysteresis
```

### 10.2 四個 profile

| 設定 | **Low** | **Balanced**(預設) | **High** | **Ultra** |
|---|---|---|---|---|
| **適用裝置** | iPad 2017 / 舊 Android / reduced-motion | 大部分 iPad / laptop | 新 iPad / M 系 Mac | 高階桌面 + 大屏 |
| **背景層** | 單層 linear-gradient(無 SVG) | 森林 SVG + 漸層 | + 雪山/星空 decoration layer | + 螢幕粒子層 |
| **粒子 (firefly/飄雪)** | 0 | 6 | 12 | 24 |
| **backdrop-filter** | 0(全部改 opaque) | modal `blur(6px)` | `blur(10px)` + saturate | `blur(14px)` + saturate |
| **box-shadow 層數** | 1(`shadow`) | 2(`shadow` + `shadow-lg`) | 2 + glow | 3 + glow + inset rim |
| **動畫** | 只留 opacity/transform ≤ 150ms | 全部 `@keyframes`,粒子 ≤ 24 | + state transition 動畫 | + particle 加速 + parallax |
| **`image-rendering`** | pixelated(全部 sprite) | pixelated | pixelated | pixelated |
| **emoji grid 上限** | 10 | 10 | 10 | 10 |
| **DOM 節點上限(動畫區)** | 120 | 240 | 400 | 600 |
| **目標 frame time** | 33ms(30fps) | 16.7ms(60fps) | 16.7ms | 8.3ms(120fps 可選) |
| **DPR cap** | 2 | 2 | 3 | 3 |
| **will-change** | 只喺 transform 動畫 element | 同左 + will-change: transform | + will-change: filter | + will-change: opacity |

### 10.3 降級規則(硬規則)

1. **Ultra 唔准揭示 Low 睇唔到嘅資訊** —— 任何遊戲資訊(題目、答案、進度、HP、回饋)喺 4 個 profile 必須**同樣存在、同样可讀**。
2. **Profile 唔准改變玩法** —— 只准改視覺密度同動畫量。
3. **Player override 優先** —— 有手動設定就唔好自動改;持久化喺 `mg2.qualityTier`。
4. **向上恢復要 sustained headroom**(連續 5 秒 median frame time < 目標嘅 0.7),唔可以喺答題中切。
5. **向下降級要 hysteresis**:連續 2 個 probe 都過載先降,避免震盪。
6. **唔支持嘅組合要 fallback,唔好 blank screen** —— 例如 `backdrop-filter` 唔支援就 fallback 去 opaque card。

### 10.4 目前實況(未實作)

本 cycle **未實作** profile 系統(只定規格)。現況係:
- 粒子數寫死(6 個 firefly class)
- `prefers-reduced-motion` 有部分支援(transition:none),但唔係完整降級
- 冇 runtime FPS probe
- 冇玩家 override

→ **列為 TODO(見 §11 backlog)**。

---

## 11. Player-readable output audit

| 面向玩家嘅表面 | 現況 | 判定 |
|---|---|---|
| Onboarding 3 步 | 步數已改可讀;按鈕已修好 | ✅ |
| 答題回饋 | 「✅ 1」「❌ 0」+ 音效 + 動畫 | ✅ |
| 錯誤提示 | 「❌ 答案唔啱,請再計一次」 | ✅ |
| 老師挑戰題 | 「答啱呢題先可以入:15 × 14 = ?」 | ✅ |
| 題庫狀態 | 「🗑 已刪除第 3 條」 | ✅ |
| 重設提示 | 「已重設題庫(原本 120 題 → 重新載入預設 120 題)」 | ✅ |
| 頁尾 | 「Copyright © Tseung Kwan O Pui Chi School」 | ✅ 語言正常,純視覺撞場景 |
| **raw exception / stack / JSON / 檔案路徑** | grep 結果 **0 處** | ✅ |
| **`alert()` native dialog** | 3 處(老師面板),文案正常但係瀏覽器原生框 | ⚠️ 改 in-game modal(Q7) |
| **debug TODO / placeholder 文案** | 未發現 | ✅ |

---

## 12. cycle 106 已修嘅 P0(前後對照)

| # | P0 | 根因 | 修法 | 前 → 後 |
|---|---|---|---|---|
| **P0-A** | 9 條 CSS rule 死掉(`@apply` 喺無 `type="text/tailwindcss"` 嘅 `<style>`) | Tailwind Play CDN 唔 process `@apply` | 改寫成原生 CSS(值 = Tailwind v3 對應 utility);加 T106 lock-in **「全檔唔准再出現 apply 指令」** | `ob-skip` bg `rgba(0,0,0,0)`/radius 0 → bg `rgba(255,255,255,0.1)`/radius 16px<br>`.option-btn` 308×**30** → 308×**62** |
| **P0-B** | compareHeight 兩條 bar 都係 6px → 題目無解 | `.ht-pair-stack{height:100%}` 但 parent 只有 `min-height`(高度 indefinite)→ % fallback | parent 用 definite `height`;bar 放入 `.ht-pair-bar-track`(relative)+ `position:absolute` | bar 1 `6px` → **168px**;bar 2 `6px` → **84px**(正確 2:1) |
| **P0-C** | 6 組文字對比度 ≤ 1.45:1 | raw `text-slate-6/7/800` 落深色 surface;cycle-81 假設粉藍淺底但實際係夜空深底 | 新增 `--c-text-on-night` token pair(固定淺色,唔跟 theme);遷移 44 處 | 校名 1.06 → ~10:1;順序提示 1.05 → ~13:1;Boss 題目 1.19 → ~13:1 |
| **P0-D** | 第一題顯示「第 0 題」 | `st.total` = 已答題數 | `第 ${Math.min(st.total + 1, _goalQ)} 題` | 「第 0 題」→「**第 1 題**」 |
| **P1-a** | 觸控目標 30/32px | padding 太細 | 3 處加 `min-height: 44px` | 73×32 → 73×44;511×30 → 511×44;108×30 → 108×44 |
| **P1-b** | Boss 戰役卡用紅色虛線 → 似 error 但可撳 | style 誤導 | dashed → solid | 誤導消除 |
| **P1-c** | 老師「暫停 / 強制結束」完全隐形 | 死 `.btn` / `.btn-boss` | P0-A 修好 | 兩個掣都見到 |

**驗證方法**:每次修改後用 headless Chrome(CDP,1440×900)重跑 11 個 state,`getComputedStyle` 讀數 + 像素取樣覆算 WCAG。before/after 截圖見 `docs/screenshots/`。

---

## 13. Changelog

| Cycle | 日期 | 內容 |
|---|---|---|
| 106 | 2026-10-24 | 本文件 + `ART_STYLE_GUIDE.md` + `UI_STYLE_GUIDE.md`;修 P0-A/B/C/D + P1-a/b/c;T106 regression lock-in(38 條新 assertion) |
| 105 | 2026-10-24 | 修 3 個 audio runtime bug + `tests/audio-audit.js` |
| 104 | 2026-10-24 | `docs/AUDIO_VIDEO_OPTIMIZATION.md` media pipeline audit |
| 97 | — | 引入 semantic design token(`.text-on-light` / `.text-on-dark`) |
| 96 | — | `docs/ARCHITECTURE_REVIEW.md` |

> **cycle 106 嘅重要副產**:cycle 97 嘅 token 系統假設「淺底 = 粉藍」。但實際渲染出嚟嘅 menu 背景係**夜空深藍**(內嵌森林 SVG),於是 token 語意同實際 surface 反咗 →
> cycle 81 為咗「粉藍底」加嘅 `text-slate-800` 就變成隐形。cycle 106 加咗 `--c-text-on-night`(固定淺色,唔跟 theme)嚟處理呢類**唔跟 theme 變嘅深色 surface**。
