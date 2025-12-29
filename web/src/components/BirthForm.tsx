import { useMemo, useState } from "react";
import type { BirthInput } from "../lib/types";

type Props = {
  onSubmit: (birth: BirthInput) => void;
  disabled?: boolean;
  statusText?: string;
};

type FieldErrors = Partial<Record<"year" | "month" | "day", string>>;

function daysInMonth(year: number, month: number) {
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
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [day, setDay] = useState(String(now.getDate()));

  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): { ok: true; birth: BirthInput } | { ok: false } => {
    const nextErrors: FieldErrors = {};

    if (!isValidIntInRange(year, 1900, 2100)) nextErrors.year = "Year must be between 1900 and 2100.";
    if (!isValidIntInRange(month, 1, 12)) nextErrors.month = "Month must be 1 to 12.";
    if (!isValidIntInRange(day, 1, 31)) nextErrors.day = "Day must be 1 to 31.";

    if (!nextErrors.year && !nextErrors.month && !nextErrors.day) {
      const y = Number(year);
      const m = Number(month);
      const d = Number(day);
      const maxDay = daysInMonth(y, m);
      if (d > maxDay) nextErrors.day = `This month only has ${maxDay} days.`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return { ok: false };

    return {
      ok: true,
      birth: {
        year: Number(year),
        month: Number(month),
        day: Number(day),
      },
    };
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
        <h2 className="text-lg font-semibold">Enter your birthday</h2>
        <p className="mt-1 text-sm text-zinc-400">
          We'll use it to calculate your <span className="font-semibold text-zinc-200">Ganji</span> character.
        </p>
        {statusText && <div className="mt-2 text-xs text-zinc-500">{statusText}</div>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-950/30 p-4">
        <div className="mb-2 text-sm font-medium">
          Birthday <span className="text-red-400">*</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Year" error={errors.year} required>
            <input
              className={inputClass(disabled, !!errors.year)}
              type="text"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={disabled}
              placeholder="1997"
              autoComplete="bday-year"
            />
          </Field>

          <Field label="Month" error={errors.month} required>
            <input
              className={inputClass(disabled, !!errors.month)}
              type="text"
              inputMode="numeric"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={disabled}
              placeholder="1-12"
              autoComplete="bday-month"
            />
          </Field>

          <Field label="Day" error={errors.day} required>
            <input
              className={inputClass(disabled, !!errors.day)}
              type="text"
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={disabled}
              placeholder="1-31"
              autoComplete="bday-day"
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="submit"
          disabled={disabled}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            disabled
              ? "cursor-not-allowed bg-white/40 text-zinc-900"
              : "bg-white text-zinc-950 hover:opacity-90"
          }`}
        >
          {disabled ? "Generating..." : "Get my Ganji character"}
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
