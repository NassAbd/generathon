import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";
import type { SpeakerOffsetSegment } from "@/lib/capcut/video-effects";

export type RgbColor = [number, number, number];

export interface SubtitleStylePreset {
  id: ThemeId;
  label: string;
  uppercase: boolean;
  fontFamily: string;
  fontNameCapCut: string;
  fontCategoryCapCut: string;
  /** Default body text — white. */
  inactiveColor: string;
  /** Karaoke active-word accent (theme color). */
  activeColor: string;
  /** Alias of active karaoke accent (kept for CapCut/export callers). */
  accentColor: string;
  borderColor: string;
  borderWidth: number;
  borderWidthActive: number;
  shadowColor: string;
  shadowAlpha: number;
  shadowDistance: number;
  shadowDistanceActive: number;
  /** CapCut material `font_size` for 1080×1920 (~13–15). */
  fontSize: number;
  /** CapCut text segment `clip.scale`. */
  textScale: number;
  activeWordScale: number;
  /** CapCut clip.transform — lower-center (`x: 0`, `y: -0.55`). */
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
  /** CapCut + web: 1–3 words max per subtitle segment. */
  phraseBlockSize: number;
  /** Soft black caption box behind text. */
  useBackgroundBox: boolean;
  backgroundAlpha: number;
  lineMaxWidth: number;
  letterSpacing: number;
  inactiveOpacity: number;
  assetGlowClass: string;
  overlayShellClass: string;
}

/**
 * Shared color/surface tokens for CapCut + web preview + client canvas export.
 * CapCut `font_size` uses draft scale; web/canvas use CSS px separately.
 */
export const SHARED_SUBTITLE_TOKENS = {
  textWhite: "#FFFFFF",
  /** Impact Yellow karaoke accent. */
  accentYellow: "#FFE600",
  /** Cyberpunk Green karaoke accent. */
  accentGreen: "#10B981",
  /** Editorial Clean karaoke accent. */
  accentCyan: "#06B6D4",
  strokeColor: "#000000",
  strokeWidth: 0.07,
  backgroundColor: "#000000",
  backgroundAlpha: 0.6,
  /**
   * CapCut draft material font_size (NOT CSS px).
   * ~6.8 + textScale 0.3 fits long French words on a 9:16 frame.
   */
  capcutFontSize: 6.8,
  capcutFontSizeMinimal: 6.5,
  /** CapCut clip.scale — pairs with font_size for short-form preview size. */
  capcutTextScale: 0.3,
  /** Web overlay font size in CSS px (preview-only). */
  webFontSizePx: 28,
  webFontSizePxMinimal: 26,
  subtitleY: -0.55,
  webSubtitleTop: 0.78,
  /**
   * CapCut line box width (0–1 of canvas). Must stay wide — a narrow
   * `line_max_width` + force wrap causes per-character vertical columns.
   */
  lineMaxWidth: 0.96,
} as const;

/** Shared short-form subtitle defaults (karaoke + soft dark box). */
const SHORTFORM_SUBTITLE_BASE = {
  inactiveColor: SHARED_SUBTITLE_TOKENS.textWhite,
  borderColor: SHARED_SUBTITLE_TOKENS.strokeColor,
  borderWidth: SHARED_SUBTITLE_TOKENS.strokeWidth,
  borderWidthActive: SHARED_SUBTITLE_TOKENS.strokeWidth,
  shadowColor: SHARED_SUBTITLE_TOKENS.strokeColor,
  shadowAlpha: 0.75,
  shadowDistance: 2,
  shadowDistanceActive: 2,
  fontSize: SHARED_SUBTITLE_TOKENS.capcutFontSize,
  textScale: SHARED_SUBTITLE_TOKENS.capcutTextScale,
  activeWordScale: 1.08,
  subtitleY: SHARED_SUBTITLE_TOKENS.subtitleY,
  assetY: 0.2,
  assetX: 0,
  assetScale: 0.22,
  webSubtitleTop: SHARED_SUBTITLE_TOKENS.webSubtitleTop,
  webAssetTop: 0.52,
  webAssetSizePx: 100,
  phraseBlockSize: 3,
  useBackgroundBox: true,
  backgroundAlpha: SHARED_SUBTITLE_TOKENS.backgroundAlpha,
  lineMaxWidth: SHARED_SUBTITLE_TOKENS.lineMaxWidth,
  letterSpacing: 0,
} as const;

export const SUBTITLE_STYLE_PRESETS: Record<ThemeId, SubtitleStylePreset> = {
  impact_yellow: {
    ...SHORTFORM_SUBTITLE_BASE,
    id: "impact_yellow",
    label: "Impact Yellow",
    uppercase: true,
    fontFamily: '"Montserrat", "Rubik", Impact, "Arial Black", sans-serif',
    fontNameCapCut: "Montserrat",
    fontCategoryCapCut: "en",
    activeColor: SHARED_SUBTITLE_TOKENS.accentYellow,
    accentColor: SHARED_SUBTITLE_TOKENS.accentYellow,
    webFontSizePx: SHARED_SUBTITLE_TOKENS.webFontSizePx,
    inactiveOpacity: 0.72,
    assetGlowClass: "drop-shadow-[0_0_20px_rgba(255,230,0,0.55)]",
    overlayShellClass: "ring-1 ring-yellow-400/25",
  },
  cyberpunk: {
    ...SHORTFORM_SUBTITLE_BASE,
    id: "cyberpunk",
    label: "Cyberpunk Green",
    uppercase: true,
    fontFamily: '"Rubik", "Montserrat", "Inter", sans-serif',
    fontNameCapCut: "Rubik",
    fontCategoryCapCut: "en",
    activeColor: SHARED_SUBTITLE_TOKENS.accentGreen,
    accentColor: SHARED_SUBTITLE_TOKENS.accentGreen,
    webFontSizePx: SHARED_SUBTITLE_TOKENS.webFontSizePx,
    inactiveOpacity: 0.7,
    assetGlowClass: "drop-shadow-[0_0_22px_rgba(16,185,129,0.75)]",
    overlayShellClass: "ring-1 ring-emerald-400/30 shadow-[0_0_40px_rgba(16,185,129,0.12)]",
  },
  editorial_clean: {
    ...SHORTFORM_SUBTITLE_BASE,
    id: "editorial_clean",
    label: "Editorial Clean",
    uppercase: false,
    fontFamily: '"Inter", "SF Pro Text", "Montserrat", "Rubik", system-ui, sans-serif',
    fontNameCapCut: "Inter",
    fontCategoryCapCut: "en",
    activeColor: SHARED_SUBTITLE_TOKENS.accentCyan,
    accentColor: SHARED_SUBTITLE_TOKENS.accentCyan,
    fontSize: SHARED_SUBTITLE_TOKENS.capcutFontSizeMinimal,
    webFontSizePx: SHARED_SUBTITLE_TOKENS.webFontSizePxMinimal,
    inactiveOpacity: 0.78,
    assetGlowClass: "drop-shadow-[0_4px_14px_rgba(6,182,212,0.45)]",
    overlayShellClass: "ring-1 ring-cyan-400/30",
  },
};

export function getSubtitlePreset(theme: ThemeId): SubtitleStylePreset {
  return SUBTITLE_STYLE_PRESETS[theme];
}

/** Shared stroke/shadow tuning — same tokens for CapCut + web preview. */
export const SUBTITLE_READABILITY = {
  strokeColor: SHARED_SUBTITLE_TOKENS.strokeColor,
  /** CapCut material border_width / rich-text stroke (exact parity: 0.07). */
  capcutBorderWidth: SHARED_SUBTITLE_TOKENS.strokeWidth,
  capcutBorderAlpha: 1,
  capcutShadowColor: SHARED_SUBTITLE_TOKENS.strokeColor,
  capcutShadowAlpha: 0.75,
  /** CapCut shadow angle (90° ≈ downward offset). */
  capcutShadowAngle: 90,
  capcutShadowDistance: 2,
  /** CapCut shadow_smoothing (~4–6px blur). */
  capcutShadowSmoothing: 0.5,
  /** Web stroke px mapped from CapCut 0.07 (~2.8px). */
  webStrokeWidthPx: SHARED_SUBTITLE_TOKENS.strokeWidth * 40,
  webShadowOffsetY: 2,
  webShadowBlurPx: 5,
  webFontWeight: 800,
} as const;

/** CSS box for the soft dark caption surface (matches CapCut surface_alpha 0.6). */
export function getWebSubtitleSurfaceStyle(preset: SubtitleStylePreset): {
  backgroundColor: string;
  borderRadius: string;
  padding: string;
} | null {
  if (!preset.useBackgroundBox) {
    return null;
  }

  const alpha = preset.backgroundAlpha;
  return {
    backgroundColor: `rgba(0, 0, 0, ${alpha})`,
    borderRadius: "0.55rem",
    padding: "0.35rem 0.65rem",
  };
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
  isHighlight: boolean;
}

function buildCapCutRichTextStroke(): Record<string, unknown> {
  return {
    alpha: SUBTITLE_READABILITY.capcutBorderAlpha,
    width: SUBTITLE_READABILITY.capcutBorderWidth,
    content: {
      render_type: "solid",
      solid: { alpha: 1, color: hexToRgb(SUBTITLE_READABILITY.strokeColor) },
    },
  };
}

function buildCapCutRichTextShadow(): Record<string, unknown> {
  return {
    alpha: SUBTITLE_READABILITY.capcutShadowAlpha,
    angle: SUBTITLE_READABILITY.capcutShadowAngle,
    distance: SUBTITLE_READABILITY.capcutShadowDistance,
    smoothing: SUBTITLE_READABILITY.capcutShadowSmoothing,
    content: {
      render_type: "solid",
      solid: { alpha: 1, color: hexToRgb(SUBTITLE_READABILITY.capcutShadowColor) },
    },
  };
}

function buildTextStyleRange(
  rangeStart: number,
  rangeEnd: number,
  color: RgbColor,
): Record<string, unknown> {
  return {
    range: [rangeStart, rangeEnd],
    bold: true,
    italic: false,
    underline: false,
    fill: {
      alpha: 1,
      content: {
        render_type: "solid",
        solid: { alpha: 1, color },
      },
    },
    strokes: [buildCapCutRichTextStroke()],
    shadows: [buildCapCutRichTextShadow()],
  };
}

export function getPhraseBlockStartIndex(wordIndex: number, blockSize: number): number {
  if (wordIndex < 0) {
    return 0;
  }

  return Math.floor(wordIndex / blockSize) * blockSize;
}

/** Returns the fixed word block containing `activeIndex` (e.g. indices 0–2, 3–5, …). */
export function getFixedPhraseBlock(
  transcript: TranscriptData,
  activeIndex: number,
  preset: SubtitleStylePreset,
): PhraseWord[] {
  if (activeIndex < 0 || transcript.length === 0) {
    return [];
  }

  const blockSize = preset.phraseBlockSize;
  const chunkStart = getPhraseBlockStartIndex(activeIndex, blockSize);
  const chunkEnd = Math.min(transcript.length - 1, chunkStart + blockSize - 1);
  const phraseWords: PhraseWord[] = [];

  for (let index = chunkStart; index <= chunkEnd; index += 1) {
    const entry = transcript[index];
    phraseWords.push({
      index,
      word: entry.word,
      isActive: index === activeIndex,
      isHighlight: entry.highlight === true,
    });
  }

  return phraseWords;
}

export function getPhraseWordsForIndex(
  transcript: TranscriptData,
  activeIndex: number,
  preset: SubtitleStylePreset,
): PhraseWord[] {
  return getFixedPhraseBlock(transcript, activeIndex, preset);
}

export function formatPhraseDisplayWord(word: string, preset: SubtitleStylePreset): string {
  const trimmed = word.trim();
  return preset.uppercase ? trimmed.toUpperCase() : trimmed;
}

export function buildPhraseDisplayText(phraseWords: PhraseWord[], preset: SubtitleStylePreset): string {
  return phraseWords.map((entry) => formatPhraseDisplayWord(entry.word, preset)).join(" ");
}

/** Karaoke: the currently spoken word uses the theme accent; others stay white. */
function resolveWordAccentColor(entry: PhraseWord, preset: SubtitleStylePreset): string {
  if (entry.isActive) {
    return preset.activeColor;
  }
  return preset.inactiveColor;
}

/** Max characters on a single CapCut caption line before forcing a `\n` split. */
export const CAPCUT_SINGLE_LINE_MAX_CHARS = 16;

/**
 * Dynamic 1 vs 2 line break:
 * - Short chunks (≤16 chars, or ≤3 short words totaling ≤16): ONE line (no `\n`)
 * - Long chunks (>16 chars): balanced 2-line split
 *
 * Returns `displayWords.length` when there should be NO newline.
 */
export function choosePhraseLineBreakIndex(displayWords: string[]): number {
  if (displayWords.length <= 1) {
    return displayWords.length;
  }

  const joined = displayWords.join(" ");
  if (joined.length <= CAPCUT_SINGLE_LINE_MAX_CHARS) {
    // Keep short 2–3 word phrases on a single centered line.
    return displayWords.length;
  }

  // Long chunk: pick the split that best balances character counts (max 2 lines).
  let bestSplit = Math.ceil(displayWords.length / 2);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let split = 1; split < displayWords.length; split += 1) {
    const line1 = displayWords.slice(0, split).join(" ");
    const line2 = displayWords.slice(split).join(" ");
    const imbalance = Math.abs(line1.length - line2.length);
    const overflowPenalty = line1.length > 22 || line2.length > 22 ? 12 : 0;
    const score = imbalance + overflowPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestSplit = split;
    }
  }

  return bestSplit;
}

/** Build display text + per-word ranges, inserting an explicit `\\n` for CapCut. */
export function buildPhraseTextWithLineBreak(
  phraseWords: PhraseWord[],
  preset: SubtitleStylePreset,
): {
  fullText: string;
  ranges: Array<{ start: number; end: number }>;
  displayWords: Array<PhraseWord & { display: string }>;
} {
  const displayWords = phraseWords.map((entry) => ({
    ...entry,
    display: formatPhraseDisplayWord(entry.word, preset),
  }));
  const displays = displayWords.map((entry) => entry.display);
  const breakAfter = choosePhraseLineBreakIndex(displays);

  const ranges: Array<{ start: number; end: number }> = [];
  let fullText = "";

  for (let index = 0; index < displayWords.length; index += 1) {
    const entry = displayWords[index];
    const start = fullText.length;
    fullText += entry.display;
    ranges.push({ start, end: fullText.length });

    if (index >= displayWords.length - 1) {
      continue;
    }

    // Explicit newline forces CapCut onto a 2nd line (space alone will not wrap).
    fullText += index + 1 === breakAfter ? "\n" : " ";
  }

  return { fullText, ranges, displayWords };
}

/**
 * CapCut rich-text content: white body + karaoke accents + explicit 2-line layout.
 */
export function buildCapCutPhraseTextContent(
  phraseWords: PhraseWord[],
  preset: SubtitleStylePreset,
): string {
  const { fullText, ranges, displayWords } = buildPhraseTextWithLineBreak(phraseWords, preset);
  const textLength = fullText.length;

  const styles: Array<Record<string, unknown>> = [
    buildTextStyleRange(0, textLength, hexToRgb(preset.inactiveColor)),
  ];

  for (let index = 0; index < displayWords.length; index += 1) {
    const entry = displayWords[index];
    if (!entry.isActive) {
      continue;
    }

    const range = ranges[index];
    if (!range || range.end <= range.start || range.end > textLength) {
      continue;
    }

    styles.push(
      buildTextStyleRange(range.start, range.end, hexToRgb(resolveWordAccentColor(entry, preset))),
    );
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

/**
 * Sorts subtitle plans chronologically and clamps each segment so
 * `end[i] <= start[i+1]` with zero micro-overlap (CapCut-safe single track).
 */
export function sanitizeCapCutSubtitleSegmentPlans(
  plans: CapCutSubtitleSegmentPlan[],
): CapCutSubtitleSegmentPlan[] {
  if (plans.length === 0) {
    return [];
  }

  const sorted = [...plans].sort((left, right) => {
    if (left.startMicros !== right.startMicros) {
      return left.startMicros - right.startMicros;
    }
    return left.wordIndex - right.wordIndex;
  });

  const sanitized: CapCutSubtitleSegmentPlan[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const plan = sorted[index];
    let startMicros = Math.max(0, plan.startMicros);

    if (sanitized.length > 0) {
      const previous = sanitized[sanitized.length - 1];
      const previousEnd = previous.startMicros + previous.durationMicros;
      if (startMicros < previousEnd) {
        startMicros = previousEnd;
      }
    }

    const nextStartMicros =
      index + 1 < sorted.length ? sorted[index + 1].startMicros : Number.POSITIVE_INFINITY;

    let endMicros = Math.min(plan.startMicros + plan.durationMicros, nextStartMicros);

    if (endMicros <= startMicros) {
      if (!Number.isFinite(nextStartMicros) || nextStartMicros <= startMicros) {
        continue;
      }
      endMicros = Math.min(startMicros + MIN_SUBTITLE_SEGMENT_MICROS, nextStartMicros);
    }

    if (endMicros <= startMicros) {
      continue;
    }

    sanitized.push({
      ...plan,
      startMicros,
      durationMicros: endMicros - startMicros,
      phraseWords: plan.phraseWords,
    });
  }

  // Final pass: hard-clamp any residual overlap from equal/unsorted starts.
  for (let index = 0; index < sanitized.length - 1; index += 1) {
    const current = sanitized[index];
    const next = sanitized[index + 1];
    const currentEnd = current.startMicros + current.durationMicros;

    if (currentEnd > next.startMicros) {
      current.durationMicros = Math.max(0, next.startMicros - current.startMicros);
    }
  }

  return sanitized.filter((plan) => plan.durationMicros > 0);
}

/**
 * Karaoke-style CapCut segments: one timeline clip per spoken word.
 * Each clip shows the 1–3 word phrase block with the spoken word accented
 * (`#FFE600` / theme accent) for that word's exact start→end window.
 */
export function buildCapCutSubtitleSegmentPlans(
  transcript: TranscriptData,
  preset: SubtitleStylePreset,
  toMicroseconds: (seconds: number) => number,
): CapCutSubtitleSegmentPlan[] {
  if (transcript.length === 0) {
    return [];
  }

  const chronological = transcript
    .map((entry, wordIndex) => ({ entry, wordIndex }))
    .sort((left, right) => {
      if (left.entry.start !== right.entry.start) {
        return left.entry.start - right.entry.start;
      }
      return left.wordIndex - right.wordIndex;
    });

  const plans: CapCutSubtitleSegmentPlan[] = [];

  for (let index = 0; index < chronological.length; index += 1) {
    const { entry, wordIndex } = chronological[index];
    const startMicros = toMicroseconds(entry.start);
    let endMicros = toMicroseconds(entry.end);

    if (index + 1 < chronological.length) {
      const nextStartMicros = toMicroseconds(chronological[index + 1].entry.start);
      endMicros = Math.min(endMicros, nextStartMicros);
    }

    if (endMicros <= startMicros) {
      const nextStartMicros =
        index + 1 < chronological.length
          ? toMicroseconds(chronological[index + 1].entry.start)
          : startMicros + MIN_SUBTITLE_SEGMENT_MICROS;
      if (nextStartMicros <= startMicros) {
        continue;
      }
      endMicros = Math.min(startMicros + MIN_SUBTITLE_SEGMENT_MICROS, nextStartMicros);
    }

    if (endMicros <= startMicros) {
      continue;
    }

    // Phrase context (up to 3 words) with the spoken word marked active → theme accent.
    const phraseWords = getPhraseWordsForIndex(transcript, wordIndex, preset);

    plans.push({
      wordIndex,
      startMicros,
      durationMicros: endMicros - startMicros,
      phraseWords,
    });
  }

  return sanitizeCapCutSubtitleSegmentPlans(plans);
}

export type StyleDraftRecord = Record<string, unknown>;

export function getCapCutTextMaterialProps(
  phraseWords: PhraseWord[],
  preset: SubtitleStylePreset,
): StyleDraftRecord {
  const accentEntry = phraseWords.find((entry) => entry.isActive);
  const textColor = accentEntry
    ? resolveWordAccentColor(accentEntry, preset)
    : preset.inactiveColor;
  const strokeWidth = preset.borderWidth || SUBTITLE_READABILITY.capcutBorderWidth;
  const surfaceAlpha = preset.useBackgroundBox ? preset.backgroundAlpha : 0;
  // CapCut expects #RRGGBBAA for some surface fields.
  const bgHexWithAlpha = `#000000${Math.round(surfaceAlpha * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;

  return {
    type: "text",
    content: buildCapCutPhraseTextContent(phraseWords, preset),
    // Horizontal centered layout (CapCut: 0=left, 1=center, 2=right).
    alignment: 1,
    text_align: 1,
    text_alignment: 1,
    // Draft-scale size (~6.8) + clip textScale ~0.3 — fits long FR tokens in 9:16.
    font_size: preset.fontSize,
    font_name: preset.fontNameCapCut,
    font_category: preset.fontCategoryCapCut,
    font_title: `${preset.fontNameCapCut}-Bold`,
    text_color: textColor,
    // typesetting 0 = horizontal; 1 = vertical column (must stay 0).
    typesetting: 0,
    letter_spacing: 0,
    line_spacing: 0.08,
    line_feed: 1,
    // Wide box + NO forced auto-wrap — explicit \\n handles 2 lines.
    // Narrow force_apply_line_max_width was wrapping every character.
    line_max_width: Math.max(preset.lineMaxWidth, 0.95),
    force_apply_line_max_width: false,
    wrap: false,
    word_wrap: false,
    check_flag: 7,
    fixed_width: -1,
    fixed_height: -1,
    text_alpha: 1,
    // Outline for contrast on any background.
    border_color: preset.borderColor || SUBTITLE_READABILITY.strokeColor,
    border_width: strokeWidth,
    border_alpha: SUBTITLE_READABILITY.capcutBorderAlpha,
    stroke_color: preset.borderColor || SUBTITLE_READABILITY.strokeColor,
    stroke_width: strokeWidth,
    has_shadow: true,
    shadow_alpha: SUBTITLE_READABILITY.capcutShadowAlpha,
    shadow_angle: SUBTITLE_READABILITY.capcutShadowAngle,
    shadow_color: SUBTITLE_READABILITY.capcutShadowColor,
    shadow_distance: SUBTITLE_READABILITY.capcutShadowDistance,
    shadow_smoothing: SUBTITLE_READABILITY.capcutShadowSmoothing,
    // Soft black caption box — must be present for CapCut desktop.
    use_surface: true,
    surface_color: "#000000",
    surface_alpha: surfaceAlpha || SHARED_SUBTITLE_TOKENS.backgroundAlpha,
    bg_color: "#000000",
    bg_alpha: surfaceAlpha || SHARED_SUBTITLE_TOKENS.backgroundAlpha,
    background_color: bgHexWithAlpha || "#00000099",
    background_alpha: surfaceAlpha || SHARED_SUBTITLE_TOKENS.backgroundAlpha,
    background_style: 1,
    background_round_radius: 0.25,
    background_width: 0.28,
    background_height: 0.12,
    background_horizontal_offset: 0.5,
    background_vertical_offset: 0.5,
    background_fill: "solid",
    // Critical: vertical typesetting stacks characters into a column.
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
  const strokePx = preset.borderWidth * 40;
  return {
    fontFamily: preset.fontFamily,
    fontWeight: SUBTITLE_READABILITY.webFontWeight,
    textTransform: preset.uppercase ? "uppercase" : "none",
    // Karaoke: the currently spoken word uses the theme accent color.
    color: isActive ? preset.activeColor : preset.inactiveColor,
    opacity: isActive ? 1 : preset.inactiveOpacity,
    WebkitTextStroke: `${strokePx}px ${preset.borderColor}`,
    paintOrder: "stroke fill",
    textShadow: `0 ${SUBTITLE_READABILITY.webShadowOffsetY}px ${SUBTITLE_READABILITY.webShadowBlurPx}px rgba(0,0,0,${SUBTITLE_READABILITY.capcutShadowAlpha})`,
    letterSpacing: `${preset.letterSpacing}em`,
  };
}

/** CapCut export sound design — live Supabase public URLs and mix levels. */
export const CAPCUT_EXPORT_AUDIO = {
  SFX_WHOOSH_URL:
    "https://dzgekeibtcgavrzxcylr.supabase.co/storage/v1/object/public/assets/sound_effects/whoosh.mp3",
  SFX_SHOCKING_URL:
    "https://dzgekeibtcgavrzxcylr.supabase.co/storage/v1/object/public/assets/sound_effects/shocking.mp3",
  SFX_FAH_URL:
    "https://dzgekeibtcgavrzxcylr.supabase.co/storage/v1/object/public/assets/sound_effects/fah.mp3",
  /** @deprecated Use SFX_WHOOSH_URL */
  SFX_POP_URL:
    "https://dzgekeibtcgavrzxcylr.supabase.co/storage/v1/object/public/assets/sound_effects/whoosh.mp3",
  /** Fallback when modulo Supabase assignment is unavailable. Prefer resolveBgmTrackForProject(). */
  DEFAULT_BGM_URL:
    "https://dzgekeibtcgavrzxcylr.supabase.co/storage/v1/object/public/assets/bgm/cartoon.mp3",
  /**
   * CapCut timeline BGM level (segment.volume / last_nonzero_volume, 0–1 linear).
   * ~12% so CapCut's native volume slider opens pre-adjusted, not at 100%.
   */
  bgmVolume: 0.12,
  /** FFmpeg sidechain base music gain before ducking. */
  sidechainMusicVolume: 0.15,
  sfxVolume: 0.8,
  /** Minimum gap between SFX triggers (seconds). */
  sfxCooldownSeconds: 1.5,
  /** Max SFX clip length on the timeline (microseconds). */
  sfxClipDurationMicros: 500_000,
} as const;

export type SfxEventKind = "hook" | "shot-cut" | "keyword" | "keyword-strong";

const SFX_URL_BY_FILENAME: Record<string, string> = {
  "whoosh.mp3": CAPCUT_EXPORT_AUDIO.SFX_WHOOSH_URL,
  "pop.mp3": CAPCUT_EXPORT_AUDIO.SFX_WHOOSH_URL,
  "shocking.mp3": CAPCUT_EXPORT_AUDIO.SFX_SHOCKING_URL,
  "fah.mp3": CAPCUT_EXPORT_AUDIO.SFX_FAH_URL,
};

function extractAudioFilename(urlOrFilename: string): string | null {
  try {
    return new URL(urlOrFilename).pathname.split("/").pop()?.toLowerCase() ?? null;
  } catch {
    const basename = urlOrFilename.split("/").pop()?.toLowerCase();
    return basename && basename.length > 0 ? basename : null;
  }
}

export function resolveSfxUrlForEvent(kind: SfxEventKind): string {
  switch (kind) {
    case "hook":
    case "keyword-strong":
      return CAPCUT_EXPORT_AUDIO.SFX_SHOCKING_URL;
    case "shot-cut":
      return CAPCUT_EXPORT_AUDIO.SFX_WHOOSH_URL;
    case "keyword":
      return CAPCUT_EXPORT_AUDIO.SFX_FAH_URL;
  }
}

/** Maps yellow punchword highlights — fah by default, shocking every 3rd keyword. */
export function resolveKeywordHighlightSfxUrl(highlightIndex: number): string {
  return highlightIndex % 3 === 2
    ? CAPCUT_EXPORT_AUDIO.SFX_SHOCKING_URL
    : CAPCUT_EXPORT_AUDIO.SFX_FAH_URL;
}

export function resolveKeywordSfxUrl(
  sfxUrl: string | undefined,
  highlightIndex?: number,
): string {
  if (highlightIndex !== undefined) {
    return resolveKeywordHighlightSfxUrl(highlightIndex);
  }

  if (!sfxUrl) {
    return CAPCUT_EXPORT_AUDIO.SFX_FAH_URL;
  }

  const filename = extractAudioFilename(sfxUrl);
  if (filename && SFX_URL_BY_FILENAME[filename]) {
    return SFX_URL_BY_FILENAME[filename];
  }

  return sfxUrl;
}

export interface CapCutSfxSegmentPlan {
  startMicros: number;
  url: string;
  kind: SfxEventKind;
}

function applySfxCooldown<T extends { startMicros: number }>(
  events: T[],
  cooldownMicros: number,
): T[] {
  const sorted = [...events].sort((left, right) => left.startMicros - right.startMicros);
  const kept: T[] = [];
  let lastKeptMicros = -Infinity;

  for (const event of sorted) {
    if (event.startMicros - lastKeptMicros >= cooldownMicros) {
      kept.push(event);
      lastKeptMicros = event.startMicros;
    }
  }

  return kept;
}

/** Builds hook, shot-cut, and keyword SFX plans with anti-spam cooldown. */
export function buildCapCutSfxSegmentPlans(
  transcript: TranscriptData,
  speakerOffsetSegments: SpeakerOffsetSegment[] | undefined,
  toMicroseconds: (seconds: number) => number,
): CapCutSfxSegmentPlan[] {
  const events: CapCutSfxSegmentPlan[] = [
    {
      startMicros: 0,
      url: resolveSfxUrlForEvent("hook"),
      kind: "hook",
    },
  ];

  for (const segment of speakerOffsetSegments ?? []) {
    if (segment.startSeconds <= 0.05) {
      continue;
    }

    events.push({
      startMicros: toMicroseconds(segment.startSeconds),
      url: resolveSfxUrlForEvent("shot-cut"),
      kind: "shot-cut",
    });
  }

  let highlightIndex = 0;
  for (const entry of transcript) {
    if (!entry.highlight) {
      continue;
    }

    events.push({
      startMicros: toMicroseconds(entry.start),
      url: resolveKeywordHighlightSfxUrl(highlightIndex),
      kind: highlightIndex % 3 === 2 ? "keyword-strong" : "keyword",
    });
    highlightIndex += 1;
  }

  return applySfxCooldown(
    events,
    toMicroseconds(CAPCUT_EXPORT_AUDIO.sfxCooldownSeconds),
  );
}
