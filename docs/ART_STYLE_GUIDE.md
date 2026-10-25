# Math Guardian v3.6 — 美術實作指南 (Art Style Guide)

> **cycle 106 · 2026-10-24 · 狀態:已 ship**
> 本指南定義 Math Guardian 所有美術資產(像素 sprite / 場景 / 圖示 / emoji 用法)嘅**共同規則**。
> 評分標準喺 [`VISUAL_QUALITY_RUBRIC.md`](VISUAL_QUALITY_RUBRIC.md);UI 層規則喺 [`UI_STYLE_GUIDE.md`](UI_STYLE_GUIDE.md)。

---


> 📌 **cycle 109 提案**：新玩法要嘅資產清單、像素品質規格（座標對整數 / 整數倍顯示 /
> `crispEdges`）、emoji-as-chrome 置換表同預算表，全部喺
> **`docs/GAMEPLAY_ASSET_PROPOSAL.md` §4**。呢度係規則，嗰度係應用同預算。

---

## 0. 適用範圍同限制

**本 project 嘅技術現實(唔好假設有嘢唔存在):**

```
canvas: 0   WebGL: 0   Three.js: 0   角色模型: 0   骨骼: 0
外部圖片檔: 0   外部音檔: 0   data URI: 0   build step: 0
```

- 所有 sprite = **inline SVG symbol**(`<symbol id="px-*">`),放喺 `index.html` 嘅 hidden `<svg>` 內
- 所有場景 = **CSS gradient + CSS shape** 或 inline SVG layer
- 所有題目物件 = **emoji**(系統字體)
- Media payload 下載量 = **0 bytes**

因此本指南唔會有「骨骼綁定 / 三平面貼圖 / 法線貼圖 / 後製」呢啲章節;會有對應嘅 2D 版:
rig → **CSS animation 參數**;clip → **`@keyframes` 命名 + duration 表**;material → **palette ramp + 陰影層數**。

---

## 1. Style rules(風格硬規則)

### 1.1 Pixel grid

| 規則 | 值 |
|---|---|
| 基準 tile | **16 × 16 px** |
| 角色 sprite | **32 × 48 px**(騎士 / 法師) |
| 場景物件 | 32×32 / 48×48 / 64×64(全部 16 的倍數) |
| Boss | 64×64 起 |
| 縮放 | 一律 `image-rendering: pixelated`,唔好用 fractional scale |
| Grid offset | 唔准半像素;所有座標對齊 16 的倍數 |

> **點解 16**:現有 35 個 symbol(28 個 `px-*` + 6 個 `pkg-*` + 2 個 `bg-tree*`)全部係 16-based,新 sprite 唔准偏離。

### 1.2 Silhouette(輪廓)

- 每個 sprite 必須喺 **純黑底**下仍然認得出係咩
- 輪廓唔准有 1px 細線 —— 細過 2px 嘅細節喺 1x 會消失
- 角色輪廓唔可以同背景同色

### 1.3 Detail hierarchy(細節層級)

| 級 | 用途 | 規則 |
|---|---|---|
| **Primary** | 角色身份特徵(頭盔、帽、武器) | 最高對比,值域用盡 |
| **Secondary** | 服飾 / 道具細節 | 中對比,值域收窄 |
| **Tertiary** | 質地點綴(縫線、鏽跡) | 最多 2 種色,只喺 2x 以上可見 |

> **R-PIX bar 對應**:2D 像素遊戲嘅「三級細節」係首要 readability 手段。呢度嘅對應物係 **A5(1 秒可辨識)**。

### 1.4 禁止事項

| 禁止 | 原因 |
|---|---|
| 同一畫面混用 raster photo + pixel sprite | 跨層一致性 gap = **-4**(最大單一差距,見 rubric §6) |
| 用 emoji 做 **UI chrome**(模式鈕、大絕掣、icon-only 掣) | emoji 依賴系統字體,冇 font 就變 monochrome fallback(實測見 `before-07-boss-gameplay.jpg`) |
| 用 emoji 做 **角色**(而唔係題目物件) | emoji 唔受控、唔受 pixel grid 約束 |
| 任何 `<img src="...">` 外部圖片 | 保持 0 bytes media payload |
| 任何 base64 / data URI 圖片 | 同上 |
| 半透明 sprite 疊出唔穩定嘅 alpha edge | 造成 shimmer |

---

## 2. Naming conventions(命名)

```
px-<subject>-<pose>       角色 / 怪物 sprite      例:px-knight, px-troll, px-castle
px-<object>               物件 / 道具 sprite      例:px-meteor, px-target, px-sound-on
pkg-<object>              題目物件包裝            例:pkg-milk, pkg-carton
bg-<layer>                場景 layer              例:bg-tree-a, bg-tree-b
icon-<size>               純 UI icon(size = md/mini)
```

| 規則 | 說明 |
|---|---|
| 全部 **小寫 + 連字號** | `px-knight` 而唔係 `pxKnight` |
| 唔准用顏色做 id | `px-red-knight` → 改用 pose / variant 描述 |
| 純 icon 同 sprite 分開 prefix | `icon-` = 單色 currentColor;`px-` = 多色 sprite |
| 同一物件唔准兩個 id | `px-sound-on` / `px-sound-off` 係一對,唔係兩個物件 |
| 新 symbol 必須 register 喺 hidden `<svg>` | `id` 唯一 |

**Reference**:`<use href="#px-castle" />`、`#px-troll`、`#px-meteor`、`#px-target`、`#px-sound-on`、`#px-knight`、`#px-mage`。

---

## 3. Scale & proportions(比例)

| 物件 | 尺寸 | 比例規則 |
|---|---|---|
| 角色(騎士/法師) | 32 × 48 | 頭佔 1/3(16px),身 2/3(32px) |
| Boss | 64 × 64 | 頭佔 1/3,身 2/3 —— 同角色同一比例規則,只係放大 |
| 場景樹 | 32 × 48 / 48 × 48 | 高度 ≈ 角色 × 2~3 |
| 城堡塔 | 42 × 42 顯示 | 高度 ≈ 角色 × 1.5 |
| 物件 / 道具 | 16 × 16 | 一個 tile = 一件物件 |
| 題目 emoji | 視覺高度 ≈ 角色頭 × 1.2 | 唔好大過角色,避免搶焦點 |

**Proportion 檢查**
- 所有角色「頭身比」一致(2:3 或 3:2),唔准一個係 Q 版一個係寫實
- 場景物件嘅大小要表達真實尺度關係(塔 > 樹 > 人 > 道具)

---

## 4. Palette(色票)

### 4.1 核心色板(全部 sprite 只用呢 12 個色)

```
夜空 deep    #0a1729   夜空 mid    #1e3a5f   夜空 bright #4a6fa5
雪 / 底      #f0f9ff   石 / 灰     #cbd5e1   深石        #475569
墨 / 描邊    #0f172a
金 (獎勵)    #fbbf24   藍 (騎士)   #3b82f6   紫 (法師)   #a855f7
紅 (Boss)    #dc2626
```

### 4.2 每個材質嘅 ramp(每個材質 4 階,唔准跨材質借色)

| 材質 | 亮 | 中 | 暗 | 描邊 |
|---|---|---|---|---|
| 金屬 / 鎧 | `#e2e8f0` | `#94a3b8` | `#475569` | `#0f172a` |
| 石 / 塔 | `#e2e8f0` | `#cbd5e1` | `#64748b` | `#1e293b` |
| 木 | `#fcd34d` | `#d97706` | `#78350f` | `#0f172a` |
| 金幣 / 獎勵 | `#fde68a` | `#fbbf24` | `#b45309` | `#0f172a` |
| 布 / 旗 | `#f0f9ff` | `#93c5fd` | `#1e3a8a` | `#0f172a` |
| 水 / 能量 | `#bae6fd` | `#38bdf8` | `#0369a1` | `#0f172a` |
| 毒 / Boss | `#fda4af` | `#ef4444` | `#991b1b` | `#450a0a` |

### 4.3 光源規則

| 規則 | 值 |
|---|---|
| 全域光源方向 | **左上 45°** |
| 亮面 | 物件左上 1/3 |
| 暗面 | 物件右下 1/3 |
| 描邊 | 全物件 1px `#0f172a`(唔好每件唔同色) |
| 環境光 | 最暗階唔好低過 `#0f172a`;夜晚場景 sprite 最暗階用 `#1e293b` |
| 隊伍色 | 騎士 `#3b82f6`、法師 `#a855f7` —— 只可以出現喺角色 + 對應 UI 面板,**唔可以**出現喺場景 |

> **唔准**:同一 sprite 喺唔同畫面用唔同光源方向;或者用 `filter: hue-rotate` 去代替畫過嘅不同材質。

---

## 5. Materials & lighting(材質表達)

因為冇 3D,材質靠 **像素明暗塊面** 表達:

| 材質 | 表達方式 |
|---|---|
| 金屬 | 一塊高光(左上)+ 一塊反射暗面(右下)+ 1px 亮邊 |
| 石 | 2–3 塊同色階拼砌 + 隨機 1px 裂紋(唔規則) |
| 木 | 縱向條紋 + 節疤 |
| 水 | 橫向 1px 波紋 + 半透明亮層 |
| 金幣 | 中心亮邊 + 1px 暗輪廓 + 高光點 |
| 布 | 平塗 + 1px 底部暗影,唔好加 texture |

**陰影層數上限**:
- sprite 內部最多 **3 階**(亮/中/暗)+ 描邊
- 場景 sprite 最多 **2 階**(避免搶焦點)

---

## 6. Locomotion & animation principles(動作原則)

### 6.1 本 project 有咩動作需求

| 角色 / 物件 | 動作 | 用途 |
|---|---|---|
| 騎士 / 法師 | idle breathing | 等待作答時保持「活住」 |
| 騎士 / 法師 | attack(答對) | 表達進攻 Boss |
| 騎士 / 法師 | hurt / defeated | Boss 反擊 |
| 城堡塔 | hit flash + shake | 玩家隊受傷 |
| Boss | idle / enraged / frozen | 3 種 boss 狀態(`cycle` 已有 filter 實作) |
| 進度條 | fill / tick | 答對 +1 格 |
| 答案鈿 | flash-correct / flash-wrong | 回饋 |

> **冇**行走 / 跳 / 轉向 / 攀爬 —— 本 game 唔移動角色,唔需要 locomotion cycle。

### 6.2 Animation 三拍(anticipation → contact → settle)

任何「答對」類動作必須有三拍,唔可以淨係 loop:

| 拍 | 時間 | 內容 |
|---|---|---|
| anticipation | 0–80ms | 微微蓄勢(縮 / 彈起) |
| contact | 80–200ms | 明確接觸(閃白 + 位移 + 音效) |
| settle | 200–500ms | 回到 rest,但帶少少 overshoot |

### 6.3 Timing table(統一 timing token)

| 用途 | Duration | Easing |
|---|---|---|
| 按鈕 pressed | 90ms | `cubic-bezier(.2,.8,.2,1)` |
| 面板 / modal 入 | 180ms | `ease-out` |
| 答題切換 | 220ms | `ease-in-out` |
| flash-correct | 1200ms | `ease-out` |
| flash-wrong | 1200ms | `ease-out` |
| 浮動粒子 | 3–6s loop | `linear` |
| Boss idle | 2.4s loop | `ease-in-out` |
| Boss enraged | 0.8s loop | `ease-in-out` |

**規則**:同一個語意嘅動作,全 app 用同一個 duration。唔准一個地方 120ms 另一個 300ms。

### 6.4 Secondary motion(次級運動)

次級運動 = 跟随主運動嘅附屬位移。

| 物件 | 次級運動 | 實作 |
|---|---|---|
| 角色 | 呼吸位移 1px | `@keyframes` translateY |
| Boss | 頭/身分離擺動 | 兩個 element 唔同 phase |
| 進度條 | 新增格仔彈一下 | `transform: scale` on the new tile |
| 答案鈿 | correct → 輕微上浮 | keyframe |

**規則**:次級運動幅度 **≤ 2px**(pixel 遊戲唔可以有大幅慣性擺動,會 break 像素感)。

### 6.5 Event synchronization(事件同步)

| 事件 | 動畫起點 | 音效起點 | 要同步嘅嘢 |
|---|---|---|---|
| 撳答案 | `pointerdown` | — | 視覺 pressed 即刻(≤ 100ms) |
| 答對 | 正確鈣 flash 起點 | `Audio.correct()` 同帧 | flash 第 1 幀 == 音效起點 |
| 答錯 | 錯鈣 flash 起點 | `Audio.wrong()` 同帧 | 同上 |
| Boss 受傷 | HP bar 開始減少 | hit SFX | bar 減少要喺 SFX 之後 ≥ 100ms(先閃後扣) |
| 進度 +1 | 新 tile 出現 | tick | 同一幀 |
| 題目切換 | 舊題 fade out | — | 新題 fade in 延遲 80ms,唔好同時 |

> **同步規則**:所有「事件性」動畫同音效**同一幀起點**。ambient 動畫(飄雪/閃爍)可以自由,但唔好喺答案反饋期間播 ambient transition。

### 6.6 Event-to-animation mapping(現況)

| Event | 動畫 | 音效 | 狀態 |
|---|---|---|---|
| 答對 | `flash-correct` | `Audio.correct()` | ✅ |
| 答錯 | `flash-wrong` | `Audio.wrong()` | ✅ |
| 進度 +1 | plank 出現 | `Audio.tick()` | ✅(cycle 105 修好) |
| 充能 100% | `knight-ultimate` 亮 | `Audio.beep()` | ✅(cycle 105 修好) |
| 題目切換 | 無 | TTS | ❌ **缺**(H5) |
| Boss 受傷 | HP bar 減少 | hit SFX | ⚠️ 部分 |
| 勝利 | 無專屬動畫 | BGM | ❌ **缺** |

---

## 7. Export expectations(資產交付規格)

### 7.1 SVG symbol 規格

```html
<!-- 喺 hidden <svg> 內,id 必須符合 §2 命名 -->
<symbol id="px-knight" viewBox="0 0 32 48" shape-rendering="crispEdges">
  <!-- 純 path/rect,冇 <text>,冇外部引用 -->
</symbol>
```

| 規則 | 值 |
|---|---|
| `viewBox` | 必須係 16 的倍數(例:0 0 32 48) |
| `shape-rendering` | `crispEdges`(避免 anti-alias 令 pixel 模糊) |
| 內部 | 只用 `path` / `rect` / `polygon`;**唔准** `<text>`(字型會變) |
| 填色 | 只用 §4 色板 hex;**唔准** rgba 漸變(除非係刻意嘅天空) |
| 尺寸 | 用 CSS 控制,唔好喺 symbol 內寫死 `width`/`height` |
| 引用 | `<svg class="pixel"><use href="#px-id"/></svg>`,並且個 `<svg>` 或 parent 有 `image-rendering: pixelated` |

### 7.2 引入新 sprite 嘅 checklist

1. 命名符合 §2
2. `viewBox` 係 16 的倍數
3. 只用 §4 色板
4. 光源左上 45°
5. 輪廓過 §1.2 純黑底測試
6. 三級細節層級齊
7. 喺 1x 同 2x 各睇一次(唔准有 aliasing 毛邊)
8. 加喺 hidden `<svg>` 內
9. **加一條 regression assertion**(見 §9)

---

## 8. Performance budget(性能預算)

| 項目 | 預算 | 現況 |
|---|---|---|
| inline SVG symbol 總數 | ≤ 60 | 35 |
| SVG symbol 總 payload | ≤ 60 KB | ~42 KB |
| 同時顯示嘅 sprite 實例 | ≤ 60 | ✅ |
| 動畫 element(同時) | ≤ 24 | 6 firefly + boss idle |
| CSS `@keyframes` 總數 | ≤ 80 | 63 |
| 單個 `@keyframes` 動畫屬性數 | ≤ 4 | ✅ |
| 動畫只用 `transform` / `opacity` | 必須(唔觸發 layout) | ✅ |
| `backdrop-filter` 同時層數 | ≤ 1 | ✅ |
| Media payload 下載 | **0 bytes** | **0 bytes** ✅ |
| 首屏 JS payload | ≤ 340 KB | 324.8 KB |

**硬規則**
- 任何動畫唔准動 `width` / `height` / `top` / `left`(會觸發 reflow)
- 唔准喺 animation 裡面用 `filter` 做連續變化(舊 iPad 會 drop frame)
- `box-shadow` 用靜態值,唔好喺 hover transition 動畫 shadow spread

---

## 9. Review process(審核流程)

### 9.1 新 sprite 入庫

```
1. 設計 (grid 16 / 色板 / 光源)
2. 落地到 hidden <svg>
3. 喺一個真實 state 入面 render 一次(1440×900 + 639×669 兩個 viewport)
4. 純黑底輪廓檢查
5. 1x / 2x aliasing 檢查
6. 加 regression assertion(§9.2)
7. commit(一個 cycle 一次 commit)
```

### 9.2 必須有 assertion 嘅素材改動

| 改動 | assertion 例子 |
|---|---|
| 新增 / 改名 symbol | `assert('px-knight symbol exists', src.includes('id="px-knight"'))` |
| 改 sprite 尺寸 | `assert('px-knight viewBox 32x48', /id="px-knight"[^>]*viewBox="0 0 32 48"/.test(src))` |
| 改色板 | `assert('palette has 12 core colours', ...)` |
| 改 animation timing | `assert('flash-correct duration 1200ms', /@keyframes flash-correct[\s\S]{0,400}1\.2s/.test(src))` |

### 9.3 視覺驗證 script(本次 audit 用過嘅方法)

用 headless Chrome + CDP,唔靠人手截圖:
- 開 `--headless=new --remote-debugging-port`,連 CDP
- `Emulation.setDeviceMetricsOverride` 設 viewport(1440×900 / 639×669)
- `Runtime.evaluate` 讀 `getComputedStyle` / `getBoundingClientRect`
- `Page.captureScreenshot` 影 frame
- 對 PNG 取樣計 WCAG 對比度

> 每次美術 / UI 改動之後至少重跑一次受影響 state,並且**重新量對比度**(唔好靠肉眼)。

---

## 10. 已知美術限制(唔好當 bug 修)

| 限制 | 原因 | 處理 |
|---|---|---|
| 校徽係 raster PNG,白底方框 | 學校官方標誌,冇 vector 版 | **Q/H2**:加圓形 mask + 去白底 |
| 某些 emoji 喺冇 emoji font 嘅裝置變 monochrome | 系統字體差異 | **H2**:UI chrome 位置改 SVG symbol |
| 場景 sprite 冇行走動畫 | 本 game 唔移動角色 | 唔使補(§6.1) |
| Boss 只有 filter 變化(enraged/frozen),冇獨立 sprite | 美術未做 | **P2**:要 artist |
| 進度條係漸層而唔係 pixel tile | 早期用 CSS 做 | **H5**:改成 tile 陣列 |

---

## 11. Changelog

| Cycle | 日期 | 內容 |
|---|---|---|
| 106 | 2026-10-24 | 本文件建立;記錄 16/32/48/64 grid、12 色色板、4 階材質 ramp、左上 45° 光源、3 拍動畫原則、timing token、SVG symbol 交付規格、性能預算、審核流程 |
