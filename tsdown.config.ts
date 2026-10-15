import { defineConfig } from 'tsdown'

/**
 * tsdown workspace 模式：从仓库根运行 `tsdown`，
 * 自动发现各子包（glob **\/package.json）并读取子包自身的 tsdown.config.ts，
 * 与这里的共享配置合并后一次性构建全部包。
 */
export default defineConfig({
  // 启用 workspace 模式（等价于 { workspace: { include: "auto" } }）
  workspace: true,
  // 所有子包共享的默认配置，子包 tsdown.config.ts 可按需覆盖
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2024',
})
