import {
  CAPCUT_EXPORT_AUDIO,
  resolveKeywordHighlightSfxUrl,
  resolveSfxUrlForEvent,
} from "@/lib/capcut/presets";
import type { TranscriptData } from "@/types/transcript";

/** Window after keyword `start` when SFX should fire once (matches CapCut segment placement). */
export const KEYWORD_SFX_TRIGGER_WINDOW_SECONDS = 0.12;

export const HOOK_SFX_TRIGGER_WINDOW_SECONDS = 0.15;

export interface SfxPlaybackEvent {
  slotKey: string | number;
  url: string;
}

function countHighlightsBeforeIndex(transcript: TranscriptData, wordIndex: number): number {
  let count = 0;

  for (let index = 0; index < wordIndex; index += 1) {
    if (transcript[index]?.highlight) {
      count += 1;
    }
  }

  return count;
}

export function syncHookSfxAtTime(
  currentTime: number,
  hookTriggered: boolean,
  onTrigger: (event: SfxPlaybackEvent) => void,
): boolean {
  if (hookTriggered) {
    return true;
  }

  if (currentTime >= 0 && currentTime < HOOK_SFX_TRIGGER_WINDOW_SECONDS) {
    onTrigger({
      slotKey: "hook",
      url: resolveSfxUrlForEvent("hook"),
    });
    return true;
  }

  return false;
}

export function syncKeywordSfxAtTime(
  transcript: TranscriptData,
  currentTime: number,
  triggeredIndices: Set<number>,
  onTrigger: (event: SfxPlaybackEvent) => void,
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
      onTrigger({
        slotKey: index,
        url: resolveKeywordHighlightSfxUrl(countHighlightsBeforeIndex(transcript, index)),
      });
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

export function shouldResetHookSfx(currentTime: number): boolean {
  return currentTime < HOOK_SFX_TRIGGER_WINDOW_SECONDS;
}

export function collectPlaybackSfxUrls(transcript: TranscriptData): string[] {
  const urls = new Set<string>([
    CAPCUT_EXPORT_AUDIO.SFX_WHOOSH_URL,
    CAPCUT_EXPORT_AUDIO.SFX_SHOCKING_URL,
    CAPCUT_EXPORT_AUDIO.SFX_FAH_URL,
  ]);

  for (let index = 0; index < transcript.length; index += 1) {
    if (transcript[index]?.highlight) {
      urls.add(resolveKeywordHighlightSfxUrl(countHighlightsBeforeIndex(transcript, index)));
    }
  }

  return [...urls];
}
