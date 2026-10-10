# 简历证据 (RESUME EVIDENCE)

> 所有表述均可由仓库、CI、测试、部署与截图证据支撑；未虚构用户量/性能/业务影响。

## 项目概述
- **名称**：曼昆《经济学原理》第 9 章交互式教学网页（出口补贴 / 不公平竞争论）
- **角色**：独立设计与开发（AI 辅助编码，本人负责需求、架构、调试、部署与讲解）
- **层级**：作品集级线上部署，移动端与桌面端可用
- **线上**：http://139.155.132.81（域名 wu55500.com 备案中，之后升级 HTTPS）

## 我做了什么（可辩护）
- 设计从故事→供需图→3D 沙盘→三维地球→真实数据→因果推断→福利决策的完整学习链路。
- 用 R3F/three.js 实现可交互三维地球：航线点击、实时数值、经纬度投影标签、大气/云层/后处理。
- 用 earcut 修复凹多边形与 169 个湖泊孔洞的错误三角化；合并几何体为单 draw call，解决低端机 WebGL 黑屏。
- 实现 TanStack Start server function，zod 校验 + 参数化 SQL；接入世界银行真实数据并计算 20 年均值。
- 完成 Nginx 限流/安全头/路径封禁、Fail2ban、非 root Docker 容器化与 GitHub Actions CI。

## 架构与关键权衡（2–4 条）
1. **earcut vs 扇形三角化**：前者正确处理孔洞/凹海岸，消除墨西哥阴影；代价是引入一个依赖。
2. **合并几何体**：上千 draw call → 单 draw call，手机显存不再压垮 context；牺牲了单国独立着色灵活性（用 polygonOffset 叠加解决）。
3. **自研投影标签 vs drei Html**：边缘点（上海）Html 不挂载；自研投影稳定但需自管背面剔除与节流。
4. **POST + 缓存策略**：规避 GET 共享缓存导致切指标不刷新。

## 质量证据
- 单元/工具测试：**263 个全部通过**（`npm test`，退出码真实）。
- TypeScript 严格类型检查通过；生产构建可复现。
- CI：GitHub Actions 在 push/PR 上运行 typecheck + test + build。
- 安全：参数化查询、zod 校验、限流（实测 429）、Fail2ban、非 root 容器、生产依赖 0 已知漏洞。
- 验收截图：见 `docs/evidence/`（SwiftShader 软件渲染实拍）。

## 实测/验证口径（诚实）
- 数据基准为世界银行 / UN Comtrade **2005–2024 均值**（如中国出口≈2.3万亿美元、墨→美≈3400亿、美国平均关税≈2.7%）。
- 芯片的实时波动为**教学模拟**，围绕真实均值；非实时采集的生产数据。
- 3D 截图来自软件渲染（SwiftShader），用于功能验收，非性能基准。

## 局限与下一步
- 尚未启用真实多用户账户与 HTTPS（备案中）。
- Playwright E2E 断言、Lint 硬门禁、备份演练为后续项。

## 简历要点（Action + 方法 + 可验证结果）
- 独立构建全栈交互式教学应用（React 19 + TypeScript + Vite + TanStack Start），实现 8 大可交互板块，**263 个自动化测试全部通过**并配置 GitHub Actions CI。
- 基于 three.js / R3F 实现可交互三维地球，使用 earcut 修复复杂多边形/孔洞三角化，合并几何体为单 draw call，解决移动端 WebGL context lost 黑屏。
- 设计并落地 server function（zod 白名单校验 + 参数化 SQL），接入世界银行 API 并计算 20 年均值；实现 Nginx 限流、Fail2ban 与非 root 容器化，生产依赖 0 已知漏洞。
