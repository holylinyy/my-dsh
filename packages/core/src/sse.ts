/**
 * 将 SSE（Server-Sent Events）字节流解析为 data 字段负载的异步迭代器。
 * 兼容 `data: {...}` 与 `data:[DONE]`，忽略注释行与 event/id/retry 字段。
 */

const DECODER = () => new TextDecoder("utf-8");

export interface SseEvent {
  /** 事件的 data 内容（多行 data 会以 \n 拼接），已去掉前导空格 */
  data: string;
}

/**
 * 逐块解析 SSE 流。遇到 `[DONE]` 会 yield 该字符串后结束。
 * 调用方负责判断 `data === "[DONE]"`。
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent, void, unknown> {
  const reader = body.getReader();
  const decoder = DECODER();
  let buffer = "";

  if (signal?.aborted) {
    reader.cancel().catch(() => {});
    return;
  }
  const onAbort = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以空行分隔；行分隔符可能是 \n\n、\r\n\r\n、\r\r
      let sep: RegExpMatchArray | null;
      while ((sep = buffer.match(/\r\n\r\n|\n\n|\r\r/)) !== null) {
        const rawEvent = buffer.slice(0, sep.index);
        buffer = buffer.slice((sep.index ?? 0) + sep[0].length);
        const evt = parseEventBlock(rawEvent);
        if (evt !== null) yield evt;
      }
    }
    // 处理结尾未以空行终止的残留
    buffer += decoder.decode();
    const tail = parseEventBlock(buffer);
    if (tail !== null) yield tail;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

/** 解析单个事件块，提取所有 data 行。无 data 时返回 null。 */
function parseEventBlock(block: string): SseEvent | null {
  const lines = block.split(/\r\n|\n|\r/);
  const dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue; // 注释
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== "data") continue;
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1); // 去掉一个前导空格
    dataParts.push(value);
  }
  if (dataParts.length === 0) return null;
  return { data: dataParts.join("\n") };
}
