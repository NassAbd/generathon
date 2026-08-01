import { CAPCUT_EXPORT_AUDIO, resolveKeywordSfxUrl } from "@/lib/capcut/presets";
import type { TranscriptData } from "@/types/transcript";

/** Preload pool URLs for CapCut-parity keyword SFX (whoosh / shocking / fah + transcript mappings). */
export function collectCapCutSfxUrls(transcript: TranscriptData): string[] {
  const urls = new Set<string>([
    CAPCUT_EXPORT_AUDIO.SFX_POP_URL,
    CAPCUT_EXPORT_AUDIO.SFX_SHOCKING_URL,
    CAPCUT_EXPORT_AUDIO.SFX_FAH_URL,
  ]);

  for (const entry of transcript) {
    if (entry.highlight) {
      urls.add(resolveKeywordSfxUrl(entry.sfx_url));
    }
  }

  return [...urls];
}

export function collectSfxUrls(transcript: TranscriptData): string[] {
  return collectCapCutSfxUrls(transcript);
}

export function preloadBgmAudio(): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL);
    audio.preload = "auto";
    audio.addEventListener("canplaythrough", () => resolve(), { once: true });
    audio.addEventListener("error", () => resolve(), { once: true });
    audio.load();
  });
}
