import { useMemo, useState } from "react";
import type { CharacterProfile } from "../lib/types";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat({
  profile,
  isReady,
}: {
  profile: CharacterProfile | null;
  isReady: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Generate your Ganji first — then we can chat.",
    },
  ]);
  const [input, setInput] = useState("");

  const animal = profile?.animal;

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

  // ✅ ready 상태면 정상 chat
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
                avatarSrc={animal.image}
                avatarAlt={animal.name}
                title={profile.title}
              />
            ) : (
              <UserBubble key={idx} content={m.content} />
            )
          )}
        </div>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = input.trim();
          if (!text) return;

          setMessages((prev) => [
            ...prev,
            { role: "user", content: text },
            {
              role: "assistant",
              content:
                "Got it. (Once the backend is connected, a real model response will appear here.)",
            },
          ]);
          setInput("");
        }}
      >
        <input
          className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-white/20"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function AssistantBubble({
  content,
  avatarSrc,
  avatarAlt,
  title,
}: {
  content: string;
  avatarSrc: string;
  avatarAlt: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
        <img src={avatarSrc} alt={avatarAlt} className="h-full w-full object-cover" loading="lazy" />
      </div>

      <div className="max-w-[85%]">
        <div className="mb-1 text-xs text-zinc-500">{title}</div>
        <div className="rounded-2xl bg-white/10 px-3 py-2 text-sm leading-relaxed text-zinc-100">
          {content}
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
