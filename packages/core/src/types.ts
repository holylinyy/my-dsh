/**
 * OpenAI 兼容（DeepSeek）Chat Completions 协议类型定义。
 * 参考 https://api-docs.deepseek.com/ 与 OpenAI Chat Completions schema。
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string | null;
  name?: string;
  /** assistant 消息发起的工具调用 */
  tool_calls?: ToolCall[];
  /** role === "tool" 时对应的工具调用 id */
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    /** JSON 字符串形式的参数 */
    arguments: string;
  };
}

/** 提供给模型的工具（函数）声明 */
export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    /** JSON Schema，描述参数 */
    parameters?: Record<string, unknown>;
  };
}

export type ToolChoice = "none" | "auto" | { type: "function"; function: { name: string } };

export type FinishReason = "stop" | "length" | "tool_calls" | "content_filter" | null;

export interface ChatRequest {
  /** 模型名；若省略则使用客户端构造时配置的默认 model */
  model?: string;
  messages: ChatMessage[];
  /** 采样温度，DeepSeek 范围 [0, 2) */
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  /** 思考模式（DeepSeek Reasoner） */
  thinking?: { type: "enabled" | "disabled" };
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: FinishReason;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: Usage;
}

/** 流式响应里的增量 delta */
export interface ChatCompletionChunkDelta {
  role?: Role;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: FinishReason;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage | null;
}

/** 客户端可注入的 fetch 实现，便于测试与自定义 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
