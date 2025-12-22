import { useRef, useState } from "react";
import type { BirthInput, CharacterProfile, Ganji } from "../lib/types";
import { useCharacters } from "../context/CharactersContext";
import { computeDayPillar } from "../lib/dayPillar";
import HomeHero from "../components/HomeHero";
import CharacterCard from "../components/CharacterCard";
import BirthForm from "../components/BirthForm";
import Chat from "../components/Chat";

export default function Home() {
  const { getByKey, isLoading, error, reload } = useCharacters();
  const [ganji, setGanji] = useState<Ganji | null>(null);
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [highlightChat, setHighlightChat] = useState(false);

  const handleSubmit = (_birth: BirthInput) => {
    if (isLoading) return;

    const ganji = computeDayPillar(_birth);
    const profile = getByKey(ganji.key);

    if (!profile) {
      console.error("Character profile not found:", ganji.key);
      alert("Sorry, we couldn't find your character profile yet.");
      return;
    }

    setGanji(ganji);
    setProfile(profile);
  };

  const scrollToChat = () => {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightChat(true);
    window.setTimeout(() => setHighlightChat(false), 1200);
  };

  return (
    <div className="space-y-6">
      <HomeHero />
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-sm font-semibold text-red-200">
            Failed to load character data
          </div>
          <div className="mt-1 text-sm text-red-200/80">{error}</div>

          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:opacity-90"
          >
            Retry
          </button>
        </div>
      )}

      <div id="birth">
        <BirthForm
          onSubmit={handleSubmit}
          disabled={isLoading || !!error}
          statusText={
            error
              ? "Character database failed to load. Please retry."
              : isLoading
              ? "Loading character database…"
              : undefined
          }
        />
      </div>
      {ganji && profile && (
        <>
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
        </>
      )}
    </div>
  );
}
