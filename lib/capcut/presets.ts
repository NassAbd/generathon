import type { TranscriptData, WordEffect } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

type DraftRecord = Record<string, unknown>;

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
    phraseWords.push({
      index,
      word: transcript[index].word,
      isActive: index === activeIndex,
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

export interface CapCutTextAnimCatalogEntry {
  slug: string;
  title: string;
  effect_id: string;
  resource_id: string;
  md5: string;
  default_duration_us: number;
}

/** CapCut text intro / loop animation catalogue entries (capcut-cli enums). */
export const CAPCUT_TEXT_ANIM_CATALOG: Record<string, CapCutTextAnimCatalogEntry> = {
  "bounce-in": {
    slug: "bounce-in",
    title: "Bounce In",
    effect_id: "6887766069587481090",
    resource_id: "6887766069587481090",
    md5: "83cd5b21c6a1cea2d11aac09bf328d1b",
    default_duration_us: 500_000,
  },
  "pop-up": {
    slug: "pop-up",
    title: "Pop Up",
    effect_id: "7145435451946439170",
    resource_id: "7145435451946439170",
    md5: "28d9145ead32c23742082a37e511370e",
    default_duration_us: 500_000,
  },
  wobble: {
    slug: "wobble",
    title: "Wobble",
    effect_id: "7095603439912096258",
    resource_id: "7095603439912096258",
    md5: "d9099a94194f6a60366a2115ecca7646",
    default_duration_us: 500_000,
  },
  glitch: {
    slug: "glitch",
    title: "Glitch",
    effect_id: "7077812383946641921",
    resource_id: "7077812383946641921",
    md5: "de64c5a073e2517b8d5a07244034fc62",
    default_duration_us: 500_000,
  },
  blur: {
    slug: "blur",
    title: "Blur",
    effect_id: "6923135604519604737",
    resource_id: "6923135604519604737",
    md5: "a5f4d3998c0648ec65c03251506bd0a0",
    default_duration_us: 500_000,
  },
  pulse: {
    slug: "pulse",
    title: "Pulse",
    effect_id: "6724919955654971918",
    resource_id: "6724919955654971918",
    md5: "1b9a454256f041c19f723ba27358740b",
    default_duration_us: 500_000,
  },
};

export interface CapCutTextAnimationMaterialPlan {
  material: DraftRecord;
  materialId: string;
}

export interface CapCutWordEffectExportPlan {
  keyframes: DraftRecord[];
  introAnimation?: CapCutTextAnimationMaterialPlan;
  loopAnimation?: CapCutTextAnimationMaterialPlan;
}

function createCapCutKeyframePoint(timeOffsetMicros: number, values: number[]): DraftRecord {
  return {
    id: crypto.randomUUID(),
    time_offset: timeOffsetMicros,
    values,
    curveType: "Line",
  };
}

function createCapCutKeyframeTrack(propertyType: string, points: DraftRecord[]): DraftRecord {
  return {
    id: crypto.randomUUID(),
    property_type: propertyType,
    keyframe_list: points,
  };
}

function clampEffectDuration(requestedMicros: number, segmentDurationMicros: number): number {
  return Math.max(80_000, Math.min(requestedMicros, segmentDurationMicros));
}

/** Pop/bounce scale keyframes — punchy 0.6× → 1.4× → 1.0× textScale pop. */
export function buildPopBounceScaleKeyframes(textScale: number): DraftRecord[] {
  const settleScale = Number((textScale * 1.0).toFixed(4));
  const startScale = Number((textScale * 0.6).toFixed(4));
  const peakScale = Number((textScale * 1.4).toFixed(4));

  return [
    createCapCutKeyframeTrack("KFTypeUniformScale", [
      createCapCutKeyframePoint(0, [startScale]),
      createCapCutKeyframePoint(100_000, [peakScale]),
      createCapCutKeyframePoint(200_000, [settleScale]),
    ]),
  ];
}

/** Horizontal shake keyframes — ±0.05 normalized canvas units for visible motion. */
export function buildShakePositionKeyframes(
  segmentDurationMicros: number,
  amplitude = 0.05,
): DraftRecord[] {
  const shakeDuration = clampEffectDuration(350_000, segmentDurationMicros);
  const quarter = Math.round(shakeDuration / 4);
  const half = Math.round(shakeDuration / 2);
  const threeQuarter = Math.round((shakeDuration * 3) / 4);

  return [
    createCapCutKeyframeTrack("KFTypePositionX", [
      createCapCutKeyframePoint(0, [0]),
      createCapCutKeyframePoint(quarter, [-amplitude]),
      createCapCutKeyframePoint(half, [amplitude]),
      createCapCutKeyframePoint(threeQuarter, [-amplitude]),
      createCapCutKeyframePoint(shakeDuration, [0]),
    ]),
  ];
}

/** Glow double-pulse scale keyframes — 1.0× → 1.25× → 1.0× → 1.25× → 1.0×. */
export function buildGlowScaleKeyframes(textScale: number, segmentDurationMicros: number): DraftRecord[] {
  const pulseDuration = clampEffectDuration(800_000, segmentDurationMicros);
  const quarter = Math.round(pulseDuration / 4);
  const half = Math.round(pulseDuration / 2);
  const threeQuarter = Math.round((pulseDuration * 3) / 4);
  const baseScale = Number(textScale.toFixed(4));
  const peakScale = Number((textScale * 1.25).toFixed(4));

  const tracks: DraftRecord[] = [
    createCapCutKeyframeTrack("KFTypeUniformScale", [
      createCapCutKeyframePoint(0, [baseScale]),
      createCapCutKeyframePoint(quarter, [peakScale]),
      createCapCutKeyframePoint(half, [baseScale]),
      createCapCutKeyframePoint(threeQuarter, [peakScale]),
      createCapCutKeyframePoint(pulseDuration, [baseScale]),
    ]),
  ];

  if (pulseDuration >= 200_000) {
    tracks.push(
      createCapCutKeyframeTrack("KFTypePositionX", [
        createCapCutKeyframePoint(0, [0]),
        createCapCutKeyframePoint(Math.round(pulseDuration * 0.2), [-0.02]),
        createCapCutKeyframePoint(Math.round(pulseDuration * 0.4), [0.02]),
        createCapCutKeyframePoint(Math.round(pulseDuration * 0.6), [-0.015]),
        createCapCutKeyframePoint(pulseDuration, [0]),
      ]),
    );
  }

  return tracks;
}

export function buildCapCutTextEffectKeyframes(
  effect: WordEffect,
  textScale: number,
  segmentDurationMicros: number,
  theme: ThemeId,
): DraftRecord[] {
  switch (effect) {
    case "bounce":
      return buildPopBounceScaleKeyframes(textScale);
    case "shake":
      return buildShakePositionKeyframes(segmentDurationMicros);
    case "glow":
      return theme === "cyberpunk"
        ? [
            ...buildGlowScaleKeyframes(textScale, segmentDurationMicros),
            ...buildShakePositionKeyframes(Math.min(segmentDurationMicros, 450_000), 0.05),
          ]
        : buildGlowScaleKeyframes(textScale, segmentDurationMicros);
    default:
      return [];
  }
}

export function createCapCutTextAnimationMaterial(
  catalogEntry: CapCutTextAnimCatalogEntry,
  options: {
    animType: "in" | "group";
    durationMicros: number;
    startMicros?: number;
    materialId?: string;
  },
): CapCutTextAnimationMaterialPlan {
  const materialId = options.materialId ?? crypto.randomUUID();
  const categoryName = options.animType === "in" ? "ruchang" : "zuhe";

  return {
    materialId,
    material: {
      id: materialId,
      type: "sticker_animation",
      multi_language_current: "none",
      animations: [
        {
          anim_adjust_params: null,
          category_id: "",
          category_name: categoryName,
          duration: options.durationMicros,
          id: catalogEntry.effect_id,
          material_type: "text",
          name: catalogEntry.title,
          panel: "text",
          path: "",
          platform: "all",
          request_id: "",
          resource_id: catalogEntry.resource_id,
          source_platform: 1,
          start: options.startMicros ?? 0,
          third_resource_id: catalogEntry.resource_id,
          type: options.animType,
        },
      ],
    },
  };
}

const WORD_EFFECT_INTRO_DURATIONS: Record<WordEffect, number> = {
  bounce: 250_000,
  shake: 350_000,
  glow: 300_000,
};

function resolveIntroCatalogEntry(effect: WordEffect, theme: ThemeId): CapCutTextAnimCatalogEntry {
  switch (effect) {
    case "bounce":
      return CAPCUT_TEXT_ANIM_CATALOG["bounce-in"];
    case "shake":
      return CAPCUT_TEXT_ANIM_CATALOG.wobble;
    case "glow":
      return theme === "cyberpunk"
        ? CAPCUT_TEXT_ANIM_CATALOG.glitch
        : CAPCUT_TEXT_ANIM_CATALOG.blur;
    default:
      return CAPCUT_TEXT_ANIM_CATALOG["pop-up"];
  }
}

/** Builds native CapCut keyframes + optional sticker_animation materials for a word effect. */
export function buildCapCutWordEffectExportPlan(
  effect: WordEffect,
  textScale: number,
  segmentDurationMicros: number,
  theme: ThemeId,
): CapCutWordEffectExportPlan {
  const keyframes = buildCapCutTextEffectKeyframes(effect, textScale, segmentDurationMicros, theme);
  const introDuration = clampEffectDuration(
    WORD_EFFECT_INTRO_DURATIONS[effect],
    segmentDurationMicros,
  );
  const introAnimation = createCapCutTextAnimationMaterial(resolveIntroCatalogEntry(effect, theme), {
    animType: "in",
    durationMicros: introDuration,
    startMicros: 0,
  });

  let loopAnimation: CapCutTextAnimationMaterialPlan | undefined;
  if (effect === "glow" && segmentDurationMicros > introDuration + 100_000) {
    const loopDuration = segmentDurationMicros - introDuration;
    loopAnimation = createCapCutTextAnimationMaterial(CAPCUT_TEXT_ANIM_CATALOG.pulse, {
      animType: "group",
      durationMicros: loopDuration,
      startMicros: introDuration,
    });
  }

  return { keyframes, introAnimation, loopAnimation };
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
