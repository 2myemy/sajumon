import { useEffect, useState } from "react";
import type { Ganji } from "./types";

export type GanjiEntry = Ganji & { key: string };

export function useGanji60() {
  const [ganjiList, setGanjiList] = useState<GanjiEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/data/ganji-60.json");
        if (!res.ok) throw new Error(`Failed to load ganji-60.json (${res.status})`);
        const data = (await res.json()) as GanjiEntry[];
        if (!alive) return;
        setGanjiList(data);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unknown error");
        setGanjiList([]);
      } finally {
        if (!alive) return;
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  return { ganjiList, isLoading, error };
}
