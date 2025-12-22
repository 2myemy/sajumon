import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <img
                src="/sajumon.svg"
                alt="Sajumon Icon"
                className="object-cover w-full h-full"
              />
            </button>
            <div>
              <p className="text-sm font-semibold leading-4">sajumon</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/5"
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/library"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/5"
                }`
              }
            >
              60 Ganji
            </NavLink>
            <NavLink
              to="/learn"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-zinc-300 hover:bg-white/5"
                }`
              }
            >
              Learn
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-5xl px-4 text-xs text-zinc-500">
          © 2025 Sajumon
        </div>
      </footer>
    </div>
  );
}
