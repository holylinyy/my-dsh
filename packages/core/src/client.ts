import { ApiError, AbortError, DshError, StreamParseError } from "./errors";
import { withRetry, type RetryOptions } from "./retry";
import { parseSseStream } from "./sse";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatMessage,
  ChatRequest,
  FetchLike,
  ToolCall,
} from "./types";

export interface DeepSeekClientOptions {
  /** API Key，例如 sk-xxxx。也可通过 DEEPSEEK_API_KEY 环境变量注入到上层。 */
  apiKey?: string;
  /** 默认 https://api.deepseek.com */
  baseURL?: string;
  /** 默认模型，若请求未指定 model 则使用它 */
  model?: string;
  /** 自定义 fetch，便于测试或代理 */
  fetch?: FetchLike;
  /** 默认重试策略 */
  retry?: RetryOptions;
  /** 附加请求头 */
  defaultHeaders?: Record<string, string>;
  /** 请求超时毫秒，超时后 abort。默认不超时 */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";

/** 类 DeepSeek（OpenAI 兼容）Chat Completions 客户端。 */
export class DeepSeekClient {
  readonly #apiKey?: string;
  readonly #baseURL: string;
  readonly #model?: string;
  readonly #fetch: FetchLike;
  readonly #retry: RetryOptions;
  readonly #defaultHeaders: Record<string, string>;
  readonly #timeoutMs?: number;

  constructor(options: DeepSeekClientOptions = {}) {
    this.#apiKey = options.apiKey;
    this.#baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#model = options.model;
    this.#fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.#retry = options.retry ?? {};
    this.#defaultHeaders = options.defaultHeaders ?? {};
    this.#timeoutMs = options.timeoutMs;
  }

  #buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.#defaultHeaders,
    };
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`;
    return headers;
  }

  #normalizeRequest(req: ChatRequest): ChatRequest {
    if (!req.model && !this.#model) {
      throw new DshError("请求缺少 model，且客户端未配置默认 model。");
    }
    return { ...req, model: req.model ?? this.#model };
  }

  #combineSignal(external?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    const onAbort = () => controller.abort(new AbortError());
    if (external) {
      if (external.aborted) controller.abort(new AbortError());
      else external.addEventListener("abort", onAbort, { once: true });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (this.#timeoutMs && this.#timeoutMs > 0) {
      timer = setTimeout(() => controller.abort(new AbortError("请求超时")), this.#timeoutMs);
    }
    return {
      signal: controller.signal,
      cleanup: () => {
        if (timer) clearTimeout(timer);
        external?.removeEventListener("abort", onAbort);
      },
    };
  }

  /** 非流式对话补全。 */
  async createChatCompletion(req: ChatRequest, signal?: AbortSignal): Promise<ChatCompletion> {
    const body = this.#normalizeRequest({ ...req, stream: false });
    const { signal: inner, cleanup } = this.#combineSignal(signal);
    try {
      return await withRetry(
        async () => {
          const res = await this.#fetch(`${this.#baseURL}/chat/completions`, {
            method: "POST",
            headers: this.#buildHeaders(),
            body: JSON.stringify(body),
            signal: inner,
          });
          if (!res.ok) throw await toApiError(res);
          return (await res.json()) as ChatCompletion;
        },
        this.#retry,
        inner,
      );
    } catch (err) {
      throw wrapAbort(err, inner);
    } finally {
      cleanup();
    }
  }

  /**
   * 流式对话补全，返回原始 chunk 的异步迭代器。
   * 使用 `for await (const chunk of client.streamChat(req)) { ... }`。
   */
  async *streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatCompletionChunk> {
    const body = this.#normalizeRequest({ ...req, stream: true });
    const { signal: inner, cleanup } = this.#combineSignal(signal);
    let res: Response;
    try {
      res = await withRetry(
        async () => {
          const r = await this.#fetch(`${this.#baseURL}/chat/completions`, {
            method: "POST",
            headers: { ...this.#buildHeaders(), Accept: "text/event-stream" },
            body: JSON.stringify(body),
            signal: inner,
          });
          if (!r.ok) throw await toApiError(r);
          return r;
        },
        this.#retry,
        inner,
      );
    } catch (err) {
      cleanup();
      throw wrapAbort(err, inner);
    }

    if (!res.body) {
      cleanup();
      throw new DshError("响应没有 body，无法进行流式解析。");
    }

    try {
      for await (const evt of parseSseStream(res.body, inner)) {
        if (evt.data === "[DONE]") return;
        let chunk: ChatCompletionChunk;
        try {
          chunk = JSON.parse(evt.data) as ChatCompletionChunk;
        } catch (cause) {
          throw new StreamParseError("无法解析流式 chunk JSON。", evt.data, { cause });
        }
        yield chunk;
      }
    } catch (err) {
      throw wrapAbort(err, inner);
    } finally {
      cleanup();
    }
  }

  /**
   * 便捷方法：流式对话并把增量累积成完整的 assistant 消息（含拼接好的 tool_calls）。
   * 回调 `onDelta` 会收到每次新增的文本内容，适合做打字机效果。
   */
  async streamToMessage(
    req: ChatRequest,
    onDelta?: (text: string, message: ChatMessage) => void,
    signal?: AbortSignal,
  ): Promise<ChatMessage> {
    const message: ChatMessage = { role: "assistant", content: "", tool_calls: [] };
    const calls: ToolCall[] = [];
    for await (const chunk of this.streamChat(req, signal)) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;
      if (typeof delta.content === "string" && delta.content.length > 0) {
        message.content = (message.content ?? "") + delta.content;
        onDelta?.(delta.content, message);
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          const existing = calls[idx] ?? {
            id: "",
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.function.name += tc.function.name;
          if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
          calls[idx] = existing;
        }
      }
    }
    if (calls.length > 0) {
      message.tool_calls = calls;
      message.content = message.content === "" ? null : message.content;
    } else {
      delete message.tool_calls;
    }
    return message;
  }
}

/** 从失败响应构造 ApiError，尽量解析出 error.code/message。 */
async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown;
  const text = await res.text().catch(() => "");
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  const err = (body as { error?: { code?: string; message?: string } })?.error;
  return new ApiError(res.status, res.statusText, body, { code: err?.code });
}

/** 将 abort 触发的底层错误统一转换为 AbortError。 */
function wrapAbort(err: unknown, signal: AbortSignal): unknown {
  if (signal.aborted) {
    const reason = (signal as AbortSignal & { reason?: unknown }).reason;
    if (reason instanceof AbortError) return reason;
    return new AbortError(undefined, { cause: err });
  }
  return err;
}
