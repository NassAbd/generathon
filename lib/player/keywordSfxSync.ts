import { resolveKeywordSfxUrl } from "@/lib/capcut/presets";
import type { TranscriptData } from "@/types/transcript";

/** Window after keyword `start` when SFX should fire once (matches CapCut segment placement). */
export const KEYWORD_SFX_TRIGGER_WINDOW_SECONDS = 0.12;

export function syncKeywordSfxAtTime(
  transcript: TranscriptData,
  currentTime: number,
  triggeredIndices: Set<number>,
  onTrigger: (wordIndex: number, url: string) => void,
): void {
  if (!Number.isFinite(currentTime)) {
    return;
  }

  for (let index = 0; index < transcript.length; index += 1) {
    if (triggeredIndices.has(index)) {
      continue;
    }

    const entry = transcript[index];
    if (!entry.highlight) {
      continue;
    }

    if (
      currentTime >= entry.start &&
      currentTime < entry.start + KEYWORD_SFX_TRIGGER_WINDOW_SECONDS
    ) {
      triggeredIndices.add(index);
      onTrigger(index, resolveKeywordSfxUrl(entry.sfx_url));
    }
  }
}

export function rebuildTriggeredKeywordSfx(
  transcript: TranscriptData,
  currentTime: number,
): Set<number> {
  const triggered = new Set<number>();

  for (let index = 0; index < transcript.length; index += 1) {
    const entry = transcript[index];
    if (entry.highlight && currentTime > entry.start + KEYWORD_SFX_TRIGGER_WINDOW_SECONDS) {
      triggered.add(index);
    }
  }

  return triggered;
}
