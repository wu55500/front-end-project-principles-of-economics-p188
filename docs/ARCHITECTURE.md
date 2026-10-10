# 架构说明 (ARCHITECTURE)

## 技术栈
- **前端框架**：React 19.2 + TypeScript 5.7
- **构建/元框架**：Vite 8 (rolldown) + TanStack Start / Router 1.170（文件路由、server functions、SSR 流式）
- **3D**：three 0.180 + @react-three/fiber 9 + @react-three/drei 10 + @react-three/postprocessing 3（Bloom）
- **地理**：topojson-client + earcut 3（耳切三角化，正确处理凹多边形与孔洞）
- **数据**：PostgreSQL（node-postgres `pg`，部署时迁移）/ 嵌入式 PGLite（预览）；Kysely 查询构建
- **服务端校验**：zod 4（白名单 + 长度上限）
- **状态/数据获取**：Zustand（教学参数 t/情景）+ TanStack Query
- **鉴权（预留，默认关闭）**：better-auth 1.6
- **样式/UI**：Tailwind CSS 4 + Radix UI
- **部署**：Nitro/Vercel 风格产物 → Docker（node:22-alpine，非 root）→ Nginx 反代
- **CI**：GitHub Actions（typecheck + test + build）

## 请求/数据流（实际存在的层）
```
用户操作
 → 浏览器 React UI（Zustand store: t / war / selected）
 → 路由（src/routes/index.tsx 单页多锚点板块）
 → server function（TanStack Start，POST，走 /_server）
     └─ zod 校验输入 → 参数化 SQL（$1..）/ 外部世界银行 API
 → PostgreSQL（DATABASE_URL 存在时）或 PGLite 内嵌（无 DB 时）
 → 返回 JSON → React 渲染
3D：R3F useFrame → 几何体/航线 → 自定义经纬度投影 → DOM 标签/芯片
```
不存在的层（明确）：无独立微服务、无消息队列、无 CDN（当前）、无独立缓存层。

## 关键模块归属
| 目录 | 职责 |
|---|---|
| `src/routes` | 文件路由与页面装配 |
| `src/lib/data/econ-data.ts` | 指标 server function、缓存、20 年均值 |
| `src/lib/econ` | 补贴/福利经济模型（纯函数，可单测） |
| `src/components/worldmap/globe.tsx` | R3F 三维地球、航线、投影标签、遥测 |
| `src/components/scene3d` | 3D 贸易沙盘 |
| `src/components/causal` | DID / Granger 教学交互 |
| `src/components/welfare-board.tsx` | 三种选择福利账 |
| `src/lib/app-data` | 应用数据（参数化查询） |
| `scripts` | 构建期工具：迁移、app-env、PWA、原子写 |

## 状态所有权
- 教学参数 `t`、贸易战开关：Zustand 全局 store（单一事实来源）。
- 服务端数据：server function + TanStack Query 缓存。
- 3D 临时标签：R3F 帧循环内 ref，节流推入 React。

## 数据模型与迁移
- 业务 schema：`migrations/0001_business.sql`、`migrations/0002_econ_data.sql`。
- 鉴权 schema（隔离，默认不应用）：`migrations/auth/0001_auth.sql`。
- 迁移器非递归读取顶层；无 DATABASE_URL 时跳过，由 PGLite 启动时自迁移。

## 部署拓扑
```
公网 :80 Nginx（限流/安全头/封禁敏感路径）
   └─ proxy_pass 127.0.0.1:8080 → Docker p188（非 root, node:22-alpine）
```
未来：域名 + ICP 备案后，Certbot/Let's Encrypt 终结 TLS + HSTS。

## 关键决策（摘要，详见 ADR）
1. 用 earcut 取代扇形三角化——正确处理凹海岸与湖泊孔洞。
2. 合并几何体为单 draw call——低端机不爆显存。
3. 自研经纬度→屏幕投影取代 drei Html——边缘标签稳定挂载。
4. server function GET→POST——规避共享缓存导致切指标不刷新。
5. 不引入 Redis/队列/微服务——无对应负载，避免过度设计。
