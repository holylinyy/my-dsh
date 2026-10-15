export { DeepSeekClient, type DeepSeekClientOptions } from "./client";
export { AbortError, ApiError, DshError, StreamParseError } from "./errors";
export { computeBackoff, withRetry, type RetryOptions } from "./retry";
export { parseSseStream, type SseEvent } from "./sse";
export type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionChunkChoice,
  ChatCompletionChunkDelta,
  ChatCompletionChoice,
  ChatMessage,
  ChatRequest,
  FetchLike,
  FinishReason,
  Role,
  Tool,
  ToolCall,
  ToolChoice,
  Usage,
} from "./types";
