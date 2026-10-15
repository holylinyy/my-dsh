import type { ChatMessage, ChatRequest, Tool } from "@my-dsh/core";
import { useCallback, useRef, useState } from "react";

import { useDeepSeekClient } from "./context";

export interface UseChatOptions {
  /** 初始消息，通常包含一条 system 提示 */
  initialMessages?: ChatMessage[];
  /** 模型名，透传给请求 */
  model?: string;
  /** 采样参数 */
  temperature?: number;
  maxTokens?: number;
  /** 提供给模型的工具 */
  tools?: Tool[];
  /** 每次收到流式增量时回调 */
  onStreamDelta?: (deltaText: string, messages: ChatMessage[]) => void;
  /** 出错回调 */
  onError?: (error: unknown) => void;
  /** 一轮补全完成回调 */
  onFinish?: (message: ChatMessage, messages: ChatMessage[]) => void;
}

export interface UseChatResult {
  messages: ChatMessage[];
  /** 是否正在流式接收 */
  isLoading: boolean;
  /** 发送一条用户消息并触发流式补全 */
  sendMessage: (content: string) => Promise<void>;
  /** 追加任意消息（如 tool 结果）后再请求补全 */
  appendMessage: (message: ChatMessage) => Promise<void>;
  /** 中断当前流式请求 */
  stop: () => void;
  /** 清空会话 */
  reset: () => void;
}

/**
 * 管理一段多轮对话：维护 messages、发起流式补全、支持中断。
 * 依赖上下文中的 DeepSeekClient。
 */
export function useChat(options: UseChatOptions = {}): UseChatResult {
  const client = useDeepSeekClient();
  const [messages, setMessages] = useState<ChatMessage[]>(options.initialMessages ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // 用 ref 保存最新 messages，供异步回调读取，避免闭包过期
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // options 每次渲染可能是新对象，用 ref 稳定化，避免 run 频繁重建
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const run = useCallback(
    async (nextMessages: ChatMessage[]) => {
      const opts = optionsRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setMessages(nextMessages);

      const req: ChatRequest = {
        model: opts.model ?? "deepseek-chat",
        messages: nextMessages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        tools: opts.tools,
        stream: true,
      };

      try {
        const assistant: ChatMessage = { role: "assistant", content: "" };
        const withDraft = [...nextMessages, assistant];
        setMessages(withDraft);

        const final = await client.streamToMessage(
          req,
          (delta) => {
            const draft: ChatMessage = { role: "assistant", content: "" };
            const current = messagesRef.current;
            const last = current[current.length - 1];
            if (last && last.role === "assistant") {
              draft.content = (last.content ?? "") + delta;
              const updated = [...current.slice(0, -1), draft];
              messagesRef.current = updated;
              setMessages(updated);
            }
            opts.onStreamDelta?.(delta, messagesRef.current);
          },
          controller.signal,
        );

        const updated = [...nextMessages, final];
        messagesRef.current = updated;
        setMessages(updated);
        opts.onFinish?.(final, updated);
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        opts.onError?.(error);
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [client],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      await run([...messagesRef.current, { role: "user", content }]);
    },
    [run],
  );

  const appendMessage = useCallback(
    async (message: ChatMessage) => {
      await run([...messagesRef.current, message]);
    },
    [run],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setMessages(optionsRef.current.initialMessages ?? []);
  }, [stop]);

  return { messages, isLoading, sendMessage, appendMessage, stop, reset };
}
