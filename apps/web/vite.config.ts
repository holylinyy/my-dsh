import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// dev 时把 workspace 包指向源码，免构建即可 HMR；
// 生产 build/typecheck 走各包 dist（由 turbo 依赖顺序保证先构建）。
const pkg = (name: string) =>
  fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@my-dsh/react": pkg("react"),
      "@my-dsh/core": pkg("core"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 通过本地代理转发到 DeepSeek，规避浏览器 CORS 且不把密钥写进前端产物逻辑
      "/api/deepseek": {
        target: "https://api.deepseek.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ""),
      },
    },
  },
  build: {
    target: "es2022",
  },
});
