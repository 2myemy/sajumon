import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CharacterProfile } from "../lib/types";

export type CharactersMap = Record<string, CharacterProfile>;

type CharactersContextValue = {
  characters: CharactersMap;
  isLoading: boolean;
  error: string | null;
  getByKey: (key: string) => CharacterProfile | undefined;
  reload: () => Promise<void>;
};

const CharactersContext = createContext<CharactersContextValue | null>(null);

async function fetchCharacters(): Promise<CharactersMap> {
  const res = await fetch("/data/characters-60.json");
  if (!res.ok) throw new Error(`Failed to load characters-60.json (${res.status})`);
  return res.json();
}

export function CharactersProvider({ children }: { children: React.ReactNode }) {
  const [characters, setCharacters] = useState<CharactersMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCharacters();
      setCharacters(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setCharacters({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<CharactersContextValue>(() => {
    return {
      characters,
      isLoading,
      error,
      getByKey: (key: string) => characters[key],
      reload,
    };
  }, [characters, isLoading, error]);

  return <CharactersContext.Provider value={value}>{children}</CharactersContext.Provider>;
}

export function useCharacters() {
  const ctx = useContext(CharactersContext);
  if (!ctx) {
    throw new Error("useCharacters must be used within <CharactersProvider />");
  }
  return ctx;
}
