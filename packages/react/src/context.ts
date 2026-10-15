import type { DeepSeekClient } from "@my-dsh/core";
import { createContext, useContext } from "react";

/** 提供 DeepSeekClient 实例的 React Context。 */
export const DeepSeekClientContext = createContext<DeepSeekClient | null>(null);

/** 读取最近的 DeepSeekClient 实例；未提供时抛错。 */
export function useDeepSeekClient(): DeepSeekClient {
  const client = useContext(DeepSeekClientContext);
  if (!client) {
    throw new Error("useDeepSeekClient 必须在 <DeepSeekClientProvider> 内使用。");
  }
  return client;
}
