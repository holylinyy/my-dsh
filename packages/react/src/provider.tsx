import type { DeepSeekClient } from "@my-dsh/core";
import type { ReactNode } from "react";

import { DeepSeekClientContext } from "./context";

export interface DeepSeekClientProviderProps {
  client: DeepSeekClient;
  children: ReactNode;
}

/** 向子树注入一个 DeepSeekClient 实例。 */
export function DeepSeekClientProvider({ client, children }: DeepSeekClientProviderProps) {
  return <DeepSeekClientContext.Provider value={client}>{children}</DeepSeekClientContext.Provider>;
}
