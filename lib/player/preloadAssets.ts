import type { TranscriptData } from "@/types/transcript";

export async function preloadImageAssets(transcript: TranscriptData): Promise<void> {
  const urls = [...new Set(transcript.map((entry) => entry.asset_url).filter(Boolean))] as string[];
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = url;
        }),
    ),
  );
}

export function collectSfxUrls(transcript: TranscriptData): string[] {
  return [...new Set(transcript.map((entry) => entry.sfx_url).filter(Boolean))] as string[];
}
