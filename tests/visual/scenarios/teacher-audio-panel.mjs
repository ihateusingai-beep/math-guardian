// tests/visual/scenarios/teacher-audio-panel.mjs
//
// 守門 cycle111g 嘅音頻控制台（用 `audio-design` skill）：
//
// ① **主音量 slider 真係通**：拖 → Audio master bus 收到 0..1，gain 係**平方**（0.4 → 0.16）
// ② **對比度修正**：教師台係 `bg-slate-900` 深底，之前啲音效 checkbox 嘅 label 冇
//    `text-on-night` → 繼承 body 嘅 `--c-text-primary`（#1e293b 深色）→ **深底深字睇唔到**。
//    → 斷言 label 嘅實際顏色對 modal 背景有足夠對比（WCAG AA 4.5:1）。
// ③ **唔准 overflow**：學校 iPad 639×669，教師台內容一多就爆（cycle110b 教訓）。
//
// ⚠️ 教師台有密碼門（`_tryTeacherPwd`），視覺驗證唔需要真答題 → 直接 show controls。

export default {
  name: 'teacher-audio-panel',
  title: '教師台音頻控制：主音量 slider + 深底對比度 + 639×669 唔 overflow（cycle111g）',
  viewport: [639, 669],
  steps: [
    { eval: `(() => {
      localStorage.setItem('mg2.onboardingDone', '1');
      localStorage.removeItem('mg2.profile');
      Profile.load();
      return 'ready';
    })()` },

    { eval: `(() => {
      // ⚠️ 教師台嘅 audio controls 係喺 **密碼答啱** 之後先 wire（_tryTeacherPwd → wireAudioSettings）
      //    → 場景要行真實密碼流程，唔可以直接 show controls（否則 slider 會係死嘅）
      if (typeof _openTeacherModal === 'function') _openTeacherModal();
      const inp = document.getElementById('teacher-pwd');
      const ans = (typeof _teacherChallenge !== 'undefined' && _teacherChallenge) ? _teacherChallenge.a : null;
      if (ans == null) return 'no-challenge';
      inp.value = String(ans);
      _tryTeacherPwd();
      const controls = document.getElementById('teacher-controls');
      return 'opened:' + (controls && !controls.classList.contains('hidden'));
    })()` },
    { wait: 400 },

    // ---- ① slider 存在 + 真係接到 Audio master bus ----
    { assert: { label: '主音量 slider 存在（range 0–100）', expr: `(() => {
      const s = document.getElementById('td-audio-volume');
      if (!s) return { ok: false, detail: '搵唔到 #td-audio-volume' };
      return { ok: s.type === 'range' && s.min === '0' && s.max === '100',
        detail: 'type=' + s.type + ' min=' + s.min + ' max=' + s.max + ' value=' + s.value };
    })()` } },

    { assert: { label: 'slider 預設值 = Profile 主音量（100%）', expr: `(() => {
      const s = document.getElementById('td-audio-volume');
      const v = Audio.getBusVolume('master');
      const ok = s && Math.round((v == null ? 1 : v) * 100) === Number(s.value);
      return { ok, detail: 'slider=' + (s && s.value) + ' audio=' + v };
    })()` } },

    { assert: { label: '拖 slider → Audio master bus 真係收到（0..1）', expr: `(() => {
      const s = document.getElementById('td-audio-volume');
      if (!s) return { ok: false, detail: '搵唔到 slider' };
      s.value = '40';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      const v = Audio.getBusVolume('master');
      return { ok: Math.abs(v - 0.4) < 1e-9, detail: 'audio master = ' + v };
    })()` } },

    { assert: { label: 'gain 係**平方**（0.4 → 0.16），唔係 raw linear amplitude', expr: `(() => {
      const g = Audio.getBusGain('master');
      return { ok: Math.abs(g - 0.16) < 1e-9, detail: 'gain = ' + g + '（linear 會係 0.4）' };
    })()` } },

    { assert: { label: '0% = 真靜音（唔會被 `|| default` 當成 1）', expr: `(() => {
      const s = document.getElementById('td-audio-volume');
      s.value = '0';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      const v = Audio.getBusVolume('master');
      const g = Audio.getBusGain('master');
      return { ok: v === 0 && g === 0, detail: 'vol=' + v + ' gain=' + g };
    })()` } },

    { assert: { label: 'slider 百分比標籤跟住更新', expr: `(() => {
      const s = document.getElementById('td-audio-volume');
      s.value = '65';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      const lab = document.getElementById('td-audio-volume-val');
      return { ok: !!lab && lab.textContent.trim() === '65%', detail: 'label = ' + (lab && lab.textContent) };
    })()` } },

    // ---- ② 深底對比度修正 ----
    { assert: { label: '音效控制 label 喺深底有足夠對比度（WCAG AA ≥ 4.5:1）', expr: `(() => {
      const panel = document.querySelector('#teacher-modal .bg-slate-900');
      const lbl = document.querySelector('#td-audio-master') ?
        document.querySelector('#td-audio-master').closest('label').querySelector('span') : null;
      if (!panel || !lbl) return { ok: false, detail: 'panel/label 唔齊' };
      const px = (s) => { const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(s || ''); return m ? [+m[1],+m[2],+m[3]] : null; };
      const lum = (c) => { const a = c.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
        return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2]; };
      const fg = px(getComputedStyle(lbl).color);
      // modal 底色：bg-slate-900 = rgb(15,23,42)
      const bg = [15, 23, 42];
      if (!fg) return { ok: false, detail: '讀唔到 label color' };
      const l1 = lum(fg), l2 = lum(bg);
      const ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
      return { ok: ratio >= 4.5, detail: 'fg=rgb(' + fg.join(',') + ') ratio=' + ratio.toFixed(2) + ':1' };
    })()` } },

    // ---- ③ 唔准 overflow ----
    { assert: { label: '教師台喺 639×669 唔准 overflow（內容可以捲，但要喺 modal 內捲）', expr: `(() => {
      const m = document.getElementById('teacher-modal');
      const inner = m.querySelector('.bg-slate-900');
      const r = inner.getBoundingClientRect();
      const docOverflow = document.documentElement.scrollHeight - innerHeight;
      // modal 內部係 max-h-[90vh] + overflow-y-auto → 內容高過 modal 係正常（可以捲）
      // 真正要守嘅係：modal 本身唔可以超出視口
      const ok = r.height <= innerHeight + 1 && r.top >= -1;
      return { ok, detail: 'modal h=' + Math.round(r.height) + ' top=' + Math.round(r.top)
        + ' innerH=' + innerHeight + ' innerScrollH=' + inner.scrollHeight + ' innerClientH=' + inner.clientHeight };
    })()` } },

    { eval: `(() => {
      // 捲到音頻控制區（截圖要見到 slider 本身，唔係得個 modal 頭）
      const s = document.getElementById('td-audio-volume');
      if (s) s.scrollIntoView({ block: 'center' });
      const lab = document.getElementById('td-audio-volume-val');
      if (lab) lab.textContent = '40%';
      return 'scrolled';
    })()` },
    { wait: 250 },
    { shot: 'teacher-audio-panel' },
    { shot: 'teacher-audio-panel-full', full: true },
  ],
};
