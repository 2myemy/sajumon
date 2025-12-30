import { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterProfile } from "../lib/types";
import { streamChat } from "../lib/streamChat";
import { getSessionId, resetSessionId } from "../lib/session";
import { TypingIndicator } from "./TypingIndicator";

type Msg = {
  role: "user" | "assistant";
  content: string;
  archetypeId?: string;
  avatarSrc?: string;
  avatarAlt?: string;
  title?: string;
};

export default function Chat({
  profile,
  isReady,
}: {
  profile: CharacterProfile | null;
  isReady: boolean;
}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `What would you like to talk about? Choose a number.
1) My personality
2) Fortune
3) Work / career
4) Relationships
5) Just chat`,
    },
  ]);
  const [input, setInput] = useState("");

  const animal = profile?.animal;

  // ✅ 중복 submit 방지 + 요청 취소 컨트롤
  const lockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // ✅ 최신 messages를 동기적으로 참조하기 위한 ref (historyToSend 버그 해결)
  const messagesRef = useRef<Msg[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ✅ StrictMode 개발환경에서 "즉시 cleanup → abort" 방지
  const mountedOnceRef = useRef(false);

  // ✅ unmount 시 진행 중 요청 정리 (StrictMode 첫 cleanup은 무시)
  useEffect(() => {
    resetSessionId();

    if (!mountedOnceRef.current) {
      mountedOnceRef.current = true;
    }

    return () => {
      // React 18 StrictMode(dev): mount→cleanup→mount를 한 번 돌릴 수 있음
      // 첫 cleanup에서 네트워크 abort가 발생해 "Error: aborted"가 나올 수 있어 방지
      if (!mountedOnceRef.current) return;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // ✅ 하드 락: 빠른 연타/중복 submit 방지
    if (lockRef.current) return;
    lockRef.current = true;

    // ✅ 이전 요청이 남아있으면 중단
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setInput("");

    const sessionId = getSessionId();
    let assistantText = "";

    // ✅ 요청 "직전" messages 기준으로 history를 동기적으로 생성 (setState race 제거)
    const historyToSend = messagesRef.current.slice(-10);

    // UI에 사용자 메시지 + assistant placeholder 먼저 반영
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

    const endStreamingUI = () => setIsStreaming(false);

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
          endStreamingUI();
        },
        onError: (err) => {
          endStreamingUI();
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            const msg = `Error: ${err}`;

            if (next[lastIdx]?.role === "assistant") {
              // 기존 placeholder를 에러로 교체하되 프로필 메타는 유지
              next[lastIdx] = {
                ...(next[lastIdx] as Msg),
                role: "assistant",
                content: msg,
              };
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

      // ✅ "내가 만든 controller"가 여전히 current일 때만 null 처리
      if (abortRef.current === controller) abortRef.current = null;

      endStreamingUI();
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
                isTyping={isStreaming && m.content.length === 0 && idx === messages.length - 1}
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
