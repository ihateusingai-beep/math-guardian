// tests/visual/scenarios/sen-answer-feedback.mjs
//
// 守門 cycle111f 嘅 game feel：SEN 畫面嘅**逐個選項反饋**。
//
// 背景：project `docs/UI_STYLE_GUIDE.md` §12 訂明「答對 = ✅ flash + 綠邊 / 答錯 = ❌ flash + 紅邊」。
// 經典畫面一直有（`.option-btn.correct/.wrong` + ✓/✗），但 SEN 畫面（目標學生行嘅路徑）冇 ——
// 學生只見到全屏 overlay，睇唔出邊個答啱。
//
// 驗嘅係「撳落去之後畫面真係有反饋」而唔係「元素存在」：
//   ① 撳啱  → 被撳嗰個掣有 .is-correct + ✓ badge + pop animation
//   ② 撳錯  → 被撳嗰個掣有 .is-wrong + ✕ badge，正確嗰個被揭示（.is-correct）
//   ③ pic-grid 卡片（findLDrink）→ 同一套反饋
//   ④ P0 幾何守門：verdict band 唔可以壓住任何選項掣（詳見下面 P0 段落）
//
// ⚠️ SEN 安全鎖：錯嘅掣**唔可以**係刺眼紅（用藍灰）· 唔可以有 screen shake
//
// ⏱ 量測時機：答錯後 1000ms 先重播新題（`_scheduleNextQuestion(team, 1000)`），
//    而 verdict band 滑入動畫 280ms 完成 → 穩定窗口 = 300–900ms，實測用 450ms。

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'sen-answer-feedback',
  title: 'SEN 逐個選項反饋：狀態 class + ✓/✕ badge + pop（cycle111f game feel）',
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
      window.__read = (team) => {
        const panel = document.getElementById('sen-panel-' + team);
        const btns = Array.from(panel.querySelectorAll('.sen-opt-btn, .pic-card-mini'));
        return btns.map(b => {
          const after = getComputedStyle(b, '::after');
          return {
            letter: b.dataset.letter || null,
            isCorrect: b.classList.contains('is-correct'),
            isWrong: b.classList.contains('is-wrong'),
            badge: after ? after.content : '',
            anim: getComputedStyle(b).animationName,
            bg: getComputedStyle(b).backgroundColor,
          };
        });
      };
      window.__wrongTarget = (team) => {
        const q = Game.state.current[team];
        if (!q) return null;
        const panel = document.getElementById('sen-panel-' + team);
        const ans = String(q.answer);
        const btns = Array.from(panel.querySelectorAll('.sen-opt-btn'));
        const b = btns.find(x => {
          const v = x.querySelector('.sen-opt-val');
          return v && v.textContent.trim() !== ans;
        });
        if (b) return b;
        const cards = Array.from(panel.querySelectorAll('.pic-card-mini'));
        const idx = (q.options || []).indexOf(ans);
        const other = cards.find((c, i) => i !== idx);
        return other || null;
      };
      return 'ready';
    })()` },

    // ---- 撳啱 ----
    { eval: `(() => {
      Game.settings.scopes = ['count20'];
      Game.settings.types = ['count20'];
      startGame();
      return 'started';
    })()` },
    { wait: 900 },
    { eval: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const target = window.__answerTarget('knight');
      if (!target) { window.__R1 = { error: 'no-target' }; return 'no-target'; }
      target.click();
      await sleep(450);
      window.__R1 = { states: window.__read('knight'), letter: target.dataset.letter };
      return JSON.stringify(window.__R1);
    })()` },
    { assert: { label: '撳啱 → 被撳嗰個掣有 .is-correct', expr: `(() => {
      const r = window.__R1 || {};
      const st = (r.states || []).find(x => x.letter === r.letter);
      const ok = !!(st && st.isCorrect);
      return { ok, detail: ok ? '' : JSON.stringify(r) };
    })()` } },
    { assert: { label: '撳啱 → 有 ✓ badge（唔淨係靠顏色，project §12 規則）', expr: `(() => {
      const r = window.__R1 || {};
      const st = (r.states || []).find(x => x.letter === r.letter);
      const ok = !!(st && st.badge && st.badge.indexOf('✓') >= 0);
      return { ok, detail: ok ? '' : JSON.stringify(st) };
    })()` } },
    { assert: { label: '撳啱 → pop animation 真係行緊（squash & stretch）', expr: `(() => {
      const r = window.__R1 || {};
      const st = (r.states || []).find(x => x.letter === r.letter);
      const ok = !!(st && st.anim && st.anim.indexOf('sen-fx-pop-correct') >= 0);
      return { ok, detail: ok ? '' : JSON.stringify(st) };
    })()` } },
    { assert: { label: '撳啱 → verdict band 唔覆蓋任何一個選項掣', expr: `(() => {
      const band = document.querySelector('#sen-feedback-knight .sen-fb-band');
      if (!band) return { ok: false, detail: '搵唔到 .sen-fb-band' };
      const b = band.getBoundingClientRect();
      const panel = document.getElementById('sen-panel-knight');
      const bad = [];
      panel.querySelectorAll('.sen-opt-btn, .pic-card-mini').forEach(el => {
        const r = el.getBoundingClientRect();
        const ox = Math.min(b.right, r.right) - Math.max(b.left, r.left);
        const oy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (ox > 0 && oy > 0) bad.push(el.dataset.letter + '(' + Math.round(ox) + 'x' + Math.round(oy) + ')');
      });
      return { ok: bad.length === 0, detail: 'band.top=' + Math.round(b.top) + ' overlap=' + bad.join(',') };
    })()` } },
    { shot: 'sen-feedback-correct' },

    // ---- 撳錯 ----
    { eval: `(() => {
      Game.settings.scopes = ['count20'];
      Game.settings.types = ['count20'];
      startGame();
      return 'started';
    })()` },
    { wait: 900 },
    { eval: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const q = Game.state.current.knight;
      const target = window.__wrongTarget('knight');
      if (!target) { window.__R2 = { error: 'no-wrong-target' }; return 'no-target'; }
      const answerLetter = String(q.answer);
      target.click();
      await sleep(450);
      window.__R2 = {
        states: window.__read('knight'),
        tapped: target.dataset.letter,
        answerLetter,
      };
      return JSON.stringify(window.__R2);
    })()` },
    { assert: { label: '撳錯 → 被撳嗰個掣有 .is-wrong', expr: `(() => {
      const r = window.__R2 || {};
      const st = (r.states || []).find(x => x.letter === r.tapped);
      const ok = !!(st && st.isWrong);
      return { ok, detail: ok ? '' : JSON.stringify(r) };
    })()` } },
    { assert: { label: '撳錯 → 有 ✕ badge', expr: `(() => {
      const r = window.__R2 || {};
      const st = (r.states || []).find(x => x.letter === r.tapped);
      const ok = !!(st && st.badge && st.badge.indexOf('✕') >= 0);
      return { ok, detail: ok ? '' : JSON.stringify(st) };
    })()` } },
    { assert: { label: '撳錯 → 正確選項被揭示（教學時刻）', expr: `(() => {
      const r = window.__R2 || {};
      const revealed = (r.states || []).filter(x => x.isCorrect);
      const ok = revealed.length === 1 && revealed[0].letter !== r.tapped;
      return { ok, detail: ok ? '' : JSON.stringify(r) };
    })()` } },
    { assert: { label: 'SEN 安全：答錯唔係刺眼紅（用藍灰 #e2e8f0）', expr: `(() => {
      const r = window.__R2 || {};
      const st = (r.states || []).find(x => x.letter === r.tapped);
      if (!st) return { ok: false, detail: '搵唔到被撳嗰個掣' };
      const isRed = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.test(st.bg || '')
        && RegExp.$1 > 180 && RegExp.$2 < 90 && RegExp.$3 < 90;
      return { ok: !isRed, detail: 'bg=' + st.bg };
    })()` } },
    { assert: { label: '撳錯 → 答啱同答錯兩個掣嘅底色明顯唔同（全屏 wash 唔可以食掉狀態色）', expr: `(() => {
      const r = window.__R2 || {};
      const wrong = (r.states || []).find(x => x.letter === r.tapped);
      const right = (r.states || []).find(x => x.isCorrect);
      if (!wrong || !right) return { ok: false, detail: '搵唔到兩個狀態' };
      const px = s => { const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(s || ''); return m ? [+m[1], +m[2], +m[3]] : null; };
      const a = px(wrong.bg), b = px(right.bg);
      if (!a || !b) return { ok: false, detail: 'bg 讀唔到 ' + wrong.bg + ' / ' + right.bg };
      const diff = Math.max(Math.abs(a[0]-b[0]), Math.abs(a[1]-b[1]), Math.abs(a[2]-b[2]));
      return { ok: diff >= 20, detail: 'wrong=' + wrong.bg + ' right=' + right.bg + ' diff=' + diff };
    })()` } },

    // ---- P0 守門：verdict band 唔可以壓住選項掣 ----
    // 舊版（cycle88）係全屏 overlay 置中放 5.5rem 大字：
    //   實測 639×669 → stamp 文字 397×92px @ y289–380，選項掣 A @ y274–384
    //   → 重疊 352×91 = 32,032 px²，被揭示嘅正確答案完全被蓋死（實機截圖實證）。
    { assert: { label: 'P0：verdict band 唔覆蓋任何一個選項掣', expr: `(() => {
      const band = document.querySelector('#sen-feedback-knight .sen-fb-band');
      if (!band) return { ok: false, detail: '搵唔到 .sen-fb-band' };
      const b = band.getBoundingClientRect();
      const panel = document.getElementById('sen-panel-knight');
      const bad = [];
      panel.querySelectorAll('.sen-opt-btn, .pic-card-mini').forEach(el => {
        const r = el.getBoundingClientRect();
        const ox = Math.min(b.right, r.right) - Math.max(b.left, r.left);
        const oy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (ox > 0 && oy > 0) bad.push(el.dataset.letter + '(' + Math.round(ox) + 'x' + Math.round(oy) + ')');
      });
      return { ok: bad.length === 0, detail: 'band=' + JSON.stringify({
        top: Math.round(b.top), bottom: Math.round(b.bottom) }) + ' overlap=' + bad.join(',') };
    })()` } },
    { assert: { label: 'P0：被揭示嘅正確答案，內容完全冇被遮（學生要見到「邊個啱」）', expr: `(() => {
      const band = document.querySelector('#sen-feedback-knight .sen-fb-band');
      const panel = document.getElementById('sen-panel-knight');
      const val = panel.querySelector('.sen-opt-btn.is-correct .sen-opt-val');
      if (!band || !val) return { ok: false, detail: 'band/val 唔齊' };
      const b = band.getBoundingClientRect();
      const v = val.getBoundingClientRect();
      const ox = Math.min(b.right, v.right) - Math.max(b.left, v.left);
      const oy = Math.min(b.bottom, v.bottom) - Math.max(b.top, v.top);
      return { ok: !(ox > 0 && oy > 0), detail: 'val=' + val.textContent.trim() + ' overlapY=' + Math.round(oy) };
    })()` } },
    { assert: { label: 'P0：band 貼喺 panel 頂部（疊 head 帶，唔係置中）', expr: `(() => {
      const band = document.querySelector('#sen-feedback-knight .sen-fb-band');
      const panel = document.getElementById('sen-panel-knight');
      if (!band || !panel) return { ok: false, detail: 'band/panel 唔齊' };
      const b = band.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      const h = b.bottom - b.top;
      // ① 貼喺 panel 頂
      const topOk = Math.abs(b.top - p.top) <= 2;
      // ② 高度唔可以係成個 panel（head 帶 ≈64px）—— 呢個先捉到「inset:0 置中」復辟
      const hOk = h <= 100;
      // ③ 唔可以覆蓋 Stage 進度格（獎勵訊號）
      let cellOk = true, cellDetail = '';
      panel.querySelectorAll('.sen-cell').forEach(cell => {
        const c = cell.getBoundingClientRect();
        const ox = Math.min(b.right, c.right) - Math.max(b.left, c.left);
        const oy = Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top);
        if (ox > 1 && oy > 1) { cellOk = false; cellDetail = 'cell y' + Math.round(c.top) + '-' + Math.round(c.bottom); }
      });
      const ok = topOk && hOk && cellOk;
      return { ok, detail: 'band.top=' + Math.round(b.top) + ' h=' + Math.round(h)
        + ' topOk=' + topOk + ' hOk=' + hOk + ' cellOk=' + cellOk + cellDetail };
    })()` } },
    { shot: 'sen-feedback-wrong' },

    // ---- pic-grid（findLDrink）都要有反饋 ----
    { eval: `(() => {
      Game.settings.scopes = ['findLDrink'];
      Game.settings.types = ['findLDrink'];
      startGame();
      return 'started';
    })()` },
    { wait: 900 },
    { eval: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const target = window.__answerTarget('knight');
      if (!target) { window.__R3 = { error: 'no-target' }; return 'no-target'; }
      target.click();
      await sleep(450);
      const panel = document.getElementById('sen-panel-knight');
      const cards = Array.from(panel.querySelectorAll('.pic-card-mini'));
      window.__R3 = {
        letter: target.dataset.letter,
        states: cards.map(c => ({
          letter: c.dataset.letter,
          isCorrect: c.classList.contains('is-correct'),
          badge: getComputedStyle(c, '::after').content,
          anim: getComputedStyle(c).animationName,
        })),
      };
      return JSON.stringify(window.__R3);
    })()` },
    { assert: { label: 'pic-grid 卡片都有同一套反饋（.is-correct + ✓ + pop）', expr: `(() => {
      const r = window.__R3 || {};
      const st = (r.states || []).find(x => x.letter === r.letter);
      const ok = !!(st && st.isCorrect && st.badge && st.badge.indexOf('✓') >= 0
        && st.anim && st.anim.indexOf('sen-fx-pop-correct') >= 0);
      return { ok, detail: ok ? '' : JSON.stringify(r) };
    })()` } },
    { assert: { label: 'pic-grid：verdict band 唔覆蓋任何一張卡片', expr: `(() => {
      const band = document.querySelector('#sen-feedback-knight .sen-fb-band');
      if (!band) return { ok: false, detail: '搵唔到 .sen-fb-band' };
      const b = band.getBoundingClientRect();
      const panel = document.getElementById('sen-panel-knight');
      const bad = [];
      panel.querySelectorAll('.pic-card-mini').forEach(el => {
        const r = el.getBoundingClientRect();
        const ox = Math.min(b.right, r.right) - Math.max(b.left, r.left);
        const oy = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
        if (ox > 0 && oy > 0) bad.push(el.dataset.letter);
      });
      return { ok: bad.length === 0, detail: 'overlap=' + bad.join(',') };
    })()` } },
    { shot: 'sen-feedback-picgrid' },
  ],
};
