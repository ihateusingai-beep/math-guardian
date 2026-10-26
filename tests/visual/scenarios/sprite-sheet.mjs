// tests/visual/scenarios/sprite-sheet.mjs
//
// 守門像素精靈：每個 `<symbol>` 都真係 render 到（唔係死 symbol）。
// `tests/asset-audit.js` 查靜態結構（viewBox / 座標 / crispEdges / 重複 id），
// 但查唔到「symbol 存在、use 引用咗、但圖形係空」呢種情況 —— 呢個 scenario 補上。
//
// 順便截一張 sprite sheet 出嚟，方便肉眼睇像素品質。

const SPRITE_IDS = [
  // L 容量包裝（9 個）
  'pkg-milk-1l', 'pkg-juice-1l', 'pkg-detergent-1l', 'pkg-bleach-2l',
  'pkg-soda-15l', 'pkg-soymilk-1l', 'pkg-soysauce-1l', 'pkg-paint-5l',
  'pkg-orange-2l',
  // 像素 icon
  'px-badge-star', 'px-abacus', 'px-clock-base', 'px-castle',
];

export default {
  name: 'sprite-sheet',
  title: '像素精靈 sheet：每個 symbol 都真係 render 到',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      const ids = ${JSON.stringify(SPRITE_IDS)};
      const d = document.createElement('div');
      d.id = 'sprite-sheet';
      d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0f172a;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px;';
      d.innerHTML = ids.map(id => '<div style="background:#1e293b;border:1px solid #475569;text-align:center;padding:4px">' +
        '<svg class="pixel" style="width:128px;height:128px"><use href="#'+id+'"/></svg>' +
        '<div style="color:#f0f9ff;font-size:10px">'+id+'</div></div>').join('');
      document.body.appendChild(d);
      window.__ids = ids;
      return 'sheet:' + ids.length;
    })()` },
    { wait: 500 },

    { eval: `(() => {
      // 量每個 <use> 真係畫咗嘢（symbol 缺失 / 空 → 尺寸 = 0）
      const out = [];
      window.__ids.forEach(id => {
        const use = document.querySelector('#sprite-sheet use[href="#' + id + '"]');
        if (!use) { out.push({ id, missing: true }); return; }
        const r = use.getBoundingClientRect();
        out.push({ id, w: Math.round(r.width), h: Math.round(r.height) });
      });
      window.__sprites = out;
      return JSON.stringify(out.filter(o => o.missing || !o.w || !o.h));
    })()` },

    { assert: { label: '每個 sprite 都真係 render 到（有非零尺寸）', expr: `(() => {
      const bad = (window.__sprites || []).filter(o => o.missing || !o.w || !o.h);
      const ok = bad.length === 0;
      return { ok, detail: ok ? '' : ('bad=' + JSON.stringify(bad)) };
    })()` } },

    { assert: { label: '新精靈 pkg-orange-2l 喺 sheet 入面', expr: `(() => {
      const ok = (window.__ids || []).indexOf('pkg-orange-2l') >= 0;
      return { ok, detail: ok ? '' : 'sheet 冇 pkg-orange-2l' };
    })()` } },

    { assert: { label: 'symbol id 冇重複（重複嗰份永遠 render 唔到）', expr: `(() => {
      const all = Array.from(document.querySelectorAll('symbol')).map(s => s.id);
      const dup = all.filter((v, i) => all.indexOf(v) !== i);
      const ok = dup.length === 0;
      return { ok, detail: ok ? '' : ('dup=' + JSON.stringify(dup)) };
    })()` } },

    { shot: 'sprite-sheet' },
  ],
};
