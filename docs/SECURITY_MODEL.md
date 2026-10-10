# 安全模型 (SECURITY MODEL)

## 风险定位
公开分享的教学网站，无登录即敏感操作；主要威胁为注入、滥用/刷接口、信息探测、XSS、依赖漏洞、容器逃逸。

## 信任边界
```
互联网（不可信输入）
 → Nginx（限流/头部/路径封禁）[边界1]
 → Node server function（zod 校验）[边界2]
 → 参数化 SQL → PostgreSQL / PGLite [边界3]
```

## 威胁与缓解
| 威胁 | 缓解 | 状态 |
|---|---|---|
| SQL 注入 | 参数化占位符 `$1..`，禁止字符串拼接 | 已实施 |
| 非法/超长输入 | zod 白名单、枚举、长度上限 | 已实施 |
| XSS | CSP 内容安全策略、React 默认转义、object-src none | 已实施 |
| 点击劫持 | X-Frame-Options SAMEORIGIN / frame-ancestors self | 已实施 |
| MIME 嗅探 | X-Content-Type-Options nosniff | 已实施 |
| 滥用/爆破/刷接口 | Nginx limit_req（页面20r/s，接口8r/s）+ limit_conn | 已实施，实测 429 |
| 探测 .git/.env 等 | Nginx 返回 404 + Fail2ban 自动封 IP | 已实施 |
| 自动扫描攻击 | Fail2ban nginx-noscript / nginx-abuse | 已实施 |
| SSH 爆破 | Fail2ban sshd（5 次封 1 天） | 已实施 |
| 版本指纹 | server_tokens off；无 X-Powered-By | 已实施 |
| 容器逃逸 | 非 root 用户 nodeapp(uid100) 运行 | 已实施 |
| 依赖漏洞 | npm audit（生产依赖 0 漏洞） | 已检查 |
| 源码泄露 | 无 sourcemap、仓库无密钥/.env | 已检查 |
| 慢速攻击 | 各类超时收紧、client_max_body_size 2m | 已实施 |

## 最小权限
- server function 仅允许必要输入；外部调用设超时。
- 容器非 root；端口仅映射到 127.0.0.1:8080，由 Nginx 暴露 80。
- 高风险/破坏性操作需人工确认。

## 密钥管理
- 无硬编码密钥；`.env` 不入库；DATABASE_URL 由环境注入。
- 服务器 root 密码建议在腾讯云控制台定期重置。

## 残余风险与后续
- **HTTP 明文**：域名 + ICP 备案后上 Let's Encrypt HTTPS + HSTS（脚本 `/opt/p188/enable_https.sh` 已预置）。
- Lint 尚未作为硬门禁。
- 单一服务器，无冗余/自动备份演练（作品集级，可接受，生产化前需补）。

## 校验命令
`npm audit --omit=dev`、`npm run typecheck`、`nginx -t`、`fail2ban-client status`。
