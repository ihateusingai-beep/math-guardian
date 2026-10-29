// tests/visual/scenarios/boot-console-clean.mjs
//
// 守門「boot 乾淨」：頁面載入完**零 console error + 零未捕獲例外**，
// 而且關鍵嘅 boot 步驟真係行過。
//
// ⚠️ 點解要有呢個 scenario（cycle111h 實測）：
//   之前 52 條視覺守門**完全唔睇 console** → 一個「boot 到一半 throw 咗」嘅 P0
//   可以在線上站存在**幾個 cycle**而所有 gate 都全綠。
//   真實個案：`setupTeacher()` 叫咗一個從來冇定義過嘅 `_wirePauseOverlay()`
//   → 每個 boot 都 ReferenceError → **成個 DOMContentLoaded 之後嘅流程全部死掉**
//   （renderTypePicker / renderRecommendChips / Profile.load /
//     Audio.setMasterVolume / renderBossSelect / resume 按鈕）。
//
//   所以呢個 scenario 有兩層：
//   ① console 乾淨（通用 —— 任何 boot error 都捉到）
//   ② 逐個 assert 關鍵 boot 步驟真係行過（指名道姓，捉「靜靜冇做」）

export default {
  name: 'boot-console-clean',
  title: 'boot 乾淨：零 console error + 關鍵 boot 步驟真係行過',
  viewport: [639, 669],
  steps: [
    // ① 通用：整個 boot 過程嘅 console / 例外
    {
      consoleClean: {
        label: 'boot 期間零 console error + 零未捕獲例外',
        // Tailwind CDN 嘅 production 提示係 warning 唔係 error，唔會入呢度
        allow: [],
      },
    },

    // ② 指名道姓：每個 boot 步驟真係行過（唔可以靜靜漏咗）
    {
      assert: {
        label: 'Profile.load() 行過（學生 profile / 級數表 / 主音量 有載入）',
        expr: `(() => {
          try {
            const d = Profile.data;
            // ⚠️ milestonesByType 係 lazy-init（用先有），唔可以喺呢度斷
            return {
              ok: !!d && typeof d === 'object'
                && d.levelByType !== undefined
                && typeof d.levelStreak !== 'undefined'
                && typeof d.masterVolume === 'number',
              detail: 'levelByType=' + JSON.stringify(d.levelByType)
                + ' · masterVolume=' + d.masterVolume,
            };
          } catch (e) { return { ok: false, detail: String(e.message) }; }
        })()`,
      },
    },
    {
      assert: {
        label: '主音量已經套用落 Audio bus（Profile → Audio.setMasterVolume）',
        expr: `(() => {
          try {
            const g = typeof Audio.getBusGain === 'function' ? Audio.getBusGain('master') : null;
            const v = typeof Audio.getBusVolume === 'function' ? Audio.getBusVolume('master') : null;
            return {
              ok: typeof g === 'number' && g > 0 && g <= 1 && typeof v === 'number',
              detail: 'masterVolume=' + v + ' · masterGain=' + g,
            };
          } catch (e) { return { ok: false, detail: String(e.message) }; }
        })()`,
      },
    },
    {
      assert: {
        label: '題型選擇器 render 咗（renderTypePicker 行過）',
        expr: `(() => {
          const el = document.getElementById('type-picker');
          const opts = document.querySelectorAll('#type-picker .opt-type[data-type]');
          return {
            ok: !!el && opts.length > 0,
            detail: 'picker=' + (el ? el.id : '(none)') + ' · options=' + opts.length,
          };
        })()`,
      },
    },
    {
      assert: {
        label: '教師台掣已接線（setupTeacher → _wireTeacherActions 行過）',
        expr: `(() => {
          const ids = ['btn-teacher', 'teacher-pause', 'teacher-resume', 'pause-resume-2', 'teacher-end'];
          const missing = ids.filter((id) => typeof (document.getElementById(id) || {}).onclick !== 'function');
          return { ok: missing.length === 0, detail: '冇 onclick: ' + (missing.join(',') || '(冇)') };
        })()`,
      },
    },
    {
      assert: {
        label: '題庫管理 add 掣已接線（_wireBankSection 行過）',
        expr: `(() => {
          const el = document.getElementById('td-bank-add-btn');
          return {
            ok: !!el && typeof el.onclick === 'function',
            detail: 'td-bank-add-btn=' + (el ? ('onclick=' + typeof el.onclick) : '(missing)'),
          };
        })()`,
      },
    },
    {
      assert: {
        label: 'Boss 已初始化 + 選擇面板 render（renderBossSelect 行過）',
        expr: `(() => {
          try {
            // ⚠️ Bosses 係 module-scope const（唔會上 window），要用 scope 內引用
            const opts = document.querySelectorAll('#boss-select-row [data-boss]');
            return {
              ok: Bosses.list.length > 0 && !!Bosses.current && opts.length > 0,
              detail: 'Bosses.current=' + (Bosses.current ? Bosses.current.id : '(null)')
                + ' · list=' + Bosses.list.length + ' · rendered=' + opts.length,
            };
          } catch (e) { return { ok: false, detail: String(e.message) }; }
        })()`,
      },
    },
    {
      assert: {
        label: '推薦 chips render 咗（renderRecommendChips 行過）',
        expr: `(() => {
          const box = document.getElementById('recommend-chips');
          const n = document.querySelectorAll('.rec-chip').length;
          return {
            ok: !!box && n > 0,
            detail: 'container=' + (box ? 'yes' : 'no') + ' · chips=' + n,
          };
        })()`,
      },
    },

    { shot: 'boot-console-clean' },
  ],
};
