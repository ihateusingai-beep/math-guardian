// tests/visual/scenarios/castle-solo.mjs
//
// 【cycle111n】F8 · 單人 boss 城塔「無主」。
//
// 缺陷原貌（cycle111i playtest F8）：
//   · `bossAttackCastle()` 隨機打 left / right，但**單人模式右隊 panel 係收埋嘅**
//     → 約 50% 嘅 HP 流失學生點都阻唔到，而且會見到一座自己救唔到嘅塔跌落去
//   · 失敗條件係「兩座都跌到 0」→ 單人模式根本冇可能觸發（除非兩座都被打）
//   · `victimTeam`（角色受傷動畫）同 `side`（邊座塔受傷）各自 random
//     → 會出現「法師動畫 + 左翼塔掉血」嘅矛盾
//
// 修法（單一真實來源 = `_castleSides()` / `_castleMax()` / `_castleAlive()` / `_castleFallen()`）：
//   · 單人 boss 淨顯示**一座**城塔（右隊嗰座唔存在）
//   · 嗰座塔 HP = 200（= 舊版兩座加埋）→ 保住原本嘅生存時間預算
//   · 雙隊 boss 保持兩座塔、每座 100 HP、跌一座唔即刻輸（唔改雙隊難度）
//
// ⚠️ 呢啲係「狀態被改寫」嘅邏輯 → 一定要真機行，淨睇 DOM 唔夠。

export default {
  name: 'castle-solo',
  title: 'F8 · 單人 boss 城塔：淨一座 + HP 200 + boss 只打玩家嗰座',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      Game.settings.difficulty = 'normal';
      Game.settings.playLayout = 'solo';
      Game.settings.types = ['add10'];
      Game.settings.scopes = [];
      if (!Bosses.current) Bosses.current = Bosses.list[0];
      return 'ready';
    })()` },

    { eval: `(() => { startGame(); return 'started'; })()` },
    { wait: 1200 },

    // ── 1. 單人：淨一座城塔（右塔隱藏 + row 單欄 + 動態 HP 上限）──
    {
      assert: {
        label: '單人 boss 淨顯示一座城塔（右塔隱藏 + row 單欄 + HP 200/200）',
        expr: `(() => {
          const row = document.getElementById('castle-bar-row');
          const right = document.getElementById('castle-right-wrap');
          const left = document.getElementById('castle-left-text');
          const max = document.getElementById('castle-left-max');
          const label = document.getElementById('castle-left-label');
          if (!row || !right || !left || !max || !label) {
            return { ok: false, detail: 'castle UI element 唔齊' };
          }
          const cols = getComputedStyle(row).gridTemplateColumns;
          return {
            ok: !row.classList.contains('hidden')
              && right.classList.contains('hidden')
              && row.classList.contains('is-solo')
              && left.textContent.trim() === '200'
              && max.textContent.trim() === '200'
              && label.textContent.trim() === '城塔'
              && cols.split(' ').length === 1,
            detail: '右塔 hidden=' + right.classList.contains('hidden')
              + ' · is-solo=' + row.classList.contains('is-solo')
              + ' · HP=' + left.textContent + '/' + max.textContent
              + ' · label="' + label.textContent + '" · grid cols=' + cols,
          };
        })()`,
      },
    },
    { shot: 'castle-solo-1-one-tower' },

    // ── 2. boss 攻擊只打玩家嗰座（右塔永遠唔受傷）──
    {
      assert: {
        label: 'boss 攻擊只打玩家嗰座城塔（右塔 HP 永遠係 0，唔再流失學生控制唔到嘅血）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const before = Game.state.castle.left;
          const rightBefore = Game.state.castle.right;
          for (let i = 0; i < 3; i++) { bossAttackCastle(); await sleep(120); }
          const after = Game.state.castle.left;
          const rightAfter = Game.state.castle.right;
          const rightText = document.getElementById('castle-right-text').textContent.trim();
          return {
            ok: after < before && rightAfter === rightBefore && rightText === '0',
            detail: '左塔 ' + before + ' → ' + after + ' · 右塔 ' + rightBefore + ' → ' + rightAfter
              + '（畫面顯示 ' + rightText + '）',
          };
        })()`,
      },
    },

    // ── 3. 窄屏 compact 幾何：boss panel 唔被壓扁 + 答案掣唔被 sticky 城塔條遮住 ──
    // ⚠️ 呢個係 cycle111n 順手捉到嘅**長久 P1**（cycle111j 已經存在）：
    //    #screen-game 係 flex-col + height:100vh → 高嘅 team card 會 squeeze 其他項，
    //    boss panel（overflow:hidden）被壓到 **26px**，HP 條 + boss 圖溢出蓋住 team card
    //    → 學校 iPad 639×669 嘅 boss 學生**完全睇唔到 boss HP 條**。
    {
      assert: {
        label: '窄屏 compact：boss panel 唔被壓扁（≥60px）+ 答案掣喺摺線內 + sticky 城塔條唔遮掣',
        expr: `(() => {
          const panel = document.getElementById('boss-panel');
          const row = document.getElementById('castle-bar-row');
          const btns = Array.from(document.querySelectorAll('#knight-answer-area .option-btn'));
          if (!panel || !row) return { ok: false, detail: '搵唔到 boss panel / castle row' };
          const pR = panel.getBoundingClientRect();
          const rR = row.getBoundingClientRect();
          const vh = window.innerHeight;
          let overlap = 0;
          let lastBottom = 0;
          btns.forEach(b => {
            const r = b.getBoundingClientRect();
            overlap += Math.max(0, Math.min(r.bottom, rR.bottom) - Math.max(r.top, rR.top));
            lastBottom = Math.max(lastBottom, r.bottom);
          });
          return {
            ok: pR.height >= 60 && btns.length > 0 && overlap === 0 && lastBottom <= vh + 1,
            detail: 'boss-panel h=' + Math.round(pR.height)
              + ' · 答案掣 ' + btns.length + ' 個 · 最後一個 bottom=' + Math.round(lastBottom)
              + ' · viewport h=' + vh
              + ' · sticky 城塔條 ' + Math.round(rR.top) + '..' + Math.round(rR.bottom)
              + ' · 重疊=' + Math.round(overlap) + 'px',
          };
        })()`,
      },
    },

    // ── 4. 雙隊 boss：兩座塔都返嚟（唔會被今次修改誤傷）──
    {
      assert: {
        label: '雙隊 boss 保持兩座城塔（各 100 HP · 右塔可見 · label 回復「左翼城塔」）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          Game.settings.playLayout = 'dual';
          startGame();
          await sleep(1200);
          const row = document.getElementById('castle-bar-row');
          const right = document.getElementById('castle-right-wrap');
          const lText = document.getElementById('castle-left-text').textContent.trim();
          const lMax = document.getElementById('castle-left-max').textContent.trim();
          const rText = document.getElementById('castle-right-text').textContent.trim();
          const rMax = document.getElementById('castle-right-max').textContent.trim();
          const label = document.getElementById('castle-left-label').textContent.trim();
          return {
            ok: !right.classList.contains('hidden')
              && !row.classList.contains('is-solo')
              && lText === '100' && lMax === '100'
              && rText === '100' && rMax === '100'
              && label === '左翼城塔',
            detail: '右塔 hidden=' + right.classList.contains('hidden')
              + ' · is-solo=' + row.classList.contains('is-solo')
              + ' · 左 ' + lText + '/' + lMax + ' · 右 ' + rText + '/' + rMax
              + ' · label="' + label + '"',
          };
        })()`,
      },
    },
    { shot: 'castle-solo-2-dual' },

    // ── 4. 雙隊：兩座塔都真係會被打（唔係淨打一座）──
    {
      assert: {
        label: '雙隊 boss 兩座塔都會受傷（隨機分配保留）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const l0 = Game.state.castle.left;
          const r0 = Game.state.castle.right;
          for (let i = 0; i < 14; i++) { bossAttackCastle(); await sleep(40); }
          const l1 = Game.state.castle.left;
          const r1 = Game.state.castle.right;
          return {
            ok: l1 < l0 && r1 < r0,
            detail: '左 ' + l0 + ' → ' + l1 + ' · 右 ' + r0 + ' → ' + r1,
          };
        })()`,
      },
    },
  ],
};
