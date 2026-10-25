# Math Guardian — Project Plan / TODO

> **For Hermes:** one cycle = one feature. Ken: `FIX ONE` unless `順序`/`順序做` = whole plan autonomous.  
> **Push** = commit + push live Pages. Gates green first.

**Goal:** 將軍澳培智中度 SEN 數學課堂可用 — 單檔 SPA、圖選/手勢 A-B-C、solo/dual、穩定 regression。

**Live:** https://ihateusingai-beep.github.io/math-guardian/  
**Local:** `~/workspace/vs code/education/math/team game`  
**Stack:** `index.html` (vanilla JS + Tailwind CDN) · `tests/regression.js` · GitHub Pages · no build

---

## 0. 現況（baseline · 2026-10-24 · post cycle 106）

| 項 | 值 |
|---|---|
| Version | **v3.6** · cycle **107** |
| Tests | **5309 pass / 0 fail**（804 regression + 4493 generator-audit + 12 audio-audit） |
| Size | `index.html` **541,798 bytes**（budget < 600 KB） |
| Media payload | **0 bytes**（全部 runtime 合成） |
| Visual readiness | **6.3 / 10**（Before cycle 106 = 4.56）· 見 `docs/VISUAL_QUALITY_RUBRIC.md` |
| Core done | easy scopes · solo/dual arena · 黃/紫長短 · 數數分5 · 順序跟住 · bank v3 · 視覺 P0 修清 |

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

---

## 2. NEXT（cycle 107+ backlog）

> 來源：`docs/VISUAL_QUALITY_RUBRIC.md` §9（優先改善計劃）+ §10（rendering profiles 規格）。
> 詳細證據、數值、最小改動步驟全部喺 rubric，呢度只做 index。

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
node tests/regression.js       # 804 pass / 0 fail
node tests/generator-audit.js  # 4493 pass / 0 fail
node tests/audio-audit.js      # 12 pass / 0 fail
```
改咗 UI / CSS / token → 額外：headless Chrome + CDP 重 capture 受影響 state + 重量對比度（見 `docs/VISUAL_QUALITY_RUBRIC.md` §4 驗證方法）。

**Live:** https://ihateusingai-beep.github.io/math-guardian/
