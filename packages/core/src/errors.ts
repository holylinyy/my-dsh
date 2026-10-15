/** harness 统一错误类型层级。 */

export class DshError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DshError";
  }
}

/** HTTP / API 层错误：非 2xx 响应或响应体解析失败。 */
export class ApiError extends DshError {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  /** 服务端返回的错误码，如 rate_limit / insufficient_credits */
  readonly code?: string;
  /** 是否可重试 */
  readonly retryable: boolean;

  constructor(
    status: number,
    statusText: string,
    body: unknown,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(`DeepSeek API 请求失败：${status} ${statusText}`, { cause: body });
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.code = options?.code;
    this.retryable =
      options?.retryable ??
      (status === 429 || status === 500 || status === 502 || status === 503 || status === 504);
  }
}

/** 用户主动中断（AbortSignal）导致的错误。 */
export class AbortError extends DshError {
  constructor(message = "请求已被中断", options?: ErrorOptions) {
    super(message, options);
    this.name = "AbortError";
  }
}

/** 流式响应解析错误（SSE / JSON）。 */
export class StreamParseError extends DshError {
  readonly raw: string;
  constructor(message: string, raw: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StreamParseError";
    this.raw = raw;
  }
}
