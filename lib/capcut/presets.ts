import { getPhraseWindow } from "@/lib/player/transcriptIndex";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

export type RgbColor = [number, number, number];

export interface SubtitleStylePreset {
  id: ThemeId;
  label: string;
  uppercase: boolean;
  fontFamily: string;
  fontNameCapCut: string;
  fontCategoryCapCut: string;
  inactiveColor: string;
  activeColor: string;
  borderColor: string;
  borderWidth: number;
  borderWidthActive: number;
  shadowColor: string;
  shadowAlpha: number;
  shadowDistance: number;
  shadowDistanceActive: number;
  /** CapCut material `font_size` (web preview uses `webFontSizePx`). */
  fontSize: number;
  /** CapCut text segment `clip.scale` — primary visual size control (font_size alone is ignored). */
  textScale: number;
  activeWordScale: number;
  /** CapCut clip.transform.y — positive = up, negative = down. */
  subtitleY: number;
  /** CapCut clip.transform.y for 3D badge (positive = higher on frame). */
  assetY: number;
  /** CapCut clip.transform.x for centered badge. */
  assetX: number;
  /** CapCut clip.scale for 3D PNG overlays. */
  assetScale: number;
  /** Web overlay: subtitle block top position (0–1 from frame top). */
  webSubtitleTop: number;
  /** Web overlay: asset badge top position (0–1 from frame top). */
  webAssetTop: number;
  /** Web overlay: asset badge square size in px. */
  webAssetSizePx: number;
  /** Web overlay: inactive word font size in px. */
  webFontSizePx: number;
  phraseRadius: number;
  lineMaxWidth: number;
  letterSpacing: number;
  inactiveOpacity: number;
  assetGlowClass: string;
  overlayShellClass: string;
}

export const SUBTITLE_STYLE_PRESETS: Record<ThemeId, SubtitleStylePreset> = {
  pop_3d: {
    id: "pop_3d",
    label: "Viral Yellow / Hormozi",
    uppercase: true,
    fontFamily: "Montserrat, Impact, Arial Black, sans-serif",
    fontNameCapCut: "Montserrat",
    fontCategoryCapCut: "en",
    inactiveColor: "#FFFFFF",
    activeColor: "#FFE500",
    borderColor: "#000000",
    borderWidth: 0.06,
    borderWidthActive: 0.09,
    shadowColor: "#000000",
    shadowAlpha: 0.85,
    shadowDistance: 6,
    shadowDistanceActive: 8,
    fontSize: 4.0,
    textScale: 0.18,
    activeWordScale: 1.1,
    subtitleY: -0.55,
    assetY: 0.2,
    assetX: 0,
    assetScale: 0.22,
    webSubtitleTop: 0.75,
    webAssetTop: 0.52,
    webAssetSizePx: 100,
    webFontSizePx: 13,
    phraseRadius: 1,
    lineMaxWidth: 0.82,
    letterSpacing: 0.02,
    inactiveOpacity: 0.72,
    assetGlowClass: "drop-shadow-[0_0_20px_rgba(255,229,0,0.55)]",
    overlayShellClass: "ring-1 ring-yellow-400/20",
  },
  cyberpunk: {
    id: "cyberpunk",
    label: "Cyberpunk Green",
    uppercase: true,
    fontFamily: "Courier New, monospace",
    fontNameCapCut: "Courier",
    fontCategoryCapCut: "en",
    inactiveColor: "#E0F2FE",
    activeColor: "#39FF14",
    borderColor: "#000000",
    borderWidth: 0.05,
    borderWidthActive: 0.08,
    shadowColor: "#022C22",
    shadowAlpha: 0.9,
    shadowDistance: 5,
    shadowDistanceActive: 7,
    fontSize: 4.0,
    textScale: 0.18,
    activeWordScale: 1.1,
    subtitleY: -0.55,
    assetY: 0.2,
    assetX: 0,
    assetScale: 0.22,
    webSubtitleTop: 0.75,
    webAssetTop: 0.52,
    webAssetSizePx: 100,
    webFontSizePx: 12,
    phraseRadius: 1,
    lineMaxWidth: 0.8,
    letterSpacing: 0.04,
    inactiveOpacity: 0.68,
    assetGlowClass: "drop-shadow-[0_0_22px_rgba(57,255,20,0.75)]",
    overlayShellClass: "ring-1 ring-emerald-400/30 shadow-[0_0_40px_rgba(57,255,20,0.12)]",
  },
  minimal_tech: {
    id: "minimal_tech",
    label: "Clean White",
    uppercase: false,
    fontFamily: "Inter, system-ui, sans-serif",
    fontNameCapCut: "Inter",
    fontCategoryCapCut: "en",
    inactiveColor: "#F8FAFC",
    activeColor: "#FFFFFF",
    borderColor: "#0F172A",
    borderWidth: 0.035,
    borderWidthActive: 0.05,
    shadowColor: "#000000",
    shadowAlpha: 0.75,
    shadowDistance: 4,
    shadowDistanceActive: 6,
    fontSize: 3.5,
    textScale: 0.16,
    activeWordScale: 1.08,
    subtitleY: -0.55,
    assetY: 0.2,
    assetX: 0,
    assetScale: 0.22,
    webSubtitleTop: 0.75,
    webAssetTop: 0.52,
    webAssetSizePx: 100,
    webFontSizePx: 12,
    phraseRadius: 1,
    lineMaxWidth: 0.78,
    letterSpacing: 0,
    inactiveOpacity: 0.78,
    assetGlowClass: "drop-shadow-[0_4px_14px_rgba(15,23,42,0.55)]",
    overlayShellClass: "ring-1 ring-slate-600/40",
  },
};

export function getSubtitlePreset(theme: ThemeId): SubtitleStylePreset {
  return SUBTITLE_STYLE_PRESETS[theme];
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "").slice(0, 6);
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

export interface PhraseWord {
  index: number;
  word: string;
  isActive: boolean;
}

function buildTextStyleRange(
  rangeStart: number,
  rangeEnd: number,
  color: RgbColor,
  bold: boolean,
): Record<string, unknown> {
  return {
    range: [rangeStart, rangeEnd],
    bold,
    italic: false,
    underline: false,
    fill: {
      alpha: 1,
      content: {
        render_type: "solid",
        solid: { alpha: 1, color },
      },
    },
  };
}

export function getPhraseWordsForIndex(
  transcript: TranscriptData,
  activeIndex: number,
  preset: SubtitleStylePreset,
): PhraseWord[] {
  return getPhraseWindow(transcript, activeIndex, preset.phraseRadius).map((entry) => ({
    index: entry.index,
    word: entry.word,
    isActive: entry.index === activeIndex,
  }));
}

export function formatPhraseDisplayWord(word: string, preset: SubtitleStylePreset): string {
  const trimmed = word.trim();
  return preset.uppercase ? trimmed.toUpperCase() : trimmed;
}

export function buildPhraseDisplayText(phraseWords: PhraseWord[], preset: SubtitleStylePreset): string {
  return phraseWords.map((entry) => formatPhraseDisplayWord(entry.word, preset)).join(" ");
}

export function buildCapCutPhraseTextContent(
  phraseWords: PhraseWord[],
  preset: SubtitleStylePreset,
): string {
  const displayWords = phraseWords.map((entry) => ({
    ...entry,
    display: formatPhraseDisplayWord(entry.word, preset),
  }));
  const fullText = displayWords.map((entry) => entry.display).join(" ");
  const textLength = fullText.length;

  const activeEntry = displayWords.find((entry) => entry.isActive);
  let activeStart = -1;
  let activeEnd = -1;

  if (activeEntry) {
    const activeWord = activeEntry.display;
    let charOffset = 0;

    for (let index = 0; index < displayWords.length; index += 1) {
      const entry = displayWords[index];
      if (entry.isActive) {
        activeStart = charOffset;
        activeEnd = charOffset + entry.display.length;
        break;
      }

      charOffset += entry.display.length;
      if (index < displayWords.length - 1) {
        charOffset += 1;
      }
    }

    if (activeStart < 0) {
      activeStart = fullText.indexOf(activeWord);
      if (activeStart >= 0) {
        activeEnd = activeStart + activeWord.length;
      }
    }
  }

  const styles: Array<Record<string, unknown>> = [
    buildTextStyleRange(0, textLength, hexToRgb(preset.inactiveColor), false),
  ];

  if (activeStart >= 0 && activeEnd > activeStart && activeEnd <= textLength) {
    styles.push(buildTextStyleRange(activeStart, activeEnd, hexToRgb(preset.activeColor), true));
  }

  return JSON.stringify({
    text: fullText,
    styles,
    layer_weight: 1,
    effect: [],
  });
}

const MIN_SUBTITLE_SEGMENT_MICROS = 80_000;

export interface CapCutSubtitleSegmentPlan {
  wordIndex: number;
  startMicros: number;
  durationMicros: number;
  phraseWords: PhraseWord[];
}

/** Builds strictly non-overlapping subtitle segment timings (one visible text clip at a time). */
export function buildCapCutSubtitleSegmentPlans(
  transcript: TranscriptData,
  preset: SubtitleStylePreset,
  toMicroseconds: (seconds: number) => number,
): CapCutSubtitleSegmentPlan[] {
  if (transcript.length === 0) {
    return [];
  }

  const plans: CapCutSubtitleSegmentPlan[] = [];
  let chainEndMicros = 0;

  for (let index = 0; index < transcript.length; index += 1) {
    const entry = transcript[index];
    const wordStartMicros = toMicroseconds(entry.start);
    const wordEndMicros = toMicroseconds(entry.end);

    const startMicros =
      index === 0 ? wordStartMicros : Math.max(wordStartMicros, chainEndMicros);

    let endMicros = Math.max(wordEndMicros, startMicros + MIN_SUBTITLE_SEGMENT_MICROS);
    if (index < transcript.length - 1) {
      const nextStartMicros = toMicroseconds(transcript[index + 1].start);
      endMicros = Math.min(endMicros, nextStartMicros);
    }

    if (endMicros <= startMicros) {
      endMicros = startMicros + MIN_SUBTITLE_SEGMENT_MICROS;
    }

    chainEndMicros = endMicros;
    plans.push({
      wordIndex: index,
      startMicros,
      durationMicros: endMicros - startMicros,
      phraseWords: getPhraseWordsForIndex(transcript, index, preset),
    });
  }

  return plans;
}

export type StyleDraftRecord = Record<string, unknown>;

export function getCapCutTextMaterialProps(
  phraseWords: PhraseWord[],
  preset: SubtitleStylePreset,
): StyleDraftRecord {
  const hasActiveWord = phraseWords.some((entry) => entry.isActive);

  return {
    type: "text",
    content: buildCapCutPhraseTextContent(phraseWords, preset),
    alignment: 1,
    font_size: preset.fontSize,
    font_name: preset.fontNameCapCut,
    font_category: preset.fontCategoryCapCut,
    text_color: hasActiveWord ? preset.activeColor : preset.inactiveColor,
    typesetting: 0,
    letter_spacing: preset.letterSpacing,
    line_spacing: 0.02,
    line_feed: 1,
    line_max_width: preset.lineMaxWidth,
    force_apply_line_max_width: false,
    check_flag: 7,
    fixed_width: -1,
    fixed_height: -1,
    text_alpha: 1,
    border_color: preset.borderColor,
    border_width: preset.borderWidth,
    border_alpha: 1,
    has_shadow: true,
    shadow_alpha: preset.shadowAlpha,
    shadow_angle: -45,
    shadow_color: preset.shadowColor,
    shadow_distance: preset.shadowDistance,
    shadow_smoothing: 1,
    background_color: "#000000",
    background_alpha: 0,
    background_style: 0,
    background_round_radius: 0,
    background_width: 0.14,
    background_height: 0.14,
    background_horizontal_offset: 0,
    background_vertical_offset: 0,
    vertical: false,
    is_rich_text: true,
    use_effect_default_color: false,
  };
}

export function getWebSubtitleWordStyle(
  preset: SubtitleStylePreset,
  isActive: boolean,
): {
  fontFamily: string;
  fontWeight: number;
  textTransform: "uppercase" | "none";
  color: string;
  opacity: number;
  WebkitTextStroke: string;
  paintOrder: string;
  textShadow: string;
  letterSpacing: string;
} {
  return {
    fontFamily: preset.fontFamily,
    fontWeight: isActive ? 800 : 700,
    textTransform: preset.uppercase ? "uppercase" : "none",
    color: isActive ? preset.activeColor : preset.inactiveColor,
    opacity: isActive ? 1 : preset.inactiveOpacity,
    WebkitTextStroke: `${isActive ? 2 : 1.5}px ${preset.borderColor}`,
    paintOrder: "stroke fill",
    textShadow: `0 ${isActive ? 3 : 2}px 8px rgba(0,0,0,${preset.shadowAlpha})`,
    letterSpacing: `${preset.letterSpacing}em`,
  };
}
