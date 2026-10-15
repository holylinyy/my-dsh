import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  platform: "browser",
  // 保持 React 与 workspace 依赖为外部，交由消费方解析
  external: ["react", "react/jsx-runtime", "@my-dsh/core"],
});
