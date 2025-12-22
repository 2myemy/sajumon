import { useRef, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useCharacters } from "../context/CharactersContext";
import { useGanji60 } from "../lib/useGanji60";
import CharacterCard from "../components/CharacterCard";
import Chat from "../components/Chat";

export default function LibraryDetail() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);
  
  const { key } = useParams<{ key: string }>();
  const {
    characters,
    isLoading: loadingProfiles,
    error: profilesError,
    reload,
  } = useCharacters();
  const {
    ganjiList,
    isLoading: loadingGanji,
    error: ganjiError,
  } = useGanji60();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [highlightChat, setHighlightChat] = useState(false);

  const ganji = ganjiList.find((g) => g.key === key);
  const profile = key ? characters[key] : undefined;

  const isLoading = loadingProfiles || loadingGanji;
  const error = ganjiError || profilesError;

  const scrollToChat = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightChat(true);
    window.setTimeout(() => setHighlightChat(false), 1200);
  };

  if (!key) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-zinc-300">Invalid route.</p>
        <Link to="/library" className="text-sm text-zinc-300 hover:text-white">
          ← Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/library" className="text-sm text-zinc-300 hover:text-white">
          ← Back to Library
        </Link>

        <div className="text-xs text-zinc-500">{key}</div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-sm font-semibold text-red-200">
            Failed to load data
          </div>
          <div className="mt-1 text-sm text-red-200/80">{error}</div>
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

      {isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-zinc-300">
          Loading…
        </div>
      ) : !ganji ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-lg font-semibold">Not found</div>
          <p className="mt-1 text-sm text-zinc-400">
            This ganji key doesn’t exist in ganji-60.json.
          </p>
        </div>
      ) : !profile ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-lg font-semibold">Profile coming soon</div>
          <p className="mt-1 text-sm text-zinc-400">
            The ganji exists, but the character profile hasn’t been added yet.
          </p>

          <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
            <div className="text-sm font-semibold">Day Pillar</div>
            <div className="mt-2 text-sm text-zinc-300">
              <span className="rounded-lg bg-white/10 px-2 py-1 font-semibold">
                {ganji.label}
              </span>
              <span className="ml-2 text-zinc-400">
                {ganji.stem} · {ganji.branch}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <CharacterCard
            ganji={ganji}
            profile={profile}
            onStartChat={scrollToChat}
          />

          <div
            ref={chatRef}
            className={`scroll-mt-24 rounded-3xl transition ${
              highlightChat ? "ring-2 ring-white/30" : ""
            }`}
          >
            <Chat profile={profile ?? null} isReady={!!ganji && !!profile} />
          </div>
          <div />
        </div>
      )}
    </div>
  );
}
