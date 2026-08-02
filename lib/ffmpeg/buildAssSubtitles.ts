import {
  buildCapCutSubtitleSegmentPlans,
  buildPhraseTextWithLineBreak,
  choosePhraseLineBreakIndex,
  formatPhraseDisplayWord,
  getSubtitlePreset,
  SHARED_SUBTITLE_TOKENS,
  type PhraseWord,
  type SubtitleStylePreset,
} from "@/lib/capcut/presets";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

const PLAY_RES_X = 1080;
const PLAY_RES_Y = 1920;

/** Convert #RRGGBB → ASS &HAABBGGRR (AA = opacity inverted: 00 opaque). */
export function hexToAssColor(hex: string, alpha = 0): string {
  const normalized = hex.replace("#", "").slice(0, 6);
  const rr = normalized.slice(0, 2);
  const gg = normalized.slice(2, 4);
  const bb = normalized.slice(4, 6);
  const aa = Math.max(0, Math.min(255, Math.round(alpha * 255)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `&H${aa}${bb}${gg}${rr}`.toUpperCase();
}

function microsToAssTime(micros: number): string {
  const totalCs = Math.max(0, Math.floor(micros / 10_000));
  const hours = Math.floor(totalCs / 360_000);
  const minutes = Math.floor((totalCs % 360_000) / 6_000);
  const seconds = Math.floor((totalCs % 6_000) / 100);
  const centiseconds = totalCs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

function buildAssDialogueText(phraseWords: PhraseWord[], preset: SubtitleStylePreset): string {
  const accentAss = hexToAssColor(preset.activeColor);
  const whiteAss = hexToAssColor(preset.inactiveColor);
  const displays = phraseWords.map((entry) => formatPhraseDisplayWord(entry.word, preset));
  const breakAfter = choosePhraseLineBreakIndex(displays);

  return phraseWords
    .map((entry, index) => {
      const word = escapeAssText(formatPhraseDisplayWord(entry.word, preset));
      const color = entry.isActive ? accentAss : whiteAss;
      const colorTag = `{\\c${color}&}`;
      let spacer = "";
      if (index < phraseWords.length - 1) {
        // ASS hard break matches CapCut / web 2-line layout.
        spacer = index + 1 === breakAfter ? "\\N" : " ";
      }
      return `${colorTag}${word}${spacer}`;
    })
    .join("");
}

/**
 * Builds an ASS script matching the selected theme (lower-center, stroke,
 * soft black box, karaoke accents) for FFmpeg burn-in.
 */
export function buildAssSubtitles(options: {
  transcript: TranscriptData;
  theme: ThemeId;
}): string {
  const preset = getSubtitlePreset(options.theme);
  const toMicroseconds = (seconds: number) => Math.round(Math.max(0, seconds) * 1_000_000);
  const plans = buildCapCutSubtitleSegmentPlans(options.transcript, preset, toMicroseconds);

  // ASS Fontsize is roughly CSS px on 1080×1920 (~48–56 for short-form look).
  const assFontSize = Math.round(preset.webFontSizePx * 1.75);
  const primary = hexToAssColor(preset.inactiveColor);
  const outline = hexToAssColor(SHARED_SUBTITLE_TOKENS.strokeColor);
  // BorderStyle=3 uses BackColour as opaque box; alpha 0.4 ≈ soft dark box.
  const backBox = hexToAssColor(
    SHARED_SUBTITLE_TOKENS.backgroundColor,
    1 - SHARED_SUBTITLE_TOKENS.backgroundAlpha,
  );
  // MarginV ≈ lower-third matching webSubtitleTop ~0.78 → from bottom ~22% of 1920.
  const marginV = Math.round(PLAY_RES_Y * (1 - preset.webSubtitleTop));

  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${PLAY_RES_X}`,
    `PlayResY: ${PLAY_RES_Y}`,
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${preset.fontNameCapCut},${assFontSize},${primary},${primary},${outline},${backBox},1,0,0,0,100,100,0,0,3,3,0,2,60,60,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const events = plans.map((plan) => {
    const start = microsToAssTime(plan.startMicros);
    const end = microsToAssTime(plan.startMicros + plan.durationMicros);
    const text = buildAssDialogueText(plan.phraseWords, preset);
    const fallback = escapeAssText(
      buildPhraseTextWithLineBreak(plan.phraseWords, preset).fullText.replace(/\n/g, "\\N"),
    );
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text || fallback}`;
  });

  return [...header, ...events, ""].join("\n");
}
