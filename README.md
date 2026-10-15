# my-dsh

类 **DeepSeek harness** 的前端 monorepo。核心包由你手动实现，仓库只提供最小骨架与工具链。

## 技术选型

| 关注点 | 选择 | 说明 |
| --- | --- | --- |
| 包管理 | **pnpm workspaces** | `pnpm-workspace.yaml`，含 `catalog` 统一版本 |
| 语言 | **TypeScript (ESM)** | `tsconfig.base.json`，严格模式 |
| 库构建 | **tsdown** | Rolldown 驱动，与 Oxc 同生态，输出 ESM + d.ts |
| Lint | **oxlint** | `.oxlintrc.json`（ESLint v8 兼容格式） |
| Format | **oxfmt** | `.oxfmtrc.json`（Prettier 兼容 + import 排序） |

> 不使用 Turborepo，任务直接用 `pnpm -r` 递归跑各包脚本。

## 目录结构

```
my-dsh/
├─ packages/
│  └─ core/     @my-dsh/core    核心包（当前仅占位 src/index.ts，待你实现）
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .oxlintrc.json
└─ .oxfmtrc.json
```

## 常用命令

```bash
pnpm install

pnpm build        # pnpm -r build，逐包构建
pnpm dev          # pnpm -r --parallel dev
pnpm lint         # oxlint（根级，覆盖全仓库）
pnpm lint:fix     # oxlint --fix
pnpm fmt          # oxfmt 写回
pnpm fmt:check    # CI 用，只检查不写
pnpm typecheck    # pnpm -r typecheck
pnpm check        # lint + fmt:check + typecheck
```

## 添加新包

1. 在 `packages/<name>/` 下建 `package.json`（命名 `@my-dsh/<name>`）、`tsdown.config.ts`、`tsconfig.json`（`extends` 根 `tsconfig.base.json`）。
2. 依赖 workspace 包用 `"@my-dsh/core": "workspace:*"`。
3. 需要统一版本时，把版本写进 `pnpm-workspace.yaml` 的 `catalog`，包内用 `"catalog:"`。
4. 根脚本用 `pnpm -r`，新包会自动被纳入，无需改根配置。

## 工具链说明

- **oxlint**：`categories.correctness=error`，`suspicious/perf=warn`。类型感知规则需额外安装 `oxlint-tsgolint`（当前未启用）。
- **oxfmt**：`printWidth=100`、双引号、`sortImports`、`sortPackageJson` 已开启。
- 编辑器：`.vscode/settings.json` 已配置保存时 `fixAll.oxlint` + `oxfmt` 格式化，推荐安装 `oxc.oxc-vscode` 扩展。
