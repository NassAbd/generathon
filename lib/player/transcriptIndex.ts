import type { TranscriptData, TranscriptWord } from "@/types/transcript";

/** Pad word boundaries so HTML5 currentTime aligns with Whisper timestamps. */
export const WORD_SYNC_TOLERANCE_SECONDS = 0.08;
export const MIN_WORD_DURATION_SECONDS = 0.05;

function toSeconds(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  // Guard against millisecond timestamps accidentally stored in the DB.
  return numeric > 1000 ? numeric / 1000 : numeric;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

export function normalizeTranscript(transcript: TranscriptData): TranscriptData {
  return [...transcript]
    .map((entry) => {
      const start = toSeconds(entry.start);
      let end = toSeconds(entry.end);
      if (Number.isFinite(start) && Number.isFinite(end) && end < start + MIN_WORD_DURATION_SECONDS) {
        end = start + MIN_WORD_DURATION_SECONDS;
      }

      return {
        ...entry,
        word: String(entry.word ?? "").trim(),
        start,
        end,
        highlight: toBoolean(entry.highlight),
      } satisfies TranscriptWord;
    })
    .filter(
      (entry) =>
        entry.word.length > 0 && Number.isFinite(entry.start) && Number.isFinite(entry.end),
    )
    .sort((a, b) => a.start - b.start);
}

export function findActiveWordIndex(
  transcript: TranscriptData,
  currentTime: number,
  tolerance = WORD_SYNC_TOLERANCE_SECONDS,
): number {
  if (transcript.length === 0 || !Number.isFinite(currentTime)) return -1;

  for (let index = 0; index < transcript.length; index++) {
    const entry = transcript[index];
    const start = entry.start - tolerance;
    const end = entry.end + tolerance;
    if (currentTime >= start && currentTime <= end) {
      return index;
    }
  }

  return -1;
}

export function getPhraseWindow(
  transcript: TranscriptData,
  activeIndex: number,
  radius = 2,
): Array<{ index: number; word: string; highlight: boolean; effect?: string }> {
  if (activeIndex < 0) return [];

  const start = Math.max(0, activeIndex - radius);
  const end = Math.min(transcript.length - 1, activeIndex + radius);

  return transcript.slice(start, end + 1).map((entry, offset) => ({
    index: start + offset,
    word: entry.word,
    highlight: entry.highlight,
    effect: entry.effect,
  }));
}
