# Nginx 反向代理配置（生产真实配置的快照）

线上：Ubuntu 22.04 + Nginx 前置，反代到本机非 root Docker 容器 `127.0.0.1:8080`。
本目录是服务器 `/etc/nginx` 中真实生效配置的版本化快照，保证部署可复现、可在面试中展示。

## 文件对应

| 仓库文件                    | 服务器路径                                                | 作用                                                                                         |
| --------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `conf.d/00-hardening.conf`  | `/etc/nginx/conf.d/00-hardening.conf`                     | `server_tokens off`；按 IP 的请求/并发限流区（general 20r/s、srv 8r/s、perip）；超限返回 429 |
| `sites-available/p188.conf` | `/etc/nginx/sites-available/p188`（软链到 sites-enabled） | 站点 server 块                                                                               |

## 站点块要点

- `proxy_pass http://127.0.0.1:8080`：只监听本机，容器端口不直接对公网暴露。
- 安全响应头：CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy。
- 分级限流：`/_server`、`/api/` 用最严的 `srv` 区；静态资源缓存 1h；根路径用 `general` 区。
- 侦察/敏感文件直接 404：`.git/.env/.map/.log`、`package(-lock).json`、`wp-admin`、`.php/.asp` 等。
- WebSocket Upgrade 头透传（为后续实时能力预留）。

## 安装（在新服务器上）

```bash
sudo cp deploy/nginx/conf.d/00-hardening.conf /etc/nginx/conf.d/
sudo cp deploy/nginx/sites-available/p188.conf /etc/nginx/sites-available/p188
sudo ln -sf /etc/nginx/sites-available/p188 /etc/nginx/sites-enabled/p188
sudo nginx -t && sudo systemctl reload nginx
```

> 说明：当前为 HTTP（备案中的裸 IP 演示）。域名 wu55500.com 完成 ICP 备案后，
> 用 Certbot/`enable_https.sh` 上 HTTPS，并在本目录补 443 server 块与 HSTS。
