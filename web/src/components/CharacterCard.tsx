import type { CharacterProfile, Ganji } from "../lib/types";

export default function CharacterCard({
  ganji,
  profile,
  onStartChat,
}: {
  ganji: Ganji;
  profile: CharacterProfile;
  onStartChat: () => void;
}) {
  const animal = profile.animal;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
      {/* HERO HEADER (Generated 느낌) */}
      <div className="relative border-b border-white/10 bg-gradient-to-br from-white/10 via-white/[0.04] to-transparent px-6 py-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              {profile.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-300">{profile.tagline}</p>

            {/* Ganji pill */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-white/10 px-2 py-1 text-sm font-semibold">
                {ganji.label}
              </span>
              <span className="text-sm text-zinc-400">
                {ganji.stem} · {ganji.branch}
              </span>
              <span className="text-xs text-zinc-500">Day Pillar (Ganji)</span>
            </div>

            {/* Keywords */}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-white/10 bg-zinc-950/60 px-3 py-1 text-xs text-zinc-200"
                >
                  #{k}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onStartChat}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
              >
                Start chat with this character →
              </button>
            </div>
          </div>

          {/* Animal spotlight */}
          <div className="shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-lg">
                <img
                  src={animal.image}
                  alt={animal.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <div className="text-xs text-zinc-400">Animal Archetype</div>
                <div className="mt-1 text-base font-semibold text-zinc-100">
                  {animal.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* BODY */}
      <div className="px-6 py-6">
        {/* Animal traits */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                How your archetype behaves
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                These traits influence the tone of your chat guidance.
              </div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              {animal.traits.length} traits
            </span>
          </div>

          <ul className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
            {animal.traits.map((t) => (
              <li
                key={t}
                className="flex gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <span className="text-zinc-500">•</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Strengths / Watch-outs / Advice tone */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Block title="Strengths" items={profile.strengths} />
          <Block title="Watch-outs" items={profile.pitfalls} />
        </div>
      </div>
    </section>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-zinc-300">
        {items.map((x) => (
          <li
            key={x}
            className="flex gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <span className="text-zinc-500">•</span>
            <span className="leading-relaxed">{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
