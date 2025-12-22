import { useMemo, useState } from "react";
import type { BirthInput } from "../lib/types";

type Props = {
  onSubmit: (birth: BirthInput) => void;
  disabled?: boolean;
  statusText?: string;
};

type FieldErrors = Partial<Record<"year" | "month" | "day" | "hour" | "minute", string>>;

function daysInMonth(year: number, month: number) {
  // month: 1..12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidIntInRange(v: string, min: number, max: number) {
  if (v.trim() === "") return false;
  if (!/^\d+$/.test(v)) return false;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
}

export default function BirthForm({ onSubmit, disabled = false, statusText }: Props) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [day, setDay] = useState<string>(String(now.getDate()));

  const [includeTime, setIncludeTime] = useState<boolean>(false);
  const [hour, setHour] = useState<string>("");   // optional -> empty allowed
  const [minute, setMinute] = useState<string>("");

  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): { ok: true; birth: BirthInput } | { ok: false } => {
    const nextErrors: FieldErrors = {};

    // Basic numeric checks
    if (!isValidIntInRange(year, 1900, 2100)) nextErrors.year = "Enter a valid year (1900–2100).";
    if (!isValidIntInRange(month, 1, 12)) nextErrors.month = "Month must be 1–12.";
    if (!isValidIntInRange(day, 1, 31)) nextErrors.day = "Day must be 1–31.";

    // If Y/M/D valid enough, check actual calendar day (prevents 2/30)
    if (!nextErrors.year && !nextErrors.month && !nextErrors.day) {
      const y = Number(year);
      const m = Number(month);
      const d = Number(day);

      const maxDay = daysInMonth(y, m);
      if (d > maxDay) {
        nextErrors.day = `That month has only ${maxDay} days.`;
      }
    }

    // Time: only required when toggle ON
    if (includeTime) {
      if (!isValidIntInRange(hour, 0, 23)) nextErrors.hour = "Hour must be 0–23.";
      if (!isValidIntInRange(minute, 0, 59)) nextErrors.minute = "Minute must be 0–59.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return { ok: false };

    // Build BirthInput (convert only at the end)
    const birth: BirthInput = includeTime
      ? {
          year: Number(year),
          month: Number(month),
          day: Number(day),
          hour: Number(hour),
          minute: Number(minute),
        }
      : {
          year: Number(year),
          month: Number(month),
          day: Number(day),
        };

    return { ok: true, birth };
  };

  return (
    <form
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;

        const result = validate();
        if (!result.ok) return;

        onSubmit(result.birth);
      }}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Enter your date of birth</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Required: Year, Month, Day · Optional: Time of birth
        </p>

        {statusText && <div className="mt-2 text-xs text-zinc-500">{statusText}</div>}
      </div>

      {/* Date */}
      <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-4">
        <div className="mb-2 text-sm font-medium">
          Date of Birth <span className="text-red-400">*</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Year" error={errors.year}>
            <input
              className={inputClass(disabled, !!errors.year)}
              type="text"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={disabled}
              placeholder="e.g., 1997"
            />
          </Field>

          <Field label="Month" error={errors.month}>
            <input
              className={inputClass(disabled, !!errors.month)}
              type="text"
              inputMode="numeric"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={disabled}
              placeholder="1–12"
            />
          </Field>

          <Field label="Day" error={errors.day}>
            <input
              className={inputClass(disabled, !!errors.day)}
              type="text"
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={disabled}
              placeholder="1–31"
            />
          </Field>
        </div>
      </div>

      {/* Time toggle */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/20 p-4">
        <label className={`flex items-start justify-between gap-3 ${disabled ? "opacity-60" : ""}`}>
          <div>
            <div className="text-sm font-medium text-zinc-300">
              Time of Birth <span className="text-zinc-500">(optional)</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Turn on only if you know it. (23:00+ births may shift the day pillar.)
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={includeTime}
            onClick={() => {
              if (disabled) return;
              setIncludeTime((v) => {
                const next = !v;
                // when turning OFF, clear time + errors
                if (!next) {
                  setHour("");
                  setMinute("");
                  setErrors((prev) => {
                    const { hour: _h, minute: _m, ...rest } = prev;
                    return rest;
                  });
                }
                return next;
              });
            }}
            className={`relative h-7 w-12 rounded-full border transition ${
              includeTime ? "border-white/20 bg-white/20" : "border-white/10 bg-white/5"
            } ${disabled ? "cursor-not-allowed" : ""}`}
            disabled={disabled}
          >
            <span
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition ${
                includeTime ? "left-6" : "left-1"
              }`}
            />
          </button>
        </label>

        {includeTime && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Hour" error={errors.hour} required>
              <input
                className={inputClass(disabled, !!errors.hour)}
                type="text"
                inputMode="numeric"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                disabled={disabled}
                placeholder="0–23"
              />
            </Field>

            <Field label="Minute" error={errors.minute} required>
              <input
                className={inputClass(disabled, !!errors.minute)}
                type="text"
                inputMode="numeric"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                disabled={disabled}
                placeholder="0–59"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={disabled}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            disabled ? "cursor-not-allowed bg-white/40 text-zinc-900" : "bg-white text-zinc-950 hover:opacity-90"
          }`}
        >
          {disabled ? "Loading characters..." : "Generate my Ganji"}
        </button>
      </div>
    </form>
  );
}

function inputClass(disabled: boolean, hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2 text-sm outline-none ${
    disabled
      ? "cursor-not-allowed border-white/5 bg-zinc-950/40 text-zinc-500"
      : hasError
        ? "border-red-500/40 bg-zinc-950 focus:border-red-400/60"
        : "border-white/10 bg-zinc-950 focus:border-white/20"
  }`;
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-400">
          {label} {required ? <span className="text-red-400">*</span> : null}
        </div>
        {error ? <div className="text-xs text-red-300">{error}</div> : null}
      </div>
      {children}
    </label>
  );
}
