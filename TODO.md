# Math Guardian — Project Plan / TODO

> **For Hermes:** one cycle = one feature. Ken: `FIX ONE` unless `順序`/`順序做` = whole plan autonomous.  
> **Push** = commit + push live Pages. Gates green first.

**Goal:** 將軍澳培智中度 SEN 數學課堂可用 — 單檔 SPA、圖選/手勢 A-B-C、solo/dual、穩定 regression。

**Live:** https://ihateusingai-beep.github.io/math-guardian/  
**Local:** `~/workspace/vs code/education/math/team game`  
**Stack:** `index.html` (vanilla JS + Tailwind CDN) · `tests/regression.js` · GitHub Pages · no build

---

## 0. 現況（baseline · 2026-10-05 · post cycle 53–59）

| 項 | 值 |
|---|---|
| Version | **v3.6** · cycle **53–59** batch |
| Tests | **463 pass / 0 fail** |
| Size | `index.html` ~382 KB（budget &lt; 600 KB） |
| Core done | easy scopes · solo/dual arena · 黃/紫長短 · 數數分5 · 順序跟住 · bank v3 |

---

## 1. DONE

- [x] **c37–52** （見 git log / 舊 changelog）
- [x] **c53 N1** 長短 黃條/紫條（唔撞手勢 A/B）
- [x] **c54 N2** 數數每 5 一行
- [x] **c55 N3** 順序「邊個跟住？」
- [x] **c56 N4+N5** diff-helper + 老師覆寫標
- [x] **c57 N8** 4 scope bank seed + `mg2.bank.v3`
- [x] **c58 N9–N11** AGENTS / changelog / roadmap
- [x] **c59 N6+N7** onboarding 3 步 + dual 藏 units

---

## 2. NEXT（可選 · 未做）

### P2
- [ ] N12 size watch / dead code 若逼近 500 KB
- [ ] classroom dogfood 修（實課後）

### P3 願望
- [ ] Boss gallery / parent dashboard / cloud sync / 多語 TTS
- [ ] Co-op boss 2P 1 boss
- [ ] 課堂報表 PDF

---

## 3. 指令

- `1` / `N12` → 單項  
- `順序` → batch  
- `Push` / `Live` → gates + commit + Pages  
- `NT-D` → 審計 only

**Live:** https://ihateusingai-beep.github.io/math-guardian/