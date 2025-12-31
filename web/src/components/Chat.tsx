import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProfile } from "../lib/types";
import { streamChat, type ChatMsg } from "../lib/streamChat";

type Props = {
  profile: CharacterProfile | null;
  isReady: boolean;
};

export default function Chat({ profile, isReady }: Props) {
  const archetypeId = (profile as any)?.key ?? "";
  const lang: "en" = "en";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  // token batching (optional)
  const tokenBufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const flushTokens = () => {
    const chunk = tokenBufferRef.current;
    if (!chunk) return;
    tokenBufferRef.current = "";

    setMessages((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== "assistant") return prev;

      const next = prev.slice(0, -1);
      next.push({ role: "assistant", content: last.content + chunk });
      return next;
    });
  };

  const scheduleFlush = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushTokens();
    });
  };

  const abortCurrent = (reason: string) => {
    const c = abortRef.current;
    if (!c) return;
    if (!c.signal.aborted) c.abort(reason);
    abortRef.current = null;
  };

  useEffect(() => {
    return () => {
      abortCurrent("unmount cleanup");
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If character changes, reset session + messages
  useEffect(() => {
    if (!archetypeId) return;
    abortCurrent("archetype changed");
    flushTokens();
    setError(null);
    setIsStreaming(false);
    setMessages([]);
    sessionIdRef.current = crypto.randomUUID();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archetypeId]);

  const canSend = useMemo(() => {
    return isReady && !!archetypeId && !isStreaming && input.trim().length > 0;
  }, [isReady, archetypeId, isStreaming, input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    const text = input.trim();
    setInput("");
    setError(null);

    abortCurrent("submit: abort previous");
    flushTokens();

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: text },
      { role: "assistant" as const, content: "" },
    ]);

    setIsStreaming(true);

    const historyToSend: ChatMsg[] = [
      ...messages,
      { role: "user" as const, content: text },
    ];

    try {
      await streamChat({
        sessionId: sessionIdRef.current,
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
          flushTokens();
        },
        onError: (err) => {
          flushTokens();
          setError(err);
        },
      });
    } finally {
      flushTokens();
      setIsStreaming(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  if (!profile) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        Select a character to start chatting.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Chat</div>
          <div className="text-xs text-white/60">
            ready: {String(isReady)} · archetype: {archetypeId} · lang: en
          </div>
        </div>

        {isStreaming ? (
          <button
            type="button"
            onClick={() => abortCurrent("user stop")}
            className="rounded-xl border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15"
          >
            Stop
          </button>
        ) : null}
      </div>

      <div className="h-[420px] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-3 space-y-4">
        {messages.length === 0 ? (
          <div className="text-sm text-white/60">Say hi to start.</div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className="whitespace-pre-wrap">
              <div className="mb-1 text-[11px] text-white/50">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="text-sm text-white">{m.content}</div>
            </div>
          ))
        )}
      </div>

      {error ? (
        <div className="mt-2 text-sm text-red-200 whitespace-pre-wrap">{error}</div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!isReady || !archetypeId || isStreaming}
          placeholder={isStreaming ? "Streaming…" : "Type a message"}
          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
