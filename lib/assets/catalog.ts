import { getSupabasePublicUrl } from "@/lib/supabase/server";

const ASSETS_BUCKET = "assets";

export const ASSET_FILES = [
  "fire.png",
  "rocket.png",
  "battery_low.png",
  "star.png",
  "lightning.png",
  "heart.png",
  "trophy.png",
  "brain.png",
] as const;

export const SFX_FILES = ["pop.mp3", "whoosh.mp3", "ding.mp3", "impact.mp3"] as const;

export type AssetFile = (typeof ASSET_FILES)[number];
export type SfxFile = (typeof SFX_FILES)[number];

export function getAssetUrl(filename: AssetFile | string): string {
  return getSupabasePublicUrl(ASSETS_BUCKET, filename);
}

export function getSfxUrl(filename: SfxFile | string): string {
  return getSupabasePublicUrl(ASSETS_BUCKET, filename);
}

export function buildAssetCatalogPrompt(): string {
  return [
    "Available PNG assets (use exact filenames):",
    ASSET_FILES.join(", "),
    "Available SFX (use exact filenames):",
    SFX_FILES.join(", "),
  ].join("\n");
}
