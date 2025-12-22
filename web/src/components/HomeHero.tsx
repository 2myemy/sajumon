import { Link } from "react-router-dom";

export default function HomeHero() {
  return (
    <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-200">
          Korean astrology (Saju)
        </span>
        <span className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-200">
          Based on your birth date
        </span>
        <span className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-200">
          60 symbolic archetypes (Ganji)
        </span>
      </div>

      {/* Title */}
      <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
        Generate your Saju archetype (Ganji)
      </h1>
      <Link
        to="/learn"
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200 hover:text-white"
      >
        What is Saju?
        <span className="translate-y-[1px]">→</span>
      </Link>

      {/* Subcopy */}
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
        Enter your{" "}
        <span className="font-semibold text-zinc-100">date of birth</span> to
        calculate your{" "}
        <span className="font-semibold text-zinc-100">Day Pillar</span> — one of
        60 symbolic combinations (Ganji). We'll match it to a character profile and let
        you chat in that style.
      </p>

      <p className="mt-2 text-xs text-zinc-500">
        If you don't know your birth time, leave it off — you can still generate
        your archetype. Births around{" "}
        <span className="text-zinc-300 font-semibold">23:00</span> may shift to
        the next day archetype.
      </p>

      {/* Micro CTA row */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href="#birth"
          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
        >
          Start with my birthday ↓
        </a>

        <Link
          to="/library"
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
        >
          Browse all 60 Ganji→
        </Link>
      </div>
    </header>
  );
}
