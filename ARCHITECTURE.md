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
│  ├─ scene3d/        React Three Fiber 3D 全球贸易沙盘（懒加载）
│  ├─ worldmap/       R3F 三维地球仪（转口航线/贸易战，懒加载）
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

## 6. 岗位能力对照（面向 Java 后端 / Agent 开发）

虽以 TypeScript/Node 实现，但本项目体现的是**跨语言的后端工程能力与 Agent 应用能力**。

### 6.1 后端工程能力（对应 Java 后端岗）

| 工程能力 | 本项目实现 | Java 生态对应物 |
| --- | --- | --- |
| 分层架构 | routes（控制层）/ lib（服务层）/ db（数据层） | Controller / Service / DAO 分层 |
| 服务端接口 | server functions + `/api/*` 路由，输入校验 | Spring MVC `@RestController`、DTO 校验 |
| 数据库建模 | 10+ 张表、约束、索引、`numeric` 精度 | MySQL/PostgreSQL 表设计、索引优化 |
| 数据库迁移 | 版本化 SQL 迁移（0001/0002…），CI 校验 | Flyway / Liquibase |
| 关系型数据库 | Postgres（Neon 云 + PGLite 内嵌），统一 `Sql` 接口 | JDBC / MyBatis / JPA |
| 缓存 | 指标数据 TTL 缓存 | Redis / Caffeine |
| 容器化 | 多阶段 `Dockerfile`（deps→build→runner） | Docker 镜像构建与部署 |
| CI/CD | GitHub Actions：install→typecheck→test→build | Jenkins / GitLab CI 流水线 |
| 可观测性 | Sentry / OpenTelemetry 条件接入、全局错误处理 | 日志/监控/链路追踪 |
| 质量保障 | 250+ 自动化测试，覆盖边界与空数据 | JUnit / Mockito 测试体系 |

### 6.2 Agent / AI 应用能力（对应 Agent 开发岗）

| Agent 能力 | 本项目实现 |
| --- | --- |
| LLM 接入 | OpenAI 兼容 chat/completions 接口，可对接任意兼容模型 |
| RAG 检索增强 | 关键词知识库检索 + 上下文拼装 + 规则兜底 |
| 降级与容错 | 无 API Key 或调用失败时自动回落到规则导师，服务不中断 |
| 工具化结构 | 检索、推理、回复分层，便于扩展为 Function Calling / 多工具 |
| 数据闭环 | 真实数据 ETL（世界银行 API）+ 因果推断（DID/OLS/Granger） |

### 6.3 其他综合能力

| 能力 | 技术 |
| --- | --- |
| 前端 / 全栈 | React 19、TypeScript、Vite、Tailwind、Radix |
| 3D / 图形 | React Three Fiber、@react-three/drei、three、postprocessing 辉光 |
| 实时通信 | WebRTC P2P + 数据库信令（无 WebSocket） |
| 数据可视化 | Recharts、D3、Canvas 2D、d3-geo、R3F 三维地球 |
| 工程规范 | i18n、SEO/OG、环境变量分环境、架构文档 |

> 说明：本项目用于展示通用后端工程与 Agent 应用能力；语言层面的 Java/Spring Boot 能力可由独立 Java 项目补充，两者不冲突。

## 7. 运维与可观测性

- GitHub Actions：install → typecheck → test → build。
- Docker：多阶段构建生产镜像（Neon）。
- 监控：`VITE_SENTRY_DSN` / `VITE_OTEL_ENDPOINT` 存在时启用，否则 no-op；全局兜底未捕获异常。

## 8. 路线图（已交付状态）

P0 数据模型、博弈论、蒙特卡洛、三套图表、P2P、3D、世界地图、真实数据、因果、LLM 辅导、CI/CD、i18n 均已实现并通过 `npm run typecheck`。后续可扩展：多面板持久化看板、RAG 向量化检索、LLM 流式输出、更多国家双边贸易数据。
