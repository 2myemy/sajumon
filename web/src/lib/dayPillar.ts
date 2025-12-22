import type { BirthInput, Ganji } from "./types";

type StemKey =
  | "gap" | "eul" | "byeong" | "jeong" | "mu"
  | "gi" | "gyeong" | "sin" | "im" | "gye";

type BranchKey =
  | "ja" | "chuk" | "in" | "myo" | "jin" | "sa"
  | "o" | "mi" | "sin" | "yu" | "sul" | "hae";

const STEMS: Array<{
  key: StemKey;
  label: string;            // "Gap"
  yinYang: "Yang" | "Yin";
  element: "Wood" | "Fire" | "Earth" | "Metal" | "Water";
}> = [
  { key: "gap",    label: "Gap",    yinYang: "Yang", element: "Wood" },
  { key: "eul",    label: "Eul",    yinYang: "Yin",  element: "Wood" },
  { key: "byeong", label: "Byeong", yinYang: "Yang", element: "Fire" },
  { key: "jeong",  label: "Jeong",  yinYang: "Yin",  element: "Fire" },
  { key: "mu",     label: "Mu",     yinYang: "Yang", element: "Earth" },
  { key: "gi",     label: "Gi",     yinYang: "Yin",  element: "Earth" },
  { key: "gyeong", label: "Gyeong", yinYang: "Yang", element: "Metal" },
  { key: "sin",    label: "Sin",    yinYang: "Yin",  element: "Metal" },
  { key: "im",     label: "Im",     yinYang: "Yang", element: "Water" },
  { key: "gye",    label: "Gye",    yinYang: "Yin",  element: "Water" }
];

const BRANCHES: Array<{
  key: BranchKey;
  label: string; // "Ja"
  animal: string; // "Rat"
}> = [
  { key: "ja",   label: "Ja",   animal: "Rat" },
  { key: "chuk", label: "Chuk", animal: "Ox" },
  { key: "in",   label: "In",   animal: "Tiger" },
  { key: "myo",  label: "Myo",  animal: "Rabbit" },
  { key: "jin",  label: "Jin",  animal: "Dragon" },
  { key: "sa",   label: "Sa",   animal: "Snake" },
  { key: "o",    label: "O",    animal: "Horse" },
  { key: "mi",   label: "Mi",   animal: "Goat" },
  { key: "sin",  label: "Sin",  animal: "Monkey" },
  { key: "yu",   label: "Yu",   animal: "Rooster" },
  { key: "sul",  label: "Sul",  animal: "Dog" },
  { key: "hae",  label: "Hae",  animal: "Pig" }
];

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/**
 * Gregorian date -> JDN at noon (integer)
 * Standard algorithm (proleptic Gregorian)
 */
function jdnNoonGregorian(y: number, m: number, d: number): number {
  // Fliegel–Van Flandern style (integer arithmetic)
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;

  const jdn =
    d +
    Math.floor((153 * m2 + 2) / 5) +
    365 * y2 +
    Math.floor(y2 / 4) -
    Math.floor(y2 / 100) +
    Math.floor(y2 / 400) -
    32045;

  // This JDN corresponds to noon-based count already used in many references.
  // We use it as "JD_noon integer".
  return jdn;
}

/**
 * Saju day boundary: if time is provided and >= 23:00, treat as next day (子 hour starts at 23:00).
 * If time is omitted, we assume daytime (no shift).
 */
function applyZiHourBoundary(input: BirthInput): { y: number; m: number; d: number } {
  const { year, month, day } = input;

  if (typeof input.hour !== "number" || typeof input.minute !== "number") {
    return { y: year, m: month, d: day };
  }

  const minutes = input.hour * 60 + input.minute;
  const shouldShiftToNextDay = minutes >= 23 * 60;

  if (!shouldShiftToNextDay) return { y: year, m: month, d: day };

  // Add one day safely using JS Date (UTC to avoid timezone surprises)
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/**
 * Compute day pillar (Ganji) from birth input.
 * Returns Ganji + key for your character lookup (e.g., "gye-sa").
 *
 * Formulas:
 *  T = 1 + mod(JD_noon - 1, 10)
 *  B = 1 + mod(JD_noon + 1, 12)
 * (where T=stem index 1..10, B=branch index 1..12) :contentReference[oaicite:1]{index=1}
 */
export function computeDayPillar(input: BirthInput): Ganji & { key: string } {
  const { y, m, d } = applyZiHourBoundary(input);
  const jdNoon = jdnNoonGregorian(y, m, d);

  const stemIndex1 = 1 + mod(jdNoon - 1, 10); // 1..10
  const branchIndex1 = 1 + mod(jdNoon + 1, 12); // 1..12

  const stem = STEMS[stemIndex1 - 1];
  const branch = BRANCHES[branchIndex1 - 1];

  const key = `${stem.key}-${branch.key}`; // e.g. "gye-sa"
  const label = `${stem.label}-${branch.label}`; // e.g. "Gye-Sa"

  return {
    key,
    label,
    stem: `${stem.label} (${stem.yinYang} ${stem.element})`,
    branch: `${branch.label} (${branch.animal})`
  };
}
