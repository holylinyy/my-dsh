/** 指数退避 + 抖动 的重试策略。 */

export interface RetryOptions {
  /** 最大重试次数（不含首次尝试），默认 2 */
  maxRetries?: number;
  /** 基础延迟毫秒，默认 500 */
  baseDelayMs?: number;
  /** 最大延迟毫秒上限，默认 30_000 */
  maxDelayMs?: number;
  /** 判断错误是否可重试 */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** 每次等待回调，便于测试或上报 */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, "shouldRetry" | "onRetry">> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

/** 计算第 attempt 次（从 1 开始）重试的延迟：full jitter 指数退避。 */
export function computeBackoff(attempt: number, opts: RetryOptions = {}): number {
  const { baseDelayMs = DEFAULTS.baseDelayMs, maxDelayMs = DEFAULTS.maxDelayMs } = opts;
  const exp = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  // full jitter: [0, exp]
  return Math.round(Math.random() * exp);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * 包裹一个返回 Promise 的工厂函数，按策略重试。
 * 若错误不可重试或次数耗尽，则原样抛出。
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const { maxRetries = DEFAULTS.maxRetries, shouldRetry, onRetry } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const retryable = shouldRetry ? shouldRetry(error, attempt) : isDefaultRetryable(error);
      if (!retryable || attempt >= maxRetries) {
        throw error;
      }
      const wait = computeBackoff(attempt + 1, opts);
      onRetry?.(error, attempt + 1, wait);
      await delay(wait, signal);
    }
  }
  throw lastError;
}

/** 默认可重试判断：网络错误、AbortError 之外的 429/5xx。 */
function isDefaultRetryable(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) {
    return Boolean((error as { retryable: unknown }).retryable);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }
  // TypeError（fetch 网络失败）等默认可重试
  return true;
}
