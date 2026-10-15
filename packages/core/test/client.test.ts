import { describe, expect, it, vi } from "vitest";

import { DeepSeekClient, ApiError } from "../src";
import type { FetchLike } from "../src";

function sseResponse(chunks: unknown[], done = true): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(c)}\n\n`));
      }
      if (done) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

const baseOptions = { apiKey: "sk-test", model: "deepseek-chat" };

describe("DeepSeekClient.createChatCompletion", () => {
  it("返回非流式补全并带上 Authorization 头", async () => {
    const fetchMock: FetchLike = vi.fn(async (_url, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer sk-test");
      return Response.json({
        id: "cmpl-1",
        object: "chat.completion",
        created: 1,
        model: "deepseek-chat",
        choices: [
          { index: 0, message: { role: "assistant", content: "你好" }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      });
    });
    const client = new DeepSeekClient({ ...baseOptions, fetch: fetchMock });
    const res = await client.createChatCompletion({ messages: [{ role: "user", content: "hi" }] });
    expect(res.choices[0]?.message.content).toBe("你好");
    expect(res.usage?.total_tokens).toBe(7);
  });

  it("非 2xx 抛出 ApiError", async () => {
    const fetchMock: FetchLike = vi.fn(async () =>
      Response.json({ error: { code: "invalid_request", message: "bad" } }, { status: 400 }),
    );
    const client = new DeepSeekClient({ ...baseOptions, fetch: fetchMock });
    await expect(client.createChatCompletion({ messages: [] })).rejects.toBeInstanceOf(ApiError);
  });

  it("5xx 会按重试策略重试后成功", async () => {
    let calls = 0;
    const fetchMock: FetchLike = vi.fn(async () => {
      calls++;
      if (calls < 3) {
        return new Response("server error", { status: 503 });
      }
      return Response.json({
        id: "x",
        object: "chat.completion",
        created: 0,
        model: "deepseek-chat",
        choices: [
          { index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
        ],
      });
    });
    const client = new DeepSeekClient({
      ...baseOptions,
      fetch: fetchMock,
      retry: { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 2 },
    });
    const res = await client.createChatCompletion({ messages: [] });
    expect(res.choices[0]?.message.content).toBe("ok");
    expect(calls).toBe(3);
  });
});

describe("DeepSeekClient.streamChat", () => {
  it("解析 SSE chunk 序列", async () => {
    const fetchMock: FetchLike = vi.fn(async () =>
      sseResponse([
        {
          id: "c1",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-chat",
          choices: [{ index: 0, delta: { role: "assistant", content: "He" }, finish_reason: null }],
        },
        {
          id: "c1",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-chat",
          choices: [{ index: 0, delta: { content: "llo" }, finish_reason: "stop" }],
        },
      ]),
    );
    const client = new DeepSeekClient({ ...baseOptions, fetch: fetchMock });
    const texts: string[] = [];
    for await (const chunk of client.streamChat({ messages: [] })) {
      texts.push(chunk.choices[0]?.delta.content ?? "");
    }
    expect(texts.join("")).toBe("Hello");
  });

  it("streamToMessage 累积文本与 tool_calls", async () => {
    const fetchMock: FetchLike = vi.fn(async () =>
      sseResponse([
        {
          id: "c",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-chat",
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  { index: 0, id: "call_1", function: { name: "get_weather", arguments: '{"ci' } },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          id: "c",
          object: "chat.completion.chunk",
          created: 0,
          model: "deepseek-chat",
          choices: [
            {
              index: 0,
              delta: { tool_calls: [{ index: 0, function: { arguments: 'ty":"SZ"}' } }] },
              finish_reason: "tool_calls",
            },
          ],
        },
      ]),
    );
    const client = new DeepSeekClient({ ...baseOptions, fetch: fetchMock });
    const msg = await client.streamToMessage({ messages: [] });
    expect(msg.tool_calls?.[0]?.function.name).toBe("get_weather");
    expect(msg.tool_calls?.[0]?.function.arguments).toBe('{"city":"SZ"}');
  });
});
