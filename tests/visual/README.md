# tests/visual — 實機視覺驗證（headless Chrome + CDP）

> **點解要入 repo**：cycle110b 修嘅 end-screen overflow（學校 iPad 639×669 爆 232px）
> 之前**淨係靠 `AGENTS.md` 一行文字守住** —— 冇任何可執行嘅 check。
> 驗證工具擺 `/tmp` 就等於「驗證唔到」：換部機、換個 agent 接手、`/tmp` 清咗，個防線就冇咗。

## 用法

```bash
node tests/visual/run.mjs                          # 跑全部 scenario
node tests/visual/run.mjs --scenario end-screen-overflow
node tests/visual/run.mjs --keep-shots             # 保留截圖 + Chrome profile
```

- 會**自己起一個 static server**（random port）—— 唔使事先開 `:8811`。
- 截圖落 `tests/visual/.out/`（已 gitignore）。
- **冇 Chrome 嘅機器 → 印 SKIP + exit 0**（唔會阻住其他 gate）。
  裝 Chrome 或者 `CHROME_PATH=/path/to/chrome node tests/visual/run.mjs`。
- 有 Chrome 但 assert 過 → **exit 1**。

## 目錄

| 檔 | 用途 |
|---|---|
| `cdp.mjs` | headless Chrome + CDP driver。`--remote-debugging-port=0` 叫 Chrome 自己揀 port（唔會撞 port） |
| `run.mjs` | orchestrator：起 static server → 跑晒 scenario → 總結 → exit code |
| `helpers.mjs` | 頁面內共用 helper（**答題目標 resolver** —— 三種題型唔同，唔好各寫一份） |
| `scenarios/*.mjs` | 一個檔 = 一個場景 |

## 現有 scenario

| Scenario | 守護嘅嘢 |
|---|---|
| `all-scopes-answerable` | **8 個 easy scope 學生都撳得到答案**（cycle111e P0：L 容量卡片曾經係冇 handler 嘅 `<div>`，由 cycle 89 起就係死路） |
| `end-screen-overflow` | 結算畫面喺 **639×669** 唔准 overflow · 概念卡 + 島嶼要喺 stats **上面** · 掣行 sticky（唔使捲到底）· 雙隊 medal 唔換行 |
| `sen-l-capacity` | L 容量題級數干擾項（L1 2L / L2 1.5L / L3 1.5L+2L）· 答案一定係飲品 · `pkg-orange-2l` 精靈真係 render |
| `sprite-sheet` | 每個 `<symbol>` 都真係 render 到（唔係死 symbol）· 冇重複 id |
| `sen-answer-feedback` | SEN 畫面**逐個選項反饋**（cycle111f）· verdict band 幾何重疊 = 0 · band 唔覆蓋進度格 |
| `teacher-audio-panel` | 教師台**主音量 slider** 真係通（cycle111g）· gain 係平方 · 0% 真靜音 · WCAG AA 對比度 |

> ⚠️ **cycle111h 起 app 拆咗檔**：static server 一定要有 `.js` 嘅 MIME mapping
> （`run.mjs` 嘅 MIME map 已加），否則 `<script defer src="app.js">` 會被
> Chrome 拒絕執行 → 成個場景會「停喺度」而唔係斷言失敗。

## 寫新 scenario

```js
export default {
  name: 'my-check',
  title: '人讀嘅描述',
  viewport: [639, 669],        // 學校 iPad 係 639×669
  steps: [
    { eval: `(() => { /* 喺頁面執行 */ return 'ok'; })()` },
    { wait: 600 },
    { assert: { label: '要點樣先算 pass', expr: `(() => {
      const ok = /* ... */;
      return { ok, detail: ok ? '' : '點解唔過' };
    })()` } },
    { shot: 'my-check' },      // 截圖落 .out/
  ],
};
```

`assert` 嘅 `expr` 可以回傳 `boolean`，或者 `{ ok, detail }`（`detail` 會印出嚟，方便 debug）。

## ⚠️ 寫 scenario 嘅四個陷阱

1. **答題目標唔止一種**。一般 MC 係 `.sen-opt-btn`、長短/高矮係 `.len-pair-hit[data-side]`、
   L 容量卡片係 `.pic-card-mini` —— **用 `helpers.mjs` 嘅 `ANSWER_TARGET_SRC`，唔好自己寫一份**
   （cycle111e 實測：兩個 scenario 各寫一份，其中一份漏咗 pic-grid → 每逢 random 到
   `findLDrink` 就 stall，結算場景 flaky）。
2. **場景要有「唔會 stall」嘅斷言**。答題 loop 如果搵唔到目標會空轉直到 timeout，
   症狀係「screen-end 仲係 hidden」而唔係「答案撳錯」—— 睇落似另一個問題。
3. **eval / expr 係 template literal —— 入面唔可以有反引號**。
   `step.eval` / `step.assert.expr` 嘅內容寫喺 `` ` `` 之間，
   所以**連註解都唔可以有反引號**（`// 用 \`_foo\` 呢個` 會即刻截斷個字串 →
   `SyntaxError: Unexpected identifier`，而且錯誤訊息唔會指向真正原因）。
   cycle111g 實測踩到：註解入面寫咗 `` `_tryTeacherPwd` `` → 成個 scenario 檔案 parse 失敗。
   → 註解入面一律唔用反引號（用引號或者淨係寫函數名）。
4. **有密碼門 / 延遲 wire 嘅 UI，要行真實流程**。教師台嘅音效控制係喺
   `_tryTeacherPwd()` 答啱密碼之後先 `wireAudioSettings()` ——
   直接 `classList.remove('hidden')` 會令掣**睇得見但撳唔到**（onclick 根本未接上）。
   → 場景要讀 `_teacherChallenge.a` 填入密碼欄再叫 `_tryTeacherPwd()`。

## 關聯

`AGENTS.md` → **Gates** 一節（gate 2e）· `TODO.md` → 視覺驗證相關 backlog
