# 部署说明（Docker + Nginx，云服务器）

本项目以 **Docker 容器化**方式部署在一台 Linux 云服务器上，前置使用 **Nginx 反向代理**。这是后端服务最常见的部署形态。

## 在线地址

http://139.155.132.81

（服务器：Ubuntu 22.04，2 核 2G；无需域名即可访问。）

## 整体架构

```text
浏览器 / 面试官
      │  HTTP :80
      ▼
   Nginx（反向代理 / 80 端口）
      │  proxy_pass
      ▼
 Docker 容器 p188（Node 22 + 应用，监听 127.0.0.1:8080）
      │
      ▼
 PGLite（容器内 WASM Postgres）── 可选切换为 Neon 云 Postgres（DATABASE_URL）
```

## 关键设计

| 环节 | 做法 | 体现的工程能力 |
| --- | --- | --- |
| 镜像构建 | 多阶段 `Dockerfile`：deps（npm ci）→ build（编译）→ runner（精简运行） | 分层镜像、构建与运行分离、减小镜像体积 |
| 进程模型 | 容器 `--restart unless-stopped`，崩溃/重启自动拉起 | 服务自愈、高可用 |
| 反向代理 | Nginx 80 → 容器 8080，统一入口、转发真实 IP 与协议 | 反向代理、前后端统一入口 |
| 端口隔离 | 容器只绑定 `127.0.0.1:8080`，不直接暴露公网 | 最小暴露面、安全加固 |
| 数据层 | 默认容器内 PGLite；设置 `DATABASE_URL` 即切换为云 Postgres | 环境配置、可移植性 |
| 日志 | Docker json-file 限制单文件 10MB×3，防止打满磁盘 | 日志治理 |
| 资源保障 | 2G swap，避免构建期内存不足 OOM | 容量规划 |
| 外链治理 | `VITE_GROK_EXTENSIONS=0`（runner 阶段）关闭第三方平台注入脚本 | 生产零外链依赖、供应链收敛 |

## 复现步骤

```bash
# 1. 构建镜像（仓库根目录）
docker build -t p188-econ .

# 2. 运行容器（仅绑定本机回环）
docker run -d --name p188 --restart unless-stopped \
  -p 127.0.0.1:8080:8080 p188-econ

# 3. Nginx 反向代理（核心配置）
#   location / { proxy_pass http://127.0.0.1:8080;
#                proxy_set_header Host $host;
#                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#                proxy_set_header X-Forwarded-Proto $scheme; }

# 4. 验证
curl -I http://<服务器IP>/
```

## 可平滑升级的方向

- 绑定域名 + HTTPS（Let's Encrypt / certbot）
- `git push` 后由 CI 自动构建并部署（GitHub Actions + SSH）
- 多实例 + 负载均衡；接入云 Postgres 与 Redis
