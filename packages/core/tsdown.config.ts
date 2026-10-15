import { defineConfig } from "tsdown";

// 共享配置（format/dts/sourcemap/clean/target）来自根 tsdown.config.ts，
// 这里只声明本包的差异项。
export default defineConfig({
  entry: ["src/index.ts"],
  platform: "neutral",
});
