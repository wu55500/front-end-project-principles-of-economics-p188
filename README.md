# 经济学原理互动教学应用（P188）

曼昆《经济学原理》第 9 章应用：国际贸易 · 出口补贴 · "不公平竞争论" 的交互式教学网页。

## 在线体验

部署后可用（见下方"部署"）。本地运行：

\`\`\`bash
npm install
npm run dev
\`\`\`

## 功能模块

| 模块 | 说明 |
| --- | --- |
| 供需与福利图表 | 三种图表模式（静态/补贴对比/动画）+ 剩余面积可视化 |
| 博弈论 | 关税/补贴博弈矩阵、纳什均衡 |
| 蒙特卡洛模拟 | 多场景随机模拟 |
| 参数与弹性 | 调节供需参数，实时计算弹性 |
| 真实数据 | 世界银行贸易指标（贸易/GDP、进出口、经常账户） |
| 因果推断 | DID、OLS、Granger 因果检验 |
| 3D 贸易场景 | Three.js：两国港口与货船随补贴变化 |
| 世界贸易地图 | d3-geo：全球纺织品贸易流 |
| 多人房间 | WebRTC P2P，无需 WebSocket |
| AI 辅导 | 内置知识导师，可接 OpenAI 兼容接口 |
| 国际化 | 中文 / English |

## 技术栈

React 19 + TypeScript + Vite + TanStack Start/Router；PGLite（浏览器内 Postgres）/ Neon（生产）；GitHub Actions CI；Docker。

详细架构见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 目录

- \`src/\`：前端页面、组件、服务端函数
- \`migrations/\`：数据库迁移
- \`server/\`、\`scripts/\`：服务端与脚本
- \`原版文件/\`：项目最初的两个 AI 改良 HTML 与原始说明

## 部署

推荐 Vercel：导入本仓库，根目录直接部署（已含 \`vercel.json\`）。
