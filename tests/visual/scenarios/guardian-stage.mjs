// tests/visual/scenarios/guardian-stage.mjs
//
// 【cycle111c】關卡守護者（HP = Stage 進度格）+ F7 經典/boss 畫面進度格。
//
// 為咩要真機行（唔淨係 DOM 結構）：
//   · 「守護者 HP = 3 格進度格」係**狀態被改寫**嘅契約 —— 答啱填格 = 打守護者，
//     3 格填滿 = 守護者退場 = 過關。regex / mock 完全捉唔到「答完真係填咗格」。
//   · F7 嘅原缺陷就係「經典/boss 畫面**完全冇**進度格」—— 而家要真係見到格填咗。
//   · 守護者 sprite 係**動態換**（species per-Stage 鎖定）→ 淨睇 markup 唔夠，
//     要睇 `<use href>` 真係跟住 state 變。
//
// 契約（proposal §3.9 · AGENTS.md「Mechanism lock-in」）：
//   · HP 唔係獨立欄位 → 唯一真實來源 = `.sen-cell` 進度格
//   · 答啱 1 題 → 填 1 格 + 守護者受傷動畫
//   · 3 格填滿 → 守護者退場（is-defeated）+ stage index +1 + 格數歸零
//   · species = 題型 family，**per-Stage 鎖定**（唔係 per-question）
//   · prefers-reduced-motion 時唔可以郁（雙層 respect）

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'guardian-stage',
  title: '關卡守護者（HP = Stage 進度格）+ 經典/boss 畫面進度格',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      Game.settings.difficulty = 'easy';
      Game.settings.playLayout = 'solo';
      Game.settings.scopes = ['count20'];
      Game.settings.types = ['count20'];
      Game.settings.goalStages = 2;      // 2 關 = 6 題（第 3 題過第一關，但局未完）
      ${ANSWER_TARGET_SRC}
      window.__log = [];
      return 'ready';
    })()` },

    { eval: `(() => { startGame(); return 'started'; })()` },
    { wait: 1200 },

    // ── 1. 守護者 sprite 真係 render（唔係空 <svg>）──
    {
      assert: {
        label: '守護者 sprite 真係 render + href 跟住題型 family（唔係寫死）',
        expr: `(() => {
          const g = document.getElementById('sen-guardian-knight');
          const use = document.getElementById('sen-guardian-use-knight');
          if (!g || !use) return { ok: false, detail: '冇守護者 element' };
          const href = use.getAttribute('href') || '';
          const sym = href.startsWith('#') ? document.querySelector(href) : null;
          const q = Game.state.current.knight;
          const want = q ? '#' + _guardianSvgIdOf(q.type) : '(no-q)';
          const r = g.getBoundingClientRect();
          return {
            ok: !!sym && href === want && r.width > 0 && r.height > 0,
            detail: 'href=' + href + ' · symbol 存在=' + !!sym
              + ' · 期望=' + want + ' · 尺寸=' + Math.round(r.width) + '×' + Math.round(r.height)
              + ' · aria="' + g.getAttribute('aria-label') + '"',
          };
        })()`,
      },
    },
    { shot: 'guardian-1-start' },

    // ── 2. 答啱 → 填 1 格 + 守護者受傷（HP 就係進度格）──
    {
      assert: {
        label: '答啱 → 進度格填 1 格（守護者 HP = Stage 3 格）+ 受傷動畫觸發',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const g = document.getElementById('sen-guardian-knight');
          const target = window.__answerTarget('knight');
          if (!target) return { ok: false, detail: '搵唔到答案目標' };
          const before = document.querySelectorAll('#sen-cells-knight .sen-cell.is-filled').length;
          target.click();
          const hurtNow = g.classList.contains('is-hurt');
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          await sleep(700);
          const after = document.querySelectorAll('#sen-cells-knight .sen-cell.is-filled').length;
          const aria = document.getElementById('sen-cells-knight').getAttribute('aria-valuenow');
          const st = Game.state.stage.knight;
          return {
            ok: before === 0 && after === 1 && aria === '1' && st.units === 4
              && (reduced ? !hurtNow : hurtNow),
            detail: 'filled ' + before + ' → ' + after + ' · aria-valuenow=' + aria
              + ' · stage.units=' + st.units + ' · 受傷動畫=' + hurtNow
              + ' · reduced-motion=' + reduced,
          };
        })()`,
      },
    },

    // ── 3. 答啱第 3 題 → 守護者退場 + 過關 + 格數歸零 ──
    {
      assert: {
        label: '第 3 題答啱 → 守護者退場（is-defeated）+ 關卡 +1 + 進度格歸零',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const g = document.getElementById('sen-guardian-knight');
          // 答第 2 題（第 1 題喺上一條 assert 答咗）→ 累計 2 格
          let guard = 0;
          while (guard++ < 80 && !Game.state.current.knight) await sleep(50);
          const t2 = window.__answerTarget('knight');
          if (!t2) return { ok: false, detail: '第 2 題搵唔到目標' };
          t2.click();
          await sleep(700);
          // 第 3 題（過關嗰下）—— click handler 係同步執行，即刻查退場 class
          guard = 0;
          while (guard++ < 80 && !Game.state.current.knight) await sleep(50);
          const t = window.__answerTarget('knight');
          if (!t) return { ok: false, detail: '第 3 題搵唔到目標' };
          t.click();
          const defeatedNow = g.classList.contains('is-defeated');
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          await sleep(800);
          const st = Game.state.stage.knight;
          const filled = document.querySelectorAll('#sen-cells-knight .sen-cell.is-filled').length;
          const label = document.getElementById('sen-stage-label-knight').textContent;
          return {
            ok: st.index === 1 && st.cleared === 1 && st.units === 0 && filled === 0
              && (reduced ? !defeatedNow : defeatedNow),
            detail: 'index=' + st.index + ' · cleared=' + st.cleared + ' · units=' + st.units
              + ' · 填住嘅格=' + filled + ' · 退場動畫=' + defeatedNow
              + ' · reduced-motion=' + reduced + ' · 關卡 label="' + label + '"',
          };
        })()`,
      },
    },
    { shot: 'guardian-2-stage-clear' },

    // ── 4. F7：經典 / boss 畫面有進度格，而且答啱真係填格 ──
    {
      assert: {
        label: 'F7：經典/boss 畫面有題目進度格 + 答啱填 1 格（原本完全冇）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          Game.settings.difficulty = 'normal';
          Game.settings.playLayout = 'solo';
          Game.settings.types = ['add10'];
          Game.settings.scopes = [];
          if (!Bosses.current) Bosses.current = Bosses.list[0];
          startGame();
          await sleep(1200);
          const wrap = document.getElementById('classic-cells-knight');
          if (!wrap) return { ok: false, detail: '經典畫面冇 classic-cells-knight（F7 未修）' };
          const cells = wrap.querySelectorAll('.sen-cell').length;
          const q = Game.state.current.knight;
          if (!q) return { ok: false, detail: '冇題目' };
          const want = String(q.answer);
          const opts = Array.from(document.querySelectorAll('#screen-game .option-btn'));
          const hit = opts.find(b => b.textContent.trim().replace(/^[A-C]\\s*/, '').trim() === want)
            || opts.find(b => b.textContent.includes(want));
          if (!hit) return { ok: false, detail: '搵唔到答案鈕（options=' + opts.length + '）' };
          hit.click();
          await sleep(1200);
          const filled = document.querySelectorAll('#classic-cells-knight .sen-cell.is-filled').length;
          const aria = wrap.getAttribute('aria-valuenow');
          const lbl = document.getElementById('classic-stage-label-knight');
          const st = Game.state.stage.knight;
          return {
            ok: cells === 3 && filled === 1 && st.units === 4,
            detail: '格數=' + cells + ' · 填咗=' + filled + ' · aria-valuenow=' + aria
              + ' · stage.units=' + st.units + ' · label="' + (lbl ? lbl.textContent : '?') + '"',
          };
        })()`,
      },
    },
    { shot: 'guardian-3-classic-progress' },
  ],
};
