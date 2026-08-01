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
  inactiveColor: string;
  activeColor: string;
  /** Rich-text accent for highlighted keywords when they are the active word. */
  keywordAccentColor: string;
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
  /** Fixed subtitle block size — words are grouped [0,1,2], [3,4,5], … */
  phraseBlockSize: number;
  lineMaxWidth: number;
  letterSpacing: number;
  inactiveOpacity: number;
  assetGlowClass: string;
  overlayShellClass: string;
}

export const SUBTITLE_STYLE_PRESETS: Record<ThemeId, SubtitleStylePreset> = {
  pop_3d: {
    id: "pop_3d",
    label: "Viral Yellow",
    uppercase: true,
    fontFamily: "Montserrat, Impact, Arial Black, sans-serif",
    fontNameCapCut: "Montserrat",
    fontCategoryCapCut: "en",
    inactiveColor: "#FFFFFF",
    activeColor: "#FFE500",
    keywordAccentColor: "#FF1493",
    borderColor: "#000000",
    borderWidth: 0.085,
    borderWidthActive: 0.09,
    shadowColor: "#000000",
    shadowAlpha: 0.8,
    shadowDistance: 2,
    shadowDistanceActive: 2,
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
    phraseBlockSize: 3,
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
    keywordAccentColor: "#FF007F",
    borderColor: "#000000",
    borderWidth: 0.085,
    borderWidthActive: 0.09,
    shadowColor: "#000000",
    shadowAlpha: 0.8,
    shadowDistance: 2,
    shadowDistanceActive: 2,
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
    phraseBlockSize: 3,
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
    keywordAccentColor: "#F472B6",
    borderColor: "#000000",
    borderWidth: 0.085,
    borderWidthActive: 0.09,
    shadowColor: "#000000",
    shadowAlpha: 0.8,
    shadowDistance: 2,
    shadowDistanceActive: 2,
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
    phraseBlockSize: 3,
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

/** Shared stroke/shadow tuning for crisp subtitles on bright backgrounds. */
export const SUBTITLE_READABILITY = {
  strokeColor: "#000000",
  /** CapCut material border_width (~3–4px at export scale). */
  capcutBorderWidth: 0.085,
  capcutBorderAlpha: 1,
  capcutShadowColor: "#000000",
  capcutShadowAlpha: 0.8,
  /** CapCut shadow angle (90° ≈ downward offset). */
  capcutShadowAngle: 90,
  capcutShadowDistance: 2,
  /** CapCut shadow_smoothing (~4–6px blur). */
  capcutShadowSmoothing: 0.55,
  webStrokeWidthPx: 3.5,
  webShadowOffsetY: 2,
  webShadowBlurPx: 5,
  webFontWeight: 800,
} as const;

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

function resolveActiveWordColor(entry: PhraseWord, preset: SubtitleStylePreset): string {
  if (entry.isHighlight) {
    return preset.keywordAccentColor;
  }
  return preset.activeColor;
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
  }

  const styles: Array<Record<string, unknown>> = [
    buildTextStyleRange(0, textLength, hexToRgb(preset.inactiveColor)),
  ];

  if (activeEntry && activeStart >= 0 && activeEnd > activeStart && activeEnd <= textLength) {
    styles.push(
      buildTextStyleRange(
        activeStart,
        activeEnd,
        hexToRgb(resolveActiveWordColor(activeEntry, preset)),
      ),
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

/** Builds strictly non-overlapping subtitle segment timings aligned to transcript word starts. */
export function buildCapCutSubtitleSegmentPlans(
  transcript: TranscriptData,
  preset: SubtitleStylePreset,
  toMicroseconds: (seconds: number) => number,
): CapCutSubtitleSegmentPlan[] {
  if (transcript.length === 0) {
    return [];
  }

  const plans: CapCutSubtitleSegmentPlan[] = [];

  for (let index = 0; index < transcript.length; index += 1) {
    const entry = transcript[index];
    const startMicros = toMicroseconds(entry.start);
    const wordEndMicros = toMicroseconds(entry.end);

    let endMicros = wordEndMicros;
    if (index < transcript.length - 1) {
      const nextStartMicros = toMicroseconds(transcript[index + 1].start);
      endMicros = Math.min(endMicros, nextStartMicros);
    }

    if (endMicros <= startMicros) {
      endMicros = startMicros + MIN_SUBTITLE_SEGMENT_MICROS;
    }

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
  const activeEntry = phraseWords.find((entry) => entry.isActive);
  const hasActiveWord = activeEntry !== undefined;
  const activeColor = activeEntry ? resolveActiveWordColor(activeEntry, preset) : preset.inactiveColor;

  return {
    type: "text",
    content: buildCapCutPhraseTextContent(phraseWords, preset),
    alignment: 1,
    font_size: preset.fontSize,
    font_name: preset.fontNameCapCut,
    font_category: preset.fontCategoryCapCut,
    text_color: hasActiveWord ? activeColor : preset.inactiveColor,
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
    border_color: SUBTITLE_READABILITY.strokeColor,
    border_width: SUBTITLE_READABILITY.capcutBorderWidth,
    border_alpha: SUBTITLE_READABILITY.capcutBorderAlpha,
    has_shadow: true,
    shadow_alpha: SUBTITLE_READABILITY.capcutShadowAlpha,
    shadow_angle: SUBTITLE_READABILITY.capcutShadowAngle,
    shadow_color: SUBTITLE_READABILITY.capcutShadowColor,
    shadow_distance: SUBTITLE_READABILITY.capcutShadowDistance,
    shadow_smoothing: SUBTITLE_READABILITY.capcutShadowSmoothing,
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
  isHighlight = false,
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
    fontWeight: SUBTITLE_READABILITY.webFontWeight,
    textTransform: preset.uppercase ? "uppercase" : "none",
    color: isActive
      ? isHighlight
        ? preset.keywordAccentColor
        : preset.activeColor
      : preset.inactiveColor,
    opacity: isActive ? 1 : preset.inactiveOpacity,
    WebkitTextStroke: `${SUBTITLE_READABILITY.webStrokeWidthPx}px ${SUBTITLE_READABILITY.strokeColor}`,
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
  DEFAULT_BGM_URL:
    "https://dzgekeibtcgavrzxcylr.supabase.co/storage/v1/object/public/assets/bgm/lofi_relax.mp3",
  bgmVolume: 0.12,
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
