# Math Guardian — Deployment Guide

## Current Live

- **GitHub Pages**: https://ihateusingai-beep.github.io/math-guardian/
- **Repo**: https://github.com/ihateusingai-beep/math-guardian

## Custom Domain Setup

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

### 3. Update `CNAME` file (this repo)

```bash
echo "yourdomain.com" > CNAME
git add CNAME
git commit -m "Set custom domain"
git push
```

### 4. GitHub Pages settings

1. Repo → Settings → Pages
2. **Custom domain**: 打你嘅 domain
3. **Enforce HTTPS**: ✅ (等 DNS propagate 完先 enable)

DNS propagation 通常 10 分鐘 ~ 24 小時。

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
