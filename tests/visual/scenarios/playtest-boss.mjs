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
    // ⚠️ 呢個唔係「進度格」—— 城堡條係兩座城塔嘅 HP（#castle-left/right-fill），
    //    真實嘅「題目進度格」(.sen-cell) 只存在於 SEN 畫面，經典 boss 畫面冇。
    {
      assert: {
        label: '城堡 HP 條（左翼 / 右翼城塔）喺 boss 模式真係 render',
        expr: `(() => {
          const row = document.getElementById('castle-bar-row');
          const lf = document.getElementById('castle-left-fill');
          const rf = document.getElementById('castle-right-fill');
          const lt = document.getElementById('castle-left-text');
          const rt = document.getElementById('castle-right-text');
          return {
            ok: !!row && !row.classList.contains('hidden')
              && !!lf && !!rf && !!lt && !!rt
              && Number(lt.textContent) > 0 && Number(rt.textContent) > 0,
            detail: 'left=' + (lt ? lt.textContent : '?') + '(' + (lf ? lf.style.width : '?') + ')'
              + ' · right=' + (rt ? rt.textContent : '?') + '(' + (rf ? rf.style.width : '?') + ')',
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

    // ── 逐個選項 ✓/✗ 標記（已知缺陷）──
    // ⚠️ xfail：highlightBtn() 明明加咗 .correct/.wrong，但經典畫面
    //    _scheduleNextQuestion(team) delay=0 → nextQuestion → `area.innerHTML=''`
    //    即刻清走選項區 → 標記存活時間只有「同一個 tick」（實測 t0=1 / 下一 tick=0）。
    //    學生實際見到嘅係 instant-hint 浮層（見上面那條），唔係逐個選項反饋。
    //    呢條描述「**應有**嘅行為」，所以而家 fail → xfail 記 KNOWN-ISSUE。
    {
      assert: {
        label: '經典畫面：逐個選項 ✓/✗ 標記喺答錯後仍然可見（學生見到自己揀錯咗）',
        xfail: true,
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
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
              + '（highlightBtn 名義上保留 700ms，但選項區已被 innerHTML 清走）',
          };
        })()`,
      },
    },
  ],
};
