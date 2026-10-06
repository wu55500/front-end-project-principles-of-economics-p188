# 架构设计文档 · 不公平竞争论互动图解（P188）

曼昆《经济学原理》第 9 章出口补贴案例的交互式教学应用。本文记录模块边界、数据模型、技术选型对照与交付路线图。

## 1. 总体分层

```
src/
├─ routes/            TanStack Router 文件路由（页面 + server handlers）
│  ├─ index.tsx       主页（编排各教学区块）
│  └─ api/rtc.ts      WebRTC 信令 HTTP 适配（GET/POST）
├─ components/
│  ├─ charts/         三套供需图独立实现 + 对比容器
│  ├─ scene3d/        Three.js 3D 贸易航道（懒加载）
│  ├─ worldmap/       d3-geo 世界贸易流（懒加载）
│  ├─ realdata/       世界银行真实数据面板
│  ├─ causal/         DID + Granger 因果面板
│  ├─ tutor/          LLM 辅导聊天
│  └─ multiplayer/    P2P 房间 UI
├─ lib/
│  ├─ econ/           纯经济模型（model/game/montecarlo/params）
│  ├─ causal/         因果统计算法
│  ├─ data/           真实数据 ETL（server only）
│  ├─ tutor/          导师后端（server only）
│  ├─ multiplayer/    P2P 客户端 + 信令服务（server only）
│  ├─ i18n/           轻量国际化
│  └─ observability/  条件式监控
└─ store/viz.ts       Zustand 全局可视化状态
```

**关键原则**：经济/统计算法是无副作用的纯函数，便于单测；浏览器能力（3D/地图/P2P）全部懒加载，不进入首屏包；server-only 模块以 `.server.ts` 结尾，禁止被客户端引用。

## 2. 数据模型

### 2.1 运行环境双轨

| 环境 | 数据库 | 驱动 |
| --- | --- | --- |
| 生产 | Neon（Postgres） | node-postgres（pg） |
| 预览 | PGLite（WASM 内存 Postgres） | @electric-sql/pglite |

两者都由 `src/lib/db.ts` 统一封装为 `Sql` 接口（tagged template + `query()`，直接返回行数组），并对 int8/date 等类型做口径归一。

### 2.2 业务表（migrations/0001_business.sql）

- `learning_sessions` 学习会话
- `quiz_attempts` 测验作答
- `decision_logs` 政策决策（accept/tariff/ban）
- `model_params` 参数化供需模型参数
- `monte_carlo_runs` 蒙特卡洛运行结果（含直方图 jsonb）
- `game_outcomes` 博弈结果与纳什策略
- `rtc_rooms` / `rtc_signals` P2P 房间与信令

### 2.3 真实数据表（migrations/0002_econ_data.sql）

- `econ_indicators`：`(source, indicator, country, year)` 唯一，缓存世界银行/FRED 序列，TTL 12 小时。

## 3. 核心模块

- **econ/model.ts**：线性供需、福利三角形、价格上下限。
- **econ/game.ts**：支付矩阵、纯策略纳什均衡、占优策略、2×2 混合策略。
- **econ/montecarlo.ts**：mulberry32 + Box-Muller，净福利分布与分位数置信区间。
- **econ/params.ts**：弹性可调供需、点弹性、二维敏感性网格（供热力图）。
- **causal/causal.ts**：DID、OLS（正规方程+Gauss-Jordan 求逆）、Granger F 检验（含 beta/F 分布数值实现）。

## 4. 图表三套实现对照

| 维度 | Recharts | D3 | Canvas |
| --- | --- | --- | --- |
| 渲染方式 | 声明式 SVG | SVG + 比例尺 | 命令式像素 |
| 代码量 | 最少 | 中 | 中 |
| 灵活性 | 中（受组件约束） | 最高 | 高 |
| 性能（大量点） | 一般 | 一般 | 最好 |
| 动画/过渡 | 内置 | 手动 | 手动 |
| 无障碍 | 好（SVG 语义） | 好 | 弱（需额外标注） |
| 上手门槛 | 低 | 高 | 中 |
| 适用场景 | 常规仪表盘 | 高度定制 | 大数据/粒子 |

## 5. 多人 P2P

- 信令走 `rtc_rooms`/`rtc_signals` 短轮询（无 WebSocket，可在 serverless 运行），HTTP 入口 `/api/rtc`。
- 建立连接后媒体/数据走 WebRTC datachannel（`state` 不可靠通道广播可视化，`reliable` 可靠通道），服务器不再接触业务数据。
- 客户端实现 perfect negotiation、ICE 缓冲、断线看门狗与重协商。

## 6. 技术栈 ↔ 岗位映射

| 能力 | 技术 | 对应方向 |
| --- | --- | --- |
| 框架/语言 | React 19、TypeScript、Vite、TanStack Start | 前端工程 |
| UI/设计系统 | Tailwind、Radix、CVA、lucide | 前端 / 设计工程 |
| 数据可视化 | Recharts、D3、Canvas、d3-geo、Three.js | 数据可视化 / 图形学 |
| 建模/算法 | 博弈论、蒙特卡洛、统计因果 | 数据科学 / 量化分析 |
| 后端/交互 | server functions、Postgres、WebRTC | 全栈 / 后端 |
| 数据工程 | 世界银行 ETL、缓存表 | 数据工程 |
| AI | LLM 辅导、RAG 知识库 | AI 应用工程 |
| 运维 | GitHub Actions、Docker、Sentry/OTel | DevOps / SRE |
| 全球化 | i18n、SEO/OG | 前端 / 增长 |

## 7. 运维与可观测性

- GitHub Actions：install → typecheck → test → build。
- Docker：多阶段构建生产镜像（Neon）。
- 监控：`VITE_SENTRY_DSN` / `VITE_OTEL_ENDPOINT` 存在时启用，否则 no-op；全局兜底未捕获异常。

## 8. 路线图（已交付状态）

P0 数据模型、博弈论、蒙特卡洛、三套图表、P2P、3D、世界地图、真实数据、因果、LLM 辅导、CI/CD、i18n 均已实现并通过 `npm run typecheck`。后续可扩展：多面板持久化看板、RAG 向量化检索、LLM 流式输出、更多国家双边贸易数据。
