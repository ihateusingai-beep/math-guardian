# Math Guardian v3.6 — 遊戲 UI Style Guide

> **cycle 106 · 2026-10-24 · 狀態:已 ship**
> 本指南定義 Math Guardian 所有 **遊戲 UI**(選單 / HUD / 掣 / modal / 卡片 / 提示)嘅呈現規則。
> 美術規則喺 [`ART_STYLE_GUIDE.md`](ART_STYLE_GUIDE.md);評分標準喺 [`VISUAL_QUALITY_RUBRIC.md`](VISUAL_QUALITY_RUBRIC.md)。

---

## 0. 一句話原則

> **畫面上任何一個學生要讀嘅嘢,都要喺 1 秒內認得出。**
> 呢句嘢唔係 aspiration,係**驗收條件** —— 對比度 < 4.5:1 嘅嘢一律當 bug 修。

---

## 1. Menu composition(選單構圖)

### 1.1 標準結構

```
┌─ Header(場景上,唔喺 card 入面)─────────────────────┐
│  [校徽]  將軍澳培智學校            🎵 BGM           │  ← on-night text
│  [怪獸][城堡] sprite                                │
│  數學合作學習遊戲   ← H1,漸層,唯一焦點              │
│  v3.6 · 課堂練習 · 雙隊 · Boss                      │
└──────────────────────────────────────────────────────┘
┌─ 揀模式 card ────────────────────────────────────────┐
│  [🌼 課堂練習]  [⚔️ Boss 戰役]                        │  ← radiogroup,2 欄
│  課堂：①玩法 → ②身份 → ③題目 → 睇摘要 → 一鍵開始。    │  ← on-night-muted
└──────────────────────────────────────────────────────┘
┌─ ① 點樣玩 ─────────┐  ┌─ ② 身份卡(可選) ─────────┐
┌─ ③ 題目範疇(可多選)┐  ┌─ ④ 一鍵開始 CTA ─────────┐
```

### 1.2 規則

| # | 規則 |
|---|---|
| M1 | Header 文字直接落場景上 → 一律用 `.text-on-night` / `.text-on-night-muted` |
| M2 | 每個 section = 一個 `.menu-section-card`,**唔好**疊卡片 |
| M3 | 選項永遠成對(2 欄 radiogroup),唔好單欄落長列表 |
| M4 | 「一鍵開始」CTA 應該係畫面唯一嘅紫漸層 CTA —— **唔准有第二個** |
| M5 | 說明行(`.menu-section-sub`)喺 light card 上用 `--c-text-primary`;喺深色 card 上用 on-night |
| M6 | Header 高度 ≤ 200px,唔好食晒第一屏 |
| M7 | 桌面(≥1280)內容欄闊度 900–980px(唔係 580px) |
| M8 | 每個 section 標題用 `①②③④` 序號,同說明行嘅步驟一致 |

### 1.3 禁止事項

- ❌ **重複 CTA**:唔准同時有 sticky 小 CTA + 大 CTA 做同一件事
- ❌ **Sticky CTA 覆蓋內容**:sticky element 唔可以壓住任何可互動 element
- ❌ **Dismissed 錯誤感**:可撳嘅選項唔可以用虛線框 / 紅色 / ❌ 呢類「錯誤」符號
- ❌ **Generic dashboard card**:老師 / 學生介面唔可以淨係用灰白卡片堆

---

## 2. HUD information priority(HUD 資訊優先級)

### 2.1 优先级表(上 → 下,左 → 右)

| 優先級 | 元素 | 單人 | 雙隊 |
|---|---|---|---|
| **P0** | 題目 / 題型 prompt | 上方中央,最大字 | 左右兩邊各一個 |
| **P0** | 答案 / 操作區 | 中間 | 中間(各自隊伍) |
| **P1** | 進度(鋪路 N/10、比分) | 頂部 bar + 文字 | 頂部 + 中間比分 |
| **P1** | 對錯計數 ✅/❌ | 右上 | 每邊右上 |
| **P2** | 題號「第 N 題」 | 右上 | 每邊右上 |
| **P2** | TTS 朗讀掣 | 右上 | 每邊右上 |
| **P3** | BGM / 音效 / 返回 | 頂部邊緣 | 頂部邊緣 |
| **P3** | 隊伍身份 / avatar | 頂部左右 | 頂部左右 |

### 2.2 規則

| # | 規則 |
|---|---|
| H1 | **任何時候唔准有兩個 P0 焦點喺同一個 viewport**(雙隊時兩個隊各一個,靠 team color 分) |
| H2 | 進度一定要有**文字**(「鋪路 3/10 (30%)」),唔可以淨係一條色 bar |
| H3 | 對錯計數用 icon + 數字雙重編碼(✅ 1 / ❌ 0),唔淨係顏色 |
| H4 | P3 元素唔可以擋住 P0/P1;尺寸 ≤ 56px |
| H5 | HUD 佔畫面 ≤ 25%(見 rubric C3) |
| H6 | 隊伍色只用於隊伍 avatar / panel 邊 / 名稱,唔好污染其他元素 |

---

## 3. Typography(字體)

### 3.1 Scale

| 用途 | Size | Weight | Line-height |
|---|---|---|---|
| H1 遊戲標題 | `clamp(1.5rem, 4vw, 2.25rem)` | 800 | 1.2 |
| 題目(主) | `clamp(1.6rem, 4vw, 2.6rem)` | 800 | 1.2 |
| 題目(短,順序/比較) | `clamp(1.05rem, 3.2vw, 1.85rem)` | 800 | 1.25 |
| 答案鈣文字 | `1.5rem` / `2.25rem` | 700 | 2 |
| 卡片標題 | `1.125rem` | 700 | 1.75 |
| Body | `1rem` | 400 | 1.5 |
| 說明 / helper | `0.875rem` | 500 | 1.4 |
| 標籤 / chip | `0.72–0.78rem` | 800 | 1.25 |
| 徽章 label | `≥ 0.75rem` | 600 | 1.3 |

> **下限 0.72rem 只可以用喺「非必要資訊」(如 chip 文字)**。任何學生要讀嘅內容 ≥ 0.875rem。

### 3.2 字體家族

```css
font-family: 'Noto Sans TC', 'PingFang TC', system-ui, sans-serif;
```

> ⚠️ **已知限制**:本 project **冇 `@font-face`、冇 Google Fonts link** → 只靠裝置系統裝咗先有。學校 iPad 通常有 `PingFang TC` ✅,但 **web font 缺席 = 唔同裝置字距/字重唔一致**。
> **唔准喺本 cycle 加 web font**(會打破 0 media payload 原則同增加離線風險)→ 列為 TODO。

### 3.3 字體規則

| # | 規則 |
|---|---|
| T1 | 中文 **唔准**用 `letter-spacing` 拉開(會散)—— 只限數字 / 英文 |
| T2 | 繁體中文標點用全形,唔好用半形 |
| T3 | 唔好喺同一層級混用 3 種以上字重 |
| T4 | 漸層文字(`bg-clip-text`)只可以用喺 H1 一個地方 |
| T5 | 段落文字 `max-width: 60ch`,唔好拉成 1000px 闊 |

---

## 4. Spacing & layout(間距)

### 4.1 Spacing scale

只用呢 6 級:`0.15rem · 0.35rem · 0.55rem · 0.9rem · 1.25rem · 2rem`

| 場景 | 規則 |
|---|---|
| Card 內距 | 0.9rem(大)/ 0.55rem(細) |
| Grid gap | 0.9rem(選項)/ 0.35rem(chip) |
| Section 之間 | 1.25rem |
| 圖示 ↔ 文字 | 0.35rem |
| 觸控目標之間 | ≥ 0.55rem |

### 4.2 Grids

| 用途 | 欄數 | 斷點 |
|---|---|---|
| 選項 / 題型 | 2 | 恆定 |
| 範疇 chip | flex-wrap | — |
| 題目物件卡 | 2 | ≥ 480px,否則 1 |
| 雙隊 arena | 2 | `lg:`(1024px) |
| 老師 dashboard | 1(卡片式) | — |

### 4.3 圓角 / 陰影

| 元素 | Radius | Shadow |
|---|---|---|
| 主按鈕 / 答案鈣 | 1rem | `shadow-lg` |
| 細按鈕 | 0.75rem | `shadow` |
| Card | 1.25rem | `shadow-2xl` |
| Chip / badge | 9999px | none |
| Modal | 1rem–1.5rem | `shadow-2xl` |

> **同一語義唔准有兩個 radius**(之前 `.btn` 16px vs `.option-btn` 0px 就係呢類問題)。

---

## 5. Icon language(圖示語言)

| 用途 | 用咩 | 例子 |
|---|---|---|
| UI chrome(鈿、狀態、導航) | **inline SVG symbol** | `px-sound-on`、`px-meteor`、`px-target`、`px-castle` |
| 角色 / 怪物 / 道具 | **inline SVG pixel sprite** | `px-knight`、`px-troll`、`px-charch` |
| **題目內容物**(數量、物件) | **emoji** | 🍉 🍌 🥛 🧃 ⚖️ ⏰ 🔺 |
| 隊伍標識 | SVG + team color | `px-knight` / `px-mage` |

| # | 規則 |
|---|---|
| I1 | **emoji 唔可以做 UI chrome** —— 裝置冇 emoji font 就會變 monochrome fallback |
| I2 | 一個 icon-only 掣一定要有 `aria-label` |
| I3 | icon 尺寸級距:16 / 24 / 42(`.icon-mini` / `.icon-md` / 角色) |
| I4 | emoji 題目物件嘅視覺高度 ≈ 角色頭 × 1.2 |
| I5 | 同一概念(例如「返回」)全 app 用同一個 glyph |

---

## 6. Semantic colors(語意色)

### 6.1 Token 表(cycle 106 更新)

```css
:root {
  /* 跟 theme 翻轉 —— 用喺「跟 theme 變嘅 card」 */
  --c-text-on-light:        #1e293b;            /* 粉藍場景:暗 text 喺淺 card */
  --c-text-on-light-muted:  #475569;
  --c-text-on-dark:         #f0f9ff;            /* 粉藍場景:淺 text 喺暗 card */
  --c-text-on-dark-muted:   rgba(240,249,255,0.7);
  --c-bg-card-light:        #ffffff;
  --c-bg-card-light-translucent: rgba(255,255,255,0.55);
  --c-bg-card-dark:         #1e293b;
  --c-bg-card-dark-translucent:  rgba(15,23,42,0.55);
  --c-border-light:         rgba(30,41,59,0.18);
  --c-border-dark:          rgba(255,255,255,0.18);

  /* 唔跟 theme 翻轉 —— 用喺「夜晚場景 / 固定深色 surface」 */
  --c-text-on-night:        #e2e8f0;            /* cycle106 新增 */
  --c-text-on-night-muted:  rgba(226,232,240,0.75);
}
```

### 6.2 邊度先會出現邊隻 token

| Surface 類型 | 例子 | 用邊個 text token |
|---|---|---|
| **淺色 card**(跟 theme) | `.menu-section-card`(粉藍場景) | `--c-text-on-light` |
| **深色 card**(跟 theme) | `.menu-section-card`(snow 場景) | `--c-text-on-dark` |
| **夜晚場景**(唔跟 theme) | menu header、主選單說明行 | `--c-text-on-night` |
| **固定深色 surface**(唔跟 theme) | `bg-slate-800/900` modal、對戰 panel、`.sen-panel` | `--c-text-on-night` |
| **粉藍場景頁尾 / 說明行** | `.menu-section-sub` | `--c-text-primary` |

> ⚠️ **cycle 106 嘅重要發現**:cycle 81 假設 menu 背景係粉藍淺色,所以用咗 `text-slate-800`。但實際渲染出嚟嘅 menu 背景係**夜空深藍**(內嵌森林 SVG)→ 對比度得 **1.06:1**,完全隐形。
> **新規則(見 §6.3)**:判斷用邊個 token,**睇實際背景,唔睇 theme 名**。

### 6.3 硬性規則

| # | 規則 |
|---|---|
| SC1 | **唔准用 raw `text-slate-600/700/800`、`text-amber-700`** 落深色 surface |
| SC2 | 深色 surface 一律 `--c-text-on-night` |
| SC3 | 選中態語意色**只有一個**(建議 `--c-accent-cyan`)。唔准同一個語義用 3 種色 |
| SC4 | 錯誤 = `#f87171` + **icon + 文字**;唔可以淨係顏色 |
| SC5 | 成功 = `#4ade80` + icon + 文字 |
| SC6 | 資訊 / 中性 = `#93c5fd` |
| SC7 | 獎勵 / 金 = `#fbbf24` |
| SC8 | 隊伍色:`--c-knight` #3b82f6 / `--c-mage` #a855f7 / `--c-boss` #dc2626 |

### 6.4 對比度下限

| 內容 | 下限 |
|---|---|
| 正文 / 標籤 | **4.5 : 1** |
| 大字(≥ 24px 或 ≥ 19px bold) | 3 : 1 |
| 非文字 UI 元件(邊框、icon) | 3 : 1 |
| focus ring 對相鄰色 | 3 : 1 |

---

## 7. Cards & grids(卡片與格線)

| # | 規則 |
|---|---|
| G1 | 一層只准有一種透明度嘅 card(唔好 `bg-white/5` card 上面再放 `bg-white/5` card)→ 會出現**文字鬼影** |
| G2 | 卡片要有 `border`(唔好淨靠背景色分隔) |
| G3 | 卡片內容垂直 padding 唔少過水平 padding 嘅 60% |
| G4 | 選項卡固定高度,答案鈣高度一致(唔好有啲 40px 有啲 90px) |
| G5 | Grid 最後一行唔好孤零零一個卡(用 `auto-fit` + `minmax`) |

---

## 8. Buttons & states(按鈕與狀態)

### 8.1 尺寸

| 類型 | Min 尺寸 | 實際 |
|---|---|---|
| 主 CTA | 56 × 56 | 56px 高,內容居中 |
| 一般掣 | 56 × 56 | `.btn` min-height/width 56px |
| 細掣 | 44 × 44 | `.btn-sm` min-height/width 44px |
| Chip | 44 高(觸控) | `.opt-scope-preset` / `.rec-chip` min-height 44px |
| 身份卡 toggle | 44 高 | `.identity-toggle` min-height 44px |
| Icon-only 掣 | 56 × 56 | 頂部 BGM / 音效 / 老師掣 |

> **觸控目標下限 44 × 44 px**(project 自身 spec:`.harness/reins/sen-a11y-reviewer/agent.md`)。
> **cycle 106 前**:`.option-btn` 實測 308×**30**、範疇 chip 73×**32**、身份卡 toggle 511×**30**、rec-chip 108×**30** → 全部已修。

### 8.2 九個狀態(每個互動掣都要有)

| 狀態 | 視覺 | 實作 |
|---|---|---|
| **idle** | 底色 + 圓角 + 陰影 | base |
| **hover** | 底色變亮 15% | `:hover` |
| **focus-visible** | 3px 外框,對比 ≥ 3:1 | `:focus-visible { outline: 3px solid var(--c-accent-cyan); outline-offset: 3px; }` ← **待補(H4)** |
| **pressed** | `scale(0.95)` | `:active` ✅ |
| **disabled** | `opacity: 0.45` + `cursor: not-allowed` | ✅ |
| **selected** | 單一 accent 色 + 實心邊框 + `aria-pressed="true"` | ✅(但語意色未收斂,SC3) |
| **busy / loading** | spinner + `aria-busy="true"` | ❌ **未做** |
| **error** | 紅色 + icon + 文字 | 部分(答案鈣 ✅ / 掣 ❌) |
| **cooldown** | 進度環 / 倒數文字 + 不可撳 | ❌ **未做**(大絕有近似) |

### 8.3 掣嘅樣式家族

| class | 用途 | 樣式 |
|---|---|---|
| `.btn` | base(尺寸/圓角/陰影/transition) | — |
| `.btn-knight` | 主要行動 | 藍紫漸層 + 白字 |
| `.btn-mage` | 次要行動 | 紫粉漸層 + 白字 |
| `.btn-boss` | 危險 / 停止 | 紅玫瑰漸層 + 白字 |
| `.btn-ghost` | 次要 / 背景操作 | 白 10% 底 + 白邊 + 白字,hover 白 25% |
| `.btn-sm` | 細粒度 | 0.75rem radius + 44px |
| `.option-btn` | 答案鈣 | 白 92% 底 + 1rem radius + 1.5rem 字 |

> ⚠️ **cycle 106 之前**:以上 7 條全部靠 `@apply`,而 `<style>` 冇 `type="text/tailwindcss"` → Tailwind Play CDN **唔會 process** → **全部死掉**(冇底色/冇圓角/冇內距/冇漸層)。
> 已改寫成原生 CSS(數值 = Tailwind v3 對應 utility),並加 lock-in「**全檔唔准再出現 apply 指令**」。

---

## 9. Focus indicators(焦點指示)

| # | 規則 |
|---|---|
| F1 | 唔可以 `outline: none` 而冇替代 |
| F2 | focus ring 用 `outline`(唔用 `box-shadow`,避免同 hover 陰影撞) |
| F3 | focus ring 顏色 = `--c-accent-cyan`,offset 3px,寬 3px |
| F4 | focus ring 要對**相鄰背景**有 ≥ 3:1 |
| F5 | keyboard focus 順序跟 DOM 順序,唔好用 `tabindex` 亂調 |
| F6 | modal 開啟時 focus 移入 modal,Esc 關閉(teacher modal 已有 ✅) |

> ⚠️ 現況:只有 `.ht-pair-hit:focus-visible` 有 ring。**其餘全部掣未補**(H4)。

---

## 10. Input glyphs(輸入符號)

| 動作 | Glyph | 規則 |
|---|---|---|
| 返回 / 上一頁 | `⬅` / `←` | 全 app 一致 |
| 下一頁 / 繼續 | `→` / `下一步 →` | — |
| 重來 | `🔁` | — |
| 朗讀 | `🔊` | icon-only 時一定要 `aria-label` |
| 設定 | `⚙️` | — |
| 刪除 | `❌` | 唔好用喺「不可用」狀態(會誤導成 error) |
| 正確 / 錯誤 | `✅` / `❌` | **答案回饋專用**,唔好喺其他地方重用 |

> **注意**:`❌` 之前被用作 Boss 戰役卡嘅「鎖住」標記 → 已移除(見 §1.3)。

---

## 11. Transition timing(轉場時間)

見 [`ART_STYLE_GUIDE.md` §6.3](ART_STYLE_GUIDE.md#63-timing-table統一 timing token)。UI 層摘要:

| 事件 | Duration |
|---|---|
| 按鈕 pressed | 90ms |
| Modal 入 | 180ms |
| 答題切換 | 220ms |
| 卡片 hover | 150ms |

**規則**:同一語意用同一 duration;唔准有 > 400ms 嘅 UI 轉場(學生會等唔切)。

---

## 12. Visual + audio feedback(視覺 + 聲音回饋)

| 事件 | 視覺 | 聲音 | 觸覺 |
|---|---|---|---|
| 撳答案 | pressed scale | tick | — |
| 答對 | ✅ flash + 綠邊 + 進度 +1 | `Audio.correct()` | — |
| 答錯 | ❌ flash + 紅邊 | `Audio.wrong()` | — |
| 進度 | 新 plank 出現 | `Audio.tick()` | — |
| 大絕就緒 | 鈣發光 | `Audio.beep()` | — |
| 朗讀 | 掣 pulse | TTS | — |

**規則**
- 聲音同動畫**同一幀起點**
- **唔准**淨用顏色(要 icon + 文字)
- 每個 sound event 要有對應 `Audio.*` export(cycle 105 `tests/audio-audit.js` 長期 cross-check)

### 12.1 SEN 畫面嘅逐個選項反饋(cycle 111f)

上表嘅「✅ flash + 綠邊 / ❌ flash + 紅邊」原本**只喺經典畫面**落地
(`.option-btn.correct/.wrong` + `::before` ✓/✗)。**SEN 畫面(目標學生行嘅路徑)一直冇** ——
學生只見到全屏 overlay,睇唔出邊個答啱。cycle 111f 補返:

| 事件 | SEN 畫面 |
|---|---|
| 答對 | 被撳嗰個掣 → 綠底 `#dcfce7` + 綠邊 + ✓ badge + squash&stretch pop + 慶祝粒子 |
| 答錯 | 被撳嗰個掣 → **藍灰** `#e2e8f0` + 灰邊 + ✕ badge + 輕微左右搖;**同時揭示正確選項**(綠邊 + ✓) |
| 判定文字 | panel 頂部 **verdict band**(✅ 正！/ 💙 再試！)+ 提示,**唔置中** |

**SEN 安全上限**(中度智障學生對晃動 / 停頓 / 刺眼紅敏感):
- 答錯用**藍灰**,**唔准**用刺眼紅
- **唔做** screen shake / hit-stop / 全屏閃白
- pop / 搖只喺**被撫嗰個**掣,唔係全屏
- 一定要返原狀(squash 完必須 spring 返 `scale(1)`)
- 沿用 project 既有 `prefers-reduced-motion` 模式(CSS + JS 兩層)

**硬性規則(P0,cycle 111f 實測教訓)**

> **反饋層唔可以遮住學習訊號層。**

舊版 SEN feedback 係全屏 overlay **置中**放一個 5.5rem 大字「✅ 正！/💙 再試！」。
實測(639×669 學校 iPad):stamp 文字 397×92px @ y289–380,選項掣 @ y274–384
→ **重疊 352×91 = 32,032 px²** —— 答錯嗰陣,被揭示嘅正確答案完全被大字蓋死,
即係「最需要教學嗰一刻」睇唔到(實機截圖實證)。
而且 0.5 alpha 嘅全屏底會食掉逐個選項嘅狀態色,令新加嘅 `.is-correct` / `.is-wrong` 訊號失效。

而家改成三層:

| 層 | 元素 | 職責 |
|---|---|---|
| ① 弱 | `.sen-fb-wash` 全屏淡色 | 0.45 → 0.12 淡出,**唔食掉狀態色** |
| ② 中 | `.sen-fb-band` 頂部 verdict band | 判定文字 + 提示;疊喺 `position:absolute` 嘅 `.sen-panel-head` 帶上 → **零 layout shift**;**永不覆蓋選項掣 / Stage 進度格** |
| ③ 強 | `.is-correct` / `.is-wrong` 逐個選項 | **主要學習訊號** |

→ band 同任何一個選項掣嘅重疊必須係 **0**,由
`tests/visual/scenarios/sen-answer-feedback.mjs` 喺 639×669 實機幾何量度守門。

---

## 13. Safe area & responsive(安全區與響應式)

| 斷點 | Layout |
|---|---|
| `< 640px` | 單欄;選項 1 欄;Header 精簡(校名縮細) |
| `640–1023px` | 單欄;選項 2 欄 |
| `≥ 1024px` | 雙隊 arena 分左右;內容欄 900–980px |
| `≥ 1280px` | 內容欄 900–980px,**背景場景填滿 viewport** |

| # | 規則 |
|---|---|
| R1 | iOS notch / home indicator:固定元素用 `env(safe-area-inset-*)` |
| R2 | 固定掣(右下 CTA)要喺 safe area 之外 |
| R3 | 唔准有水平捲動(`overflow-x: hidden` 已有) |
| R4 | 文字容器用 `min-width: 0` + `overflow-wrap: anywhere`,唔准撐爆 grid |
| R5 | 旋轉螢幕後 layout 要重新計算(未驗證 → §14) |

> ⚠️ **cycle 106 實測**:內建 browser panel 嘅 CSS viewport 只有 **639 × 669**(DPR 2)。喺呢個闊度,主選單嘅 sticky CTA **覆蓋住「👥 左右雙隊」按鈕**(floating CTA `x 520–623 / y 515–565` vs 該鈕 `x 326–576 / y 509–585`)。
> → **未修,列為 Q5/H1**(移除重複 CTA)。

---

## 14. Accessibility(無障礙)

| # | 規則 |
|---|---|
| A1 | 所有互動 element 有 `aria-label` 或可讀文字 |
| A2 | radiogroup 用 `aria-pressed` / `role="radio" + aria-checked` |
| A3 | 進度條用 `role="progressbar"` + `aria-valuenow` / `aria-valuetext` |
| A4 | 動態區用 `aria-live="polite"` |
| A5 | 支援 `prefers-reduced-motion`(部分) |
| A6 | 觸控目標 ≥ 44×44 |
| A7 | 文字對比度 ≥ 4.5:1 |
| A8 | 唔可以只靠顏色傳達資訊 |
| A9 | Modal 要 focus trap + Esc 關閉(teacher modal ✅) |
| A10 | 學生介面**唔准**出現「SEN」標籤(見 AGENTS.md) |

### 14.1 已知未驗證項

| 項目 | 狀態 |
|---|---|
| `prefers-reduced-motion` 完整降級 | 部分(transition:none),未做 profile 式降級 |
| axe-core 掃描 | 未跑(cycle 106 用咗像素 + computed style 量測代替) |
| 鍵盤全流程 | 未驗 |
| 螢幕閱讀器 | 未驗 |
| 旋轉 / resize | 未驗 |

---

## 15. 絕對唔可以咁樣(反例)

> 每條都對應一個真實觀察到嘅缺陷。

| ❌ 反例 | 為何唔可以 | 真實證據 |
|---|---|---|
| Onboarding 有一個 modal 但**完全冇撳得到嘅掣** | 學生喺第一個畫面就死路 | `before-03-onboarding.jpg` |
| 答案鈣係**冇圓角、冇內距、30px 高嘅白方塊** | 唔似掣、觸控目標細過 44px | `before-07-boss-gameplay.jpg` |
| 題目文字喺深藍 panel 上係**同一個深藍色** | 學生睇唔到題目 | 實測對比度 **1.19:1** |
| 序列提示「13 · 15」**肉眼完全睇唔到** | 題目無解 | 實測對比度 **1.05:1** |
| 校名喺夜空上係**深藍字** | 第一眼 impression 就崩 | 實測對比度 **1.06:1** |
| 老師面板嘅「⏸ 暫停」「🏁 強制結束」**隐形** | 老師唔能夠控制遊戲 | `before-09-teacher-dashboard.jpg` |
| 「邊個高？」兩條 bar **一樣高** | 題目冇答案 | 實測兩條都 6px |
| 第一題顯示「**第 0 題**」 | 學生以為答錯咗 | 實測「第 0 題」 |
| 同一個畫面兩個「**開始**」掣 | 焦點競爭 + 一個被另一個蓋住 | S1 |
| Boss 戰役卡用**紅色虛線 + ❌** 但其實可以撳 | 誤導成 error / disabled | `before-01-home-menu-1440.jpg` |
| 角色 sprite **壓住答案鈣** | 遮住可讀內容 | `after-07-boss-gameplay.jpg` |
| 頁尾係**淺灰 band** 撞住夜晚場景 | 破壞世界觀 | `before-10-end-screen.jpg` |
| 老師 dashboard 係**灰白 generic 卡片堆** | 唔似遊戲世界嘅一部分 | `before-09-teacher-dashboard.jpg` |
| 用 emoji 做 **UI chrome**(⚔️ 大絕、模式鈣) | 冇 emoji font 就變 monochrome | `before-07-boss-gameplay.jpg` 右上 |
| 用 native `alert()` 做確認 | 跳出遊戲世界 | 3 處 |

---

## 16. 評分(用同一個 rubric)

> 詳見 [`VISUAL_QUALITY_RUBRIC.md` §6](VISUAL_QUALITY_RUBRIC.md#6-現況評分逐-category)。

| Category | Weight | **Current** | R-EDU reference | Gap | 主要原因 |
|---|---|---|---|---|---|
| C1 可讀性與對比度 | 18 | **7** | 9 | 2 | 頁尾 band、Boss 名仲有 raw 暗色 |
| C2 遊戲狀態可辨識度 | 11 | **7** | 9 | 2 | 缺「等候中」細節 |
| C8 UI 層級與按鈕狀態 | 11 | **6** | 9 | 3 | 缺 focus / busy / cooldown 態 |
| C9 觸控目標與輸入 | 7 | **8** | 9 | 1 | 少量細粒度掣未覆蓋 |
| C10 回饋與狀態轉換 | 7 | **7** | 8 | 1 | 答題切換冇動畫 |
| **UI 加權小計** | **54** | **7.1** | **8.8** | **1.7** | — |

**UI gap 對總分嘅貢獻**:UI 相關 category(C1+C2+C8+C9+C10)佔總權重 **54%**,而佢哋嘅加權差距約 **1.7 分** → 即係總分 6.3 入面,大約 **0.9 分**係由 UI 層嘅差距貢獻。
**結論**:UI 係**最高槓桿**嘅改善方向,遠高過加更多 sprite。

---

## 17. Changelog

| Cycle | 日期 | 內容 |
|---|---|---|
| 106 | 2026-10-24 | 本文件建立;新增 `--c-text-on-night` token pair、§6.2 surface→token 對照表、§8.2 九態清單、§15 反例清單;記錄 44px 觸控下限、9 態、focus ring 規格、safe-area 規則 |
| 111f | 2026-10-28 | 新增 **§12.1 SEN 畫面嘅逐個選項反饋** —— §12 原本只落地喺經典畫面,SEN 畫面(目標學生行嘅路徑)冇;補上逐個選項嘅 ✓/✕ badge + 狀態色 + pop/搖 + 揭示正確答案。並記錄 **P0 硬性規則「反饋層唔可以遮住學習訊號層」**(實測 639×669 重疊 32,032 px² → 三層重構:淡色 wash / 頂部 verdict band / 逐個選項反饋)與 **SEN 安全上限**(藍灰非紅 · 唔做 shake / hit-stop · pop 只喺被撳嗰個掣) |
