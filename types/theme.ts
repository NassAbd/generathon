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
    label: "Hormozi Bold",
    description: "Yellow accents, white bold text, stroke & soft dark background",
    subtitleClass: "font-sans text-white",
    highlightClass: "font-bold text-[#FFE600]",
    pillClass: "bg-black/70 border border-[#FFE600]/50 shadow-[0_0_20px_rgba(255,230,0,0.18)]",
    assetGlowClass: "drop-shadow-[0_0_18px_rgba(255,230,0,0.55)]",
    overlayShellClass: "ring-1 ring-yellow-400/25",
    accentLabelClass: "text-[#FFE600]",
  },
  cyberpunk: {
    id: "cyberpunk",
    label: "Cyberpunk Green",
    description: "Green #10B981 accents, high contrast",
    subtitleClass: "font-sans text-white",
    highlightClass: "font-bold text-[#10B981]",
    pillClass: "bg-black/70 border border-[#10B981]/50 shadow-[0_0_24px_rgba(16,185,129,0.22)]",
    assetGlowClass: "drop-shadow-[0_0_20px_rgba(16,185,129,0.75)]",
    overlayShellClass: "ring-1 ring-emerald-400/30 shadow-[0_0_40px_rgba(16,185,129,0.12)]",
    accentLabelClass: "text-[#10B981]",
  },
  minimal_tech: {
    id: "minimal_tech",
    label: "Minimalist Tech",
    description: "Clean Inter/SF Pro look, white text, subtle contrast",
    subtitleClass: "font-sans tracking-tight text-white",
    highlightClass: "font-semibold text-[#FFE600]",
    pillClass: "bg-slate-900/80 border border-slate-500/50 backdrop-blur-sm",
    assetGlowClass: "drop-shadow-[0_4px_12px_rgba(15,23,42,0.6)]",
    overlayShellClass: "ring-1 ring-slate-500/40",
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
