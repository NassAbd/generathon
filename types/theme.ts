export type ThemeId = "pop_3d" | "cyberpunk" | "minimal_tech";

export interface ThemePreset {
  id: ThemeId;
  label: string;
  description: string;
  subtitleClass: string;
  highlightClass: string;
  pillClass: string;
  assetGlowClass: string;
}

export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  pop_3d: {
    id: "pop_3d",
    label: "Pop 3D",
    description: "Vibrant colors, 3D bounce",
    subtitleClass: "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]",
    highlightClass: "text-yellow-300 scale-110",
    pillClass: "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 border border-white/20",
    assetGlowClass: "drop-shadow-[0_0_18px_rgba(168,85,247,0.8)]",
  },
  cyberpunk: {
    id: "cyberpunk",
    label: "Cyberpunk",
    description: "Neon glow, glitch accents",
    subtitleClass: "text-cyan-100 font-mono tracking-wider drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]",
    highlightClass: "text-fuchsia-300 animate-glitch",
    pillClass: "bg-black/70 border border-cyan-400/50 shadow-[0_0_24px_rgba(34,211,238,0.25)]",
    assetGlowClass: "drop-shadow-[0_0_20px_rgba(236,72,153,0.9)]",
  },
  minimal_tech: {
    id: "minimal_tech",
    label: "Minimal Tech",
    description: "Clean dark-mode typography",
    subtitleClass: "text-slate-100 font-light tracking-tight",
    highlightClass: "text-white font-semibold",
    pillClass: "bg-slate-900/80 border border-slate-600/60 backdrop-blur-sm",
    assetGlowClass: "drop-shadow-[0_4px_12px_rgba(15,23,42,0.6)]",
  },
};

export function parseThemeId(value: string | null | undefined): ThemeId {
  if (value === "cyberpunk" || value === "minimal_tech" || value === "pop_3d") {
    return value;
  }
  return "pop_3d";
}
