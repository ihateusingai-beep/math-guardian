// tests/visual/scenarios/playtest-boss.mjs
//
// 【PLAYTEST · cycle111h 後】Boss 戰役：揀 boss → 開打 → 答題 → HP 下降 → 結算。
//
// ⚠️ Boss 係「經典畫面」（唔係 SEN 畫面）—— 所以呢條路徑同 cycle111f/111g 嘅
//    SEN 守門完全唔重疊。而且 AGENTS.md 講明 Boss 嘅進度格 / HP 係 cycle111c 未做嘅部分。
//
// 重點睇：
//   · boss HP 條真唔真隨答啱下降（做緊？）· 仲有剩幾多
//   · 答錯會唔會扣血 / 有冇反饋
//   · boss 打死 → 結算畫面

export default {
  name: 'playtest-boss',
  title: 'Boss 戰役：HP 條 / 答題反饋 / 打倒後結算',
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
      return 'ready';
    })()` },

    { eval: `(() => {
      if (!Bosses.current) Bosses.current = Bosses.list[0];
      startGame();
      return 'started boss=' + (Bosses.current ? Bosses.current.id : 'none');
    })()` },
    { wait: 1400 },

    {
      assert: {
        label: 'Boss 面板 + HP 條真係 render（唔係空殼）',
        expr: `(() => {
          const panel = document.getElementById('boss-panel');
          const fill = document.getElementById('boss-hp-fill');
          const text = document.getElementById('boss-hp-text');
          const max = document.getElementById('boss-hp-max');
          return {
            ok: !!panel && !panel.classList.contains('hidden') && !!fill && !!text
              && Number(text.textContent) > 0,
            detail: 'HP=' + (text ? text.textContent : '?') + '/' + (max ? max.textContent : '?')
              + ' · fill width=' + (fill ? fill.style.width : '?'),
          };
        })()`,
      },
    },
    { shot: 'playtest-boss-1-start' },

    // ── 答啱 → HP 有冇跌 ──
    {
      assert: {
        label: '答啱 → Boss HP 真係下降（進度條有反饋）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const text = document.getElementById('boss-hp-text');
          const before = Number(text.textContent);
          const max = Number(document.getElementById('boss-hp-max').textContent);
          const q = Game.state.current.knight;
          if (!q) return { ok: false, detail: '冇題目' };
          // 經典畫面：搵答案鈕
          const opts = Array.from(document.querySelectorAll('#screen-game .option-btn'));
          const want = String(q.answer);
          const hit = opts.find(b => b.textContent.trim().replace(/^[A-C]\s*/, '').trim() === want)
            || opts.find(b => b.textContent.includes(want));
          if (!hit) return { ok: false, detail: '搵唔到答案鈕（options=' + opts.length + ' answer=' + want + '）' };
          hit.click();
          await sleep(1200);
          const after = Number(text.textContent);
          return {
            ok: after < before,
            detail: 'HP ' + before + '/' + max + ' → ' + after + '/' + max
              + ' · fill=' + document.getElementById('boss-hp-fill').style.width,
          };
        })()`,
      },
    },

    // ── 城堡 HP 條（左翼 / 右翼城塔）──
    // ⚠️ 呢個唔係「進度格」—— 城堡條係城塔嘅 HP（#castle-left/right-fill）。
    //    ✅ cycle111n · F8：單人 boss **淨得一座塔**（右隊 panel 收埋 → 右塔冇人控制），
    //    所以單人模式右塔係隱藏 + HP 0；雙隊先係兩座都見到。
    {
      assert: {
        label: '城堡 HP 條喺 boss 模式真係 render（單人一座 / 雙隊兩座）',
        expr: `(() => {
          const row = document.getElementById('castle-bar-row');
          const lf = document.getElementById('castle-left-fill');
          const rf = document.getElementById('castle-right-fill');
          const lt = document.getElementById('castle-left-text');
          const rt = document.getElementById('castle-right-text');
          const rw = document.getElementById('castle-right-wrap');
          const solo = Game.settings.playLayout !== 'dual';
          const rightHidden = !!rw && rw.classList.contains('hidden');
          const rightOk = solo
            ? (rightHidden && Number(rt.textContent) === 0)
            : (!rightHidden && Number(rt.textContent) > 0);
          return {
            ok: !!row && !row.classList.contains('hidden')
              && !!lf && !!rf && !!lt && !!rt
              && Number(lt.textContent) > 0 && rightOk,
            detail: 'left=' + (lt ? lt.textContent : '?') + '(' + (lf ? lf.style.width : '?') + ')'
              + ' · right=' + (rt ? rt.textContent : '?') + '(' + (rf ? rf.style.width : '?') + ')'
              + ' · 模式=' + (solo ? 'solo（單人：右塔隱藏）' : 'dual（雙隊：兩座塔）')
              + ' · 右塔 hidden=' + rightHidden,
          };
        })()`,
      },
    },

    { shot: 'playtest-boss-2-after-answer' },

    // ── 答錯反饋 ──
    // ⚠️ 實測（cycle111i playtest）：經典畫面嘅「逐個選項 .correct/.wrong 標記」
    //    存活時間係 **同一個 tick** —— highlightBtn 加咗 class，但 _scheduleNextQuestion
    //    delay=0 → nextQuestion → `area.innerHTML=''` 即刻清走（實測 t0=1 / 下一 tick=0）。
    //    所以學生實際見到嘅反饋係「instant-hint 浮層 + 錯題入 review 隊列」，
    //    呢度鎖呢個**真實契約**（唔係鎖一個死 class）。
    {
      assert: {
        label: '答錯 → 學生見到正確答案（instant-hint 浮層）+ 錯題入 review 隊列',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const q = Game.state.current.knight;
          if (!q) return { ok: false, detail: '冇題目' };
          const want = String(q.answer);
          const opts = Array.from(document.querySelectorAll('#screen-game .option-btn'));
          const wrong = opts.find(b => !b.textContent.includes(want));
          if (!wrong) return { ok: false, detail: '搵唔到錯答鈕' };
          const reviewBefore = (Game.state.review || []).length;
          wrong.click();
          await sleep(250);
          const hint = document.querySelector('.instant-hint');
          const hintTxt = hint ? hint.textContent.replace(/\\s+/g, ' ').trim() : '';
          const reviewAfter = (Game.state.review || []).length;
          return {
            ok: !!hint && hintTxt.includes(want) && reviewAfter > reviewBefore,
            detail: 'instant-hint="' + hintTxt.slice(0, 48) + '" · review ' + reviewBefore + ' → ' + reviewAfter,
          };
        })()`,
      },
    },

    { shot: 'playtest-boss-3-wrong' },

    // ── 逐個選項 ✓/✗ 標記 ──
    // ✅ cycle111j 已修：經典路徑答完加延遲（答啱 650ms / 答錯 1000ms，跟 SEN 一致）
    //    + highlightBtn 移除時間由 700ms 延長到 2200ms → 學生真係見到 ✓/✗。
    //    之前 delay=0 → `area.innerHTML=''` 即刻清走 → 標記只存活同一個 tick（實測 t0=1 / 120ms=0）。
    {
      assert: {
        label: '經典畫面：逐個選項 ✓/✗ 標記喺答錯後仍然可見（學生見到自己揀錯咗）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          // ⚠️ cycle111j：經典畫面答完有 650/1000ms 延遲 → 嗰段時間 current[team] 係 null
          //    （_scheduleNextQuestion 會即刻清空），所以要先等下一題出現。
          let guard = 0;
          while (guard++ < 80 && !Game.state.current.knight) await sleep(50);
          const q = Game.state.current.knight;
          if (!q) return { ok: false, detail: '冇題目' };
          const want = String(q.answer);
          const opts = Array.from(document.querySelectorAll('#screen-game .option-btn'));
          const wrong = opts.find(b => !b.textContent.includes(want));
          if (!wrong) return { ok: false, detail: '搵唔到錯答鈕' };
          wrong.click();
          const t0 = document.querySelectorAll('#screen-game .option-btn.correct, #screen-game .option-btn.wrong').length;
          await sleep(120);
          const t120 = document.querySelectorAll('#screen-game .option-btn.correct, #screen-game .option-btn.wrong').length;
          return {
            ok: t120 > 0,
            detail: 'marked 同一 tick=' + t0 + ' · 120ms 後=' + t120
              + '（cycle111j：經典答完延遲 650/1000ms → 標記喺下一題出現前都仲喺度）',
          };
        })()`,
      },
    },
  ],
};
