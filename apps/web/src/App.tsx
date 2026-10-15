import { DeepSeekClientProvider, useChat } from "@my-dsh/react";
import { useMemo, useState, type FormEvent } from "react";

import { createClient } from "./lib/createClient";

export function App() {
  const client = useMemo(() => createClient(), []);
  return (
    <DeepSeekClientProvider client={client}>
      <div className="app">
        <header className="header">
          <h1>my-dsh</h1>
          <p className="sub">类 DeepSeek harness · 流式对话 playground</p>
        </header>
        <Chat />
      </div>
    </DeepSeekClientProvider>
  );
}

function Chat() {
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage, stop, reset } = useChat({
    initialMessages: [{ role: "system", content: "你是一个简洁、友好的中文助手。" }],
    model: "deepseek-chat",
    temperature: 0.7,
  });

  async function submit() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    await sendMessage(text);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  return (
    <section className="chat">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <span className="role">{m.role}</span>
            <div className="content">
              {m.content ??
                (m.tool_calls
                  ? `🔧 调用工具: ${m.tool_calls.map((t) => t.function.name).join(", ")}`
                  : "")}
            </div>
          </div>
        ))}
        {isLoading && <div className="hint">正在生成…</div>}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息，Enter 发送 / Shift+Enter 换行"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <div className="actions">
          <button type="button" className="ghost" onClick={reset} disabled={isLoading}>
            清空
          </button>
          {isLoading ? (
            <button type="button" className="stop" onClick={stop}>
              停止
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()}>
              发送
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
