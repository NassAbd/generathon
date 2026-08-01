import { CAPCUT_EXPORT_AUDIO, resolveSfxUrlForEvent } from "@/lib/capcut/presets";
import { collectPlaybackSfxUrls } from "@/lib/player/keywordSfxSync";
import type { TranscriptData } from "@/types/transcript";

/** Preload pool URLs for CapCut-parity SFX (whoosh / shocking / fah + keyword mappings). */
export function collectCapCutSfxUrls(transcript: TranscriptData): string[] {
  return collectPlaybackSfxUrls(transcript);
}

export function collectSfxUrls(transcript: TranscriptData): string[] {
  return collectCapCutSfxUrls(transcript);
}

export function collectCoreSfxUrls(): string[] {
  return [
    CAPCUT_EXPORT_AUDIO.SFX_WHOOSH_URL,
    CAPCUT_EXPORT_AUDIO.SFX_SHOCKING_URL,
    CAPCUT_EXPORT_AUDIO.SFX_FAH_URL,
    resolveSfxUrlForEvent("hook"),
    resolveSfxUrlForEvent("shot-cut"),
    resolveSfxUrlForEvent("keyword"),
  ];
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
