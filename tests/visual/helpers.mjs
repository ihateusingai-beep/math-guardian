// tests/visual/helpers.mjs — 頁面內執行嘅共用 helper（source string）
//
// ⚠️ 為咩要抽埋一齊：三種題型嘅「可撳目標」唔同
//   ① 一般 MC            → .sen-opt-btn（.sen-opt-val === 答案）
//   ② tap-pair 長短/高矮 → .len-pair-hit[data-side] / .ht-pair-hit[data-side]
//   ③ pic-grid 卡片       → .pic-card-mini（index = q.options.indexOf(答案)）
//
// 之前兩個 scenario 各寫一份，其中一份漏咗 ③ → 每當 random 到 findLDrink
// 就 stall，結算畫面場景 flaky 咗（實測：3 次入面 1 次「screen-end 仲係 hidden」）。
// 同一個概念只有一個真實來源 → 抽埋一齊。

export const ANSWER_TARGET_SRC = `
window.__answerTarget = (team) => {
  const q = Game.state.current[team];
  if (!q) return null;
  const ans = String(q.answer);
  const panel = document.getElementById('sen-panel-' + team);
  if (!panel) return null;
  // ① 一般 MC
  const btns = Array.from(panel.querySelectorAll('.sen-opt-btn'));
  const byText = btns.find(b => {
    const v = b.querySelector('.sen-opt-val');
    return v && v.textContent.trim() === ans;
  });
  if (byText) return byText;
  // ② tap-pair（長短 / 高矮）
  const pair = panel.querySelector(
    '.len-pair-hit[data-side="' + ans + '"], .ht-pair-hit[data-side="' + ans + '"]');
  if (pair) return pair;
  // ③ pic-grid 卡片（index = q.options.indexOf(答案)）
  const cards = Array.from(panel.querySelectorAll('.pic-card-mini'));
  const idx = (q.options || []).indexOf(ans);
  if (idx >= 0 && cards[idx]) return cards[idx];
  return null;
};
`;

/** 頁面內通用嘅「撳正確答案 + 讀狀態」helper（source string） */
export const PICK_AND_SNAPSHOT_SRC = `
window.__pickAndSnapshot = async (team, sleep) => {
  const target = window.__answerTarget(team);
  if (!target) return { ok: false, why: 'no-target' };
  const snap = () => ({
    c: Game.state.teams[team].correct,
    w: Game.state.teams[team].wrong,
    t: Game.state.teams[team].total,
  });
  const before = snap();
  target.click();
  await sleep(700);
  const after = snap();
  return {
    ok: after.t === before.t + 1 && after.c === before.c + 1,
    before, after,
  };
};
`;

/** 遊戲 setup（localStorage + Profile + easy mode） */
export const SETUP_SRC = `
localStorage.setItem('mg2.onboardingDone', '1');
localStorage.removeItem('mg2.profile');
Profile.load();
Profile.data.levelByType = {};
Profile.data.levelStreak = {};
Game.settings.difficulty = 'easy';
Game.settings.playLayout = 'solo';
Game.settings.goalStages = 1;
`;
