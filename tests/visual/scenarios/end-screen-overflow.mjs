// tests/visual/scenarios/end-screen-overflow.mjs
//
// ⚠️ **核心守門**：學校 iPad 係 639×669。cycle110b 實測過 end screen 喺呢個尺寸
//    爆 232px —— 概念卡 / 島嶼跌出畫面、「再玩一次」要捲到底先撳到。
//    當時只係靠 AGENTS.md 一行文字守住，冇任何可執行嘅 check。
//    呢個 scenario 就係嗰個防線。
//
// ⚠️ 注意：#screen-end 係**自己嘅 scroll container**（height:100vh; overflow-y:auto），
//    所以 page 本身唔會 overflow —— 要量嘅係「內容喺捲動 0 位置可唔可以見到」。
//
// 場景用 dual coop（最壞情況：雙隊 medal 🥇🥇 + 3 張概念卡 + 島嶼 + stats + badges）。

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'end-screen-overflow',
  title: '結算畫面喺 639×669 唔准 overflow（cycle110b P1 守門）',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      Profile.data.levelByType = {};
      Profile.data.levelStreak = {};
      Game.settings.difficulty = 'easy';
      // 全部都係 MC 題型（options 喺 #sen-options-<team> .sen-opt-btn），
      // 避免 tap-pair（compareLength）冇 option button 撳唔到。
      Game.settings.scopes = ['count20', 'orderAsc20', 'findLDrink'];
      Game.settings.types = ['count20', 'orderAsc20', 'findLDrink'];
      Game.settings.playLayout = 'dual';
      Game.settings.dualTeam = 'coop';
      Game.settings.playerLabel = '小明';
      Game.settings.playerLabelRight = '小美';
      Game.settings.goalStages = 1;
      startGame();
      window.__stall = {};
      ${ANSWER_TARGET_SRC}
      window.__pickRight = (team) => {
        const q = Game.state.current[team];
        if (!q) return 'no-question';
        const target = window.__answerTarget(team);
        if (!target) {
          window.__stall[q.type] = (window.__stall[q.type] || 0) + 1;
          return 'no-target:' + q.type;
        }
        target.click();
        return 'clicked:' + q.type;
      };
      return 'started';
    })()` },
    { wait: 900 },

    // 答到遊戲結束
    { eval: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const endVisible = () => {
        const el = document.getElementById('screen-end');
        return el && !el.classList.contains('hidden');
      };
      let n = 0, last = '';
      while (!endVisible() && n < 90) {
        const t = Game.state.currentTeam;
        const q = Game.state.current[t];
        if (!q) { await sleep(150); n++; continue; }
        const r = window.__pickRight(t);
        last = r;
        n++;
        await sleep(750);
      }
      return JSON.stringify({ steps: n, last, endVisible: endVisible(), stall: window.__stall });
    })()` },
    { wait: 1400 },

    // 量度（先 print 嚟睇實際數值）
    { eval: `(() => {
      const el = document.getElementById('screen-end');
      const cc = document.getElementById('end-concept-cards');
      const isl = document.getElementById('end-island');
      const st = document.getElementById('end-stats');
      const restart = document.getElementById('btn-restart');
      const back = document.getElementById('btn-back-menu');
      const medal = document.getElementById('end-medal');
      const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
      return JSON.stringify({
        innerH: window.innerHeight,
        innerW: window.innerWidth,
        screen: { scrollH: el.scrollHeight, clientH: el.clientHeight, scrollW: el.scrollWidth, clientW: el.clientWidth },
        docScrollH: document.documentElement.scrollHeight,
        conceptCards: R(cc), island: R(isl), stats: R(st),
        restart: R(restart), back: R(back), medal: R(medal),
        medalText: medal ? medal.textContent.trim() : null,
        conceptCount: cc ? cc.querySelectorAll('.concept-card').length : 0,
        islandHtmlLen: isl ? isl.innerHTML.length : 0,
        statsHtmlLen: st ? st.innerHTML.length : 0,
      });
    })()` },

    // ---- 斷言 ----
    { assert: { label: '答案掣一定搵到（冇 type stall 搵唔到正確選項）', expr: `(() => {
      const s = window.__stall || {};
      const bad = Object.keys(s).filter(k => s[k] > 0);
      const ok = bad.length === 0;
      return { ok, detail: ok ? '' : ('stall=' + JSON.stringify(s)) };
    })()` } },

    { assert: { label: '結算畫面已顯示', expr: `(() => {
      const el = document.getElementById('screen-end');
      const ok = !!el && !el.classList.contains('hidden');
      return { ok, detail: ok ? '' : 'screen-end 仲係 hidden' };
    })()` } },

    { assert: { label: '概念卡 + 島嶼喺 end-stats 上面（cycle110b 修正嘅順序）', expr: `(() => {
      const cc = document.getElementById('end-concept-cards');
      const st = document.getElementById('end-stats');
      if (!cc || !st) return { ok: false, detail: '搵唔到 element' };
      const a = cc.getBoundingClientRect(), b = st.getBoundingClientRect();
      const ok = a.top < b.top;
      return { ok, detail: ok ? '' : ('concept.top=' + Math.round(a.top) + ' stats.top=' + Math.round(b.top)) };
    })()` } },

    { assert: { label: '捲動 0 位置就見到概念卡（唔使捲先見到新卡）', expr: `(() => {
      const cc = document.getElementById('end-concept-cards');
      if (!cc || !cc.querySelector('.concept-card')) return { ok: true, detail: '冇概念卡（skip）' };
      const b = cc.getBoundingClientRect();
      const ok = b.top >= -1 && b.bottom <= window.innerHeight + 1;
      return { ok, detail: ok ? '' : ('top=' + Math.round(b.top) + ' bottom=' + Math.round(b.bottom) + ' innerH=' + window.innerHeight) };
    })()` } },

    { assert: { label: '「再玩一次」掣喺 viewport 內（sticky，唔使捲到底）', expr: `(() => {
      const b = document.getElementById('btn-restart');
      if (!b) return { ok: false, detail: '搵唔到 #btn-restart' };
      const r = b.getBoundingClientRect();
      const ok = r.top >= -1 && r.bottom <= window.innerHeight + 1;
      return { ok, detail: ok ? '' : ('top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' innerH=' + window.innerHeight) };
    })()` } },

    { assert: { label: '「返回主選單」掣喺 viewport 內', expr: `(() => {
      const b = document.getElementById('btn-back-menu');
      if (!b) return { ok: false, detail: '搵唔到 #btn-back-menu' };
      const r = b.getBoundingClientRect();
      const ok = r.top >= -1 && r.bottom <= window.innerHeight + 1;
      return { ok, detail: ok ? '' : ('top=' + Math.round(r.top) + ' bottom=' + Math.round(r.bottom) + ' innerH=' + window.innerHeight) };
    })()` } },

    { assert: { label: '雙隊 medal 唔會換行（🥇🥇 疊咗標題就係 bug）', expr: `(() => {
      const m = document.getElementById('end-medal');
      if (!m || m.classList.contains('hidden')) return { ok: true, detail: '冇 medal（skip）' };
      const cs = getComputedStyle(m);
      // .end-medal: font-size 4rem / line-height 1 → 一行 = 64px，換行 = 128px
      const lh = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 64);
      const h = m.getBoundingClientRect().height;
      const ok = h <= lh * 1.5;
      return { ok, detail: ok ? ('h=' + Math.round(h) + ' lineHeight=' + Math.round(lh))
                             : ('h=' + Math.round(h) + ' > 1.5× lineHeight(' + Math.round(lh) + ') = 換行咗') };
    })()` } },

    { assert: { label: '結算畫面冇水平 overflow（唔會左右搖）', expr: `(() => {
      const el = document.getElementById('screen-end');
      const ok = el.scrollWidth <= el.clientWidth + 1;
      return { ok, detail: ok ? '' : ('scrollW=' + el.scrollWidth + ' clientW=' + el.clientWidth) };
    })()` } },

    { assert: { label: '結算畫面內部捲動幅度受控（< 420px）', expr: `(() => {
      const el = document.getElementById('screen-end');
      const over = el.scrollHeight - el.clientHeight;
      const ok = over <= 420;
      return { ok, detail: ok ? ('overflow=' + over + 'px') : ('overflow=' + over + 'px 超出 420') };
    })()` } },

    { shot: 'end-screen-639' },
  ],
};
