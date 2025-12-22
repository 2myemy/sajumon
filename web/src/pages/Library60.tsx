import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCharacters } from "../context/CharactersContext";
import type { Ganji } from "../lib/types";

type GanjiEntry = Ganji & { key: string };

type ElementFilter = "All" | "Wood" | "Fire" | "Earth" | "Metal" | "Water";
type BranchFilter =
  | "All"
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

type SortMode = "Ganji Order" | "A→Z Title" | "A→Z Animal";

const ELEMENTS: ElementFilter[] = [
  "All",
  "Wood",
  "Fire",
  "Earth",
  "Metal",
  "Water",
];
const BRANCH_ANIMALS: BranchFilter[] = [
  "All",
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

function extractElement(stemText: string): ElementFilter {
  // stemText example: "Gye (Yin Water)" or "Gap (Yang Wood)"
  const m = stemText.match(/\b(Wood|Fire|Earth|Metal|Water)\b/i);
  const e = (m?.[1] ?? "") as ElementFilter;
  return (ELEMENTS.includes(e) ? e : "All") as ElementFilter;
}

function extractBranchAnimal(branchText: string): BranchFilter {
  // branchText example: "Sa (Snake)" or "Ja (Rat)"
  const m = branchText.match(/\(([^)]+)\)/);
  const animal = (m?.[1] ?? "") as BranchFilter;
  return (BRANCH_ANIMALS.includes(animal) ? animal : "All") as BranchFilter;
}

export default function Library60() {
  const {
    characters,
    isLoading: isLoadingCharacters,
    error: charactersError,
    reload,
  } = useCharacters();

  const [ganjiList, setGanjiList] = useState<GanjiEntry[]>([]);
  const [isLoadingGanji, setIsLoadingGanji] = useState(true);
  const [ganjiError, setGanjiError] = useState<string | null>(null);

  // controls
  const [q, setQ] = useState("");
  const [element, setElement] = useState<ElementFilter>("All");
  const [branch, setBranch] = useState<BranchFilter>("All");
  const [sort, setSort] = useState<SortMode>("Ganji Order");

  useEffect(() => {
    let alive = true;

    async function loadGanji() {
      setIsLoadingGanji(true);
      setGanjiError(null);
      try {
        const res = await fetch("/data/ganji-60.json");
        if (!res.ok)
          throw new Error(`Failed to load ganji-60.json (${res.status})`);
        const data = (await res.json()) as GanjiEntry[];
        if (!alive) return;
        setGanjiList(data);
      } catch (e) {
        if (!alive) return;
        setGanjiError(e instanceof Error ? e.message : "Unknown error");
        setGanjiList([]);
      } finally {
        if (!alive) return;
        setIsLoadingGanji(false);
      }
    }

    void loadGanji();
    return () => {
      alive = false;
    };
  }, []);

  const isLoading = isLoadingGanji || isLoadingCharacters;
  const hasError = ganjiError || charactersError;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const items = ganjiList.filter((g) => {
      const profile = characters[g.key];

      if (element !== "All") {
        if (extractElement(g.stem) !== element) return false;
      }

      if (branch !== "All") {
        if (extractBranchAnimal(g.branch) !== branch) return false;
      }

      if (!query) return true;

      const haystack = [
        g.key,
        g.label,
        g.stem,
        g.branch,
        profile?.title ?? "",
        profile?.tagline ?? "",
        profile?.animal?.name ?? "",
        ...(profile?.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });

    // sort
    const sorted = [...items];
    sorted.sort((a, b) => {
      const pa = characters[a.key];
      const pb = characters[b.key];

      if (sort === "Ganji Order") return 0; // keep json order
      if (sort === "A→Z Title")
        return (pa?.title ?? "").localeCompare(pb?.title ?? "");
      if (sort === "A→Z Animal")
        return (pa?.animal?.name ?? "").localeCompare(pb?.animal?.name ?? "");
      return 0;
    });

    return sorted;
  }, [ganjiList, characters, q, element, branch, sort]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">60 Ganji Library</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Browse all 60 ganji and their character archetypes.
          </p>
        </div>

        {hasError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="text-sm font-semibold text-red-200">
              Data load failed
            </div>
            <div className="mt-1 text-sm text-red-200/80">
              {ganjiError || charactersError}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
              >
                Retry profiles
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/10"
              >
                Reload page
              </button>
            </div>
          </div>
        ) : null}
      </header>

      {/* Controls */}
      <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="block">
              <div className="mb-1 text-xs text-zinc-400">Search</div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder='Try: "Water Snake", "Gye-Sa", "precision"...'
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-white/20"
                disabled={isLoading}
              />
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block">
              <div className="mb-1 text-xs text-zinc-400">Element</div>
              <select
                value={element}
                onChange={(e) => setElement(e.target.value as ElementFilter)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-white/20"
                disabled={isLoading}
              >
                {ELEMENTS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block">
              <div className="mb-1 text-xs text-zinc-400">Branch</div>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value as BranchFilter)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-white/20"
                disabled={isLoading}
              >
                {BRANCH_ANIMALS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block">
              <div className="mb-1 text-xs text-zinc-400">Sort</div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-white/20"
                disabled={isLoading}
              >
                {(["Ganji Order", "A→Z Title", "A→Z Animal"] as SortMode[]).map(
                  (x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Showing <span className="text-zinc-300">{filtered.length}</span>{" "}
          results
        </div>
      </section>

      {/* Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          filtered.map((g) => {
            const p = characters[g.key];
            return (
              <Link key={g.key} to={`/library/${g.key}`} className="block transition hover:-translate-y-0.5 hover:opacity-95">
                <GanjiCard
                  ganji={g}
                  hasProfile={!!p}
                  title={p?.title}
                  animalName={p?.animal?.name}
                  animalImage={p?.animal?.image || `/animals/${g.key}.png`}
                  keywords={p?.keywords ?? []}
                  tagline={p?.tagline}
                />
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}

function GanjiCard({
  ganji,
  hasProfile,
  title,
  animalName,
  animalImage,
  keywords,
  tagline,
}: {
  ganji: GanjiEntry;
  hasProfile: boolean;
  title?: string;
  animalName?: string;
  animalImage: string;
  keywords: string[];
  tagline?: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-white/10 px-2 py-1 text-sm font-semibold">
              {ganji.label}
            </span>
            <span className="text-xs text-zinc-500">
              {animalName ? animalName : "—"}
            </span>
          </div>

          <div className="mt-3 text-sm font-semibold text-zinc-100">
            {hasProfile ? title : "Profile coming soon"}
          </div>
          {hasProfile ? (
            <p className="mt-1 text-sm text-zinc-300 line-clamp-2">{tagline}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              This ganji is listed, but the character profile hasn’t been added
              yet.
            </p>
          )}

          <div className="mt-3 text-xs text-zinc-400">
            <span className="text-zinc-500">{ganji.stem}</span>
            <span className="mx-2 text-zinc-700">•</span>
            <span className="text-zinc-500">{ganji.branch}</span>
          </div>
        </div>

        <div className="shrink-0">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <img
              src={animalImage}
              alt={animalName || ganji.key}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "0.25";
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-20 rounded bg-white/10" />
          <div className="mt-2 h-6 w-32 rounded bg-white/10" />
          <div className="mt-4 h-4 w-40 rounded bg-white/10" />
          <div className="mt-2 h-4 w-56 rounded bg-white/10" />
          <div className="mt-4 h-3 w-48 rounded bg-white/10" />
        </div>
        <div className="h-16 w-16 rounded-2xl bg-white/10" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-white/10" />
        <div className="h-6 w-20 rounded-full bg-white/10" />
        <div className="h-6 w-14 rounded-full bg-white/10" />
      </div>
      <div className="mt-4 h-7 w-24 rounded-full bg-white/10" />
    </div>
  );
}
