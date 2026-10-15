import { DeepSeekClient } from "@my-dsh/core";

/**
 * 创建一个 DeepSeekClient。
 * dev 环境走 Vite 代理 `/api/deepseek`，避免浏览器 CORS 与直连暴露；
 * 生产地址通过 VITE_DEEPSEEK_BASE_URL 覆盖。
 */
export function createClient(): DeepSeekClient {
  return new DeepSeekClient({
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
    baseURL: import.meta.env.VITE_DEEPSEEK_BASE_URL ?? "/api/deepseek",
    model: import.meta.env.VITE_DEEPSEEK_MODEL ?? "deepseek-chat",
    retry: { maxRetries: 2 },
    timeoutMs: 60_000,
  });
}
