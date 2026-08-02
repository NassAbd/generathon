"use client";

import { getSubtitlePreset } from "@/lib/capcut/presets";
import { cn } from "@/lib/utils";
import { THEME_PRESETS, type ThemeId } from "@/types/theme";

export interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps): JSX.Element {
  const activePreset = THEME_PRESETS[value];
  const activeAccent = getSubtitlePreset(value).activeColor;

  return (
    <section
      aria-label="Theme selector"
      className="shrink-0 rounded-2xl border border-border bg-card/60 p-3"
    >
      <h2
        className="mb-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        style={{ color: activeAccent }}
      >
        Theme · {activePreset.label}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(Object.keys(THEME_PRESETS) as ThemeId[]).map((themeId) => {
          const preset = THEME_PRESETS[themeId];
          const accent = getSubtitlePreset(themeId).activeColor;
          const isActive = themeId === value;

          return (
            <button
              key={themeId}
              type="button"
              onClick={() => onChange(themeId)}
              style={isActive ? { borderColor: accent } : undefined}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                isActive ? "bg-accent" : "border-border hover:bg-accent/50",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
                <span className="truncate text-sm font-semibold">{preset.label}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
