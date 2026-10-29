
'use strict';
/* =====================================================================
 *  數學合作學習遊戲 v3 — single-file game (Math Guardian lineage)
 *  Sections:
 *    [1] 常數 / 工具
 *    [2] 音訊 (Web Audio beeps)
 *    [3] 視覺特效 (meteor, particle, screen alert)
 *    [4] 題目生成器
 *    [5] Game state
 *    [6] UI updates
 *    [7] Event handlers
 *    [8] 主流程 / 啟動
 * ===================================================================== */

/* ============== [1] 常數 / 工具 ============== */
// V3.6 cycle83 C2: 唔再用 hardcoded 密碼, 改用每次 session 隨機數學驗證題
// 老師要答啱先入到 teacher controls — 學生 View Source 搵唔到固定答案
let _teacherChallenge = null;
function _newTeacherChallenge() {
  const a = randInt(11, 19);
  const b = randInt(11, 19);
  _teacherChallenge = { q: `${a} × ${b}`, a: a * b };
  return _teacherChallenge;
}
function _tryTeacherPwd() { /* re-defined below using _teacherChallenge */ }

const TEAMS = ['knight', 'mage'];

const TEAM_META = {
  knight: { name: '騎士隊', color: 'blue',   icon: 'px-knight', ultLabel: '騎士隕石' },
  mage:   { name: '法師隊', color: 'purple', icon: 'px-mage',   ultLabel: '法師隕石' },
};

function $(id) { return document.getElementById(id); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/* ---- tiny mode/query helpers (quality; no behavior change) ---- */
function _isEasyMode() { return Game.settings.difficulty === 'easy'; }
function _isDualPlay() { return Game.settings.playLayout === 'dual'; }
function _isCoopTeam() { return Game.settings.team === 'coop'; }
function _isRetroArena() { return Game.settings.arenaSkin === 'retro'; }

/** Build N plank nodes for retro bridge (SEN coop). */
function _bridgePlanksHTML(n) {
  const count = Math.max(0, Math.min(24, n | 0));
  let html = '';
  for (let i = 0; i < count; i++) html += '<span class="sen-bridge-plank" aria-hidden="true"></span>';
  return html;
}

/** First glyph of identity label (e.g. "🐱 小貓" → 🐱) */
function _teamEmoji(team) {
  const label = team === 'mage'
    ? (Game.settings.playerLabelRight || Game.settings.playerLabel || '')
    : (Game.settings.playerLabel || '');
  const m = String(label).trim().match(/^(\S+)/);
  if (m && m[1] && m[1] !== '同學') return m[1];
  return team === 'mage' ? '🟣' : '🔵';
}

function _pulseEl(el, cls, ms) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms || 420);
}

/** Broad emoji codepoint check (incl. ⭐ 0x2B50 etc.) */
function _isEmojiCP(cp) {
  if (cp == null) return false;
  return (
    (cp >= 0x1F300 && cp <= 0x1FAFF) ||
    (cp >= 0x1F600 && cp <= 0x1F64F) ||
    (cp >= 0x1F900 && cp <= 0x1F9FF) ||
    (cp >= 0x1F1E0 && cp <= 0x1F1FF) ||
    (cp >= 0x2600 && cp <= 0x27BF) ||
    (cp >= 0x2300 && cp <= 0x23FF) ||
    (cp >= 0x2B00 && cp <= 0x2BFF) ||
    cp === 0xFE0F || cp === 0x200D
  );
}

function _isEmojiChar(ch) {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  return _isEmojiCP(cp) && cp !== 0xFE0F && cp !== 0x200D;
}

/** First countable emoji glyph in string (skip VS16/ZWJ) */
function _firstEmojiIn(str) {
  for (const ch of String(str || '')) {
    if (_isEmojiChar(ch)) return ch;
  }
  return '🍎';
}

/**
 * Split mixed parts (e.g. bank "🍎🍎🍎= ?") into emoji clusters + text tokens.
 * Returns { emojiParts: string[], textTokens: string[] }
 */
function _splitPartsEmojiText(parts) {
  const emojiParts = [];
  const textTokens = [];
  const chineseMap = {
    '+': '加', '-': '減', '=': '等於', '?': '？', '❓': '等於幾多？',
    '◁': '細啲', '▷': '大啲', '＝': '等於', ' ': '',
  };
  (parts || []).forEach(part => {
    let bufE = '', bufT = '';
    const flush = () => {
      if (bufE) { emojiParts.push(bufE); bufE = ''; }
      if (bufT) {
        let mapped = '';
        for (const ch of bufT.replace(/\s+/g, ' ').trim()) {
          if (Object.prototype.hasOwnProperty.call(chineseMap, ch)) mapped += chineseMap[ch];
          else mapped += ch === '?' ? '？' : ch;
        }
        if (mapped) textTokens.push(mapped);
        bufT = '';
      }
    };
    for (const ch of String(part)) {
      const cp = ch.codePointAt(0);
      if (_isEmojiCP(cp)) {
        if (bufT) flush();
        // keep VS16/ZWJ attached to emoji buffer
        bufE += ch;
      } else {
        if (bufE) flush();
        bufT += ch;
      }
    }
    flush();
  });
  return { emojiParts, textTokens };
}

/** Rebuild count visual from answer (never blank even if parts broken) */
function _countVisualHTML(q) {
  const n = Math.max(1, Math.min(10, Number(q.answer) || 1));
  const fruit = _firstEmojiIn((q.parts || []).join(''));
  const rows = [];
  for (let i = 0; i < n; i += 5) {
    const chunk = [];
    for (let j = i; j < Math.min(n, i + 5); j++) {
      chunk.push(`<span class="sen-count-item" aria-hidden="true">${fruit}</span>`);
    }
    rows.push(`<div class="sen-count-row" data-row="${Math.floor(i / 5)}">${chunk.join('')}</div>`);
  }
  return {
    fruit, n,
    html: `<div class="sen-count-grid" role="img" aria-label="${n} 個">${rows.join('')}</div>`,
  };
}

/** Shared length-compare markup (bars + object skins) — SEN + normal */
const LENGTH_SKINS = {
  bars: {
    id: 'bars',
    labels: { '1': '黃條', '2': '紫條' },
    tag1: '黃', tag2: '紫',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃條 ${a} 格，紫條 ${b} 格`,
  },
  pencil: {
    id: 'pencil',
    labels: { '1': '黃筆', '2': '紫筆' },
    tag1: '✏️', tag2: '✏️',
    promptLong: '邊枝長？', promptShort: '邊枝短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃筆 ${a}，紫筆 ${b}`,
  },
  snake: {
    id: 'snake',
    labels: { '1': '黃蟲', '2': '紫蟲' },
    tag1: '🐛', tag2: '🐛',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃蟲 ${a}，紫蟲 ${b}`,
  },
  train: {
    id: 'train',
    labels: { '1': '黃車', '2': '紫車' },
    tag1: '🚂', tag2: '🚂',
    promptLong: '邊架長？', promptShort: '邊架短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃車 ${a} 卡，紫車 ${b} 卡`,
  },
  fish: {
    id: 'fish',
    labels: { '1': '黃魚', '2': '紫魚' },
    tag1: '🐟', tag2: '🐟',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃魚 ${a}，紫魚 ${b}`,
  },
  // more skins
  rope: {
    id: 'rope',
    labels: { '1': '黃繩', '2': '紫繩' },
    tag1: '🪢', tag2: '🪢',
    emoji: '🪢',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃繩 ${a}，紫繩 ${b}`,
  },
  carrot: {
    id: 'carrot',
    labels: { '1': '黃蘿蔔', '2': '紫蘿蔔' },
    tag1: '🥕', tag2: '🥕',
    emoji: '🥕',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃蘿蔔 ${a}，紫蘿蔔 ${b}`,
  },
  road: {
    id: 'road',
    labels: { '1': '黃路', '2': '紫路' },
    tag1: '🛣️', tag2: '🛣️',
    emoji: '🛣️',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃路 ${a}，紫路 ${b}`,
  },
  ribbon: {
    id: 'ribbon',
    labels: { '1': '黃絲帶', '2': '紫絲帶' },
    tag1: '🎀', tag2: '🎀',
    emoji: '🎀',
    promptLong: '邊條長？', promptShort: '邊條短？',
    promptEq: '一樣長？',
    aria: (a, b) => `黃絲帶 ${a}，紫絲帶 ${b}`,
  },
};
const LENGTH_SKIN_IDS = Object.keys(LENGTH_SKINS);
const LENGTH_EQ_LABELS = { eq: '一樣長', diff: '唔一樣' };

function _lengthSkinMeta(skinId) {
  return LENGTH_SKINS[skinId] || LENGTH_SKINS.bars;
}

/** two same-color bars, horizontal, big hit targets, no units */
function _lengthPairHTML(ex) {
  const A = Math.max(1, Number(ex.a != null ? ex.a : ex.left) || 1);
  const B = Math.max(1, Number(ex.b != null ? ex.b : ex.right) || 1);
  const max = Math.max(A, B, 1);
  const pctA = Math.max(22, Math.round((A / max) * 92));
  const pctB = Math.max(22, Math.round((B / max) * 92));
  const tone = ['teal', 'sky', 'rose', 'slate'].includes(ex.pairTone) ? ex.pairTone : 'teal';
  const deco = ex.deco === 'worm' ? '🐛' : '';
  const ask = ex.ask === 'short' ? 'short' : 'long';
  const prompt = ex.prompt || (ask === 'short' ? '邊條短？' : '邊條長？');
  const hit = (side, pct) => {
    const label = side === '1' ? '左邊' : '右邊';
    return `<button type="button" class="len-pair-hit" data-side="${side}" aria-label="${label}">
      <span class="len-pair-bar tone-${tone}" style="width:${pct}%" data-side-bar="${side}">
        ${deco ? `<span class="len-pair-deco" aria-hidden="true">${deco}</span>` : ''}
      </span>
    </button>`;
  };
  return {
    A, B, skin: 'pair', mode: 'tap-pair',
    html: `<div class="len-pair" role="group" aria-label="${prompt}" data-ask="${ask}">
      ${hit('1', pctA)}
      ${hit('2', pctB)}
    </div>`,
  };
}

/** two same-color vertical columns — 高矮 */
function _heightPairHTML(ex) {
  const A = Math.max(1, Number(ex.a != null ? ex.a : ex.left) || 1);
  const B = Math.max(1, Number(ex.b != null ? ex.b : ex.right) || 1);
  const max = Math.max(A, B, 1);
  const pctA = Math.max(22, Math.round((A / max) * 92));
  const pctB = Math.max(22, Math.round((B / max) * 92));
  const tone = ['teal', 'sky', 'rose', 'slate'].includes(ex.pairTone) ? ex.pairTone : 'teal';
  const decoMap = { tree: '🌳', person: '🧍', building: '🏢' };
  const deco = decoMap[ex.deco] || '🌳';
  const ask = ex.ask === 'short' ? 'short' : 'tall';
  const prompt = ex.prompt || (ask === 'short' ? '邊個矮？' : '邊個高？');
  const hit = (side, pct) => {
    const label = side === '1' ? '左邊' : '右邊';
    return `<button type="button" class="ht-pair-hit" data-side="${side}" aria-label="${label}">
      <span class="ht-pair-stack">
        <span class="ht-pair-deco" aria-hidden="true">${deco}</span>
        <span class="ht-pair-bar-track" aria-hidden="true">
          <span class="ht-pair-bar tone-${tone}" style="height:${pct}%" data-side-bar="${side}"></span>
        </span>
        <span class="ht-pair-base" aria-hidden="true"></span>
      </span>
    </button>`;
  };
  return {
    A, B, skin: 'pair', mode: 'tap-pair', orient: 'height',
    html: `<div class="ht-pair" role="group" aria-label="${prompt}" data-ask="${ask}">
      ${hit('1', pctA)}
      ${hit('2', pctB)}
    </div>`,
  };
}

function _isTapPairCompare(q) {
  if (!q || !q.extra) return false;
  if (!(q.extra.mode === 'tap-pair' || q.extra.skin === 'pair')) return false;
  return q.type === 'compareLength' || q.type === 'compareHeight';
}

function _tapPairCorrectSay(q) {
  if (!q) return '啱啦';
  if (q.type === 'compareHeight') return (q.extra && q.extra.ask === 'short') ? '呢個矮' : '呢個高';
  return (q.extra && q.extra.ask === 'short') ? '呢條短' : '呢條長';
}

function _lengthBarsHTML(ex) {
  if (ex && (ex.mode === 'tap-pair' || ex.skin === 'pair')) {
    return _lengthPairHTML(ex);
  }
  // skin = bars|pencil|snake|train|fish|rope|carrot|road|ribbon
  const skinId = (ex && ex.skin) || 'bars';
  const meta = _lengthSkinMeta(skinId);
  const A = Math.max(1, Number(ex.a != null ? ex.a : ex.left) || 1);
  const B = Math.max(1, Number(ex.b != null ? ex.b : ex.right) || 1);
  const unit = 1.35; // rem per length unit
  const wA = (A * unit).toFixed(2);
  const wB = (B * unit).toFixed(2);
  const uA = ex.unitsA || '■'.repeat(A);
  const uB = ex.unitsB || '■'.repeat(B);
  const aria = meta.aria(A, B);

  const genericObj = (side, w) => {
    const is1 = side === '1';
    const tone = is1 ? 'y' : 'p';
    const icon = meta.emoji || meta.tag1 || '📏';
    return `<div class="sen-bar-row sen-len-row skin-${skinId} len-tap" data-side="${side}" role="button" tabindex="0" aria-label="${is1 ? '黃' : '紫'}">
      <span class="sen-bar-tag ${tone}">${is1 ? '黃' : '紫'}</span>
      <div class="sen-obj-track">
        <div class="sen-len-obj ${tone} skin-${skinId}" style="width:${w}rem">
          <span class="sen-len-obj-body"></span>
          <span class="sen-len-obj-icon" aria-hidden="true">${icon}</span>
        </div>
      </div>
    </div>
    <div class="sen-bar-units ${is1 ? '' : 'b'}" aria-hidden="true">${'■'.repeat(is1 ? A : B)}</div>`;
  };

  const row = (side, w, units) => {
    const is1 = side === '1';
    const tag = is1 ? meta.tag1 : meta.tag2;
    const tone = is1 ? 'y' : 'p';
    if (skinId === 'train') {
      const n = is1 ? A : B;
      const cars = [];
      cars.push('<span class="sen-train-engine" aria-hidden="true">🚂</span>');
      for (let i = 1; i < n; i++) cars.push('<span class="sen-train-car" aria-hidden="true">🚃</span>');
      if (n < 1) cars.push('<span class="sen-train-engine" aria-hidden="true">🚂</span>');
      return `<div class="sen-bar-row sen-len-row skin-train len-tap" data-side="${side}" role="button" tabindex="0" aria-label="${is1 ? '黃車' : '紫車'}">
        <span class="sen-bar-tag ${tone}">${is1 ? '黃' : '紫'}</span>
        <div class="sen-train ${tone}" aria-hidden="true">${cars.join('')}</div>
      </div>
      <div class="sen-bar-units ${is1 ? '' : 'b'}" aria-hidden="true">${'■'.repeat(Math.max(1, n))}</div>`;
    }
    if (skinId === 'pencil') {
      return `<div class="sen-bar-row sen-len-row skin-pencil len-tap" data-side="${side}" role="button" tabindex="0" aria-label="${is1 ? '黃筆' : '紫筆'}">
        <span class="sen-bar-tag ${tone}">${tag}</span>
        <div class="sen-obj-track">
          <div class="sen-pencil ${tone}" style="width:${w}rem">
            <span class="sen-pencil-body"></span>
            <span class="sen-pencil-tip" aria-hidden="true"></span>
          </div>
        </div>
      </div>
      <div class="sen-bar-units ${is1 ? '' : 'b'}" aria-hidden="true">${units}</div>`;
    }
    if (skinId === 'snake') {
      return `<div class="sen-bar-row sen-len-row skin-snake len-tap" data-side="${side}" role="button" tabindex="0" aria-label="${is1 ? '黃蟲' : '紫蟲'}">
        <span class="sen-bar-tag ${tone}">${tag}</span>
        <div class="sen-obj-track">
          <div class="sen-snake ${tone}" style="width:${w}rem">
            <span class="sen-snake-body"></span>
            <span class="sen-snake-head" aria-hidden="true">🐍</span>
          </div>
        </div>
      </div>
      <div class="sen-bar-units ${is1 ? '' : 'b'}" aria-hidden="true">${units}</div>`;
    }
    if (skinId === 'fish') {
      return `<div class="sen-bar-row sen-len-row skin-fish len-tap" data-side="${side}" role="button" tabindex="0" aria-label="${is1 ? '黃魚' : '紫魚'}">
        <span class="sen-bar-tag ${tone}">${tag}</span>
        <div class="sen-obj-track">
          <div class="sen-fish ${tone}" style="width:${w}rem">
            <span class="sen-fish-body"></span>
            <span class="sen-fish-icon" aria-hidden="true">🐟</span>
          </div>
        </div>
      </div>
      <div class="sen-bar-units ${is1 ? '' : 'b'}" aria-hidden="true">${units}</div>`;
    }
    if (skinId === 'rope' || skinId === 'carrot' || skinId === 'road' || skinId === 'ribbon') {
      return genericObj(side, w);
    }
    // default bars
    return `<div class="sen-bar-row len-tap" data-side="${side}" role="button" tabindex="0" aria-label="${is1 ? '黃條' : '紫條'}">
      <span class="sen-bar-tag ${tone}">${tag}</span>
      <div class="sen-bar-track"><div class="sen-bar ${is1 ? '' : 'b'}" style="width:${w}rem"></div></div>
    </div>
    <div class="sen-bar-units ${is1 ? '' : 'b'}" aria-hidden="true">${units}</div>`;
  };

  return {
    A, B, skin: skinId, meta,
    html: `<div class="sen-bars sen-len skin-${skinId}" role="img" aria-label="${aria}">
      ${row('1', wA, uA)}
      ${row('2', wB, uB)}
    </div>`,
  };
}

/** color-word labels for low-literacy (黃魚→黃字黃色) */
function _labelColorTone(text) {
  const t = String(text || '');
  if (/黃|黄/.test(t)) return 'yellow';
  if (/紫/.test(t)) return 'purple';
  if (/藍|蓝/.test(t)) return 'blue';
  if (/紅|红/.test(t)) return 'red';
  if (/綠|绿/.test(t)) return 'green';
  if (/橙/.test(t)) return 'orange';
  return '';
}
function _colorizeLabelHTML(text) {
  const raw = String(text == null ? '' : text);
  // escape then wrap color syllables
  const esc = (typeof escapeHTML === 'function')
    ? escapeHTML(raw)
    : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return esc
    .replace(/黃|黄/g, '<span class="lbl-c-yellow">$&</span>')
    .replace(/紫/g, '<span class="lbl-c-purple">$&</span>')
    .replace(/藍|蓝/g, '<span class="lbl-c-blue">$&</span>')
    .replace(/紅|红/g, '<span class="lbl-c-red">$&</span>')
    .replace(/綠|绿/g, '<span class="lbl-c-green">$&</span>')
    .replace(/橙/g, '<span class="lbl-c-orange">$&</span>');
}
function _paintOptionLabel(el, text, { asButton = false } = {}) {
  if (!el) return;
  const val = String(text == null ? '' : text);
  const tone = _labelColorTone(val);
  // clear prior tones
  el.classList.forEach?.(cls => {
    if (String(cls).startsWith('lbl-tone-')) el.classList.remove(cls);
  });
  // classList.forEach may not exist on older — manual strip
  ['yellow', 'purple', 'blue', 'red', 'green', 'orange'].forEach(t => {
    el.classList.remove('lbl-tone-' + t);
  });
  if (tone) {
    el.classList.add('lbl-tone-' + tone);
    // whole label tinted + color chars emphasized
    el.innerHTML = _colorizeLabelHTML(val);
  } else {
    el.textContent = val;
  }
}

/** Shared MC choice grid (normal difficulty option-btn path) */
function _appendChoiceGrid(area, q, team, gridClass) {
  const opts = q.options || [q.answer];
  const grid = document.createElement('div');
  grid.className = gridClass || 'grid grid-cols-2 gap-2';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', '答案選項');
  const optLabels = q.optionLabels || null;
  const LETTERS = ['A', 'B', 'C', 'D'];
  opts.forEach((opt, idx) => {
    const b = document.createElement('button');
    b.className = 'option-btn';
    const label = (optLabels && optLabels[opt] !== undefined) ? String(optLabels[opt]) : String(opt);
    if (q && q.type === 'compareLength') {
      b.classList.add('len-vis-btn');
      const letter = LETTERS[idx] || String(idx + 1);
      b.innerHTML = `<span class="sen-opt-letter" aria-hidden="true">${letter}</span>${_lengthOptVisualHTML(opt, q)}`;
      b.setAttribute('aria-label', `${letter}. ${label}`);
      b.dataset.letter = letter;
    } else {
      _paintOptionLabel(b, label, { asButton: true });
      b.setAttribute('aria-label', label);
    }
    b.onclick = () => Game.handleAnswer(team, opt, b);
    grid.appendChild(b);
  });
  area.appendChild(grid);
  return true;
}

/** length option = color bar + emoji (唔考識字) */
function _lengthOptVisualHTML(opt, q) {
  const ex = (q && q.extra) || {};
  const skin = ex.skin || 'bars';
  const meta = _lengthSkinMeta(skin);
  if (opt === 'eq') {
    return `<span class="len-opt-vis eq" aria-hidden="true">
      <span class="len-opt-eq-bars"><i class="y"></i><i class="p"></i></span>
      <span class="len-opt-eq-mark">🟰</span>
    </span>`;
  }
  if (opt === 'diff') {
    return `<span class="len-opt-vis diff" aria-hidden="true">
      <span class="len-opt-eq-bars"><i class="y short"></i><i class="p long"></i></span>
      <span class="len-opt-eq-mark">≠</span>
    </span>`;
  }
  const is1 = (opt === '1' || opt === 'A' || opt === 1);
  const n = Number(is1 ? (ex.a != null ? ex.a : ex.left) : (ex.b != null ? ex.b : ex.right)) || 4;
  const tone = is1 ? 'y' : 'p';
  const rawEmo = is1 ? (meta.emoji || meta.tag1 || '') : (meta.emoji || meta.tag2 || '');
  const emo = (rawEmo === '黃' || rawEmo === '紫' || !rawEmo) ? '' : rawEmo;
  const w = Math.max(1.4, Math.min(5.5, n * 0.55)).toFixed(2);
  return `<span class="len-opt-vis ${tone}" aria-hidden="true">
    <span class="len-opt-swatch ${tone}" style="width:${w}rem"></span>
    ${emo ? `<span class="len-opt-emo">${emo}</span>` : ''}
  </span>`;
}

/** Wire tap-on-picture for long/short/tall (not equal-ask) */
function _wireLengthVisualClicks(root, q, team) {
  if (!root || !q) return;
  if (!(q.type === 'compareLength' || q.type === 'compareHeight')) return;
  if (q.extra && q.extra.ask === 'eq') return;
  // pair hits (horizontal length + vertical height)
  root.querySelectorAll('.len-pair-hit[data-side], .ht-pair-hit[data-side]').forEach(el => {
    const side = el.getAttribute('data-side');
    if (side !== '1' && side !== '2') return;
    const fire = () => {
      if (el.disabled) return;
      Game.handleAnswer(team, side, el);
    };
    el.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fire(); };
  });
  // legacy vertical rows
  root.querySelectorAll('.len-tap[data-side]').forEach(el => {
    const side = el.getAttribute('data-side');
    if (side !== '1' && side !== '2') return;
    const fire = () => Game.handleAnswer(team, side, el);
    el.onclick = (e) => { e.preventDefault(); e.stopPropagation(); fire(); };
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    };
  });
}

/** glow correct bar / soft miss */
function _lenPairMark(root, side, kind) {
  if (!root) return;
  const hits = root.querySelectorAll('.len-pair-hit, .ht-pair-hit');
  if (kind === 'lock') {
    hits.forEach(el => { el.disabled = true; });
    return;
  }
  hits.forEach(el => {
    el.classList.remove('is-correct', 'is-miss');
  });
  const hit = root.querySelector(`.len-pair-hit[data-side="${side}"], .ht-pair-hit[data-side="${side}"]`);
  if (!hit) return;
  if (kind === 'correct') hit.classList.add('is-correct');
  if (kind === 'miss') hit.classList.add('is-miss');
}

/* ============== [2] 音訊 (Web Audio beeps) ============== */
const Audio = (() => {
  let ctx = null;
  // V3.6 cycle111g: 真 bus 架構（用 `audio-design` skill）
  //   Master ← { SFX , BGM ← Duck }
  // ⚠️ 之前 `masterGain` 同 `bgmGain` 都係「宣告咗但從來冇用」嘅死變數 →
  //    成個模組冇 master gain、冇音量控制、冇 ducking、冇 headroom 管理。
  //    AGENTS.md 一直將「masterGain declared and never used → no master gain」記錄為 open P1。
  let masterGain = null;   // Master bus → ctx.destination
  let sfxGain = null;      // SFX bus → masterGain
  let bgmGain = null;      // BGM 音量 bus → bgmDuckGain
  let bgmDuckGain = null;  // BGM duck bus → masterGain（獨立節點，唔會覆寫玩家嘅 slider）
  let noiseBuf = null;     // 白噪 buffer cache（之前每次 noise() 都 createBuffer）
  let bgmTempo = 0.18; // seconds per step
  let bgmStep = 0;
  let bgmInterval = null;
  let bgmArp = null;        // 當前 phrase 嘅 arp 順序（每個 phrase 洗牌）
  let bgmArpScene = null;
    // V3.4-AUDIT5: per-channel mute — maste
  let channels = { master: true, sfx: true, bgm: true };
  let busVolume = { master: 1, sfx: 1, bgm: 1 };
  let bgmDucked = false;
  function canPlaySfx() { return channels.master && channels.sfx; }
  function canPlayBgm() { return channels.master && channels.bgm; }

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { ctx = null; }
      if (ctx) ensureGraph();
    }
    return ctx;
  }
  // bus graph：Master ← { SFX , BGM ← Duck }（每個 bus 都經 masterGain → destination）
  function ensureGraph() {
    if (!ctx || masterGain) return;
    masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    sfxGain = ctx.createGain();
    bgmGain = ctx.createGain();
    bgmDuckGain = ctx.createGain();
    sfxGain.connect(masterGain);
    bgmGain.connect(bgmDuckGain);
    bgmDuckGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    applyAllGains();
  }
  // slider(0..1) → gain：**平方**
  // ⚠️ audio-design skill：raw linear-amplitude slider 會將大部分聽覺變化擺喺底部 1/5
  //    → 平方先平均分配喺整個行程。0 = 真靜音（GainNode gain 0）。
  function sliderToGain(s) {
    const v = Number.isFinite(s) ? s : 0;
    const c = v < 0 ? 0 : (v > 1 ? 1 : v);
    return c * c;
  }
  function rampGain(node, target) {
    if (!node) return;
    const g = node.gain;
    const now = ctx ? ctx.currentTime : 0;
    // 用 linear ramp（唔係 setValueAtTime 硬切）→ 唔會有 zipper noise
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + 0.08);
  }
  function applyAllGains() {
    if (!masterGain) return;
    rampGain(masterGain, sliderToGain(busVolume.master));
    rampGain(sfxGain, sliderToGain(busVolume.sfx));
    rampGain(bgmGain, sliderToGain(busVolume.bgm));
    rampGain(bgmDuckGain, bgmDucked ? 0.25 : 1);
  }
  function busNode(bus) {
    if (!ctx) return null;
    if (bus === 'bgm') return bgmGain || ctx.destination;
    return sfxGain || ctx.destination;
  }
  // 連續音（pad/drone/弦樂感覺）— 用振盪器加 filter + LFO modulation 模擬 retro feel
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, slideTo = null, slideDur = 0, bus = 'sfx') {
    const allowed = (bus === 'bgm') ? canPlayBgm() : canPlaySfx();
    if (!allowed) return;
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    if (slideTo != null) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + slideDur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(busNode(bus));
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  // ⚠️ 之前每次 noise() 都 `createBuffer`（最長 0.5s = 96KB）→ 一局打十幾次就係垃圾回收負擔。
  //    而家只 create 一個 0.5s buffer（96KB），之後靠 loop + 隨機 offset 變化。
  function getNoiseBuffer(c) {
    if (!noiseBuf) {
      const len = Math.ceil(c.sampleRate * 0.5);
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.7;
    }
    return noiseBuf;
  }
  // 8-bit 風 noise burst（爆裂感／hiss）
  function noise(dur = 0.18, vol = 0.18, hpFreq = 800, bus = 'sfx') {
    const allowed = (bus === 'bgm') ? canPlayBgm() : canPlaySfx();
    if (!allowed) return;
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
    const t0 = c.currentTime;
    const buf = getNoiseBuffer(c);
    const src = c.createBufferSource(); src.buffer = buf;
    src.loop = dur > 0.5;                                  // 長過 buffer 先 loop
    const offset = dur < 0.5 ? Math.random() * (0.5 - dur) : 0;  // 每次由唔同位開始 → 唔似重複
    const filt = c.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = hpFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(busNode(bus));
    src.start(t0, offset);
    src.stop(t0 + dur);
  }
  // 簡單琶音
  function arp(freqs, dur = 0.4, type = 'square', vol = 0.12, gap = 0.06) {
    freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * gap * 1000));
  }
  // 上行音階 (level up感)
  function sweep(dir = 'up', baseFreq = 440, dur = 0.5, type = 'sine', vol = 0.15) {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = (dur / steps) * i;
      const mult = dir === 'up' ? Math.pow(2, (i / steps) * 2) : Math.pow(2, -(i / steps) * 2);
      setTimeout(() => tone(baseFreq * mult, dur / steps, type, vol), t * 1000);
    }
  }
// scene-specific BGM patterns (forest/snow/lava/shadow/crystal)
  const BGM_PATTERNS = {
    forest:  { bass: [65, 65, 49, 49, 55, 55, 44, 44], arp: [131, 165, 196, 165, 110, 131, 165, 196, 165, 110], wave: 'triangle' },
    snow:    { bass: [62, 62, 55, 55, 49, 49, 44, 44], arp: [110, 139, 175, 139, 98, 110, 139, 175, 139, 98],  wave: 'sine' },
    lava:    { bass: [49, 41, 44, 37, 49, 41, 44, 37], arp: [98, 117, 156, 117, 82, 98, 117, 156, 117, 82],  wave: 'sawtooth' },
    shadow:  { bass: [37, 33, 41, 33, 37, 33, 41, 33], arp: [74, 92, 110, 92, 62, 74, 92, 110, 92, 62],     wave: 'square' },
    crystal: { bass: [65, 73, 82, 73, 65, 73, 82, 73], arp: [131, 156, 196, 156, 110, 131, 156, 196, 156, 110], wave: 'sine' },
  };
  let bgmScene = 'forest';
  function setBGMScene(scene) { bgmScene = BGM_PATTERNS[scene] ? scene : 'forest'; }
  //   之前每個 scene 都係一條固定 8/10 步循環 → 課堂背景音聽落好機械。
  //   而家每個 arp phrase 完就洗牌一次（bass 保持落腳點），聽落有變化但唔會走樣。
  function shuffleArp(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }
// 啟動 / 停止背景音樂（簡單 8-bit loop：bass + arp）
  function startBGM() {
    if (!canPlayBgm()) return;
    const c = ensure(); if (!c) return;
    if (bgmInterval) return;
    bgmStep = 0;
    bgmInterval = setInterval(() => {
      if (!canPlayBgm()) return;
      const cur = BGM_PATTERNS[bgmScene] || BGM_PATTERNS.forest;
      if (!bgmArp || bgmArpScene !== bgmScene) {
        bgmArp = cur.arp.slice();
        bgmArpScene = bgmScene;
      }
      // 每個 arp phrase（10 步）完就洗牌 → 變奏但唔斷奏
      if (bgmStep % bgmArp.length === 0) shuffleArp(bgmArp);
      const bass = cur.bass[bgmStep % cur.bass.length];
      const arpN = bgmArp[bgmStep % bgmArp.length];
      // ⚠️ bus='bgm' → 經 bgmGain → bgmDuckGain → masterGain
      //    （唔再同 SFX 混埋一齊，所以朗讀時可以獨立 duck 音樂）
      tone(bass * 4, 0.18, cur.wave, 0.10, null, 0, 'bgm');
      tone(arpN * 2, 0.12, 'square', 0.06, null, 0, 'bgm');
      if (bgmStep % 8 === 0) tone(33, 0.6, 'sine', 0.10, null, 0, 'bgm');
      bgmStep++;
    }, bgmTempo * 1000);
  }
  function stopBGM() {
    if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
  }
  return {
    // —— SFX ——
    correct: () => {
      // 兩音上升 — C major 二度 sparkle
      tone(880, 0.08, 'sine', 0.18);
      setTimeout(() => tone(1320, 0.16, 'sine', 0.18), 60);
      setTimeout(() => tone(1760, 0.10, 'sine', 0.10), 110);
    },
    wrong:   () => {
      tone(220, 0.16, 'sawtooth', 0.18, 110, 0.16);
      tone(180, 0.20, 'square', 0.16, 90, 0.20);
    },
    attack:  () => { // 角色攻擊擊中 boss · punchier
      tone(140, 0.05, 'square', 0.18, 920, 0.05);
      setTimeout(() => tone(90, 0.12, 'square', 0.2), 28);
      setTimeout(() => noise(0.09, 0.12, 700), 45);
      // short attack sting (mini BGM)
      setTimeout(() => {
        tone(392, 0.07, 'square', 0.1);
        setTimeout(() => tone(523, 0.08, 'square', 0.11), 55);
        setTimeout(() => tone(659, 0.12, 'square', 0.12), 110);
      }, 70);
    },
    bossHit: () => { // boss 受傷 · heavier
      tone(160, 0.16, 'square', 0.22, 70, 0.16);
      noise(0.12, 0.2, 350);
      setTimeout(() => tone(98, 0.2, 'sawtooth', 0.14, 55, 0.2), 40);
      setTimeout(() => { tone(220, 0.08, 'triangle', 0.08); tone(330, 0.1, 'triangle', 0.06); }, 90);
    },
    attackSting: () => { // 答對攻擊 fanfare 短句
      tone(262, 0.06, 'square', 0.1);
      setTimeout(() => tone(330, 0.06, 'square', 0.1), 50);
      setTimeout(() => tone(392, 0.06, 'square', 0.11), 100);
      setTimeout(() => tone(523, 0.14, 'square', 0.13), 150);
    },
    bossEnraged: () => { // boss 狂暴吼叫
      tone(110, 0.4, 'sawtooth', 0.18, 73, 0.4); // 下滑吼
      noise(0.30, 0.10, 200);
    },
    bossDefeat: () => { // boss 陣亡爆散
      tone(220, 0.6, 'square', 0.18, 55, 0.6);
      noise(0.5, 0.18, 200);
      setTimeout(() => { tone(110, 0.7, 'sine', 0.18); tone(165, 0.7, 'sine', 0.10); }, 150);
    },
    castle:  () => { // 城塔被打中
      tone(110, 0.30, 'sawtooth', 0.18, 60, 0.30);
      noise(0.20, 0.16, 300);
    },
    castleHitHeavy: () => { // 城塔低 HP 再被打
      tone(90, 0.45, 'sawtooth', 0.20, 40, 0.45);
      noise(0.35, 0.20, 150);
    },
    ultimate: () => { // meteor 蓄力 + 釋放
      sweep('up', 220, 0.6, 'square', 0.10);  // 蓄力上行
      setTimeout(() => {
        tone(80, 0.4, 'square', 0.22);       // 撞地 low
        noise(0.35, 0.20, 400);              // 爆炸 hiss
        setTimeout(() => tone(220, 0.6, 'sawtooth', 0.18, 110, 0.6), 80); // 餘震
      }, 600);
    },
    freeze:  () => { // 冰凍音效
      tone(1760, 0.10, 'triangle', 0.10);
      setTimeout(() => tone(2640, 0.15, 'triangle', 0.12), 50);
      setTimeout(() => tone(3520, 0.20, 'triangle', 0.10), 100);
      noise(0.18, 0.08, 1500);
    },
    energyTick: () => { // 每次答對 +8~14 energy
      tone(660, 0.04, 'sine', 0.08);
    },
    hpTick:   () => { // boss HP 過 threshold（狂暴 / 冰凍 切換）
      tone(440, 0.10, 'square', 0.18, 220, 0.10);
    },
    reviewAdd: () => { // 錯題加入重練區
      tone(660, 0.06, 'square', 0.10);
      setTimeout(() => tone(440, 0.06, 'square', 0.10), 50);
    },
    victory:  () => { // 勝利 fanfare（C 大調上行 + C 和弦）
      arp([523, 659, 784, 1047], 0.5, 'square', 0.18, 0.10);
      setTimeout(() => {
        // C E G 同時
        [262, 330, 392].forEach(f => tone(f, 1.5, 'triangle', 0.12));
      }, 500);
    },
    defeat:   () => { // 失敗 sting（下行 + 低音餘韻）
      sweep('down', 220, 0.5, 'sawtooth', 0.18);
      setTimeout(() => tone(73, 1.2, 'sine', 0.16), 300);
    },
    countdown: () => tone(880, 0.10, 'square', 0.14), // 倒數最後 10 秒
    click: () => tone(660, 0.04, 'sine', 0.08),
    // V3.6 cycle105: 呢兩個之前被 call 但冇 export → runtime TypeError
    // (call sites: Audio.tick @6643 推薦 chip toggle / Audio.beep @10160 長按顯示答案)
    tick: () => tone(1200, 0.03, 'square', 0.05),   // UI tick — 輕量確認 blip
    beep: (freq = 440, dur = 0.08) => tone(freq, dur, 'sine', 0.12), // 通用提示 beep
    // arena SFX
    tugPull: () => {
      tone(140, 0.07, 'square', 0.14, 90, 0.07);
      noise(0.05, 0.08, 500);
      setTimeout(() => tone(200, 0.06, 'triangle', 0.10), 40);
    },
    boatRow: () => {
      tone(330, 0.09, 'sine', 0.12);
      setTimeout(() => tone(440, 0.11, 'triangle', 0.10), 50);
      noise(0.04, 0.05, 1200);
    },
    // BGM
    startBGM, stopBGM, setBGMScene,
    // 控制
    enable(b) {
      const wasMaster = channels.master;
      channels.master = !!b;
      // sync sfx/bgm 跟 master（向後兼容舊 call site 全部 enabled = 嘅意思）
      channels.sfx = !!b;
      channels.bgm = !!b;
      if (!channels.master) stopBGM();
      else if (wasMaster === false) {/* user re-enabled; let game loop start */}
    },
    // V3.4-AUDIT5: per-channel control (P1)
    setChannel(name, on) {
      if (!(name in channels)) return;
      channels[name] = !!on;
      // 關 bgm → 立即停 interval；再開 → 由 game loop 自己 call startBGM
      if (name === 'bgm' && !channels.bgm) stopBGM();
    },
    // ===== 音量 / ducking API =====
    // ⚠️ 用 `Number.isFinite(n) ? n : default` —— 唔可以用 `Number(x) || default`
    //    （0 係 falsy，會被當成 default，令「靜音」變成「100%」）。
    setMasterVolume(v) {
      busVolume.master = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
      applyAllGains();
      return busVolume.master;
    },
    setBusVolume(name, v) {
      if (!(name in busVolume)) return null;
      busVolume[name] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
      applyAllGains();
      return busVolume[name];
    },
    getBusVolume(name) { return name in busVolume ? busVolume[name] : null; },
    // 實際 gain（已平方）—— 用嚟驗證 slider 映射
    getBusGain(name) { return name in busVolume ? sliderToGain(busVolume[name]) : null; },
    // Ducking：TTS 朗讀時壓低 BGM（≈ -12 dB）
    // ⚠️ 用**獨立** duck bus（bgmDuckGain），唔係直接改 bgmGain ——
    //    否則 un-duck 會覆寫玩家自己嘅 BGM 音量設定（audio-design skill：唔好同 slider 打架）。
    duckBGM(active) {
      bgmDucked = !!active;
      if (bgmDuckGain) rampGain(bgmDuckGain, bgmDucked ? 0.25 : 1);
      return bgmDucked;
    },
    isBgmDucked() { return bgmDucked; },
    // bus graph 測試用：畀 audio-audit 驗真實拓撲（唔係淨係變數名）
    getBusTopology() {
      return {
        hasMaster: !!masterGain,
        hasSfx: !!sfxGain,
        hasBgm: !!bgmGain,
        hasDuck: !!bgmDuckGain,
      };
    },
    getChannels() { return { ...channels }; },
    isEnabled() { return channels.master && channels.sfx; },
    isBgmOn() { return channels.bgm; },
    // timer handle → 永遠 undefined → 切走 tab 後 BGM 唔會恢復。
    // 正確做法: export 一個 boolean accessor, 唔好 export 原始 handle。
    isPlaying() { return !!bgmInterval; },
    prime() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(()=>{}); },
  };
})();

/* ============== [3] 視覺特效 ============== */
// V3.4-F2: TTS module (Web Speech API)
const TTS = {
  // 香港中文 voice detection (zh-HK > zh-TW > zh-CN fallback)
  voice: null,
  enabled: true,
    // V3.5-AUDIT7-F06: monotonic counter in
  // onBoundary handlers compare captured epoch vs current — if mismatched,
  // the callback fired after a question-change and we early-return to avoid
  // highlighting tokens that belong to the previous (already-removed) question.
  _boundaryEpoch: 0,
  pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    return voices.find(v => v.lang === 'zh-HK') ||
           voices.find(v => v.lang.startsWith('zh')) ||
           voices.find(v => v.default) ||
           voices[0];
  },
  // 把數學式 normalize 變 human-readable 中文
  normalize(text) {
    if (!text) return '';
    return text
      .replace(/❓/g, '，等於幾多？')   // V3.6-SEN: emoji question mark
      .replace(/\?/g, '，等於幾多？')
      .replace(/=/g, '等於')
      .replace(/\+/g, '加')
      .replace(/-/g, '減')
      .replace(/×/g, '乘')
      .replace(/÷/g, '除以')
      .replace(/</g, '細過')
      .replace(/>/g, '大過')
      .replace(/比/g, '比較')
      .replace(/排順序：/g, '請排順序：')
      .replace(/這是什麼形狀？/g, '這是什麼形狀？')
      .replace(/時鐘顯示/g, '時鐘顯示');
  },
  speak(text, btn, opts = {}) {
    // V3.5-P0: TTS.speak() opts={onBoundary
    // V3.4-F2 compat + AUDIT3-C2: clear .sp
    if (TTS.enabled) document.querySelectorAll('.tts-btn.speaking').forEach(b => b.classList.remove('speaking'));
    if (!('speechSynthesis' in window)) return;  // graceful fallback
    if (!TTS.enabled) return;
    if (!text) return;
    speechSynthesis.cancel();  // 停上一句
    // V3.4-AUDIT3-FIX: clear .speaking on c
    // 舊 btn 嘅 .speaking 殘留造成 stale 綠色 pulse)。 全域清完先 add 新 btn。
    document.querySelectorAll('.tts-btn.speaking').forEach(b => b.classList.remove('speaking'));
    // V3.5-P0: clear leftover Karaoke highl
    // cleans up but cancel()-without-onend could leak if DOM was rebuilt mid-speech)
    document.querySelectorAll('.tts-tok.tts-active').forEach(t => t.classList.remove('tts-active'));
    // V3.5-AUDIT7-F06: bump epoch BEFORE wi
    // firing from a previous utterance (Chrome fires one final boundary after
    // cancel() in some cases) compares against new epoch and early-returns.
    TTS._boundaryEpoch++;
    const myEpoch = TTS._boundaryEpoch;
    //   語音同背景音樂一齊出 → 學生聽唔清題目。壓低音樂就清晒。
    // ⚠️ unduck 要帶 epoch guard：`speechSynthesis.cancel()` 會令**舊** utterance 嘅
    //    onend 觸發，唔 check epoch 就會喺新一句講緊時提早 unduck。
    const unduck = () => {
      if (myEpoch !== TTS._boundaryEpoch) return;
      if (typeof Audio !== 'undefined' && Audio.duckBGM) Audio.duckBGM(false);
    };
    if (typeof Audio !== 'undefined' && Audio.duckBGM) Audio.duckBGM(true);
    const utter = new SpeechSynthesisUtterance(TTS.normalize(text));
    if (!TTS.voice) TTS.voice = TTS.pickVoice();
    if (TTS.voice) utter.voice = TTS.voice;
    utter.lang = (TTS.voice && TTS.voice.lang) || 'zh-HK';
    utter.rate = 0.9;
    utter.pitch = 1.0;
    if (btn) {
      btn.classList.add('speaking');
      utter.onend = () => { btn.classList.remove('speaking'); unduck(); if (opts.onEnd) opts.onEnd(); };
      utter.onerror = () => { btn.classList.remove('speaking'); unduck(); if (opts.onEnd) opts.onEnd(); };
    } else {
      utter.onend = () => { unduck(); if (opts.onEnd) opts.onEnd(); };
      utter.onerror = () => { unduck(); if (opts.onEnd) opts.onEnd(); };
    }
    // V3.5-P0: TTS Karaoke boundary callbac
    // charIndex is offset into the NORMALIZED utterance text (what utter.text holds),
    // NOT the raw input. Caller is responsible for building .tts-tok spans with
    // matching data-start/data-end (see UI.renderQuestionTextFor).
    if (opts.onBoundary) {
      utter.onboundary = (e) => {
    // V3.5-AUDIT7-F06: race guard — skip st
        // mid-speech, _boundaryEpoch got bumped on next speak(). This callback's
        // captured myEpoch no longer matches → drop the boundary event so we
        // don't highlight a token that belongs to a now-removed question.
        if (myEpoch !== TTS._boundaryEpoch) return;
        if (e && typeof e.charIndex === 'number') opts.onBoundary(e.charIndex);
      };
    }
    speechSynthesis.speak(utter);
  },
  // V3.4-AUDIT5: explicit cancel — 換題/暫停/
  cancel() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    // cycle111g: cancel 都要 unduck（否則 cancel 後 BGM 永遠壓住）
    if (typeof Audio !== 'undefined' && Audio.duckBGM) Audio.duckBGM(false);
    document.querySelectorAll('.tts-btn.speaking').forEach(b => b.classList.remove('speaking'));
    // V3.5-P0: clear leftover .tts-active h
    // question / new game starts with a clean visual slate (no stale amber block).
    document.querySelectorAll('.tts-tok.tts-active').forEach(t => t.classList.remove('tts-active'));
    // V3.5-AUDIT7-F06: bump epoch on cancel
    // a recently-cancelled utterance that fires one final time will see the
    // epoch mismatch and early-return. Defense-in-depth alongside the cancel()
    // call inside speak().
    TTS._boundaryEpoch++;
  },
  isEnabled() { return this.enabled; },
  setEnabled(b) { this.enabled = !!b; if (!this.enabled) this.cancel(); },
};
// 喺 voices loaded 後再 pick (Chrome quirk)
if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { TTS.voice = TTS.pickVoice(); };
}

    // V3.4-F3: encouragement pool (港式粵語 + S
    // V3.4-F3-b: 同時支援 AI-generated pool (us
const Compliment = {
  pool: {
    correct: [
      '掂呀！答啱啦 💪', '犀利！叻叻', '正中紅心！', '你做得好好！', '繼續保持呢個勢',
      'Boss 都怕你啦', '天資聰敏！', '答得快又準！', '果然係高手', '真係好醒！',
      '呢條公式用到啱晒', '太叻喇！', '數學小天才！', '叻到爆！', '一擊即中！',
      '完美演繹！', '氣勢如虹！', '繼續衝呀！', '你係隊伍嘅光榮', 'Boss 都投降啦',
      '穩穩陣陣！', '快狠準！', '天才！', '呀！答啱晒', '太神啦',
      'Boss 都要抖下', '繼續劈波斬浪', '好犀利呀！', '反應超快', '隊友都佩服你',
      '完美配對！', '計到剛剛好', '真係頂呱呱', '過關無難度！', 'Boss 開始心寒',
      '神級操作！', '一擊必殺！', '輕鬆過關', '繼續收割！', 'Boss 已經殘晒',
      '呢招用得啱', '思路清晰！', '做得好！', 'Team 嘅驕傲', '答題快手',
      '快夾準！', 'Boss 已經投降', '完美！', '讚讚讚！', '數學小先鋒！',
      '答啱啦！', '真係識答', '棒極啦！', '聰明絕頂', '表現出色！',
      'Boss 已經怕咗你', '👏👏👏 答啱啦', '你係最強嘅', '厲害啦朋友', '準繩度爆燈'
    ],
    wrong: [
      '唔緊要，再嚟過！', '試多次啦！', '差一啲啲 💪', '我哋再挑戰', '失敗乃成功之母',
      'Boss 笑緊你添 😤', '加油！你得嘅', '唔好放棄！', '再諗多一次', '呢題比較難，正常',
      '慢慢嚟啦', '一齊加油', '你一定得！', '失敗唔可怕', '再嚟多一次啦',
      'Boss 等緊你反擊', '我哋一齊', '唔好咁快放棄', '差少少先啫', '再睇多次題目',
      '你試下用另一個方法', '唔使氣餒！', '小小挫折唔怕', 'Boss 都畀面你', '加油呀朋友',
      '呢題啱難度㗎', '一齊面對啦', '你做得到！', '堅持就會贏', '差一啲啲咋',
      '我哋並肩作戰', '再衝一次！', '唔好俾Boss睇小', '失敗係過程', '一齊再嚟',
      '差少少就啱', '再俾心機', '下一題加油', '我哋一齊努力', '唔好放棄呀',
      'Boss 都未輸', '你亦都未輸', '再嚟多一次', '一步一步嚟', '你做緊好',
      '失敗唔代表一切', '深呼吸再嚟', 'Boss 驚你嘅', '我哋唔放棄', '加油添！',
      '越戰越強！', '差少少咋', 'Boss 怕你反擊', '我信你可以', '再嚟啦朋友',
      '一齊度過難關', '唔好氣餒！', 'Boss 等緊你', '你一定會答啱', '加油💪'
    ],
    streak: [
      '連擊 %d 題！太犀利啦', '連擊中！🔥', '%d 連勝！你係 boss', '波濤洶湧嘅攻勢！',
      'Boss 開始冇符', '%d 連勝！Boss 都要跪低', '完美節奏！', '%d 連勝！繼續！',
      'Boss 投降啦！%d 連勝', '殺氣騰騰！', '%d 連勝！真係型', 'Boss 等緊被擊敗'
    ]
  },
  pick(kind, streak) {
    const arr = this.pool[kind] || this.pool.correct;
    let line = arr[Math.floor(Math.random() * arr.length)];
    if (kind === 'streak' && streak != null) {
      line = line.replace('%d', streak);
    }
    return line;
  },
  // 啟動時可選 upgrade 至 AI-generated pool (F3-b)
  async upgrade(apiKey) {
    if (!apiKey || apiKey.length < 10) return false;
    try {
      const prompt = '你係一個港式粵語 SEN 友善嘅小老師，幫一個 K1-K3 學生打氣。' +
                     '請生成 60 句鼓勵語（答啱用）、60 句鼓勵再嚟（答錯用）、12 句連擊鼓勵（用 %d 代替數字）。' +
                     '每句 5-15 字，emoji 可加可不加，輸出 JSON：' +
                     '{"correct":["..."],"wrong":["..."],"streak":["..."]}';
      const r = await fetch('https://api.MiniMax.chat/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'MiniMax-Text-01',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9
        })
      });
      if (!r.ok) return false;
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return false;
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.correct && parsed.wrong) {
        this.pool = parsed;
        return true;
      }
    } catch (e) { /* silent fallback to hardcoded */ }
    return false;
  }
};

const FX = {
  meteor(targetSelector = '#boss-icon', onDone) {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const m = document.createElement('div');
    m.className = 'meteor';
    m.innerHTML = '<svg class="pixel" style="width:80px;height:80px;filter:drop-shadow(0 0 18px #fb923c)"><use href="#px-meteor"/></svg>';
    m.style.left = (rect.left + rect.width * 0.3) + 'px';
    m.style.top = '0px';
    document.body.appendChild(m);
    setTimeout(() => {
      m.remove();
      // 爆炸粒子
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      this.burst(cx, cy, 26, ['#fef08a', '#f59e0b', '#ef4444', '#a855f7']);
      if (onDone) onDone();
    }, 1100);
  },
  burst(cx, cy, count = 18, colors = ['#fef08a', '#f59e0b']) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 140;
      p.style.left = (cx - 7) + 'px';
      p.style.top  = (cy - 7) + 'px';
      p.style.background = `radial-gradient(circle, ${colors[i % colors.length]}, transparent)`;
      p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  },
    // V3.4-UI2: confetti burst from element
  confetti(cx, cy, count = 28) {
    const colors = ['#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#fb923c'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 280;
      p.style.left = cx + 'px';
      p.style.top  = cy + 'px';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--cy', Math.sin(angle) * dist + 200 + 'px');  // 加重力下沉
      p.style.setProperty('--cr', (Math.random() * 720 - 360) + 'deg');
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  },
  // V3.4-UI2: screen-wide shake (答錯效果, 整個
  screenShake() {
    const app = $('app');
    if (!app) return;
    app.classList.remove('screen-shake-active');
    void app.offsetWidth;  // 重啟 animation
    app.classList.add('screen-shake-active');
    setTimeout(() => app.classList.remove('screen-shake-active'), 500);
  },
  screenAlert(text, color = '#22c55e') {
    // V3.4-AUDIT3-FIX: cap concurrent 數量 — 
    // 1.6s 動畫 lifetime 內 stack 5-8 個 → 視覺混亂 + 定位 queue 蓋住。 Keep only 最後 1 個。
    const existing = document.querySelectorAll('.screen-alert');
    if (existing.length >= 1) existing.forEach(e => e.remove());
    const a = document.createElement('div');
    a.className = 'screen-alert';
    a.textContent = text;
    a.style.background = color;
    a.style.color = 'white';
    a.style.animation = 'screen-alert 1.6s ease forwards';
    document.body.appendChild(a);
    setTimeout(() => a.remove(), 1700);
    // V3.3-UI4: a11y — also push to hidden 
    let live = $('aria-live-alerts');
    if (!live) {
      live = document.createElement('div');
      live.id = 'aria-live-alerts';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
      document.body.appendChild(live);
    }
    live.textContent = '';  // reset then set (screen-reader detects change)
    setTimeout(() => { live.textContent = text; }, 50);
  },
  shake(el, cls = 'anim-shake') {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 450);
  },
  hitFlash(el) {
    if (!el) return;
    el.classList.remove('boss-hit-flash');
    void el.offsetWidth;
    el.classList.add('boss-hit-flash');
    setTimeout(() => el.classList.remove('boss-hit-flash'), 550);
  },
  slashToBoss(team, onImpact) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const boss = $('boss-icon');
    if (!boss) { if (onImpact) onImpact(); return; }
    const b = boss.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    if (reduce) { if (onImpact) onImpact(); return; }
    const card = $(`${team}-card`) || $(`${team}-active-badge`);
    let sx = window.innerWidth * (team === 'mage' ? 0.72 : 0.28);
    let sy = window.innerHeight * 0.62;
    if (card) {
      const r = card.getBoundingClientRect();
      sx = r.left + r.width / 2;
      sy = r.top + Math.min(r.height * 0.35, 80);
    }
    const slash = document.createElement('div');
    slash.className = 'fx-slash';
    slash.textContent = team === 'mage' ? '✨' : '⚔️';
    slash.style.left = (sx - 28) + 'px';
    slash.style.top = (sy - 28) + 'px';
    document.body.appendChild(slash);
    requestAnimationFrame(() => {
      slash.style.left = (bx - 28) + 'px';
      slash.style.top = (by - 28) + 'px';
      slash.classList.add('impact');
    });
    setTimeout(() => {
      slash.remove();
      if (onImpact) onImpact();
    }, 400);
  },
  floatDamage(amount, x, y) {
    const el = document.createElement('div');
    el.className = 'fx-float-dmg';
    el.textContent = `-${amount}`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  },
  impactRing(x, y) {
    const el = document.createElement('div');
    el.className = 'fx-impact-ring';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 560);
  },
  screenHitFlash() {
    const el = document.createElement('div');
    el.className = 'fx-screen-hit';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 360);
  },
  bossArenaPulse() {
    const p = $('boss-panel');
    if (!p) return;
    p.classList.remove('boss-arena-pulse');
    void p.offsetWidth;
    p.classList.add('boss-arena-pulse');
    setTimeout(() => p.classList.remove('boss-arena-pulse'), 560);
  },
};

/* ============== [4] 題目生成器 — Data-driven registry ==============
 * v3.1: 取代 monolithic switch，用 TYPE_REGISTRY central source-of-truth
 * 加新 type 只改 (a) registry entry (b) generator function — UI 自動 dynamic render
 */
const TYPE_REGISTRY = {
  // === Basic arithmetic (numeric layout, generic text) ===
  add10: { id:'add10', label:'10 以內加法', emoji:'➕', difficulty:1, category:'math', icon:null, mode:['choice','keypad'], layout:'numeric', desc:'1+9 範圍內' },
  sub10: { id:'sub10', label:'10 以內減法', emoji:'➖', difficulty:1, category:'math', icon:null, mode:['choice','keypad'], layout:'numeric', desc:'結果不會負' },
  add20: { id:'add20', label:'20 以內加法', emoji:'➕', difficulty:2, category:'math', icon:null, mode:['choice','keypad'], layout:'numeric', desc:'和 ≤ 20' },
  sub20: { id:'sub20', label:'20 以內減法', emoji:'➖', difficulty:2, category:'math', icon:null, mode:['choice','keypad'], layout:'numeric', desc:'被減數 ≤ 20' },
  add2d: { id:'add2d', label:'雙位不進位加', emoji:'🧮', difficulty:3, category:'math', icon:'px-abacus', mode:['choice','keypad'], layout:'numeric', desc:'兩位相加無進位' },
  sub2d: { id:'sub2d', label:'雙位不借位減', emoji:'🧮', difficulty:3, category:'math', icon:'px-abacus', mode:['choice','keypad'], layout:'numeric', desc:'兩位相減無借位' },
  // === Visual / counting (SEN 中度適用) ===
  count10: { id:'count10', label:'看圖數數', emoji:'🔢', difficulty:1, category:'math', icon:null, mode:['choice','keypad'], layout:'parts-emoji', desc:'數水果數量' },
  count1to3: { id:'count1to3', label:'數 1-3', emoji:'🔢', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'parts-emoji', desc:'1-3 個水果' },
  groupAdd: { id:'groupAdd', label:'兩組加埋', emoji:'🍇', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'parts-emoji', desc:'兩組水果加埋有幾多' },
  compareGroup: { id:'compareGroup', label:'邊組多', emoji:'⚖️', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'parts-emoji', desc:'左多/右多/一樣多' },
  compare10: { id:'compare10', label:'大小比較', emoji:'⚖️', difficulty:1, category:'math', icon:null, mode:['choice','keypad'], layout:'sym-button', desc:'填 < = > (choice 三按鈕 / keypad 紫粉鍵)' },
  double: { id:'double', label:'雙數倍數', emoji:'✖️', difficulty:1, category:'math', icon:null, mode:['choice','keypad'], layout:'parts-emoji', desc:'2 個相同加起來' },
  whatTime: { id:'whatTime', label:'時鐘整點', emoji:'🕐', difficulty:2, category:'math', icon:null, mode:['choice','keypad'], layout:'clock', desc:'看鐘面答時間 (1-12)' },
  shapeMatch: { id:'shapeMatch', label:'形狀辨認', emoji:'🔺', difficulty:1, category:'math', icon:null, mode:['choice','keypad'], layout:'shape', desc:'圖形名 (圓/方/三/星)' },
  ordering: { id:'ordering', label:'由小到大', emoji:'📊', difficulty:2, category:'math', icon:null, mode:['choice','order','keypad'], layout:'order', desc:'三個數排順序 (choice MC / 撳掣排 / keypad)' },
  // === 中度主頁範疇 ===
  count20: { id:'count20', label:'數數 1-10', emoji:'🔢', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'parts-emoji', desc:'睇圖數 1-10' },
  compareLength: { id:'compareLength', label:'長短比較', emoji:'📏', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'bars', desc:'邊條長／短' },
  compareHeight: { id:'compareHeight', label:'高矮比較', emoji:'📏', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'height', desc:'邊個高／矮' },
  orderAsc20: { id:'orderAsc20', label:'1-20 順序', emoji:'📈', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'seq-choice', desc:'兩數後邊個跟住（細→大）' },
  orderDesc20: { id:'orderDesc20', label:'1-20 倒序', emoji:'📉', difficulty:1, category:'math', icon:null, mode:['choice'], layout:'seq-choice', desc:'兩數後邊個跟住（大→細）' },
  learnL: { id:'learnL', label:'學用 L', emoji:'🧃', difficulty:1, category:'life', icon:null, mode:['choice'], layout:'pic-grid', desc:'觀察包裝學 L' },
  findLDrink: { id:'findLDrink', label:'找 L 飲品', emoji:'🥛', difficulty:1, category:'life', icon:null, mode:['choice'], layout:'pic-grid', desc:'邊支飲品有 1L?' },
  findLItem: { id:'findLItem', label:'找 L 物品', emoji:'🪣', difficulty:1, category:'life', icon:null, mode:['choice'], layout:'pic-grid', desc:'邊件物品用 L?' },
};

// home scope catalog (1 scope = 1 type)
const SCOPE_CATALOG = [
  { id: 'count20', label: '數數 1–10', emoji: '🔢' },
  { id: 'compareLength', label: '長短比較', emoji: '📏' },
  { id: 'compareHeight', label: '高矮比較', emoji: '↕️' },
  { id: 'orderAsc20', label: '順序·跟住', emoji: '📈' },
  { id: 'orderDesc20', label: '倒序·跟住', emoji: '📉' },
  { id: 'learnL', label: '學用 L', emoji: '🧃' },
  { id: 'findLDrink', label: '找 L 飲品', emoji: '🥛' },
  { id: 'findLItem', label: '找 L 物品', emoji: '🪣' },
];
const DEFAULT_SCOPES = SCOPE_CATALOG.map(s => s.id);

// === Generator helpers — per type specific math ===
//   ratio 2   → 短 2–4 / 長 = 短×2（一眼就知，cycle 75 舊行為）
//   ratio 3   → 短 2   / 長 6
//   ratio 1.5 → 短 2 或 4 / 長 3 或 6（最接近，最有挑戰）
// ⚠️ 長柱上限 8（bar 係 ch.repeat(n)，太長會爆版）
function _comparePair(ratio) {
  const MAXN = 8;
  if (ratio === 1.5) {
    const shortN = (Math.random() < 0.5) ? 2 : 4;
    return { shortN, longN: shortN * 1.5 };
  }
  if (ratio === 3) {
    return { shortN: 2, longN: 6 };
  }
  // ratio 2（預設）
  const shortN = randInt(2, 4);
  let longN = shortN * 2;
  if (longN > MAXN) longN = MAXN;
  if (longN < shortN * 2) longN = Math.min(MAXN, shortN * 2);
  return { shortN, longN };
}

const Generators = {
  // numeric standard; easy mode narrows range for SEN 中度 students
  numeric(type, mode) {
    const easy = Game.settings.difficulty === 'easy';
    let a, b, op, answer;
    if (type === 'add10') {
      const max = easy ? 5 : 9;
      a = randInt(1, max); b = randInt(0, Math.max(0, (easy ? 5 : 10) - a)); op = '+'; answer = a + b;
    }
    else if (type === 'sub10') {
      const max = easy ? 5 : 10;
      const t = randInt(1, max); a = t; b = randInt(0, a); op = '-'; answer = a - b;
    }
    else if (type === 'add20') { a = randInt(1, 15); b = randInt(0, 20 - a); op = '+'; answer = a + b; }
    else if (type === 'sub20') { a = randInt(5, 20); b = randInt(0, a); op = '-'; answer = a - b; }
    else if (type === 'add2d') {
      while (true) {
        a = randInt(10, 99); b = randInt(0, 99 - a);
        const ua = a % 10, ub = b % 10, ta = Math.floor(a / 10), tb = Math.floor(b / 10);
        if (ua + ub <= 9 && ta + tb <= 9) break;
      }
      op = '+'; answer = a + b;
    }
    else if (type === 'sub2d') {
      while (true) {
        a = randInt(11, 99); b = randInt(0, a);
        const ua = a % 10, ub = b % 10, ta = Math.floor(a / 10), tb = Math.floor(b / 10);
        if (ub <= ua && tb <= ta) break;
      }
      op = '-'; answer = a - b;
    }
    else { a = 1; b = 1; op = '+'; answer = 2; }
    const text = `${a} ${op} ${b} = ?`;
    return { text, answer, parts: [text], type };
  },
  // 看圖數數 — easy: 1-5 個; normal: 1-10 個
  count10(mode) {
    const easy = Game.settings.difficulty === 'easy';
    const fruits = ['🍎','🍌','🍇','🍓','🍊','🍉'];
    const f = fruits[randInt(0, fruits.length - 1)];
    const max = easy ? 5 : 10;
    const n = randInt(easy ? 1 : 1, max);
    const parts = [f.repeat(n), '= ?'];
    return { parts, answer: n, type:'count10', answerDisplay: String(n) };
  },
  // 1-3 個純 emoji
  count1to3(mode) {
    const items = ['🍎','🍌','🍇','🍓','🌟','🐶','🐱','🌺'];
    const f = items[randInt(0, items.length - 1)];
    const n = randInt(1, 3);
    const parts = [f.repeat(n)];
    return { parts, answer: n, type:'count1to3' };
  },
  // 兩組加埋
  groupAdd(mode) {
    // V3.6-SEN-FIX: same fruit on both sides — easier to count "same thing + same thing"
    const fruits = ['🍎','🍌','🍇','🍓','🍊'];
    const easy = Game.settings.difficulty === 'easy';
    const maxG = easy ? 3 : 4;
    const g1 = randInt(1, maxG), g2 = randInt(1, maxG);
    const f = fruits[randInt(0, fruits.length - 1)];
    return { parts: [f.repeat(g1), ' + ', f.repeat(g2), ' = ❓'], answer: g1 + g2, type:'groupAdd' };
  },
  // 兩組比多少
  compareGroup(mode) {
    const fruits = ['🍎','🍌','🍇','🍓','🍊'];
    const easy = Game.settings.difficulty === 'easy';
    const maxG = easy ? 4 : 5;
    const g1 = randInt(1, maxG);
    const f1 = fruits[randInt(0, fruits.length - 1)];
    const f2 = fruits[randInt(0, fruits.length - 1)];
    const roll = Math.random();
    let g2, ans;
    // V3.6-SEN-FIX: equal (ans=3) probability lowered to 25% — hardest concept for moderate SEN
    if (roll < 0.40) { g2 = g1 + randInt(1, 2); ans = 2; }       // right more: 40%
    else if (roll < 0.75) { g2 = Math.max(1, g1 - randInt(1, 2)); ans = 1; } // left more: 35%
    else { g2 = g1; ans = 3; }                                              // equal: 25%
    return { parts: [f1.repeat(g1), ' ? ', f2.repeat(g2)], answer: ans, type:'compareGroup', optionLabels:{1:'左邊多',2:'右邊多',3:'一樣多'} };
  },
  // 大小比較 — answer ∈ '<' | '=' | '>'；題幹只出兩數 + ?（唔劇透符號）
  compare10() {
    let a, b, sym;
    const roll = Math.random();
    if (roll < 0.25) {
      a = randInt(1, 99); b = a; sym = '=';
    } else {
      do { a = randInt(1, 99); b = randInt(1, 99); } while (a === b);
      sym = a < b ? '<' : '>';
    }
    return {
      parts: [`${a}`, '  ?  ', `${b}`],
      answer: sym,
      type: 'compare10',
      options: ['<', '=', '>'],
      optionLabels: { '<': '＜ 細', '=': '＝ 等', '>': '＞ 大' },
    };
  },
  // 雙數 — 出 2 個相同小組，問 total
  double() {
    const group = randInt(1, 5);
    const fruits = ['🍎','🍌','🍇','🍓','🌟'];
    const f = fruits[randInt(0, fruits.length - 1)];
    const g1 = f.repeat(group);
    const g2 = f.repeat(group);
    return { parts: [g1, ' + ', g2, ' = ?'], answer: group * 2, type:'double' };
  },
  // 時鐘整點 — 題幹唔洩答案；choice 預先生 4 選
  // V3.6 cycle102: 用 _pickRandomDistinct helper (dedup inline pattern)
  whatTime() {
    const hour = randInt(1, 12);
    const distractors = Generators._pickRandomDistinct(3, 1, 12, [], 30);
    const options = shuffle([hour, ...distractors]);
    const optionLabels = {};
    options.forEach(h => { optionLabels[h] = `${h} 點`; });
    return {
      parts: ['幾點鐘？'],
      answer: hour,
      type: 'whatTime',
      options,
      optionLabels,
      extra: { hour },
    };
  },
  // 形狀辨認
  shapeMatch() {
    const shapes = ['circle','square','triangle','star'];
    const pick = shapes[randInt(0, shapes.length - 1)];
    const labels = { circle:'圓形', square:'方形', triangle:'三角形', star:'星形' };
    const others = shapes.filter(s => s !== pick);
    // 4 選 1 — 3 個錯誤 random
    const distractors = shuffle(others).slice(0, 3);
    const options = shuffle([pick, ...distractors]);
    // optionLabels MUST be map-by-value {circle:'圓形',...} — array breaks labels[opt] lookup after shuffle
    return { parts: [`這是什麼形狀？`], answer: pick, type:'shapeMatch', options, optionLabels: labels };
  },
  // 由小到大排 3 個數 (1-20)
  // choice / easy → MC 字串答案（同 orderAsc20）；order/keypad → array + 撳掣排
  ordering(mode) {
    const nums = Generators._seqThree();
    const sorted = [...nums].sort((x, y) => x - y);
    const useChoice = mode === 'choice' || Game.settings.mode === 'choice' || Game.settings.difficulty === 'easy';
    if (useChoice) {
      const { correct, options } = Generators._seqOptions(sorted, nums);
      return {
        parts: [`${nums.join('  ·  ')}`],
        answer: correct,
        type: 'ordering',
        options,
        displayNums: nums,
      };
    }
    return {
      parts: [`排順序：${nums.join(' , ')}`],
      answer: sorted,
      type: 'ordering',
      displayNums: nums,
    };
  },
  // V3.6 cycle44/51: 數數 1-10（中度唔好超過 10 個難數）
  count20(mode, level) {
    // avoid ⭐ (edge glyph) — keep high-visibility fruit/ball set
    const fruits = ['🍎','🍌','🍇','🍓','🍊','🍉','🌟','🔵'];
    const f = fruits[randInt(0, fruits.length - 1)];
    const p = _scopeLevelParams('count20', level);
    const maxN = (p && p.max) ? p.max : 10;
    const n = randInt(1, maxN);
    return { parts: [f.repeat(n), '= ?'], answer: n, type:'count20', answerDisplay: String(n) };
  },
  // 長短比較 — SEN 純撳實物（同色、≥1:2、無 A/B）
  compareLength(level) {
    const block = (n, ch) => ch.repeat(n);
    const p = _scopeLevelParams('compareLength', level);
    const ratio = (p && p.ratio) ? p.ratio : 2;
    const pair = _comparePair(ratio);
    const shortN = pair.shortN, longN = pair.longN;
    // 萬一 short=4 → long=8；short=3 → 6
    const leftIsLong = Math.random() < 0.5;
    const a = leftIsLong ? longN : shortN;
    const b = leftIsLong ? shortN : longN;
    const askLong = Math.random() < 0.5;
    const answer = askLong ? (a > b ? '1' : '2') : (a < b ? '1' : '2');
    const prompt = askLong ? '邊條長？' : '邊條短？';
    const tones = ['teal', 'sky', 'rose', 'slate'];
    const pairTone = tones[randInt(0, tones.length - 1)];
    const deco = Math.random() < 0.55 ? 'worm' : 'bar';
    return {
      parts: [prompt],
      answer,
      type: 'compareLength',
      options: ['1', '2'],
      optionLabels: { '1': '左', '2': '右' },
      extra: {
        a, b,
        left: a, right: b,
        ask: askLong ? 'long' : 'short',
        prompt,
        skin: 'pair',
        mode: 'tap-pair',
        pairTone,
        deco,
        hideUnits: true,
        unitsA: block(a, '■'),
        unitsB: block(b, '■'),
      },
    };
  },
  compareHeight(level) {
    const p = _scopeLevelParams('compareHeight', level);
    const ratio = (p && p.ratio) ? p.ratio : 2;
    const pair = _comparePair(ratio);
    const shortN = pair.shortN, tallN = pair.longN;
    const leftIsTall = Math.random() < 0.5;
    const a = leftIsTall ? tallN : shortN;
    const b = leftIsTall ? shortN : tallN;
    const askTall = Math.random() < 0.5;
    const answer = askTall ? (a > b ? '1' : '2') : (a < b ? '1' : '2');
    const prompt = askTall ? '邊個高？' : '邊個矮？';
    const tones = ['teal', 'sky', 'rose', 'slate'];
    const pairTone = tones[randInt(0, tones.length - 1)];
    const decoPool = ['tree', 'person', 'building'];
    const deco = decoPool[randInt(0, decoPool.length - 1)];
    return {
      parts: [prompt],
      answer,
      type: 'compareHeight',
      options: ['1', '2'],
      optionLabels: { '1': '左', '2': '右' },
      extra: {
        a, b,
        left: a, right: b,
        ask: askTall ? 'tall' : 'short',
        prompt,
        skin: 'pair',
        mode: 'tap-pair',
        pairTone,
        deco,
        hideUnits: true,
        orient: 'height',
      },
    };
  },
  // helpers: 3 distinct 1-20 + MC sequences
  _seqThree() {
    const nums = [];
    while (nums.length < 3) {
      const n = randInt(1, 20);
      if (!nums.includes(n)) nums.push(n);
    }
    return nums;
  },
  _seqOptions(correctArr, pool) {
    const fmt = arr => arr.join(' → ');
    const correct = fmt(correctArr);
    const opts = new Set([correct]);
    // wrong: reverse, rotate, random shuffle
    const rev = [...correctArr].reverse();
    opts.add(fmt(rev));
    const rot = [correctArr[1], correctArr[2], correctArr[0]];
    opts.add(fmt(rot));
    let guard = 0;
    while (opts.size < 3 && guard++ < 20) {
      const sh = shuffle([...pool]);
      opts.add(fmt(sh));
    }
    // pad with near-miss if still short
    while (opts.size < 3) {
      const fake = shuffle([...correctArr]);
      opts.add(fmt(fake));
    }
    return { correct, options: shuffle([...opts]).slice(0, 3) };
  },
  // cycle55 舊版用 3 random numbers, sorted, 但 random 數字無 arithmetic 關係
  // → 學生睇 [8, 12, ?] 揀 18 唔合理 (應該 16 = 8+4)
  // 修正: 用真 arithmetic sequence, 確保 stem 兩數有公差
  // V3.6 cycle100: 提取 _seqFill3 helper (3-tier fill, 防 padding 迴圈 infinite loop),
  //                _nextInSeq 顯式 throw on invalid dir (防 NaN 污染)
  //                _normalizeBankQuestion whatTime, _normalizeBankQuestion order)
  _pickRandomDistinct(count, rangeMin, rangeMax, exclude = [], iterCap = 40) {
    // 由 [rangeMin, rangeMax] 抽最多 count 個 unique random int,
    // 排除 exclude 內嘅值。IterCap 防 infinite loop。
    // Returns array length ≤ count; 不足 caller 自己 pad。
    const ex = exclude instanceof Set ? exclude : new Set(exclude);
    const out = [];
    let g = 0;
    while (out.length < count && g++ < iterCap) {
      const v = randInt(rangeMin, rangeMax);
      if (!ex.has(v) && !out.includes(v)) out.push(v);
    }
    return out;
  },
  _seqFill3(stem, answer, decoy) {
    // 3-tier fill, 每次都 bounded, 必 terminate:
    //   tier 1: random pool (40 tries)
    //   tier 2: sequential offset (10 tries, dedup + stem-exclusion)
    //   tier 3: brute-force scan 1..20 (一定搵到 3 個 unique)
    const opts = new Set([answer]);
    if (decoy !== null && decoy !== undefined && decoy !== answer && !stem.includes(decoy)) {
      opts.add(decoy);
    }
    let g = 0;
    while (opts.size < 3 && g++ < 40) {
      const c = randInt(1, 20);
      if (!stem.includes(c) && c !== answer) opts.add(c);
    }
    let p = 0, off = 1;
    while (opts.size < 3 && p++ < 10) {
      const v = Math.max(1, Math.min(20, answer + off));
      if (!opts.has(v) && !stem.includes(v)) opts.add(v);
      off++;
    }
    let n = 1;
    while (opts.size < 3 && n <= 20) {
      if (!stem.includes(n) && n !== answer) opts.add(n);
      n++;
    }
    return opts;
  },
  _nextInSeq(dir, level) {
    // dir 'asc' | 'desc' — explicit guard 防 NaN 污染
    if (dir !== 'asc' && dir !== 'desc') {
      throw new Error('_nextInSeq: invalid dir "' + dir + '" (expected asc | desc)');
    }
    const p = _scopeLevelParams(dir === 'asc' ? 'orderAsc20' : 'orderDesc20', level);
    const d = (p && p.step) ? p.step : randInt(1, 3);
    let seq;
    if (dir === 'asc') {
      // start, start+d, start+2d 全部 1-20 → start+2d ≤ 20 → start ≤ 18-2d
      const start = randInt(1, 18 - 2 * d);
      seq = [start, start + d, start + 2 * d];
    } else {
      // 倒序: end, end-d, end-2d 全部 1-20 → end-2d ≥ 1 → end ≥ 1+2d
      const end = randInt(1 + 2 * d, 20);
      seq = [end, end - d, end - 2 * d];
    }
    const stem = [seq[0], seq[1]];
    const answer = seq[2];
    // L3 干擾數字：跳級答案（asc → +2，desc → −2），係小朋友最常犯嘅錯
    const decoy = (p && p.decoy)
      ? Math.max(1, Math.min(20, dir === 'asc' ? answer + 2 : answer - 2))
      : null;
    const opts = Generators._seqFill3(stem, answer, decoy);
    return {
      stem,
      answer: String(answer),
      options: shuffle([...opts]).map(String).slice(0, 3),
      displayNums: stem,
    };
  },
  orderAsc20(level) {
    const { stem, answer, options, displayNums } = Generators._nextInSeq('asc', level);
    return {
      parts: [`${stem.join('  ·  ')}  ·  ？`],
      answer,
      type: 'orderAsc20',
      options,
      displayNums,
    };
  },
  orderDesc20(level) {
    const { stem, answer, options, displayNums } = Generators._nextInSeq('desc', level);
    return {
      parts: [`${stem.join('  ·  ')}  ·  ？`],
      answer,
      type: 'orderDesc20',
      options,
      displayNums,
    };
  },
  _lItemPool: [
    { emoji:'🥛', svgId:'pkg-milk-1l',      name:'鮮奶',   pkg:'1L',   drink:true },
    { emoji:'🧃', svgId:'pkg-juice-1l',     name:'果汁',   pkg:'1L',   drink:true },
    { emoji:'🧴', svgId:'pkg-detergent-1l', name:'洗潔精', pkg:'1L',   drink:false },
    { emoji:'🪣', svgId:'pkg-bleach-2l',    name:'漂白水', pkg:'2L',   drink:false },
    { emoji:'🥤', svgId:'pkg-soda-15l',     name:'汽水',   pkg:'1.5L', drink:true },
    { emoji:'🧃', svgId:'pkg-soymilk-1l',   name:'豆漿',   pkg:'1L',   drink:true },
    { emoji:'🍶', svgId:'pkg-soysauce-1l',  name:'醬油',   pkg:'1L',   drink:false },
    { emoji:'🛢️', svgId:'pkg-paint-5l',     name:'油漆',   pkg:'5L',   drink:false },
    { emoji:'🍊', svgId:'pkg-orange-2l',    name:'橙汁',   pkg:'2L',   drink:true },
  ],
  // 飲品池 (非 L) — 用嚟做 findLDrink 嘅 distractor
  _nonLDrinkPool: [
    { emoji:'🥤', name:'汽水罐', pkg:'330mL' },
    { emoji:'🧃', name:'紙包奶', pkg:'250mL' },
    { emoji:'🧃', name:'紙包果汁', pkg:'200mL' },
    { emoji:'💧', name:'水樽', pkg:'600mL' },
    { emoji:'🧋', name:'珍珠奶茶', pkg:'1杯' },
    { emoji:'🍵', name:'紙包檸檬茶', pkg:'250mL' },
  ],
  // 一般物品池 (非 L) — 用嚟做 findLItem 嘅 distractor
  _nonLItemPool: [
    { emoji:'🍎', name:'蘋果', pkg:'1個' },
    { emoji:'🥚', name:'雞蛋', pkg:'1隻' },
    { emoji:'🍞', name:'麵包', pkg:'1個' },
    { emoji:'🥕', name:'紅蘿蔔', pkg:'1條' },
    { emoji:'🍚', name:'米', pkg:'1kg' },
    { emoji:'🧂', name:'鹽', pkg:'500g' },
    { emoji:'🍬', name:'糖果', pkg:'100g' },
    { emoji:'🥩', name:'牛肉', pkg:'1kg' },
  ],
  // 從 pool 抽 3 個唔重複 (避開 avoidItem)
  _pickDistractors(pool, n, avoidItem) {
    const out = [];
    const candidates = pool.filter(x => x !== avoidItem);
    let guard = 0;
    while (out.length < n && guard++ < 40) {
      const cand = candidates[randInt(0, candidates.length - 1)];
      if (!out.includes(cand)) out.push(cand);
    }
    return out;
  },
  // 4 選 1 L item：1 個 L + 3 個 distractor
  //   L1 → 1L vs 2L（明顯）· L2 → 1L vs 1.5L · L3 → 1L vs 1.5L vs 2L（三選一）
  //   目標容量固定 1L（單一 prompt，唔使跟級數改文案）
  _lPickMC(type, level) {
    const lPool = Generators._lItemPool;
    const dPool = (type === 'findLDrink') ? Generators._nonLDrinkPool : Generators._nonLItemPool;
    const drinkOnly = (type === 'findLDrink');
    const TARGET = '1L';
    // 目標 item（容量 = 1L）。⚠️ cycle111b 修 pre-existing bug：
    //   之前「邊支飲品用 L?」可能抽到洗潔精 / 漂白水做答案（唔係飲品）。
    const targetPool = lPool.filter((it) => it.pkg === TARGET && (!drinkOnly || it.drink));
    if (!targetPool.length) return Generators._lPickMC(type, 1);   // 冇可用 target → 降級
    const lItem = targetPool[randInt(0, targetPool.length - 1)];
    // 級數指定嘅「其他 L 容量」干擾項
    const p = _scopeLevelParams(type, level);
    const altVols = (p && p.lvls) ? p.lvls : [2];
    const altItems = [];
    for (const v of altVols) {
      const cand = lPool.find((it) => it.pkg === (String(v) + 'L') && it.name !== lItem.name &&
        (!drinkOnly || it.drink));
      if (cand) altItems.push(cand);
    }
    // 剩低嘅位用非 L 干擾項填（保持總數 4）
    const needNonL = Math.max(0, 3 - altItems.length);
    const distractors = Generators._pickDistractors(dPool, needNonL);
    // 保證 distractor 唔會同 L item 重複
    const filtered = distractors.filter(d => d.name !== lItem.name);
    while (filtered.length < needNonL) filtered.push(dPool[randInt(0, dPool.length - 1)]);
    const items = shuffle([lItem, ...altItems, ...filtered.slice(0, needNonL)]);
    const ansIdx = items.findIndex(x => x === lItem);
    const LETTERS = ['1', '2', '3', '4'];
    const prompt = (type === 'findLItem') ? '邊件有 1L?'
      : (type === 'findLDrink') ? '邊支飲品有 1L?'
      : '邊個有 1L?';
    return {
      parts: [prompt],
      answer: LETTERS[ansIdx],
      type,
      options: LETTERS,
      optionLabels: items.reduce((m, it, i) => { m[LETTERS[i]] = it.pkg; return m; }, {}),
      extra: {
        // → 6 個 pkg-* SVG 精靈（畫嘅包裝插畫）從來冇 render 過 = 功能靜靜壞咗
        items: items.map(it => ({ emoji: it.emoji, svgId: it.svgId, name: it.name, pkg: it.pkg })),
        answerPkg: lItem.pkg,
        answerName: lItem.name,
        prompt,
      },
    };
  },
  learnL(level) {
    return Generators._lPickMC('learnL', level);
  },
  findLDrink(level) {
    return Generators._lPickMC('findLDrink', level);
  },
  findLItem(level) {
    return Generators._lPickMC('findLItem', level);
  },
};

function _normalizeBankQuestion(type, mode, q, reg) {
  if (!q || typeof q !== 'object') return null;
  q = Object.assign({}, q, { type: q.type || type });
  if (type === 'compare10') {
    const parts = (q.parts || []).map(p => String(p).trim()).filter(Boolean);
    // expect [a, mid?, b] — rebuild stem without spoil symbols
    let a = parts[0], b = parts[parts.length - 1];
    if (parts.length === 1 && /\d/.test(parts[0])) {
      const m = parts[0].match(/(\d+)\D+(\d+)/);
      if (m) { a = m[1]; b = m[2]; }
    }
    if (a == null || b == null || a === '' || b === '') return null;
    q.parts = [String(a), '  ?  ', String(b)];
    if (!q.answer || !['<', '=', '>'].includes(String(q.answer))) return null;
    q.answer = String(q.answer);
    q.options = ['<', '=', '>'];
    q.optionLabels = { '<': '＜ 細', '=': '＝ 等', '>': '＞ 大' };
  } else if (type === 'whatTime') {
    let hour = (q.extra && q.extra.hour != null) ? Number(q.extra.hour) : Number(q.answer);
    if (!Number.isFinite(hour)) {
      const m = String((q.parts || []).join('')).match(/(\d{1,2})/);
      if (m) hour = Number(m[1]);
    }
    if (!Number.isFinite(hour) || hour < 1 || hour > 12) return null;
    q.extra = { hour };
    q.answer = hour;
    q.parts = ['幾點鐘？'];
    if (!q.options || q.options.length < 2) {
      const distractors = Generators._pickRandomDistinct(3, 1, 12, [], 30);
      q.options = shuffle([hour, ...distractors]);
    }
    q.optionLabels = Object.assign({}, q.optionLabels || {});
    q.options.forEach(h => {
      if (q.optionLabels[h] === undefined) q.optionLabels[h] = `${h} 點`;
    });
  } else if (type === 'ordering') {
    const useChoice = mode === 'choice' || Game.settings.mode === 'choice' || Game.settings.difficulty === 'easy';
    let nums = Array.isArray(q.displayNums) ? q.displayNums.slice() : null;
    let sorted = Array.isArray(q.answer) ? q.answer.slice() : null;
    if (!nums && sorted) nums = sorted.slice(); // weak fallback
    if (!nums || nums.length !== 3) return null;
    if (!sorted) sorted = [...nums].sort((x, y) => x - y);
    q.displayNums = nums;
    if (useChoice) {
      if (typeof q.answer === 'string' && Array.isArray(q.options) && q.options.length >= 2) {
        // already MC shape
      } else {
        const { correct, options } = Generators._seqOptions(sorted, nums);
        q.answer = correct;
        q.options = options;
      }
      q.parts = [`${nums.join('  ·  ')}`];
    } else {
      q.answer = sorted;
      q.parts = q.parts && q.parts.length ? q.parts : [`排順序：${nums.join(' , ')}`];
      delete q.options;
    }
  } else if (type === 'compareGroup') {
    if (!q.optionLabels) q.optionLabels = { 1: '左邊多', 2: '右邊多', 3: '一樣多' };
    if (!q.options || q.options.length < 2) q.options = [1, 2, 3];
  } else if (type === 'shapeMatch') {
    if (!q.optionLabels) {
      q.optionLabels = { circle: '圓形', square: '方形', triangle: '三角形', star: '星形' };
    }
  } else if (type === 'compareLength') {
    // pair tap-mode (SEN) + legacy skin/eq bank
    let ans = String(q.answer);
    if (ans === 'A') ans = '1';
    if (ans === 'B') ans = '2';
    const ex = q.extra || {};
    let a = Number(ex.a != null ? ex.a : ex.left);
    let b = Number(ex.b != null ? ex.b : ex.right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const askShort = ex.ask === 'short' || /短/.test(String(ex.prompt || ''));
    const askLong = !askShort && (ex.ask === 'long' || /長/.test(String(ex.prompt || '')) || true);
    // ensure visible 1:2 if too close
    if (Math.abs(a - b) < Math.max(a, b) * 0.5) {
      const shortN = Math.min(a, b, 4);
      const longN = Math.min(8, Math.max(shortN * 2, shortN + 3));
      if (a >= b) { a = longN; b = shortN; } else { a = shortN; b = longN; }
    }
    if (ans !== '1' && ans !== '2') {
      // recompute from lengths
      ans = askShort ? (a < b ? '1' : '2') : (a > b ? '1' : '2');
    }
    const prompt = ex.prompt || (askShort ? '邊條短？' : '邊條長？');
    const tones = ['teal', 'sky', 'rose', 'slate'];
    const pairTone = (ex.pairTone && tones.includes(ex.pairTone)) ? ex.pairTone : tones[(a + b) % tones.length];
    q.answer = ans;
    q.options = ['1', '2'];
    q.optionLabels = { '1': '左', '2': '右' };
    q.extra = Object.assign({}, ex, {
      a, b, left: a, right: b,
      skin: 'pair',
      mode: 'tap-pair',
      pairTone,
      deco: ex.deco === 'bar' ? 'bar' : 'worm',
      hideUnits: true,
      ask: askShort ? 'short' : 'long',
      prompt,
      unitsA: '■'.repeat(Math.max(1, a)),
      unitsB: '■'.repeat(Math.max(1, b)),
    });
    q.parts = [prompt];
  } else if (type === 'compareHeight') {
    let ans = String(q.answer);
    if (ans === 'A') ans = '1';
    if (ans === 'B') ans = '2';
    const ex = q.extra || {};
    let a = Number(ex.a != null ? ex.a : ex.left);
    let b = Number(ex.b != null ? ex.b : ex.right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const askShort = ex.ask === 'short' || /矮/.test(String(ex.prompt || ''));
    if (Math.abs(a - b) < Math.max(a, b) * 0.5) {
      const shortN = Math.min(a, b, 4);
      const tallN = Math.min(8, Math.max(shortN * 2, shortN + 3));
      if (a >= b) { a = tallN; b = shortN; } else { a = shortN; b = tallN; }
    }
    if (ans !== '1' && ans !== '2') {
      ans = askShort ? (a < b ? '1' : '2') : (a > b ? '1' : '2');
    }
    const prompt = ex.prompt || (askShort ? '邊個矮？' : '邊個高？');
    const tones = ['teal', 'sky', 'rose', 'slate'];
    const pairTone = (ex.pairTone && tones.includes(ex.pairTone)) ? ex.pairTone : tones[(a + b) % tones.length];
    const deco = ['tree', 'person', 'building'].includes(ex.deco) ? ex.deco : 'tree';
    q.answer = ans;
    q.options = ['1', '2'];
    q.optionLabels = { '1': '左', '2': '右' };
    q.extra = Object.assign({}, ex, {
      a, b, left: a, right: b,
      skin: 'pair',
      mode: 'tap-pair',
      pairTone,
      deco,
      hideUnits: true,
      orient: 'height',
      ask: askShort ? 'short' : 'tall',
      prompt,
    });
    q.parts = [prompt];
  } else if (type === 'orderAsc20' || type === 'orderDesc20') {
    // next-number MC
    let stem = Array.isArray(q.displayNums) ? q.displayNums.map(Number) : null;
    if ((!stem || stem.length < 2) && Array.isArray(q.parts)) {
      const nums = String(q.parts[0] || '').match(/\d+/g);
      if (nums && nums.length >= 2) stem = nums.slice(0, 2).map(Number);
    }
    if (!stem || stem.length < 2) return null;
    stem = stem.slice(0, 2);
    const ans = String(q.answer);
    if (!/^\d+$/.test(ans)) return null;
    q.displayNums = stem;
    q.answer = ans;
    q.parts = [`${stem.join('  ·  ')}  ·  ？`];
    if (!q.options || q.options.length < 2) {
      const distractors = Generators._pickRandomDistinct(2, 1, 20, [...stem, Number(ans)], 30);
      q.options = shuffle([Number(ans), ...distractors]).map(String);
    } else {
      q.options = q.options.map(String);
    }
  } else if (type === 'learnL' || type === 'findLDrink' || type === 'findLItem') {
    const ans = String(q.answer || '');
    if (!/^[1-4]$/.test(ans)) return null;
    if (!Array.isArray(q.options) || q.options.length !== 4) return null;
    if (!q.optionLabels || typeof q.optionLabels !== 'object') return null;
    const ex = q.extra || {};
    if (!Array.isArray(ex.items) || ex.items.length !== 4) {
      // 冇 items → reject，generator 會重生
      return null;
    }
    q.parts = [ex.prompt || q.parts?.[0] || '邊個有 1L?'];
  } else if (type === 'count10' || type === 'count20' || type === 'count1to3') {
    // bank often packs "🍎🍎🍎= ?" in one part → split + rebuild visual stem
    const n = Number(q.answer);
    if (!Number.isFinite(n) || n < 1 || n > 10) return null;
    const fruit = _firstEmojiIn((q.parts || []).join(''));
    q.parts = (type === 'count1to3')
      ? [fruit.repeat(n)]
      : [fruit.repeat(n), '= ?'];
    q.answer = n;
  } else if (type === 'groupAdd' || type === 'double' || type === 'compareGroup') {
    if (!(q.parts || []).length) return null;
    const blob = (q.parts || []).join('');
    const hasEmoji = [...blob].some(ch => _isEmojiChar(ch));
    if (!hasEmoji) return null;
  }
  return q;
}

const QuestionGen = (() => {
  /**
   * v3.1: registry-driven dispatcher
   * 回傳 q object 含 parts array (UI render 決定用 parts[i] 還是 text)
   * 兼容: 舊 code 用 q.text / q.options / q.answer / q.type 全部 keep working
   */
  function make(type, mode = 'choice', level = 1) {
    const reg = TYPE_REGISTRY[type];
    if (!reg) return Generators.numeric('add10', mode);
    // V3.5-AUDIT10: Question Bank rotation 
    // non-weak 30% bank / 70% random。先由 shouldUseBank() 決定概率，再 pick。
    // 若 pick 出嚟嘅 bank question 唔合用 (e.g. numeric layout choice mode 但冇 options)，
    // 自動 fallback 去 generator dispatch。
    let q = null;
    if (typeof QuestionBank !== 'undefined' && QuestionBank.shouldUseBank(type)) {
      const bankQ = QuestionBank.pickFromBank(type);
      // Bank question 適用條件：
      //  - 非 numeric layout (parts-emoji/sym-button/clock/order/shape) — bank 自己 pre-build options
      //  - numeric + keypad mode — keypad 唔需要 options
      //  - numeric + choice mode — 同樣可用，下面嘅 choice options fallback 會生 options
      const bankUsable = bankQ && (
        reg.layout === 'parts-emoji' || reg.layout === 'sym-button' ||
        reg.layout === 'clock' || reg.layout === 'order' || reg.layout === 'shape' ||
        reg.layout === 'bars' || reg.layout === 'height' || reg.layout === 'seq-choice' ||
        reg.layout === 'pic-grid' || reg.layout === 'numeric'
      );
      if (bankUsable) q = bankQ;
    }
    if (q) q = _normalizeBankQuestion(type, mode, q, reg);
    // 按 layout dispatch (如果 bank 唔適用)
    if (!q) {
      // layout → generator (keep strings for regression locks)
      if (reg.layout === 'numeric') q = Generators.numeric(type, mode);
      else if (reg.layout === 'parts-emoji') q = Generators[type](mode, level);
      else if (reg.layout === 'sym-button') q = Generators.compare10();
      else if (reg.layout === 'clock') q = Generators.whatTime();
      else if (reg.layout === 'shape') q = Generators.shapeMatch();
      else if (reg.layout === 'order') q = Generators.ordering(mode);
      else if (reg.layout === 'bars') q = Generators.compareLength(level);
      else if (reg.layout === 'height') q = Generators.compareHeight(level);
      else if (reg.layout === 'seq-choice') q = Generators[type](mode, level);
      else if (reg.layout === 'pic-grid') q = Generators[type](level);
      else q = Generators.numeric(type, mode);
    }
    // legacy compat: 舊 code 讀 q.text
    q.text = q.text || (q.parts ? q.parts.join('') : '');
    // choice 模式: 生錯誤選項 (numeric + parts-emoji layout)
    // easy mode: 2-3 個選項（結果 1-9 範圍內）；normal: 4 個
    const isEasy = Game.settings.difficulty === 'easy';
    const targetOpts = isEasy ? randInt(2, 3) : 4;
    if (mode === 'choice' && !q.options &&
        (reg.layout === 'numeric' || reg.layout === 'parts-emoji') &&
        typeof q.answer === 'number') {
      const opts = new Set([q.answer]);
      const maxWrong = isEasy ? Math.max(q.answer + 2, 9) : Math.max(q.answer * 2, 20);
      let tries = 0;
      while (opts.size < targetOpts && tries < 50) {
        const delta = randInt(1, Math.max(1, Math.ceil(Math.abs(q.answer) * (isEasy ? 0.3 : 0.2))));
        const sign = Math.random() < 0.5 ? -1 : 1;
        let fake = q.answer + sign * delta;
        if (fake < 1) fake = randInt(1, Math.min(q.answer - 1, maxWrong));
        if (fake === q.answer) fake = q.answer + 1;
        if (fake >= 1 && fake <= maxWrong) opts.add(fake);
        tries++;
      }
      let pad = 0;
      while (opts.size < targetOpts) {
        const extra = q.answer + (++pad);
        if (extra >= 1 && extra <= maxWrong) opts.add(extra);
      }
      q.options = shuffle([...opts]);
      // easy mode: 2 個按鈕行顯示
      if (isEasy) q._easyOpts = true;
    }
    return q;
  }

  return { make };
})();

/* ============== [4.6] V3.5-AUDIT10 Question Bank ==============
 * 12 類型 × 10 題 = 120 條 fixtures (rotation: weak 70/30, normal 30/70)
 * Storage: mg2.bank.v1.
 */
const QuestionBank = (() => {
  // === Seed fixtures — 12 types × 10 條 = 120 題 ===
  // P1 智障友好：answer range 細，避免 carry/borrow trap，例題典型。
  const seed = {
    // --- numeric layouts ---
    add10: [
      { parts:['2 + 3 = ?'], answer:5 },
      { parts:['4 + 5 = ?'], answer:9 },
      { parts:['1 + 6 = ?'], answer:7 },
      { parts:['3 + 3 = ?'], answer:6 },
      { parts:['5 + 4 = ?'], answer:9 },
      { parts:['2 + 7 = ?'], answer:9 },
      { parts:['6 + 3 = ?'], answer:9 },
      { parts:['1 + 8 = ?'], answer:9 },
      { parts:['4 + 4 = ?'], answer:8 },
      { parts:['3 + 5 = ?'], answer:8 },
    ],
    sub10: [
      { parts:['5 - 2 = ?'], answer:3 },
      { parts:['8 - 3 = ?'], answer:5 },
      { parts:['9 - 4 = ?'], answer:5 },
      { parts:['6 - 2 = ?'], answer:4 },
      { parts:['7 - 5 = ?'], answer:2 },
      { parts:['10 - 6 = ?'], answer:4 },
      { parts:['4 - 1 = ?'], answer:3 },
      { parts:['8 - 4 = ?'], answer:4 },
      { parts:['9 - 3 = ?'], answer:6 },
      { parts:['7 - 2 = ?'], answer:5 },
    ],
    add20: [
      { parts:['10 + 5 = ?'], answer:15 },
      { parts:['12 + 3 = ?'], answer:15 },
      { parts:['11 + 6 = ?'], answer:17 },
      { parts:['14 + 5 = ?'], answer:19 },
      { parts:['13 + 4 = ?'], answer:17 },
      { parts:['15 + 3 = ?'], answer:18 },
      { parts:['12 + 7 = ?'], answer:19 },
      { parts:['16 + 2 = ?'], answer:18 },
      { parts:['11 + 8 = ?'], answer:19 },
      { parts:['13 + 5 = ?'], answer:18 },
    ],
    sub20: [
      { parts:['15 - 7 = ?'], answer:8 },
      { parts:['18 - 9 = ?'], answer:9 },
      { parts:['14 - 5 = ?'], answer:9 },
      { parts:['16 - 8 = ?'], answer:8 },
      { parts:['13 - 6 = ?'], answer:7 },
      { parts:['17 - 9 = ?'], answer:8 },
      { parts:['12 - 4 = ?'], answer:8 },
      { parts:['19 - 11 = ?'], answer:8 },
      { parts:['15 - 6 = ?'], answer:9 },
      { parts:['14 - 7 = ?'], answer:7 },
    ],
    add2d: [
      { parts:['23 + 14 = ?'], answer:37 },
      { parts:['31 + 25 = ?'], answer:56 },
      { parts:['42 + 33 = ?'], answer:75 },
      { parts:['54 + 21 = ?'], answer:75 },
      { parts:['65 + 12 = ?'], answer:77 },
      { parts:['26 + 41 = ?'], answer:67 },
      { parts:['35 + 52 = ?'], answer:87 },
      { parts:['71 + 13 = ?'], answer:84 },
      { parts:['44 + 32 = ?'], answer:76 },
      { parts:['56 + 21 = ?'], answer:77 },
    ],
    sub2d: [
      { parts:['37 - 14 = ?'], answer:23 },
      { parts:['58 - 25 = ?'], answer:33 },
      { parts:['76 - 42 = ?'], answer:34 },
      { parts:['85 - 31 = ?'], answer:54 },
      { parts:['64 - 21 = ?'], answer:43 },
      { parts:['97 - 52 = ?'], answer:45 },
      { parts:['88 - 33 = ?'], answer:55 },
      { parts:['79 - 46 = ?'], answer:33 },
      { parts:['56 - 24 = ?'], answer:32 },
      { parts:['95 - 41 = ?'], answer:54 },
    ],
    // --- parts-emoji layouts ---
    count10: [
      { parts:['🍎🍎🍎= ?'], answer:3 },
      { parts:['🍌🍌🍌🍌🍌= ?'], answer:5 },
      { parts:['🍇🍇= ?'], answer:2 },
      { parts:['🍓🍓🍓🍓🍓🍓= ?'], answer:6 },
      { parts:['🍊= ?'], answer:1 },
      { parts:['🍉🍉🍉🍉= ?'], answer:4 },
      { parts:['🍎🍎🍎🍎🍎🍎🍎= ?'], answer:7 },
      { parts:['🍌🍌🍌🍌🍌🍌🍌🍌= ?'], answer:8 },
      { parts:['🍇🍇🍇🍇🍇🍇🍇🍇🍇= ?'], answer:9 },
      { parts:['🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓= ?'], answer:10 },
    ],
    count1to3: [
      { parts:['🍎'], answer:1 },
      { parts:['🍎🍎'], answer:2 },
      { parts:['🍎🍎🍎'], answer:3 },
    ],
    groupAdd: [
      // V3.6-SEN-FIX: same fruit on both sides (same thing + same thing)
      { parts:['🍎', ' + ', '🍎', ' = ?'], answer:2 },
      { parts:['🍇🍇', ' + ', '🍇', ' = ?'], answer:3 },
      { parts:['🍊', ' + ', '🍊🍊', ' = ?'], answer:3 },
      { parts:['🍎🍎', ' + ', '🍎', ' = ?'], answer:3 },
      { parts:['🍓', ' + ', '🍓', ' = ?'], answer:2 },
      { parts:['🐶🐶', ' + ', '🐶', ' = ?'], answer:3 },
    ],
    compareGroup: [
      { parts:['🍎🍎', ' ? ', '🍌'], answer:1 },
      { parts:['🍇', ' ? ', '🍓🍓'], answer:2 },
      { parts:['🌟🌟', ' ? ', '🌟🌟'], answer:3 },
      { parts:['🍊🍊🍊', ' ? ', '🍌'], answer:1 },
      { parts:['🐶', ' ? ', '🐱🐱'], answer:2 },
    ],
    double: [
      { parts:['🍎 + 🍎 = ?'], answer:2 },
      { parts:['🍌🍌 + 🍌🍌 = ?'], answer:4 },
      { parts:['🍇🍇🍇 + 🍇🍇🍇 = ?'], answer:6 },
      { parts:['🍓🍓 + 🍓🍓 = ?'], answer:4 },
      { parts:['🌟 + 🌟 = ?'], answer:2 },
      { parts:['🍎🍎🍎 + 🍎🍎🍎 = ?'], answer:6 },
      { parts:['🍌🍌🍌🍌 + 🍌🍌🍌🍌 = ?'], answer:8 },
      { parts:['🍇🍇 + 🍇🍇 = ?'], answer:4 },
      { parts:['🌟🌟🌟 + 🌟🌟🌟 = ?'], answer:6 },
      { parts:['🍓 + 🍓 = ?'], answer:2 },
    ],
    // --- sym-button layout (compare10) — stem 無劇透符號 ---
    compare10: [
      { parts:['3', '  ?  ', '7'], answer:'<' },
      { parts:['8', '  ?  ', '5'], answer:'>' },
      { parts:['2', '  ?  ', '9'], answer:'<' },
      { parts:['6', '  ?  ', '1'], answer:'>' },
      { parts:['4', '  ?  ', '8'], answer:'<' },
      { parts:['7', '  ?  ', '3'], answer:'>' },
      { parts:['5', '  ?  ', '9'], answer:'<' },
      { parts:['6', '  ?  ', '4'], answer:'>' },
      { parts:['1', '  ?  ', '5'], answer:'<' },
      { parts:['9', '  ?  ', '9'], answer:'=' },
    ],
    // --- clock layout — 題幹唔洩 hour；extra.hour 係真相 ---
    whatTime: [
      { parts:['幾點鐘？'], answer:3,  extra:{ hour:3 } },
      { parts:['幾點鐘？'], answer:6,  extra:{ hour:6 } },
      { parts:['幾點鐘？'], answer:9,  extra:{ hour:9 } },
      { parts:['幾點鐘？'], answer:12, extra:{ hour:12 } },
      { parts:['幾點鐘？'], answer:1,  extra:{ hour:1 } },
      { parts:['幾點鐘？'], answer:4,  extra:{ hour:4 } },
      { parts:['幾點鐘？'], answer:7,  extra:{ hour:7 } },
      { parts:['幾點鐘？'], answer:10, extra:{ hour:10 } },
      { parts:['幾點鐘？'], answer:2,  extra:{ hour:2 } },
      { parts:['幾點鐘？'], answer:8,  extra:{ hour:8 } },
    ],
    // --- shape layout (shapeMatch) ---
    // parts text 同 generator 一樣；options 在 QuestionGen.make 內 dispatch 後
    // 由 bank question 自己提供 (已經 pre-built)。
    shapeMatch: [
      { parts:['這是什麼形狀？'], answer:'circle',    options:['circle','square','triangle','star'] },
      { parts:['這是什麼形狀？'], answer:'square',    options:['square','circle','triangle','star'] },
      { parts:['這是什麼形狀？'], answer:'triangle',  options:['triangle','square','circle','star'] },
      { parts:['這是什麼形狀？'], answer:'star',      options:['star','triangle','square','circle'] },
      { parts:['這是什麼形狀？'], answer:'circle',    options:['circle','triangle','square','star'] },
      { parts:['這是什麼形狀？'], answer:'square',    options:['square','star','circle','triangle'] },
      { parts:['這是什麼形狀？'], answer:'triangle',  options:['triangle','circle','star','square'] },
      { parts:['這是什麼形狀？'], answer:'star',      options:['star','square','triangle','circle'] },
      { parts:['這是什麼形狀？'], answer:'circle',    options:['circle','square','star','triangle'] },
      { parts:['這是什麼形狀？'], answer:'square',    options:['square','circle','star','triangle'] },
    ],
    // --- order layout ---
    ordering: [
      { parts:['排順序：5 , 2 , 8'], answer:[2,5,8],   displayNums:[5,2,8] },
      { parts:['排順序：7 , 1 , 4'], answer:[1,4,7],   displayNums:[7,1,4] },
      { parts:['排順序：3 , 9 , 6'], answer:[3,6,9],   displayNums:[3,9,6] },
      { parts:['排順序：8 , 2 , 5'], answer:[2,5,8],   displayNums:[8,2,5] },
      { parts:['排順序：6 , 3 , 1'], answer:[1,3,6],   displayNums:[6,3,1] },
      { parts:['排順序：9 , 4 , 7'], answer:[4,7,9],   displayNums:[9,4,7] },
      { parts:['排順序：2 , 6 , 3'], answer:[2,3,6],   displayNums:[2,6,3] },
      { parts:['排順序：8 , 5 , 1'], answer:[1,5,8],   displayNums:[8,5,1] },
      { parts:['排順序：4 , 9 , 2'], answer:[2,4,9],   displayNums:[4,9,2] },
      { parts:['排順序：7 , 3 , 5'], answer:[3,5,7],   displayNums:[7,3,5] },
    ],
    count20: [
      { parts:['🍎🍎🍎= ?'], answer:3 },
      { parts:['🍌🍌🍌🍌🍌= ?'], answer:5 },
      { parts:['🍇🍇= ?'], answer:2 },
      { parts:['🍓🍓🍓🍓= ?'], answer:4 },
      { parts:['🍊= ?'], answer:1 },
      { parts:['🍉🍉🍉🍉🍉🍉= ?'], answer:6 },
      { parts:['🌟🌟🌟🌟🌟🌟🌟= ?'], answer:7 },
      { parts:['🔵🔵🔵🔵🔵🔵🔵🔵= ?'], answer:8 },
    ],
    compareLength: [
      { parts:['邊條長？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'teal',deco:'worm',a:6,b:3,left:6,right:3,ask:'long',prompt:'邊條長？',hideUnits:true} },
      { parts:['邊條短？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'sky',deco:'worm',a:3,b:7,left:3,right:7,ask:'short',prompt:'邊條短？',hideUnits:true} },
      { parts:['邊條長？'], answer:'2', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'rose',deco:'bar',a:2,b:6,left:2,right:6,ask:'long',prompt:'邊條長？',hideUnits:true} },
      { parts:['邊條短？'], answer:'2', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'slate',deco:'worm',a:8,b:4,left:8,right:4,ask:'short',prompt:'邊條短？',hideUnits:true} },
      { parts:['邊條長？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'teal',deco:'bar',a:8,b:4,left:8,right:4,ask:'long',prompt:'邊條長？',hideUnits:true} },
      { parts:['邊條短？'], answer:'2', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'sky',deco:'worm',a:7,b:3,left:7,right:3,ask:'short',prompt:'邊條短？',hideUnits:true} },
      { parts:['邊條長？'], answer:'2', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'rose',deco:'worm',a:3,b:8,left:3,right:8,ask:'long',prompt:'邊條長？',hideUnits:true} },
      { parts:['邊條短？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'slate',deco:'bar',a:2,b:6,left:2,right:6,ask:'short',prompt:'邊條短？',hideUnits:true} },
    ],
    compareHeight: [
      { parts:['邊個高？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'teal',deco:'tree',a:6,b:3,left:6,right:3,ask:'tall',prompt:'邊個高？',hideUnits:true,orient:'height'} },
      { parts:['邊個矮？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'sky',deco:'person',a:3,b:7,left:3,right:7,ask:'short',prompt:'邊個矮？',hideUnits:true,orient:'height'} },
      { parts:['邊個高？'], answer:'2', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'rose',deco:'building',a:2,b:6,left:2,right:6,ask:'tall',prompt:'邊個高？',hideUnits:true,orient:'height'} },
      { parts:['邊個矮？'], answer:'2', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'slate',deco:'tree',a:8,b:4,left:8,right:4,ask:'short',prompt:'邊個矮？',hideUnits:true,orient:'height'} },
      { parts:['邊個高？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'teal',deco:'person',a:8,b:4,left:8,right:4,ask:'tall',prompt:'邊個高？',hideUnits:true,orient:'height'} },
      { parts:['邊個矮？'], answer:'1', options:['1','2'], optionLabels:{'1':'左','2':'右'}, extra:{skin:'pair',mode:'tap-pair',pairTone:'sky',deco:'building',a:2,b:6,left:2,right:6,ask:'short',prompt:'邊個矮？',hideUnits:true,orient:'height'} },
    ],
    orderAsc20: [
      { parts:['3  ·  7  ·  ？'], answer:'12', options:['12','5','9'], displayNums:[3,7] },
      { parts:['1  ·  4  ·  ？'], answer:'9', options:['9','2','6'], displayNums:[1,4] },
      { parts:['2  ·  8  ·  ？'], answer:'15', options:['15','5','10'], displayNums:[2,8] },
      { parts:['5  ·  10  ·  ？'], answer:'16', options:['16','7','12'], displayNums:[5,10] },
      { parts:['4  ·  6  ·  ？'], answer:'11', options:['11','3','8'], displayNums:[4,6] },
      { parts:['6  ·  9  ·  ？'], answer:'14', options:['14','2','10'], displayNums:[6,9] },
    ],
    orderDesc20: [
      { parts:['15  ·  10  ·  ？'], answer:'4', options:['4','12','8'], displayNums:[15,10] },
      { parts:['18  ·  12  ·  ？'], answer:'5', options:['5','9','14'], displayNums:[18,12] },
      { parts:['20  ·  11  ·  ？'], answer:'3', options:['3','7','16'], displayNums:[20,11] },
      { parts:['14  ·  9  ·  ？'], answer:'2', options:['2','6','11'], displayNums:[14,9] },
      { parts:['16  ·  8  ·  ？'], answer:'1', options:['1','5','12'], displayNums:[16,8] },
      { parts:['19  ·  13  ·  ？'], answer:'6', options:['6','10','15'], displayNums:[19,13] },
    ],
  };

  // === Public API ===
  // 從 localStorage 讀 bank；首次 run 自動 seed。
  function load() {
    const saved = STORAGE.load(STORAGE.BANK_KEY);
    if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
      return saved;
    }
    // 首次 run / corrupted → seed 寫入
    save(seed);
    return seed;
  }

  function save(bank) {
    STORAGE.save(STORAGE.BANK_KEY, bank);
  }

  function reset() {
    STORAGE.clear(STORAGE.BANK_KEY);
    return load();   // 自動 re-seed
  }

  // 從 bank 抽一條 type 嘅 question。冇 bank → null。
  //   ⚠️ 級數來源只有一個：_scopeLevelOf(type)（同生成器路徑共用）。
  //   冇同級數嘅 bank 題 → 返 null，交俾生成器（級數契約唔會有 30% 漏洞）。
  function pickFromBank(typeId) {
    const bank = load();
    const arr = bank[typeId];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const lv = _scopeLevelOf(typeId);
    const pool = arr.filter((q) => _bankMatchesLevel(typeId, q, lv));
    if (!pool.length) return null;
    const q = pool[Math.floor(Math.random() * pool.length)];
    // 加 legacy compat field (text)
    return {
      parts: q.parts,
      answer: q.answer,
      type: typeId,
      text: q.parts.join(''),
      options: q.options || undefined,
      displayNums: q.displayNums || undefined,
      source: 'bank',  // V3.5-AUDIT10: trace 用，標記呢題係 bank 出嘅
    };
  }

  // Weak detection — 用 Profile.data.statsByType。
  // 樣本 ≥ 5 答題且 accuracy < 70% 視為 weak。
  function isWeakType(typeId) {
    try {
      const s = Profile.data.statsByType[typeId];
      if (!s || typeof s !== 'object') return false;
      const total = (s.c || 0) + (s.w || 0);
      if (total < 5) return false;
      const acc = s.c / total;
      return acc < 0.7;
    } catch { return false; }
  }

  // Rotation trigger — 應該由 bank 出定 random 出？
  //  - weak: 70% bank (重複練 scaffolding)
  //  - non-weak: 30% bank (輕微 expose)
  function shouldUseBank(typeId) {
    const bank = load();
    if (!Array.isArray(bank[typeId]) || bank[typeId].length === 0) return false;
    const weak = isWeakType(typeId);
    const prob = weak ? 0.7 : 0.3;
    return Math.random() < prob;
  }

  // 統計：總共幾多條題目（供 teacher modal 顯示）
  function stats() {
    const bank = load();
    let total = 0;
    const byType = {};
    Object.keys(bank).forEach(k => {
      const n = Array.isArray(bank[k]) ? bank[k].length : 0;
      byType[k] = n;
      total += n;
    });
    return { total, byType };
  }

  /* ============== v3.5 cycle 13: add / remove / list ==============
   * Validators 對齊 TYPE_REGISTRY 6 種 layout, dedupe (text+answer), per-type cap 20.
   */

  // 每 type 嘅上限 — user editable 但要預設一個 ceiling 防失控
  const PER_TYPE_CAP = 20;

    // Validators — pure functions。return {o
  const Validators = {
    numeric(q) {
      if (!q || typeof q !== 'object') return { ok: false, error: '題目物件無效' };
      if (!Array.isArray(q.parts) || q.parts.length === 0) return { ok: false, error: 'parts 必須是非空陣列' };
      if (!q.parts.every(p => typeof p === 'string')) return { ok: false, error: 'parts 每項必須是字串' };
      const a = Number(q.answer);
      if (!Number.isFinite(a)) return { ok: false, error: 'numeric answer 必須是有限數字' };
      return { ok: true, normalized: { parts: q.parts.slice(), answer: a } };
    },
    partsEmoji(q) {
      const base = Validators.numeric(q);
      if (!base.ok) return base;
      const a = base.normalized.answer;
      if (a < 1 || a > 10 || !Number.isInteger(a)) return { ok: false, error: 'parts-emoji answer 必須是 1-10 整數' };
      return base;
    },
    symButton(q) {
      if (!q || typeof q !== 'object') return { ok: false, error: '題目物件無效' };
      if (!Array.isArray(q.parts) || q.parts.length === 0) return { ok: false, error: 'parts 必須是非空陣列' };
      if (!['<', '>', '='].includes(q.answer)) return { ok: false, error: "sym-button answer 必須是 '<' / '>' / '='" };
      return { ok: true, normalized: { parts: q.parts.slice(), answer: q.answer } };
    },
    clock(q) {
      const base = Validators.numeric(q);
      if (!base.ok) return base;
      const a = base.normalized.answer;
      if (a < 1 || a > 12 || !Number.isInteger(a)) return { ok: false, error: 'clock answer 必須是 1-12 整數' };
      return base;
    },
    shape(q) {
      if (!q || typeof q !== 'object') return { ok: false, error: '題目物件無效' };
      if (!Array.isArray(q.parts) || q.parts.length === 0) return { ok: false, error: 'parts 必須是非空陣列' };
      const validShapes = ['circle', 'square', 'triangle', 'star'];
      if (!validShapes.includes(q.answer)) return { ok: false, error: `shape answer 必須是 ${validShapes.join('/')}` };
      if (!Array.isArray(q.options) || q.options.length < 2 || !q.options.includes(q.answer)) {
        return { ok: false, error: 'shape options 必須是非空陣列且包含 answer' };
      }
      return { ok: true, normalized: { parts: q.parts.slice(), answer: q.answer, options: q.options.slice() } };
    },
    order(q) {
      if (!q || typeof q !== 'object') return { ok: false, error: '題目物件無效' };
      if (!Array.isArray(q.parts) || q.parts.length === 0) return { ok: false, error: 'parts 必須是非空陣列' };
      if (!Array.isArray(q.answer) || q.answer.length !== 3) return { ok: false, error: 'order answer 必須是 length-3 陣列' };
      if (!q.answer.every(n => Number.isFinite(n))) return { ok: false, error: 'order answer 每項必須是數字' };
      const sorted = [...q.answer].sort((x, y) => x - y);
      const okSorted = q.answer.every((n, i) => n === sorted[i]);
      if (!okSorted) return { ok: false, error: 'order answer 必須是 ascending' };
      const distinct = new Set(q.answer);
      if (distinct.size !== 3) return { ok: false, error: 'order answer 3 個必須相異' };
      if (!Array.isArray(q.displayNums) || q.displayNums.length !== 3) {
        return { ok: false, error: 'order displayNums 必須是 length-3 陣列' };
      }
      return { ok: true, normalized: { parts: q.parts.slice(), answer: q.answer.slice(), displayNums: q.displayNums.slice() } };
    },
  };

  function validatorFor(typeId) {
    const reg = TYPE_REGISTRY[typeId];
    if (!reg) return null;
    switch (reg.layout) {
      case 'numeric':     return Validators.numeric;
      case 'parts-emoji': return Validators.partsEmoji;
      case 'sym-button':  return Validators.symButton;
      case 'clock':       return Validators.clock;
      case 'shape':       return Validators.shape;
      case 'order':       return Validators.order;
      default:            return null;
    }
  }

  // dedupe 用嘅 fingerprint
  function fingerprint(q) {
    const text = Array.isArray(q.parts) ? q.parts.join('') : '';
    const ans = JSON.stringify(q.answer);
    return `${text}::${ans}`;
  }

  function existsInBank(bank, typeId, q) {
    const arr = bank[typeId];
    if (!Array.isArray(arr)) return false;
    const fp = fingerprint(q);
    return arr.some(e => fingerprint(e) === fp);
  }

  // 加一條題。typeId 必須存在於 TYPE_REGISTRY；question 通過 validator；
  // 重複 (text+answer) 拒絕；超 PER_TYPE_CAP 拒絕。
  // 回傳 {ok: bool, error?, entry?, deduped?, capped?}
  function add(typeId, question) {
    const reg = TYPE_REGISTRY[typeId];
    if (!reg) return { ok: false, error: `未知題型 ${typeId}` };
    const validator = validatorFor(typeId);
    if (!validator) return { ok: false, error: `${typeId} 沒有對應 validator` };
    const v = validator(question);
    if (!v.ok) return { ok: false, error: v.error };
    const bank = load();
    if (existsInBank(bank, typeId, v.normalized)) {
      return { ok: false, deduped: true, error: '題目與題庫內既有題目重複 (text + answer 一樣)' };
    }
    const arr = Array.isArray(bank[typeId]) ? bank[typeId] : [];
    if (arr.length >= PER_TYPE_CAP) {
      return { ok: false, capped: true, error: `${reg.label} 題庫已達上限 ${PER_TYPE_CAP} 條` };
    }
    const entry = { ...v.normalized, source: 'user' };
    arr.push(entry);
    bank[typeId] = arr;
    save(bank);
    return { ok: true, entry };
  }

  // 移除 type[typeId][idx]。idx 越界返 error。
  function remove(typeId, idx) {
    const bank = load();
    const arr = bank[typeId];
    if (!Array.isArray(arr)) return { ok: false, error: `${typeId} 題庫不存在` };
    if (idx < 0 || idx >= arr.length || !Number.isInteger(idx)) {
      return { ok: false, error: `索引 ${idx} 超出範圍 (0-${arr.length - 1})` };
    }
    const removed = arr.splice(idx, 1)[0];
    bank[typeId] = arr;
    save(bank);
    return { ok: true, removed };
  }

  // 列出 type[typeId] 嘅 array copy（避免外部 mutate bank state）
  function list(typeId) {
    const bank = load();
    const arr = bank[typeId];
    if (!Array.isArray(arr)) return [];
    return arr.map((q, i) => ({ idx: i, ...q }));
  }

  return { load, save, reset, pickFromBank, isWeakType, shouldUseBank, stats, add, remove, list, PER_TYPE_CAP, Validators };
})();

/* ============== [4.5] v3.1 Type Picker Renderer ============== */
function renderTypePicker() {
  const picker = $('type-picker');
  if (!picker) return;
  // V3.5-AUDIT11: 自動推薦 — 為推薦嘅 type 加 ✨ ch
  const recommended = (Game.settings.adaptiveEnabled && typeof Adaptive !== 'undefined')
    ? Adaptive.topRecommendations('knight', 3)   // 預設用 knight 嘅 stats 推薦；可擴充 per-team
    : [];
  const recSet = new Set(recommended);
  picker.innerHTML = Object.values(TYPE_REGISTRY).map(reg => {
    const selected = Game.settings.types.includes(reg.id);
    const isRecommended = recSet.has(reg.id);
    const isMastered = (typeof Adaptive !== 'undefined') ? Adaptive.isMastered(reg.id) : false;
    const icon = reg.icon ? `<svg class="pixel icon-md mr-1"><use href="#${reg.icon}"/></svg>` : `<span class="text-xl mr-1">${reg.emoji}</span>`;
    const diffIcon = reg.difficulty === 1 ? '🌱' : reg.difficulty === 2 ? '🌿' : '🌳';
    const recBadge = isRecommended ? '<span class="ml-1 text-xs text-amber-300" aria-hidden="true" title="自動推薦">✨</span>' : '';
    // V3.5-AUDIT14: mastered 標記 — 金色 ⭐ + 標題
    const masteredBadge = isMastered ? '<span class="ml-1 text-xs text-amber-400 font-bold" aria-hidden="true" title="已精通 — 系統保護唔再自動降級">⭐</span>' : '';
    return `<button class="opt-type btn btn-ghost text-left flex items-center ${selected ? 'opt-selected' : ''} ${isRecommended ? 'opt-recommended' : ''} ${isMastered ? 'opt-mastered' : ''}" data-type="${reg.id}" title="${reg.desc}${isRecommended ? '（自動推薦）' : ''}${isMastered ? '（已精通）' : ''}" aria-pressed="${selected}" aria-label="${reg.label}，難度 ${reg.difficulty === 1 ? '一' : reg.difficulty === 2 ? '二' : '三'}，${selected ? '已選' : '未選'}${isRecommended ? '，自動推薦' : ''}${isMastered ? '，已精通' : ''}">
      ${icon}
      <span class="flex-1 text-sm">${reg.label}</span>
      <span class="text-xs opacity-70">${diffIcon}</span>
      ${recBadge}
      ${masteredBadge}
    </button>`;
  }).join('');
}

function updateTypeCount() {
  const el = $('type-count');
  if (!el) return;
  const n = Game.settings.types.length;
  const total = Object.keys(TYPE_REGISTRY).length;
  el.textContent = `已選 ${n} / ${total}`;
}

/* ============== V3.5-cycle16: 自動推薦 chips row ==============
 * Tap 一個 chip → toggle settings.types。rec-selected = 已選 (綠)。
 * Cold start → 5 easiest types；after 1+ sessions → cross-session weighted。
 */
function renderRecommendChips() {
  const container = $('recommend-chips');
  if (!container) return;
  if (!Game.settings.recommendationEnabled) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  const recs = (typeof Adaptive !== 'undefined')
    ? Adaptive.recommendWithHistory(Game.state.currentTeam || 'knight', 5)
    : [];
  if (recs.length === 0) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  const selectedSet = new Set(Game.settings.types);
  container.hidden = false;
  container.innerHTML = `<span class="rec-label">✨ 建議：</span>` + recs.map(r => {
    const reg = TYPE_REGISTRY[r.typeId];
    if (!reg) return '';
    const isSel = selectedSet.has(r.typeId);
    return `<button type="button" class="rec-chip ${isSel ? 'rec-selected' : ''}"
              data-rec-type="${r.typeId}"
              role="checkbox"
              aria-checked="${isSel ? 'true' : 'false'}"
              aria-label="${reg.label} 自動推薦 — ${r.reason}。${isSel ? '已選，點擊取消' : '點擊加入題型'}"
              title="${r.reason}">${reg.emoji} ${reg.label}</button>`;
  }).join('');
    // tap chip → toggle setti
  container.querySelectorAll('.rec-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const typeId = btn.dataset.recType;
      if (!typeId || !TYPE_REGISTRY[typeId]) return;
      const idx = Game.settings.types.indexOf(typeId);
      if (idx >= 0) {
        if (Game.settings.types.length > 1) Game.settings.types.splice(idx, 1);
      } else {
        Game.settings.types.push(typeId);
      }
      renderTypePicker();
      updateTypeCount();
      renderRecommendChips();
      Audio.tick();
    });
  });
}

/**
 * v3.2: mode helper text 動態 render
 *  - 全部 type 都支援 choice
 *  - keypad 模式只對支援 keypad 嘅 type 有效；對 order-only type (ordering) 自動 fallback
 *  - 對 keypad-incompatible 嘅 type 出現「自動用 choice」提示
 */
function updateModeHelper() {
  const el = $('mode-helper');
  if (!el) return;
  const mode = Game.settings.mode;
  const selectedTypes = Game.settings.types.map(id => TYPE_REGISTRY[id]).filter(Boolean);
  const compare10Sel = selectedTypes.some(r => r.id === 'compare10');
  const whatTimeSel  = selectedTypes.some(r => r.id === 'whatTime');
  const shapeSel     = selectedTypes.some(r => r.id === 'shapeMatch');
  const orderSel     = selectedTypes.some(r => r.id === 'ordering');

  // v3.2-b: 詳細 tooltip 內文 (hover/click expand)
  const detailLines = [];
  let icon = '💡';
  let mainLine = '';

  if (mode === 'choice') {
    icon = '🎮';
    mainLine = '<b>四選一</b>：每題有 4 個選項，揀啱嗰個。';
    if (compare10Sel) detailLines.push('⚖️ 大小比較會自動用「細 / 等 / 大」三按鈕（唔係 4 選 1）');
    if (whatTimeSel) detailLines.push('🕐 時鐘題 4 個小時選項');
    if (shapeSel) detailLines.push('🔺 形狀題 4 個形狀名');
    if (orderSel) detailLines.push('📊 由小到大題用 3 click 累積，唔係 4 選 1');
  } else {
    // keypad mode
    const keypadOnly = selectedTypes.filter(r => !r.mode.includes('keypad'));
    if (keypadOnly.length === 0) {
      icon = '💡';
      mainLine = '<b>數字鍵盤</b>：直接打數字 + ✓ 提交。';
      if (compare10Sel) detailLines.push('⚖️ 大小比較會變 <strong>6 鍵 keypad</strong>（紫粉 &lt; = &gt; + ⌫ + 0 + ✓）');
      if (whatTimeSel) detailLines.push('🕐 時鐘題打 <strong>1-12 點</strong>');
      if (shapeSel) detailLines.push('🔺 形狀題打 <strong>1=圓 / 2=方 / 3=三 / 4=星</strong>');
      if (orderSel) detailLines.push('📊 由小到大題 keypad 顯示 <strong>三個原數按鍵</strong>，按正確順序即 auto-submit');
    } else {
      icon = '⚠️';
      const names = keypadOnly.map(r => `${r.emoji} ${r.label}`).join(' / ');
      mainLine = `<b>${names}</b> 唔支援 keypad，會自動用「四選一」。其他題用 keypad。`;
      detailLines.push('✅ 其他題型會用 keypad 模式（紫粉 highlight）');
      detailLines.push('❌ 唔 keypad 嘅題 fallback 落 choice（4 個 option 按鈕）');
    }
  }

  // v3.2-b: <details> expand pattern — tooltip 默認收起、click 展開
  const detailHtml = detailLines.length
    ? `<details class="mt-1 cursor-pointer"><summary class="text-amber-300/90 text-[0.65rem] hover:text-amber-200">▸ 點開看詳情</summary>` +
      `<div class="mt-1 pl-2 space-y-0.5 text-[0.65rem] text-on-night-muted">${detailLines.map(l => `<div>• ${l}</div>`).join('')}</div>` +
      `</details>`
    : '';

  el.innerHTML = `<span class="text-base">${icon}</span> ${mainLine}${detailHtml}`;
}

/* ============== [5] Game State ============== */
const Game = {
  settings: {
    win: 'hp',        // 'hp' | 'time'
    minutes: 5,
    mode: 'choice',   // 'choice' | 'keypad'
    types: ['add10'],
    team: 'coop',     // 'coop' | 'versus' — Boss 打怪方式
    dualTeam: 'versus', // 課堂雙隊對戰/合作（同 team 分開）
    initialBossHp: 200,
    instantHint: true,    // V3.4-U2: 答錯即時提示 (SEN-friendly, default ON)
    ttsEnabled: true,     // V3.4-F2: TTS 開關
    ttsKaraoke: true,     // V3.5-P0: 朗讀題目時同步高亮文字 (per-token highlight synced to TTS boundary)
    adaptiveEnabled: true,// V3.5-AUDIT11: 自動推薦 next type chips (default ON; 學生睇到「✨ 建議」標記)
    recommendationEnabled: true, // 獨立 chips row (跟 adaptiveEnabled 分開)
    difficulty: 'normal',       // 'normal' (4 選一) | 'easy' (2-3 選一，簡單練習)
    playLayout: 'solo',         // 'solo' | 'dual' (左右雙隊 touch board)
    playerId: null,             // identity card id (solo / left)
    playerLabel: '同學',        // display name e.g. 🐱 小貓
    playerIdRight: null,        // dual right team
    playerLabelRight: '同學',
    scopes: ['count20', 'compareLength', 'compareHeight', 'orderAsc20', 'orderDesc20', 'learnL', 'findLDrink', 'findLItem'],
    arenaSkin: 'retro',             // 'classic' | 'retro' (ruler tug / bridge)
    soloMode: 'bridge',             // solo mini-game 'boat' | 'bridge' | 'ruler'
    menuTrack: 'class',             // 'class' 課堂 | 'boss' 戰役
    goalStages: 3,
    // Ken 2026-10-25 決定：可以畀答案，但分層遞進，最後一層先講答案。老師可調低。
    hintMaxLevel: 4,
  },

  state: {
    running: false,
    paused: false,
    ended: false,
    startedAt: 0,       // P1-A: Date.now() 開始
    endedAt: 0,         // P1-A: Date.now() 結束

    bossHp: 200,
    bossMaxHp: 200,
    bossRageThreshold: 0.5,   // 狂暴
    bossFrozenThreshold: 0.25, // 冰凍弱化
    bossFrostTicks: 0,

    timeLimitSec: 0,
    timeLeftSec: 0,

    currentTeam: 'knight', // 合作時：每答完切換；巔峰：兩隊並進
    lastAnswerAt: { knight: 0, mage: 0 },

    castle: { left: 100, right: 100, max: 100 },

    teams: {
      knight: { correct: 0, wrong: 0, total: 0, energy: 0, ultCharge: 0 },
      mage:   { correct: 0, wrong: 0, total: 0, energy: 0, ultCharge: 0 },
    },

    // 當前題
    current: { knight: null, mage: null },

    // 答錯題回顧（重練區）
    review: [],

    // 錯題觸發 castle 攻擊計時
    nextCastleAttack: 0,

    // 大絕 pending 答題
    pendingUlt: null, // { team } — 需要再答一題才放
    pendingUltQ: null,
    // V3.5-AUDIT7-F07: per-team cache of la
    // (visual-type ladder fallback Option C — chain 2: cached last-good)
    lastResumableType: { knight: null, mage: null },

    // ===== Stage / 進度格 / 提示階梯 / 錯題原地重播 =====
    // Stage 進度係 per-team（雙隊各自答各自嘅題，唔應該共用同一條進度條）
    stage: {
      knight: { index: 0, units: 0, cleared: 0 },
      mage:   { index: 0, units: 0, cleared: 0 },
    },
    stagesTotal: 3,         // 一局有幾多 Stage
    hintLevel: { knight: 0, mage: 0 },  // 當前題目已用提示層數（0 = 未用）
    replayQ: null,          // 原地重播：答錯嗰條原題（唔抽新題）
    replayTries: 0,         // 呢條題答錯咗幾多次（第 2 次錯 → 罰半格 + 換新題）
    //   （曾另開第二個輪次欄位，令 badge / review / Adaptive 睇嘅 currentTeam
    // 永遠停喺 knight → 同可見卡片唔一致。收埋。）
    hintStreakByType: {},   // 冇用提示連對幾多題（用嚟計 M2 里程碑）
    sessionStreak: 0,       // 同一局連對幾多題（用嚟計 M4 里程碑）
    retryMode: false,       // 局完「錯題重練」關卡
    retryList: [],          // 要重練嘅題（保留完整 payload）
    retryIndex: 0,
    retryStreak: 0,         // 連續答啱次數（>= 2 先算鞏固）
  },

  /* ---- internal helpers ---- */
  pickActiveTeam() {
    // 合作：輪流；巔峰：兩隊各自答題互不阻塞
    if (this.settings.team === 'versus') return null; // 兩隊獨立題
    // coop: knight 跟 mage 輪流
    return this.state.currentTeam;
  },

  nextTeamInCoop() {
    // V3.6 cycle71: solo 唔輪換到 mage（板已藏）
    if (Game.settings.playLayout !== 'dual') {
      this.state.currentTeam = 'knight';
      return;
    }
    this.state.currentTeam = (this.state.currentTeam === 'knight') ? 'mage' : 'knight';
    // V3.6-SEN: in easy mode, show only the active team card
    if (Game.settings.difficulty === 'easy') {
      ['knight', 'mage'].forEach(tm => {
        const card = document.getElementById(`${tm}-card`);
        if (card) card.classList.toggle('hidden', tm !== this.state.currentTeam);
      });
    }
  },

  // P1-R3: defined here (not a separate reassignment) — avoids closure ambiguity
  handleAnswer(team, value, btn) {
    if (!Game.state.running || Game.state.paused || Game.state.ended) return;
    const q = Game.state.current[team];
    if (!q) return;

    // V3.6-SEN: ultra-simple mode — feedback + stats only, skip boss/castle/energy
    if (Game.settings.difficulty === 'easy') {
      // ⚠️ 呢個檢查一定要行喺 _easyTeamDone 之前 —— 重練時該隊已被標記為 done，
      //    如果先做 done 檢查，重練答題會被擋死。
      if (Game.state.retryMode) {
        const retryCorrect = _compareAnswer(q.answer, value, q.type).correct;
        Game.handleRetryAnswer(team, value, btn, q, retryCorrect);
        return;
      }
      if (Game.state._easyEnding) return;
      if (Game.state._easyTeamDone && Game.state._easyTeamDone[team]) return;
      const correct = _compareAnswer(q.answer, value, q.type).correct;

      const isReplay = !!Game.state.replayQ;
      const usedHint = Game.state.hintLevel[team] || 0;

      // length/height = tap real bar only；錯唔罰、唔跳題、只重播題
      if (_isTapPairCompare(q)) {
        const root = document.getElementById(`sen-q-emoji-${team}`);
        if (!correct) {
          _lenPairMark(root, value, 'miss');
          setTimeout(() => {
            if (root) root.querySelectorAll('.len-pair-hit, .ht-pair-hit').forEach(el => el.classList.remove('is-miss'));
          }, 450);
          const prompt = (q.extra && q.extra.prompt) || (q.type === 'compareHeight' ? '邊個高？' : '邊條長？');
          if (Game.settings.ttsEnabled !== false && TTS && TTS.speak) TTS.speak(prompt, null, {});
          return; // 不計錯、不跳下一題
        }
        _lenPairMark(root, value, 'correct');
        _lenPairMark(root, value, 'lock');
        const say = _tapPairCorrectSay(q);
        if (Game.settings.ttsEnabled !== false && TTS && TTS.speak) TTS.speak(say, null, {});
        if (Audio.correct) Audio.correct();
        Game.state.teams[team].total++;
        Game.state.teams[team].correct++;
        _recordAnswerStats(team, q, true);
        _applyStageUnits(team, _cellUnits(true, usedHint, isReplay));
        Game.state.replayQ = null;
        Game.state.replayTries = 0;
        Game.state.hintLevel[team] = 0;
        UI.refreshSENScreen();
        UI.refreshSENArena(team, true);
        _easyGameComplete(team);
        _scheduleNextQuestion(team, 900);
        return;
      }

      const units = _cellUnits(correct, usedHint, isReplay);
      //   ⚠️ 喺 _senShowFeedback 之前 —— 咁樣被撳嗰個掣嘅狀態 / badge / pop
      //   同 Audio.correct()/wrong() 同一幀起點（project §12 規則）。
      UI._senMarkOption(btn, correct);
      if (correct) UI._senCelebrate(btn);
      else UI._senRevealCorrect(team, q);
      if (correct) {
        UI._senShowFeedback(true, null, team);
        Game.state.replayQ = null;
        Game.state.replayTries = 0;
        Game.state.hintLevel[team] = 0;
      } else {
        //   第一次錯：原地重播（雙隊會傳俾另一隊救）
        //   第二次錯：扣 ½ 格 + 換新題（否則會無限卡喺同一條）
        Game.state.replayTries = (Game.state.replayTries || 0) + 1;
        if (Game.state.replayTries >= 2) {
          Game.state.replayQ = null;
          Game.state.replayTries = 0;
          _applyStageUnits(team, -2);   // 扣 ½ 格
        } else {
          // 原地重播同一條（唔抽新題 — spaced repetition 靠重播同一 stimulus）
          Game.state.replayQ = q;
        }
        Game.state.hintLevel[team] = 0;
        // 提示只出層 1（重述），唔會直接講答案；學生可以撳「提示」逐層深入
        if (Game.settings.instantHint !== false) {
          UI._senShowFeedback(false, _easyHintText(q, 1), team);
        } else {
          UI._senShowFeedback(false, null, team);
        }
        // 記錄錯題（保留完整 payload，局完重練用同一條）
        Game.state.review.push({ ...q, retryCount: 0, retryStreak: 0 });
      }

      Game.state.teams[team].total++;
      if (correct) {
        Game.state.teams[team].correct++;
        _haptic(true);  // V3.6 cycle84 C3
        Audio.correct && Audio.correct();
        if (_isDualPlay()) {
          if (_isCoopTeam()) Audio.boatRow && Audio.boatRow();
          else Audio.tugPull && Audio.tugPull();
        }
        _applyStageUnits(team, units);
      } else {
        Game.state.teams[team].wrong++;
        _haptic(false);  // V3.6 cycle84 C3
        Audio.wrong && Audio.wrong();
      }
      _recordAnswerStats(team, q, correct);
      _checkMilestones(q.type, correct, usedHint, isReplay);
      // scope 內 3 級難度適應（4 對升級 / 3 錯降級；永遠唔換 scope）
      _updateScopeLevel(q.type, correct);
      UI.refreshSENScreen();
      UI.refreshSENArena(team, correct);
      // ⚠️ 之前「一完成就提早 return」會令傳手中斷 —— 雙隊模式下
      //    一隊完成後另一隊就永遠冇題答，局完唔到（easy dual 根本入唔到結算畫面）。
      _easyGameComplete(team);
      _scheduleNextQuestion(team, correct ? 650 : 1000);
      return;
    }

    const { correct } = _compareAnswer(q.answer, value, q.type);
    if (_handlePendingUlt(team, q, value, correct, btn)) return;
    Game.state.teams[team].total++;
    const prevRagePct = s_prevRagePct();
    if (correct) _applyCorrectEffects(team, q, btn, prevRagePct);
    else _applyWrongEffects(team, q, btn);
    _recordAnswerStats(team, q, correct);
    UI.updateTeam(team);
    _scheduleNextQuestion(team);
  },

  handleRetryAnswer(team, value, btn, q, correct) {
    const st = Game.state;
    const item = st.retryList[st.retryIndex];
    if (!item) { _easyRetryFinish(); return; }
    if (correct) {
      st.retryStreak = (st.retryStreak || 0) + 1;
      item.retryStreak = st.retryStreak;
      item.retryCount = (item.retryCount || 0) + 1;
      if (typeof UI !== 'undefined' && UI._senShowFeedback) UI._senShowFeedback(true, null, team);
      if (Audio.correct) Audio.correct();
      if (st.retryStreak >= 2) {
        // 呢條已經鞏固 → 跳去下一條
        st.retryIndex += 1;
        st.retryStreak = 0;
        if (st.retryIndex >= st.retryList.length) { _easyRetryFinish(); return; }
      }
    } else {
      st.retryStreak = 0;
      item.retryStreak = 0;
      if (typeof UI !== 'undefined' && UI._senShowFeedback) UI._senShowFeedback(false, _easyHintText(q, 1), team);
      if (Audio.wrong) Audio.wrong();
    }
    st.teams[team].total++;
    if (correct) st.teams[team].correct++; else st.teams[team].wrong++;
    if (typeof UI !== 'undefined' && UI.refreshSENScreen) UI.refreshSENScreen();
    setTimeout(() => { _nextRetryQuestion(team); }, correct ? 700 : 1000);
  },
};

/* ============== [6] UI Updates ============== */

/* ---- Question layout renderers (extracted from showQuestion) ----
 * Each function receives (q, team, area) and appends DOM nodes to area.
 * Pure rendering — no state mutation, no Audio/TTS calls.
 * New layouts: add a function here + one line in the QuestionRenderer dispatch map.
 */
/** SEN prompt/TTS copy map (single source) */
const SEN_COPY = {
  compareLength: { text: '邊條長？', ttsFrom: 'extra.prompt' },
  compareHeight: { text: '邊個高？', ttsFrom: 'extra.prompt' },
  whatTime:      { text: '幾點鐘？', tts: '幾點鐘？' },
  shapeMatch:    { text: '這是什麼形狀？', tts: '這是什麼形狀？' },
  groupAdd:      { text: '加埋有幾多？', tts: null },
  compareGroup:  { text: '邊邊多？', tts: null },
  count10:       { text: '有幾多？', tts: null },
  count1to3:     { text: '有幾多？', tts: null },
  count20:       { text: '有幾多？', tts: null },
  orderAsc20:    { text: '邊個跟住？', tts: '邊個跟住' },
  ordering:      { text: '由細到大？', tts: '由細到大' },
  learnL:        { text: '邊個有 1L？', ttsFrom: 'extra.prompt' },
  findLDrink:    { text: '邊支飲品有 1L？', ttsFrom: 'extra.prompt' },
  findLItem:     { text: '邊件有 1L？', ttsFrom: 'extra.prompt' },
  orderDesc20:   { text: '邊個跟住？', tts: '邊個跟住' },
  compare10:     { text: '邊個大？', tts: '邊個大？' },
};

function _senCopyText(q) {
  if (!q) return '';
  const c = SEN_COPY[q.type];
  if (!c) {
    if (typeof console !== 'undefined' && q.type && !_senCopyText._warned?.has(q.type)) {
      (_senCopyText._warned ||= new Set()).add(q.type);
      console.warn(`[SEN_COPY] missing entry for type="${q.type}" — fallback to q.extra.prompt / q.parts`);
    }
    return '';
  }
  if (c.ttsFrom === 'extra.prompt') return (q.extra && q.extra.prompt) || c.text;
  return c.text;
}

function _senCopyTTS(q) {
  if (!q) return '';
  const c = SEN_COPY[q.type];
  if (!c) return (q.parts ? q.parts.join('') : q.text) || '';
  if (c.tts) return c.tts;
  if (c.ttsFrom === 'extra.prompt') return (q.extra && q.extra.prompt) || c.text;
  return c.text || ((q.parts ? q.parts.join('') : q.text) || '');
}

const QuestionRenderer = {
  // --- sym-button: compare10 three symbol buttons ---
  'sym-button'(q, team, area) {
    if (Game.settings.mode === 'keypad') return false; // fall through to keypad
    const row = document.createElement('div');
    row.className = 'q-sym-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', '大小比較');
    const symLabelMap = { '<': '細過', '=': '等於', '>': '大過' };
    ['<', '=', '>'].forEach(sym => {
      const b = document.createElement('button');
      b.className = 'q-sym-btn';
      b.textContent = sym === '<' ? '＜ (細)' : sym === '>' ? '＞ (大)' : '＝ (等)';
      b.setAttribute('aria-label', symLabelMap[sym]);
      b.dataset.sym = sym;
      b.onclick = () => Game.handleAnswer(team, sym, b);
      row.appendChild(b);
    });
    area.appendChild(row);
    return true;
  },

  // --- order: three numbers to arrange smallest→largest ---
  // (choice MC with string answer is routed to seq-choice in showQuestion)
  'order'(q, team, area) {
    if (q.options && typeof q.answer === 'string') {
      return QuestionRenderer['seq-choice'](q, team, area);
    }
    if (Game.settings.mode === 'keypad') {
      const hint = document.createElement('div');
      hint.className = 'text-center text-amber-200 text-sm mt-2 font-bold';
      hint.textContent = '👆 keypad：按正確順序 (細→大) 撳 3 個鍵';
      area.appendChild(hint);
    }
    const row = document.createElement('div');
    row.className = 'q-order-row';
    const order = [];
    (q.displayNums || []).forEach(n => {
      const b = document.createElement('button');
      b.className = 'q-order-btn';
      b.textContent = n;
      b.dataset.n = n;
      b.onclick = () => {
        if (b.classList.contains('used')) return;
        b.classList.add('used');
        order.push(n);
        if (order.length === 3) Game.handleAnswer(team, order, row);
      };
      row.appendChild(b);
    });
    area.appendChild(row);
    return true;
  },

  // --- clock: visual clock + answer options ---
  'clock'(q, team, area) {
    const clock = document.createElement('div');
    clock.className = 'q-clock';
    const hour = q.extra && q.extra.hour != null ? q.extra.hour : q.answer;
    const deg = Number(hour) * 30;
    clock.innerHTML = `
      <svg viewBox="0 0 16 16" role="img" aria-label="時鐘" style="width:144px;height:144px;">
        <use href="#px-clock-base"/>
        <line x1="8" y1="8" x2="8" y2="3" stroke="#dc2626" stroke-width="1.2" transform="rotate(${deg} 8 8)"/>
        <line x1="8" y1="8" x2="11" y2="8" stroke="#1e293b" stroke-width="0.6"/>
      </svg>`;
    area.appendChild(clock);
    if (Game.settings.mode === 'keypad') {
      const hint = document.createElement('div');
      hint.className = 'text-center text-amber-200 text-sm mt-2 font-bold';
      hint.textContent = '👆 keypad 答 1-12 點';
      area.appendChild(hint);
      return false; // fall through to keypad renderer
    }
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2 mt-3';
    let hourOpts = Array.isArray(q.options) && q.options.length >= 2
      ? q.options.slice()
      : (() => {
          const o = [hour];
          while (o.length < 4) {
            const fake = randInt(1, 12);
            if (!o.includes(fake)) o.push(fake);
          }
          return shuffle(o);
        })();
    const labels = q.optionLabels || null;
    hourOpts.forEach(h => {
      const b = document.createElement('button');
      b.className = 'option-btn';
      const lab = (labels && labels[h] !== undefined) ? labels[h] : (h + ' 點');
      _paintOptionLabel(b, lab, { asButton: true });
      b.onclick = () => Game.handleAnswer(team, h, b);
      grid.appendChild(b);
    });
    area.appendChild(grid);
    return true;
  },

  // --- shape: shape SVG + label buttons ---
  'shape'(q, team, area) {
    const shapeWrap = document.createElement('div');
    shapeWrap.className = 'q-shape';
    shapeWrap.innerHTML = `<svg viewBox="0 0 16 16"><use href="#px-shape-${q.answer}"/></svg>`;
    area.appendChild(shapeWrap);
    const labelMap = { circle:'圓形', square:'方形', triangle:'三角形', star:'星形' };
    if (Game.settings.mode === 'keypad') {
      const hint = document.createElement('div');
      hint.className = 'text-center text-amber-200 text-sm mt-2 font-bold';
      hint.textContent = '👆 keypad 答 1=圓 / 2=方 / 3=三 / 4=星';
      area.appendChild(hint);
      const shapeToNum = {};
      q.options.forEach((s, i) => { shapeToNum[i + 1] = s; });
      q._shapeToNum = shapeToNum;
      q._labelMap = labelMap;
      q._isShapeKeypad = true;
      return false; // fall through to keypad renderer
    }
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2';
    q.options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'option-btn';
      _paintOptionLabel(b, labelMap[opt] || opt, { asButton: true });
      b.onclick = () => Game.handleAnswer(team, opt, b);
      grid.appendChild(b);
    });
    area.appendChild(grid);
    return true;
  },

  // --- numeric / parts-emoji: choice grid or numeric keypad ---
  'numeric'(q, team, area) {
    if (Game.settings.mode === 'keypad') return false; // fall through to keypad
    return _appendChoiceGrid(area, q, team);
  },

  // parts-emoji → same choice grid (emoji lives in question text)
  'parts-emoji'(q, team, area) {
    return QuestionRenderer['numeric'](q, team, area);
  },

  // bars layout — tap-pair preferred
  'bars'(q, team, area) {
    const visual = document.createElement('div');
    visual.className = 'sen-q-visual';
    visual.innerHTML = _lengthBarsHTML(q.extra || {}).html;
    area.appendChild(visual);
    _wireLengthVisualClicks(visual, q, team);
    if (!(q.extra && (q.extra.mode === 'tap-pair' || q.extra.skin === 'pair'))) {
      _appendChoiceGrid(area, q, team, 'grid grid-cols-2 gap-2');
    }
    return true;
  },

  'height'(q, team, area) {
    const visual = document.createElement('div');
    visual.className = 'sen-q-visual';
    visual.innerHTML = _heightPairHTML(q.extra || {}).html;
    area.appendChild(visual);
    _wireLengthVisualClicks(visual, q, team);
    return true;
  },

  'pic-grid'(q, team, area) {
    const items = (q.extra && Array.isArray(q.extra.items)) ? q.extra.items : [];
    if (items.length < 2) return false;
    const opts = q.options || ['1','2','3','4'];
    const LETTERS = ['A', 'B', 'C', 'D'];
    const grid = document.createElement('div');
    grid.className = 'pic-grid-row';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', '答案選項');
    items.slice(0, 4).forEach((it, idx) => {
      const opt = String(opts[idx] || (idx + 1));
      const b = document.createElement('button');
      b.className = 'pic-card-btn';
      b.setAttribute('type', 'button');
      const letter = LETTERS[idx] || String(idx + 1);
      const isL = /L$/.test(String(it.pkg || ''));
      const pkgClass = isL ? 'pic-card-pkg is-l' : 'pic-card-pkg';
      const visual = it.svgId
        ? `<svg class="pic-card-svg" viewBox="0 0 64 64" aria-hidden="true"><use href="#${it.svgId}"/></svg>`
        : `<span class="pic-card-emoji" aria-hidden="true">${it.emoji || '📦'}</span>`;
      b.innerHTML = `
        <span class="sen-opt-letter" aria-hidden="true">${letter}</span>
        ${visual}
        <span class="pic-card-name">${it.name || ''}</span>
        <span class="${pkgClass}">${it.pkg || ''}</span>
      `;
      b.setAttribute('aria-label', `${letter}. ${it.name || ''} ${it.pkg || ''}`);
      b.dataset.letter = letter;
      b.dataset.opt = opt;
      b.onclick = () => Game.handleAnswer(team, opt, b);
      grid.appendChild(b);
    });
    area.appendChild(grid);
    return true;
  },

  'seq-choice'(q, team, area) {
    if (q.displayNums && q.displayNums.length) {
      const row = document.createElement('div');
      row.className = 'text-center text-3xl font-extrabold tracking-widest mb-2';
      row.textContent = q.displayNums.join('  ·  ');
      row.setAttribute('aria-label', '數字 ' + q.displayNums.join(' '));
      area.appendChild(row);
    }
    return QuestionRenderer['numeric'](q, team, area);
  },

  // --- keypad: generic numeric or sym keypad ---
  'keypad'(q, team, area, extra) {
    const isSymAnswer = extra && extra.isSym;
    const wrap = document.createElement('div');
    wrap.className = 'space-y-2';
    const display = document.createElement('div');
    display.className = 'bg-black/50 rounded-xl text-center text-3xl font-extrabold py-3 tracking-widest';
    display.textContent = '_ _';
    display.setAttribute('aria-live', 'polite');
    display.setAttribute('aria-atomic', 'true');
    display.setAttribute('aria-label', '已輸入答案');
    wrap.appendChild(display);
    const kb = document.createElement('div');
    kb.className = 'grid grid-cols-3 gap-2';
    kb.setAttribute('role', 'group');
    kb.setAttribute('aria-label', '數字鍵盤');
    const keys = isSymAnswer
      ? ['<', '=', '>', 'clear', '0', 'ok']
      : ['1','2','3','4','5','6','7','8','9','clear','0','ok'];
    keys.forEach(k => {
      const b = document.createElement('button');
      b.textContent = k === 'clear' ? '⌫' : k === 'ok' ? '✓' : k;
      if (k === 'clear') b.setAttribute('aria-label', '清除');
      else if (k === 'ok') b.setAttribute('aria-label', '確定');
      else if (isSymAnswer && k === '<') b.setAttribute('aria-label', '細過');
      else if (isSymAnswer && k === '=') b.setAttribute('aria-label', '等於');
      else if (isSymAnswer && k === '>') b.setAttribute('aria-label', '大過');
      else b.setAttribute('aria-label', `數字 ${k}`);
      const isSymKey = isSymAnswer && (k === '<' || k === '=' || k === '>');
      b.className = 'key-btn' + (k === 'clear' ? ' clear' : k === 'ok' ? ' fn' : '') + (isSymKey ? ' sym' : '');
      b.onclick = () => {
        let cur = display.dataset.v || '';
        if (k === 'clear') { cur = ''; }
        else if (k === 'ok') {
          if (q._isShapeKeypad) {
            const num = parseInt(cur || '0', 10);
            const shape = q._shapeToNum[num];
            if (shape) Game.handleAnswer(team, shape, b);
            return;
          }
          const isNumericAnswer = typeof q.answer === 'number';
          const val = isNumericAnswer ? parseInt(cur || '0', 10) : cur;
          Game.handleAnswer(team, val);
          return;
        } else {
          if (isSymAnswer && (k === '<' || k === '=' || k === '>')) {
            Game.handleAnswer(team, k, b);
            return;
          }
          cur += k; if (cur.length > 4) cur = cur.slice(-4);
        }
        display.dataset.v = cur;
        display.textContent = cur ? cur : '_ _';
      };
      kb.appendChild(b);
    });
    wrap.appendChild(kb);
    area.appendChild(wrap);
    return true;
  },
};

const UI = {
  refreshAll() {
    this.updateBoss();
    this.updateTeam('knight');
    this.updateTeam('mage');
    this.updateCastle();
    this.updateBadges();
  },

  updateBoss() {
    const s = Game.state;
    const pct = Math.max(0, (s.bossHp / s.bossMaxHp) * 100);
    $('boss-hp-fill').style.width = pct + '%';
    $('boss-hp-text').textContent = Math.max(0, Math.round(s.bossHp));
    $('boss-hp-max').textContent = s.bossMaxHp;
    // V3.4-AUDIT5: HP bar aria-valuenow + v
    const track = $('boss-hp-track');
    if (track) {
      const cur = Math.max(0, Math.round(s.bossHp));
      track.setAttribute('aria-valuenow', String(cur));
      track.setAttribute('aria-valuemax', String(s.bossMaxHp));
      track.setAttribute('aria-valuetext', `Boss 生命值 ${cur} / ${s.bossMaxHp}，${pct < 25 ? '低血量危險' : pct < 50 ? '受傷' : '健康'}`);
    }
    // 狀態
    const status = $('boss-status');
    const icon = $('boss-icon');
    // icon 係 div container — pixel SVG 喺內
    icon.classList.remove('enraged', 'frozen', 'troll-idle', 'troll-enraged');
    if (s.bossFrostTicks > 0) {
      status.textContent = '冰凍';
      status.className = 'text-xs px-2 py-0.5 rounded-full bg-cyan-500/30 text-cyan-200';
      icon.classList.add('boss-svg', 'frozen');
    } else if (pct <= s.bossMaxHp * s.bossRageThreshold && pct > 0) {
      status.textContent = '狂暴';
      status.className = 'text-xs px-2 py-0.5 rounded-full bg-red-500/30 text-red-200';
      icon.classList.add('boss-svg', 'enraged', 'troll-enraged');
    } else if (pct <= 0) {
      status.textContent = '已擊敗';
      status.className = 'text-xs px-2 py-0.5 rounded-full bg-yellow-500/30 text-amber-200';
      icon.classList.add('boss-svg');
    } else {
      status.textContent = '正常';
      status.className = 'text-xs px-2 py-0.5 rounded-full bg-green-500/30 text-green-200';
      icon.classList.add('boss-svg', 'troll-idle');
    }
    // 低血量樣式
    const fill = $('boss-hp-fill');
    fill.classList.toggle('low', pct < 25);
    // threshold info
    $('boss-threshold-info').textContent = s.bossFrostTicks > 0 ? `冰凍剩 ${s.bossFrostTicks} 回合` : '';
  },

  updateTeam(team) {
    const t = Game.state.teams[team];
    $(`${team}-correct`).textContent = t.correct;
    $(`${team}-wrong`).textContent = t.wrong;
    $(`${team}-total`).textContent = t.total;
    const ePct = (t.energy / 100) * 100;
    $(`${team}-energy-fill`).style.width = ePct + '%';
    $(`${team}-energy-text`).textContent = t.energy;
    // 大絕按鈕：能量滿 + charge>=1 才亮（charge 由獨立題補充）
    const ultBtn = $(`${team}-ultimate`);
    const ready = t.energy >= 100 && t.ultCharge >= 1;
    ultBtn.disabled = !ready;
    ultBtn.innerHTML = ready
      ? `<svg class="pixel icon-mini"><use href="#px-meteor"/></svg><span>釋放大絕！</span>`
      : `<svg class="pixel icon-mini"><use href="#px-meteor"/></svg><span>充能 ${t.energy}%</span>`;
    // 作答中 badge — solo Boss 只騎士作答, mage badge 要 hide
    const active = (Game.settings.playLayout === 'solo' && !_isEasyMode())
      ? (team === 'knight')
      : (Game.settings.team === 'coop')
        ? (Game.state.currentTeam === team)
        : true;
    const badge = $(`${team}-active-badge`);
    badge.textContent = active ? '作答中' : '待命中';
    badge.className = `text-xs px-2 py-0.5 rounded-full ${active ? (team === 'knight' ? 'bg-blue-500/40 border border-blue-300/40' : 'bg-purple-500/40 border border-purple-300/40') : 'bg-white/10 border border-white/10 opacity-60'}`;
  },

  updateCastle() {
    const c = Game.state.castle;
    for (const side of ['left', 'right']) {
      const pct = Math.max(0, (c[side] / c.max) * 100);
      $(`castle-${side}-fill`).style.width = pct + '%';
      $(`castle-${side}-text`).textContent = Math.max(0, Math.round(c[side]));
    }
  },

  updateBadges() {
    $('badge-mode').textContent = Game.settings.win === 'hp' ? '擊殺模式' : '限時模式';
  },

  /**
   * v3.1: render question text from parts array (支援 emoji 排版)
   * parts 是 array of strings — numeric layout 直接 escapeHTML
   * parts-emoji layout 用 q-fruit span (大 emoji 視覺)
   *
   * v3.5 P0: TTS Karaoke — when Game.settings.ttsKaraoke !== false, wrap each
   * visible token in <span class="tts-tok" data-start="M" data-end="K" data-i="N">
   * so the onBoundary callback from TTS.speak can highlight the matching span as
   * speechSynthesis fires boundary events. data-start/data-end are offsets into
   * the NORMALIZED utterance text (what TTS.normalize produces), not the raw text.
   * Tokenization is per-character to match speechSynthesis charIndex semantics.
   */
  renderQuestionTextFor(team, q) {
    const el = $(`${team}-question-text`);
    if (!el) return;
    let parts = q.parts || [q.text];
    if (q.type === 'count10' || q.type === 'count20' || q.type === 'count1to3') {
      const n = Number(q.answer);
      if (Number.isFinite(n) && n >= 1) {
        const fruit = _firstEmojiIn((q.parts || []).join(''));
        parts = (q.type === 'count1to3') ? [fruit.repeat(n)] : [fruit.repeat(n), ' = ?'];
      }
    } else {
      const expanded = [];
      (parts || []).forEach(p => {
        const { emojiParts, textTokens } = _splitPartsEmojiText([p]);
        if (emojiParts.length && textTokens.length) {
          emojiParts.forEach(e => expanded.push(e));
          textTokens.forEach(t => expanded.push(t));
        } else {
          expanded.push(p);
        }
      });
      if (expanded.length) parts = expanded;
    }
    const karaoke = Game.settings.ttsKaraoke !== false;
    const html = parts.map(p => {
      // pure emoji cluster (expanded ranges incl. ⭐)
      if (typeof p === 'string' && p.length && [...p].every(ch => {
        const cp = ch.codePointAt(0);
        return _isEmojiCP(cp);
      })) {
        const inner = karaoke ? UI._ttsKaraokeWrapEmoji(p) : escapeHTML(p);
        return `<span class="q-fruit">${inner}</span>`;
      }
      const inner = karaoke ? UI._ttsKaraokeWrapText(p) : escapeHTML(p);
      return `<span class="tracking-widest">${inner}</span>`;
    }).join('');
    el.innerHTML = `<span class="q-parts">${html}</span>`;
  },
  /**
   * v3.5 P0: TTS Karaoke tokenizer (per-CHAR with normalized-text coordinates).
   *
   * Walks the raw text char-by-char, computing for each char its range inside
   * the NORMALIZED utterance (TTS.normalize output). That gives us data-start /
   * data-end offsets that match what speechSynthesis fires in
   * SpeechSynthesisUtteranceEvent.charIndex.
   *
   * Operator expansion table (raw → normalized):
   *   '+'  → '加'        (1 raw → 1 norm)
   *   '-'  → '減'        (1 raw → 1 norm)
   *   '='  → '等於'      (1 raw → 2 norm)
   *   '<'  → '細過'      (1 raw → 2 norm)
   *   '>'  → '大過'      (1 raw → 2 norm)
   *   '?'  → '，等於幾多？' (1 raw → 7 norm)
   *
   * All other chars are 1 raw → 1 norm (digits, spaces, Chinese chars, emoji).
   *
   * Note: this is a "scan-the-input" model, not "scan-the-output" — we walk raw
   * and project to norm positions. Avoids ambiguity when 2-char norm tokens
   * (等於) cover 1 raw char, and lets the boundary math do a clean <= charIndex
   * < end lookup.
   */
  _ttsKaraokeBuildMap(raw) {
    // UTF-16 code unit walk (matches SpeechSynthesisUtterance.charIndex semantics)
    // Operator expansion widths in NORMALIZED chars
    const normMap = {
      '+': '加', '-': '減',
      '=': '等於', '<': '細過', '>': '大過',
      '?': '，等於幾多？',
    };
    const tokens = [];   // [{raw, normStart, normEnd, rawIdx}]
    let normPos = 0;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      const replacement = normMap[ch];
      const normLen = replacement ? replacement.length : 1;
      // Don't span across UTF-16 surrogate pairs of an emoji — surrogate pair
      // is one "user-visible" emoji char. We treat each surrogate code unit as
      // 1 raw char here; in practice this still aligns with charIndex since
      // both walk UTF-16. The display side gets escapeHTML which preserves it.
      tokens.push({ raw: ch, normStart: normPos, normEnd: normPos + normLen, rawIdx: i });
      normPos += normLen;
    }
    return tokens;
  },
  _ttsKaraokeWrapText(raw) {
    // Wraps a non-emoji part (text like "5 + 3 = ?" or "時鐘顯示 5 點") in
    // .tts-tok spans per-char. Whitespace gets a tts-tok too so the highlight
    // sweep is visually continuous (no "skip" between digits).
    const tokens = UI._ttsKaraokeBuildMap(raw);
    return tokens.map(t => {
      const disp = escapeHTML(t.raw);
      return `<span class="tts-tok" data-start="${t.normStart}" data-end="${t.normEnd}" data-i="${t.rawIdx}">${disp}</span>`;
    }).join('');
  },
  _ttsKaraokeWrapEmoji(raw) {
    // Emoji cluster (whole part is one emoji run) becomes ONE .tts-tok span
    // spanning the full normalized range. TTS reads the emoji as a word
    // ("蘋果"), so per-char highlight would be meaningless anyway.
    const tokens = UI._ttsKaraokeBuildMap(raw);
    if (!tokens.length) return '';
    const first = tokens[0];
    const last  = tokens[tokens.length - 1];
    return `<span class="tts-tok" data-start="${first.normStart}" data-end="${last.normEnd}" data-i="${first.rawIdx}">${escapeHTML(raw)}</span>`;
  },
  /**
   * v3.5 P0: TTS Karaoke onBoundary handler factory.
   *
   * Given the .tts-tok NodeList (re-queried each fire to avoid stale refs after
   * question change), find the span whose data-start <= charIndex < data-end
   * and add .tts-active. Remove .tts-active from siblings. Last token may not
   * get a boundary (Chromium fires charIndex = t.length at the last word
   * boundary — past the last span); onEnd / TTS.cancel clears it.
   */
  _ttsKaraokeBoundary(tokensRoot) {
    return (charIndex) => {
      const root = typeof tokensRoot === 'function' ? tokensRoot() : tokensRoot;
      if (!root) return;
      const tokens = root.querySelectorAll ? root.querySelectorAll('.tts-tok') : root;
      if (!tokens || !tokens.length) return;
      let matched = null;
      for (const tok of tokens) {
        const s = parseInt(tok.dataset.start, 10);
        const e = parseInt(tok.dataset.end,   10);
        if (s <= charIndex && charIndex < e) { matched = tok; break; }
      }
      for (const tok of tokens) {
        if (tok === matched) tok.classList.add('tts-active');
        else tok.classList.remove('tts-active');
      }
    };
  },

  showQuestion(team) {
    const q = Game.state.current[team];
    if (!q) return;
    // V3.4-AUDIT5: TTS cancel-on-question-change
    TTS.cancel();
    // V3.6-SEN: easy mode uses ultra-simple SEN screen renderer
    if (Game.settings.difficulty === 'easy') {
      UI.showQuestionSEN(q, team);
      return;
    }
    const reg = TYPE_REGISTRY[q.type] || { layout:'numeric' };

    // Render question text (parts-based)
    UI.renderQuestionTextFor(team, q);

    // Wire TTS button
    const ttsBtn = $(`${team}-tts-btn`);
    if (ttsBtn) {
      ttsBtn.onclick = () => {
        const text = (q.parts ? q.parts.join('') : q.text) || '';
        const tokensRoot = () => $(`${team}-question-text`);
        const onBoundary = Game.settings.ttsKaraoke !== false
          ? UI._ttsKaraokeBoundary(tokensRoot) : null;
        const onEnd = Game.settings.ttsKaraoke !== false
          ? () => {
              const root = tokensRoot();
              if (root) root.querySelectorAll('.tts-tok.tts-active')
                .forEach(t => t.classList.remove('tts-active'));
            }
          : null;
        TTS.speak(text, ttsBtn, { onBoundary, onEnd });
      };
    }

    // Dispatch to layout renderer
    const area = $(`${team}-answer-area`);
    area.innerHTML = '';

    const layout = reg.layout;
    const renderer = QuestionRenderer[layout];
    if (renderer) {
      const extra = { isSym: layout === 'sym-button' };
      const fellThrough = renderer(q, team, area, extra);
      // false = renderer signalled fall-through to keypad
      if (!fellThrough && Game.settings.mode === 'keypad') {
        QuestionRenderer['keypad'](q, team, area, extra);
      }
    } else {
      // Unknown layout → numeric choice fallback
      QuestionRenderer['numeric'](q, team, area);
    }
  },

  renderReview() {
    const list = $('review-list');
    const prevCount = list.children.length;
    list.innerHTML = '';
    if (Game.state.review.length === 0) {
      list.innerHTML = '<span class="text-xs text-amber-100/70">（目前沒有待重練題目）</span>';
      return;
    }
    Game.state.review.forEach((q, idx) => {
      const b = document.createElement('button');
      b.className = 'review-chip px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-300/40 hover:bg-amber-500/30 active:scale-95 text-sm font-bold transition-all';
      // 預設顯示題目；hover/long-press 顯示答案
      b.textContent = q.text;            // "5 + 0 = ?"
      // P0-2: 答案 XOR 編碼 — DevTools 唔直接睇到
      b.dataset.answerEncoded = encodeAnswer(String(q.answer));
      b.dataset.expression = q.text;
      b.title = '👀 hover / 長按 1.2 秒看答案 · 再按我重答';
      b.setAttribute('aria-label', `重練題：${q.text}。長按 1.2 秒顯示答案`);
      // 用 data-idx ＋ event delegation — 避 closure stale 問題
      b.dataset.idx = String(idx);
      // P0-2: 新加入嘅 chip 加 fresh animation (fly-down)
      if (idx >= prevCount) b.classList.add('fresh');
      list.appendChild(b);
    });
  },

  // ===== V3.6-SEN: 超簡答題版面（solo / dual touch-board） =====

  _senEls(team) {
    const t = team || 'knight';
    return {
      team: t,
      emojiEl: $(`sen-q-emoji-${t}`),
      textEl: $(`sen-q-text-${t}`),
      optsArea: $(`sen-options-${t}`),
      fb: $(`sen-feedback-${t}`),
      who: $(`sen-who-${t}`),
      correct: $(`sen-correct-${t}`),
      wrong: $(`sen-wrong-${t}`),
      done: $(`sen-done-${t}`),
      panel: $(`sen-panel-${t}`),
    };
  },

  applySENBoardLayout() {
    const board = $('sen-board');
    if (!board) return;
    const dual = Game.settings.playLayout === 'dual';
    board.classList.toggle('sen-board-solo', !dual);
    board.classList.toggle('sen-board-dual', dual);
    board.classList.toggle('sen-board-relay', dual);
    board.classList.toggle('has-arena', true); // solo+dual easy both have arena strip
    ['knight', 'mage'].forEach(tm => {
      const d = $(`sen-done-${tm}`);
      if (d) d.classList.add('hidden');
    });
    if (dual) {
      // 開局先收埋右隊（等 setSENTurn 切換）
      const mp = $('sen-panel-mage');
      if (mp) mp.classList.add('hidden');
    }
    UI.setupSENArena();
  },

  // arena — dual tug|boat|bridge + solo boat|bridge|ruler
  setupSENArena() {
    const arena = $('sen-arena');
    const tug = $('sen-arena-tug');
    const boat = $('sen-arena-boat');
    const bridge = $('sen-arena-bridge');
    if (!arena || !tug || !boat) return;
    const dual = _isDualPlay();
    const isEasy = _isEasyMode();
    const show = isEasy; // solo + dual classroom both get mini-game strip
    arena.classList.toggle('hidden', !show);
    arena.classList.remove('skin-tug', 'skin-boat', 'skin-retro-tug', 'skin-retro-bridge');
    if (!show) {
      tug.classList.add('hidden');
      boat.classList.add('hidden');
      if (bridge) bridge.classList.add('hidden');
      return;
    }
    const retro = _isRetroArena();
    let versus = false;
    let useBoat = false;
    let useBridge = false;
    let useTug = false;
    if (dual) {
      versus = !_isCoopTeam();
      useTug = versus;
      useBoat = !versus && !retro;
      useBridge = !versus && retro;
    } else {
      // solo mini-game: boat | bridge | ruler
      const sm = Game.settings.soloMode === 'boat' ? 'boat'
        : (Game.settings.soloMode === 'ruler' ? 'ruler' : 'bridge');
      Game.settings.soloMode = sm;
      if (sm === 'boat') { useBoat = true; Game.settings.arenaSkin = 'classic'; Game.settings.team = 'coop'; }
      else if (sm === 'ruler') { useTug = true; versus = true; Game.settings.arenaSkin = 'retro'; Game.settings.team = 'versus'; }
      else { useBridge = true; Game.settings.arenaSkin = 'retro'; Game.settings.team = 'coop'; }
    }
    tug.classList.toggle('hidden', !useTug);
    boat.classList.toggle('hidden', !useBoat);
    if (bridge) bridge.classList.toggle('hidden', !useBridge);
    if (useTug) arena.classList.add(retro || !dual ? 'skin-retro-tug' : 'skin-tug');
    else if (useBridge) arena.classList.add('skin-retro-bridge');
    else arena.classList.add('skin-boat');
    // for solo classic boat, force classic skin class
    if (useBoat) {
      arena.classList.remove('skin-retro-tug', 'skin-retro-bridge', 'skin-tug');
      arena.classList.add('skin-boat');
    }
    if (useTug && dual && !retro) {
      arena.classList.remove('skin-retro-tug', 'skin-boat', 'skin-retro-bridge');
      arena.classList.add('skin-tug');
    }
    if (useTug && (!dual || retro)) {
      arena.classList.remove('skin-tug', 'skin-boat', 'skin-retro-bridge');
      arena.classList.add('skin-retro-tug');
    }
    // identity avatars
    const eL = _teamEmoji('knight');
    const eR = dual ? _teamEmoji('mage') : eL;
    const avL = $('sen-avatar-l');
    const avR = $('sen-avatar-r');
    if (avL) avL.textContent = eL;
    if (avR) {
      avR.textContent = dual ? eR : '🏁';
      avR.style.opacity = dual ? '1' : '0.85';
    }
    const cL = $('sen-boat-crew-l');
    const cR = $('sen-boat-crew-r');
    if (cL) cL.textContent = eL;
    if (cR) cR.textContent = dual ? eR : '';
    const bL = $('sen-bridge-av-l');
    const bR = $('sen-bridge-av-r');
    if (bL) bL.textContent = eL;
    if (bR) bR.textContent = dual ? eR : '🏡';
    // reset visuals
    const knot = $('sen-tug-knot');
    if (knot) {
      knot.style.left = dual ? '50%' : '12%';
      knot.classList.remove('pull-l', 'pull-r');
      knot.textContent = (retro || !dual) ? '📏' : '🪢';
    }
    const ship = $('sen-boat');
    if (ship) {
      ship.style.left = '4%';
      ship.classList.remove('splash');
    }
    const fill = $('sen-boat-fill');
    if (fill) fill.style.width = '0%';
    const bar = $('sen-boat-bar');
    if (bar) bar.setAttribute('aria-valuenow', '0');
    const planks = $('sen-bridge-planks');
    if (planks) {
      planks.style.width = '0%';
      planks.innerHTML = '';
      planks.classList.remove('lay');
    }
    const bFill = $('sen-bridge-fill');
    if (bFill) bFill.style.width = '0%';
    const bBar = $('sen-bridge-bar');
    if (bBar) bBar.setAttribute('aria-valuenow', '0');
    const st = $('sen-arena-status');
    if (st) {
      if (!dual) {
        if (useTug) st.textContent = '📏 拉力挑戰 · 答對就拉向前！';
        else if (useBridge) st.textContent = '🌉 單人鋪路 · 答對加一格！';
        else st.textContent = '🚢 單人推船 · 答對就前進！';
      } else if (versus) st.textContent = retro ? '📏 像素扯尺 · 答對就拉！' : '🪢 扯大欖 · 答對就拉！';
      else st.textContent = retro ? '🌉 一齊鋪路 · 答對就加一格！' : '🚢 一齊推船 · 答對就前進！';
    }
    UI.refreshSENArena(null, false);
  },

  refreshSENArena(pullTeam, didCorrect) {
    if (!_isEasyMode()) return;
    const arena = $('sen-arena');
    if (!arena || arena.classList.contains('hidden')) return;
    const dual = _isDualPlay();
    const tk = Game.state.teams.knight || { correct: 0, total: 0 };
    const tm = Game.state.teams.mage || { correct: 0, total: 0 };
    const goal = Game.state.easyGoalTotal || 10;
    const L = Game.settings.playerLabel || (dual ? '左隊' : '你');
    const R = Game.settings.playerLabelRight || '右隊';
    const versus = !_isCoopTeam();
    const retro = _isRetroArena();
    const st = $('sen-arena-status');
    const mark = versus ? (retro || !dual ? '📏' : '🪢') : (retro ? '🌉' : '🚢');

    // —— Solo progress paths ——
    if (!dual) {
      const sum = tk.correct || 0;
      const need = Math.max(goal, 1);
      const pct = Math.max(0, Math.min(100, Math.round((sum / need) * 100)));
      const sm = Game.settings.soloMode === 'boat' ? 'boat'
        : (Game.settings.soloMode === 'ruler' ? 'ruler' : 'bridge');
      if (sm === 'ruler') {
        const knot = $('sen-tug-knot');
        if (knot) {
          // 12% → 88% toward finish flag
          const left = 12 + (pct / 100) * 76;
          knot.style.left = left.toFixed(2) + '%';
          if (didCorrect) {
            _pulseEl(knot, 'pull-r', 420);
            _pulseEl($('sen-avatar-l'), 'bounce', 420);
          }
        }
        if (st) st.textContent = pct >= 100 ? '🏁 拉到終點！' : `📏 拉力 ${sum}/${need}（${pct}%）`;
      } else if (sm === 'bridge') {
        const planks = $('sen-bridge-planks');
        if (planks) {
          planks.style.width = pct + '%';
          planks.innerHTML = _bridgePlanksHTML(Math.max(sum, pct > 0 ? Math.max(1, Math.round(pct / 8)) : 0));
          if (didCorrect) _pulseEl(planks, 'lay', 420);
        }
        const fill = $('sen-bridge-fill');
        if (fill) fill.style.width = pct + '%';
        const bar = $('sen-bridge-bar');
        if (bar) {
          bar.setAttribute('aria-valuenow', String(pct));
          bar.setAttribute('aria-valuetext', `橋進度 ${pct}%`);
        }
        if (didCorrect) _pulseEl($('sen-bridge-av-l'), 'bounce', 420);
        if (st) st.textContent = pct >= 100 ? '🏡 橋連住啦！' : `🌉 鋪路 ${sum}/${need}（${pct}%）`;
      } else {
        const fill = $('sen-boat-fill');
        if (fill) fill.style.width = pct + '%';
        const bar = $('sen-boat-bar');
        if (bar) {
          bar.setAttribute('aria-valuenow', String(pct));
          bar.setAttribute('aria-valuetext', `進度 ${pct}%`);
        }
        const ship = $('sen-boat');
        if (ship) {
          const left = 4 + (pct / 100) * 82;
          ship.style.left = left.toFixed(2) + '%';
          if (didCorrect) _pulseEl(ship, 'splash', 450);
        }
        if (st) st.textContent = pct >= 100 ? '🏝️ 埋岸啦！' : `🚢 前進 ${sum}/${need}（${pct}%）`;
      }
      return;
    }

    // —— Dual (unchanged math) ——
    if (versus) {
      const knot = $('sen-tug-knot');
      if (knot) {
        const lead = (tk.correct || 0) - (tm.correct || 0);
        const max = Math.max(goal, 1);
        const t = Math.max(-1, Math.min(1, lead / max));
        const pct = 50 - t * 38; // 12–88；左贏→左、右贏→右
        knot.style.left = pct.toFixed(2) + '%';
        if (didCorrect && pullTeam) {
          _pulseEl(knot, pullTeam === 'knight' ? 'pull-l' : 'pull-r', 420);
          _pulseEl($(pullTeam === 'knight' ? 'sen-avatar-l' : 'sen-avatar-r'), 'bounce', 420);
        }
      }
      if (st) {
        if (tk.correct === tm.correct) st.textContent = `${mark} 平手 ${tk.correct} : ${tm.correct}`;
        else if (tk.correct > tm.correct) st.textContent = `${mark} ${L} 領先！ ${tk.correct} : ${tm.correct}`;
        else st.textContent = `${mark} ${R} 領先！ ${tk.correct} : ${tm.correct}`;
      }
    } else if (retro) {
      const sum = (tk.correct || 0) + (tm.correct || 0);
      const need = Math.max(goal * 2, 1);
      const pct = Math.max(0, Math.min(100, Math.round((sum / need) * 100)));
      const plankN = Math.max(0, Math.min(need, sum));
      const planks = $('sen-bridge-planks');
      if (planks) {
        planks.style.width = pct + '%';
        planks.innerHTML = _bridgePlanksHTML(Math.max(plankN, pct > 0 ? Math.max(1, Math.round(pct / 8)) : 0));
        if (didCorrect) _pulseEl(planks, 'lay', 420);
      }
      const fill = $('sen-bridge-fill');
      if (fill) fill.style.width = pct + '%';
      const bar = $('sen-bridge-bar');
      if (bar) {
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuetext', `橋進度 ${pct}%`);
      }
      if (didCorrect && pullTeam) {
        _pulseEl($(pullTeam === 'knight' ? 'sen-bridge-av-l' : 'sen-bridge-av-r'), 'bounce', 420);
      }
      if (st) {
        if (pct >= 100) st.textContent = '🏡 橋連住啦！';
        else st.textContent = `🌉 一齊鋪路 ${sum}/${need}（${pct}%）`;
      }
    } else {
      const sum = (tk.correct || 0) + (tm.correct || 0);
      const need = Math.max(goal * 2, 1);
      const pct = Math.max(0, Math.min(100, Math.round((sum / need) * 100)));
      const fill = $('sen-boat-fill');
      if (fill) fill.style.width = pct + '%';
      const bar = $('sen-boat-bar');
      if (bar) {
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuetext', `進度 ${pct}%`);
      }
      const ship = $('sen-boat');
      if (ship) {
        const left = 4 + (pct / 100) * 82;
        ship.style.left = left.toFixed(2) + '%';
        if (didCorrect) _pulseEl(ship, 'splash', 450);
      }
      if (st) {
        if (pct >= 100) st.textContent = '🏝️ 埋岸啦！';
        else st.textContent = `🚢 一齊前進 ${sum}/${need}（${pct}%）`;
      }
    }
  },

  // Render one question in the SEN ultra-simple screen
  showQuestionSEN(q, team) {
    if (!q) return;
    const t = team || 'knight';
    const { emojiEl, textEl, optsArea, fb, done } = UI._senEls(t);
    if (fb) fb.innerHTML = '';
    if (Game.state.hintLevel) Game.state.hintLevel[t] = 0;
    const hintLine = $(`sen-hintline-${t}`);
    if (hintLine) hintLine.textContent = '';
    if (done) done.classList.add('hidden');
    if (emojiEl) {
      emojiEl.classList.remove('sen-count-dense', 'sen-q-visual');
      emojiEl.innerHTML = '';
      emojiEl.textContent = '';
    }

    // visual dispatch (bars / clock / shape / COUNT GRID / parts)
    const panel = $(`sen-panel-${t}`);
    if (panel) panel.classList.remove('len-focus');

    if ((q.type === 'compareLength' || q.type === 'compareHeight') && q.extra && emojiEl) {
      emojiEl.classList.add('sen-q-visual');
      if (q.type === 'compareHeight') {
        emojiEl.innerHTML = _heightPairHTML(q.extra).html;
      } else {
        emojiEl.innerHTML = _lengthBarsHTML(q.extra).html;
      }
      if (textEl) {
        textEl.textContent = _senCopyText(q) || (q.extra.prompt) ||
          (q.type === 'compareHeight' ? '邊個高？' : '邊條長？');
      }
      if (panel) panel.classList.add('len-focus');
      if (optsArea) optsArea.innerHTML = '';
      _wireLengthVisualClicks(emojiEl, q, t);
      // Auto TTS once
      if (Game.settings.ttsEnabled && Game.settings.playLayout !== 'dual') {
        const text = _senCopyTTS(q);
        if (text) TTS.speak(text, null, {});
      }
      return; // 無 A/B、無第二組圖
    } else if (q.type === 'whatTime' && q.extra && emojiEl) {
      const hour = Number(q.extra.hour != null ? q.extra.hour : q.answer) || 12;
      const deg = hour * 30;
      emojiEl.classList.add('sen-q-visual');
      emojiEl.innerHTML = `<div class="q-clock sen-clock" role="img" aria-label="時鐘">
        <svg viewBox="0 0 16 16" style="width:176px;height:176px;">
          <use href="#px-clock-base"/>
          <line x1="8" y1="8" x2="8" y2="3" stroke="#dc2626" stroke-width="1.2" transform="rotate(${deg} 8 8)"/>
          <line x1="8" y1="8" x2="11" y2="8" stroke="#1e293b" stroke-width="0.6"/>
        </svg>
      </div>`;
      if (textEl) textEl.textContent = _senCopyText(q) || '幾點鐘？';
    } else if (q.type === 'shapeMatch' && emojiEl) {
      emojiEl.classList.add('sen-q-visual');
      emojiEl.innerHTML = `<div class="q-shape"><svg viewBox="0 0 16 16" style="width:144px;height:144px;"><use href="#px-shape-${q.answer}"/></svg></div>`;
      if (textEl) textEl.textContent = _senCopyText(q) || '這是什麼形狀？';
    } else if ((q.type === 'count10' || q.type === 'count20' || q.type === 'count1to3') && emojiEl) {
      emojiEl.classList.add('sen-q-visual');
      emojiEl.innerHTML = _countVisualHTML(q).html;
      if (textEl) textEl.textContent = _senCopyText(q) || '有幾多？';
    } else if ((q.type === 'learnL' || q.type === 'findLDrink' || q.type === 'findLItem') && emojiEl) {
      // ⚠️ V3.6 cycle111e P0 修正：呢啲卡片之前係**冇 click handler 嘅 <div>** ——
      //    學生喺 SEN 畫面根本撳唔到（3 個 L 容量 scope 由 cycle 89 起就係死路）。
      //    經典畫面（pic-grid layout）一直用真 <button class="pic-card-btn">，
      //    SEN 呢邊漏咗接 handler。→ 而家改成真 <button>：可撳 + 鍵盤可達 + 有 aria-label。
      emojiEl.classList.add('sen-q-visual');
      const items = (q.extra && Array.isArray(q.extra.items)) ? q.extra.items : [];
      const gridOpts = q.options || ['1', '2', '3', '4'];
      const grid = document.createElement('div');
      grid.className = 'pic-grid-mini';
      grid.setAttribute('role', 'group');
      grid.setAttribute('aria-label', '答案選項');
      items.slice(0, 4).forEach((it, idx) => {
        const letter = ['A', 'B', 'C', 'D'][idx] || String(idx + 1);
        const isL = /L$/.test(String(it.pkg || ''));
        const visual = it.svgId
          ? `<svg class="pic-card-svg" viewBox="0 0 64 64" aria-hidden="true"><use href="#${it.svgId}"/></svg>`
          : `<span class="pic-card-emoji" aria-hidden="true">${it.emoji || '📦'}</span>`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pic-card-mini';
        b.innerHTML = `<span class="sen-opt-letter" aria-hidden="true">${letter}</span>${visual}` +
          `<span class="pic-card-name">${it.name || ''}</span>` +
          `<span class="pic-card-pkg ${isL ? 'is-l' : ''}">${it.pkg || ''}</span>`;
        b.setAttribute('aria-label', `${letter}. ${it.name || ''} ${it.pkg || ''}`);
        b.dataset.letter = letter;
        // 卡片 index ↔ 選項 index（_lPickMC 令 items 順序同 q.options 順序一致）
        const opt = String(gridOpts[idx] || (idx + 1));
        b.onclick = () => { Game.handleAnswer(team, opt, b); };
        grid.appendChild(b);
      });
      emojiEl.innerHTML = '';
      emojiEl.appendChild(grid);
      if (textEl) textEl.textContent = _senCopyText(q) || q.extra?.prompt || '邊個有 1L?';
    } else if (q.parts) {
      const { emojiParts, textTokens } = _splitPartsEmojiText(q.parts);
      if (emojiEl) {
        if (q.type === 'orderAsc20' || q.type === 'orderDesc20' || q.type === 'ordering') {
          emojiEl.textContent = (q.displayNums && q.displayNums.length)
            ? q.displayNums.join('  ·  ')
            : (q.parts && q.parts[0]) || '';
          emojiEl.classList.add('sen-count-dense');
        } else if (q.type === 'compare10') {
          emojiEl.textContent = (q.parts || []).join('');
          emojiEl.classList.add('sen-count-dense');
        } else if (q.type === 'groupAdd' || q.type === 'double') {
          emojiEl.classList.add('sen-q-visual');
          const runs = emojiParts.map(run => [...run].filter(_isEmojiChar));
          const left = (runs[0] || []).map(ch => `<span class="sen-count-item">${ch}</span>`).join('');
          const right = (runs[1] || []).map(ch => `<span class="sen-count-item">${ch}</span>`).join('');
          if (left || right) {
            emojiEl.innerHTML = `<div class="sen-count-grid" role="img" aria-label="兩組">${left}<span class="sen-count-item" style="opacity:.9">➕</span>${right}</div>`;
          } else {
            emojiEl.innerHTML = _countVisualHTML({ parts: q.parts, answer: q.answer }).html;
          }
        } else if (q.type === 'compareGroup') {
          emojiEl.classList.add('sen-q-visual');
          const runs = emojiParts.map(run => [...run].filter(_isEmojiChar));
          const left = (runs[0] || []).map(ch => `<span class="sen-count-item">${ch}</span>`).join('');
          const right = (runs[1] || []).map(ch => `<span class="sen-count-item">${ch}</span>`).join('');
          emojiEl.innerHTML = `<div class="sen-count-grid" role="img" aria-label="比較">${left}<span class="sen-count-item" style="opacity:.75">❓</span>${right}</div>`;
        } else {
          const joined = emojiParts.join(' ');
          emojiEl.textContent = joined;
          if (joined.length >= 8) emojiEl.classList.add('sen-count-dense');
        }
      }
      if (textEl) {
        const mapped = _senCopyText(q);
        textEl.textContent = mapped || textTokens.join(' ');
      }
    } else {
      if (emojiEl) emojiEl.textContent = q.text || '';
      if (textEl) textEl.textContent = '';
    }

    const opts = q.options || [q.answer];
    const labels = q.optionLabels;
    const shuffled = shuffle(opts);
    if (!optsArea) return;
    const isPicGrid = (q.type === 'learnL' || q.type === 'findLDrink' || q.type === 'findLItem');
    optsArea.innerHTML = '';
    if (isPicGrid) {
      // 喺 optsArea 顯示純文字 ABCD legend，畀學生對應
      const legend = document.createElement('div');
      legend.className = 'pic-grid-legend';
      legend.setAttribute('role', 'group');
      legend.setAttribute('aria-label', '字母對應');
      const LETTERS = ['A', 'B', 'C', 'D'];
      LETTERS.forEach((L) => {
        const span = document.createElement('span');
        span.className = 'pic-grid-legend-item';
        span.textContent = L;
        legend.appendChild(span);
      });
      optsArea.appendChild(legend);
    } else {
      const LETTERS = ['A', 'B', 'C', 'D'];
      shuffled.forEach((opt, idx) => {
        const b = document.createElement('button');
        b.className = 'sen-opt-btn';
        const letter = LETTERS[idx] || String(idx + 1);
        const val = (labels && labels[opt] !== undefined) ? String(labels[opt]) : String(opt);
        b.innerHTML = `<span class="sen-opt-letter" aria-hidden="true">${letter}</span><span class="sen-opt-val"></span>`;
        const valEl = b.querySelector('.sen-opt-val');
        _paintOptionLabel(valEl, val);
        b.setAttribute('aria-label', `${letter}. ${val}`);
        b.dataset.letter = letter;
        b.onclick = () => { Game.handleAnswer(t, opt, b); };
        optsArea.appendChild(b);
      });
    }

    // Auto TTS: solo only (dual = manual per-side 🔊 to avoid cross-talk)
    if (Game.settings.ttsEnabled && Game.settings.playLayout !== 'dual') {
      const text = _senCopyTTS(q);
      if (text) TTS.speak(text, null, {});
    }
  },

  //   經典畫面一直有（highlightBtn → `.option-btn.correct/.wrong` + `::before` ✓/✗），
  //   SEN 畫面（目標學生行嘅路徑）冇 → 學生只見到全屏 overlay，睇唔出邊個答啱。
  //   層疊反饋（聲音同動畫同一幀起點）：狀態色 + ✓/✕ badge + squash&stretch pop + 慶祝粒子。
  //   ⚠️ SEN 安全：答錯用藍灰（唔用刺眼紅）· 唔做 screen shake / hit-stop · pop 只喺被撳嗰個掣
  _senMarkOption(btn, correct) {
    if (!btn || !btn.classList) return;
    if (!btn.dataset || !btn.dataset.letter) return;   // 冇 A/B/C/D badge 嘅唔搞
    btn.classList.remove('is-correct', 'is-wrong');
    void btn.offsetWidth;                 // 重啟 CSS animation
    btn.classList.add(correct ? 'is-correct' : 'is-wrong');
  },
  // 搵返「正確答案」嗰個選項（一般 MC 掣 / pic-grid 卡片）
  _senFindOption(team, q) {
    const panel = document.getElementById('sen-panel-' + team);
    if (!panel || !q) return null;
    const ans = String(q.answer);
    const btn = Array.from(panel.querySelectorAll('.sen-opt-btn')).find((b) => {
      const v = b.querySelector('.sen-opt-val');
      return v && v.textContent.trim() === ans;
    });
    if (btn) return btn;
    const cards = Array.from(panel.querySelectorAll('.pic-card-mini'));
    const idx = (q.options || []).indexOf(ans);
    if (idx >= 0 && cards[idx]) return cards[idx];
    return null;
  },
  // 答錯時揭示正確選項 —— 對 SEN 學生係最重要嘅教學時刻
  _senRevealCorrect(team, q) {
    const btn = UI._senFindOption(team, q);
    if (!btn) return;
    btn.classList.remove('is-correct', 'is-wrong');
    void btn.offsetWidth;
    btn.classList.add('is-correct');
  },
  // 答對：細量慶祝（medium tier —— 答對一題唔等於擊殺 boss）
  _senCelebrate(btn) {
    if (!btn) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const r = btn.getBoundingClientRect();
    if (!r.width || !r.height) return;
    FX.confetti(r.left + r.width / 2, r.top + r.height / 2, 14);
  },

  //
  // ⚠️ P0：舊版（cycle88）喺全屏 overlay **置中** 放一個 5.5rem 嘅「✅ 正！/💙 再試！」大字。
  //    實機量測（639×669）：stamp 文字 397×92px @ y289–380，選項掣 A @ y274–384
  //    → 重疊 352×91 = 32,032 px²。答錯嗰陣，被揭示嘅正確答案完全被大字蓋死
  //    —— 最需要教學嗰一刻睇唔到（實機截圖實證）。
  //    另外 0.5 alpha 嘅全屏底會食掉逐個選項嘅狀態色，令 .is-correct/.is-wrong 失效。
  //
  // 新版三層（詳見 index.html CSS 段落嘅註解）：
  //   ① .sen-fb-wash → 全屏淡色，0.45 → 0.12（唔食掉選項狀態色）
  //   ② .sen-fb-band → 頂部橫條（疊喺 absolute 定位嘅 head 帶上，零 layout shift）
  //      verdict + 提示；永遠唔覆蓋選項掣 / Stage 進度格
  //   ③ 逐個選項反饋 → 由 _senMarkOption / _senRevealCorrect 負責（主要學習訊號）
  _senShowFeedback(correct, hintText, team) {
    const t = team || 'knight';
    const fb = $(`sen-feedback-${t}`);
    if (!fb) return;
    if (fb._clearTimer) clearTimeout(fb._clearTimer);
    const hintHtml = (!correct && hintText)
      ? `<span class="sen-fb-hint">${escapeHTML(String(hintText))}</span>`
      : '';
    // correct = 綠 / wrong = 藍（安慰語氣，唔用紅 —— SEN 安全）
    const wash = correct ? 'rgba(34,197,94,0.45)' : 'rgba(59,130,246,0.40)';
    const bandBg = correct ? 'rgba(21,128,61,0.95)' : 'rgba(30,64,175,0.95)';
    const stamp = correct ? '✅ 正！' : '💙 再試！';
    fb.innerHTML =
      `<div class="sen-fb-wash" style="background:${wash};"></div>` +
      `<div class="sen-fb-band" style="background:${bandBg};">` +
      `<span class="sen-fb-stamp">${stamp}</span>${hintHtml}</div>`;
    // head 帶被 band 覆蓋 → 收埋佢，令「睇唔到」同「撳唔到」一致
    const panel = $(`sen-panel-${t}`);
    if (panel) panel.classList.add('is-fb-active');
    fb._clearTimer = setTimeout(() => {
      if (fb) fb.innerHTML = '';
      if (panel) panel.classList.remove('is-fb-active');
    }, correct ? 2000 : 2200);
  },

  markSENTeamDone(team) {
    const done = $(`sen-done-${team}`);
    if (done) done.classList.remove('hidden');
    const opts = $(`sen-options-${team}`);
    if (opts) opts.innerHTML = '';
  },

  // Update correct/wrong counters on SEN screen (one or both teams)
  refreshSENScreen() {
    const dual = Game.settings.playLayout === 'dual';
    const labels = {
      knight: Game.settings.playerLabel || '同學',
      mage: Game.settings.playerLabelRight || Game.settings.playerLabel || '同學',
    };
    const teams = dual ? ['knight', 'mage'] : ['knight'];
    teams.forEach(tm => {
      const st = Game.state.teams[tm] || { correct: 0, wrong: 0 };
      const c = $(`sen-correct-${tm}`);
      const w = $(`sen-wrong-${tm}`);
      const who = $(`sen-who-${tm}`);
      const qc = $(`sen-q-count-${tm}`);
      if (c) c.textContent = `✅ ${st.correct}`;
      if (w) w.textContent = `❌ ${st.wrong}`;
      // V3.6 cycle106 P0-D: st.total = 已答題數(答啱答錯都加),所以第一題顯示「第 0 題」。
      // 顯示「進行中嘅題號」= total + 1,並用 goal 收尾避免答完變「第 11 題」。
      if (qc) {
        const _goalQ = Game.state.easyGoalTotal || 10;
        qc.textContent = `第 ${Math.min(st.total + 1, _goalQ)} 題`;
      }
      if (who) {
        const side = dual ? (tm === 'knight' ? '⬅ ' : '➡ ') : '';
        who.textContent = side + (labels[tm] || '同學');
      }
      const cellsWrap = $(`sen-cells-${tm}`);
      if (cellsWrap) {
        const fills = _stageCellFills(tm);
        const cellEls = cellsWrap.querySelectorAll('.sen-cell');
        let activeIdx = fills.findIndex(f => f < 1);
        if (activeIdx < 0) activeIdx = fills.length - 1;
        cellEls.forEach((el, i) => {
          const pct = Math.round((fills[i] || 0) * 100);
          el.style.setProperty('--p', pct + '%');
          el.classList.toggle('is-filled', pct > 0);
          el.classList.toggle('is-active', i === activeIdx);
        });
        const done = fills.reduce((a, b) => a + b, 0);
        cellsWrap.setAttribute('aria-valuenow', String(Math.round(done)));
      }
      const stageLabel = $(`sen-stage-label-${tm}`);
      if (stageLabel) {
        const sg = (Game.state.stage && Game.state.stage[tm]) || { index: 0 };
        const goal = _stageGoalQuestions();
        stageLabel.textContent = `關卡 ${Math.min(sg.index + 1, goal.stages)} / ${goal.stages}`;
      }
    });
  },

  // cycle109: 提示行（層 1-4 階梯提示顯示喺呢度，唔會蓋住題目）
  _senShowHint(hintText, team) {
    const t = team || 'knight';
    const el = $(`sen-hintline-${t}`);
    if (!el) return;
    el.textContent = hintText ? String(hintText) : '';
  },

  showSENRetryBanner(show) {
    const el = $('sen-retry-banner');
    if (!el) return;
    el.classList.toggle('hidden', !show);
  },

  // ⚠️ cycle110b 兩度修正：
  //   1) 之前 toggle 咗 #knight-card / #mage-card —— 嗰兩個係「經典 game screen」嘅面板，
  //      easy 行嘅係 SEN screen（#sen-panel-*）→ 舊 code 對 SEN 板完全冇效果（dead code）。
  //   2) 邊隊 = Game.state.currentTeam（唯一真實來源），唔好再開新欄位。
  setSENTurn(team) {
    const t = team || Game.state.currentTeam || 'knight';
    const dual = Game.settings.playLayout === 'dual';
    const board = $('sen-board');
    if (board) board.classList.toggle('sen-board-relay', dual);
    if (dual) {
      // 接力：只顯示輪到嗰隊（單欄全寬，另一隊嗰邊收埋）
      ['knight', 'mage'].forEach(tm => {
        const p = $(`sen-panel-${tm}`);
        if (p) p.classList.toggle('hidden', tm !== t);
      });
    } else {
      const kp = $('sen-panel-knight'); if (kp) kp.classList.remove('hidden');
      const mp = $('sen-panel-mage'); if (mp) mp.classList.add('hidden');
    }
    const banner = $('sen-turn-banner');
    if (!dual) { if (banner) banner.classList.add('hidden'); return; }
    if (banner) {
      banner.classList.remove('hidden');
      const nameOf = tm => (tm === 'knight'
        ? (Game.settings.playerLabel || '左隊')
        : (Game.settings.playerLabelRight || '右隊'));
      const other = t === 'knight' ? 'mage' : 'knight';
      const done = Game.state._easyTeamDone || {};
      // 對方已經完成 → 講清楚「完成咗 + 輪到邊個」（否則嗰個學生以為漏咗自己）
      banner.textContent = done[other]
        ? `✅ ${nameOf(other)} 完成咗 · 輪到 ${nameOf(t)}`
        : `輪到 ${nameOf(t)}`;
    }
  },
};

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============== P0-2: 答案 XOR 編碼 (dev-only) ============== */
// NOT SECURITY — 純 client-side，學生打開 DevTools 仍可 decode。
// 目的：擋 casual quick-inspect（家長/同學偶然瞄到）。
// Safe to remove: deleting these 4 lines makes answers always visible in DevTools,
// which is fine for a single-player classroom game.
const ANSWER_KEY = 0x5A;
function encodeAnswer(s) {
  return String(s).split('').map(c => (c.charCodeAt(0) ^ ANSWER_KEY).toString(16).padStart(2,'0')).join('');
}
function decodeAnswer(hex) {
  if (!hex) return '';
  // Guard: hex must be even-length (2 chars per byte)
  if (hex.length % 2 !== 0) return '';
  const out = [];
  for (let i = 0; i < hex.length; i += 2) {
    out.push(String.fromCharCode(parseInt(hex.slice(i, i+2), 16) ^ ANSWER_KEY));
  }
  return out.join('');
}

    // V3.4-AUDIT5: aria-live announce helpe
// 跟 cycle 4 嘅 aria-live-alerts 元素復用，避免多個 live region 衝突
    // V3.5-AUDIT7-F08: debounce 300ms — avo
// 喺 screen-reader 堆積兩個 message，trailing-edge 合併成一個。對中度學生
// 特別重要：佢哋需要時間消化上一句 feedback，唔可以兩個 message 同時 fire。
const A11Y_ANNOUNCE_DEBOUNCE_MS = 300;
let _a11yAnnounceTimer = null;
let _a11yAnnouncePending = null;
function announceToA11y(msg) {
  if (!msg) return;
  _a11yAnnouncePending = msg;
  if (_a11yAnnounceTimer) return;  // 已經有 pending — 等 timer fire
  _a11yAnnounceTimer = setTimeout(() => {
    const text = _a11yAnnouncePending;
    _a11yAnnouncePending = null;
    _a11yAnnounceTimer = null;
    let live = $('aria-live-alerts');
    if (!live) {
      live = document.createElement('div');
      live.id = 'aria-live-alerts';
      live.setAttribute('aria-live', 'polite');  // polite 適合答題 feedback (唔打斷 user)
      live.setAttribute('aria-atomic', 'true');
      live.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
      document.body.appendChild(live);
    }
    // 清空再寫先 — 確保 screen-reader 視為新 message (相同 text 唔 fire)
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 50);
  }, A11Y_ANNOUNCE_DEBOUNCE_MS);
}

/* ============== [7] Event handlers / 主流程 ============== */

// 用嚟 detect boss 過 threshold 嗰下播 hpTick
function s_prevRagePct() {
  return (Game.state.bossHp / Game.state.bossMaxHp) * 100;
}

// 角色人物動畫 — 加 class 短暫然後移除
function charAnimate(team, action) {
  const el = document.getElementById(`${team}-character`);
  if (!el) return;
  el.classList.remove('attacking', 'ulting', 'hurting');
  void el.offsetWidth;
  el.classList.add(action);
  // 重設 idle animation
  setTimeout(() => {
    el.classList.remove(action);
    // 加返 idle class
    void el.offsetWidth;
  }, action === 'ulting' ? 1200 : (action === 'hurting' ? 400 : 500));
}

// 菜單互動 --------------------------------------------------
    // V3.4-AUDIT-FIX: hoisted slider + disp
// 會被 teacher reset (line 3990) 同 dev probe (line 4532) 喺 setupMenu 外面 call，
// 入面 btn.onclick 用 slider/display 會 throw ReferenceError。
const slider = $('hp-slider');
const display = $('hp-display');

// V3.6-SEN hoist out of setupMenu — startGame + Snapshot.resume call this.
// Nested inside setupMenu → ReferenceError → blank SEN screen (running=true, no Q).
let _senScreenWired = false;
function _wireSENScreen() {
  if (_senScreenWired) return;
  _senScreenWired = true;
  const backBtn = $('sen-btn-back');
  if (backBtn) backBtn.onclick = () => {
    TTS.cancel();
    Game.state.running = false;
    Game.state.paused = false;
    Game.state.ended = false;
    if (window._mgLoop) { clearInterval(window._mgLoop); window._mgLoop = null; }
    Audio.stopBGM();
    Snapshot.clear();
    const sen = $('screen-game-sen'); if (sen) sen.classList.add('hidden');
    const game = $('screen-game'); if (game) game.classList.add('hidden');
    const menu = $('screen-menu'); if (menu) menu.classList.remove('hidden');
  };
  ['knight', 'mage'].forEach(tm => {
    const hintBtn = $(`sen-hint-${tm}`);
    if (hintBtn) {
      hintBtn.onclick = () => {
        const q = Game.state.current[tm];
        if (!q) return;
        const maxL = Math.max(1, Math.min(4, Number(Game.settings.hintMaxLevel) || 4));
        const cur = Game.state.hintLevel[tm] || 0;
        if (cur >= maxL) return;
        const next = cur + 1;
        Game.state.hintLevel[tm] = next;
        const text = _easyHintText(q, next);
        UI._senShowHint(text, tm);
        if (Game.settings.ttsEnabled !== false && TTS && TTS.speak) TTS.speak(text, null, {});
        UI.refreshSENScreen();
      };
    }
    const ttsBtn = $(`sen-tts-${tm}`);
    if (ttsBtn) {
      ttsBtn.onclick = () => {
        const q = Game.state.current[tm];
        if (!q) return;
        const text = (q.parts ? q.parts.join('') : q.text) || '';
        if (text) TTS.speak(text, ttsBtn, {});
      };
    }
  });
}

function setupMenu() {
  // P1-C: Boss 選擇列表 — 從 Profile 解鎖狀態渲染
  renderBossSelect();

  // identity cards (圖選花名，唔強制打字) + playLayout solo/dual
  const IDENTITIES = [
    { id: 'cat', emoji: '🐱', name: '小貓' },
    { id: 'dog', emoji: '🐶', name: '小狗' },
    { id: 'bear', emoji: '🐻', name: '小熊' },
    { id: 'rabbit', emoji: '🐰', name: '小兔' },
    { id: 'panda', emoji: '🐼', name: '熊貓' },
    { id: 'fox', emoji: '🦊', name: '小狐' },
    { id: 'chick', emoji: '🐥', name: '小雞' },
    { id: 'star', emoji: '⭐', name: '星星' },
  ];
  const fillIdentityBox = (boxId, side) => {
    const box = $(boxId);
    if (!box) return;
    box.innerHTML = '';
    const curId = side === 'right' ? Game.settings.playerIdRight : Game.settings.playerId;
    IDENTITIES.forEach(id => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'id-card';
      b.dataset.id = id.id;
      b.setAttribute('role', 'radio');
      const selected = curId === id.id;
      b.setAttribute('aria-checked', selected ? 'true' : 'false');
      if (selected) b.classList.add('opt-selected');
      b.innerHTML = `<span class="id-emoji">${id.emoji}</span><span class="id-name">${id.name}</span>`;
      b.setAttribute('aria-label', id.name);
      b.onclick = () => {
        if (side === 'right') {
          Game.settings.playerIdRight = id.id;
          Game.settings.playerLabelRight = `${id.emoji} ${id.name}`;
          try { localStorage.setItem('mg2.playerIdRight', id.id); } catch (_) {}
        } else {
          Game.settings.playerId = id.id;
          Game.settings.playerLabel = `${id.emoji} ${id.name}`;
          try { localStorage.setItem('mg2.playerId', id.id); } catch (_) {}
          const h = $('identity-helper');
          if (h) h.textContent = `已選：${Game.settings.playerLabel}`;
        }
        renderAllIdentities();
      };
      box.appendChild(b);
    });
  };
  const renderAllIdentities = () => {
    fillIdentityBox('identity-picker', 'left');
    fillIdentityBox('identity-picker-left', 'left');
    fillIdentityBox('identity-picker-right', 'right');
  };
  const syncPlayLayoutUI = () => {
    const dual = Game.settings.playLayout === 'dual';
    document.querySelectorAll('.opt-play').forEach(x => {
      const on = x.dataset.play === Game.settings.playLayout;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.opt-play-boss').forEach(x => {
      const on = x.dataset.play === Game.settings.playLayout;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const soloW = $('identity-solo-wrap');
    const dualW = $('identity-dual-wrap');
    if (soloW) soloW.classList.toggle('hidden', dual);
    if (dualW) {
      dualW.classList.toggle('hidden', !dual);
      dualW.classList.toggle('grid', dual);
    }
    // dual 4-in-1 + solo mini-games
    const dualWrap = $('dual-options-wrap');
    if (dualWrap) dualWrap.classList.toggle('hidden', !dual);
    const soloWrap = $('solo-options-wrap');
    if (soloWrap) soloWrap.classList.toggle('hidden', dual);
    const arenaMode = Game.settings.dualTeam === 'coop' ? 'coop' : 'versus';
    Game.settings.dualTeam = arenaMode;
    let skinMode = Game.settings.arenaSkin === 'classic' ? 'classic' : 'retro';
    if (!dual) {
      const sm = Game.settings.soloMode === 'boat' ? 'boat'
        : (Game.settings.soloMode === 'ruler' ? 'ruler' : 'bridge');
      Game.settings.soloMode = sm;
      skinMode = sm === 'boat' ? 'classic' : 'retro';
      Game.settings.arenaSkin = skinMode;
    } else {
      Game.settings.arenaSkin = skinMode;
    }
    document.querySelectorAll('.opt-dual-combo').forEach(x => {
      const on = x.dataset.arena === arenaMode && x.dataset.skin === skinMode;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.opt-solo-skin').forEach(x => {
      const on = x.dataset.soloMode === Game.settings.soloMode;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // keep hidden lock-in arena/skin in sync with dualTeam
    document.querySelectorAll('.opt-arena').forEach(x => {
      const on = x.dataset.arena === arenaMode;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.opt-skin').forEach(x => {
      const on = x.dataset.skin === skinMode;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // Boss「打怪方式」跟 Game.settings.team（唔同 dualTeam）
    document.querySelectorAll('.opt-team').forEach(x => {
      const on = x.dataset.team === (Game.settings.team === 'versus' ? 'versus' : 'coop');
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const ph = $('play-helper');
    if (ph) {
      if (!dual) {
        const sm = Game.settings.soloMode;
        if (sm === 'boat') ph.textContent = '單人推船：答對船前進，10 題埋岸。';
        else if (sm === 'ruler') ph.textContent = '單人拉力：答對拉尺去終點，10 題完。';
        else ph.textContent = '單人鋪路：答對加一格橋，10 題過橋。';
      } else if (arenaMode === 'coop' && skinMode === 'retro') ph.textContent = '復古鋪路：左藍右紫同時答，答對加一格橋，兩邊各 10 題一齊過橋。';
      else if (arenaMode === 'coop') ph.textContent = '合作推船：左藍右紫同時答，答對船前進，兩邊各 10 題一齊埋島。';
      else if (skinMode === 'retro') ph.textContent = '復古扯尺：左藍右紫同時答，答對就拉尺，兩邊各 10 題比邊邊贏。';
      else ph.textContent = '對戰扯大欖：左藍右紫同時答，答對就拉繩，兩邊各 10 題比邊邊贏。';
    }
    const bph = $('boss-play-hint');
    if (bph) bph.textContent = dual ? '而家：👥 雙隊打王' : '而家：🧍 單人打王';
    // one-line start summary
    const n = (Game.settings.scopes && Game.settings.scopes.length) || 4;
    const scopeNames = {
      count20: '數數', compareLength: '長短', compareHeight: '高矮', orderAsc20: '順序', orderDesc20: '倒序',
      learnL: '學L', findLDrink: '找L飲', findLItem: '找L物'
    };
    const scopeBits = (Game.settings.scopes || []).map(id => scopeNames[id] || id).filter(Boolean);
    const scopeTxt = scopeBits.length ? scopeBits.join('+') : `${n}範疇`;
    let playTxt = '單人';
    if (!dual) {
      if (Game.settings.soloMode === 'boat') playTxt = '單人·推船';
      else if (Game.settings.soloMode === 'ruler') playTxt = '單人·拉力尺';
      else playTxt = '單人·鋪路';
    } else if (arenaMode === 'coop' && skinMode === 'retro') playTxt = '雙隊·合作·復古橋';
    else if (arenaMode === 'coop') playTxt = '雙隊·合作·推船';
    else if (skinMode === 'retro') playTxt = '雙隊·對戰·復古尺';
    else playTxt = '雙隊·對戰·扯大欖';
    const summary = `${playTxt} · ${scopeTxt} · ${dual ? '各 10 題' : '10 題'}`;
    const sub = $('easy-start-sub');
    if (sub) sub.textContent = summary;
    const sumEl = $('class-start-summary');
    if (sumEl) sumEl.textContent = `將會係：${summary}`;
    let emoji = '🌼';
    if (!dual) {
      if (Game.settings.soloMode === 'boat') emoji = '🚢';
      else if (Game.settings.soloMode === 'ruler') emoji = '📏';
      else emoji = '🌉';
    } else if (arenaMode === 'coop' && skinMode === 'retro') emoji = '🌉';
    else if (arenaMode === 'coop') emoji = '🚢';
    else if (skinMode === 'retro') emoji = '📏';
    else emoji = '🪢';
    const em = $('class-start-emoji');
    if (em) em.textContent = emoji;
    const plab = $('class-start-preview-label');
    if (plab) plab.textContent = playTxt;
  };
  try {
    const saved = localStorage.getItem('mg2.playerId');
    const hit = IDENTITIES.find(x => x.id === saved);
    if (hit) {
      Game.settings.playerId = hit.id;
      Game.settings.playerLabel = `${hit.emoji} ${hit.name}`;
    }
    const savedR = localStorage.getItem('mg2.playerIdRight');
    const hitR = IDENTITIES.find(x => x.id === savedR);
    if (hitR) {
      Game.settings.playerIdRight = hitR.id;
      Game.settings.playerLabelRight = `${hitR.emoji} ${hitR.name}`;
    }
    const savedPlay = localStorage.getItem('mg2.playLayout');
    if (savedPlay === 'solo' || savedPlay === 'dual') Game.settings.playLayout = savedPlay;
  } catch (_) {}
  renderAllIdentities();
  if (Game.settings.playerId) {
    const h = $('identity-helper');
    if (h) h.textContent = `已選：${Game.settings.playerLabel}`;
  }
  document.querySelectorAll('.opt-play').forEach(b => {
    b.onclick = () => {
      Game.settings.playLayout = b.dataset.play === 'dual' ? 'dual' : 'solo';
      try { localStorage.setItem('mg2.playLayout', Game.settings.playLayout); } catch (_) {}
      // dual 首次：預設 versus+retro（有存檔跟存檔）
      if (Game.settings.playLayout === 'dual') {
        let saved = null;
        let savedSkin = null;
        try { saved = localStorage.getItem('mg2.dualArena'); } catch (_) {}
        try { savedSkin = localStorage.getItem('mg2.arenaSkin'); } catch (_) {}
        if (saved === 'coop' || saved === 'versus') Game.settings.dualTeam = saved;
        else Game.settings.dualTeam = 'versus';
        if (savedSkin === 'classic' || savedSkin === 'retro') Game.settings.arenaSkin = savedSkin;
        else Game.settings.arenaSkin = 'retro';
      }
      syncPlayLayoutUI();
    };
  });
  document.querySelectorAll('.opt-play-boss').forEach(b => {
    b.onclick = () => {
      Game.settings.playLayout = b.dataset.play === 'dual' ? 'dual' : 'solo';
      try { localStorage.setItem('mg2.playLayout', Game.settings.playLayout); } catch (_) {}
      if (Game.settings.playLayout === 'dual') {
        let saved = null;
        try { saved = localStorage.getItem('mg2.dualArena'); } catch (_) {}
        if (saved === 'coop' || saved === 'versus') Game.settings.dualTeam = saved;
        else Game.settings.dualTeam = 'versus';
      }
      syncPlayLayoutUI();
    };
  });
  const idToggle = $('btn-identity-toggle');
  const idBody = $('identity-body');
  if (idToggle && idBody) {
    idToggle.onclick = () => {
      const open = idBody.classList.toggle('hidden') === false;
      idToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
  }
  document.querySelectorAll('.opt-dual-combo').forEach(b => {
    b.onclick = () => {
      Game.settings.dualTeam = b.dataset.arena === 'coop' ? 'coop' : 'versus';
      Game.settings.arenaSkin = b.dataset.skin === 'classic' ? 'classic' : 'retro';
      try {
        localStorage.setItem('mg2.dualArena', Game.settings.dualTeam);
        localStorage.setItem('mg2.arenaSkin', Game.settings.arenaSkin);
      } catch (_) {}
      syncPlayLayoutUI();
    };
  });
  document.querySelectorAll('.opt-solo-skin').forEach(b => {
    b.onclick = () => {
      const sm = b.dataset.soloMode === 'boat' ? 'boat'
        : (b.dataset.soloMode === 'ruler' ? 'ruler' : 'bridge');
      Game.settings.soloMode = sm;
      Game.settings.arenaSkin = sm === 'boat' ? 'classic' : 'retro';
      try {
        localStorage.setItem('mg2.soloMode', sm);
        localStorage.setItem('mg2.arenaSkin', Game.settings.arenaSkin);
      } catch (_) {}
      syncPlayLayoutUI();
    };
  });
  try {
    const savedSolo = localStorage.getItem('mg2.soloMode');
    if (savedSolo === 'boat' || savedSolo === 'bridge' || savedSolo === 'ruler') {
      Game.settings.soloMode = savedSolo;
    }
  } catch (_) {}
  // legacy hidden pickers still clickable for tests / a11y hooks
  document.querySelectorAll('.opt-arena').forEach(b => {
    b.onclick = () => {
      Game.settings.dualTeam = b.dataset.arena === 'coop' ? 'coop' : 'versus';
      try { localStorage.setItem('mg2.dualArena', Game.settings.dualTeam); } catch (_) {}
      syncPlayLayoutUI();
    };
  });
  document.querySelectorAll('.opt-skin').forEach(b => {
    b.onclick = () => {
      Game.settings.arenaSkin = b.dataset.skin === 'classic' ? 'classic' : 'retro';
      try { localStorage.setItem('mg2.arenaSkin', Game.settings.arenaSkin); } catch (_) {}
      syncPlayLayoutUI();
    };
  });
  try {
    const savedArena = localStorage.getItem('mg2.dualArena');
    if (savedArena === 'coop' || savedArena === 'versus') Game.settings.dualTeam = savedArena;
  } catch (_) {}
  try {
    const savedSkin = localStorage.getItem('mg2.arenaSkin');
    if (savedSkin === 'classic' || savedSkin === 'retro') Game.settings.arenaSkin = savedSkin;
    else {
      const sc = Game.settings.scopes || [];
      if (sc.length === 1 && sc[0] === 'compareLength') Game.settings.arenaSkin = 'retro';
    }
  } catch (_) {}
  syncPlayLayoutUI();

  // menu tracks — always open on 課堂; Boss 唔持久化
  let advancedForcedOpen = true;
  const syncMenuTrack = () => {
    const track = Game.settings.menuTrack === 'boss' ? 'boss' : 'class';
    Game.settings.menuTrack = track;
    document.querySelectorAll('.opt-track').forEach(x => {
      const on = x.dataset.track === track;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const classP = $('menu-class-panel');
    const bossP = $('menu-boss-panel');
    if (classP) classP.classList.toggle('hidden', track !== 'class');
    if (bossP) bossP.classList.toggle('hidden', track !== 'boss');
    const th = $('menu-track-helper');
    if (th) {
      th.textContent = track === 'class'
        ? '課堂：①玩法 → ②身份 → ③題目 → 睇摘要 → 一鍵開始。'
        : 'Boss：老師打怪設定。返主頁會停喺課堂練習。';
    }
    try { localStorage.removeItem('mg2.menuTrack'); } catch (_) {}
  };
  const syncMenuAdvanced = () => {
    const adv = $('menu-advanced');
    const tog = $('btn-menu-advanced-toggle');
    if (!adv) return;
    const onBoss = Game.settings.menuTrack === 'boss';
    const hide = onBoss ? !advancedForcedOpen : true;
    adv.classList.toggle('hidden', hide);
    if (tog) {
      tog.classList.toggle('hidden', !onBoss);
      tog.setAttribute('aria-expanded', hide ? 'false' : 'true');
      tog.textContent = hide
        ? '⚙️ 進階設定（老師覆寫 · 一鍵仍跟範疇）'
        : '⚙️ 收起進階設定（老師覆寫 · 一鍵仍跟範疇）';
    }
  };
  document.querySelectorAll('.opt-track').forEach(b => {
    b.onclick = () => {
      Game.settings.menuTrack = b.dataset.track === 'boss' ? 'boss' : 'class';
      if (Game.settings.menuTrack === 'boss') {
        advancedForcedOpen = true;
        if (Game.settings.difficulty !== 'easy') {
          Game.settings.difficulty = 'normal';
          document.querySelectorAll('.opt-difficulty').forEach(x => {
            const on = x.dataset.diff === 'normal';
            x.classList.toggle('opt-selected', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        }
      }
      syncMenuTrack();
      syncMenuAdvanced();
      if (typeof syncPlayLayoutUI === 'function') syncPlayLayoutUI();
    };
  });
  Game.settings.menuTrack = 'class';
  const advToggle = $('btn-menu-advanced-toggle');
  if (advToggle) {
    advToggle.onclick = () => {
      advancedForcedOpen = !advancedForcedOpen;
      if (Game.settings.menuTrack !== 'boss') advancedForcedOpen = true;
      syncMenuAdvanced();
    };
  }
  syncMenuTrack();
  syncMenuAdvanced();

  // 勝利條件
  document.querySelectorAll('.opt-win').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.opt-win').forEach(x => {
        x.classList.remove('opt-selected');
        x.setAttribute('aria-pressed', 'false');  // V3.4-AUDIT5: sync aria-pressed (P2)
      });
      b.classList.add('opt-selected');
      b.setAttribute('aria-pressed', 'true');
      Game.settings.win = b.dataset.win;
      $('time-input-row').classList.toggle('hidden', Game.settings.win !== 'time');
    };
  });
  // 答題模式
  document.querySelectorAll('.opt-mode').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.opt-mode').forEach(x => {
        x.classList.remove('opt-selected');
        x.setAttribute('aria-pressed', 'false');  // V3.4-AUDIT5: sync aria-pressed (P2)
      });
      b.classList.add('opt-selected');
      b.setAttribute('aria-pressed', 'true');
      Game.settings.mode = b.dataset.mode;
      updateModeHelper();  // v3.2: helper 跟 mode 變
    };
  });
  // 難度
  document.querySelectorAll('.opt-difficulty').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.opt-difficulty').forEach(x => {
        x.classList.remove('opt-selected');
        x.setAttribute('aria-pressed', 'false');
      });
      b.classList.add('opt-selected');
      b.setAttribute('aria-pressed', 'true');
      Game.settings.difficulty = b.dataset.diff;
      // V3.6-SEN: easy mode locks to choice — auto-switch + disable keypad
      const isEasy = b.dataset.diff === 'easy';
      if (isEasy && Game.settings.mode !== 'choice') {
        Game.settings.mode = 'choice';
        document.querySelectorAll('.opt-mode').forEach(x => {
          x.classList.remove('opt-selected');
          x.setAttribute('aria-pressed', 'false');
          if (x.dataset.mode === 'choice') {
            x.classList.add('opt-selected');
            x.setAttribute('aria-pressed', 'true');
          }
        });
        updateModeHelper();
      }
      document.querySelectorAll('.opt-mode[data-mode="keypad"]').forEach(kb => {
        kb.disabled = isEasy;
        kb.classList.toggle('opacity-40', isEasy);
        kb.setAttribute('aria-disabled', String(isEasy));
      });
      // easy on boss track can collapse advanced; class track ignores
      if (isEasy) advancedForcedOpen = false;
      else advancedForcedOpen = true;
      if (Game.settings.menuTrack === 'boss') syncMenuAdvanced();
      const dh = $('diff-helper');
      if (dh) {
        dh.textContent = isEasy
          ? '簡單模式：跟題目範疇 · 10 題 · 大掣 A/B/C'
          : '普通模式：4 選一、可用鍵盤、Boss 戰役';
      }
    };
  });
  function syncScopeUI() {
    const scopes = Array.isArray(Game.settings.scopes) ? Game.settings.scopes.slice() : DEFAULT_SCOPES.slice();
    const valid = scopes.filter(id => TYPE_REGISTRY[id]);
    Game.settings.scopes = valid.length ? valid : DEFAULT_SCOPES.slice();
    document.querySelectorAll('.opt-scope').forEach(btn => {
      const on = Game.settings.scopes.includes(btn.dataset.scope);
      btn.classList.toggle('opt-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const s = Game.settings.scopes.slice().sort().join(',');
    const preset =
      s === 'count20' ? 'count' :
      s === 'compareLength' ? 'length' :
      s === 'compareHeight' ? 'height' :
      s === 'learnL,findLDrink,findLItem' ? 'capacity' :
      (s === DEFAULT_SCOPES.slice().sort().join(',')) ? 'all' :
      null;
    document.querySelectorAll('.opt-scope-preset').forEach(btn => {
      const on = preset && btn.dataset.scopePreset === preset;
      btn.classList.toggle('opt-selected', !!on);
    });
    const helper = $('scope-helper');
    if (helper) helper.textContent = `已選 ${Game.settings.scopes.length} 個範疇 · 撳掣可開關（最少 1 個）`;
    // keep dual arena subtitle (對戰/合作) — don't flatten to bare「雙隊」
    if (typeof syncPlayLayoutUI === 'function') syncPlayLayoutUI();
    else {
      const sub = $('easy-start-sub');
      if (sub) {
        const play = Game.settings.playLayout === 'dual' ? '雙隊' : '單人';
        sub.textContent = `${play} · ${Game.settings.scopes.length} 個範疇 · 10 題`;
      }
    }
  }
  const scopePicker = $('scope-picker');
  if (scopePicker) scopePicker.onclick = (e) => {
    const b = e.target.closest('.opt-scope');
    if (!b || !b.dataset.scope) return;
    const id = b.dataset.scope;
    if (!TYPE_REGISTRY[id]) return;
    if (!Array.isArray(Game.settings.scopes)) Game.settings.scopes = DEFAULT_SCOPES.slice();
    const i = Game.settings.scopes.indexOf(id);
    if (i >= 0) {
      if (Game.settings.scopes.length <= 1) return; // keep ≥1
      Game.settings.scopes.splice(i, 1);
    } else {
      Game.settings.scopes.push(id);
    }
    try { localStorage.setItem('mg2.scopes', JSON.stringify(Game.settings.scopes)); } catch (_) {}
    syncScopeUI();
  };
  // scope presets 只數數 / 只長短 / 只高矮 / 只容量 / 全部
  document.querySelectorAll('.opt-scope-preset').forEach(btn => {
    btn.onclick = () => {
      const p = btn.dataset.scopePreset;
      const labelMap = { count:'🔢 只數數', length:'📏 只長短', height:'↕️ 只高矮', capacity:'🧃 只容量', all:'✨ 全部' };
      if (p === 'count') Game.settings.scopes = ['count20'];
      else if (p === 'length') Game.settings.scopes = ['compareLength'];
      else if (p === 'height') Game.settings.scopes = ['compareHeight'];
      else if (p === 'capacity') Game.settings.scopes = ['learnL', 'findLDrink', 'findLItem'];
      else Game.settings.scopes = DEFAULT_SCOPES.slice();
      try { localStorage.setItem('mg2.scopes', JSON.stringify(Game.settings.scopes)); } catch (_) {}
      syncScopeUI();
      _presetToast(`已切到 ${labelMap[p] || p} · ${Game.settings.scopes.length} 個範疇`);
    };
  });
  function _presetToast(msg) {
    let t = $('preset-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'preset-toast';
      t.setAttribute('role', 'status');
      t.style.cssText = 'position:fixed;left:50%;top:1.2rem;transform:translateX(-50%);z-index:85;background:rgba(15,23,42,0.92);color:#fef3c7;padding:0.5rem 1.1rem;border-radius:9999px;font-weight:800;font-size:0.95rem;box-shadow:0 4px 16px rgba(0,0,0,0.3);pointer-events:none;opacity:0;transition:opacity 0.2s;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    if (t._clearTimer) clearTimeout(t._clearTimer);
    t._clearTimer = setTimeout(() => { t.style.opacity = '0'; }, 1400);
  }
  // restore scopes
  try {
    const raw = localStorage.getItem('mg2.scopes');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        Game.settings.scopes = parsed.filter(id => TYPE_REGISTRY[id]);
      }
    }
  } catch (_) {}
  if (!Game.settings.scopes || !Game.settings.scopes.length) {
    Game.settings.scopes = DEFAULT_SCOPES.slice();
  }
  syncScopeUI();

  // V3.6-SEN: 簡單練習一鍵開始 preset
  const easyStartBtn = $('btn-easy-start');
  if (easyStartBtn) easyStartBtn.onclick = () => {
    // 1. Set easy difficulty
    Game.settings.difficulty = 'easy';
    document.querySelectorAll('.opt-difficulty').forEach(x => {
      x.classList.remove('opt-selected');
      x.setAttribute('aria-pressed', 'false');
      if (x.dataset.diff === 'easy') {
        x.classList.add('opt-selected');
        x.setAttribute('aria-pressed', 'true');
      }
    });
    advancedForcedOpen = false;
    syncMenuAdvanced();
    const dh = $('diff-helper');
    if (dh) dh.textContent = '簡單模式：跟主頁範疇出題、少選項、答 10 題完';
    // 2. Lock to choice mode
    Game.settings.mode = 'choice';
    document.querySelectorAll('.opt-mode').forEach(x => {
      x.classList.remove('opt-selected');
      x.setAttribute('aria-pressed', 'false');
      if (x.dataset.mode === 'choice') {
        x.classList.add('opt-selected');
        x.setAttribute('aria-pressed', 'true');
      }
    });
    updateModeHelper();
    document.querySelectorAll('.opt-mode[data-mode="keypad"]').forEach(kb => {
      kb.disabled = true;
      kb.classList.add('opacity-40');
      kb.setAttribute('aria-disabled', 'true');
    });
    // 3. Lock HP to minimum (60)
    Game.settings.initialBossHp = 60;
    slider.value = 60;
    display.textContent = '60';
    slider.setAttribute('aria-valuenow', '60');
    slider.setAttribute('aria-valuetext', 'Boss 初始生命值 60，範圍 60 至 500');
    // 4. Team / arena mode
    // dual: keep dualTeam pick；solo: coop 無對戰意義
    if (Game.settings.playLayout === 'dual') {
      let arena = Game.settings.dualTeam;
      if (arena !== 'versus' && arena !== 'coop') {
        try { arena = localStorage.getItem('mg2.dualArena'); } catch (_) { arena = null; }
      }
      Game.settings.dualTeam = (arena === 'coop') ? 'coop' : 'versus';
      Game.settings.team = (arena === 'coop') ? 'coop' : 'versus'; // easy dual uses team for arena math
      try { localStorage.setItem('mg2.dualArena', Game.settings.dualTeam); } catch (_) {}
    } else {
      Game.settings.team = 'coop';
    }
    document.querySelectorAll('.opt-team').forEach(x => {
      const on = x.dataset.team === Game.settings.team;
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.opt-arena').forEach(x => {
      const on = x.dataset.arena === (Game.settings.dualTeam === 'coop' ? 'coop' : 'versus');
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // 5. Types = selected home scopes ()
    const scopes = (Game.settings.scopes || []).filter(id => TYPE_REGISTRY[id]);
    const senTypes = scopes.length ? scopes.slice() : DEFAULT_SCOPES.slice();
    Game.settings.scopes = senTypes;
    Game.settings.types = senTypes.slice();
    syncScopeUI();
    renderTypePicker();
    renderRecommendChips();
    updateTypeCount();
    // 6. Easy practice ends by question count (not boss HP)
    Game.settings.win = 'hp'; // kept for settings shape; startGame forces easyGoalTotal
    // 7. One-click: preset + start immediately (true one-tap for moderate ID)
    easyStartBtn.style.transform = 'scale(0.97)';
    setTimeout(() => { easyStartBtn.style.transform = ''; }, 200);
    if (!localStorage.getItem('mg2.onboardingDone')) {
      showOnboarding(() => {
        localStorage.setItem('mg2.onboardingDone', '1');
        startGame();
      });
    } else {
      startGame();
    }
  };
  const quickStartFab = $('btn-quick-start');
  if (quickStartFab) quickStartFab.onclick = () => {
    // guard against double-trigger while onboarding showing
    if (document.querySelector('.onboarding-overlay, .modal-backdrop:not(.hidden)')) return;
    $('btn-easy-start').click();
  };
  // 題型（可多選，至少一個）— v3.1 dynamic picker via delegation
  renderTypePicker();
  renderRecommendChips();   // chips row
  const picker = $('type-picker');
  if (picker) picker.onclick = (e) => {
    const b = e.target.closest('.opt-type');
    if (!b) return;
    const t = b.dataset.type;
    if (!TYPE_REGISTRY[t]) return;
    const i = Game.settings.types.indexOf(t);
    if (i >= 0) {
      if (Game.settings.types.length > 1) {
        Game.settings.types.splice(i, 1);
        b.classList.remove('opt-selected');
        b.setAttribute('aria-pressed', 'false');  // V3.4-AUDIT5: sync aria-pressed (P2)
      }
    } else {
      Game.settings.types.push(t);
      b.classList.add('opt-selected');
      b.setAttribute('aria-pressed', 'true');
    }
    updateTypeCount();
    updateModeHelper();  // v3.2: helper 跟 selected types 變
  };
  $('btn-type-all').onclick = () => {
    Game.settings.types = Object.keys(TYPE_REGISTRY);
    renderTypePicker();
    renderRecommendChips();   // sync chips
    updateTypeCount();
    updateModeHelper();
  };
  $('btn-type-none').onclick = () => {
    Game.settings.types = ['add10'];  // 至少一個 fallback
    renderTypePicker();
    renderRecommendChips();   // sync chips
    updateTypeCount();
    updateModeHelper();
  };
  updateTypeCount();
  updateModeHelper();  // v3.2: 初始 render
  // 隊伍模式
  document.querySelectorAll('.opt-team').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.opt-team').forEach(x => {
        x.classList.remove('opt-selected');
        x.setAttribute('aria-pressed', 'false');  // V3.4-AUDIT5: sync aria-pressed (P2)
      });
      b.classList.add('opt-selected');
      b.setAttribute('aria-pressed', 'true');
      Game.settings.team = b.dataset.team;
      // cycle66: Boss「打怪方式」唔寫入 dualArena（避免污染課堂雙隊）
      if (typeof syncPlayLayoutUI === 'function') syncPlayLayoutUI();
    };
  });
  // HP slider (V3.4-AUDIT-FIX: slider/display 已 hoisted 到 module scope)
  slider.addEventListener('input', () => {
    Game.settings.initialBossHp = parseInt(slider.value, 10);
    display.textContent = slider.value;
    // V3.4-AUDIT4: aria-valuenow 同步 — scree
    slider.setAttribute('aria-valuenow', slider.value);
    // V3.4-AUDIT5: aria-valuetext includes 
    slider.setAttribute('aria-valuetext', `Boss 初始生命值 ${slider.value}，範圍 ${slider.min} 至 ${slider.max}`);
  });
  // V3.6-SEN: init — if easy already saved, disable keypad
  if (Game.settings.difficulty === 'easy') {
    document.querySelectorAll('.opt-mode[data-mode="keypad"]').forEach(kb => {
      kb.disabled = true;
      kb.classList.add('opacity-40');
      kb.setAttribute('aria-disabled', 'true');
    });
  }
  // 開始
  $('btn-start').onclick = () => {
    // cycle66: Boss 戰役必須 normal — 避免上次 easy 殘留 → 無 boss 畫面
    Game.settings.difficulty = 'normal';
    Game.settings.menuTrack = 'boss';
    document.querySelectorAll('.opt-difficulty').forEach(x => {
      const on = x.dataset.diff === 'normal';
      x.classList.toggle('opt-selected', on);
      x.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (!Bosses.current) {
      const first = (Bosses.available && Bosses.available()[0]) || Bosses.list[0];
      if (first) {
        if (typeof Bosses.selectById === 'function') Bosses.selectById(first.id);
        if (!Bosses.current) Bosses.current = first;
      }
    }
    advancedForcedOpen = true;
    if (typeof syncMenuTrack === 'function') syncMenuTrack();
    // V3.3-U1: first-run onboarding tutorial
    if (!localStorage.getItem('mg2.onboardingDone')) {
      showOnboarding(() => {
        localStorage.setItem('mg2.onboardingDone', '1');
        startGame();
      });
    } else {
      startGame();
    }
  };

// V3.3-U1: 3-step onboarding tutorial
// (note: nested in setupMenu is OK — only btn-start / easy-start call it)
function showOnboarding(onComplete) {
  const steps = [
    {
      title: '👀 第一步：睇圖',
      body: '畫面會有圖或者棒棒。' +
            '\n慢慢睇清楚，唔使急。'
    },
    {
      title: '👆 第二步：撳 A／B／C',
      body: '每個答案有大圓字母。' +
            '\n可以用手指指字母，或者自己撳掣。'
    },
    {
      title: '⭐ 第三步：完成 10 題',
      body: '答啱會有獎勵。' +
            '\n完成 10 題就有金銀銅獎！'
    }
  ];
  let i = 0;
  let overlay = $('onboarding-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'modal-backdrop flex items-center justify-center p-4';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:95';
    document.body.appendChild(overlay);
  }
  function render() {
    const s = steps[i];
    overlay.innerHTML = `
      <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-full border-2 border-amber-500/50 shadow-2xl">
        <div class="text-center mb-4">
          <div class="text-xs text-on-night-muted mb-2">第 ${i+1} / ${steps.length} 步</div>
          <h2 class="text-2xl font-bold text-amber-300 mb-3">${s.title}</h2>
        </div>
        <p class="text-white/85 text-base mb-6 leading-relaxed whitespace-pre-line">${s.body}</p>
        <div class="flex gap-3">
          ${i > 0 ? '<button id="ob-back" class="btn btn-ghost flex-1">← 上一步</button>' : '<button id="ob-skip" class="btn btn-ghost flex-1">跳過</button>'}
          <button id="ob-next" class="btn btn-knight flex-1">${i === steps.length-1 ? '開始 🎮' : '下一步 →'}</button>
        </div>
        <div class="flex justify-center gap-1 mt-4">
          ${steps.map((_, idx) => `<div class="w-2 h-2 rounded-full ${idx === i ? 'bg-amber-400' : 'bg-white/30'}"></div>`).join('')}
        </div>
      </div>`;
    const back = $('ob-back'); if (back) back.onclick = () => { i--; render(); };
    const skip = $('ob-skip'); if (skip) skip.onclick = () => { overlay.remove(); onComplete(); };
    $('ob-next').onclick = () => {
      if (i === steps.length-1) { overlay.remove(); onComplete(); }
      else { i++; render(); }
    };
  }
  render();
}
}

// P1-C: Boss 選擇 renderer
function renderBossSelect() {
  const row = $('boss-select-row');
  row.innerHTML = '';
  const list = Bosses.list;
  list.forEach((boss, idx) => {
    const unlocked = Profile.isUnlocked('boss', boss.id);
    const btn = document.createElement('button');
    btn.className = 'opt-boss btn btn-ghost text-sm flex flex-col items-center gap-1 py-3 relative';
    btn.dataset.boss = boss.id;
    btn.setAttribute('aria-pressed', unlocked && Bosses.current?.id === boss.id ? 'true' : 'false');
    if (unlocked && Bosses.current?.id === boss.id) btn.classList.add('opt-selected');
    if (!unlocked) {
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    // V3.4-AUDIT4: locked boss 唔可以 keyboard
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('tabindex', '-1');
      btn.setAttribute('aria-label', `${boss.name} 未解鎖`);
    } else {
      btn.setAttribute('aria-label', `${boss.name} HP ${boss.hpDefault}`);
    }
    // P2-1: 用 AI generated hero image 取代細像素 sprite（單檔 inline base64）
    // AUDIT-REFACTOR: BOSS_HERO 已移除，always show SVG sprite
    btn.innerHTML = `
      <div class="boss-hero-wrap" style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;">
        <svg class="pixel" style="width:42px;height:42px"><use href="#${boss.sprite}"/></svg>
      </div>
      <div class="font-bold">${boss.emoji} ${boss.name}</div>
      <div class="text-xs opacity-70">${unlocked ? `HP ${boss.hpDefault}` : `🔒 ${boss.unlockHint || '未解鎖'}`}</div>
    `;
    if (unlocked) {
      btn.onclick = () => {
        if (Bosses.selectById(boss.id)) {
          // 重設 HP slider 範圍 + 預設值對應該 boss
          slider.min = boss.hpRange[0];
          slider.max = boss.hpRange[1];
          slider.value = boss.hpDefault;
          display.textContent = boss.hpDefault;
          Game.settings.initialBossHp = boss.hpDefault;
          renderBossSelect();   // 重 render selected 樣式
        }
      };
    } else {
      // locked boss button — cursor + aria-disabled + dim
      btn.setAttribute('aria-disabled', 'true');
      btn.style.cursor = 'not-allowed';
      btn.style.opacity = '0.55';
      btn.setAttribute('title', `🔒 ${boss.unlockHint || '未解鎖'} — 擊敗上一隻 Boss 解鎖`);
    }
    row.appendChild(btn);
  });
  // 預設 first unlocked
  if (!Bosses.current) {
    const first = Bosses.available()[0];
    if (first) Bosses.selectById(first.id);
  }
}

// P2-3: Boss intro cinematic — 700ms scale-up + glow 入場
let _bossIntroOverlay = null;
function showBossIntro(boss) {
  // 移除舊 overlay
  if (_bossIntroOverlay) {
    _bossIntroOverlay.remove();
    _bossIntroOverlay = null;
  }
  // AUDIT-REFACTOR: BOSS_HERO removed — show SVG sprite + name in intro overlay
  const glowColor = boss.id === 'frost-giant' ? 'rgba(96,165,250,0.7)' : 'rgba(251,191,36,0.7)';
  const sceneLabel = boss.scene === 'snow' ? '❄ 雪山場景' : '🌲 森林場景';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;animation:boss-intro-fadein 200ms ease-out;';
  overlay.innerHTML = [
    '<style>',
    '@keyframes boss-intro-fadein { from { opacity:0 } to { opacity:1 } }',
    '@keyframes boss-intro-pop { 0% { transform:scale(0.3) rotate(-12deg); opacity:0 } 60% { transform:scale(1.15) rotate(2deg); opacity:1 } 100% { transform:scale(1) rotate(0deg); opacity:1 } }',
    '@keyframes badge-in { 0% { transform:scale(0.5) translateY(8px); opacity:0 } 60% { transform:scale(1.12) translateY(-2px); opacity:1 } 100% { transform:scale(1) translateY(0); opacity:1 } }',
    '@keyframes boss-intro-text { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }',
    '@keyframes boss-intro-out { 0% { opacity:1 } 100% { opacity:0 } }',
    '.bi-svg { filter: drop-shadow(0 0 24px ' + glowColor + '); }',
    '.bi-name { font-size:1.8rem; font-weight:800; margin-top:14px; color:#fde68a; text-shadow: 0 0 12px rgba(251,191,36,0.6), 2px 2px 0 #000; animation: boss-intro-text 400ms 300ms ease-out both; }',
    '.bi-hint { font-size:0.85rem; color:rgba(255,255,255,0.6); margin-top:6px; animation: boss-intro-text 400ms 500ms ease-out both; }',
    '.bi-out { animation: boss-intro-out 350ms ease-in both !important; }',
    '</style>',
    '<svg class="bi-svg"><use href="#' + boss.sprite + '"/></svg>',
    '<div class="bi-name">⚔ 挑戰 ' + boss.emoji + ' ' + boss.name + '</div>',
    '<div class="bi-hint">HP ' + boss.hpDefault + ' · ' + sceneLabel + '</div>',
  ].join('');
  document.body.appendChild(overlay);
  _bossIntroOverlay = overlay;
  // 1100ms 後 fade out
  setTimeout(() => {
    overlay.classList.add('bi-out');
    setTimeout(() => { overlay.remove(); _bossIntroOverlay = null; }, 400);
  }, 1100);
}

    // V3.4-AUDIT2-FIX: 升到 module-scope 前段，避
// (visibilitychange handler 喺 file 較後處使用 — 必須先 hoist declare)
let _wasPlayingBGM = false;

function startGame() {
  // 校驗 — v3.1 validate against TYPE_REGISTRY
  Game.settings.types = Game.settings.types.filter(t => TYPE_REGISTRY[t]);
  if (Game.settings.types.length === 0) {
    Game.settings.types = ['add10'];
    renderTypePicker();
    renderRecommendChips();   // sync chips
  }
    // V3.5-AUDIT8-F10: 新局 reset quota flag
  Snapshot._resetQuotaFlag();
    // V3.4-AUDIT5: TTS cancel on startGame
  TTS.cancel();
  // P1-A: 記住開始時間
  Game.state.startedAt = Date.now();
  Game.state.endedAt = 0;
  if (typeof plausible === 'function') {
    plausible('game_start', { props: {
      scopes: (Game.settings.scopes || []).join(','),
      play: Game.settings.playLayout,
      difficulty: Game.settings.difficulty,
    } });
  }
    // V3.4-AUDIT2-FIX: reset timer state fl
  Game.state._startAt = 0;
  Game.state._frostTickAt = 0;
    // V3.4-AUDIT2-FIX: hide pause-overlay r
  const _po = $('pause-overlay'); if (_po) _po.classList.add('hidden');
  // V3.6-SEN: single isEasy binding for whole startGame (EASY-46 lock-in)
  const isEasy = Game.settings.difficulty === 'easy';
  // V3.6 cycle66: boss campaign must have a selected boss (never blank panel)
  if (!isEasy) {
    if (!Bosses.current) {
      const first = (Bosses.available && Bosses.available()[0]) || Bosses.list[0];
      if (first) {
        if (typeof Bosses.selectById === 'function' && Profile.isUnlocked('boss', first.id)) {
          Bosses.selectById(first.id);
        } else {
          Bosses.current = first;
        }
      }
    }
  }
  // P1-C: 套用 Bosses.current 嘅 sprite + name + scene theme
  if (Bosses.current) {
    const use = document.getElementById('boss-svg-use');
    if (use) use.setAttribute('href', '#' + Bosses.current.sprite);
    document.body.classList.remove('theme-snow');
    if (Bosses.current.scene === 'snow') document.body.classList.add('theme-snow');
    // boss name label
    const lbl = document.getElementById('boss-name-label');
    if (lbl) lbl.textContent = Bosses.current.emoji + ' ' + Bosses.current.name;
    // V3.4-AUDIT4: SVG sprite boss icon 嘅 a
    const bossIconWrap = document.getElementById('boss-icon');
    if (bossIconWrap) bossIconWrap.setAttribute('aria-label', Bosses.current.name);
    // P2-2: AI generated hero portrait 入主 game boss panel
    // AUDIT-REFACTOR: BOSS_HERO removed — always hide heroImg, show SVG sprite
    const heroImg = document.getElementById('boss-hero-portrait');
    if (heroImg) {
      heroImg.removeAttribute('src');
      heroImg.classList.add('hidden');
    }
    // P2-3: cinematic intro — skip in easy (distraction-free practice)
    if (!isEasy) showBossIntro(Bosses.current);
  }
  // V3.6-SEN: easy mode hides boss panel for distraction-free math practice
  const bossPanel = $('boss-panel');
  if (bossPanel) bossPanel.classList.toggle('hidden', isEasy);
  // V3.6-SEN: easy mode hides castle bars
  const castleRow = $('castle-bar-row');
  if (castleRow) castleRow.classList.toggle('hidden', isEasy);
  // V3.6-SEN: easy mode hides energy rows + ult buttons
  ['knight', 'mage'].forEach(tm => {
    const er = $(`${tm}-energy-row`);
    if (er) er.classList.toggle('hidden', isEasy);
  });
  // V3.6-SEN: easy mode hides question labels (keep TTS btn)
  ['knight', 'mage'].forEach(tm => {
    const ql = $(`${tm}-q-label`);
    if (ql) ql.classList.toggle('hidden', isEasy);
  });
  // V3.6-SEN: card visibility
  // easy dual = both panels; easy solo = knight; boss solo = knight only; boss dual = both
  const dualPlay = Game.settings.playLayout === 'dual';
  if (isEasy) {
    const activeTeam = Game.state.currentTeam;
    ['knight', 'mage'].forEach(tm => {
      const card = $(`${tm}-card`);
      if (!card) return;
      if (!dualPlay) card.classList.toggle('hidden', tm !== 'knight');
      else card.classList.toggle('hidden', tm !== activeTeam);
    });
  } else {
    // Boss campaign: solo hides mage board
    ['knight', 'mage'].forEach(tm => {
      const card = $(`${tm}-card`);
      if (card) card.classList.toggle('hidden', !dualPlay && tm === 'mage');
    });
  }
  // 重設 adaptive
  Adaptive.reset();
  // V3.6-SEN easy = N-question practice goal (boss HP never drops in easy)
  const _easyGoal = isEasy ? _stageGoalQuestions() : { stages: 0, target: 0, hardCap: 0 };
  Game.state.easyGoalTotal = isEasy ? _easyGoal.target : 0;
  Game.state.stagesTotal = _easyGoal.stages;
  Game.state.stage = {
    knight: { index: 0, units: 0, cleared: 0 },
    mage:   { index: 0, units: 0, cleared: 0 },
  };
  Game.state.hintLevel = { knight: 0, mage: 0 };
  Game.state.replayQ = null;
  Game.state.replayTries = 0;
  Game.state.currentTeam = 'knight';
  Game.state.hintStreakByType = {};
  Game.state.sessionStreak = 0;
  Game.state.retryMode = false;
  Game.state.retryList = [];
  Game.state.retryIndex = 0;
  Game.state.retryStreak = 0;
  Game.state._easyEnding = false;
  Game.state._easyTeamDone = { knight: false, mage: false };
  // dual keeps user team pick (versus=扯大欖 / coop=推船) via dualTeam
  // solo classroom applies soloMode → team/skin for mini-games
  if (isEasy && Game.settings.playLayout !== 'dual') {
    const sm = Game.settings.soloMode === 'boat' ? 'boat'
      : (Game.settings.soloMode === 'ruler' ? 'ruler' : 'bridge');
    Game.settings.soloMode = sm;
    if (sm === 'boat') { Game.settings.team = 'coop'; Game.settings.arenaSkin = 'classic'; }
    else if (sm === 'ruler') { Game.settings.team = 'versus'; Game.settings.arenaSkin = 'retro'; }
    else { Game.settings.team = 'coop'; Game.settings.arenaSkin = 'retro'; }
  } else if (isEasy && Game.settings.playLayout === 'dual') {
    const arena = Game.settings.dualTeam === 'coop' ? 'coop' : 'versus';
    Game.settings.dualTeam = arena;
    Game.settings.team = (arena === 'coop') ? 'coop' : 'versus';
  } else if (!isEasy && Game.settings.playLayout !== 'dual') {
    // cycle71: solo Boss — 唔用 coop 輪隊（否則答完去隱藏 mage → 撳掣無反應）
    // 打怪方式仍可顯示 coop 文案，但出題固定騎士；team 用 versus 語意避免 nextTeam 誤觸
    Game.settings.team = 'versus';
    Game.state.currentTeam = 'knight';
  }
  if (Game.settings.win === 'time') {
    const m = clamp(parseInt($('time-input').value, 10) || 5, 1, 15);
    Game.settings.minutes = m;
    Game.state.timeLimitSec = m * 60;
    Game.state.timeLeftSec = m * 60;
  } else {
    Game.state.timeLimitSec = 0;
    Game.state.timeLeftSec = 0;
  }
  Game.state.bossMaxHp = Game.settings.initialBossHp;
  Game.state.bossHp = Game.settings.initialBossHp;
  Game.state.castle.left = 100;
  Game.state.castle.right = 100;
  Game.state.bossFrostTicks = 0;
  Game.state.review = [];
  Game.state.pendingUlt = null;
  for (const tm of TEAMS) {
    Game.state.teams[tm] = { correct: 0, wrong: 0, total: 0, energy: 0, ultCharge: 0 };
    Game.state.current[tm] = null;
    // V3.5-AUDIT7-F07: 清 lastResumableType 
    Game.state.lastResumableType[tm] = null;
  }
  Game.state.currentTeam = 'knight';
  Game.state.running = true;
  Game.state.paused = false;
  Game.state.ended = false;
  Game.state.nextCastleAttack = now() + 6000; // 6s 後首次 castle 攻擊（給緩衝）
  Game.state.lastAnswerAt = { knight: 0, mage: 0 };

  // 切畫面
  $('screen-menu').classList.add('hidden');
  $('screen-end').classList.add('hidden');
  // V3.6-SEN: easy mode uses ultra-simple screen, normal uses full game UI
  // (reuse isEasy from earlier in startGame — do NOT redeclare const)
  $('screen-game').classList.toggle('hidden', isEasy);
  const senScreen = $('screen-game-sen');
  if (senScreen) {
    senScreen.classList.toggle('hidden', !isEasy);
    if (isEasy) {
      senScreen.classList.remove('sen-fade-in');
      void senScreen.offsetWidth; // restart animation
      senScreen.classList.add('sen-fade-in');
    }
  }
  // V3.6-SEN: wire SEN screen controls on first entry
  if (isEasy) _wireSENScreen();
  if (isEasy) UI.applySENBoardLayout();

  // 啟動 boss 自動攻擊（合作模式：每 8s 打一次左/右 castle；巔峰：每 12s 打隨機）
  Audio.prime();
  // scene-specific BGM (forest/snow/lava/shadow/crystal)
  if (Audio.setBGMScene && Bosses.current) Audio.setBGMScene(Bosses.current.scene);
  Audio.startBGM();
    // V3.4-AUDIT2-FIX: clear visibilitychan
  _wasPlayingBGM = false;
  UI.refreshAll();
  if (isEasy) {
    UI.refreshSENScreen();
    nextQuestion('knight');
    if (Game.settings.playLayout === 'dual') nextQuestion('mage');
  } else {
    nextQuestion('knight');
    // V3.6 cycle65: boss dual only — solo 唔開右隊題
    if (Game.settings.playLayout === 'dual') nextQuestion('mage');
  }
  // ⚠️ cycle111i：easy dual 開局要即刻講明「輪到邊隊」。
  // 之前 setSENTurn 只喺 _scheduleNextQuestion（答完一題嗰陣）先會叫
  // → 開局 banner 係空嘅，學生唔知邊隊先出手，要答完第一題先見到提示。
  // 邊隊 = Game.state.currentTeam（唯一真實來源，唔好喺呢度另開新欄位）。
  if (isEasy) UI.setSENTurn(Game.state.currentTeam);
  UI.renderReview();

  // 啟動主循環
  if (window._mgLoop) clearInterval(window._mgLoop);
  window._mgLoop = setInterval(gameLoop, 250);
}

function now() { return Date.now(); }

// 下一題 (AUDIT7-F07: visual-type ladder fallback — max 3 hops)
const VISUAL_FALLBACK_MAX_HOPS = 3;
function _typeSupportsMode(typeId, mode) {
  const reg = TYPE_REGISTRY[typeId];
  if (!reg) return false;
  if (!reg.mode) return true;  // legacy: 冇 mode 定義 = 全 mode 都支援
  return reg.mode.includes(mode);
}
function _pickFallbackType(originalType, mode, team, hops) {
  // 1. 同一個 settings.types 入面搵 mode-compatible 嘅 type (排除 original)
  const candidates = Game.settings.types.filter(t => t !== originalType && _typeSupportsMode(t, mode));
  if (candidates.length > 0) {
    const pick = candidates[randInt(0, candidates.length - 1)];
    console.warn(`[F07 visual-ladder] type=${originalType} 不支援 mode=${mode}, fallback 落同 list 嘅 ${pick} (hop ${hops})`);
    return pick;
  }
  // 2. per-team last resumable cache
  const lastGood = Game.state.lastResumableType && Game.state.lastResumableType[team];
  if (lastGood && lastGood !== originalType && _typeSupportsMode(lastGood, mode)) {
    console.warn(`[F07 visual-ladder] type=${originalType} 不支援 mode=${mode}, fallback 落 cached last-good ${lastGood} (hop ${hops})`);
    return lastGood;
  }
  // 3. 最終 fallback：add10 numeric (any mode compatible)
  console.warn(`[F07 visual-ladder] type=${originalType} 不支援 mode=${mode}, fallback 落 add10 numeric (hop ${hops}, final)`);
  return 'add10';
}
function nextQuestion(team) {
  // 選擇題型
  const types = Game.settings.types;
  let type = types[randInt(0, types.length - 1)];
  const mode = Game.settings.mode;
    // V3.5-AUDIT7-F07: mode compatibility c
  if (!_typeSupportsMode(type, mode)) {
    for (let hop = 1; hop <= VISUAL_FALLBACK_MAX_HOPS; hop++) {
      type = _pickFallbackType(type, mode, team, hop);
      if (_typeSupportsMode(type, mode)) break;
      // 如果 fallback 結果都唔支援 (理論唔可能因為 add10 一定 support)，
      // 下一輪 hop 會再 attempt；hops counter 防止死 loop
    }
    announceToA11y(`題型已切換：原本嘅 ${type} 唔適合目前操作模式，已自動調整。`);
  }
  const q = QuestionGen.make(type, mode, _scopeLevelOf(type));
    // V3.5-AUDIT7-F07: 答啱嘅題 cache 入 lastRes
  // (只 cache type，唔 cache 答案，因為同 type 嘅 question 內容每次 random)
  Game.state.current[team] = { ...q, type, pickedAt: now() };
  UI.showQuestion(team);
}

// 答題處理
    // V3.4-U2: instant hint — 半透明提示 overlay
function showInstantHint(team, q) {
  const text = q.text || (q.parts ? q.parts.join('') : '');
  let hint = '';
  const reg = TYPE_REGISTRY[q.type];
  if (reg && reg.layout === 'numeric') {
    hint = `💡 ${text} = ${q.answer}`;
  } else if (q.type === 'count1to3') {
    // V3.6-SEN: show emoji count — count the fruits
    hint = `💡 數吓有 ${q.parts[0]} = ${q.answer} 個`;
  } else if (q.type === 'groupAdd') {
    // V3.6-SEN: show the visual answer — robust: replace = ❓ at end of string only
    hint = `💡 ${q.parts.join('').replace(/\s*=\s*❓\s*$/, ` = ${q.answer} `)}`;
  } else if (q.type === 'compareGroup') {
    // V3.6-SEN: show direction icon
    const labels = {1:'左邊多', 2:'右邊多', 3:'一樣多'};
    hint = `💡 ${labels[q.answer] || `答案係 ${q.answer}`}`;
  } else if (q.type === 'compareLength' || q.type === 'compareHeight') {
    const lab = (q.optionLabels && q.optionLabels[q.answer]) ||
      ({ '1': '左', '2': '右', A: '左', B: '右' })[q.answer] || q.answer;
    hint = `💡 ${lab}`;
  } else if (q.type === 'orderAsc20' || q.type === 'orderDesc20') {
    hint = `💡 正確：${q.answer}`;
  } else if (q.type === 'count20') {
    hint = `💡 有 ${q.answer} 個`;
  } else if (reg && reg.layout === 'parts-emoji') {
    hint = `💡 答案係 ${q.answer}`;
  } else if (reg && reg.layout === 'sym-button') {
    hint = `💡 ${text.replace('?', '')}：${q.answer === '<' ? '前者細過後者' : q.answer === '>' ? '前者大過後者' : '兩個一樣'}`;
  } else if (reg && reg.layout === 'clock') {
    hint = `💡 時鐘顯示 ${q.extra.hour} 點`;
  } else if (reg && reg.layout === 'shape') {
    const labelMap = { circle:'圓形', square:'方形', triangle:'三角形', star:'星形' };
    hint = `💡 答案係${labelMap[q.answer] || q.answer}`;
  } else if (reg && reg.layout === 'order') {
    hint = `💡 正確順序：${q.answer.join(' < ')}`;
  } else if (reg && reg.layout === 'pic-grid') {
    const ex = q.extra || {};
    hint = `💡 ${ex.answerName || '答案'}${ex.answerPkg ? `（${ex.answerPkg}）` : ''} 用 L`;
  } else {
    hint = `💡 答案係 ${q.answer}`;
  }
  const overlay = document.createElement('div');
  overlay.className = 'instant-hint';
  overlay.innerHTML = `<div class="bg-amber-500/95 text-slate-900 rounded-2xl px-6 py-3 text-lg font-bold shadow-2xl pointer-events-auto cursor-pointer">${hint}<div class="text-xs mt-1 opacity-70">（點擊關閉）</div></div>`;
  overlay.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:80;pointer-events:none;';
  overlay.onclick = () => overlay.remove();
    // V3.4-AUDIT3-FIX: cap 1 — prevent mult
  // 先清舊嘅再 append 新嘅，避免畫面被覆蓋 + TTS cancel() 唔 fire onerror 都會 queue 撞。
  const existingHints = document.querySelectorAll('.instant-hint');
  if (existingHints.length >= 1) existingHints.forEach(e => e.remove());
  document.body.appendChild(overlay);
  // 順便 TTS 朗讀 hint
    // V3.5-P0: cancel 上一句 (含任何 active Karao
  // 入 hint overlay — sequential wrong answers 會造成 highlight 殘留喺題目文字
  if (Game.settings.ttsEnabled) {
    TTS.cancel();  // 清乾淨 .tts-active (hint 唔 wrap Karaoke，唔需要 onBoundary)
    TTS.speak(hint.replace('💡 ', '').replace('（點擊關閉）', ''));
  }
  setTimeout(() => overlay.remove(), 4000);
}

// R5: pure answer compare (array / number / string)
// Returns { correct, debug? } — caller uses .correct only.
    // V3.5-AUDIT7-F03: ordering JSON.string
// streak milestone celebration overlay (fire emoji + count)
function _streakFireOverlay(streakCount) {
  const existing = document.getElementById('streak-fire');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'streak-fire';
  ov.style.cssText = 'position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:90;pointer-events:none;text-align:center;animation:streak-fire-pop 1200ms cubic-bezier(0.34,1.56,0.64,1) both;';
  const label = streakCount === 10 ? '10 連勝！太強喇！' : `${streakCount} 連勝！`;
  ov.innerHTML = `<div style="font-size:5rem;line-height:1;filter:drop-shadow(0 0 24px rgba(251,146,60,0.8));">🔥</div><div style="margin-top:0.5rem;font-size:1.6rem;font-weight:900;color:#fef3c7;text-shadow:0 0 12px rgba(251,146,60,0.8), 2px 2px 0 #7f1d1d;">${label}</div>`;
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), 1300);
}
// correct = 1 短 pulse, wrong = 2 短 1 長 (distinct 不會混淆)
function _haptic(correct) {
  if (!navigator || !navigator.vibrate) return;
  try {
    if (correct) navigator.vibrate(20);
    else navigator.vibrate([10, 50, 10, 50, 30]);
  } catch (_) { /* vibrate API may be blocked by permissions */ }
}

function _compareAnswer(expected, actual, type) {
  if (Array.isArray(expected)) {
    const isOrdering = type === 'ordering';
    const correct = Array.isArray(actual)
      && actual.length === expected.length
      && JSON.stringify(actual) === JSON.stringify(expected);
    // ordering 答錯嗰陣 console.warn 顯示期望 vs 實際, debug aid (唔 spam production)
    if (!correct && isOrdering && typeof console !== 'undefined' && console.warn) {
      console.warn(`[handleAnswer/ordering] expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
    }
    return { correct };
  }
  if (typeof expected === 'number') return { correct: Number(actual) === expected };
  return { correct: String(actual) === String(expected) };
}

// R5: pendingUlt branch (答啱 releaseUlt / 答錯作罷)
// Returns true if ult path was taken (caller 應該 return 跳過 regular stats)。
function _handlePendingUlt(team, q, value, correct, btn) {
  if (!Game.state.pendingUlt || Game.state.pendingUlt.team !== team) return false;
  if (correct) {
    Game.state.pendingUlt = null;
    Game.state.pendingUltQ = null;
    const t = Game.state.teams[team];
    t.energy = Math.max(0, t.energy - 100);
    t.ultCharge = Math.max(0, t.ultCharge - 1);
    releaseUlt(team);
  } else {
    Game.state.pendingUlt = null;
    Game.state.pendingUltQ = null;
    Audio.wrong();
    FX.screenAlert(`${TEAM_META[team].name} 大絕挑戰失敗，再接再厲！`, '#f59e0b');
    highlightBtn(btn, false);
    if (q.type) Profile.resetStreak(q.type);
  }
  UI.updateTeam(team);
  Snapshot.schedule('ult-resolve');   // P1-A: save state
  nextQuestion(team);
  return true;
}

// R5: correct effects (energy / ult charge / 動畫 / boss damage / a11y)
// prevRagePct 由 caller 預 capture (用嚟 detect threshold 跨越觸發 hp tick)。
function _applyCorrectEffects(team, q, btn, prevRagePct) {
  const t = Game.state.teams[team];
  t.correct++;
    // V3.5-AUDIT7-F07: 答啱 cache type → visu
  if (q.type) Game.state.lastResumableType[team] = q.type;
  t.energy = Math.min(100, t.energy + randInt(8, 14));
  if (Math.random() < 0.3) t.ultCharge = Math.min(2, t.ultCharge + 1);
  charAnimate(team, 'attacking');
  Audio.attack();
  if (Audio.attackSting) Audio.attackSting();
  setTimeout(() => Audio.correct(), 140);
  setTimeout(() => Audio.energyTick(), 220);
  const dmg = 15 + Math.floor(Math.random() * 6);
  FX.screenAlert(`⚔️ ${team === 'knight' ? '騎士' : '法師'}攻擊！${Compliment.pick('correct')}`, '#22c55e');
  highlightBtn(btn, true);
  const rageBefore = prevRagePct;
  FX.slashToBoss(team, () => {
    damageBoss(dmg);
    // threshold 跨越觸發（等 HP 實際扣減後）
    const newRagePct = s_prevRagePct();
    const wasAbove = rageBefore > Game.state.bossRageThreshold * 100;
    const nowAbove = newRagePct > Game.state.bossRageThreshold * 100;
    if (wasAbove !== nowAbove && !Game.state.bossFrostTicks) Audio.hpTick();
  });
  Adaptive.onCorrect(team, q.type);   // P1-B
  announceToA11y(`${TEAM_META[team].name} 答啱喇！對 boss 造成傷害。`);
}

// R5: wrong effects — hurt / review queue / instant hint / boss counter / a11y
function _applyWrongEffects(team, q, btn) {
  Game.state.teams[team].wrong++;
  charAnimate(team, 'hurting');
  Audio.wrong();
  setTimeout(() => Audio.reviewAdd(), 200);
  FX.screenAlert(`再挑戰一下！${Compliment.pick('wrong')}`, '#f97316');
  announceToA11y(`${TEAM_META[team].name} 答錯，再挑戰。${q.answer !== undefined ? '正確答案係 ' + q.answer + '。' : ''}`);
  FX.screenShake();  // V3.4-UI2: 整個畫面搖 (更有打擊感)
  highlightBtn(btn, false);
  if (Game.settings.instantHint) showInstantHint(team, q);   // V3.4-U2: SEN-friendly
  Game.state.review.push({ text: q.text, answer: q.answer, type: q.type });
  UI.renderReview();
  scheduleBossCounter(team);
  Adaptive.onWrong(team, q.type);    // P1-B
  Profile.resetStreak(q.type);       // P1-E-2: 答錯清 streak
}

// R5: post-answer stats (reaction / Profile / mastery / streak)
// recordAnswer 先 (statsByType update)，跟住 checkMastery 再讀 accuracy。
function _recordAnswerStats(team, q, correct) {
  const reactionMs = q.pickedAt ? (now() - q.pickedAt) : null;
  Profile.recordAnswer(q.type, correct, reactionMs);
  Snapshot.schedule('answer');
  if (correct) Adaptive.checkMastery(team, q.type);   // V3.5-AUDIT14 ordering fix
  if (correct) {
    const s = (Profile.data.streakByType || {})[q.type] || 0;
    // streak fire overlay at milestone 3/5/10
    if (s === 3 || s === 5 || s === 10) {
      setTimeout(() => _streakFireOverlay(s), 500);
    }
    if (s > 0 && s % 5 === 0) {
      setTimeout(() => FX.screenAlert(Compliment.pick('streak', s), '#a78bfa'), 800);
    }
  }
}

// R5: next-question routing (coop round-robin / versus self)
// V3.5-AUDIT6-F01: re-entrancy null-out
// delayMs: easy mode uses ~650–1000ms so feedback/hint is readable ()
function _scheduleNextQuestion(team, delayMs) {
  Game.state.current[team] = null;
  const delay = (typeof delayMs === 'number') ? delayMs : 0;
  // （之前同一隊一直答，第二個學生根本冇得出手 → 雙隊其實唔需要對方）
  if (Game.settings.difficulty === 'easy') {
    const dual = Game.settings.playLayout === 'dual';
    let nextTeam = dual ? (team === 'knight' ? 'mage' : 'knight') : 'knight';
    //   否則「小明做完 → 傳俾小美 → 小美答完 → 傳返俾小明(已完成)」→
    //   setTimeout 見 _easyTeamDone[nextTeam] 就 return → 冇人再答題 = 死鎖。
    if (dual) {
      const done = Game.state._easyTeamDone || {};
      if (done[nextTeam]) {
        const other = nextTeam === 'knight' ? 'mage' : 'knight';
        if (!done[other]) nextTeam = other;
      }
    }
    //   badge（作答中/待命中）、review 重練對象、Adaptive 都讀佢，
    //   所以喺呢度同步，唔可以再開第二個輪次欄位（會漂移）。
    Game.state.currentTeam = nextTeam;
    setTimeout(() => {
      if (!(Game.state.running && !Game.state.ended && !(Game.state._easyTeamDone && Game.state._easyTeamDone[nextTeam]))) return;
      const replayQ = Game.state.replayQ;
      if (replayQ) {
        Game.state.current[nextTeam] = replayQ;
        Game.state.hintLevel[nextTeam] = 0;
        if (typeof UI !== 'undefined' && UI.showQuestion) UI.showQuestion(nextTeam);
      } else {
        nextQuestion(nextTeam);
      }
      if (typeof UI !== 'undefined' && UI.setSENTurn) UI.setSENTurn(nextTeam);
    }, delay || 700);
    return;
  }
  // cycle71: solo Boss 永遠只出騎士題（唔可以 coop 輪到隱藏 mage）
  if (Game.settings.playLayout !== 'dual') {
    Game.state.currentTeam = 'knight';
    setTimeout(() => {
      if (Game.state.running && !Game.state.ended) nextQuestion('knight');
    }, delay);
    return;
  }
  if (Game.settings.team === 'coop') {
    Game.nextTeamInCoop();
    setTimeout(() => {
      if (Game.state.running && !Game.state.ended) nextQuestion(Game.state.currentTeam);
    }, delay);
  } else {
    setTimeout(() => {
      if (Game.state.running && !Game.state.ended) nextQuestion(team);
    }, delay);
  }
}

// ============================================================
// ============================================================
// 每個 Stage = 3 格；每格 4 段（0.25 精度）→ 答啱 1 格 = 4 段。
// 進度只喺「同一個 scope 內」推進（cycle 108 P0 教訓：永遠唔換 scope）。
const STAGE_CELLS = 3;
const CELL_UNITS = 4;

// 一次答題填幾多「段」
//   答啱冇用提示 = 4 段（1 格）
//   答啱用提示 L1-2 = 2 段（½ 格）
//   答啱用提示 L3-4 = 1 段（¼ 格）
//   重播答啱       = 2 段（½ 格）
//   答錯           = 0 段（原地重播同一條）
function _cellUnits(correct, usedHintLevel, isReplay) {
  if (!correct) return 0;
  if (isReplay) return 2;
  if (!usedHintLevel) return CELL_UNITS;
  if (usedHintLevel <= 2) return 2;
  return 1;
}

// 推進 Stage 進度；回傳 { cleared, stageIndex }
function _applyStageUnits(team, units) {
  const st = Game.state;
  const s = st.stage[team] || (st.stage[team] = { index: 0, units: 0, cleared: 0 });
  if (!units) return { cleared: false, stageIndex: s.index };
  s.units += units;
  if (s.units < 0) s.units = 0;   // cycle110: 扣格（答錯兩次）唔可以變負
  const need = STAGE_CELLS * CELL_UNITS;
  let cleared = false;
  while (s.units >= need) {
    s.units -= need;
    s.cleared += 1;
    s.index += 1;
    cleared = true;
  }
  return { cleared, stageIndex: s.index };
}

// 當前 Stage 進度（每格 0..1）
function _stageCellFills(team) {
  const s = (Game.state.stage && Game.state.stage[team]) || { units: 0 };
  const cells = [];
  for (let i = 0; i < STAGE_CELLS; i++) {
    const lo = i * CELL_UNITS;
    const got = Math.max(0, Math.min(CELL_UNITS, s.units - lo));
    cells.push(got / CELL_UNITS);
  }
  return cells;
}

// 局長：Stage 數 → 目標題數（每 Stage 3 格）＋ 硬上限（容錯 ×2）
function _stageGoalQuestions() {
  const stages = Math.max(1, Number(Game.settings.goalStages) || 3);
  return { stages, target: stages * STAGE_CELLS, hardCap: stages * STAGE_CELLS * 2 };
}

// ============================================================
// ============================================================
// ⚠️ **適應只准喺同一個 scope 內發生** —— 呢度只改「同一個 type 嘅難度級數」，
//    type 本身永遠唔會變（cycle 108 P0 教訓：easy scope 被 Adaptive 換成 add10）。
//    同時亦唔會影響 classic mode（classic 有自己嘅 Adaptive ladder）。
const SCOPE_LEVEL_MAX = 3;
const LEVEL_UP_STREAK = 4;     // 連續 4 題答啱 → 升一級
const LEVEL_DOWN_STREAK = 3;   // 連續 3 題答錯 → 降一級

// 每個 scope 嘅 3 級參數（proposal §3.6 表）
//   count20       個數上限        L1 1–3 · L2 1–5 · L3 1–10
//   compareLength 長短比例        L1 1:2 · L2 1:3 · L3 1:1.5（最有挑戰）
//   compareHeight 高矮比例        同上
//   orderAsc/Desc 步長            L1 步長 2 · L2 步長 1 · L3 步長 1 + 干擾數字
//   learnL/findL* L 容量干擾      L1 1L vs 2L · L2 1L vs 1.5L · L3 1L vs 1.5L vs 2L（三選一）
const SCOPE_LEVEL_PARAMS = {
  count20:       [{ max: 3 }, { max: 5 }, { max: 10 }],
  compareLength: [{ ratio: 2 }, { ratio: 3 }, { ratio: 1.5 }],
  compareHeight: [{ ratio: 2 }, { ratio: 3 }, { ratio: 1.5 }],
  orderAsc20:    [{ step: 2 }, { step: 1 }, { step: 1, decoy: true }],
  orderDesc20:   [{ step: 2 }, { step: 1 }, { step: 1, decoy: true }],
  learnL:        [{ lvls: [2] }, { lvls: [1.5] }, { lvls: [1.5, 2] }],
  findLDrink:    [{ lvls: [2] }, { lvls: [1.5] }, { lvls: [1.5, 2] }],
  findLItem:     [{ lvls: [2] }, { lvls: [1.5] }, { lvls: [1.5, 2] }],
};

// 呢個 type 有冇 scope 難度階梯？（classic type 冇 → 完全唔受影響）
function _scopeSupportsLevel(type) {
  return !!(type && SCOPE_LEVEL_PARAMS[type]);
}

// 目前級數（1..3）。classic mode 一律 L1 —— 避免 easy 練習嘅級數影響經典題。
function _scopeLevelOf(type) {
  if (!_scopeSupportsLevel(type)) return 1;
  if (Game.settings.difficulty !== 'easy') return 1;
  const v = Number(Profile.data.levelByType && Profile.data.levelByType[type]);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(SCOPE_LEVEL_MAX, Math.round(v)));
}

// 目前級數嘅參數（唔支援就 null）
function _scopeLevelParams(type, level) {
  if (!_scopeSupportsLevel(type)) return null;
  const lv = Math.max(1, Math.min(SCOPE_LEVEL_MAX, level || 1));
  return SCOPE_LEVEL_PARAMS[type][lv - 1];
}

// 呢條 bank 題夾唔夾目前級數？（嚴格：只喺同級數先用）
//
// ⚠️ **為咩要過濾**：bank 種子係 cycle57 時代嘅固定難度舊題 ——
//    count20 答案 1–8、compareLength/Height 全部 1:2 或 1:3、順序題步長 2–6
//    而且順序題嘅 step 同答案根本唔一致（例如 [4,6] → 答 11，但 4+2 應該係 8）。
//    如果照攞，30%（weak type 70%）嘅機會會送出「唔合級數」嘅題 ——
//    L1（上限 3 個）會收到 8 個蘋果，**破壞對老師嘅級數承諾**。
//    → 唔夾就交返俾生成器，級數契約 100% 成立。
function _bankMatchesLevel(type, q, level) {
  if (!_scopeSupportsLevel(type)) return true;   // 冇級數階梯（classic type）→ 照用
  const p = _scopeLevelParams(type, level);
  if (!p || !q) return true;
  if (type === 'count20') {
    // bank 題嘅答案 = 水果數 → 直接同級數上限比
    const n = Number(q.answer);
    return Number.isFinite(n) && n >= 1 && n <= p.max;
  }
  if (type === 'compareLength' || type === 'compareHeight') {
    const ex = q.extra || {};
    const a = Number(ex.a != null ? ex.a : ex.left);
    const b = Number(ex.b != null ? ex.b : ex.right);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return false;
    const ratio = Math.max(a, b) / Math.min(a, b);
    // ⚠️ ratio < 2 嘅題唔用：_normalizeBankQuestion 嘅「ensure visible 1:2」
    //    會將佢改寫成 1:2 → 改完就唔喺原本級數（cycle111b 契約）→ L3 一律行生成器。
    if (ratio < 2) return false;
    return Math.abs(ratio - p.ratio) < 0.01;
  }
  if (type === 'orderAsc20' || type === 'orderDesc20') {
    const stem = Array.isArray(q.displayNums) ? q.displayNums.map(Number) : null;
    if (!stem || stem.length < 2) return false;
    const step = Math.abs(stem[1] - stem[0]);
    if (!Number.isFinite(step) || step !== p.step) return false;
    // 答案要真係跟得住個步長（舊 bank 種子 step 同答案唔一致 → 唔用）
    const ans = Number(q.answer);
    if (!Number.isFinite(ans)) return false;
    const expected = (type === 'orderAsc20') ? stem[1] + p.step : stem[1] - p.step;
    return ans === expected;
  }
  // learnL / findLDrink / findLItem → 冇 bank 種子，一律行生成器
  return true;
}

// 適應：連續 4 對 → 升級；連續 3 錯 → 降級。級數存 Profile（跨課堂保留）。
// ⚠️ 永遠唔換 scope —— 只改同一個 type 嘅級數。
function _updateScopeLevel(type, correct) {
  if (!_scopeSupportsLevel(type)) return null;
  if (Game.settings.difficulty !== 'easy') return null;
  const P = Profile.data;
  if (!P.levelByType) P.levelByType = {};
  if (!P.levelStreak) P.levelStreak = {};
  const cur = _scopeLevelOf(type);
  const st = P.levelStreak[type] || (P.levelStreak[type] = { right: 0, wrong: 0 });
  if (correct) { st.right = (st.right || 0) + 1; st.wrong = 0; }
  else { st.wrong = (st.wrong || 0) + 1; st.right = 0; }
  let next = cur;
  if (st.right >= LEVEL_UP_STREAK && cur < SCOPE_LEVEL_MAX) { next = cur + 1; st.right = 0; }
  else if (st.wrong >= LEVEL_DOWN_STREAK && cur > 1) { next = cur - 1; st.wrong = 0; }
  if (next === cur) return cur;
  P.levelByType[type] = next;
  Profile.save();
  const reg = TYPE_REGISTRY[type];
  const label = reg ? reg.label : type;
  if (typeof FX !== 'undefined' && FX.screenAlert) {
    FX.screenAlert(next > cur ? `⬆️ 升級！${label} 而家係第 ${next} 級` : `⬇️ 降級 → ${label} 第 ${next} 級`,
      next > cur ? '#34d399' : '#fbbf24');
  }
  return next;
}

//   M1 首次答啱 · M2 冇用提示連對 5 題 · M3 錯咗之後救回 · M4 同一局連對 10 題
function _checkMilestones(type, correct, usedHint, wasReplay) {
  if (!type) return;
  const st = Game.state;
  if (!st.hintStreakByType) st.hintStreakByType = {};
  if (st.hintStreakByType[type] === undefined) st.hintStreakByType[type] = 0;
  if (correct) {
    st.hintStreakByType[type] = usedHint ? 0 : st.hintStreakByType[type] + 1;
    st.sessionStreak = (st.sessionStreak || 0) + 1;
  } else {
    st.hintStreakByType[type] = 0;
    st.sessionStreak = 0;
  }
  const P = Profile.data;
  if (!P.milestonesByType) P.milestonesByType = {};
  const m = P.milestonesByType[type] || (P.milestonesByType[type] = {});
  const now = Date.now();
  let changed = false;
  if (correct && !m.m1) { m.m1 = now; changed = true; }
  if (correct && !usedHint && st.hintStreakByType[type] >= 5 && !m.m2) { m.m2 = now; changed = true; }
  if (correct && wasReplay && !m.m3) { m.m3 = now; changed = true; }
  if (correct && st.sessionStreak >= 10 && !m.m4) { m.m4 = now; changed = true; }
  if (changed) {
    Profile.save();
    const reg = TYPE_REGISTRY[type];
    const label = reg ? reg.label : type;
    if (typeof FX !== 'undefined' && FX.screenAlert) FX.screenAlert(`🏅 ${label}：解鎖新里程碑！`, '#fbbf24');
  }
}

// 島嶼旅程 — 跨課堂累積（每完成一局全部 Stage = 島上一格）
function _islandAdvance() {
  const st = Game.state;
  if (st._islandCounted) return;
  st._islandCounted = true;
  Profile.data.islandStage = (Profile.data.islandStage || 0) + 1;
  Profile.save();
}

// 呢個隊伍做完未？（全部 Stage 通關 或者 撞硬上限）
function _easyGameComplete(team) {
  const st = Game.state;
  const goal = _stageGoalQuestions();
  const s = st.stage[team] || { cleared: 0 };
  const allCleared = s.cleared >= goal.stages;
  const hitCap = st.teams[team].total >= goal.hardCap;
  if (!allCleared && !hitCap) return false;
  if (!st._easyTeamDone) st._easyTeamDone = { knight: false, mage: false };
  st._easyTeamDone[team] = true;
  if (typeof UI !== 'undefined' && UI.markSENTeamDone) UI.markSENTeamDone(team);
  const dual = Game.settings.playLayout === 'dual';
  const bothDone = dual ? (st._easyTeamDone.knight && st._easyTeamDone.mage) : true;
  if (bothDone) {
    st._easyEnding = true;
    st.running = false;
    setTimeout(() => { _easyFinishOrRetry(); }, 700);
  }
  return true;
}

// 主線完 → 如果有錯題，開「錯題重練」關卡；冇錯題就直接完場
function _easyFinishOrRetry() {
  const st = Game.state;
  const missed = (st.review || []).filter(r => r && r.type && (r.retryStreak || 0) < 2);
  if (missed.length) {
    st.retryMode = true;
    st.retryList = missed.map(r => ({ ...r }));
    st.retryIndex = 0;
    st.retryStreak = 0;
    st._easyEnding = false;
    st.running = true;
    if (typeof UI !== 'undefined' && UI.showSENRetryBanner) UI.showSENRetryBanner(true);
    // 隱藏「✅ 完成！」mask（佢會遮住重練題目）
    ['knight', 'mage'].forEach(tm => {
      const mask = document.getElementById(`sen-done-${tm}`);
      if (mask) mask.classList.add('hidden');
    });
    _nextRetryQuestion('knight');
    return;
  }
  _islandAdvance();
  if (!st.ended) endGame(true);
}

// 錯題重練：出下一條要重練嘅題（同一條，唔抽新題）
function _nextRetryQuestion(team) {
  const st = Game.state;
  const t = team || 'knight';
  const item = st.retryList[st.retryIndex];
  if (!item) { _easyRetryFinish(); return; }
  Game.state.current[t] = { ...item };
  st.hintLevel[t] = 0;
  if (typeof UI !== 'undefined' && UI.showQuestion) UI.showQuestion(t);
}

// 錯題全部重練完 → 完場
function _easyRetryFinish() {
  const st = Game.state;
  st.retryMode = false;
  st.running = false;
  st._easyEnding = true;
  _islandAdvance();
  if (typeof UI !== 'undefined' && UI.showSENRetryBanner) UI.showSENRetryBanner(false);
  if (!st.ended) endGame(true);
}

// ---------- 提示階梯 4 層 ----------
// 1 重述（重複題目，冇答案資訊）· 2 聚焦 · 3 部分（畀一半）· 4 答案
// Ken 2026-10-25 決定：可以畀答案，但分層遞進，最後一層先講答案。
function _easyHintL1(q) {
  if (!q) return '再試一次';
  const t = q.type;
  if (t === 'count20' || t === 'count10' || t === 'count1to3') {
    return `再數一次：${(q.parts && q.parts[0]) || ''}`;
  }
  if (t === 'groupAdd') return `加埋兩堆：${(q.parts || []).join(' ')}`;
  if (t === 'compareGroup') return `兩邊都數一數：${(q.parts || []).join(' ')}`;
  if (t === 'compareLength') return '再睇一次兩條，邊條長？';
  if (t === 'compareHeight') return '再睇一次兩個，邊個高？';
  if (t === 'orderAsc20' || t === 'orderDesc20') {
    return `再睇一次：${(q.parts && q.parts[0]) || ''}`;
  }
  if (t === 'learnL' || t === 'findLDrink' || t === 'findLItem') return '睇清楚每樣嘢上面寫住幾多';
  return '再試一次，慢慢嚟';
}

function _easyHintL2(q) {
  if (!q) return '慢慢睇，一步一步嚟';
  const t = q.type;
  if (t === 'count20' || t === 'count10' || t === 'count1to3') return '由左邊開始數：1、2、3⋯';
  if (t === 'groupAdd') return '先數第一堆有幾多，再數第二堆';
  if (t === 'compareGroup') return '由左邊嗰堆開始數';
  if (t === 'compareLength') return '由頭到尾數第一條有幾多格';
  if (t === 'compareHeight') return '由底開始數第一個有幾多格';
  if (t === 'orderAsc20' || t === 'orderDesc20') {
    return t === 'orderAsc20' ? '由最少嗰個開始，每次加多啲' : '由最多嗰個開始，每次減少啲';
  }
  if (t === 'learnL' || t === 'findLDrink' || t === 'findLItem') return '先睇第一件，上面寫住幾多';
  return '慢慢睇，一步一步嚟';
}

function _easyHintL3(q) {
  if (!q) return '再諗多陣';
  const t = q.type;
  const ex = q.extra || {};
  if (t === 'count20' || t === 'count10' || t === 'count1to3') {
    const n = Number(q.answer);
    if (Number.isFinite(n) && n > 1) return `數咗 ${n - 1} 個，仲有 1 個`;
  }
  if (t === 'groupAdd') {
    const a = ((q.parts && q.parts[0]) || '').length;
    const b = ((q.parts && q.parts[2]) || '').length;
    if (a > 0 && b > 0) return `第一堆 ${a} 個，第二堆 ${b} 個`;
  }
  if (t === 'compareGroup') {
    const a = ((q.parts && q.parts[0]) || '').length;
    const b = ((q.parts && q.parts[2]) || '').length;
    if (a > 0 && b > 0) return `左邊 ${a} 個，右邊 ${b} 個`;
  }
  if (t === 'compareLength' || t === 'compareHeight') {
    if (ex.a !== undefined && ex.b !== undefined) {
      const first = ex.ask === 'short' ? '長嗰個' : '短嗰個';
      return `第一個 ${ex.a} 格，第二個 ${ex.b} 格（${first}有 ${Math.max(ex.a, ex.b)} 格）`;
    }
  }
  if (t === 'orderAsc20' || t === 'orderDesc20') {
    const stem = q.displayNums || [];
    if (Array.isArray(stem) && stem.length >= 2) {
      const step = Number(stem[1]) - Number(stem[0]);
      const next = t === 'orderAsc20' ? Number(stem[0]) + step : Number(stem[0]) - step;
      return `每次${step >= 0 ? '加' : '減'}${Math.abs(step)}，下一個係 ${next}`;
    }
  }
  if (t === 'learnL' || t === 'findLDrink' || t === 'findLItem') {
    if (ex.pkg) return `有一件寫住 ${ex.pkg}`;
  }
  return '再諗多陣';
}

// L4 = 原本嘅「答案係 X」（cycle 41 舊邏輯，保留做最後一層）
function _easyHintL4(q) {
  if (!q) return '再試一次';
  if (q.type === 'count1to3' || q.type === 'count10' || q.type === 'count20') return `答案係 ${q.answer} 個`;
  if (q.type === 'groupAdd') return `答案係 ${q.answer}`;
  if (q.type === 'compareGroup') {
    const labels = { 1: '左邊多', 2: '右邊多', 3: '一樣多' };
    return labels[q.answer] || `答案係 ${q.answer}`;
  }
  if (q.type === 'compareLength' || q.type === 'compareHeight') {
    const lab = (q.optionLabels && q.optionLabels[q.answer]) ||
      ({ '1': '左', '2': '右', A: '左', B: '右' })[q.answer];
    return lab ? `答案係 ${lab}` : `答案係 ${q.answer}`;
  }
  if (q.type === 'orderAsc20' || q.type === 'orderDesc20' || q.type === 'ordering') {
    return `答案係 ${q.answer}`;
  }
  if (q.type === 'whatTime') return `答案係 ${q.answer} 點`;
  if (q.type === 'compare10') {
    const labels = { '<': '＜ 細', '=': '＝ 等', '>': '＞ 大' };
    return labels[q.answer] || `答案係 ${q.answer}`;
  }
  if (q.optionLabels && q.optionLabels[q.answer] !== undefined) {
    return `答案係 ${q.optionLabels[q.answer]}`;
  }
  return `答案係 ${q.answer}`;
}

function _easyHintText(q, layer) {
  // ⚠️ 唔可以用 `Number(layer) || 4`：layer=0 係 falsy → 會跳去 4（直接講答案）。
  // 同 cycle 108 嘅 indexOf(-1) 係同一類 falsy/邊界陷阱。
  const n = Number(layer);
  const L = Math.max(1, Math.min(4, Number.isFinite(n) ? n : 4));
  if (L >= 4) return _easyHintL4(q);
  if (L === 1) return _easyHintL1(q);
  if (L === 2) return _easyHintL2(q);
  return _easyHintL3(q);
}

function highlightBtn(btn, correct) {
  if (!btn) return;
  if (correct) { btn.classList.add('correct'); }
  else { btn.classList.add('wrong'); }
  setTimeout(() => btn.classList.remove('correct', 'wrong'), 700);
}

// 重練題處理
Game.askReReview = function(idx) {
  if (!Game.state.running || Game.state.paused || Game.state.ended) return;
    // V3.5-AUDIT6-F02: pendingUlt guard — b
  // 開新重練題，否則 handleAnswer 撞 ult resolve path 會 releaseUlt 錯 team / 錯 state。
  if (Game.state.pendingUlt) return;
  const item = Game.state.review[idx];
  if (!item) return;
  // 從 review 移除
  Game.state.review.splice(idx, 1);
  UI.renderReview();
  // 用當前輪到/最後的隊伍
  const team = Game.settings.playLayout !== 'dual'
    ? 'knight'
    : (Game.settings.team === 'coop' ? Game.state.currentTeam : 'knight');
  // 用同 type 出一道新題（等同重練）
  const type = item.type;
  const q = QuestionGen.make(type, Game.settings.mode, _scopeLevelOf(type));
  Game.state.current[team] = q;
  UI.showQuestion(team);
  FX.screenAlert(`${TEAM_META[team].name} 重練：${item.text.replace('?', ` = ${item.answer}`)}`, '#fbbf24');
};

function damageBoss(amount) {
  const s = Game.state;
  const dmg = Math.max(1, Math.floor(amount));
  s.bossHp = Math.max(0, s.bossHp - dmg);
  Audio.bossHit();
  const icon = $('boss-icon');
  const bRect = icon ? icon.getBoundingClientRect() : { left: window.innerWidth/2, top: 120, width: 80, height: 80 };
  const cx = bRect.left + bRect.width / 2;
  const cy = bRect.top + bRect.height / 2;
  FX.hitFlash(icon);
  FX.shake(icon, 'anim-shake');
  FX.impactRing(cx, cy);
  FX.floatDamage(dmg, cx, cy - 10);
  FX.screenHitFlash();
  FX.bossArenaPulse();
  FX.burst(cx, cy, 18, ['#fde68a', '#fb923c', '#ef4444', '#fef08a']);
  // V3.4-UI2: confetti on big hits
  FX.confetti(cx, cy, dmg >= 18 ? 32 : 18);
  UI.updateBoss();
  Snapshot.schedule('boss-hit');     // P1-A
  if (s.bossHp <= 0) endGame(true);
}

function scheduleBossCounter(team) {
  // 答錯 4 題累計 → boss 攻擊 castle
  const s = Game.state;
  s.nextCastleAttack = now() + 12000; // 12s 後對 castle 攻擊
}

function releaseUlt(team) {
  charAnimate(team, 'ulting');
  Audio.ultimate();
  const icon = $('boss-icon');
  FX.meteor('#boss-icon', () => {
    // meteor 落地 → boss 大量受傷 + 冰凍
    const dmg = Math.floor(Game.state.bossMaxHp * 0.18 + 30);
    Game.state.bossHp = Math.max(0, Game.state.bossHp - dmg);
    Game.state.bossFrostTicks = 3;
    Audio.freeze();
    FX.screenAlert(`${TEAM_META[team].name} 隕石轟炸！-${dmg} HP 並冰封`, '#06b6d4');
    UI.updateBoss();
    FX.shake(icon, 'anim-shake');
    if (Game.state.bossHp <= 0) endGame(true);
  });
}

// 主循環：boss 自動攻擊 castle / 限時計時 / 冰凍遞減
function gameLoop() {
  if (!Game.state.running || Game.state.paused || Game.state.ended) return;
  const s = Game.state;
  const tNow = now();

  // V3.6-SEN-FIX: easy = pure practice. No castle damage / frost / forced lose.
  // (UI already hides boss+castle; silent attacks previously caused auto-defeat.)
  if (Game.settings.difficulty === 'easy') {
    if (Game.settings.win === 'time' && s.timeLimitSec > 0) {
      if (!s._startAt) s._startAt = tNow;
      const elapsed = Math.floor((tNow - s._startAt) / 1000);
      s.timeLeftSec = Math.max(0, s.timeLimitSec - elapsed);
      if (s.timeLeftSec === 0) endGame(true); // practice complete = win
    }
    return;
  }

  // 限時模式
  if (Game.settings.win === 'time' && s.timeLimitSec > 0) {
    // V3.5-AUDIT6-F05: order fix — lazy-ini
    // 再算 elapsed / timeLeftSec。原本 line 3939 會用 stale _startAt=0 算一次，
    // 再喺 line 3941 set _startAt=tNow，line 3942-3943 再 re-compute — 浪費 + 雙 Math.max。
    if (!s._startAt) s._startAt = tNow;
    const elapsed = Math.floor((tNow - s._startAt) / 1000);
    s.timeLeftSec = Math.max(0, s.timeLimitSec - elapsed);
    const mm = Math.floor(s.timeLeftSec / 60);
    const ss = s.timeLeftSec % 60;
    $('badge-time').textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
    if (s.timeLeftSec === 0) {
      // 時間到：依 castle HP 判定
      endGame(s.castle.left > 0 && s.castle.right > 0);
    }
  }

  // Boss 自動攻擊 castle
  if (tNow >= s.nextCastleAttack) {
    bossAttackCastle();
    s.nextCastleAttack = tNow + (Game.settings.team === 'coop' ? 14000 : 10000);
  }

  // 冰凍遞減：每 4s 扣 1
  if (s.bossFrostTicks > 0) {
    if (!s._frostTickAt) s._frostTickAt = tNow;
    if (tNow - s._frostTickAt > 4000) {
      s.bossFrostTicks--;
      s._frostTickAt = tNow;
      UI.updateBoss();
    }
  }
}

function bossAttackCastle() {
  const s = Game.state;
  // 冰凍期間可能會跳過攻擊（30% 機率）
  if (s.bossFrostTicks > 0 && Math.random() < 0.5) {
    Audio.freeze();
    FX.screenAlert('巨魔被冰封，攻擊被阻擋', '#22d3ee');
    return;
  }
  // Boss 受擊的城塔對應嘅隊伍角色都 hurt
  // 左翼 tower → knight hurt；右翼 → mage hurt
  // 注意：呢個係 visual cue，角色未必知道
  const victimTeam = Math.random() < 0.5 ? 'knight' : 'mage';
  charAnimate(victimTeam, 'hurting');
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const dmg = 12 + randInt(0, 8);
  s.castle[side] = Math.max(0, s.castle[side] - dmg);
  // Castle HP 低過 30% 用重擊音效
  if (s.castle[side] < 30) Audio.castleHitHeavy();
  else Audio.castle();
  // Boss 進入狂暴態時吼叫一次
  const hpPct = s.bossHp / s.bossMaxHp;
  if (hpPct < s.bossRageThreshold && hpPct > s.bossFrostThreshold && Math.random() < 0.3) {
    Audio.bossEnraged();
  }
  FX.screenAlert(`巨魔攻擊${side === 'left' ? '左' : '右'}翼城塔 -${dmg}`, '#dc2626');
  const wrap = $('castle-' + side + '-wrap');
  FX.shake(wrap, 'castle-hit');
  FX.burst(
    wrap.getBoundingClientRect().left + wrap.offsetWidth/2,
    wrap.getBoundingClientRect().top + wrap.offsetHeight/2,
    10,
    ['#ef4444', '#fb923c', '#fbbf24']
  );
  UI.updateCastle();
  Snapshot.schedule('castle-hit');  // P1-A
  if (s.castle.left <= 0 && s.castle.right <= 0) {
    endGame(false);
  }
}

// 大絕按鈕 --------------------------------------------------
function setupUltButtons() {
  for (const tm of TEAMS) {
    $(`${tm}-ultimate`).onclick = () => {
      const t = Game.state.teams[tm];
      if (t.energy < 100 || t.ultCharge < 1) return;
      // 要求再答一題
      Game.state.pendingUlt = { team: tm };
      // 用當前題型出一道臨時題
      const types = Game.settings.types;
      const type = types[randInt(0, types.length - 1)];
      const q = QuestionGen.make(type, Game.settings.mode, _scopeLevelOf(type));
      Game.state.pendingUltQ = q;
      // 直接覆蓋該隊伍題目
      Game.state.current[tm] = q;
      UI.showQuestion(tm);
      FX.screenAlert(`${TEAM_META[tm].name} 大絕封印題：先答對才釋放隕石`, '#a855f7');
    };
  }
}

// 結束 --------------------------------------------------
function endGame(victory) {
  if (Game.state.ended) return;
  Game.state.ended = true;
  Game.state.running = false;
  Game.state.endedAt = Date.now();
  if (window._mgLoop) clearInterval(window._mgLoop);
  Audio.stopBGM();
    // V3.4-AUDIT2-FIX: ensure pause-overlay
  Game.state.paused = false;
  const _po2 = $('pause-overlay'); if (_po2) _po2.classList.add('hidden');
  // P1-A + P1-E: 結束時 archive report 入 history，清 snapshot 防 resume 舊 session
  archiveReport();
  Snapshot.clear();
  Profile.data.sessionsPlayed += 1;
  Profile.save();
  if (typeof plausible === 'function') {
    const dur = Math.round((Game.state.endedAt - Game.state.startedAt) / 1000);
    plausible('game_end', { props: {
      victory: victory ? 1 : 0,
      scopes: (Game.settings.scopes || []).join(','),
      play: Game.settings.playLayout,
      duration_sec: dur,
      correct: (Game.state.correctKnight || 0) + (Game.state.correctMage || 0),
      wrong: (Game.state.wrongKnight || 0) + (Game.state.wrongMage || 0),
    } });
  }
  // 解鎖下隻 boss (P1-C)
  if (victory) Bosses.onDefeat();
  if (victory) {
    setTimeout(() => Audio.bossDefeat(), 100);
    setTimeout(() => Audio.victory(), 700);
  } else {
    setTimeout(() => Audio.defeat(), 100);
  }
  // V3.6-SEN: hide SEN screen before showing end screen
  $('screen-game-sen').classList.add('hidden');
  setTimeout(() => showEndScreen(victory), 600);
}

const CONCEPT_BADGE = {
  count20: 'px-abacus',
  compareLength: 'px-badge-shield',
  compareHeight: 'px-badge-leaf',
  orderAsc20: 'px-badge-hat',
  orderDesc20: 'px-badge-book',
  learnL: 'px-badge-star',
  findLDrink: 'px-badge-star',
  findLItem: 'px-badge-star',
};
const MILESTONE_KEYS = ['m1', 'm2', 'm3', 'm4'];

// 島嶼旅程進度（跨課堂累積）
function renderEndIsland() {
  const el = $('end-island');
  if (!el) return;
  const n = Math.max(0, Math.min(8, Number(Profile.data.islandStage) || 0));
  const pips = Array.from({ length: 8 }, (_, i) => `<span class="island-pip${i < n ? ' on' : ''}"></span>`).join('');
  el.innerHTML = `<div class="island-label">🏝️ 島嶼旅程</div>` +
    `<div class="island-bar" role="img" aria-label="島嶼旅程進度 ${n} / 8">${pips}</div>`;
}

// 概念卡：每個用過嘅 scope 一張 + 4 個里程碑
function renderEndConceptCards() {
  const el = $('end-concept-cards');
  if (!el) return;
  const M = Profile.data.milestonesByType || {};
  const used = Array.from(new Set([...(Game.settings.scopes || []), ...Object.keys(M)]));
  if (!used.length) { el.innerHTML = ''; return; }
  const cards = used.map(t => {
    const reg = TYPE_REGISTRY[t];
    const label = reg ? reg.label : t;
    const m = M[t] || {};
    const got = MILESTONE_KEYS.filter(k => m[k]).length;
    const dots = MILESTONE_KEYS.map(k => (m[k] ? '●' : '○')).join('');
    const sym = CONCEPT_BADGE[t] || 'px-badge-star';
    return `<div class="concept-card">` +
      `<svg class="pixel" width="32" height="32" aria-hidden="true"><use href="#${sym}"/></svg>` +
      `<div class="concept-name">${escapeHTML(label)}</div>` +
      `<div class="concept-dots" role="img" aria-label="里程碑 ${got} / 4">${dots}</div>` +
      `</div>`;
  }).join('');
  el.innerHTML = `<div class="concept-cards-label">概念卡</div><div class="concept-cards">${cards}</div>`;
}

function renderEndBadges(victory) {
  // P2-c: 解鎖 condition
  const totalCorrect = (Game.state.teams.knight.correct || 0) + (Game.state.teams.mage.correct || 0);
  const totalAttempt = (Game.state.teams.knight.total || 0) + (Game.state.teams.mage.total || 0);
  const accuracy = totalAttempt === 0 ? 0 : totalCorrect / totalAttempt;
  // reaction time avg per type
  const reactMap = Profile.data.reactionByType || {};
  let reactSum = 0, reactCount = 0;
  for (const t of Object.keys(reactMap)) {
    for (const r of reactMap[t]) { reactSum += r; reactCount++; }
  }
  const reactAvg = reactCount === 0 ? Infinity : reactSum / reactCount;
  // streak max
  const streakMap = Profile.data.streakByType || {};
  let maxStreak = 0;
  for (const t of Object.keys(streakMap)) {
    const arr = streakMap[t] || [];
    maxStreak = Math.max(maxStreak, arr[arr.length - 1] || 0);
  }
  // all type unlocked
  const typesUsed = new Set();
  const history = Profile.data.history || [];
  for (const sess of history) {
    if (sess.types) for (const t of sess.types) typesUsed.add(t);
  }
  if (Game.settings.types) for (const t of Game.settings.types) typesUsed.add(t);

  const badges = [
    { id: 'star',   label: '百答達人', symbol: 'px-badge-star',   condition: totalCorrect >= 20 },
    { id: 'shield', label: 'Boss剋星',   symbol: 'px-badge-shield', condition: victory },
    { id: 'leaf',   label: '閃電答題',   symbol: 'px-badge-leaf',   condition: reactAvg < 2500 && reactCount >= 5 },
    { id: 'hat',    label: '連勝高手',   symbol: 'px-badge-hat',    condition: maxStreak >= 5 },
    { id: 'book',   label: '全類精通',   symbol: 'px-badge-book',   condition: typesUsed.size >= 6 },
  ];
  const slots = badges.map((b, i) => {
    const unlocked = b.condition;
    const style = unlocked
      ? `opacity:1;filter:drop-shadow(0 0 8px rgba(251,191,36,0.5));animation:badge-in 0.4s ${i*0.08}s cubic-bezier(0.34,1.56,0.64,1) both;`
      : `opacity:0.25;filter:grayscale(0.85);`;
    // V3.4-AUDIT4: locked badge 加 sr-only t
    // SVG aria-label 移除 (下方 span 已 carry 文字,避免重複 announce)
    return `<div title="${b.label}${unlocked ? '' : ' (未解鎖)'}" ${unlocked ? '' : 'aria-disabled="true"'} style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;${style}">
      <svg class="pixel" width="40" height="40" aria-hidden="true"><use href="#${b.symbol}"/></svg>
      <span style="font-size:10px;line-height:1;color:${unlocked?'#fbbf24':'#94a3b8'};font-weight:600;">${b.label}${unlocked ? '' : ' <span class="sr-only">(未解鎖)</span>'}</span>
    </div>`;
  }).join('');
  const el = $('end-badges');
  if (el) el.innerHTML = slots;
}

/* ============== R3 (cycle 12) — showEndScreen sub-helpers ==============
 * 5 helpers: _endTitleFor (pure), _renderEndIcon, _renderEndBackground,
 * _renderEndStats, _announceEndVictory.
 */

// Pure: 根據 victory / Game.settings 計出 title / msg / icon
function _endTitleFor(victory) {
  const tk = Game.state.teams.knight, tm = Game.state.teams.mage;
  const star = (v) => v ? '⭐⭐⭐' : '⭐';
  if (Game.settings.difficulty === 'easy') {
    const dual = Game.settings.playLayout === 'dual';
    const medalOf = (t) => {
      const total = t.total || 0;
      const acc = total === 0 ? 0 : t.correct / total;
      if (acc >= 0.9) return { medal: '🥇', tier: '金獎', stars: '⭐⭐⭐', acc, pct: Math.round(acc * 100) };
      if (acc >= 0.7) return { medal: '🥈', tier: '銀獎', stars: '⭐⭐', acc, pct: Math.round(acc * 100) };
      if (acc >= 0.5) return { medal: '🥉', tier: '銅獎', stars: '⭐', acc, pct: Math.round(acc * 100) };
      return { medal: '💪', tier: '繼續加油', stars: '', acc, pct: Math.round(acc * 100) };
    };
    if (dual) {
      const left = medalOf(tk);
      const right = medalOf(tm);
      const L = Game.settings.playerLabel || '左隊';
      const R = Game.settings.playerLabelRight || '右隊';
      const coop = Game.settings.team === 'coop';
      const retro = Game.settings.arenaSkin === 'retro';
      if (coop) {
        const sum = (tk.correct || 0) + (tm.correct || 0);
        const title = retro ? `${left.medal}${right.medal} 🌉 橋連住` : `${left.medal}${right.medal} 🚢 一齊埋岸`;
        const tier = retro ? '橋連住' : '一齊埋岸';
        return {
          title,
          msg: `合作完成！左 ${tk.correct}/${tk.total}（${left.pct}% ${left.tier}）· 右 ${tm.correct}/${tm.total}（${right.pct}% ${right.tier}）· 合計答啱 ${sum}`,
          icon: retro ? '🌉' : '🚢',
          medal: `${left.medal}${right.medal}`,
          tier,
          easyCert: true,
          dualEnd: true,
          left, right,
        };
      }
      let winner = retro ? '📏 平手！' : '🪢 平手！';
      if (tk.correct > tm.correct) winner = retro ? `📏 ⬅ ${L} 拉贏！` : `🪢 ⬅ ${L} 拉贏！`;
      else if (tm.correct > tk.correct) winner = retro ? `📏 ${R} 拉贏！ ➡` : `🪢 ${R} 拉贏！ ➡`;
      return {
        title: `${left.medal}${right.medal} ${retro ? '像素扯尺' : '扯大欖'}`,
        msg: `${winner}  左 ${tk.correct}/${tk.total}（${left.pct}% ${left.tier}）· 右 ${tm.correct}/${tm.total}（${right.pct}% ${right.tier}）`,
        icon: left.medal,
        medal: `${left.medal}${right.medal}`,
        tier: winner,
        easyCert: true,
        dualEnd: true,
        left, right,
      };
    }
    const m = medalOf(tk);
    const who = Game.settings.playerLabel || '同學';
    return {
      title: `${m.medal} ${who} · ${m.tier} ${m.stars}`.trim(),
      msg: `答啱 ${tk.correct} / ${tk.total || 0} 題（${m.pct}%）· 簡單練習完成！`,
      icon: m.medal,
      medal: m.medal,
      tier: m.tier,
      easyCert: true,
    };
  }
  if (Game.settings.win === 'time') {
    const castleAlive = Game.state.castle.left > 0 && Game.state.castle.right > 0;
    if (castleAlive) {
      return { title: `時間到！完成 ${star(true)}`, msg: `在 ${Game.settings.minutes} 分鐘內完成挑戰！`, icon: '🏆' };
    }
    return { title: `時間到！再試一次 ${star(false)}`, msg: '城堡倒塌了，下次再接再厲！', icon: '💔' };
  }
  if (victory) {
    const msg = Game.settings.team === 'coop'
      ? '兩隊同心協力，做得好！'
      : tm.correct > tk.correct ? '法師隊答對最多 🎉'
      : tk.correct > tm.correct ? '騎士隊答對最多 🎉'
      : '兩隊平分秋色，平手！';
    return { title: `完成！${star(true)}`, msg, icon: '🏆' };
  }
  return { title: `再試一次 ${star(false)}`, msg: '下次一起更精準作答吧！', icon: '💔' };
}

// DOM: 設 end-icon — always SVG sprite (AI_ASSETS removed); easy uses 金銀銅 medal
function _renderEndIcon(victory, endMeta) {
  const portrait = $('end-boss-portrait');
  const iconSvg = $('end-icon-svg');
  const medalEl = $('end-medal');
  const medalLab = $('end-medal-label');
  if (portrait) portrait.classList.add('hidden');
  if (endMeta && endMeta.easyCert && medalEl) {
    if (iconSvg) iconSvg.classList.add('hidden');
    medalEl.classList.remove('hidden');
    medalEl.textContent = endMeta.medal || '🏅';
    if (medalLab) {
      medalLab.classList.remove('hidden');
      medalLab.textContent = endMeta.tier || '';
    }
    return;
  }
  if (medalEl) medalEl.classList.add('hidden');
  if (medalLab) medalLab.classList.add('hidden');
  if (iconSvg) iconSvg.classList.remove('hidden');
}

// DOM: end-bg URL — AI_ASSETS.endBg removed; bg stays as CSS default
function _renderEndBackground() {
  // AUDIT-REFACTOR: AI_ASSETS.endBg removed — no custom end background
}

// DOM: 兩個 stat 卡片 (knight + mage)，命中率百分比；easy = 單人
function _renderEndStats() {
  const tk = Game.state.teams.knight, tm = Game.state.teams.mage;
  const correctRate = (t) => t.total === 0 ? 0 : Math.round(t.correct / t.total * 100);
  if (Game.settings.difficulty === 'easy') {
    const dual = Game.settings.playLayout === 'dual';
    const whoL = Game.settings.playerLabel || '同學';
    const whoR = Game.settings.playerLabelRight || '同學';
    const correctRate = (t) => t.total === 0 ? 0 : Math.round(t.correct / t.total * 100);
    if (dual) {
      $('end-stats').innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="bg-blue-500/15 border border-blue-300/40 rounded-xl p-3 text-center">
            <div class="font-bold text-blue-200 mb-1">⬅ ${whoL}</div>
            <div>答對 <b class="text-green-300 text-xl">${tk.correct}</b></div>
            <div>再挑戰 ${tk.wrong}</div>
            <div>總題 ${tk.total}</div>
            <div class="mt-1 font-extrabold">${correctRate(tk)}%</div>
          </div>
          <div class="bg-purple-500/15 border border-purple-300/40 rounded-xl p-3 text-center">
            <div class="font-bold text-purple-700 mb-1">${whoR} ➡</div>
            <div>答對 <b class="text-green-300 text-xl">${tm.correct}</b></div>
            <div>再挑戰 ${tm.wrong}</div>
            <div>總題 ${tm.total}</div>
            <div class="mt-1 font-extrabold">${correctRate(tm)}%</div>
          </div>
        </div>
      `;
      return;
    }
    $('end-stats').innerHTML = `
      <div class="bg-amber-500/10 border border-amber-300/30 rounded-xl p-4 text-center">
        <div class="font-bold text-amber-200 mb-2 text-lg">${whoL}</div>
        <div>答對：<b class="text-green-300 text-2xl">${tk.correct}</b></div>
        <div class="mt-1">再挑戰：<b class="text-red-300">${tk.wrong}</b></div>
        <div class="mt-1">總題：${tk.total}</div>
        <div class="mt-2 text-xl font-extrabold text-white">命中率：${correctRate(tk)}%</div>
      </div>
    `;
    return;
  }
  $('end-stats').innerHTML = `
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div class="bg-blue-500/10 border border-blue-300/30 rounded-xl p-3">
        <div class="font-bold text-blue-200 mb-1 flex items-center gap-2">
          <svg class="pixel icon-mini sword-shine"><use href="#px-knight"/></svg>
          騎士隊
        </div>
        <div>答對：<b class="text-green-300">${tk.correct}</b></div>
        <div>再挑戰：<b class="text-red-300">${tk.wrong}</b></div>
        <div>總題：${tk.total}</div>
        <div>命中率：${correctRate(tk)}%</div>
      </div>
      <div class="bg-purple-500/10 border border-purple-300/30 rounded-xl p-3">
        <div class="font-bold text-purple-700 mb-1 flex items-center gap-2">
          <svg class="pixel icon-mini orb-pulse"><use href="#px-mage"/></svg>
          法師隊
        </div>
        <div>答對：<b class="text-green-300">${tm.correct}</b></div>
        <div>再挑戰：<b class="text-red-300">${tm.wrong}</b></div>
        <div>總題：${tm.total}</div>
        <div>命中率：${correctRate(tm)}%</div>
      </div>
    </div>
  `;
}

// A11y: 600ms 後 push aria-live announce + focus 移到 end-title (keyboard / screen-reader)
function _announceEndVictory(title) {
  const tk = Game.state.teams.knight, tm = Game.state.teams.mage;
  setTimeout(() => {
    const live = $('aria-live-alerts') || (() => {
      const a = document.createElement('div');
      a.id = 'aria-live-alerts';
      a.setAttribute('aria-live', 'assertive');
      a.setAttribute('aria-atomic', 'true');
      a.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
      document.body.appendChild(a);
      return a;
    })();
    live.textContent = '';
    setTimeout(() => {
      live.textContent = `${title}。騎士隊答對 ${tk.correct} 題，法師隊答對 ${tm.correct} 題`;
    }, 80);
    const et = $('end-title');
    if (et) {
      et.setAttribute('tabindex', '-1');
      et.focus({ preventScroll: false });
    }
  }, 600);
}

function showEndScreen(victory) {
  // 1. Switch screens
  $('screen-game').classList.add('hidden');
  $('screen-end').classList.remove('hidden');

  // 2. Compute title/msg/icon (pure, no DOM)
  const endMeta = _endTitleFor(victory);
  const { title, msg, icon } = endMeta;
  void icon;  // icon reserved; end-icon via _renderEndIcon

  // 3. Render DOM (icon / background / badges / title / message / stats)
  _renderEndIcon(victory, endMeta);
  _renderEndBackground();
  renderEndBadges(victory);   // existing helper (P2-c, kept unchanged)
  renderEndIsland();
  renderEndConceptCards();
  $('end-title').textContent = title;
  $('end-message').textContent = msg;
  _renderEndStats();

  // 4. A11y: aria-live announce + focus restore (600ms delayed)
  _announceEndVictory(title);
}

$('btn-restart').onclick = () => {
  $('screen-end').classList.add('hidden');
  startGame();
};
$('btn-back-menu').onclick = () => {
  $('screen-end').classList.add('hidden');
  $('screen-game').classList.add('hidden');
  $('screen-menu').classList.remove('hidden');
};

$('btn-back').onclick = () => {
    // V3.3-U6: 自訂 styled modal 取代 native co
  showConfirmModal({
    title: '🛡️ 確定返回主選單？',
    body: '遊戲進度將會儲存喺 localStorage，下次開啟可 resume。',
    confirmText: '⬅ 返回',
    cancelText: '繼續戰鬥',
    onConfirm: () => {
      Game.state.running = false;
      Game.state.ended = true;
      Game.state.paused = false;       // V3.4-AUDIT-FIX: 清 paused 否則下次 startGame 狀態混亂
      if (window._mgLoop) clearInterval(window._mgLoop);
    // V3.4-AUDIT-FIX: 確保 pause-overlay 隱藏 (
      const po = $('pause-overlay'); if (po) po.classList.add('hidden');
      $('screen-game').classList.add('hidden');
      $('screen-menu').classList.remove('hidden');
    }
  });
};

// V3.3-U6: 自訂確認 modal (取代 native confir
function showConfirmModal({title, body, confirmText='確認', cancelText='取消', onConfirm, onCancel}) {
  let modal = $('confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'modal-backdrop hidden flex items-center justify-center p-4';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100';
    modal.innerHTML = `
      <div class="bg-slate-800 rounded-2xl p-6 max-w-sm w-full border-2 border-amber-500/50 shadow-2xl">
        <h3 id="confirm-modal-title" class="text-xl font-bold text-white mb-3"></h3>
        <p id="confirm-modal-body" class="text-on-night text-sm mb-5 leading-relaxed"></p>
        <div class="flex gap-3">
          <button id="confirm-modal-cancel" class="btn btn-ghost flex-1">取消</button>
          <button id="confirm-modal-ok" class="btn btn-knight flex-1">確認</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  $('confirm-modal-title').textContent = title;
  $('confirm-modal-body').textContent = body;
  $('confirm-modal-ok').textContent = confirmText;
  $('confirm-modal-cancel').textContent = cancelText;
  modal.classList.remove('hidden');
  const okBtn = $('confirm-modal-ok');
  const cancelBtn = $('confirm-modal-cancel');
    // V3.4-AUDIT2-FIX: Esc/Enter cleanup on
  // 時 listener 殘留。每次 open modal 都加新 handler，如果唔 cleanup，N 次 open → N 個 stale
  // handlers，每次之後嘅 Esc 會 cascade close 多個 modal。
  let escHandler = null;
  const close = () => {
    modal.classList.add('hidden');
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
  };
  okBtn.onclick = () => { close(); onConfirm && onConfirm(); };
  cancelBtn.onclick = () => { close(); onCancel && onCancel(); };
  // Enter / Esc 鍵
  escHandler = (e) => {
    if (e.key === 'Escape') { cancelBtn.click(); }
    if (e.key === 'Enter')  { okBtn.click(); }
  };
  document.addEventListener('keydown', escHandler);
  setTimeout(() => okBtn.focus(), 50);
}

$('btn-clear-review').onclick = () => {
  Game.state.review = [];
  UI.renderReview();
};

// 重練區事件代理 — 用 dataset.idx 確保永遠指到最新嘅 review array index
$('review-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-idx]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (Number.isFinite(idx)) {
    Audio.click();
    Game.askReReview(idx);
  }
});

// P0-2: mobile long-press 1.2s 顯示答案 (desktop hover 已 work)
const reviewList = $('review-list');
let lpTimer = null, lpBtn = null;
function lpStart(e) {
  const btn = e.target.closest('button[data-idx]');
  if (!btn) return;
  lpBtn = btn;
  lpTimer = setTimeout(() => {
    if (lpBtn) {
      // 解碼 XOR 嘅答案 → 加 .show-answer class 觸發 ::after
      lpBtn.dataset.answerDecoded = decodeAnswer(lpBtn.dataset.answerEncoded || '');
      lpBtn.classList.add('show-answer');
      Audio.beep(440, 0.08);
      lpBtn = null;
    }
  }, 1200);
}
function lpEnd() {
  if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
  if (lpBtn) {
    lpBtn.classList.remove('show-answer');
    delete lpBtn.dataset.answerDecoded;
    lpBtn = null;
  }
}
reviewList.addEventListener('touchstart', lpStart, { passive: true });
reviewList.addEventListener('touchend', lpEnd);
reviewList.addEventListener('touchcancel', lpEnd);
reviewList.addEventListener('touchmove', lpEnd);   // scrolling → cancel
// 也支援 mouse 按住 1.2s (desktop power user)
reviewList.addEventListener('mousedown', lpStart);
reviewList.addEventListener('mouseup', lpEnd);
reviewList.addEventListener('mouseleave', lpEnd);
    // V3.4-AUDIT5: keyboard retry (P1) — T 
// 老師 demo 用：唔需要 mouse hover，keyboard 即可 show answer
function revealLatestReviewAnswer() {
  const chips = $('review-list').querySelectorAll('button[data-idx]');
  if (!chips.length) return false;
  const last = chips[chips.length - 1];
  last.dataset.answerDecoded = decodeAnswer(last.dataset.answerEncoded || '');
  last.classList.add('show-answer');
  // 2.5s 後自動收起（等同 hover-leave UX）
  setTimeout(() => {
    if (last.classList.contains('show-answer')) {
      last.classList.remove('show-answer');
      delete last.dataset.answerDecoded;
    }
  }, 2500);
  return true;
}

// 老師控制台 --------------------------------------------------
    // V3.4-AUDIT4: focus-trap utility — mod
// 用第一/最後 focusable element 嘅 Shift+Tab / Tab 邊界處理。
function trapFocusInModal(modal) {
  const sel = 'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll(sel)].filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  modal.addEventListener('keydown', handler);
  return () => modal.removeEventListener('keydown', handler);
}

/* ============== R2 (cycle 12) — setupTeacher sub-helpers ==============
 * 5 helpers + IIFE state container. setupTeacher() 6-line orchestrator.
 */

// State container for teacher modal lifecycle
const _teacherModalState = { removeTrap: null, escHandler: null };

// Open teacher modal: show + reset + focus password + Esc + focus-trap
function _openTeacherModal() {
  const m = $('teacher-modal');
  m.classList.remove('hidden');
  m.classList.add('flex');
  $('teacher-pwd').value = '';
  $('teacher-pwd-error').classList.add('hidden');
  $('teacher-controls').classList.add('hidden');
  // V3.6 cycle83 C2: 每次開 modal 換新 challenge 題, 唔可以用舊答案
  const ch = _newTeacherChallenge();
  const hint = $('teacher-pwd-hint');
  if (hint) hint.textContent = `答啱呢題先可以入：${ch.q} = ?`;
  setTimeout(() => $('teacher-pwd').focus(), 50);
  // V3.4-AUDIT4: Esc 關閉 + focus-trap
  if (_teacherModalState.escHandler) document.removeEventListener('keydown', _teacherModalState.escHandler);
  _teacherModalState.escHandler = (e) => {
    // V3.4-AUDIT5: Esc stack — teacher-moda
    // (e.g. browser confirm dialog) 喺度，唔搶 Esc
    if (e.key === 'Escape') { _closeTeacherModal(); }
  };
  document.addEventListener('keydown', _teacherModalState.escHandler);
  if (_teacherModalState.removeTrap) _teacherModalState.removeTrap();
  _teacherModalState.removeTrap = trapFocusInModal(m);
}

// Close teacher modal: hide + cleanup Esc/focus-trap + restore focus 返 btn-teacher
function _closeTeacherModal() {
  $('teacher-modal').classList.add('hidden');
  $('teacher-modal').classList.remove('flex');
  if (_teacherModalState.escHandler) {
    document.removeEventListener('keydown', _teacherModalState.escHandler);
    _teacherModalState.escHandler = null;
  }
  if (_teacherModalState.removeTrap) {
    _teacherModalState.removeTrap();
    _teacherModalState.removeTrap = null;
  }
    // V3.4-AUDIT4: focus restoration — 將焦點還
  const trigger = $('btn-teacher');
  if (trigger) trigger.focus();
}

// Wire password input: Enter / blur 觸發 tryTeacherPwd；密碼對就顯示 controls
function _wireTeacherPassword() {
  $('teacher-pwd').addEventListener('keydown', e => {
    if (e.key === 'Enter') _tryTeacherPwd();
  });
  $('teacher-pwd').onblur = _tryTeacherPwd;
}

// Pure: 驗 challenge answer + 顯示 controls / 顯示 error
function _tryTeacherPwd() {
  const v = parseInt($('teacher-pwd').value, 10);
  if (_teacherChallenge && v === _teacherChallenge.a) {
    $('teacher-pwd-error').classList.add('hidden');
    $('teacher-pwd').dataset.ok = '1';
    $('teacher-controls').classList.remove('hidden');
    TeacherDashboard.render();
    wireAudioSettings();
    _renderBankSection(_bankUiState.selectedType);
  } else if ($('teacher-pwd').value.length >= 2) {
    $('teacher-pwd-error').classList.remove('hidden');
    $('teacher-pwd').dataset.ok = '';
  }
}

// State container for pause overlay lifecycle
const _pauseOverlayState = { escHandler: null };

    // V3.4-AUDIT4: pause overlay a11y — foc
// Esc stack: 若 teacher-modal 開住，skip (let teacher-modal 嘅 Esc 先處理)
function _showPauseOverlay() {
  const overlay = $('pause-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => $('pause-resume-2').focus(), 50);
  if (!_pauseOverlayState.escHandler) {
    _pauseOverlayState.escHandler = (e) => {
      if (e.key === 'Escape' && !$('pause-overlay').classList.contains('hidden')) {
        const teacherOpen = $('teacher-modal') && !$('teacher-modal').classList.contains('hidden');
        if (teacherOpen) return;
        // Esc only resumes if teacher paused；教師強制結束 (teacher-end) 同樣會 hide overlay。
        e.preventDefault();
        $('pause-resume-2').click();
      }
    };
    document.addEventListener('keydown', _pauseOverlayState.escHandler);
  }
  overlay._trapDispose = trapFocusInModal(overlay);
}

function _hidePauseOverlay() {
  $('pause-overlay').classList.add('hidden');
  if ($('pause-overlay')._trapDispose) {
    $('pause-overlay')._trapDispose();
    $('pause-overlay')._trapDispose = null;
  }
    // V3.4-AUDIT4: focus restoration on Spa
  // teacher-pause return focus to teacher-pause button
}

/* ============== V3.5-cycle13: 題庫管理 (老師 add / delete) ==============
 * Pattern: cycle 11 module-level helpers + orchestrator, state 收喺 _bankUiState。
 * 7 helpers: picker / addForm / readForm / add / inventory / remove / orchestrator.
 */
const _bankUiState = { selectedType: 'add10' };

// 12 個 type 嘅 emoji 標籤 — radiogroup picker 一行 6 個
function _renderBankTypePicker() {
  const picker = $('td-bank-type-picker');
  if (!picker) return;
  const types = Object.values(TYPE_REGISTRY);
  picker.innerHTML = types.map(t => `
    <button type="button" class="btn-sm px-2 py-1 rounded ${t.id === _bankUiState.selectedType ? 'bg-amber-600 text-white' : 'bg-white/10 text-on-night hover:bg-white/20'}"
            role="radio" aria-checked="${t.id === _bankUiState.selectedType ? 'true' : 'false'}"
            data-type="${t.id}">${t.emoji} ${t.label}</button>
  `).join('');
  picker.querySelectorAll('button[data-type]').forEach(btn => {
    btn.onclick = () => {
      _bankUiState.selectedType = btn.dataset.type;
      _renderBankSection(_bankUiState.selectedType);
    };
  });
}

// 動態 form fields — per type / per layout
function _renderBankAddForm(typeId) {
  const form = $('td-bank-add-form');
  if (!form) return;
  const reg = TYPE_REGISTRY[typeId];
  if (!reg) { form.innerHTML = ''; return; }
  let html = '';
  // parts text 輸入 (所有 type 都要)
  html += `<label class="block text-xs text-on-night-muted">題目文字 (parts[0])</label>`;
  html += `<input id="td-bank-parts-0" type="text" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" placeholder="${reg.layout === 'clock' ? '例：時鐘顯示 5 點' : reg.layout === 'shape' ? '例：這是什麼形狀？' : reg.layout === 'order' ? '例：排順序：5 , 2 , 8' : reg.layout === 'sym-button' ? '例：3' : reg.layout === 'parts-emoji' ? '例：🍎🍎🍎' : '例：2 + 3 = ?'}" />`;
  // 額外 parts (sym-button / order 需要多個 parts)
  if (reg.layout === 'sym-button') {
    html += `<div class="grid grid-cols-3 gap-1 mt-1">`;
    html += `<div><label class="block text-xs text-on-night-muted">左數</label><input id="td-bank-parts-0" type="text" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" value="" /></div>`;
    html += `<div><label class="block text-xs text-on-night-muted">符號</label><input id="td-bank-parts-1" type="text" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" value=" ◁ " /></div>`;
    html += `<div><label class="block text-xs text-on-night-muted">右數</label><input id="td-bank-parts-2" type="text" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" value="" /></div>`;
    html += `</div>`;
  }
  if (reg.layout === 'order') {
    html += `<div class="grid grid-cols-3 gap-1 mt-1">`;
    html += `<div><label class="block text-xs text-on-night-muted">displayNums[0]</label><input id="td-bank-display-0" type="number" min="1" max="99" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" /></div>`;
    html += `<div><label class="block text-xs text-on-night-muted">displayNums[1]</label><input id="td-bank-display-1" type="number" min="1" max="99" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" /></div>`;
    html += `<div><label class="block text-xs text-on-night-muted">displayNums[2]</label><input id="td-bank-display-2" type="number" min="1" max="99" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" /></div>`;
    html += `</div>`;
  }
  // answer input
  html += `<label class="block text-xs text-on-night-muted mt-2">答案</label>`;
  if (reg.layout === 'numeric' || reg.layout === 'parts-emoji' || reg.layout === 'clock') {
    const ph = reg.layout === 'clock' ? '1-12' : reg.layout === 'parts-emoji' ? '1-10' : '整數';
    html += `<input id="td-bank-answer" type="number" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" placeholder="${ph}" />`;
  } else if (reg.layout === 'sym-button') {
    html += `<select id="td-bank-answer" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm"><option value="<">&lt; (細過)</option><option value=">">&gt; (大過)</option><value=value="=">＝ (等於)</option></select>`;
  } else if (reg.layout === 'shape') {
    html += `<select id="td-bank-answer" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm"><option value="circle">圓形</option><option value="square">方形</option><option value="triangle">三角形</option><option value="star">星形</option></select>`;
  } else if (reg.layout === 'order') {
    html += `<div class="grid grid-cols-3 gap-1">`;
    html += `<div><label class="block text-xs text-on-night-muted">answer[0] (最小)</label><input id="td-bank-answer-0" type="number" min="1" max="99" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" /></div>`;
    html += `<div><label class="block text-xs text-on-night-muted">answer[1]</label><input id="td-bank-answer-1" type="number" min="1" max="99" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" /></div>`;
    html += `<div><label class="block text-xs text-on-night-muted">answer[2] (最大)</label><input id="td-bank-answer-2" type="number" min="1" max="99" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" /></div>`;
    html += `</div>`;
  }
  // shape options
  if (reg.layout === 'shape') {
    html += `<label class="block text-xs text-on-night-muted mt-2">選項 (4 個，逗號分隔，必須包含答案)</label>`;
    html += `<input id="td-bank-options" type="text" class="w-full px-2 py-1 rounded bg-black/40 border border-white/20 text-white text-sm" placeholder="例：circle,square,triangle,star" />`;
  }
  form.innerHTML = html;
}

// 從 form 讀 user input → 構造 question object。失敗 return {ok:false, error}。
function _readBankAddForm(typeId) {
  const reg = TYPE_REGISTRY[typeId];
  if (!reg) return { ok: false, error: `未知題型 ${typeId}` };
  const parts = [];
  const p0 = $('td-bank-parts-0');
  if (p0 && p0.value.trim()) parts.push(p0.value.trim());
  if (reg.layout === 'sym-button') {
    const p1 = $('td-bank-parts-1');
    const p2 = $('td-bank-parts-2');
    if (p1) parts.push(p1.value);
    if (p2 && p2.value.trim()) parts.push(p2.value.trim());
  }
  if (parts.length === 0) return { ok: false, error: '請填寫題目文字' };
  // answer
  const ansEl = $('td-bank-answer');
  if (!ansEl) return { ok: false, error: '找不到答案輸入框' };
  let answer;
  if (reg.layout === 'order') {
    const a0 = Number($('td-bank-answer-0').value);
    const a1 = Number($('td-bank-answer-1').value);
    const a2 = Number($('td-bank-answer-2').value);
    if (![a0, a1, a2].every(Number.isFinite)) return { ok: false, error: 'order answer 3 個都必須填寫' };
    answer = [a0, a1, a2];
  } else if (reg.layout === 'shape') {
    answer = ansEl.value;
  } else if (reg.layout === 'sym-button') {
    answer = ansEl.value;
  } else {
    answer = Number(ansEl.value);
    if (!Number.isFinite(answer)) return { ok: false, error: '答案必須是有效數字' };
  }
  const q = { parts, answer };
  // optional fields
  if (reg.layout === 'order') {
    const d0 = Number($('td-bank-display-0').value);
    const d1 = Number($('td-bank-display-1').value);
    const d2 = Number($('td-bank-display-2').value);
    if (![d0, d1, d2].every(Number.isFinite)) return { ok: false, error: 'order displayNums 3 個都必須填寫' };
    q.displayNums = [d0, d1, d2];
  }
  if (reg.layout === 'shape') {
    const optsEl = $('td-bank-options');
    if (!optsEl || !optsEl.value.trim()) return { ok: false, error: 'shape 必須填寫 options' };
    const opts = optsEl.value.split(',').map(s => s.trim()).filter(Boolean);
    q.options = opts;
  }
  return { ok: true, question: q };
}

// Handler: 加新題 → QuestionBank.add → refresh UI
function _addBankQuestion() {
  const typeId = _bankUiState.selectedType;
  const read = _readBankAddForm(typeId);
  const status = $('td-bank-status');
  if (!read.ok) {
    if (status) { status.textContent = `❌ ${read.error}`; status.className = 'text-xs text-red-300 mt-2 min-h-[1.25rem]'; }
    announceToA11y(`加入題庫失敗：${read.error}`);
    return;
  }
  const result = QuestionBank.add(typeId, read.question);
  if (!result.ok) {
    if (status) { status.textContent = `❌ ${result.error}`; status.className = 'text-xs text-red-300 mt-2 min-h-[1.25rem]'; }
    announceToA11y(`加入題庫失敗：${result.error}`);
    return;
  }
  const reg = TYPE_REGISTRY[typeId];
  if (status) { status.textContent = `✅ 已加入 ${reg.label} 題庫`; status.className = 'text-xs text-emerald-300 mt-2 min-h-[1.25rem]'; }
  announceToA11y(`已加入 ${reg.label} 題庫 1 題`);
  _renderBankInventory(typeId);
}

// Render inventory — 列出 selected type 嘅 bank 條目
function _renderBankInventory(typeId) {
  const inv = $('td-bank-inventory');
  const cnt = $('td-bank-count');
  if (!inv || !cnt) return;
  const list = QuestionBank.list(typeId);
  cnt.textContent = `${list.length} / ${QuestionBank.PER_TYPE_CAP}`;
  if (list.length === 0) {
    inv.innerHTML = `<div class="text-on-night-muted text-center py-2">題庫空白</div>`;
    return;
  }
  inv.innerHTML = list.map(e => {
    const preview = e.parts.join('');
    const ans = Array.isArray(e.answer) ? e.answer.join(',') : String(e.answer);
    const srcTag = e.source === 'user' ? '<span class="text-amber-300">⭐</span>' : '<span class="text-white/30">·</span>';
    return `<div class="flex items-center gap-2 bg-black/30 rounded px-2 py-1">
      <span class="text-on-night-muted">#${e.idx}</span>
      <span class="flex-1 truncate">${preview} <span class="text-emerald-300">→</span> ${ans}</span>
      ${srcTag}
      <button class="td-bank-del-btn text-red-300 hover:text-red-100 px-2" data-idx="${e.idx}" aria-label="刪除題庫第 ${e.idx + 1} 條">❌</button>
    </div>`;
  }).join('');
  inv.querySelectorAll('.td-bank-del-btn').forEach(btn => {
    btn.onclick = () => _removeBankQuestion(typeId, Number(btn.dataset.idx));
  });
}

// Handler: 移除指定 idx 嘅題
function _removeBankQuestion(typeId, idx) {
  const reg = TYPE_REGISTRY[typeId];
  if (!confirm(`確定刪除 ${reg.label} 題庫第 ${idx + 1} 條？`)) return;
  const r = QuestionBank.remove(typeId, idx);
  const status = $('td-bank-status');
  if (!r.ok) {
    if (status) { status.textContent = `❌ ${r.error}`; status.className = 'text-xs text-red-300 mt-2 min-h-[1.25rem]'; }
    announceToA11y(`刪除失敗：${r.error}`);
    return;
  }
  if (status) { status.textContent = `🗑 已刪除第 ${idx + 1} 條`; status.className = 'text-xs text-on-night-muted mt-2 min-h-[1.25rem]'; }
  announceToA11y(`已刪除 ${reg.label} 題庫 1 題`);
  _renderBankInventory(typeId);
}

// Orchestrator: render picker (refresh active) + form + inventory
function _renderBankSection(typeId) {
  _renderBankTypePicker();
  _renderBankAddForm(typeId);
  _renderBankInventory(typeId);
}

// Wire bank section buttons — call from setupTeacher() orchestrator
function _wireBankSection() {
  $('td-bank-add-btn').onclick = _addBankQuestion;
}

// Wire 3 個 teacher action button + pause-resume button + 4 個 teacher dashboard reset
function _wireTeacherActions() {
  $('teacher-pause').onclick = () => {
    if ($('teacher-pwd').dataset.ok !== '1') return;
    Game.state.paused = true;
    _showPauseOverlay();
  };
  $('teacher-resume').onclick = () => {
    if ($('teacher-pwd').dataset.ok !== '1') return;
    Game.state.paused = false;
    _hidePauseOverlay();
    // V3.4-AUDIT4: focus restoration
    $('teacher-pause') && $('teacher-pause').focus();
  };
  $('pause-resume-2').onclick = () => {
    Game.state.paused = false;
    _hidePauseOverlay();
  };
  $('teacher-end').onclick = () => {
    if ($('teacher-pwd').dataset.ok !== '1') return;
    if (confirm('確定要強制結束本局遊戲嗎？')) {
      Game.state.paused = false;
      _hidePauseOverlay();
      $('teacher-modal').classList.add('hidden');
      endGame(false);
    }
  };

  // P1-E: TeacherDashboard actions
  $('td-export-csv').onclick = () => { TeacherDashboard.exportCSV(); };
  $('td-export-json').onclick = () => { TeacherDashboard.exportJSON(); };
  $('td-reset-session').onclick = () => {
    if (confirm('確定清除進行中嘅 session？')) {
      Snapshot.clear();
      STORAGE.clear(STORAGE.SESSION_KEY);
      alert('已清除進行中 session');
      TeacherDashboard.render();
    }
  };
  $('td-reset-all').onclick = () => {
    if (!confirm('⚠️ 真係要重設所有 profile 嗎？解鎖進度、累計 stats、過往 session 全部會刪除。')) return;
    if (!confirm('再確認：呢個 action 唔可復原')) return;
    STORAGE.clear(STORAGE.PROFILE_KEY);
    STORAGE.clear(STORAGE.SESSION_KEY);
    STORAGE.clear(STORAGE.HISTORY_KEY);
    Profile.data = {
      studentName: '', unlockedBosses: ['forest-troll'], unlockedScenes: ['forest'],
      unlockedChars: ['knight','mage'], badges: [], statsByType: { add10:{c:0,w:0}, sub10:{c:0,w:0}, add20:{c:0,w:0}, sub20:{c:0,w:0}, add2d:{c:0,w:0}, sub2d:{c:0,w:0} },
      adaptiveDowngrades: 0, masteredByType: {}, masteredCount: 0, sessionsPlayed: 0, lastPlayDate: '',
    };
    Profile.save();
    renderBossSelect();
    alert('已重設');
    TeacherDashboard.render();
  };
    // V3.5-AUDIT10: reset bank — clear BANK
  $('td-reset-bank').onclick = () => {
    if (!confirm('確定要重設精選題庫嗎？下次遊戲將會重新使用 12 類型 × 10 題嘅預設題目。')) return;
    const stats = QuestionBank.stats();
    QuestionBank.reset();
    alert(`已重設題庫 (原本 ${stats.total} 題 → 重新載入預設 120 題)`);
    announceToA11y('精選題庫已重設');
  };
}

// setupTeacher orchestrator — 6 lines，唔再用 nested function closure pattern
// ⚠️ V3.6 cycle111h: 原本呢度有 `_wirePauseOverlay()` —— 但嗰個函數**從來冇定義過**
//    （v3.5 refactor 把它拆成 `_showPauseOverlay` / `_hidePauseOverlay` + `_wireTeacherActions`
//    之後，舊 call site 冇跟住更新）→ 每個 boot 都喺呢度 throw ReferenceError，
//    **成個 DOMContentLoaded 之後嘅流程全部死掉**（renderTypePicker / renderRecommendChips /
//    Profile.load / Audio.setMasterVolume / renderBossSelect / resume 按鈕）。
//    ⚠️ 呢個 bug 由 v3.5 一直 live 咗，cycle111h 喺線上站揭發（守門：T111h-14 + 視覺場景
//    `boot-console-clean` —— 之前 52 條視覺守門**完全唔睇 console**，所以捉唔到）。
//    pause overlay 嘅 wiring 而家喺 `_wireTeacherActions()`（pause-resume-2）+
//    `_showPauseOverlay()`（Esc stack）—— 唔使再有一個 `_wirePauseOverlay()`。
function setupTeacher() {
  $('btn-teacher').onclick = _openTeacherModal;
  $('teacher-close').onclick = _closeTeacherModal;
  _wireTeacherPassword();
  _wireTeacherActions();
  _wireBankSection();  // 題庫管理 add / delete
}


/* ============== P1-E: Teacher Dashboard ============== */
const TeacherDashboard = {
  render() {
    $('td-sessions').textContent = (Profile.data.sessionsPlayed || 0).toString();
    $('td-bosses').textContent = (Profile.data.unlockedBosses || []).join(', ');
    $('td-downgrades').textContent = (Profile.data.adaptiveDowngrades || 0).toString();
    // V3.5-AUDIT14: 已精通題型 — 列出 typeId 同 cou
    const mastered = Profile.data.masteredByType || {};
    const masteredKeys = Object.keys(mastered);
    $('td-mastered').textContent = masteredKeys.length === 0
      ? '（暫無）'
      : `${masteredKeys.join(', ')} (${masteredKeys.length})`;

    // Type accuracy chart — v3.1 derive from TYPE_REGISTRY (single source-of-truth)
    const chart = $('td-type-chart');
    chart.innerHTML = '';
    Object.values(TYPE_REGISTRY).forEach(reg => {
      const t = reg.id;
      const all = Profile.data.statsByType[t] || { c: 0, w: 0 };
      const total = all.c + all.w;
      const pct = total ? Math.round(all.c / total * 100) : 0;
      // P1-E-3: avg reaction time per type
      const rxn = (Profile.data.reactionByType && Profile.data.reactionByType[t]) || [];
      const avgRxn = rxn.length ? Math.round(rxn.reduce((s,v) => s+v, 0) / rxn.length) : null;
      const rxnStr = avgRxn !== null ? ` · ${avgRxn}ms` : '';
      const row = document.createElement('div');
      row.innerHTML = `
        <div class="flex justify-between text-xs mb-0.5"><span>${reg.emoji} ${reg.label}${rxnStr ? ' <span class="text-on-night-muted">(' + rxnStr + ')</span>' : ''}</span><span class="font-bold ${pct >= 70 ? 'text-emerald-300' : pct >= 40 ? 'text-amber-700' : total ? 'text-rose-300' : 'text-on-night-muted'}">${total ? pct + '% (' + all.c + '/' + total + ')' : '— (未試過)'}</span></div>
        <div class="h-2 bg-black/40 rounded-full overflow-hidden"><div class="h-full ${pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400'}" style="width:${pct}%"></div></div>
      `;
      chart.appendChild(row);
    });

    // P1-E-4: Top error types 統計
    const errs = (Profile.data.errorPattern || []);
    const errTypeCount = {};
    errs.forEach(e => { errTypeCount[e.type] = (errTypeCount[e.type] || 0) + 1; });
    const topErrs = Object.entries(errTypeCount).sort((a,b) => b[1] - a[1]).slice(0, 3);
    const errList = $('td-top-errors');
    if (errList) {
      errList.innerHTML = '';
      if (topErrs.length === 0) {
        errList.innerHTML = '<div class="text-on-night-muted text-xs">（未有答錯紀錄）</div>';
      } else {
        topErrs.forEach(([t, n]) => {
          const reg = TYPE_REGISTRY[t];
          const label = reg ? `${reg.emoji} ${reg.label}` : t;
          const div = document.createElement('div');
          div.className = 'flex justify-between text-xs';
          div.innerHTML = `<span>${label}</span><span class="font-bold text-rose-300">${n} 次</span>`;
          errList.appendChild(div);
        });
      }
    }

    // P1-E-5: Session context stats (if session running)
    const sessInfo = $('td-session-live');
    if (sessInfo) {
      // 只喺 session 真係進行中（bossHP 已 set + teams.total > 0）先 render
      const live = Game.state && Game.state.teams
                   && typeof Game.state.bossHp === 'number'
                   && (Game.state.teams.knight.total + Game.state.teams.mage.total) > 0;
      if (live) {
        const k = Game.state.teams.knight;
        const m = Game.state.teams.mage;
        const sumT = (k.total + m.total) || 0;
        const sumC = (k.correct + m.correct) || 0;
        const pctLive = sumT ? Math.round(sumC / sumT * 100) : 0;
        sessInfo.innerHTML = `
          <div class="text-xs space-y-0.5">
            <div class="flex justify-between"><span>本 session 答題</span><span class="font-bold text-amber-300">${k.total + m.total}</span></div>
            <div class="flex justify-between"><span>本 session 答對</span><span class="font-bold text-emerald-300">${k.correct + m.correct} (${pctLive}%)</span></div>
            <div class="flex justify-between"><span>Boss HP</span><span class="font-bold text-rose-300">${Game.state.bossHp} / ${Game.state.bossMaxHp}</span></div>
            <div class="flex justify-between"><span>城塔 HP</span><span class="font-bold text-amber-300">${Game.state.castleHP || '?'} / ${Game.state.castle ? Game.state.castle.left : '?'}</span></div>
          </div>
        `;
        sessInfo.classList.remove('hidden');
      } else {
        sessInfo.innerHTML = '<div class="text-xs text-on-night-muted">（未開始遊戲 session）</div>';
        sessInfo.classList.add('hidden');
      }
    }

    // History list
    const hist = STORAGE.load(STORAGE.HISTORY_KEY) || [];
    $('td-history-count').textContent = hist.length;
    const list = $('td-history-list');
    list.innerHTML = '';
    if (hist.length === 0) {
      list.innerHTML = '<div class="text-on-night-muted">（未有 session 紀錄）</div>';
    } else {
      hist.slice().reverse().slice(0, 30).forEach((h, i) => {
        const d = new Date(h.ts);
        const dur = h.duration ? Math.floor(h.duration / 60) + '分' + (h.duration % 60) + '秒' : '?';
        const modes = (h.settings.types || []).map(t => t.replace('add','+').replace('sub','-').replace('2d','²').replace('10','¹⁰').replace('20','²⁰')).join(',');
        const div = document.createElement('div');
        div.className = 'flex justify-between bg-black/30 px-2 py-1 rounded';
        div.innerHTML = `<span>${d.toLocaleString('zh-HK')}</span><span>${h.won ? '✅ 擊殺' : '❌ 失敗'}</span><span>${dur}</span><span class="text-on-night-muted">${modes || '?'}</span>`;
        list.appendChild(div);
      });
    }
  },

  exportCSV() {
    const rows = [
      ['timestamp', 'duration_sec', 'won', 'session_correct', 'session_wrong', 'session_review_count', 'boss', 'mode', 'team', 'types', 'adaptive_downgrades'],
    ];
    const hist = STORAGE.load(STORAGE.HISTORY_KEY) || [];
    hist.forEach(h => {
      const total = h.total || { c: 0, w: 0 };
      rows.push([
        new Date(h.ts).toISOString(),
        h.duration || 0,
        h.won ? 'yes' : 'no',
        total.c || 0,
        total.w || 0,
        h.review || 0,
        (h.settings.boss) || '',
        h.settings.mode || '',
        h.settings.team || '',
        (h.settings.types || []).join('|'),
        h.adaptiveDowngrades || 0,
      ]);
    });
    // Per-type cumulative
    rows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    rows.push(['CUMULATIVE TYPE STATS']);
    rows.push(['type', 'correct', 'wrong', 'accuracy_pct']);
    const types = Object.keys(Profile.data.statsByType || {});
    types.forEach(t => {
      const s = Profile.data.statsByType[t] || { c: 0, w: 0 };
      const tot = s.c + s.w;
      rows.push([t, s.c, s.w, tot ? Math.round(s.c / tot * 100) : 0]);
    });
    const csv = rows.map(r => r.map(v => {
      const s = String(v == null ? '' : v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    _download('mathguardian-sessions.csv', csv, 'text/csv');
  },

  exportJSON() {
    const data = {
      exportedAt: new Date().toISOString(),
      profile: Profile.data,
      history: STORAGE.load(STORAGE.HISTORY_KEY) || [],
      currentSession: STORAGE.load(STORAGE.SESSION_KEY) || null,
    };
    _download('mathguardian-export.json', JSON.stringify(data, null, 2), 'application/json');
  },
};

function _download(filename, content, mime) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 音效切換 --------------------------------------------------
const SOUND_OFF_ICON = '<svg class="pixel icon-mini"><use href="#px-sound-off"/></svg>';
const SOUND_ON_ICON  = '<svg class="pixel icon-mini"><use href="#px-sound-on"/></svg>';
const BGM_ON_LABEL = '🎵';
const BGM_OFF_LABEL = '🎵✕';

function syncBgmButtonsUI() {
  const on = typeof Audio.isBgmOn === 'function' ? Audio.isBgmOn() : true;
  document.querySelectorAll('#btn-bgm, #btn-bgm-menu, #btn-bgm-sen').forEach(btn => {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('btn-bgm-on', on);
    btn.classList.toggle('btn-bgm-off', !on);
    const isMenu = btn.id === 'btn-bgm-menu';
    btn.textContent = on ? (isMenu ? '🎵 BGM' : BGM_ON_LABEL) : (isMenu ? '🎵✕ BGM' : BGM_OFF_LABEL);
    btn.title = on ? '背景音樂：開（撳關）' : '背景音樂：關（撳開）';
  });
  try { localStorage.setItem('mg2.bgm', on ? '1' : '0'); } catch (_) {}
}

function toggleBgmChannel() {
  const cur = typeof Audio.isBgmOn === 'function' ? Audio.isBgmOn() : true;
  const next = !cur;
  Audio.setChannel('bgm', next);
  if (next && Game.state && Game.state.running) Audio.startBGM();
  else if (!next) Audio.stopBGM();
  syncBgmButtonsUI();
  if (typeof syncAudioSettingsUI === 'function') syncAudioSettingsUI();
}

$('btn-sound').onclick = () => {
  const newVal = !Audio.isEnabled();
  Audio.enable(newVal);
    // V3.4-AUDIT5: master toggle 一併翻轉 sub-c
  Audio.setChannel('sfx', newVal);
  Audio.setChannel('bgm', newVal);
  TTS.setEnabled(newVal);
  $('btn-sound').innerHTML = newVal ? SOUND_ON_ICON : SOUND_OFF_ICON;
  $('btn-sound').setAttribute('aria-pressed', String(newVal));
  syncBgmButtonsUI();
  syncAudioSettingsUI();
};
$('btn-sound').innerHTML = SOUND_ON_ICON;
$('btn-sound').setAttribute('aria-pressed', 'true');
$('btn-sound').setAttribute('aria-label', '音效總開關 — 點擊靜音 / 取消靜音');

['btn-bgm', 'btn-bgm-menu', 'btn-bgm-sen'].forEach(id => {
  const b = $(id);
  if (b) b.onclick = () => toggleBgmChannel();
});
try {
  const savedBgm = localStorage.getItem('mg2.bgm');
  if (savedBgm === '0') {
    Audio.setChannel('bgm', false);
    Audio.stopBGM();
  }
} catch (_) {}
syncBgmButtonsUI();

// V3.4-AUDIT5: per-channel settings UI 
function syncAudioSettingsUI() {
  const ch = Audio.getChannels();
  const masterCb = $('td-audio-master'); if (masterCb) masterCb.checked = ch.master;
  const sfxCb    = $('td-audio-sfx');    if (sfxCb)    sfxCb.checked    = ch.sfx;
  const bgmCb    = $('td-audio-bgm');    if (bgmCb)    bgmCb.checked    = ch.bgm;
  const ttsCb    = $('td-audio-tts');    if (ttsCb)    ttsCb.checked    = TTS.isEnabled();
    // V3.5-P0: TTS Karaoke toggle (獨立於 mast
  const karaokeCb = $('td-audio-tts-karaoke');
  if (karaokeCb) karaokeCb.checked = Game.settings.ttsKaraoke !== false;
  // V3.5-AUDIT11: 自動推薦 toggle sync
  const adaptiveCb = $('td-adaptive-enabled');
  if (adaptiveCb) adaptiveCb.checked = Game.settings.adaptiveEnabled !== false;
  // chips row toggle sync
  const recommendCb = $('td-recommendation-enabled');
  if (recommendCb) recommendCb.checked = Game.settings.recommendationEnabled !== false;
  const volSlider = $('td-audio-volume');
  const volVal = $('td-audio-volume-val');
  if (volSlider) {
    const v = Audio.getBusVolume('master');
    volSlider.value = String(Math.round((v == null ? 1 : v) * 100));
  }
  if (volVal) {
    const v = Audio.getBusVolume('master');
    volVal.textContent = Math.round((v == null ? 1 : v) * 100) + '%';
  }
}
function wireAudioSettings() {
  syncAudioSettingsUI();
  const masterCb = $('td-audio-master');
  const sfxCb    = $('td-audio-sfx');
  const bgmCb    = $('td-audio-bgm');
  const ttsCb    = $('td-audio-tts');
  // V3.5-P0: TTS Karaoke sub-channel
  const karaokeCb = $('td-audio-tts-karaoke');
  if (masterCb) masterCb.onchange = (e) => {
    const on = e.target.checked;
    Audio.enable(on);  // master + sfx + bgm 一齊切
    TTS.setEnabled(on);
    $('btn-sound').innerHTML = on ? SOUND_ON_ICON : SOUND_OFF_ICON;
    $('btn-sound').setAttribute('aria-pressed', String(on));
    syncAudioSettingsUI();
  };
  if (sfxCb) sfxCb.onchange = (e) => { Audio.setChannel('sfx', e.target.checked); };
  if (bgmCb) bgmCb.onchange = (e) => {
    Audio.setChannel('bgm', e.target.checked);
    // 開返 → 立即啟動（如果 game running）；關 → startBGM 內部會 noop
    if (e.target.checked && Game.state && Game.state.running) Audio.startBGM();
    else if (!e.target.checked) Audio.stopBGM();
    if (typeof syncBgmButtonsUI === 'function') syncBgmButtonsUI();
  };
  if (ttsCb) ttsCb.onchange = (e) => { TTS.setEnabled(e.target.checked); };
  //   ⚠️ 0 係合法值 → 唔可以用 `|| 1`（falsy bug）。
  const volSlider = $('td-audio-volume');
  if (volSlider) {
    const applyVol = () => {
      const pct = Number(volSlider.value);
      const v = Audio.setMasterVolume(Number.isFinite(pct) ? pct / 100 : 1);
      const val = $('td-audio-volume-val');
      if (val) val.textContent = Math.round(v * 100) + '%';
      // 持久化（跨 session / 跨課堂保留）
      Profile.data.masterVolume = v;
      if (typeof Profile.save === 'function') Profile.save();
    };
    volSlider.oninput = applyVol;
    volSlider.onchange = applyVol;
  }
    // V3.5-P0: Karaoke toggle — 切換時清乾淨任何 ac
  if (karaokeCb) karaokeCb.onchange = (e) => {
    Game.settings.ttsKaraoke = e.target.checked;
    if (!e.target.checked) {
      document.querySelectorAll('.tts-tok.tts-active')
        .forEach(t => t.classList.remove('tts-active'));
    }
    // P1-A: persist via Snapshot (rides along existing settings spread — no schema bump)
    if (typeof Snapshot !== 'undefined' && Snapshot.schedule) {
      Snapshot.schedule('tts-karaoke-toggle');
    }
    announceToA11y(`TTS 同步高亮已${e.target.checked ? '開啟' : '關閉'}`);
  };
    // V3.5-AUDIT11: auto-recommend toggle —
  const adaptiveCb = $('td-adaptive-enabled');
  if (adaptiveCb) adaptiveCb.onchange = (e) => {
    Game.settings.adaptiveEnabled = e.target.checked;
    renderTypePicker();   // 重新 render chips (顯示/隱藏 ✨)
    announceToA11y(`自動推薦已${e.target.checked ? '開啟' : '關閉'}`);
  };
  // chips row toggle (獨立於 a
  const recommendCb = $('td-recommendation-enabled');
  if (recommendCb) recommendCb.onchange = (e) => {
    Game.settings.recommendationEnabled = e.target.checked;
    renderRecommendChips();
    announceToA11y(`推薦題型 chips 已${e.target.checked ? '開啟' : '關閉'}`);
  };
}

/* ============== [7.5] Snapshot / Resume (P1-A) ============== */
// 自動儲存 student profile + 進行中嘅 session，避免 reload loss。
// localStorage quota: ~5MB per origin → cap 每個 session ≤ 256KB
// schema 簡單：profile 解鎖進度 vs session 進行中狀態 分開兩個 key。
const STORAGE = {
  PROFILE_KEY: 'mg2.profile.v1',     // 持久（解鎖 / badged / stats 跨 session）
  SESSION_KEY: 'mg2.session.v1',     // 進行中 session（reload resume 用）
  HISTORY_KEY: 'mg2.history.v1',     // 過往 session report list（teacher dashboard 用）
  BANK_KEY: 'mg2.bank.v4',           // length object skins
  PROFILE_CAP: 64 * 1024,
  SESSION_CAP: 256 * 1024,
  HISTORY_CAP: 512 * 1024,
  BANK_CAP: 64 * 1024,               // 120 題 × ~150 chars ≈ 18KB；cap 寬鬆
    // V3.4-AUDIT3-FIX: dead code removed — 
  // (cap check is inline in save()). Keep one-line stub for legacy callers if any.
  load(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch { return null; }
  },
  save(key, val) {
    try {
      const json = JSON.stringify(val);
      const bytes = json.length;
      const cap = key === STORAGE.PROFILE_KEY ? STORAGE.PROFILE_CAP
                : key === STORAGE.SESSION_KEY  ? STORAGE.SESSION_CAP
                : key === STORAGE.BANK_KEY     ? STORAGE.BANK_CAP
                : STORAGE.HISTORY_CAP;
      if (bytes > cap) {
        console.warn('[STORAGE]', key, 'exceeds cap', bytes, '>', cap, '— skipping save');
        return false;
      }
      localStorage.setItem(key, json);
      return true;
    } catch (e) {
      console.warn('[STORAGE] save failed:', e.message);
      return false;
    }
  },
  clear(key) { try { localStorage.removeItem(key); } catch {} },
};

// ============== Profile (P1-A / P1-B / P1-E) ==============
const Profile = {
  data: {
    studentName: '',
    unlockedBosses: ['forest-troll'],  // 預設解鎖森林巨魔
    unlockedScenes: ['forest'],        // 預設解鎖森林夜景
    unlockedChars: ['knight', 'mage'],  // 預設騎士 / 法師
    badges: [],
    statsByType: { add10:{c:0,w:0}, sub10:{c:0,w:0}, add20:{c:0,w:0}, sub20:{c:0,w:0}, add2d:{c:0,w:0}, sub2d:{c:0,w:0} },
    adaptiveDowngrades: 0,             // 系統降級次數 (P1-B)
    masteredByType: {},                 // V3.5-AUDIT14: per-type mastered state { [typeId]: { since: ts, samples: N } }
    masteredCount: 0,                   // V3.5-AUDIT14: 累計精通次數
    sessionsPlayed: 0,
    lastPlayDate: '',
    masterVolume: 1,                  // 主音量（0..1 slider 值）· 跨 session 保留
  },
  load() {
    const p = STORAGE.load(STORAGE.PROFILE_KEY);
    if (p && typeof p === 'object') {
      // 合併：保留新增 fields
      this.data = { ...this.data, ...p };
    }
    // V3.5-AUDIT8-F11: lazy-migration — 老 u
    // `history / reactionByType / streakByType / errorPattern / statsByType`
    // 等 array/object field。{ ...spread } 只 overwrite 已有 keys,
    // 缺嘅 keys 仍然係 undefined — 之後 .push() 會 crash。
    // 逐個可能缺嘅 field lazy-init default 確保 save() 唔會 crash。
    if (!this.data.statsByType || typeof this.data.statsByType !== 'object') {
      this.data.statsByType = { add10:{c:0,w:0}, sub10:{c:0,w:0}, add20:{c:0,w:0}, sub20:{c:0,w:0}, add2d:{c:0,w:0}, sub2d:{c:0,w:0} };
    }
    if (!Array.isArray(this.data.unlockedBosses) || this.data.unlockedBosses.length === 0) {
      this.data.unlockedBosses = ['forest-troll'];
    } else if (!this.data.unlockedBosses.includes('forest-troll')) {
      this.data.unlockedBosses = ['forest-troll', ...this.data.unlockedBosses];
    }
    if (!Array.isArray(this.data.unlockedScenes)) this.data.unlockedScenes = ['forest'];
    if (!Array.isArray(this.data.unlockedChars)) this.data.unlockedChars = ['knight', 'mage'];
    if (!Array.isArray(this.data.badges)) this.data.badges = [];
    // ⚠️ **0 係合法值**（用戶主音量調到 0 = 靜音）→ 一定要用 `Number.isFinite`，
    //    唔可以用 `|| 1`（0 係 falsy → 會被當成 default，令靜音變返 100%）。
    if (!Number.isFinite(this.data.masterVolume)) this.data.masterVolume = 1;
    if (!this.data.reactionByType || typeof this.data.reactionByType !== 'object') this.data.reactionByType = {};
    if (!this.data.streakByType || typeof this.data.streakByType !== 'object') this.data.streakByType = {};
    if (!Array.isArray(this.data.errorPattern)) this.data.errorPattern = [];
    if (typeof this.data.sessionsPlayed !== 'number') this.data.sessionsPlayed = 0;
    if (typeof this.data.adaptiveDowngrades !== 'number') this.data.adaptiveDowngrades = 0;
    if (typeof this.data.bossWins !== 'number') this.data.bossWins = 0;
    if (!this.data.masteredByType || typeof this.data.masteredByType !== 'object') this.data.masteredByType = {};
    if (typeof this.data.masteredCount !== 'number') this.data.masteredCount = 0;
    if (typeof this.data.studentName !== 'string') this.data.studentName = '';
    if (!this.data.levelByType || typeof this.data.levelByType !== 'object') this.data.levelByType = {};
    if (!this.data.levelStreak || typeof this.data.levelStreak !== 'object') this.data.levelStreak = {};
  },
  save() { STORAGE.save(STORAGE.PROFILE_KEY, this.data); },
  isUnlocked(kind, id) {
    if (kind === 'boss')  return this.data.unlockedBosses.includes(id);
    if (kind === 'scene') return this.data.unlockedScenes.includes(id);
    if (kind === 'char')  return this.data.unlockedChars.includes(id);
    return false;
  },
  unlock(kind, id) {
    const list = kind === 'boss' ? this.data.unlockedBosses
               : kind === 'scene' ? this.data.unlockedScenes
               : this.data.unlockedChars;
    if (!list.includes(id)) list.push(id);
    this.save();
  },
  recordAnswer(type, correct, reactionMs) {
    const t = this.data.statsByType[type];
    if (!t) return;
    if (correct) t.c++; else t.w++;
    // P1-E: reaction time tracking + error pattern (rolling window cap 200)
    if (!this.data.reactionByType) this.data.reactionByType = {};
    if (typeof reactionMs === 'number' && reactionMs >= 0 && reactionMs < 60000) {
      if (!this.data.reactionByType[type]) this.data.reactionByType[type] = [];
      const arr = this.data.reactionByType[type];
      arr.push(reactionMs);
      if (arr.length > 200) arr.shift();
    }
    if (!correct) {
      if (!this.data.errorPattern) this.data.errorPattern = [];
      this.data.errorPattern.push({ type, ts: Date.now() });
      if (this.data.errorPattern.length > 50) this.data.errorPattern.shift();
    } else {
      // E-1: 連對 N streak counter (per type)
      if (!this.data.streakByType) this.data.streakByType = {};
      const s = (this.data.streakByType[type] || 0) + 1;
      this.data.streakByType[type] = s > 30 ? 30 : s;
    }
    this.save();
  },
  // E-2: 答錯→清 streak-counter
  resetStreak(type) {
    if (!this.data.streakByType) return;
    this.data.streakByType[type] = 0;
  },
};

// ============== Session snapshot (P1-A) ==============
const Snapshot = {
  dirty: false,
  saveTimer: null,
    // V3.5-AUDIT8-F10: quota-exceeded → sto
  _quotaExceeded: false,
  schedule(reason = '') {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(reason), 800);
  },
  flush(reason = '') {
    // V3.5-P0: ttsKaraoke rides along via t
    // spreads { ...Game.settings } so any new key on Game.settings persists automatically.
    if (!Game.state.running || Game.state.ended) {
      STORAGE.clear(STORAGE.SESSION_KEY);
      this.dirty = false;
      return;
    }
    if (this._quotaExceeded) {
    // V3.5-AUDIT8-F10: 已經 silently 停 autosa
      // 唔重複 spam logging,但 keep dirty flag 等 UI 知道有 unsaved change。
      return;
    }
    const snap = {
      v: 1,
      savedAt: Date.now(),
      reason,
      settings: { ...Game.settings },
      state: {
        bossHp: Game.state.bossHp,
        bossMaxHp: Game.state.bossMaxHp,
        castle: { ...Game.state.castle },
        teams: JSON.parse(JSON.stringify(Game.state.teams)),
        review: Game.state.review.map(q => ({ text: q.text, answer: q.answer, type: q.type })),
        currentTeam: Game.state.currentTeam,
        timeLeftSec: Game.state.timeLeftSec,
        pendingUlt: Game.state.pendingUlt,
        pendingUltQ: Game.state.pendingUltQ,
        // current question per team — full 重現 (incl mode 等)
        current: JSON.parse(JSON.stringify(Game.state.current)),
        // V3.6-SEN preserve N-question practice goal across resume
        easyGoalTotal: Game.state.easyGoalTotal || 0,
      },
    };
    if (STORAGE.save(STORAGE.SESSION_KEY, snap)) {
      this.dirty = false;
    } else {
    // V3.5-AUDIT8-F10: quota 或其他 write 失敗 —
      // 但保留 in-memory state 玩到完場。reload 唔可以 resume 但新局照玩得。
      this._quotaExceeded = true;
      console.warn('[Snapshot] autosave disabled — storage quota / write failure. Game continues in-memory only.');
    }
  },
    // V3.5-AUDIT8-F10: clear quota flag on 
  _resetQuotaFlag() {
    this._quotaExceeded = false;
  },
  load() {
    const s = STORAGE.load(STORAGE.SESSION_KEY);
    if (!s || s.v !== 1) return null;
    // 過期 (24h) 就當無效，避免 stale resume
    if (Date.now() - s.savedAt > 24 * 3600 * 1000) return null;
    // V3.5-AUDIT8-F09: corrupt-state guard 
    // 第三方 extension 寫花、不完全 JSON 等等。逐個 required key 驗證，
    // missing 即視為 corrupt, return null 觸發新局（避免 reload 一 reload就 instant endGame）。
    if (!s.state || typeof s.state !== 'object') return null;
    if (typeof s.state.bossHp !== 'number' || typeof s.state.bossMaxHp !== 'number') return null;
    if (!s.state.teams || typeof s.state.teams !== 'object') return null;
    if (!s.state.castle || typeof s.state.castle !== 'object') return null;
    if (!s.settings || typeof s.settings !== 'object') return null;
    if (typeof s.savedAt !== 'number') return null;
    return s;
  },
  hasResumable() { return !!this.load(); },
  clear() { STORAGE.clear(STORAGE.SESSION_KEY); },
  // Resume 流程：將 snapshot 寫返 Game.* 然後 refreshAll
  resume() {
    // V3.5-P0: ttsKaraoke restored via { ..
    // merges persisted settings into current Game.settings without schema bump.
    const s = this.load();
    if (!s) return false;
    Game.settings = { ...Game.settings, ...s.settings };
    // V3.5-AUDIT8-F12: review array corrupt
    // 會喺 UI.renderReview() crash。filter 出 sanitized entries。
    const rawReview = Array.isArray(s.state.review) ? s.state.review : [];
    Game.state.review = rawReview
      .filter(q => q && typeof q === 'object' && q.type && q.answer !== undefined)
      .map(q => ({ text: q.text || '', answer: q.answer, type: q.type }));
    // V3.5-AUDIT8-F12: per-team current nul
    const rawCurrent = s.state.current && typeof s.state.current === 'object' ? s.state.current : {};
    Game.state.current = {};
    for (const tm of ['knight', 'mage']) {
      const q = rawCurrent[tm];
      Game.state.current[tm] = (q && typeof q === 'object' && q.type) ? JSON.parse(JSON.stringify(q)) : null;
    }
    Game.state.bossHp = s.state.bossHp;
    Game.state.bossMaxHp = s.state.bossMaxHp;
    Game.state.castle = { ...s.state.castle };
    Game.state.teams = JSON.parse(JSON.stringify(s.state.teams));
    Game.state.currentTeam = s.state.currentTeam || 'knight';
    // V3.4-AUDIT5: timer resume — reduce ti
    // 防 stale timer (e.g. reload 過夜之後 timer 仲以為有 5:00)
    if (s.settings && s.settings.win === 'time' && s.state.timeLeftSec > 0 && s.savedAt) {
      const elapsed = Math.floor((Date.now() - s.savedAt) / 1000);
      Game.state.timeLeftSec = Math.max(0, s.state.timeLeftSec - elapsed);
    } else {
      Game.state.timeLeftSec = s.state.timeLeftSec || 0;
    }
    Game.state.pendingUlt = s.state.pendingUlt;
    Game.state.pendingUltQ = s.state.pendingUltQ;
    // V3.6-SEN restore practice goal (fallback 10 if easy mid-session legacy snap)
    Game.state.easyGoalTotal = typeof s.state.easyGoalTotal === 'number'
      ? s.state.easyGoalTotal
      : (Game.settings.difficulty === 'easy' ? 10 : 0);
    // V3.5-AUDIT6-F04: reset _startAt/_fros
    Game.state._startAt = 0;
    Game.state._frostTickAt = 0;
    Game.state.running = true;
    Game.state.paused = false;
    Game.state.ended = false;
    // V3.5-AUDIT8-F09: soft-resume hint for
    const ageHours = (Date.now() - s.savedAt) / 3600000;
    if (ageHours > 6 && typeof FX !== 'undefined' && FX.screenAlert) {
      FX.screenAlert(`恢復咗一個 ${ageHours.toFixed(1)} 小時前嘅進度`, '#fbbf24');
    }
    return true;
  },
};

// 結束時寫一份 report 入 history（teacher dashboard 用，P1-E）
function archiveReport() {
  const hist = STORAGE.load(STORAGE.HISTORY_KEY) || [];
  const teams = Game.state.teams;
  const total = { c: teams.knight.correct + teams.mage.correct,
                  w: teams.knight.wrong + teams.mage.wrong };
    // V3.5-cycle16+17: per-type snapshot ov
  // — 防止 upgrade 後 settings.types 嘅 typeId 唔 match statsByType 嘅原 typeId
  const perType = {};
  const statTypes = Object.keys(Profile.data.statsByType || {});
  for (const t of statTypes) {
    const s = (Profile.data.statsByType || {})[t] || { c: 0, w: 0 };
    const c = s.c || 0, w = s.w || 0;
    if (c + w > 0) perType[t] = { c, w };
  }
  hist.push({
    ts: Date.now(),
    duration: Game.state.endedAt ? Math.floor((Game.state.endedAt - Game.state.startedAt) / 1000) : 0,
    settings: { ...Game.settings },
    total,
    teams: JSON.parse(JSON.stringify(teams)),
    perType,
    review: Game.state.review.length,
    adaptiveDowngrades: Profile.data.adaptiveDowngrades,
    won: Game.state.bossHp <= 0,
  });
  // 保留最近 50 session
  while (hist.length > 50) hist.shift();
  STORAGE.save(STORAGE.HISTORY_KEY, hist);
}

/* ============== P1-B: Adaptive Difficulty (P1-B) ============== */
// 連錯 3 題 → 降級 / 連對 5 題 → 升級 (lock boundary)
const TYPE_ORDER = ['add10','sub10','add20','sub20','add2d','sub2d'];   // 簡單 → 難
const Adaptive = {
  // Per-type rolling counters — 跨 team 共享一個 counter 易壞，per-team 準確啲
  // NOTE: counters{} is session-only (not persisted). Reload resets all streak state.
  // profile.statsByType persists per-type accuracy, so mastery check survives reload,
  // but the upgrade/downgrade streak does not. Acceptable tradeoff for v3.x.
  counters: {}, // { [team]: { [type]: { streak: int, dir: +1/-1 } } }
  ensure(team, type) {
    if (!this.counters[team]) this.counters[team] = {};
    if (!this.counters[team][type]) this.counters[team][type] = { streak: 0, dir: 0 };
  },
  // 學生可以睇到自己嘅 difficulty level（顯示喺 question card 上面）
  activeLevelFor(team) {
    // 簡化：揀 streak 最高嘅 type 嘅 current level 顯示
    const ts = this.counters[team] || {};
    const counts = {};
    for (const t of Object.keys(ts)) {
      counts[t] = ts[t].streak * ts[t].dir;
    }
    return Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0] || 'add10';
  },
  onCorrect(team, type) {
    this.ensure(team, type);
    const c = this.counters[team][type];
    if (c.dir >= 0) c.streak++;
    else { c.dir = 0; c.streak = 1; }
    // 升級/降級只可以喺 TYPE_ORDER 呢條 ladder 內進行。
    // 原本條件 `TYPE_ORDER.indexOf(type) < TYPE_ORDER.length - 1` 對「唔喺 TYPE_ORDER」
    // 嘅 type 會回 -1 → -1 < 5 = true → 誤判成可升級 → next = TYPE_ORDER[0] = 'add10'。
    // 結果：easy/SEN scope（count20 / compareLength / orderAsc20 / orderDesc20 …）
    // 學生連續答啱 5 題之後，scope 會被靜靜換成 classic 加法題 —— 對 SEN 學生
    // 係內容災難（做緊數數突然變 10+10）。
    // 修正：type 唔喺 ladder → 完全唔做 type 置換（counter 仍然記，mastery 仍然計）。
    const idx = TYPE_ORDER.indexOf(type);
    if (idx < 0) return;
    if (c.streak >= 5 && idx < TYPE_ORDER.length - 1) {
      // 升級
      const next = TYPE_ORDER[idx + 1];
      // 確保 settings.types 有 next；如果 type 唔喺 settings.types，唔動
      if (Game.settings.types.includes(type)) {
        Game.settings.types = Game.settings.types.map(t => t === type ? next : t);
        c.streak = 0;
        c.dir = 0;
        FX.screenAlert(`${TEAM_META[team].name} 升級到 ${next}！`, '#fbbf24');
      }
    }
    // V3.5-AUDIT14: call checkMastery after
    // (避免 statsByType 仲未 bump 嗰陣讀 stat)
  },
  onWrong(team, type) {
    this.ensure(team, type);
    const c = this.counters[team][type];
    if (c.dir <= 0) c.streak++;
    else { c.dir = 0; c.streak = 1; }
    // V3.6 cycle108 P0: 同一個 ladder guard（原本靠 `indexOf(type) > 0` 剛好擋住 -1，
    // 但係隱式、而且一旦 TYPE_ORDER 改動就會再爆）。統一用 idx 明確表達。
    const idx = TYPE_ORDER.indexOf(type);
    if (idx <= 0) return;   // 唔喺 ladder，或者已經係最簡單嗰級 → 唔降級
    if (c.streak >= 3) {
      // 降級
      const prev = TYPE_ORDER[idx - 1];
      // V3.5-AUDIT14: 已經 mastered 嘅 type 唔再降（
      if (this.isMastered(type)) return;
      if (Game.settings.types.includes(type)) {
        Game.settings.types = Game.settings.types.map(t => t === type ? prev : t);
        Profile.data.adaptiveDowngrades = (Profile.data.adaptiveDowngrades || 0) + 1;
        Profile.save();
        c.streak = 0;
        c.dir = 0;
        FX.screenAlert(`${TEAM_META[team].name} 自動調到 ${prev}，再挑戰！`, '#06b6d4');
      }
    }
  },
  reset() { this.counters = {}; },
    // V3.5-AUDIT14: Mastered promote (acc ≥
  // 一旦 mastered：
  //   - onWrong 跳過降級 (保護精通成果)
  //   - suggestNextType 排到 priority=5 (最低，推介俾其他 type)
  //   - type-picker UI 加 ⭐ MASTERED badge
  // 儲存位置：Profile.data.masteredByType[typeId] = { since, samples }
  // (type 跨 team 共享 — 學生個人精通狀態)
  isMastered(typeId) {
    const m = Profile.data.masteredByType || {};
    return !!(m && m[typeId] && typeof m[typeId] === 'object');
  },
  // 觸發點：onCorrect 入面 call。檢查 accuracy + sample size。
  // threshold: acc ≥ 0.9 AND total ≥ 8. First-time promote fires screenAlert + bump masteredCount.
  checkMastery(team, type) {
    try {
      if (this.isMastered(type)) return;     // 已經精通就唔再 trigger
      const s = (Profile.data.statsByType || {})[type];
      if (!s || typeof s !== 'object') return;
      const total = (s.c || 0) + (s.w || 0);
      if (total < 8) return;                  // 樣本太少
      const acc = s.c / total;
      if (acc < 0.9) return;                  // 唔夠準
      if (!Profile.data.masteredByType) Profile.data.masteredByType = {};
      Profile.data.masteredByType[type] = { since: Date.now(), samples: total };
      Profile.data.masteredCount = (Profile.data.masteredCount || 0) + 1;
      Profile.save();
      // 一次性獎勵通知
      const reg = TYPE_REGISTRY[type];
      const label = reg ? reg.label : type;
      const teamName = TEAM_META[team] ? TEAM_META[team].name : team;
      FX.screenAlert(`🏆 ${teamName} 已精通 ${label}！`, '#fbbf24');
      announceToA11y(`已精通 ${label}`);
    } catch (e) { /* 防 Profile / TYPE_REGISTRY 未載入 */ }
  },
    // V3.5-AUDIT11: 自動推薦 next type chips。返回
  // 輸入：team (knight/mage) — per-team stats + counters
  // 輸出：[{ typeId, score, reason }] array，length 1-5 (取決於有幾多 type 有足夠數據)
  // 排序邏輯（按 priority）：
  //   1. weak types (accuracy < 70%) 排先 — 學生需要更多練習
  //   2. 然後 medium (70-90%) — 學生有進步空間
  //   3. 最後 untested (samples < 5) — 學生未試過
  // 同 priority 內再按 accuracy 升冪（越低越 prior），tiebreaker 用 streak 反向。
  suggestNextType(team) {
    const stats = (Profile.data.statsByType) || {};
    const counters = this.counters[team] || {};
    const candidates = [];
    for (const typeId of Object.keys(TYPE_REGISTRY)) {
      const s = stats[typeId] || { c: 0, w: 0 };
      const total = (s.c || 0) + (s.w || 0);
      const acc = total === 0 ? null : s.c / total;
      const counter = counters[typeId] || { streak: 0, dir: 0 };
      let score = 0;
      let reason = '';
      let priority = 99;
      if (total === 0) {
        // 未測試過 — 中等 priority (學生未試過)
        score = 50;
        reason = '未試過';
        priority = 3;
      } else if (acc < 0.7) {
        // weak — 最優先（學生需要 scaffolding）
        score = 100 - Math.round(acc * 100);  // 30% acc → score 70
        reason = `弱 (${Math.round(acc * 100)}%)`;
        priority = 1;
      } else if (acc < 0.9) {
        // medium — 次優先
        score = 50 - Math.round(acc * 100);  // 80% acc → score 30
        reason = `可進步 (${Math.round(acc * 100)}%)`;
        priority = 2;
      } else {
        // strong — 最低 priority（學生已經識）
        score = 10;
        reason = `已精通 (${Math.round(acc * 100)}%)`;
        priority = 4;
      }
    // V3.5-AUDIT14: mastered 狀態排到 priority=
      // 系統想推其他 type 俾學生練，唔再重複 mastered)。
      if (this.isMastered(typeId)) {
        priority = 5;
        reason = `⭐ 已精通 (${Math.round((acc || 0) * 100)}%)`;
      }
      // Streak tiebreaker: 高 streak 加分（學生喺度 build momentum）
      if (counter.streak >= 3) score += counter.streak;
      candidates.push({ typeId, score, reason, priority, acc, total });
    }
    // 排序：priority 升冪，score 降冪，typeId 字典序做 stable tiebreaker
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.score !== b.score) return b.score - a.score;
      return a.typeId.localeCompare(b.typeId);
    });
    // 只 return top 5 (UI 唔需要太長)
    return candidates.slice(0, 5);
  },
  // Helper: 攞 top N recommended types (just IDs)
  topRecommendations(team, n = 3) {
    return this.suggestNextType(team).slice(0, n).map(c => c.typeId);
  },
  /* weighted recommend (current 60% + last 10 sessions 40%) */
  HISTORY_WEIGHT: 0.4,    // 40% weight 過往 sessions
  CURRENT_WEIGHT: 0.6,    // 60% weight current session
  HISTORY_WINDOW: 10,     // last N sessions 計 aggregate
  // Aggregate per-type accuracy from HISTORY (last N sessions with perType snapshot)。
  // Returns { [typeId]: { accuracy, samples } } — accuracy null if 冇 data。
  _aggregateHistoryAccuracy(window) {
    const n = window || this.HISTORY_WINDOW;
    const recent = (STORAGE.load(STORAGE.HISTORY_KEY) || []).slice(-n);
    const acc = {};
    for (const session of recent) {
      const pt = session.perType || {};
      for (const typeId of Object.keys(pt)) {
        const s = pt[typeId] || { c: 0, w: 0 };
        if (!acc[typeId]) acc[typeId] = { c: 0, w: 0 };
        acc[typeId].c += s.c || 0;
        acc[typeId].w += s.w || 0;
      }
    }
    const result = {};
    for (const typeId of Object.keys(acc)) {
      const s = acc[typeId];
      const total = s.c + s.w;
      result[typeId] = {
        accuracy: total === 0 ? null : s.c / total,
        samples: total,
      };
    }
    return result;
  },
  // Weighted score: current (60%) + history (40%); null 同 null → null
  _weightedTypeAccuracy(typeId, histAcc) {
    const stats = (Profile.data.statsByType || {})[typeId] || { c: 0, w: 0 };
    const cNow = stats.c || 0, wNow = stats.w || 0;
    const totalNow = cNow + wNow;
    const curAcc = totalNow === 0 ? null : cNow / totalNow;
    const h = histAcc[typeId] || { accuracy: null, samples: 0 };
    if (curAcc === null && h.accuracy === null) return { accuracy: null, samples: totalNow + h.samples };
    if (curAcc === null) return { accuracy: h.accuracy, samples: totalNow + h.samples };
    if (h.accuracy === null) return { accuracy: curAcc, samples: totalNow + h.samples };
    return {
      accuracy: curAcc * this.CURRENT_WEIGHT + h.accuracy * this.HISTORY_WEIGHT,
      samples: totalNow + h.samples,
    };
  },
  // 自動推薦 with history — 5 types, lowest weighted accuracy first (pure)
  recommendWithHistory(team, n = 5) {
    const histAcc = this._aggregateHistoryAccuracy(this.HISTORY_WINDOW);
    const counters = this.counters[team] || {};
    const candidates = [];
    for (const typeId of Object.keys(TYPE_REGISTRY)) {
      const w = this._weightedTypeAccuracy(typeId, histAcc);
      const reg = TYPE_REGISTRY[typeId];
      const counter = counters[typeId] || { streak: 0, dir: 0 };
      let priority, reason, score;
      if (w.accuracy === null) {
        // Cold start → tiebreaker by difficulty level (5 easiest first)
        priority = 3;
        score = 100 - (reg.difficulty || 1) * 10;
        reason = `未試過 · 難度 ${reg.difficulty}`;
      } else if (w.accuracy < 0.7) {
        priority = 1;
        score = 100 - Math.round(w.accuracy * 100);
        reason = `弱 (${Math.round(w.accuracy * 100)}%)`;
      } else if (w.accuracy < 0.9) {
        priority = 2;
        score = 50 - Math.round(w.accuracy * 100);
        reason = `可進步 (${Math.round(w.accuracy * 100)}%)`;
      } else {
        priority = 4;
        score = 10;
        reason = `已精通 (${Math.round(w.accuracy * 100)}%)`;
      }
      if (this.isMastered(typeId)) {
        priority = 5;
        reason = `⭐ 已精通 (${Math.round((w.accuracy || 0) * 100)}%)`;
      }
      // Streak tiebreaker — momentum
      if (counter.streak >= 3) score += counter.streak;
      candidates.push({ typeId, score, reason, priority, accuracy: w.accuracy, samples: w.samples });
    }
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.score !== b.score) return b.score - a.score;
      return a.typeId.localeCompare(b.typeId);
    });
    return candidates.slice(0, n);
  },
};

/* ============== P1-C: Boss registry + 解鎖流程 ============== */
const Bosses = {
  list: [
    {
      id: 'forest-troll',
      name: '森林巨魔',
      emoji: '👹',
      sprite: 'px-troll',
      hpDefault: 200,
      hpRange: [200, 500],
      scene: 'forest',
      ability: 'castle-burst',     // 每 8s 攻擊 castle
      unlocked: true,
      unlockWins: 0,                // 預設解鎖
    },
    {
      id: 'frost-giant',
      name: '冰霜巨人',
      emoji: '❄️',
      sprite: 'px-frost',
      hpDefault: 400,
      hpRange: [400, 800],
      scene: 'snow',
      ability: 'frost-blast',       // 攻擊後隨機 ice-frost 題目 3s
      unlocked: false,
      unlockHint: '先擊敗森林巨魔',
      unlockWins: 1,                // 贏 1 次 forest-troll 解鎖
    },
    {
      id: 'lava-giant',
      name: '熔岩巨人',
      emoji: '🔥',
      sprite: 'px-lava',
      hpDefault: 600,
      hpRange: [600, 1200],
      scene: 'lava',
      ability: 'fire-burn',         // 燒題: 每 5 題 random 跳題
      unlocked: false,
      unlockHint: '累計擊敗 3 隻 Boss',
      unlockWins: 3,
    },
    {
      id: 'shadow-dragon',
      name: '暗影龍',
      emoji: '🐉',
      sprite: 'px-shadow',
      hpDefault: 800,
      hpRange: [800, 1500],
      scene: 'shadow',
      ability: 'dark-hide',         // 暗題: 3s 隱藏 option labels
      unlocked: false,
      unlockHint: '累計擊敗 5 隻 Boss',
      unlockWins: 5,
    },
    {
      id: 'crystal-golem',
      name: '水晶魔像',
      emoji: '💎',
      sprite: 'px-crystal',
      hpDefault: 1000,
      hpRange: [1000, 2000],
      scene: 'crystal',
      ability: 'reflect-retry',     // 反射: 錯嘅選項 free retry
      unlocked: false,
      unlockHint: '累計擊敗 10 隻 Boss',
      unlockWins: 10,
    },
  ],
  current: null,
  selectById(id) {
    const b = this.list.find(x => x.id === id);
    if (!b) return null;
    if (!Profile.isUnlocked('boss', id)) return null;
    this.current = b;
    return b;
  },
  // 勝利後自動 unlock 下一隻
  onDefeat() {
    // win-chain unlock — 累計擊敗 N 隻 Boss 解鎖下一隻
    const winCount = (Profile.data.bossWins || 0) + 1;
    Profile.data.bossWins = winCount;
    Profile.save();
    this.list.forEach(b => {
      if (b.unlocked) return;
      if (Profile.isUnlocked('boss', b.id)) return;
      if ((b.unlockWins || 0) <= winCount) {
        Profile.unlock('boss', b.id);
        Profile.unlock('scene', b.scene);
        FX.screenAlert(`🆕 解鎖新 Boss: ${b.emoji}${b.name}！`, '#10b981');
      }
    });
  },
  available() {
    return this.list.filter(b => Profile.isUnlocked('boss', b.id));
  },
};

/* ============== [8] 啟動 ============== */
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  setupMenu();
  setupUltButtons();
  setupTeacher();
  // 預設選擇 — v3.1 透過 renderTypePicker 處理
  Game.settings.types = ['add10'];
  renderTypePicker();
  renderRecommendChips();   // chips row
  // P1-A: 載入 profile + 檢查 resume
  Profile.load();
  //   真正開 context 時 ensureGraph() 會用返呢個值）
  Audio.setMasterVolume(Profile.data.masterVolume);
    // lazy-migrate recommenda
  if (typeof Game.settings.recommendationEnabled !== 'boolean') {
    Game.settings.recommendationEnabled = true;
  }
  // after Profile.load — ensure boss + re-render select (setupMenu ran first)
  if (!Bosses.current || !Profile.isUnlocked('boss', Bosses.current.id)) {
    Bosses.current = Bosses.list[0];
    if (typeof Bosses.selectById === 'function') {
      Bosses.selectById('forest-troll') || (Bosses.current = Bosses.list[0]);
    }
  }
  if (typeof renderBossSelect === 'function') renderBossSelect();
  if (Snapshot.hasResumable() && !location.search.includes('autostart=1')) {
    const btn = document.createElement('button');
    btn.textContent = '▶ 繼續上次遊戲';
    btn.className = 'btn btn-knight fixed top-3 right-3 z-50 text-sm px-3 py-2';
    btn.setAttribute('aria-label', '繼續上次遊戲 — 載入上次 session 嘅進度');
    btn.onclick = () => {
      if (Snapshot.resume()) {
        $('screen-menu').classList.add('hidden');
        $('screen-end').classList.add('hidden');
        const isEasy = Game.settings.difficulty === 'easy';
        $('screen-game').classList.toggle('hidden', isEasy);
        $('screen-game-sen').classList.toggle('hidden', !isEasy);
        UI.refreshAll();
        if (isEasy) {
          _wireSENScreen();
          UI.refreshSENScreen();
        } else {
          // V3.6 cycle66: resume boss — solo 只開騎士
          UI.showQuestion('knight');
          if (Game.settings.playLayout === 'dual') UI.showQuestion('mage');
        }
        UI.renderReview();
        btn.remove();
        if (window._mgLoop) clearInterval(window._mgLoop);
        window._mgLoop = setInterval(gameLoop, 100);
      }
    };
    document.body.appendChild(btn);
  }
  // 開發模式：autostart=1 直接跳入遊戲（screenshot 用）
  if (location.search.includes('autostart=1')) {
    // dev hook: theme=snow 強制雪山場景、boss=frost-giant 強制冰霜巨人
    if (location.search.includes('theme=snow')) {
      document.body.classList.add('theme-snow');
      // 解鎖 frost giant（測試用）
      Profile.data.unlockedBosses.push('frost-giant');
      Profile.data.unlockedScenes.push('snow');
      Bosses.current = Bosses.list.find(b => b.id === 'frost-giant');
      renderBossSelect();
      const use = document.getElementById('boss-svg-use');
      if (use) use.setAttribute('href', '#px-frost');
      const lbl = document.getElementById('boss-name-label');
      if (lbl) lbl.textContent = Bosses.current.emoji + ' ' + Bosses.current.name;
    }
    setTimeout(() => {
      $('btn-start').click();
      // P1-D DEBUG: 寫 bg 元件 computed style 到 title，方便人工檢查
      setTimeout(() => {
        const fs = document.querySelector('.bg-svg:not(.bg-snow)');
        const bs = document.getElementById('bg-snow');
        const app = document.getElementById('app');
        const log = (el, name) => {
          if (!el) return name + ':NULL';
          const cs = getComputedStyle(el);
          return name + ':disp=' + cs.display + ',z=' + cs.zIndex + ',pos=' + cs.position;
        };
        document.title = '[SNOW]' + log(fs,'forest') + ' | ' + log(bs,'snow') + ' | ' + log(app,'app') + ' | body.theme-snow=' + document.body.classList.contains('theme-snow');
      }, 500);
    }, 200);
  }
  // Dev: per-option click test for direct screenshot verification
  const params = new URLSearchParams(location.search);
  // v3.1: force specific type — e.g. ?force_type=count10&autostart=1
  const forceType = params.get('force_type');
  if (forceType && TYPE_REGISTRY[forceType]) {
    Game.settings.types = [forceType];
  }
  // v3.1: force keypad mode — e.g. ?force_mode=keypad
  const forceMode = params.get('force_mode');
  if (forceMode === 'choice' || forceMode === 'keypad') {
    Game.settings.mode = forceMode;
  }
  // v3.1: simulate answer click — ?force_answer=<sym> 自動 trigger 提交
  const forceAnswer = params.get('force_answer');
  if (forceAnswer && /^[<=>]$/.test(forceAnswer)) {
    setTimeout(() => {
      if (Game.state.current.knight) {
        const q = Game.state.current.knight;
        const correct = String(forceAnswer) === String(q.answer);
        document.title = `answer=${forceAnswer} q.answer=${q.answer} correct=${correct}`;
      }
    }, 1500);
  }
  const testClick = params.get('click_test');
  if (testClick) {
    setTimeout(() => {
      document.querySelectorAll('.opt-win, .opt-mode, .opt-type, .opt-team').forEach(b => {
        if (b.matches(testClick)) {
          console.log('[CLICK_TEST] clicking', testClick);
          b.click();
          console.log('[CLICK_TEST] after click: win=' + Game.settings.win + ' mode=' + Game.settings.mode + ' types=' + JSON.stringify(Game.settings.types) + ' team=' + Game.settings.team);
          document.body.dataset.testResult = b.dataset.win || b.dataset.mode || b.dataset.type || b.dataset.team;
          document.title = 'clicked=' + testClick + ' -> setting=' + document.body.dataset.testResult;
        }
      });
    }, 800);
  }
  // Dev: end=forest / end=frost 直接 render 勝利結算畫面 (screenshot AI bg + defeat portrait)
  if (params.get('end') === 'forest' || params.get('end') === 'frost') {
    setTimeout(() => {
      $('screen-menu').classList.add('hidden');
      $('screen-game').classList.add('hidden');
      $('screen-end').classList.remove('hidden');
      // 強制設定 boss scene
      if (params.get('end') === 'frost') {
        document.body.classList.add('theme-snow');
        Bosses.current = Bosses.list.find(b => b.id === 'frost-giant');
        $('end-title').textContent = '❄ 完成！⭐⭐⭐';
        $('end-message').textContent = '冰霜巨人已被擊退！';
      } else {
        document.body.classList.remove('theme-snow');
        Bosses.current = Bosses.list.find(b => b.id === 'forest-troll');
        $('end-title').textContent = '🏆 完成！⭐⭐⭐';
        $('end-message').textContent = '森林巨魔已被擊退！';
      }
      $('end-stats').innerHTML = `
        <div class="text-sm">⏱ 時長: 4分32秒</div>
        <div class="text-sm">📊 答對: 28 / 36 (78%)</div>
        <div class="text-sm">⚔ 造成傷害: 245</div>
      `;
      // 觸發 P2-a + P2-d 注入 (call showEndScreen 內部 logic)
      showEndScreen(true);
      // showEndScreen 會 override title/msg 由 Game.settings 決定 (real data path)，
      // 我哋 override 入面 demo scenario 嘅文案（boss-killed message）
      if (params.get('end') === 'frost') {
        $('end-title').textContent = '❄ 完成！⭐⭐⭐';
        $('end-message').textContent = '冰霜巨人已被擊退！';
      } else {
        $('end-title').textContent = '🏆 完成！⭐⭐⭐';
        $('end-message').textContent = '森林巨魔已被擊退！';
      }
    }, 200);
  }
  // Dev: teacher=1 直接打開老師 dashboard（已輸入 challenge 答案）
  if (params.get('teacher') === '1') {
    setTimeout(() => {
      $('teacher-modal').classList.remove('hidden');
      $('teacher-modal').classList.add('flex');
      _newTeacherChallenge(); // cycle83: 用 challenge 取代 hardcoded pwd
      $('teacher-pwd').value = String(_teacherChallenge.a);
      $('teacher-pwd').dataset.ok = '1';
      $('teacher-controls').classList.remove('hidden');
      // 注入示範 stats for screenshot — 唔干擾真實用戶 (因為 `teacher=1` 只用於 dev/staging)
      Profile.data.sessionsPlayed = 12;
      Profile.data.statsByType = {
        add10: { c: 78, w: 6 },
        sub10: { c: 64, w: 12 },
        add20: { c: 32, w: 18 },
        sub20: { c: 19, w: 22 },
        add2d: { c: 11, w: 14 },
        sub2d: { c: 4,  w: 18 },
      };
      Profile.data.adaptiveDowngrades = 7;
      Profile.data.reactionByType = {
        add10: [3200, 2800, 2400, 1900, 1700, 1500, 1300, 1100],
        sub10: [4100, 3800, 3500, 3200, 2900, 2700, 2500],
        add20: [6200, 5800, 5400, 5100],
        sub20: [7800, 7200, 6900, 6500],
        add2d: [9500, 9100, 8800],
        sub2d: [12000, 11500, 11200],
      };
      Profile.data.errorPattern = [];
      for (let i = 0; i < 8; i++) Profile.data.errorPattern.push({ type:'sub2d', ts: Date.now() - i*60000 });
      for (let i = 0; i < 5; i++) Profile.data.errorPattern.push({ type:'sub20', ts: Date.now() - i*30000 });
      for (let i = 0; i < 3; i++) Profile.data.errorPattern.push({ type:'add2d', ts: Date.now() - i*15000 });
      // Demo history (5 場)
      STORAGE.save(STORAGE.HISTORY_KEY, [
        { ts: Date.now() - 86400000*5, duration: 480, won: true,  total: { c: 22, w: 8 },  review: 4, settings: { boss:'forest-troll', mode:'choice', team:'coop',  types:['add10','sub10'] } },
        { ts: Date.now() - 86400000*4, duration: 360, won: false, total: { c: 15, w: 18 }, review: 7, settings: { boss:'forest-troll', mode:'choice', team:'coop',  types:['add10','sub10','add20'] } },
        { ts: Date.now() - 86400000*3, duration: 540, won: true,  total: { c: 28, w: 12 }, review: 5, settings: { boss:'frost-giant', mode:'keypad', team:'versus', types:['add10','sub10','sub20'] } },
        { ts: Date.now() - 86400000*2, duration: 420, won: true,  total: { c: 25, w: 14 }, review: 6, settings: { boss:'forest-troll', mode:'choice', team:'coop',  types:['add20','sub20'] } },
        { ts: Date.now() - 86400000*1, duration: 600, won: false, total: { c: 30, w: 25 }, review: 9, settings: { boss:'forest-troll', mode:'keypad', team:'coop',  types:['add2d','sub2d'] } },
      ]);
      TeacherDashboard.render();
    }, 200);
  }

    // V3.4-AUDIT5: beforeunload guard to pr
  // Snapshot 已 throttle 800ms，但 user 答完一題後可能 800ms 內關 tab → 進度丟失
  // 用 beforeunload 強制 flush + 設 returnValue 觸發 browser "Leave site?" 提示
  window.addEventListener('beforeunload', (e) => {
    if (Game.state && Game.state.running && !Game.state.ended) {
      Snapshot.flush('beforeunload');  // 同步 save，唔等 800ms throttle
      e.preventDefault();
      e.returnValue = '';  // Chrome / Firefox 需要 non-undefined returnValue 先觸發提示
      return '';
    }
  });
  // pagehide 喺 mobile / iOS Safari 先 fire，比 beforeunload 更可靠
  window.addEventListener('pagehide', () => {
    if (Game.state && Game.state.running && !Game.state.ended) {
      Snapshot.flush('pagehide');
      // iOS Safari pagehide 無 returnValue 機制；純 save
    }
  });
});

// 雙位數題型預設時，順便把雙位數題型高亮取消（已加 class），確保單選可工作
// 監聽 mobile keyboard 不彈出（for keypad mode，input 隱藏）
document.addEventListener('touchstart', () => Audio.prime(), { once: true });

    // V3.3-A5: audio auto-mute on tab hidde
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 記住當前 BGM 狀態，停 BGM
    // → 切返嚟 BGM 唔會恢復。改用 export 出嚟嘅 isPlaying() accessor。
    _wasPlayingBGM = Audio.isPlaying();
    if (_wasPlayingBGM) Audio.stopBGM();
  } else {
    // 恢復 BGM（如遊戲運行中）
    if (_wasPlayingBGM && Game.state && Game.state.running) Audio.startBGM();
    _wasPlayingBGM = false;
  }
});

    // V3.3-U5: keyboard shortcuts (1-9 choi
document.addEventListener('keydown', (e) => {
  // 跳過 input/textarea (future-proof，唔影響 v3.3 單層 UI)
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    // V3.4-AUDIT5: T 鍵 retry (P1) — 唔需要 mou
  // (modifier-free 觸發；teacher demo 常用 — 'T' = Teacher / Try again)
  if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (revealLatestReviewAnswer()) {
      e.preventDefault();
      return;
    }
  }
    // V3.4-AUDIT2-FIX: game-state guard for
  // 若 menu 內另有相同 class (e.g. dev probe / future layout)
  // 會誤觸。統一用 running + screen-game 雙 gate。
  const inGameScreen = $('screen-game') && !$('screen-game').classList.contains('hidden');
  // Space → pause / resume
    // V3.4-AUDIT-FIX: 移除 lazy pause-overlay
  // 永遠唔會係 null — lazy branch 係 dead code。改用 HTML overlay 統一處理。
  // 老師控制台開咗嗰陣 keyboard-pause 唔 trigger (避免覆蓋 teacher-pause UX)。
    // V3.4-AUDIT4-FIX: BUTTON focus 時 Space
  if (e.key === ' ') {
    // 焦點喺 button / a 等 clickable element 嗰陣,讓瀏覽器原生 Space-activate (唔 preventDefault)
    const t = e.target;
    if (t && (t.tagName === 'BUTTON' || t.tagName === 'A')) return;
    e.preventDefault();
    const pauseOverlay = $('pause-overlay');
    if (!pauseOverlay) return;
    const teacherOpen = $('teacher-modal') && !$('teacher-modal').classList.contains('hidden');
    if (!pauseOverlay.classList.contains('hidden')) {
      // resume (無論 teacher-pause 定 keyboard-pause)
      pauseOverlay.classList.add('hidden');
      Game.state.paused = false;
      Game.state.running = true;
      if (pauseOverlay._trapDispose) { pauseOverlay._trapDispose(); pauseOverlay._trapDispose = null; }
    } else if (Game.state && Game.state.running && !teacherOpen) {
      // keyboard-pause: 只喺冇 teacher modal 嗰陣先 trigger
      Game.state.paused = true;
      pauseOverlay.classList.remove('hidden');
    // V3.4-AUDIT4: focus resume button + fo
      setTimeout(() => $('pause-resume-2').focus(), 50);
      if (!pauseOverlay._trapDispose) {
        pauseOverlay._trapDispose = trapFocusInModal(pauseOverlay);
      }
    }
    return;
  }
    // V3.4-AUDIT2-FIX: 只喺 running + inGameS
  const keyboardActive = Game.state && Game.state.running && !Game.state.paused && !Game.state.ended && inGameScreen;
  if (!keyboardActive) return;
  // V3.6-SEN: no keyboard shortcuts in easy mode — prevents accidental input
  if (Game.settings.difficulty === 'easy') return;
  // Backspace → keypad clear (only if keypad exists)
  if (e.key === 'Backspace' && document.querySelector('.key-btn.clear')) {
    document.querySelector('.key-btn.clear').click();
    return;
  }
  // Enter → keypad OK
  if (e.key === 'Enter' && document.querySelector('.key-btn.ok, .key-btn.fn')) {
    const ok = document.querySelector('.key-btn.ok, .key-btn.fn');
    ok.click();
    return;
  }
  // 1-9 → choice option (only if option buttons exist with text)
  if (/^[1-9]$/.test(e.key)) {
    const opts = document.querySelectorAll('.option-btn, .q-order-btn, .q-sym-btn');
    if (opts.length >= parseInt(e.key, 10)) {
      opts[parseInt(e.key, 10) - 1].click();
      return;
    }
  }
});
