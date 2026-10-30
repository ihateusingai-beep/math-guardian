// tests/visual/scenarios/sen-l-capacity.mjs
//
// 守門 cycle111b 嘅 L 容量題改動：
//   - 目標容量固定 1L，級數改「其他 L 容量干擾項」數量
//   - L1 → 1L vs 2L · L2 → 1L vs 1.5L · L3 → 1L vs 1.5L vs 2L
//   - prompt 統一「邊支飲品有 1L?」
//   - 答案一定係飲品（之前可能抽到洗潔精）
//   - 新精靈 pkg-orange-2l 必須真係 render（唔係死 symbol）

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'sen-l-capacity',
  title: 'L 容量題：級數干擾項 + 飲品答案 + 新精靈 render',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      Profile.data.levelByType = {};
      Profile.data.levelStreak = {};
      Game.settings.difficulty = 'easy';
      Game.settings.scopes = ['findLDrink'];
      Game.settings.types = ['findLDrink'];
      Game.settings.playLayout = 'solo';
      Game.settings.goalStages = 1;
      ${ANSWER_TARGET_SRC}
      window.__startAt = (lv) => {
        // ⚠️ cycle111j：自動升降級已移除 → _scopeLevelOf() 恆返 L1，
        //    所以**唔可以再靠 Profile.data.levelByType 造級數**（嗰條路徑已失效）。
        //    L2/L3 嘅 render 路徑仍然有用（cycle 112 老師手動設級會行呢度）→
        //    所以直接 patch 級數函數（app.js 係 classic script → 頂層 function = 全域）。
        if (!window.__origScopeLevelOf) window.__origScopeLevelOf = window._scopeLevelOf;
        window._scopeLevelOf = () => lv;
        startGame();
        return 'started L' + lv;
      };
      return 'ready';
    })()` },
    { wait: 700 },

    // ---- L1 ----
    { eval: `window.__startAt(1)` },
    { wait: 900 },
    { eval: `(() => {
      const q = Game.state.current.knight;
      const panel = document.getElementById('sen-panel-knight');
      const uses = Array.from(panel.querySelectorAll('use')).map(u => u.getAttribute('href'));
      const promptEl = document.getElementById('sen-q-text-knight');
      window.__L1 = {
        type: q && q.type,
        answerName: q && q.extra && q.extra.answerName,
        answerPkg: q && q.extra && q.extra.answerPkg,
        items: q && q.extra && q.extra.items ? q.extra.items.map(i => i.name + '/' + i.pkg + (i.svgId ? '#' + i.svgId : '')) : [],
        altL: q && q.extra && q.extra.items
          ? q.extra.items.filter(i => /^[\\d.]+L$/.test(i.pkg) && i.pkg !== '1L').map(i => i.pkg).sort() : [],
        uses: uses,
        prompt: promptEl ? promptEl.textContent.trim() : '',
      };
      return JSON.stringify(window.__L1);
    })()` },
    { assert: { label: 'L1 題型 = findLDrink', expr: `(() => {
      const ok = window.__L1 && window.__L1.type === 'findLDrink';
      return { ok, detail: ok ? '' : JSON.stringify(window.__L1) };
    })()` } },
    { assert: { label: 'L1 干擾項 = 2L（1L vs 2L，明顯）', expr: `(() => {
      const ok = window.__L1 && window.__L1.altL.join(',') === '2L';
      return { ok, detail: ok ? '' : ('altL=' + JSON.stringify(window.__L1 && window.__L1.altL)) };
    })()` } },
    { assert: { label: '答案容量固定 1L', expr: `(() => {
      const ok = window.__L1 && window.__L1.answerPkg === '1L';
      return { ok, detail: ok ? '' : ('answerPkg=' + (window.__L1 && window.__L1.answerPkg)) };
    })()` } },
    { assert: { label: '答案一定係飲品（唔會係洗潔精 / 漂白水）', expr: `(() => {
      const bad = ['洗潔精','漂白水','醬油','油漆'];
      const n = window.__L1 && window.__L1.answerName;
      const ok = !!n && bad.indexOf(n) < 0;
      return { ok, detail: ok ? '' : ('answer=' + n) };
    })()` } },
    { assert: { label: '新精靈 pkg-orange-2l 真係 render 咗（唔係死 symbol）', expr: `(() => {
      const ok = !!(window.__L1 && window.__L1.uses.indexOf('#pkg-orange-2l') >= 0);
      return { ok, detail: ok ? '' : ('uses=' + JSON.stringify(window.__L1 && window.__L1.uses)) };
    })()` } },
    { assert: { label: 'prompt 係「邊支飲品有 1L?」', expr: `(() => {
      const p = window.__L1 && window.__L1.prompt;
      const ok = !!p && p.indexOf('1L') >= 0;
      return { ok, detail: ok ? p : ('prompt=' + p) };
    })()` } },
    // 撳正確嗰張卡 → 必須真係 register（cycle111e P0 守門）
    { eval: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const target = window.__answerTarget('knight');
      if (!target) { window.__clickResult = { ok: false, why: 'no-target' }; return 'no-target'; }
      const before = {
        c: Game.state.teams.knight.correct,
        w: Game.state.teams.knight.wrong,
        t: Game.state.teams.knight.total,
      };
      target.click();
      await sleep(700);
      const after = {
        c: Game.state.teams.knight.correct,
        w: Game.state.teams.knight.wrong,
        t: Game.state.teams.knight.total,
      };
      window.__clickResult = { before, after, ok: after.t === before.t + 1 && after.c === before.c + 1 };
      return JSON.stringify(window.__clickResult);
    })()` },
    { assert: { label: '撳正確卡片 → 答題真係 register（cycle111e P0）', expr: `(() => {
      const r = window.__clickResult;
      const ok = !!(r && r.ok);
      return { ok, detail: ok ? '' : JSON.stringify(r) };
    })()` } },
    { shot: 'l-capacity-L1' },

    // ---- L3 ----
    { eval: `window.__startAt(3)` },
    { wait: 900 },
    { eval: `(() => {
      const q = Game.state.current.knight;
      const panel = document.getElementById('sen-panel-knight');
      const uses = Array.from(panel.querySelectorAll('use')).map(u => u.getAttribute('href'));
      window.__L3 = {
        answerName: q && q.extra && q.extra.answerName,
        answerPkg: q && q.extra && q.extra.answerPkg,
        altL: q && q.extra && q.extra.items
          ? q.extra.items.filter(i => /^[\\d.]+L$/.test(i.pkg) && i.pkg !== '1L').map(i => i.pkg).sort() : [],
        uses: uses,
        count: q && q.extra && q.extra.items ? q.extra.items.length : 0,
      };
      return JSON.stringify(window.__L3);
    })()` },
    { assert: { label: 'L3 干擾項 = 1.5L + 2L（三選一）', expr: `(() => {
      const ok = window.__L3 && window.__L3.altL.join(',') === '1.5L,2L';
      return { ok, detail: ok ? '' : ('altL=' + JSON.stringify(window.__L3 && window.__L3.altL)) };
    })()` } },
    { assert: { label: 'L3 仍然係 4 個選項', expr: `(() => {
      const ok = window.__L3 && window.__L3.count === 4;
      return { ok, detail: ok ? '' : ('count=' + (window.__L3 && window.__L3.count)) };
    })()` } },
    { assert: { label: 'L3 兩個 L 干擾項嘅精靈都 render（soda 1.5L + orange 2L）', expr: `(() => {
      const u = (window.__L3 && window.__L3.uses) || [];
      const ok = u.indexOf('#pkg-soda-15l') >= 0 && u.indexOf('#pkg-orange-2l') >= 0;
      return { ok, detail: ok ? '' : ('uses=' + JSON.stringify(u)) };
    })()` } },
    { shot: 'l-capacity-L3' },
  ],
};
