# Math Guardian — Project Plan / TODO

> **For Hermes:** one cycle = one feature. Ken: `FIX ONE` unless `順序`/`順序做` = whole plan autonomous.  
> **Push** = commit + push live Pages. Gates green first.

**Goal:** 將軍澳培智中度 SEN 數學課堂可用 — 單檔 SPA、圖選/手勢 A-B-C、solo/dual、穩定 regression。

**Live:** https://ihateusingai-beep.github.io/math-guardian/  
**Local:** `~/workspace/vs code/education/math/team game`  
**Stack:** `index.html` (vanilla JS + Tailwind CDN) · `tests/regression.js` · GitHub Pages · no build

---

## 0. 現況（baseline · 2026-10-26 · post cycle 111b）

| 項 | 值 |
|---|---|
| Version | **v3.6** · cycle **111b** |
| Tests | **5574 pass / 0 fail**（875 regression + 4665 generator-audit + 12 audio-audit + 22 asset-audit） |
| Size | `index.html` **588,029 bytes**（budget < 600 KB · 餘 26,371） |
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
- [ ] **cycle 111c** Boss 重新入場（進度格驅動 + HP）· 5 個 boss 守護者 sprite
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
