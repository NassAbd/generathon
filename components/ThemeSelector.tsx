"use client";

import { THEME_PRESETS, type ThemeId } from "@/types/theme";

export interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps): JSX.Element {
  return (
    <section aria-label="Theme selector" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Theme</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {Object.values(THEME_PRESETS).map((preset) => {
          const isActive = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                isActive
                  ? "border-violet-400/60 bg-violet-500/15 shadow-[0_0_24px_rgba(168,85,247,0.18)]"
                  : "border-white/10 bg-black/20 hover:border-white/25"
              }`}
            >
              <p className="text-sm font-semibold text-white">{preset.label}</p>
              <p className="mt-1 text-xs text-slate-400">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
