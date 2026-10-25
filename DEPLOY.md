# Math Guardian — Deployment Guide

## Current Live

- **GitHub Pages**: https://ihateusingai-beep.github.io/math-guardian/
- **Repo**: https://github.com/ihateusingai-beep/math-guardian

> ⚠️ **2026-10-25 (cycle 107) — placeholder domain 事故已修復**
>
> cycle 96 加咗 `CNAME` file，內容係 `mathguardian.kencheng.dev`。嗰個係 **DEPLOY.md 下面寫住嘅例子域名**，
> 從來冇喺 registrar 註冊過。GitHub Pages 一有 `CNAME` 就會令 `ihateusingai-beep.github.io/math-guardian/`
> **301 轉去該域名**，但該域名喺公開 DNS 係 NXDOMAIN —— 即係話 **2026-10-16 起，線上站喺
> 個已記錄嘅 live URL 一直開唔到**（學生/老師由文件入面個 URL 進去會撞死域）。
>
> **修復**：`CNAME` file 已刪除；Pages 回復喺 `ihateusingai-beep.github.io/math-guardian/` 服務
> （即係本文件、AGENTS.md、TODO.md 一直寫嘅 URL）；`index.html` 嘅 Plausible `data-domain`
> 亦由 placeholder 改為實際 host `ihateusingai-beep.github.io`。
>
> `tests/regression.js` 嘅 **T107** 段會鎖住呢個狀態：唔准再出現未註冊嘅 placeholder 域名。

## Custom Domain Setup

> **做之前先睇清楚**：一定要 **先喺 registrar 註冊域名 + 加好 DNS（A / CNAME record）**，
> 確認 `dig +short 你的域名` 有出 IP 咗，**先至**做下面 step 3-4 加 `CNAME` file。
> 步驟倒轉（先加 `CNAME` 後加 DNS）會令 GitHub 即刻 301 轉去一個仲未生效嘅域，
> 線上站會當場開唔到 —— 2026-10-16 就係咁出事，擺咗 9 日先發現。

### 1. Pick + register a domain

Recommended registrars (HK-friendly):
- Cloudflare Registrar (~成本價)
- Namecheap
- Porkbun

Examples:
- `mathguardian.kencheng.dev` (subdomain)
- `mathguardian.school.hk` (custom)

### 2. Configure DNS

喺 registrar 嘅 DNS panel 加：

```
CNAME  @  ihateusingai-beep.github.io
```

或者用 A records：

```
A  @  185.199.108.153
A  @  185.199.109.153
A  @  185.199.110.153
A  @  185.199.111.153
```

**驗證 DNS 已生效**（未出 IP 就唔好撳下一步）：

```bash
dig +short 你的域名          # 應列出 185.199.108-111.153
curl -sI https://你的域名/    # 應回 200（唔係 301 去第個域）
```

### 3. Update `CNAME` file (this repo)

> ⚠️ 只喺 step 2 驗證通過後先做。

```bash
echo "yourdomain.com" > CNAME
git add CNAME
git commit -m "Set custom domain"
git push
```

### 4. GitHub Pages settings

1. Repo → Settings → Pages
2. **Custom domain**: 打你嘅 domain
3. **Enforce HTTPS**: ✅（等 DNS propagate 完先 enable）

DNS propagation 通常 10 分鐘 ~ 24 小時。

### 5. 同步 Plausible `data-domain`

`index.html` head 嘅 `data-domain` 要同實際 host 一致：

```html
<script defer data-domain="yourdomain.com" 
  src="https://plausible.io/js/script.tagged-events.js"></script>
```

> Plausible 需要喺佢 dashboard 加同一個 domain 先收到 data（DNS TXT 或檔案驗證）。
> `ihateusingai-beep.github.io` 呢類共用域名冇法加 TXT record —— 所以
> **有自訂域名之前，analytics 係收唔到 data 嘅，唔好誤會係 bug**。

## Plausible Analytics

Privacy-friendly、冇 cookie、GDPR/CCPA 合規。

### Setup

1. 開 https://plausible.io (免費試用 30 日；其後 $9/月)
2. Add site: `yourdomain.com`
3. 改 `index.html` head 嘅 `data-domain`:

```html
<script defer data-domain="yourdomain.com" 
  src="https://plausible.io/js/script.tagged-events.js"></script>
```

### Custom events (already wired in code)

- `game_start` — 玩家撳「開始」: scope / play / difficulty
- `game_end` — 一局完: victory / scope / duration_sec / correct / wrong

Dashboard 自動 collect pageviews + custom events。

## 部署 workflow

```bash
# 本地測試
python3 -m http.server 8000
# browser: http://localhost:8000

# Commit + push (GitHub Pages 自動 deploy)
git add -A
git commit -m "v3.6 cycle N — <description>"
git push origin main
# 30 秒後 live
```

## SEO + Sharing

`index.html` head 已經有：
- `<title>`, `<meta name="description">`
- Open Graph (`og:title`, `og:description`, `og:type`)

如要 og:image，可以加：

```html
<meta property="og:image" content="https://yourdomain.com/og.png" />
```

## SSL/HTTPS

GitHub Pages 自動 provision Let's Encrypt 證書。等 DNS 生效後 enable "Enforce HTTPS"。

## Troubleshooting

| 問題 | 解 |
|---|---|
| Custom domain 404 | 等 DNS propagation (10-24hr)，檢查 CNAME / A record |
| Mixed content warning | 全部 asset 改用 https:// |
| Plausible 冇 data | 檢查 adblock，pump.io domain 設定啱冇 |
| GitHub Pages 唔 build | Settings → Pages → Source 揀 `main` branch + `/ (root)` |
