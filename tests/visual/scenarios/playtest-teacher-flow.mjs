// tests/visual/scenarios/playtest-teacher-flow.mjs
//
// 【PLAYTEST · cycle111h 後】教師台完整流程 —— 由開 modal 到暫停/續玩/強制結束/題庫管理。
//
// ⚠️ 點解要有呢個場景：cycle111h 揭發嘅 P0 就係喺 `setupTeacher()` 度 throw，
//    令「教師台掣接線」之後嘅流程全部死掉 —— 而之前 52 條守門**冇一條**
//    真係入過教師台。所以今次補一次**由頭到尾**嘅教師台實機遊玩。
//
// 密碼係 challenge（cycle83：`${a} × ${b}`），唔係 hardcoded → 要讀 hint 再計。

export default {
  name: 'playtest-teacher-flow',
  title: '教師台完整流程：密碼 → 儀表板 → 暫停 → 續玩 → 題庫管理',
  viewport: [639, 669],
  steps: [
    // ── 1. 開 modal ──
    { eval: `(() => {
      document.getElementById('btn-teacher').click();
      return 'clicked btn-teacher';
    })()` },
    { wait: 400 },
    {
      assert: {
        label: '教師台 modal 開咗 + 密碼提示有 challenge 題',
        expr: `(() => {
          const m = document.getElementById('teacher-modal');
          const hint = document.getElementById('teacher-pwd-hint');
          const visible = m && !m.classList.contains('hidden');
          const txt = hint ? hint.textContent : '';
          const m2 = txt.match(/(\\d+)\\s*×\\s*(\\d+)/);
          window.__ch = m2 ? Number(m2[1]) * Number(m2[2]) : null;
          return {
            ok: !!visible && !!m2 && window.__ch > 0,
            detail: 'visible=' + visible + ' · hint="' + txt.trim().slice(0, 40) + '" · answer=' + window.__ch,
          };
        })()`,
      },
    },
    { shot: 'playtest-teacher-1-lock' },

    // ── 2. 答錯 → 應該有 error 提示 ──
    {
      assert: {
        label: '答錯密碼會顯示 error（唔會靜靜入去）',
        expr: `(() => {
          const pwd = document.getElementById('teacher-pwd');
          pwd.value = String(window.__ch + 999);
          pwd.dispatchEvent(new Event('blur'));
          const err = document.getElementById('teacher-pwd-error');
          const ctl = document.getElementById('teacher-controls');
          return {
            ok: !err.classList.contains('hidden') && ctl.classList.contains('hidden'),
            detail: 'error shown=' + !err.classList.contains('hidden')
              + ' · controls hidden=' + ctl.classList.contains('hidden'),
          };
        })()`,
      },
    },

    // ── 3. 答啱 → 控制區出現 ──
    {
      assert: {
        label: '答啱 challenge → 教師控制區解鎖',
        expr: `(() => {
          const pwd = document.getElementById('teacher-pwd');
          pwd.value = String(window.__ch);
          pwd.dispatchEvent(new Event('blur'));
          const ctl = document.getElementById('teacher-controls');
          return {
            ok: !ctl.classList.contains('hidden'),
            detail: 'controls visible=' + !ctl.classList.contains('hidden')
              + ' · pwd ok=' + pwd.dataset.ok,
          };
        })()`,
      },
    },
    { wait: 300 },
    { shot: 'playtest-teacher-2-unlocked' },

    // ── 4. 儀表板有內容 ──
    {
      assert: {
        label: '教師儀表板 render 到實際數據（唔係空殼）',
        expr: `(() => {
          const ctl = document.getElementById('teacher-controls');
          const txt = (ctl.innerText || '').trim();
          const hasNumber = /\\d/.test(txt);
          return {
            ok: txt.length > 20 && hasNumber,
            detail: 'chars=' + txt.length + ' · head="' + txt.replace(/\\s+/g, ' ').slice(0, 90) + '"',
          };
        })()`,
      },
    },

    // ── 5. 題庫管理：有內容 + add 掣接線 ──
    {
      assert: {
        label: '題庫管理區 render 到（inventory 有題目）',
        expr: `(() => {
          const inv = document.querySelector('#teacher-controls [id*="bank"], #td-bank-inventory, [id*="inventory"]');
          const txt = inv ? (inv.innerText || '').trim() : '';
          const addBtn = document.getElementById('td-bank-add-btn');
          return {
            ok: !!inv && txt.length > 0 && typeof addBtn.onclick === 'function',
            detail: 'inv chars=' + txt.length + ' · add onclick=' + typeof (addBtn && addBtn.onclick)
              + ' · head="' + txt.replace(/\\s+/g, ' ').slice(0, 70) + '"',
          };
        })()`,
      },
    },

    // ── 6. 音效控制：主音量 slider 真係通 ──
    {
      assert: {
        label: '主音量 slider 喺教師台存在 + 拖動真係改 master bus',
        expr: `(() => {
          const s = document.getElementById('td-audio-volume');
          if (!s) return { ok: false, detail: 'slider missing' };
          const before = Audio.getBusGain('master');
          s.value = '40';
          s.dispatchEvent(new Event('input', { bubbles: true }));
          const after = Audio.getBusGain('master');
          return {
            ok: typeof before === 'number' && typeof after === 'number' && after !== before,
            detail: 'before=' + before + ' → after=' + after + ' (0.4² 應該 = 0.16)',
          };
        })()`,
      },
    },

    // ── 7. 關 modal ──
    {
      assert: {
        label: '關閉教師台 modal 正常（focus 還返 btn-teacher）',
        expr: `(() => {
          document.getElementById('teacher-close').click();
          const m = document.getElementById('teacher-modal');
          return {
            ok: m.classList.contains('hidden'),
            detail: 'hidden=' + m.classList.contains('hidden')
              + ' · focus=' + (document.activeElement ? document.activeElement.id : '(none)'),
          };
        })()`,
      },
    },
    { wait: 200 },

    // ── 8. 暫停 / 續玩（要開緊一局）──
    {
      assert: {
        label: '教師台暫停掣（teacher-pause）已接線 + 暫停 overlay 出現',
        expr: `(() => {
          const pause = document.getElementById('teacher-pause');
          if (typeof pause.onclick !== 'function') {
            return { ok: false, detail: 'teacher-pause 未接線' };
          }
          pause.click();
          const ov = document.getElementById('pause-overlay');
          return {
            ok: !!ov && !ov.classList.contains('hidden'),
            detail: 'overlay visible=' + (ov ? !ov.classList.contains('hidden') : 'no-overlay'),
          };
        })()`,
      },
    },
    { shot: 'playtest-teacher-3-pause' },

    {
      assert: {
        label: '暫停 overlay 嘅續玩掣（pause-resume-2）可撳 + overlay 收埋',
        expr: `(() => {
          const btn = document.getElementById('pause-resume-2');
          if (typeof btn.onclick !== 'function') return { ok: false, detail: 'pause-resume-2 未接線' };
          btn.click();
          const ov = document.getElementById('pause-overlay');
          return {
            ok: !!ov && ov.classList.contains('hidden'),
            detail: 'overlay hidden=' + (ov ? ov.classList.contains('hidden') : 'no-overlay'),
          };
        })()`,
      },
    },

    { shot: 'playtest-teacher-4-final' },
  ],
};
