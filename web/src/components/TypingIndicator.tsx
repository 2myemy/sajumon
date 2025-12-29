export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-zinc-900/70 px-3 py-2">
      <span className="sr-only">Typing</span>
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 animate-[pulse_1.2s_ease-in-out_infinite] [animation-delay:-0.24s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 animate-[pulse_1.2s_ease-in-out_infinite] [animation-delay:-0.12s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-200 animate-[pulse_1.2s_ease-in-out_infinite]" />
    </div>
  );
}
