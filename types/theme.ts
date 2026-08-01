export type ThemeId = "pop_3d" | "cyberpunk" | "minimal_tech";

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  subtitleClass: string;
  highlightClass: string;
  pillClass: string;
  assetGlowClass: string;
  overlayShellClass: string;
  accentLabelClass: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  pop_3d: {
    id: "pop_3d",
    label: "Viral Yellow",
    description: "Bold uppercase hooks, yellow word pops, 3D badges",
    subtitleClass: "font-sans text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]",
    highlightClass: "font-bold text-yellow-300",
    pillClass: "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 border border-white/20",
    assetGlowClass: "drop-shadow-[0_0_18px_rgba(168,85,247,0.8)]",
    overlayShellClass: "ring-1 ring-violet-500/20",
    accentLabelClass: "text-violet-300",
  },
  cyberpunk: {
    id: "cyberpunk",
    label: "Cyberpunk Green",
    description: "Neon green active words, glitch accents",
    subtitleClass: "font-mono tracking-wider text-cyan-100 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]",
    highlightClass: "font-bold text-fuchsia-300",
    pillClass: "bg-black/70 border border-cyan-400/50 shadow-[0_0_24px_rgba(34,211,238,0.25)]",
    assetGlowClass: "drop-shadow-[0_0_20px_rgba(236,72,153,0.9)]",
    overlayShellClass: "ring-1 ring-cyan-400/30 shadow-[0_0_40px_rgba(34,211,238,0.12)]",
    accentLabelClass: "text-cyan-300",
  },
  minimal_tech: {
    id: "minimal_tech",
    label: "Clean White",
    description: "Minimal high-contrast typography",
    subtitleClass: "font-light tracking-tight text-slate-100",
    highlightClass: "font-semibold text-white",
    pillClass: "bg-slate-900/80 border border-slate-600/60 backdrop-blur-sm",
    assetGlowClass: "drop-shadow-[0_4px_12px_rgba(15,23,42,0.6)]",
    overlayShellClass: "ring-1 ring-slate-600/40",
    accentLabelClass: "text-slate-300",
  },
};

export function parseThemeId(value: string | null | undefined): ThemeId {
  if (value === "cyberpunk" || value === "minimal_tech" || value === "pop_3d") {
    return value;
  }
  return "pop_3d";
}

/** Prefer the live UI theme from the export request; fall back to persisted project theme. */
export function resolveExportThemeId(
  requestThemeId: string | null | undefined,
  projectTheme: string | null | undefined,
): ThemeId {
  if (requestThemeId === "cyberpunk" || requestThemeId === "minimal_tech" || requestThemeId === "pop_3d") {
    return requestThemeId;
  }
  return parseThemeId(projectTheme);
}
