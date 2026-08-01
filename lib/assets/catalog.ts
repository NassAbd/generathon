import { getSupabasePublicUrl } from "@/lib/supabase/server";
import type { WordEffect } from "@/types/transcript";

const ASSETS_BUCKET = "assets";
const ASSET_RENDER_PATH = "3d_renders";

/** Closed list of 3D render PNGs in Supabase `assets/3d_renders/`. */
export const ASSET_FILES = [
  "star.png",
  "lightning.png",
  "fire.png",
  "rocket.png",
  "brain.png",
  "battery_low.png",
] as const;

export const SFX_FILES = ["pop.mp3", "whoosh.mp3", "ding.mp3", "impact.mp3"] as const;

export type AssetFile = (typeof ASSET_FILES)[number];
export type SfxFile = (typeof SFX_FILES)[number];

export const ASSET_EMOJI_FALLBACKS: Record<AssetFile, string> = {
  "star.png": "⭐",
  "lightning.png": "⚡",
  "fire.png": "🔥",
  "rocket.png": "🚀",
  "brain.png": "🧠",
  "battery_low.png": "🪫",
};

const EFFECT_EMOJI_FALLBACKS: Record<WordEffect, string> = {
  bounce: "🚀",
  shake: "🧠",
  glow: "🔥",
};

export function getAssetStoragePath(filename: AssetFile | string): string {
  return `${ASSET_RENDER_PATH}/${filename}`;
}

export function getAssetUrl(filename: AssetFile | string): string {
  return getSupabasePublicUrl(ASSETS_BUCKET, getAssetStoragePath(filename));
}

export function getSfxUrl(filename: SfxFile | string): string {
  return getSupabasePublicUrl(ASSETS_BUCKET, filename);
}

export function extractAssetFilename(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/([^/]+\.png)$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Rewrites legacy asset URLs missing the `3d_renders/` folder segment. */
export function normalizeAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  const filename = extractAssetFilename(url);
  if (filename && isAllowedAssetFile(filename)) {
    return getAssetUrl(filename);
  }

  return url;
}

export function getAssetEmojiFallback(
  assetUrl?: string,
  effect?: WordEffect,
): string {
  const filename = assetUrl ? extractAssetFilename(assetUrl) : null;
  if (filename && isAllowedAssetFile(filename)) {
    return ASSET_EMOJI_FALLBACKS[filename];
  }

  if (effect && EFFECT_EMOJI_FALLBACKS[effect]) {
    return EFFECT_EMOJI_FALLBACKS[effect];
  }

  return "⭐";
}

export function buildAssetCatalogPrompt(): string {
  return [
    "Available 3D PNG assets — you MUST pick ONLY from this exact closed list (exact filenames, no substitutions):",
    ASSET_FILES.join(", "),
    "Do not invent, rename, or use any asset filename outside this list.",
    "Available SFX (use exact filenames):",
    SFX_FILES.join(", "),
  ].join("\n");
}

export function isAllowedAssetFile(value: string): value is AssetFile {
  return (ASSET_FILES as readonly string[]).includes(value);
}
