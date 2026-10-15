# my-dsh

类 **DeepSeek harness** 的前端 monorepo。在这里编写自己的 LLM 应用脚手架包：
OpenAI 兼容的 Chat Completions 客户端、流式 SSE、tool calls、React 绑定与 playground。

## 技术选型

| 关注点 | 选择 | 说明 |
| --- | --- | --- |
| 包管理 | **pnpm workspaces** | `pnpm-workspace.yaml`，含 `catalog` 统一版本 |
| 任务编排 | **Turborepo** | `turbo.json`，增量构建 + 缓存 |
| 语言 | **TypeScript (ESM)** | `tsconfig.base.json`，严格模式 |
| 库构建 | **tsdown** | Rolldown 驱动，与 Oxc 同生态，输出 ESM + d.ts |
| Lint | **oxlint** | `.oxlintrc.json`（ESLint v8 兼容格式） |
| Format | **oxfmt** | `.oxfmtrc.json`（Prettier 兼容 + import 排序） |
| 测试 | **vitest** | Node 环境，mock fetch |
| Web | **Vite + React 19** | playground 演示 |

## 目录结构

```
my-dsh/
├─ packages/
│  ├─ core/     @my-dsh/core    LLM 客户端 harness（无框架依赖）
│  └─ react/    @my-dsh/react   React hooks 绑定
├─ apps/
│  └─ web/      @my-dsh/web     Vite + React playground
├─ turbo.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .oxlintrc.json
└─ .oxfmtrc.json
```

## 快速开始

```bash
pnpm install

# 构建所有包（core -> react -> web，按依赖顺序）
pnpm build

# 启动 playground（默认 http://localhost:5173）
cp apps/web/.env.example apps/web/.env.local   # 填入 VITE_DEEPSEEK_API_KEY
pnpm --filter @my-dsh/web dev

# 质量门禁
pnpm lint        # oxlint
pnpm fmt         # oxfmt 写回
pnpm fmt:check   # CI 用，只检查不写
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest
pnpm check       # lint + fmt:check + typecheck + test
```

> dev 环境通过 Vite 代理 `/api/deepseek` 转发到 `https://api.deepseek.com`，
> 规避浏览器 CORS 且密钥只留在 `.env.local`（已被 gitignore）。

## `@my-dsh/core` 用法

```ts
import { DeepSeekClient } from "@my-dsh/core";

const client = new DeepSeekClient({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: "deepseek-chat",
});

// 非流式
const res = await client.createChatCompletion({
  messages: [{ role: "user", content: "你好" }],
});

// 流式（异步迭代原始 chunk）
for await (const chunk of client.streamChat({ messages: [{ role: "user", content: "讲个故事" }] })) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? "");
}

// 流式并累积成完整消息（含拼接好的 tool_calls）
const message = await client.streamToMessage(
  { messages: [{ role: "user", content: "北京天气?" }], tools: [/* ... */] },
  (delta) => console.log("增量:", delta),
);
```

内置能力：指数退避 + full-jitter 重试（429/5xx 自动重试）、`AbortSignal` 中断、
超时、SSE 解析、统一错误类型（`ApiError` / `AbortError` / `StreamParseError`）。

## `@my-dsh/react` 用法

```tsx
import { DeepSeekClient } from "@my-dsh/core";
import { DeepSeekClientProvider, useChat } from "@my-dsh/react";

const client = new DeepSeekClient({ apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY });

function App() {
  return (
    <DeepSeekClientProvider client={client}>
      <Chat />
    </DeepSeekClientProvider>
  );
}

function Chat() {
  const { messages, isLoading, sendMessage, stop, reset } = useChat({
    model: "deepseek-chat",
    temperature: 0.7,
  });
  // ...渲染 messages，调用 sendMessage / stop
}
```

## 添加新包

1. 在 `packages/<name>/` 下建 `package.json`（`"@my-dsh/xxx"`）、`tsdown.config.ts`、`tsconfig.json`（`extends` 根 `tsconfig.base.json`）。
2. 依赖 workspace 包用 `"@my-dsh/core": "workspace:*"`。
3. 需要统一版本时，把版本写进 `pnpm-workspace.yaml` 的 `catalog`，包内用 `"catalog:"`。
4. 根脚本无需改动，`turbo run build/lint/...` 会自动发现新包。

## 工具链说明

- **oxlint**：`categories.correctness=error`，`suspicious/perf=warn`。类型感知规则需额外安装 `oxlint-tsgolint`（当前未启用）。
- **oxfmt**：`printWidth=100`、双引号、`sortImports`、`sortPackageJson` 已开启。
- 编辑器：`.vscode/settings.json` 已配置保存时 `fixAll.oxlint` + `oxfmt` 格式化，推荐安装 `oxc.oxc-vscode` 扩展。
