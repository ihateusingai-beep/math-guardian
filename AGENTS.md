# AGENTS.md

Math Guardian (數學守護者：精準訓練版 **v3.6**) — single-file HTML SPA
for Hong Kong moderate-ID SEN math practice (easy scopes + dual board).
Vanilla JS + Tailwind CDN, no build, GitHub Pages.

## Setup

- Open `index.html` or `python3 -m http.server 8000`
- Tests: `node tests/regression.js` → **463 pass / 0 fail** (cycle 53–59)
- No lint / typecheck / build
- Live: https://ihateusingai-beep.github.io/math-guardian/

## Layout

```
.
├── index.html              # entire runtime (~382 KB)
├── TODO.md                 # project plan / next backlog
├── tests/regression.js     # structural regex lock-in
└── .harness/               # changelogs, docs, plans
```

## Gates (every cycle)

1. `node tests/regression.js` → 0 fail  
2. Extract largest inline `<script>` → `node --check`  
3. Optional live probe: easy startGame per scope + dual arena  
4. One cycle = one commit message style: `Math Guardian v3.6 — cycle N (…)`  
5. Ken **`Push`/`Live`/`順序`** = commit + push `main` (Pages). AGENTS “don’t push” overridden by Ken.

## Lock-in discipline

- Every behavior change lands a matching assertion in `tests/regression.js`
- Assertions = source regex only (no DOM)
- File budget: `index.html` raw **&lt; 600 KB**
- Student UI: **no** stigma「SEN」label; MC **A/B/C** badges by **render order**
- `startGame`/resume helpers must be **module scope** (not nested in `setupMenu`)

## Architecture ground truth (v3.6)

### Easy main path
- Home **scopes**: `count20` (1–10) · `compareLength` · `orderAsc20` · `orderDesc20`
- One-click start: `types = scopes` · 10 Q goal · identity card · 金銀銅
- Play: `solo` | `dual` touch-board；dual arena `versus` 扯大欖 / `coop` 推船
- **cycle52**: dual easy-start must **keep** versus/coop pick (never force coop)

### Question pipeline
- `TYPE_REGISTRY` + `Generators` + `QuestionGen.make` + bank rotate (`mg2.bank.v3`)
- Layouts: numeric / parts-emoji / bars / seq-choice / clock / shape / order / …
- `QuestionRenderer` must cover every layout used
- SEN screen: `showQuestionSEN` + `SEN_COPY` + visuals (`_countVisualHTML`, `_lengthBarsHTML`)

### cycle53–59 (TODO batch)
| # | Change |
|---|--------|
| 53 | 長短答案 **黃條/紫條**（唔用 A/B 撞手勢） |
| 54 | 數數 grid **每 5 一行** |
| 55 | 順序 = 兩數後 **邊個跟住？** |
| 56 | diff-helper + 進階「老師覆寫」 |
| 57 | scope bank seeds + bank v3 |
| 59 | onboarding 3 步；dual 藏 length units |

### Shared helpers (do not duplicate)
`_lengthBarsHTML` · `_appendChoiceGrid` · `_countVisualHTML` · `_isEasyMode/_isDualPlay/_isCoopTeam` · `_teamEmoji` · `_pulseEl` · `SEN_COPY`

## Testing notes

- Structural only; body growth may need **wider** regex windows (see EASY/F-17 history)
- New type → update T1 `expectedIds` + layouts + EASY lock-ins

## Security

- No secrets in source. Optional MiniMax key only via teacher modal runtime paste.
- localStorage `mg2.*` namespaced; no PII required.

## Plan pointer

- Active backlog: `TODO.md`
- Historical v3.5 P0 (TTS karaoke / 推薦 / bank) = **SHIPPED** — see `.harness/docs/v35-roadmap.md`
