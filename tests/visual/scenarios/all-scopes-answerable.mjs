// tests/visual/scenarios/all-scopes-answerable.mjs
//
// ⚠️ **最重要嘅一個守門**：每個 easy scope 學生都必須**撳得到答案**。
//
// 實測捉到嘅 P0（cycle111e）：L 容量 scope（learnL / findLDrink / findLItem）
// 喺 SEN 畫面嘅卡片係**冇 click handler 嘅 <div>** —— 學生見到 4 張卡但撳唔到，
// 由 cycle 89 起就係死路（經典畫面一直正常，所以冇人發現）。
//
// 每種題型嘅答題目標唔同：
//   ① 一般 MC          → .sen-opt-btn（.sen-opt-val === 答案）
//   ② tap-pair 長短/高矮 → .len-pair-hit[data-side] / .ht-pair-hit[data-side]
//   ③ pic-grid 卡片     → .pic-card-mini（index = q.options.indexOf(答案)）
//
// 呢個場景三種都覆蓋 —— 將來再加新 scope / 改 render 唔小心漏咗 handler 就會即刻紅。

const SCOPES = ['count20', 'compareLength', 'compareHeight', 'orderAsc20',
  'orderDesc20', 'learnL', 'findLDrink', 'findLItem'];

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'all-scopes-answerable',
  title: '所有 8 個 easy scope：學生都撳得到答案（cycle111e P0 守門）',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      Game.settings.difficulty = 'easy';
      Game.settings.playLayout = 'solo';
      Game.settings.goalStages = 1;
      ${ANSWER_TARGET_SRC}
      return 'ready';
    })()` },

    { eval: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const SCOPES = ${JSON.stringify(SCOPES)};
      const results = [];
      for (const sc of SCOPES) {
        Game.settings.scopes = [sc];
        Game.settings.types = [sc];
        startGame();
        await sleep(900);
        const q = Game.state.current.knight;
        if (!q) { results.push({ sc, ok: false, why: 'no-question' }); continue; }
        const panel = document.getElementById('sen-panel-knight');
        const target = window.__answerTarget('knight');
        if (!target) {
          results.push({
            sc, ok: false, why: '搵唔到可撳嘅答案目標', type: q.type, answer: String(q.answer),
            clickables: panel ? panel.querySelectorAll('button, .len-pair-hit, .ht-pair-hit, .pic-card-mini').length : 0,
          });
          continue;
        }
        const snap = () => ({
          c: Game.state.teams.knight.correct,
          w: Game.state.teams.knight.wrong,
          t: Game.state.teams.knight.total,
        });
        const before = snap();
        target.click();
        await sleep(700);
        const after = snap();
        results.push({
          sc, type: q.type, answer: String(q.answer), before, after,
          ok: after.t === before.t + 1 && after.c === before.c + 1,
        });
      }
      window.__scopeResults = results;
      return JSON.stringify(results);
    })()` },

    ...SCOPES.map((sc) => ({
      assert: {
        label: `scope ${sc} 學生撳得到 + 答得啱`,
        expr: `(() => {
          const r = (window.__scopeResults || []).find(x => x.sc === '${sc}');
          const ok = !!(r && r.ok);
          return { ok, detail: ok ? '' : JSON.stringify(r) };
        })()`,
      },
    })),
  ],
};
