// tests/visual/scenarios/playtest-relay-level.mjs
//
// 【PLAYTEST · cycle111h 後】easy dual「接力」+ scope 內級數階梯 —— 兩個核心機制。
//
// ⚠️ 呢兩個機制都係 cycle110 / cycle111b 先落地嘅，而且都係「狀態被改寫」嘅邏輯
//    （接力 = currentTeam 喺兩隊之間跳；級數 = levelByType 喺答題後被改寫）。
//    之前嘅守門係 regex + mock 執行，**冇真機行過一次完整接力**。
//
// 接力嘅契約（proposal §3.9 / AGENTS.md）：
//   · 每答完一題就傳手畀另一隊
//   · 答錯 → 同一條題傳俾另一隊救（單一重播槽）
//   · 一隊做完 → 接力要跳過已完成嘅隊伍（唔可以死鎖）
//   · 只有「輪到嗰隊」嘅 SEN panel 可見 + 頂部 banner
//
// 級數階梯嘅契約（cycle111b）：
//   · 連續 4 對升級 · 連續 3 錯降級 · 級數只改同一個 type 嘅難度
//   · count20：L1 上限 3 / L2 上限 5 / L3 上限 10

import { ANSWER_TARGET_SRC } from '../helpers.mjs';

export default {
  name: 'playtest-relay-level',
  title: 'easy dual 接力 + scope 級數階梯：真機跑一次完整流程',
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
      Game.settings.goalStages = 1;
      ${ANSWER_TARGET_SRC}
      window.__log = [];
      return 'ready';
    })()` },

    // ── 開局 ──
    { eval: `(() => { startGame(); return 'started'; })()` },
    { wait: 1200 },

    // ── 1. 只有輪到嗰隊嘅 panel 可見 ──
    {
      assert: {
        label: '接力開局：只有一隊 panel 可見 + banner 講明輪到邊隊',
        expr: `(() => {
          const k = document.getElementById('sen-panel-knight');
          const m = document.getElementById('sen-panel-mage');
          const b = document.getElementById('sen-turn-banner');
          const vis = ['knight', 'mage'].filter(t => {
            const p = document.getElementById('sen-panel-' + t);
            return p && !p.classList.contains('hidden');
          });
          return {
            ok: vis.length === 1 && !!b && !b.classList.contains('hidden') && /輪到/.test(b.textContent),
            detail: 'visible panels=' + vis.join(',') + ' · banner="' + (b ? b.textContent.trim() : '(none)') + '"',
          };
        })()`,
      },
    },
    { shot: 'playtest-relay-1-start' },

    // ── 2. 答啱 → 傳手 ──
    {
      assert: {
        label: '答啱 → 傳手畀另一隊（currentTeam 換人 + banner 更新）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const before = Game.state.currentTeam;
          const target = window.__answerTarget(before);
          if (!target) return { ok: false, detail: '搵唔到答案目標（team=' + before + '）' };
          target.click();
          await sleep(1100);
          const after = Game.state.currentTeam;
          const b = document.getElementById('sen-turn-banner');
          const vis = ['knight', 'mage'].filter(t => {
            const p = document.getElementById('sen-panel-' + t);
            return p && !p.classList.contains('hidden');
          });
          return {
            ok: after !== before && vis.length === 1 && vis[0] === after,
            detail: before + ' → ' + after + ' · visible=' + vis.join(',')
              + ' · banner="' + (b ? b.textContent.trim() : '') + '"',
          };
        })()`,
      },
    },

    // ── 3. 答錯 → 同一隊重播同一條題（唔係抽新題）──
    {
      assert: {
        label: '答錯 → 同一條題傳俾**另一隊**救（重播槽，唔係抽新題）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const team = Game.state.currentTeam;
          const other = team === 'knight' ? 'mage' : 'knight';
          const qBefore = Game.state.current[team];
          const ansBefore = qBefore ? String(qBefore.answer) : null;
          const panel = document.getElementById('sen-panel-' + team);
          const opts = Array.from(panel.querySelectorAll('.sen-opt-btn'));
          const wrong = opts.find(b => {
            const v = b.querySelector('.sen-opt-val');
            return v && v.textContent.trim() !== ansBefore;
          }) || opts[0];
          if (!wrong) return { ok: false, detail: 'panel 冇可撳選項（team=' + team + '）' };
          wrong.click();
          await sleep(1400);
          const qAfter = Game.state.current[other];
          return {
            ok: Game.state.currentTeam === other && qAfter && String(qAfter.answer) === ansBefore,
            detail: team + ' 答錯 → 傳俾 ' + other + ' · answer ' + ansBefore + ' → '
              + (qAfter ? qAfter.answer : '(null)') + ' · currentTeam=' + Game.state.currentTeam,
          };
        })()`,
      },
    },

    // ── 4. 級數固定 L1（cycle111j：自動升降級已移除）──
    {
      assert: {
        label: '級數固定 L1：連續 4 題答啱都唔會升級（學生唔會再見到升/降級提示）',
        expr: `(async () => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          // 轉返 solo + 乾淨 level 狀態
          Game.settings.playLayout = 'solo';
          Game.settings.goalStages = 4;      // 預設：4 關 = 12 題
          Profile.data.levelByType = { count20: 3 };   // 模擬舊 profile 殘留 L3
          Profile.data.levelStreak = {};
          Profile.save();
          Game.settings.scopes = ['count20'];
          Game.settings.types = ['count20'];
          startGame();
          await sleep(900);
          const seen = [];
          for (let i = 0; i < 4; i++) {
            const team = Game.state.currentTeam;
            const target = window.__answerTarget(team);
            if (!target) return { ok: false, detail: '第 ' + i + ' 題搵唔到目標' };
            target.click();
            await sleep(900);
            const q = Game.state.current[team];
            if (q) seen.push(Number(q.answer));
          }
          const lv = _scopeLevelOf('count20');
          // L1 上限 = 3：生成器答案一定要 <= 3（唔會升到 L2/L3）
          let max = 0;
          for (let i = 0; i < 30; i++) {
            const q = Generators.count20('easy', _scopeLevelOf('count20'));
            max = Math.max(max, Number(q.answer));
          }
          return {
            ok: lv === 1 && max <= 3,
            detail: '連對 4 題後 level=' + lv + '（舊 profile 殘留 L3 都冇用）'
              + ' · 4 題答案=' + seen.join(',') + ' · 30 次生成最大=' + max + '（L1 上限 3）',
          };
        })()`,
      },
    },

    // ── 5. 級數跨「重新載入」都係 L1 ──
    {
      assert: {
        label: '級數跨「重新載入」都固定 L1（Profile 有殘留 levelByType 都唔會影響）',
        expr: `(() => {
          Profile.data.levelByType = { count20: 3 };
          Profile.save();
          const before = _scopeLevelOf('count20');
          Profile.load();          // 模擬重新開 app（由 localStorage 讀返）
          const after = _scopeLevelOf('count20');
          return {
            ok: before === 1 && after === 1,
            detail: 'reload 前=' + before + ' · reload 後=' + after
              + ' · localStorage levelByType=' + JSON.stringify(Profile.data.levelByType),
          };
        })()`,
      },
    },

    { shot: 'playtest-relay-2-level' },
  ],
};
