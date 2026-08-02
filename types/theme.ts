export type ThemeId = "impact_yellow" | "cyberpunk" | "editorial_clean";

/** Legacy theme ids still present on older project rows. */
type LegacyThemeId = "pop_3d" | "minimal_tech";

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
  impact_yellow: {
    id: "impact_yellow",
    label: "Impact Yellow",
    description: "Condensed uppercase text, active word yellow highlight, soft dark background",
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
    description: "Bold uppercase text, active word green highlight, high-contrast dark box",
    subtitleClass: "font-sans text-white",
    highlightClass: "font-bold text-[#10B981]",
    pillClass: "bg-black/70 border border-[#10B981]/50 shadow-[0_0_24px_rgba(16,185,129,0.22)]",
    assetGlowClass: "drop-shadow-[0_0_20px_rgba(16,185,129,0.75)]",
    overlayShellClass: "ring-1 ring-emerald-400/30 shadow-[0_0_40px_rgba(16,185,129,0.12)]",
    accentLabelClass: "text-[#10B981]",
  },
  editorial_clean: {
    id: "editorial_clean",
    label: "Editorial Clean",
    description: "Natural sentence case formatting, active word cyan highlight, clean modern typography",
    subtitleClass: "font-sans tracking-tight text-white",
    highlightClass: "font-semibold text-[#06B6D4]",
    pillClass: "bg-slate-900/80 border border-cyan-400/40 backdrop-blur-sm",
    assetGlowClass: "drop-shadow-[0_4px_12px_rgba(6,182,212,0.45)]",
    overlayShellClass: "ring-1 ring-cyan-400/30",
    accentLabelClass: "text-[#06B6D4]",
  },
};

function mapLegacyThemeId(value: string): ThemeId | null {
  if (value === "impact_yellow" || value === "cyberpunk" || value === "editorial_clean") {
    return value;
  }
  if (value === "pop_3d") {
    return "impact_yellow";
  }
  if (value === "minimal_tech") {
    return "editorial_clean";
  }
  return null;
}

export function parseThemeId(value: string | null | undefined): ThemeId {
  if (!value) {
    return "impact_yellow";
  }
  return mapLegacyThemeId(value) ?? "impact_yellow";
}

/** Prefer the live UI theme from the export request; fall back to persisted project theme. */
export function resolveExportThemeId(
  requestThemeId: string | null | undefined,
  projectTheme: string | null | undefined,
): ThemeId {
  const fromRequest = requestThemeId ? mapLegacyThemeId(requestThemeId) : null;
  if (fromRequest) {
    return fromRequest;
  }
  return parseThemeId(projectTheme);
}

export type { LegacyThemeId };
