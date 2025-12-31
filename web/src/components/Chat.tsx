import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProfile } from "../lib/types";
import { streamChat } from "../lib/streamChat";
import { getSessionId, resetSessionId } from "../lib/session";
import { TypingIndicator } from "./TypingIndicator";

const isDev = import.meta.env.DEV;

type Msg = {
  role: "user" | "assistant";
  content: string;
  archetypeId?: string;
  avatarSrc?: string;
  avatarAlt?: string;
  title?: string;
};

const WELCOME_MSG = `What would you like to talk about? Choose a number.
1) My personality
2) Fortune
3) Work / career
4) Relationships
5) Just chat`;

export default function Chat({
  profile,
  isReady,
}: {
  profile: CharacterProfile | null;
  isReady: boolean;
}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: WELCOME_MSG },
  ]);
  const [input, setInput] = useState("");

  const animal = profile?.animal;

  // submit lock + current request controller
  const lockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // keep latest messages in a ref for synchronous history building
  const messagesRef = useRef<Msg[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // keep latest isStreaming in a ref (avoid stale closure/timing)
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    console.log("[Chat] mounted");
    return () => console.log("[Chat] unmounted");
  }, []);

  // abort tracing
  const abortReasonRef = useRef<string | null>(null);
  const abortCurrent = (reason: string) => {
    console.log("[Chat] abortCurrent called:", reason);
    const c = abortRef.current;
    if (!c) return;
    if (!c.signal.aborted) c.abort(reason);
    abortReasonRef.current = reason;
  };

  // React 18 StrictMode(dev): mount -> cleanup -> mount (fake unmount) once
  const cleanupCountRef = useRef(0);
  useEffect(() => {
    resetSessionId();

    return () => {
      cleanupCountRef.current += 1;
      if (isDev && cleanupCountRef.current === 1) {
        console.log("[Chat] skip first dev cleanup abort (StrictMode)");
        return;
      }

      if (isStreamingRef.current) {
        abortCurrent("unmount cleanup (only if streaming)");
      }
    };
  }, []);

  const placeholder = useMemo(() => {
    if (!profile) return 'e.g., "Help me with my career"';
    return `e.g., "Give me career advice as a ${profile.title}"`;
  }, [profile]);

  if (!isReady || !profile || !animal) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 opacity-70">
        <div className="mb-3">
          <h3 className="text-lg font-semibold">Character Chat</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Generate your Ganji to unlock chat.
          </p>
        </div>

        <div className="h-80 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
          <div className="text-sm text-zinc-400">
            Your character will appear here after generation.
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none"
            value=""
            placeholder={placeholder}
            disabled
            readOnly
          />
          <button
            type="button"
            className="rounded-xl bg-white/40 px-4 py-2 text-sm font-semibold text-zinc-950"
            disabled
          >
            Send
          </button>
        </div>
      </section>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const text = input.trim();
    if (!text) return;

    // prevent double-submit
    if (lockRef.current) return;
    lockRef.current = true;

    // abort previous request ONLY if streaming is actually active
    if (abortRef.current && isStreamingRef.current) {
      abortCurrent("submit: abort previous (only if streaming)");
    }

    const controller = new AbortController();
    abortRef.current = controller;

    controller.signal.addEventListener("abort", () => {
      console.log("[Chat] controller aborted. reason:", abortReasonRef.current);
    });

    setIsStreaming(true);
    setInput("");

    const sessionId = getSessionId();

    // build history synchronously from ref (no setState race)
    const historyToSend = messagesRef.current.slice(-10);

    // optimistic UI: user msg + assistant placeholder
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      {
        role: "assistant",
        content: "",
        archetypeId: profile.id,
        avatarSrc: animal.image,
        avatarAlt: animal.name,
        title: profile.title,
      },
    ]);

    let assistantText = "";

    const finalize = () => setIsStreaming(false);

    try {
      await streamChat({
        sessionId,
        archetypeId: profile.id,
        lang: "en",
        message: text,
        history: historyToSend,
        signal: controller.signal,

        onToken: (t) => {
          assistantText += t;
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;

            if (next[lastIdx]?.role === "assistant") {
              next[lastIdx] = {
                ...(next[lastIdx] as Msg),
                content: assistantText,
                archetypeId: profile.id,
                avatarSrc: animal.image,
                avatarAlt: animal.name,
                title: profile.title,
              };
            } else {
              next.push({
                role: "assistant",
                content: assistantText,
                archetypeId: profile.id,
                avatarSrc: animal.image,
                avatarAlt: animal.name,
                title: profile.title,
              });
            }

            return next;
          });
        },

        onDone: () => {
          finalize();
        },

        onError: (err) => {
          finalize();
          console.log("[Chat] onError:", err);
          console.log("[Chat] last assistant:", assistantText.slice(0, 120));

          // ✅ aborted는 "정상 취소"로 보고 UI에 에러로 표시하지 않음
          if (err === "aborted") return;

          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            const msg = `Error: ${err}`;

            if (next[lastIdx]?.role === "assistant") {
              next[lastIdx] = { ...(next[lastIdx] as Msg), content: msg };
            } else {
              next.push({
                role: "assistant",
                content: msg,
                archetypeId: profile.id,
                avatarSrc: animal.image,
                avatarAlt: animal.name,
                title: profile.title,
              });
            }
            return next;
          });
        },
      });
    } finally {
      lockRef.current = false;

      // only clear abortRef if it's still our controller
      if (abortRef.current === controller) abortRef.current = null;

      finalize();
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Character Chat</h3>

        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-zinc-200">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Archetype: <span className="font-semibold">{animal.name}</span>
        </div>
      </div>

      <div className="h-80 overflow-auto rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
        <div className="space-y-4">
          {messages.map((m, idx) =>
            m.role === "assistant" ? (
              <AssistantBubble
                key={idx}
                content={m.content}
                isTyping={
                  isStreaming &&
                  m.content.length === 0 &&
                  idx === messages.length - 1
                }
                avatarSrc={m.avatarSrc ?? animal.image}
                avatarAlt={m.avatarAlt ?? animal.name}
                title={m.title ?? profile.title}
              />
            ) : (
              <UserBubble key={idx} content={m.content} />
            )
          )}
        </div>
      </div>

      <form className="mt-3 flex gap-2" onSubmit={onSubmit}>
        <input
          className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-white/20"
          value={input}
          disabled={isStreaming}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50"
        >
          {isStreaming ? "..." : "Send"}
        </button>
      </form>
    </section>
  );
}

function AssistantBubble({
  content,
  isTyping,
  avatarSrc,
  avatarAlt,
  title,
}: {
  content: string;
  isTyping?: boolean;
  avatarSrc: string;
  avatarAlt: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <img
          src={avatarSrc}
          alt={avatarAlt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="max-w-[85%]">
        <div className="mb-1 text-xs text-zinc-500">{title}</div>
        <div className="whitespace-pre-line rounded-2xl bg-white/10 px-3 py-2 text-sm leading-relaxed text-zinc-100">
          {isTyping ? <TypingIndicator /> : content}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm leading-relaxed text-zinc-950">
        {content}
      </div>
    </div>
  );
}
