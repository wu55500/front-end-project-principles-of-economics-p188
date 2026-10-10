# 测试策略 (TEST STRATEGY)

## 目标
以风险为导向覆盖关键路径，不追求统一覆盖率百分比。失败必须真实反映在退出码上（禁止"假绿"）。

## 测试框架
Node 内置测试运行器 `node --test`（无额外重型依赖）；TS 测试用 `--experimental-strip-types`。

## 分层
| 层 | 内容 | 命令 |
|---|---|---|
| 静态 | TypeScript 类型检查 | `npm run typecheck` |
| Lint | ESLint（CI 中不阻断，逐步收敛） | `npm run lint` |
| 单元 | 经济模型、福利计算、应用数据、鉴权门禁、readiness 排期 | `npm test` |
| 构建 | 生产构建（无 DB 时跳过迁移） | `npm run build` |
| 人工/验收 | SwiftShader 软件渲染截图，验证 3D 视觉 | 见 docs/evidence |

## 测试清单（当前）
- `scripts/**/*.test.mjs`：197 个（构建工具链：原子写、迁移计划、PWA、app-env、品牌检查等）
- `src/lib`：66 个
  - `econ/model.test.ts`（补贴/福利模型）
  - `app-data/app-data.test.ts`、`readiness-schedule.test.ts`
  - `auth/gate-identity.test.ts`、`sign-in-gate.test.ts`

## 边界与负例（要求包含）
空输入、单条/多条记录、重名、超长输入、权限拒绝、缺失文件、符号链接路径、非法参数。

## 3D / 视觉验收
使用 headless Chrome + SwiftShader 软件渲染 + CDP 截图，实际核验：
- 墨西哥湖泊无错误阴影；
- 三航线数值芯片实时升降（▲▼）；
- 点击航线出现详情面板与实时走势曲线；
- 贸易战模式出现直航芯片。
这些是渲染层证据，不能由单元测试替代。

## CI
GitHub Actions（`.github/workflows/ci.yml`）：install → typecheck → lint(非阻断) → test → build → 上传产物。

## 已知限制
- 尚无浏览器端 E2E 自动化断言（已装 Playwright，可作为下一步）。
- Lint 未作为硬门禁，待存量告警收敛后启用。
