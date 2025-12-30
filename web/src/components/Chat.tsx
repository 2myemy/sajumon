import React, { useEffect, useMemo, useRef, useState } from "react";
import { streamChat, type ChatMsg } from "../lib/streamChat";

type Props = {
  sessionId: string;
  archetypeId: string;
  lang: "en" | "ko";
};

export default function Chat({ sessionId, archetypeId, lang }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // current streaming controller (owned by Chat)
  const abortRef = useRef<AbortController | null>(null);

  // rAF batching for tokens (prevents too many setStates)
  const tokenBufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const canSend = useMemo(() => {
    return !!input.trim() && !isStreaming;
  }, [input, isStreaming]);

  const flushTokenBuffer = () => {
    if (!tokenBufferRef.current) return;
    const chunk = tokenBufferRef.current;
    tokenBufferRef.current = "";

    setMessages((prev) => {
      if (!prev.length) return prev;

      const last = prev[prev.length - 1];
      if (last.role !== "assistant") return prev;

      const next = prev.slice(0, -1);
      next.push({ ...last, content: last.content + chunk });
      return next;
    });
  };

  const scheduleFlush = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushTokenBuffer();
    });
  };

  const abortCurrent = (reason: string) => {
    const c = abortRef.current;
    if (!c) return;
    if (!c.signal.aborted) {
      // (optional) debug
      console.log("[Chat] abortCurrent:", reason);
      c.abort(reason);
    }
    abortRef.current = null;
  };

  useEffect(() => {
    return () => {
      // cleanup on unmount
      abortCurrent("unmount cleanup");
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);

    // abort any previous stream (safety)
    abortCurrent("submit: abort previous");

    // create new controller for this request
    const controller = new AbortController();
    abortRef.current = controller;

    // add user msg + placeholder assistant msg
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    setIsStreaming(true);

    // history to send (commonly: everything except the placeholder assistant)
    const historyToSend: ChatMsg[] = [
      ...messages,
      { role: "user" as const, content: text },
    ];

    try {
      await streamChat({
        sessionId,
        archetypeId,
        lang,
        message: text,
        history: historyToSend,
        signal: controller.signal,

        onToken: (t) => {
          tokenBufferRef.current += t;
          scheduleFlush();
        },

        onDone: () => {
          // flush any leftover tokens
          flushTokenBuffer();
        },

        onError: (err) => {
          // NOTE: streamChat will NOT call onError for AbortError by default
          flushTokenBuffer();
          setError(err);
        },
      });
    } finally {
      flushTokenBuffer();
      setIsStreaming(false);

      // clear controller if it is still ours
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Chat</h2>
        {isStreaming ? (
          <button
            type="button"
            className="px-3 py-1 rounded border"
            onClick={() => abortCurrent("user cancel button")}
          >
            Stop
          </button>
        ) : null}
      </div>

      <div className="border rounded p-3 h-[420px] overflow-auto space-y-3 bg-white">
        {messages.length === 0 ? (
          <div className="text-sm text-gray-500">Say something to start.</div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className="whitespace-pre-wrap">
              <div className="text-xs text-gray-500 mb-1">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="text-sm">{m.content}</div>
            </div>
          ))
        )}
      </div>

      {error ? (
        <div className="mt-2 text-sm text-red-600 whitespace-pre-wrap">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder={lang === "ko" ? "메시지를 입력하세요" : "Type a message"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isStreaming}
        />
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
          type="submit"
          disabled={!canSend}
        >
          Send
        </button>
      </form>
    </div>
  );
}
