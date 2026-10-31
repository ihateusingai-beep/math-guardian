# Math Guardian v3.6 — 資產 + 動畫檢視與改善計劃

> **cycle 111e 起嘅 backlog 根據** · 2026-10-31 · 數據全部由 `tools/asset-inventory.cjs` 量出嚟（可重跑）
>
> **上游**：`docs/VISUAL_QUALITY_RUBRIC.md`（12 category 評分 + §9 優先改善計劃）·
> `docs/ART_STYLE_GUIDE.md`（美術規則）· `docs/GAMEPLAY_ASSET_PROPOSAL.md` §4（資產清單）

---

## 0. TL;DR

**一句話**：Rubric 最大 gap 係「跨層一致性 -4」，而家**唔係技術問題，係素材語言未收斂**。
今輪量完，發現三件事 ——

1. **66% 嘅 sprite 離色板**（35/53 · 38.8 KB），但**重新上色成本極低**（72 個 hex，69 個可自動映射，**零幾何改動**，唔使 artist）→ **最高 ROI，約 45 分鐘**
2. **emoji-as-chrome 仲剩 36 個掣 / 23 種 emoji**（cycle111d 換咗 18 個之後）→ C4 由 5 分升 8 分嘅條件就係「icon 全部 inline SVG」
3. **動畫有 3 個互動時刻完全冇回應**（進度格填滿 / 關卡切換 / hint 提示）+ **3 個死 keyframes**，其中 `meter-pixel` 正好就係「進度條改 pixel tile」嘅化石 —— 同一件事可以一次過滿足兩個約束

⚠️ **但呢份計劃全部都係 pre-field-data**。記憶規則：連續 2 個 routing-layer change 60 小時內 ship 而冇 field data → 要 pause 2–3 日。cycle111j/111c/111n/111d 四個 cycle 都仲未試教過 —— **建議 P0 做完就安排一次真實課堂觀察**，之後先做 P1。

---

## 1. 點量（可重跑）

```bash
node tools/asset-inventory.cjs          # 人讀報告
node tools/asset-inventory.cjs --json   # 機器讀（將來做 gate 用）
```

> ⚠️ 呢個工具入咗 repo（唔係 /tmp）—— 呢個 repo 嘅教訓（cycle110b / 111e）：驗證工具擺 /tmp = 換部機就冇晒防線。
> 守門仍然係 `tests/asset-audit.js`（8 組 check + cycle111d C9 色板）；呢個工具只做**盤點**。

---

## 2. 資產現況

```
【A】SPRITE
  總數              53
  離 §4 色板        35 隻 / 38811 B
  冇任何引用        0 隻（冇死 symbol ✅）
  只出現 ≤1 次      26 隻（全部係動態引用：badge / pkg / boss / shape / 守護者）

顯示尺寸            100% 係 viewBox 嘅整數倍 ✅（像素邊乾淨）
viewBox 分佈        16×16 × 40 · 64×64 × 9 · 32×48 × 3 · 64×96 × 1
```

### 發現 A1 —— 66% sprite 離色板，但「重新上色」唔係「重畫」

`docs/ART_STYLE_GUIDE.md` §4.1 訂明「全部 sprite 只用呢 12 個色」（+ §4.2 材質 ramp = 29 色）。
實測 **35 / 53 隻（38,811 B）用咗 Tailwind ramp 而唔係 §4 色板**。

**關鍵**：呢個唔係「要 artist 重畫」嘅問題（rubric §9.3 P1 唔適用）——
**只係換 hex，幾何一個都唔郁**。逐個 sprite 量過離色板 hex 種類：

| sprite | bytes | 離色 hex 數 | 可否自動映射 |
|---|---|---|---|
| pkg-orange-2l | 1,291 | 10 | ✅ 全自動 |
| px-troll | 1,942 | 7 | ⚠️ 1 個要人手揀（綠） |
| px-char-knight / px-char-mage | 2,600 / 2,078 | 7 / 7 | ✅ 全自動 |
| px-frost / px-lava / px-shadow / px-crystal | 1.6–2.1 KB | 3–5 | ✅ 全自動 |
| pkg-* 其餘 8 隻 | ~1.1 KB each | 4–7 | 6 隻自動 / 2 隻各差 1 個綠色 |
| bg-tree / bg-tree-small | 1,386 / 545 | 6 / 4 | ✅ 全自動 |
| 其餘 20 隻（badge / shape / trophy / abacus / sound / clock …） | 259–1,044 | 1–3 | ✅ 全自動 |

**總計 72 種離色板 hex → 69 種可自動映射到 §4 色板，剩 3 種要人手揀（全部係綠色系）。**
31 / 35 隻 sprite 可以**純自動**重新上色。

**影響**：Rubric **C4 跨層視覺一致性（權重 9）** 而家得 4 分（vs R-PIX 8，差距 -4，全項目最大）。
C4 由 5 分升 8 分嘅條件之一就係「全部素材同一 pixel grid / icon 全部 inline SVG」——
**色板收斂係嗰個條件嘅一半**（另一半係 emoji sweep，見 A3）。

⚠️ **風險**：自動映射係「最接近色」而唔係「美術正確」→ **換完一定要真機睇一眼**
（boss 面板 / 9 個 L 項包裝 / 背景樹），唔可以只睇 hex。

### 發現 A2 —— §4 色板冇綠色，但有嘢靠綠色辨識

`#22c55e` / `#16a34a` / `#14532d` / `#1a4d2e` 呢 4 個綠色**冇對應嘅 §4 色**。
而用到嘅地方：

- **`px-troll`（森林巨魔）** —— 個 boss 名字就係「森林」，變成藍灰會失掉語意
- **9 個 `pkg-*` L 項包裝** —— 靠綠色品牌面做辨識（豆漿 / 漂白水 / 洗潔精）

→ **呢個要拍板**（見 §5 決策 A）。

### 發現 A3 —— emoji-as-chrome 仲剩 36 個掣 / 23 種 emoji

cycle111d 換咗 18 個之後，主選單仲有大量 emoji chrome：

| 位置 | 掣 | emoji |
|---|---|---|
| 主選單 · 玩法 | `opt-track` ×2 | 🌼 ⚔ |
| 主選單 · 單雙人 | `opt-play` / `opt-play-boss` | 🧍 👥（×2 組） |
| 主選單 · 場景 | `opt-solo-skin` ×3 | 🚢 🌉 📏 |
| 主選單 · 組合 | `opt-dual-combo` ×4 | ⚔🪢 ⚔📏 🤝🚢 🤝🌉 |
| 主選單 · 難度 | `opt-difficulty` ×2 | 🌱 🌼 |
| 遊戲內 | `btn-back` `sen-btn-back` `btn-bgm`×2 `*-tts-btn`×4 `btn-restart` `btn-back-menu` `btn-easy-start` `btn-quick-start` | ⬅ 🎵 🔊 🔁 🏠 🌼 |
| 教師台 | `btn-menu-advanced-toggle` + `td-*` ×8 | ⚙ ⬇ 🗑 ⚠ 📚 ➕ |
| 類型選擇 | `btn-type-all` / `btn-type-none` | ✓ ✗ |

**可以即刻重用現有 sprite（0 成本）**：🤝 → `px-icon-rescue` · 📏 → `px-scope-length` · 🏁 → `px-icon-stage`
**需要新畫**：餘下 **約 19 隻**（16×16 · 整數座標 · crispEdges · §4 色板）

⚠️ **✓ / ✗ 建議留** —— proposal §4.5 明確寫「符號 / 標點 → 部分保留」，✅❌✓✗ 係通用符號，唔係 emoji-as-chrome。

### 發現 A4 —— `px-island`（班級島）仲未畫

proposal §4.4 列咗但未實作。cycle 112「教師台 + 班級」會用到（島嶼旅程 8 格進度）。
`renderEndIsland()` 而家用 CSS `🏝️` emoji + 8 個 pip。

---

## 3. 動畫現況

```
【B】ANIMATION
  @keyframes 總數   65
  有引用            62
  ⚠️ 死 keyframes   3 個 → freeze-stagger, spark-pop, meter-pixel

【D】CSS
  animation shorthand  79    transition 32    transform 180    filter 57
  will-change           0    contain        0    prefers-reduced-motion 11 處
```

### 發現 B1 —— 3 個互動時刻完全冇動畫回應

| 時刻 | 現況 | 建議 |
|---|---|---|
| **進度格填滿** | `.sen-cell.is-filled` 瞬間切換（`linear-gradient` 令 `--p` 由 0 跳到 100），零動畫 | 加 fill 動畫（0.35s ease-out）—— 呢個係**學生最重要嘅學習訊號**（答啱 → 格填滿 → 打守護者） |
| **關卡切換** | 守護者退場有動畫（`sen-guardian-defeat`），但關卡 +1 / 格數歸零**冇提示** | 加「關卡 +1」badge pop + 新守護者入场 |
| **hint 提示** | hint overlay 靜態出現（`.instant-hint`），冇縮放 / 淡入 | 加 scale(0.9→1) + fade（0.2s）—— 學生要知「提示出現咗」 |

Rubric §8.1：**動畫 = 5**（vs R-PIX 8，-3），§9 H5 早已寫住「state transition 動畫：question enter/exit、tab switch、boss hit、reward」—— 今輪量度確認咗**仲有 3 個時刻係真空**。

### 發現 B2 —— 3 個死 keyframes，其中 `meter-pixel` 係「化石」

| 死 keyframes | 內容 | 建議 |
|---|---|---|
| `meter-pixel` | `background-position: 0 0 → 16px 0` | **復活** —— 呢個正正就係 proposal §4 H5「進度條改 tile 陣列」嘅預留動畫 |
| `spark-pop` | scale 0→1.3→0 + rotate 360° | 復活（答啱嗰陣嘅小星星粒子） |
| `freeze-stagger` | `backdrop-filter: blur(0→2px)` | 刪走 —— `backdrop-filter` 喺學校 iPad 係效能災難（見 B4） |

### 發現 B3 —— 進度格唔係像素 tile（跨層語言不一致）

```
.sen-cell { width: 44px; height: 14px; border-radius: 6px;
            background: rgba(255,255,255,0.14); border: 2px solid rgba(255,255,255,0.35); }
.sen-cell.is-filled { background: linear-gradient(90deg, #34d399 0%, #34d399 var(--p), rgba(...) var(--p)); }
```

三個問題同時存在：
- **44×14px 唔係 16 的整數倍** → 像素格對唔齊（asset-audit C7 守嘅係 sprite 尺寸，呢個係 CSS 元素）
- **玻璃感圓角 + rgba 半透明 + linear-gradient** → 係「現代 UI 語言」，同全站像素語言唔同
- **ART_STYLE_GUIDE §4 明確寫「唔准 rgba 漸層（除非係刻意嘅天空）」**

→ **改成 pixel tile 陣列**（8px 單位 × 3 格 = 24px 高），同時滿足：ART_STYLE_GUIDE §4 + proposal §4 H5 + 復活 `meter-pixel` + C4 一致性。

### 發現 B4 —— 效能：學校 iPad 預算

- `filter: 57` 處（含 `drop-shadow` / `blur`）—— 呢啲係 layout 之外嘅重繪成本
- `will-change: 0` / `contain: 0` —— 冇任何合成層提示
- `prefers-reduced-motion` 11 處（做得唔差 ✅）但 `freeze-stagger` 仲留住一個 `backdrop-filter` 動畫
- Rubric §3.2 明確列咗「**裝置變化 / iPad Safari / reduced-motion 模式 → 未評估**」

→ 學校 iPad（639×669）係真實目標裝置，**呢一項一直冇量過**。

---

## 4. 改善計劃

> 每項都標明 **影響（rubric category）** · **工時** · **驗收** · **守門**。
> 全部遵守：SEN 安全（答錯唔用紅 · 唔 screen shake · pop 只喺被撳嗰個掣）· CSS + JS 兩層 respect `prefers-reduced-motion`。

### Sprint P0 —— sprite 色板收斂（**最高 ROI · 45 分鐘**）

| 項 | 內容 | 影響 | 工時 |
|---|---|---|---|
| P0-1 | 35 隻 sprite 重新上色到 §4 色板（69 個 hex 自動映射 + 3 個綠色人手揀） | **C4**（權重 9，-4 gap） | 30 min |
| P0-2 | 真機覆核：boss 面板 / 9 個 L 項包裝 / 背景樹 / 概念卡徽章 | C4/C5 | 15 min |

**驗收**：asset-audit 加一條「全部 sprite 只用 §4 色板」check（由「只查新 sprite」擴到全部）·
**⚠️ 呢個 check 會由 C9-02 升級成全量**，所以 P0-1 要同一次 commit 做完，唔可以分開。

### Sprint P1 —— emoji-as-chrome 掃尾（2 個 cycle）

| Cycle | 範圍 | 掣數 | 新 sprite |
|---|---|---|---|
| **111e** | 主選單（玩法 / 單雙人 / 場景 / 組合 / 難度）+ 遊戲內 icon-only（TTS ×4 / 返回 ×2 / BGM ×2 / 重來 / 返主頁 / 一鍵開始） | ~20 | ~14 |
| **111f** | 教師台（`td-*` ×8 + 進階開關）+ 類型選擇 `reg.emoji`（**23 個 type → 23 隻 icon**，⚠️ 大工程，可能要拆 2 個 cycle） | ~9 | ~9 + 23 |

**驗收**：T111d-05 嘅 chrome 清單由 18 條擴到 54 條（全部要斷數量）·
視覺場景擴充 `scope-icons` → `chrome-icons`（逐個掣量 `use.getBoundingClientRect()` 非零 + 冇 emoji）

⚠️ **`reg.emoji` 嗰 23 隻** 係最大一塊，而且 `TYPE_REGISTRY` 嘅 icon 欄位**已經存在**
（`add2d` / `sub2d` 已經用 `px-abacus`）→ 機制現成，淨係要畫 23 隻。

### Sprint P2 —— 動畫缺口 + 進度格像素化（1 個 cycle）

| 項 | 內容 | 影響 | 工時 |
|---|---|---|---|
| P2-1 | `.sen-cell` 改 pixel tile 陣列（8px 單位 × 3 格）+ 復活 `meter-pixel` | **C4** + C2 | 45 min |
| P2-2 | 進度格填滿動畫（0.35s ease-out） | **C7** + C2 | 20 min |
| P2-3 | 關卡切換動畫（關卡 +1 badge pop + 新守護者入場） | C7 | 30 min |
| P2-4 | hint overlay 入場動畫（scale + fade） | C7 | 15 min |
| P2-5 | 復活 `spark-pop`（答啱粒子） | C7 | 15 min |
| P2-6 | 刪 `freeze-stagger`（`backdrop-filter` 效能） | 技術完整 | 5 min |

**驗收**：視覺場景 `stage-cells-pixel`（量 tile 尺寸係 8px 倍數 + fill 動畫真係行 + reduced-motion 時唔行）

### Sprint P3 —— 學校 iPad 效能 + 未評估 state（半 cycle）

| 項 | 內容 | 工時 |
|---|---|---|
| P3-1 | `will-change` / `contain` 只加喺**真係需要**嘅合成層（唔好全加） | 20 min |
| P3-2 | 57 處 `filter` 逐個量喺 iPad 嘅 frame time；必要嘅改靜態 | 40 min |
| P3-3 | 補 Rubric §3.2 未評估 state：reduced-motion / resize / 粉藍主題 | 60 min |

### Sprint P4 —— `px-island`（併入 cycle 112）

班級島 sprite（64×64 · 4 階段 CSS class 切裝飾）+ 島嶼旅程進度 bar 像素化。

---

## 5. 要拍板嘅兩個決策

### 決策 A —— 綠色點處理？（影響 P0-1 能不能全自動）

| 選項 | 影響 | 備註 |
|---|---|---|
| **A1 · §4 色板加綠 ramp**（4 色：`#f0fdf4` / `#4ade80` / `#16a34a` / `#14532d`） | 森林巨魔保住語意 · 9 個 pkg 綠色品牌面保住辨識 · 色板由 29 → 33 色 | ⚠️ 要改 `ART_STYLE_GUIDE.md` §4.1（寫明新增理由）|
| **A2 · 綠色全部映射去夜空藍／石灰** | 零改文件 · 但「森林巨魔」變藍灰 · pkg 綠色面變藍灰（要真機睇清楚） | 自動映射成本最低 |
| **A3 · 唔重新上色綠色嗰批**（其餘 31 隻照做） | 折衷 · 但一致性只收一半 | |

**推薦 A1** —— §4.1 本身就係「12 色核心 + ramp」嘅結構，加一條綠 ramp 係同一設計語言；
而且森林巨魔係玩家見得最多嘅 boss，語意唔應該為咗守色板而改。

### 決策 B —— 範圍點切？（影響下 cycle 嘅工作量）

| 選項 | 內容 | 工時 |
|---|---|---|
| **B1 · 只做學生會見到嘅**（主選單 + 遊戲內） | 教師台留 emoji | ~1 cycle |
| **B2 · 全部 36 個一次過** | 包括教師台 + 23 個 type icon | 2–3 cycle |
| **B3 · P0 + P2 先做，emoji 掃尾延後** | 最高 ROI（色板 + 動畫缺口）先收，emoji 留到之後 | ~1 cycle |

**推薦 B3** —— 因為 P0（45 分鐘）同 P2（2.5 h）先係 rubric 分數最高嘅兩項（C4 權重 9 / C7 動畫），
而 emoji 掃尾雖然 C4 都受益，但掣數多、每隻 sprite 都要真機睇。
**而且 P0+P2 做完就可以安排一次真實課堂觀察**，唔好再累積未驗證嘅改動。

---

## 6. 度量基線（每個 sprint 後比對）

```bash
node tools/asset-inventory.cjs            # 資產 + 動畫數字
node tests/asset-audit.js                 # 資產品質守門
node tests/visual/run.mjs                 # 真機視覺
```

| 指標 | cycle 111d 後（baseline） | P0 目標 | P1 目標 | P2 目標 |
|---|---|---|---|---|
| 離 §4 色板 sprite | **35 / 53** | **0** | 0 | 0 |
| emoji-as-chrome 掣 | **36** | 36 | **0**（或按決策 B） | 0 |
| 死 keyframes | **3** | 3 | 3 | **0** |
| 互動時刻冇動畫 | **3** | 3 | 3 | **0** |
| Rubric C4 一致性 | 4 | 5–6 | **7** | 8 |
| Rubric C7 動畫 | 5 | 5 | 5 | **6–7** |
| Rubric 總分 | 6.3 | ~6.5 | ~6.8 | ~7.0 |

⚠️ **Rubric 分數要真機重評先算數**（11 個 state 逐個影 + 量），
唔可以「改咗 code 就當加分」。

---

## 7. 相關文檔

- `docs/VISUAL_QUALITY_RUBRIC.md` — 12 category 評分 + §9 優先改善計劃（呢份文檔係佢嘅量化版）
- `docs/ART_STYLE_GUIDE.md` §4.1/§4.2（色板）· §1.4（禁止事項）· §1.4.1（emoji-as-chrome 現況）
- `docs/GAMEPLAY_ASSET_PROPOSAL.md` §4.3（像素品質規格）· §4.4（資產清單）· §4.7（預算）
- `docs/PLAYTEST_REVIEW.md` — 真機 playtest 發現（F1–F9）
- `tools/asset-inventory.cjs` — 呢份計劃嘅盤點工具
