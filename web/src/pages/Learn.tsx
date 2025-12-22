import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

type ElementKey = "Wood" | "Fire" | "Earth" | "Metal" | "Water";
type Polarity = "Yang" | "Yin";
type Animal =
  | "Rat"
  | "Ox"
  | "Tiger"
  | "Rabbit"
  | "Dragon"
  | "Snake"
  | "Horse"
  | "Goat"
  | "Monkey"
  | "Rooster"
  | "Dog"
  | "Pig";

const ELEMENTS: ElementKey[] = ["Wood", "Fire", "Earth", "Metal", "Water"];
const ANIMALS: Animal[] = [
  "Rat",
  "Ox",
  "Tiger",
  "Rabbit",
  "Dragon",
  "Snake",
  "Horse",
  "Goat",
  "Monkey",
  "Rooster",
  "Dog",
  "Pig",
];

const EXAMPLE_BY_ELEMENT: Record<ElementKey, { stem: string; vibe: string }> = {
  Wood: { stem: "Gap/Eul", vibe: "growth, beginnings, direction" },
  Fire: { stem: "Byeong/Jeong", vibe: "energy, expression, momentum" },
  Earth: { stem: "Mu/Gi", vibe: "stability, structure, endurance" },
  Metal: { stem: "Gyeong/Sin", vibe: "clarity, standards, precision" },
  Water: { stem: "Im/Gye", vibe: "adaptability, depth, intuition" },
};

export default function Learn() {
  const [element, setElement] = useState<ElementKey>("Water");
  const [polarity, setPolarity] = useState<Polarity>("Yin");
  const [animal, setAnimal] = useState<Animal>("Snake");

  const example = useMemo(() => {
    const el = EXAMPLE_BY_ELEMENT[element];
    return {
      title: `${polarity} ${element} + ${animal}`,
      subtitle: `Example combo (not your real result): ${el.stem} · ${animal}`,
      vibe: el.vibe,
    };
  }, [element, polarity, animal]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-zinc-300 hover:text-white">
          ← Back to Generate
        </Link>

        <Link
          to="/library"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
        >
          Open Library
        </Link>
      </div>

      {/* Hero */}
      <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-3xl font-semibold">What is Saju?</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
          <span className="font-semibold">Saju</span> is a Korean astrology system often
          translated as{" "}
          <span className="font-semibold">"Four Pillars"</span>. It uses your birth
          information (date, and optionally time) to map a symbolic structure.
          <br />
          In Sajumon, we focus on the{" "}
          <span className="font-semibold">Day Pillar</span> and convert it into a
          character-like archetype you can explore and chat with.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Pill>Four Pillars</Pill>
          <Pill>Day Pillar = archetype</Pill>
          <Pill>60 combinations</Pill>
          <Pill>Time optional</Pill>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
          >
            Try mine →
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
          >
            Browse the 60 →
          </Link>
        </div>
      </header>

      {/* Four pillars at a glance */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card title="The 4 Pillars (at a glance)" subtitle="Saju uses four pillars: Year, Month, Day, and Hour.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniTile title="Year Pillar" desc="Background theme / environment" />
            <MiniTile title="Month Pillar" desc="Seasonal energy / tendencies" />
            <MiniTile title="Day Pillar" desc="Core self — used for your archetype" highlight />
            <MiniTile title="Hour Pillar" desc="Hidden drives (optional if unknown)" />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-300">
            <div className="font-semibold">Why Day Pillar?</div>
            <p className="mt-1 text-zinc-400">
              It's the most intuitive entry point for non-experts — a single, memorable
              archetype that still feels personal.
            </p>
          </div>
        </Card>

        <Card
          title="How the 60-day cycle works"
          subtitle="60 Day Pillars = 10 Heavenly Stems × 12 Earthly Branches"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Heavenly Stems" value="10" desc="Yin/Yang + 5 elements" />
            <MiniStat label="Earthly Branches" value="12" desc="12 animals (Rat → Pig)" />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-400">
            The system cycles through combinations in a fixed order. Any given day maps to
            one of the 60.
          </div>
        </Card>
      </section>

      {/* Interactive mini UI */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">A simple, intuitive model</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pick an element, Yin/Yang, and an animal to see how one "Day Pillar" is formed.
              (This is a learning demo — your real archetype is calculated from your birth date.)
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
            <div className="text-xs text-zinc-400">Example output</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{example.title}</div>
            <div className="mt-1 text-xs text-zinc-400">{example.subtitle}</div>
            <div className="mt-2 text-xs text-zinc-500">Vibe: {example.vibe}</div>
          </div>
        </div>

        {/* Element selector */}
        <div className="mt-6">
          <div className="mb-2 text-xs text-zinc-400">Element (5)</div>
          <div className="flex flex-wrap gap-2">
            {ELEMENTS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setElement(x)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  element === x
                    ? "border-white/20 bg-white/15 text-white"
                    : "border-white/10 bg-zinc-950/40 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {x}
              </button>
            ))}
          </div>
        </div>

        {/* Yin/Yang toggle */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
          <div>
            <div className="text-sm font-semibold">Yin / Yang</div>
            <p className="mt-1 text-xs text-zinc-500">
              Polarity adds a “style” to the element (more outward vs inward expression).
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={polarity === "Yang"}
            onClick={() => setPolarity((p) => (p === "Yin" ? "Yang" : "Yin"))}
            className={`relative h-8 w-16 rounded-full border transition ${
              polarity === "Yang" ? "border-white/20 bg-white/20" : "border-white/10 bg-white/5"
            }`}
          >
            <span
              className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white transition ${
                polarity === "Yang" ? "left-9" : "left-1"
              }`}
            />
            <span className="sr-only">Toggle Yin/Yang</span>
          </button>
        </div>

        {/* Animal grid */}
        <div className="mt-6">
          <div className="mb-2 text-xs text-zinc-400">Branch animal (12)</div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {ANIMALS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setAnimal(x)}
                className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  animal === x
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-zinc-950/40 text-zinc-200 hover:bg-white/10"
                }`}
              >
                <div className="text-xs text-zinc-400">Animal</div>
                <div className="mt-1 font-semibold">{x}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time note */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
          <div className="text-sm font-semibold">Do I need my birth time?</div>
          <p className="mt-1 text-sm text-zinc-400">
            No. In Sajumon, time is optional. If you know it, it can refine the calculation.
            One practical note: births around{" "}
            <span className="font-semibold text-zinc-200">23:00</span> may shift to the next day pillar.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Ready to generate yours?</h3>
            <p className="mt-1 text-sm text-zinc-400">
              We'll calculate your Day Pillar and match it to a character archetype.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
          >
            Generate my archetype →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-200">
      {children}
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-zinc-400">{subtitle}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MiniTile({
  title,
  desc,
  highlight,
}: {
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-emerald-400/25 bg-emerald-500/10"
          : "border-white/10 bg-zinc-950/40"
      }`}
    >
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{desc}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  desc,
}: {
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{desc}</div>
    </div>
  );
}
