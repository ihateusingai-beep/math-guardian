// tests/visual/scenarios/scope-icons.mjs
//
// 【cycle111d】emoji-as-chrome 置換 —— 範疇 icon + UI icon 真機守門。
//
// 為咩要真機行（唔淨係 DOM 結構）：
//   · 「icon 真係 render 出嚟」係 **幾何 + 繪製** 事實 —— `<use href="#...">` 寫錯、
//     symbol 唔存在、或者 CSS 尺寸唔對，令成個 icon 會係空白 / 被切走，
//     但 DOM 結構檢查（regex）100% 捉唔到。
//   · 範疇掣改成 flex 排版（icon 左 + 文字右）之後，**幾何**先會出事：
//     icon 會唔會超出掣嘅 box？文字會唔會被 icon 推走？
//     呢啲要量 getBoundingClientRect()，唔係睇 markup。
//   · 學校 iPad = 639×669，範疇 grid 係 2 欄 × 4 行 —— 改咗排版要確認喺窄屏仍然企得穩。
//
// 契約（docs/ART_STYLE_GUIDE.md 禁止表 + proposal §4.4/§4.5）：
//   · emoji-as-chrome 禁（模式鈕 / icon-only 掣）→ 全部改 inline SVG symbol
//   · 8 個 scope 掣要 8 隻唔同 icon（學生靠 icon 揀範疇）
//   · emoji-as-content 留（題目嘅水果 emoji 唔郁）—— 本場景唔會碰題目內容

const SCOPE_IDS = ['count20', 'compareLength', 'compareHeight', 'orderAsc20',
  'orderDesc20', 'learnL', 'findLDrink', 'findLItem'];

export default {
  name: 'scope-icons',
  title: 'emoji-as-chrome 置換：範疇 / 快捷 / 打怪方式 / 提示掣 icon 真 render + 唔爆版',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      // 確保主選單喺畫面上（boot 預設就係 menu，呢度係保險）
      const m = document.getElementById('screen-menu');
      if (m) m.classList.remove('hidden');
      window.__scopeIds = ${JSON.stringify(SCOPE_IDS)};
      return 'ready';
    })()` },
    { wait: 400 },

    // ── 1. 8 個範疇掣：symbol 存在 + 真係畫咗嘢 + href 跟 SCOPE_CATALOG ──
    {
      assert: {
        label: '8 個範疇掣嘅 icon 真係 render（非空圖形）而且 href 跟 SCOPE_CATALOG',
        expr: `(() => {
          const out = [];
          for (const id of window.__scopeIds) {
            const btn = document.querySelector('.opt-scope[data-scope="' + id + '"]');
            if (!btn) { out.push({ id, why: 'no-button' }); continue; }
            const use = btn.querySelector('use');
            const href = use ? (use.getAttribute('href') || '') : '';
            const sym = href ? document.querySelector(href) : null;
            let w = 0, h = 0;
            try { const r = use.getBoundingClientRect(); w = r.width; h = r.height; } catch (e) {}
            const want = '#' + SCOPE_CATALOG.find(s => s.id === id).icon;
            out.push({ id, href, want, sym: !!sym, w: Math.round(w), h: Math.round(h),
              ok: !!sym && href === want && w > 0 && h > 0 });
          }
          const bad = out.filter(o => !o.ok);
          return { ok: bad.length === 0, detail: bad.length ? JSON.stringify(bad) : '' };
        })()`,
      },
    },

    // ── 2. 8 隻 icon 全部唔同（兩個 scope 共用 icon = 學生揀唔到）──
    {
      assert: {
        label: '8 個範疇嘅 icon 全部唔同（學生靠 icon 揀範疇）',
        expr: `(() => {
          const hrefs = window.__scopeIds.map(id => {
            const b = document.querySelector('.opt-scope[data-scope="' + id + '"]');
            const u = b && b.querySelector('use');
            return u ? u.getAttribute('href') : '';
          });
          const uniq = new Set(hrefs);
          const ok = uniq.size === window.__scopeIds.length && hrefs.every(h => h);
          return { ok, detail: ok ? '' : ('hrefs=' + JSON.stringify(hrefs)) };
        })()`,
      },
    },

    // ── 3. emoji-as-chrome 位置真係冇 emoji（文字 + icon 都要係 sprite）──
    {
      assert: {
        label: '範疇掣 / 快捷 chip / 打怪方式掣 全部冇 emoji（淨剩像素 sprite）',
        expr: `(() => {
          const EMOJI = /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{2190}-\\u{21FF}]/u;
          const sels = ['.opt-scope', '.opt-scope-preset', '.opt-team'];
          const bad = [];
          for (const s of sels) {
            document.querySelectorAll(s).forEach(b => {
              if (EMOJI.test(b.textContent || '')) bad.push(s + ' :: ' + b.textContent.trim().slice(0, 20));
            });
          }
          return { ok: bad.length === 0, detail: bad.length ? JSON.stringify(bad) : '' };
        })()`,
      },
    },

    // ── 4. 幾何：icon 完全喺掣嘅 box 入面（冇被切走）+ 掣喺 viewport 入面 ──
    {
      assert: {
        label: '幾何：icon 完全喺掣入面（冇被切走）+ 範疇 grid 喺 639×669 唔爆版',
        expr: `(() => {
          const bad = [];
          document.querySelectorAll('.opt-scope').forEach(b => {
            const svg = b.querySelector('svg');
            if (!svg) { bad.push('no-svg'); return; }
            const br = b.getBoundingClientRect();
            const ir = svg.getBoundingClientRect();
            const inside = ir.left >= br.left - 0.5 && ir.right <= br.right + 0.5
              && ir.top >= br.top - 0.5 && ir.bottom <= br.bottom + 0.5;
            const inView = br.left >= -0.5 && br.right <= window.innerWidth + 0.5;
            const sized = Math.round(ir.width) === 32 && Math.round(ir.height) === 32;
            if (!(inside && inView && sized)) {
              bad.push(b.dataset.scope + ' btn=' + Math.round(br.left) + ',' + Math.round(br.top)
                + ' ' + Math.round(br.width) + 'x' + Math.round(br.height)
                + ' icon=' + Math.round(ir.width) + 'x' + Math.round(ir.height)
                + ' inside=' + inside + ' inView=' + inView + ' sized=' + sized);
            }
          });
          return { ok: bad.length === 0, detail: bad.length ? JSON.stringify(bad) : '' };
        })()`,
      },
    },
    { eval: `(() => {
      const p = document.getElementById('scope-picker');
      if (p) p.scrollIntoView({ block: 'start' });
      return 'scrolled';
    })()` },
    { wait: 300 },
    { shot: 'scope-icons-1-menu' },

    // ── 5. 5 個快捷 chip：16px icon + 真 render ──
    {
      assert: {
        label: '5 個範疇快捷 chip 用 16px 像素 icon（真 render）',
        expr: `(() => {
          const bad = [];
          document.querySelectorAll('.opt-scope-preset').forEach(b => {
            const use = b.querySelector('use');
            const href = use ? (use.getAttribute('href') || '') : '';
            const sym = href ? document.querySelector(href) : null;
            let w = 0, h = 0;
            try { const r = use.getBoundingClientRect(); w = r.width; h = r.height; } catch (e) {}
            const ir = use.closest('svg').getBoundingClientRect();
            const sized = Math.round(ir.width) === 16 && Math.round(ir.height) === 16;
            if (!(sym && w > 0 && h > 0 && sized)) {
              bad.push(b.dataset.scopePreset + ' href=' + href + ' sym=' + !!sym
                + ' box=' + Math.round(ir.width) + 'x' + Math.round(ir.height));
            }
          });
          const n = document.querySelectorAll('.opt-scope-preset').length;
          return { ok: bad.length === 0 && n === 5, detail: bad.length ? JSON.stringify(bad) : ('chip 數=' + n) };
        })()`,
      },
    },

    // ── 6. 打怪方式 2 個掣（教師台 boss 面板）：icon 真 render ──
    {
      eval: `(() => {
        const t = document.querySelector('.opt-track[data-track="boss"]');
        if (t) t.click();
        return 'boss-track';
      })()`,
    },
    { wait: 400 },
    {
      assert: {
        label: '打怪方式 2 個掣（合作 / 比分）都有像素 icon 真 render',
        expr: `(() => {
          const bad = [];
          document.querySelectorAll('.opt-team').forEach(b => {
            const use = b.querySelector('use');
            const href = use ? (use.getAttribute('href') || '') : '';
            const sym = href ? document.querySelector(href) : null;
            let w = 0, h = 0;
            try { const r = use.getBoundingClientRect(); w = r.width; h = r.height; } catch (e) {}
            if (!(sym && w > 0 && h > 0)) {
              bad.push(b.dataset.team + ' href=' + href + ' sym=' + !!sym + ' w=' + Math.round(w));
            }
          });
          const n = document.querySelectorAll('.opt-team').length;
          return { ok: bad.length === 0 && n === 2, detail: bad.length ? JSON.stringify(bad) : ('掣數=' + n) };
        })()`,
      },
    },
    { eval: `(() => {
      const t = document.querySelector('.opt-team');
      if (t) t.scrollIntoView({ block: 'center' });
      return 'scrolled-team';
    })()` },
    { wait: 300 },
    { shot: 'scope-icons-2-boss-panel' },

    // ── 7. SEN 畫面嘅 icon-only 提示掣（44×44 入面有 32px 像素 icon）──
    {
      eval: `(() => {
        Game.settings.difficulty = 'easy';
        Game.settings.playLayout = 'solo';
        Game.settings.scopes = ['count20'];
        Game.settings.types = ['count20'];
        Game.settings.goalStages = 1;
        startGame();
        return 'started';
      })()`,
    },
    { wait: 1000 },
    {
      assert: {
        label: 'SEN 提示掣（icon-only）用像素 icon 真 render，唔係空白掣',
        expr: `(() => {
          const bad = [];
          let rendered = 0;
          ['sen-hint-knight', 'sen-hint-mage'].forEach(id => {
            const b = document.getElementById(id);
            if (!b) { bad.push(id + ':no-el'); return; }
            const use = b.querySelector('use');
            const href = use ? (use.getAttribute('href') || '') : '';
            const sym = href ? document.querySelector(href) : null;
            if (!(use && sym && href === '#px-icon-hint')) {
              bad.push(id + ' href=' + href + ' sym=' + !!sym);
              return;
            }
            // 單人模式下面板會收埋（display:none）→ 量唔到係正常，
            // 所以「結構」兩個都要對，「真 render」只需要喺**顯示緊**嗰個成立。
            const br = b.getBoundingClientRect();
            if (br.width > 0 && br.height > 0) {
              let w = 0, h = 0;
              try { const r = use.getBoundingClientRect(); w = r.width; h = r.height; } catch (e) {}
              if (w > 0 && h > 0) rendered++;
              else bad.push(id + ' use=' + Math.round(w) + 'x' + Math.round(h));
            }
          });
          return { ok: bad.length === 0 && rendered >= 1,
            detail: bad.length ? JSON.stringify(bad) : ('rendered=' + rendered) };
        })()`,
      },
    },
    { shot: 'scope-icons-3-sen-hint' },
  ],
};
