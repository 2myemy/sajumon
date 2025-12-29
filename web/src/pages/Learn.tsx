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
  Wood: { stem: "Gap/Eul", vibe: "growth, new starts, direction" },
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
      subtitle: `Demo only (not your real result): ${el.stem} · ${animal}`,
      vibe: el.vibe,
    };
  }, [element, polarity, animal]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link to="/" className="text-sm text-zinc-300 hover:text-white">
          ← Back
        </Link>

        <Link
          to="/library"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
        >
          Browse 60 characters
        </Link>
      </div>

      {/* Hero */}
      <header className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-3xl font-semibold">What is Saju?</h1>

        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
          <span className="font-semibold">Saju</span> is a Korean tradition that uses your
          birthday to create a simple "type."
          <br />
          <br />
          In Sajumon, we call your type <span className="font-semibold">Ganji</span>.
          Your Ganji becomes a <span className="font-semibold">character archetype</span> you can
          read about and chat with.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Pill>Enter your birthday</Pill>
          <Pill>Get your Ganji type</Pill>
          <Pill>One of 60 characters</Pill>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
          >
            Get my character →
          </Link>
          <Link
            to="/library"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
          >
            See all 60 →
          </Link>
        </div>
      </header>

      {/* Simple explanation cards */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card
          title="Ganji = your character type"
          subtitle="It’s your main type, based on your birthday."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniTile title="Birthday" desc="The only thing we need" highlight />
            <MiniTile title="Ganji" desc="Your type (one of 60)" />
            <MiniTile title="Archetype" desc="A personality-style description" />
            <MiniTile title="Character" desc="A friendly guide you can chat with" />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-400">
            We keep it simple: one clear type → one character.
          </div>
        </Card>

        <Card
          title="Why there are 60 types"
          subtitle="Ganji is made from 2 parts."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Part 1" value="10" desc="Element styles (Yin/Yang + 5 elements)" />
            <MiniStat label="Part 2" value="12" desc="Animal signs (Rat → Pig)" />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4 text-sm text-zinc-400">
            10 × 12 = 60. That’s why there are 60 Ganji characters.
          </div>
        </Card>
      </section>

      {/* Interactive mini UI */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Try a quick demo</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pick an element, Yin/Yang, and an animal to see what a Ganji type looks like.
              (This is only a demo.)
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3">
            <div className="text-xs text-zinc-400">Demo result</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">{example.title}</div>
            <div className="mt-1 text-xs text-zinc-400">{example.subtitle}</div>
            <div className="mt-2 text-xs text-zinc-500">Vibe: {example.vibe}</div>
          </div>
        </div>

        {/* Element selector */}
        <div className="mt-6">
          <div className="mb-2 text-xs text-zinc-400">Pick an element</div>
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
            <div className="text-sm font-semibold">Yin or Yang</div>
            <p className="mt-1 text-xs text-zinc-500">
              Just two "styles": softer vs stronger energy.
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
          <div className="mb-2 text-xs text-zinc-400">Pick an animal</div>
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
            No. A birthday is enough to get your Ganji character.
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Ready?</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Enter your birthday and meet your Ganji character.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
          >
            Get my character →
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
