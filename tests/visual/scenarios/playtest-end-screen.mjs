// tests/visual/scenarios/playtest-end-screen.mjs
//
// 【PLAYTEST · cycle111h 後】easy dual 接力收尾 + 結算畫面（概念卡 / 島嶼旅程）。
//
// 覆蓋三樣之前冇真機驗過嘅嘢：
//   ① 一隊做完 → 接力要跳過已完成隊伍（唔可以死鎖）+ banner 講「✅ X 完成咗 · 輪到 Y」
//   ② 結算畫面概念卡（M1–M4 4 粒圓點）+ 島嶼旅程 pips
//   ③ 單局實際題數 vs 畫面寫嘅「10 題」

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'playtest-end-screen',
  title: '接力收尾（跳過已完成隊伍）+ 結算畫面概念卡 / 島嶼旅程',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      Game.settings.difficulty = 'easy';
      Game.settings.playLayout = 'dual';
      Game.settings.scopes = ['count20'];
      Game.settings.types = ['count20'];
      ${ANSWER_TARGET_SRC}
      return 'ready';
    })()` },

    // ── 單局實際題數 vs 畫面文案 ──
    // ⚠️ xfail：目前 menu 一律寫「10 題」，但實際 target = 3 stages × 3 格 = 9 題。
    //    呢條斷言描述「**應有**嘅行為」（畫面宣稱 == 實際題數），所以而家係 fail。
    //    一日改好文案就會 pass → strict-xfail 會報「意外通過」→ 逼人移除 xfail 標記。
    {
      assert: {
        label: '畫面宣稱嘅題數 == 單局實際題數（goalStages × STAGE_CELLS）',
        xfail: true,
        expr: `(() => {
          const g = _stageGoalQuestions();
          const menu = document.getElementById('screen-menu');
          const txt = menu ? (menu.innerText || '') : '';
          const nums = Array.from(txt.matchAll(/(\\d+)\\s*題/g)).map(m => Number(m[1]));
          const uniq = Array.from(new Set(nums));
          const bad = uniq.filter(n => n !== g.target);
          return {
            ok: nums.length > 0 && bad.length === 0,
            detail: '實際 target=' + g.target + ' 題 · 畫面出現嘅題數=' + (uniq.join(',') || '(冇)')
              + (bad.length ? '（對唔上：' + bad.join(',') + '）' : '（一致）'),
          };
        })()`,
      },
    },

    { eval: `(() => { startGame(); return 'started'; })()` },
    { wait: 1200 },

    // ── 答到其中一隊完成 ──
    {
      assert: {
        label: '接力：一隊做完 → 跳過佢，另一隊繼續（唔死鎖）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          let guard = 0;
          // 答到有一隊 done 為止（每答一題 ~900ms）
          while (guard++ < 40) {
            const done = Game.state._easyTeamDone || {};
            if (done.knight && done.mage) break;
            const team = Game.state.currentTeam;
            const target = window.__answerTarget(team);
            if (!target) {
              await sleep(500);
              if (guard > 25) break;
              continue;
            }
            target.click();
            await sleep(850);
          }
          const done = Game.state._easyTeamDone || {};
          const b = document.getElementById('sen-turn-banner');
          return {
            ok: (done.knight || done.mage) && (Game.state.running === false || Game.state._easyEnding === true),
            detail: 'knight done=' + !!done.knight + ' · mage done=' + !!done.mage
              + ' · running=' + Game.state.running + ' · ending=' + Game.state._easyEnding
              + ' · banner="' + (b ? b.textContent.trim() : '') + '"',
          };
        })()`,
      },
    },

    { wait: 1500 },

    // ── 結算畫面 ──
    {
      assert: {
        label: '結算畫面：概念卡 render 到，每張有 4 粒里程碑圓點',
        expr: `(() => {
          const el = document.getElementById('end-concept-cards');
          const cards = el ? el.querySelectorAll('.concept-card') : [];
          const dots = el ? el.querySelectorAll('.concept-dots') : [];
          const filled = el ? Array.from(el.querySelectorAll('.concept-dots'))
            .map(d => (d.textContent.match(/●/g) || []).length) : [];
          return {
            ok: cards.length > 0 && dots.length === cards.length && dots.length > 0,
            detail: 'cards=' + cards.length + ' · dots 組=' + dots.length + ' · 已解鎖粒數=' + filled.join(','),
          };
        })()`,
      },
    },
    {
      assert: {
        label: '結算畫面：島嶼旅程 pips render 到（8 格）',
        expr: `(() => {
          const el = document.getElementById('end-island');
          const pips = el ? el.querySelectorAll('.island-pip') : [];
          const on = el ? el.querySelectorAll('.island-pip.on') : [];
          return {
            ok: pips.length === 8,
            detail: 'pips=' + pips.length + ' · 已亮=' + on.length
              + ' · label="' + (el ? el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) : '') + '"',
          };
        })()`,
      },
    },
    {
      assert: {
        label: 'M4 里程碑喺正常單局內**達得到**（一局題數 ≥ 連對門檻 10）',
        xfail: true,
        expr: `(() => {
          const goal = _stageGoalQuestions();
          const need = 10;   // M4: st.sessionStreak >= 10
          return {
            ok: goal.target >= need,
            detail: '一局 target=' + goal.target + ' 題 · M4 需要連對 ' + need
              + ' 題 → ' + (goal.target >= need ? '正常流程達得到' : '正常流程達唔到（死里程碑）')
              + (goal.hardCap >= need ? '（延長局 hardCap=' + goal.hardCap + ' 先可能）' : ''),
          };
        })()`,
      },
    },

    { shot: 'playtest-end-screen' },
  ],
};
