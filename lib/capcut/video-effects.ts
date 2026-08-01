export const CANVAS_ASPECT = 9 / 16;

export const CAPCUT_CANVAS_WIDTH = 1080;
export const CAPCUT_CANVAS_HEIGHT = 1920;
export const CAPCUT_CANVAS_RATIO = "9:16";

/** Width/height above native 9:16 (~0.5625) triggers vertical crop reframing. */
export const VERTICAL_CROP_ASPECT_THRESHOLD = 0.6;

/** Horizontal pan range for single-speaker reframing. */
export const DEFAULT_SPEAKER_OFFSET_PERCENT_X = 0;

/** Strict max pan for single-speaker shots — prevents black borders / clipped backgrounds. */
export const MAX_SINGLE_SPEAKER_OFFSET_PERCENT = 25;

/** Multiplier applied to raw face offset before clamping. */
export const SPEAKER_OFFSET_AMPLIFICATION = 2.2;

/** CapCut normalized Y offset for split-screen halves on a 9:16 canvas. */
export const SPLIT_SCREEN_CAPCUT_TRANSFORM_Y = 0.25;

/** Default normalized X centers for wide dual-speaker fallback framing. */
export const SPLIT_SCREEN_DEFAULT_LEFT_CENTER_X = 0.28;
export const SPLIT_SCREEN_DEFAULT_RIGHT_CENTER_X = 0.72;

export type ShotLayoutType = "single" | "split-screen";

export interface SpeakerTrackingLayout {
  needsReframe: boolean;
  coverScale: number;
  offsetPercentX: number;
  capcutTransformX: number;
  webTranslateXPercent: number;
}

export interface SplitScreenHalfLayout {
  offsetPercentX: number;
  capcutTransformX: number;
  capcutTransformY: number;
  coverScale: number;
  webTranslateXPercent: number;
}

export interface SplitScreenTrackingLayout {
  layoutType: "split-screen";
  needsReframe: boolean;
  coverScale: number;
  topHalf: SplitScreenHalfLayout;
  bottomHalf: SplitScreenHalfLayout;
}

/** Timed shot segment — static framing per interval, no in-shot panning. */
export interface SpeakerOffsetSegment {
  startSeconds: number;
  endSeconds: number;
  layoutType: ShotLayoutType;
  /** Raw single-speaker offset before amplification. */
  offsetPercentX: number;
  /** Split-screen: left speaker (top half). */
  leftOffsetPercentX?: number;
  /** Split-screen: right speaker (bottom half). */
  rightOffsetPercentX?: number;
}

export function isNonVerticalCanvasVideo(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }

  const aspect = width / height;

  if (aspect >= 1) {
    return true;
  }

  return Math.abs(aspect - CANVAS_ASPECT) > 0.08;
}

export function needsVerticalCropReframe(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }

  const aspect = width / height;
  if (aspect > VERTICAL_CROP_ASPECT_THRESHOLD) {
    return true;
  }

  return isNonVerticalCanvasVideo(width, height);
}

/** @deprecated Use `needsVerticalCropReframe`. */
export function needsBackgroundBlurLayer(width: number, height: number): boolean {
  return needsVerticalCropReframe(width, height);
}

export function computeVerticalCoverScale(sourceWidth: number, sourceHeight: number): number {
  const fitWidth = CAPCUT_CANVAS_WIDTH / sourceWidth;
  const fitHeight = CAPCUT_CANVAS_HEIGHT / sourceHeight;
  const contain = Math.min(fitWidth, fitHeight);
  const cover = Math.max(fitWidth, fitHeight);

  if (contain <= 0) {
    return 1;
  }

  return Number((cover / contain).toFixed(4));
}

/** @deprecated Use `computeVerticalCoverScale`. */
export function computeBackgroundCoverScale(sourceWidth: number, sourceHeight: number): number {
  return computeVerticalCoverScale(sourceWidth, sourceHeight);
}

function clampSingleSpeakerOffsetPercentX(offsetPercentX: number): number {
  return Math.max(
    -MAX_SINGLE_SPEAKER_OFFSET_PERCENT,
    Math.min(MAX_SINGLE_SPEAKER_OFFSET_PERCENT, offsetPercentX),
  );
}

/** Amplifies raw detection offset and clamps to ±25%. */
export function amplifySpeakerOffsetPercentX(rawOffsetPercentX: number): number {
  return clampSingleSpeakerOffsetPercentX(rawOffsetPercentX * SPEAKER_OFFSET_AMPLIFICATION);
}

/**
 * Maps normalized face center X (0–1) to raw pan offset.
 * Face on RIGHT → negative offset (video pans LEFT).
 * Face on LEFT → positive offset (video pans RIGHT).
 */
export function mapNormalizedFaceCenterXToOffsetPercentX(normalizedCenterX: number): number {
  const clamped = Math.max(0, Math.min(1, normalizedCenterX));
  return clampSingleSpeakerOffsetPercentX((0.5 - clamped) * 100);
}

function computeCapCutTransformX(
  amplifiedOffset: number,
  coverScale: number,
): number {
  const panFraction = amplifiedOffset / MAX_SINGLE_SPEAKER_OFFSET_PERCENT;
  const horizontalOverflow = Math.max(0, coverScale - 1);
  return Number((panFraction * horizontalOverflow * 0.35).toFixed(4));
}

function computeWebTranslateXPercent(
  amplifiedOffset: number,
  coverScale: number,
): number {
  const panFraction = amplifiedOffset / MAX_SINGLE_SPEAKER_OFFSET_PERCENT;
  const horizontalOverflow = Math.max(0, coverScale - 1);
  return Number((panFraction * (horizontalOverflow / 2) * 100).toFixed(2));
}

export function computeSpeakerTrackingLayout(
  sourceWidth: number,
  sourceHeight: number,
  offsetPercentX: number = DEFAULT_SPEAKER_OFFSET_PERCENT_X,
): SpeakerTrackingLayout {
  const needsReframe = needsVerticalCropReframe(sourceWidth, sourceHeight);
  const amplifiedOffset = amplifySpeakerOffsetPercentX(offsetPercentX);

  if (!needsReframe) {
    return {
      needsReframe: false,
      coverScale: 1,
      offsetPercentX: amplifiedOffset,
      capcutTransformX: 0,
      webTranslateXPercent: 0,
    };
  }

  const coverScale = computeVerticalCoverScale(sourceWidth, sourceHeight);

  return {
    needsReframe: true,
    coverScale,
    offsetPercentX: amplifiedOffset,
    capcutTransformX: computeCapCutTransformX(amplifiedOffset, coverScale),
    webTranslateXPercent: computeWebTranslateXPercent(amplifiedOffset, coverScale),
  };
}

export function computeSplitScreenHalfLayout(
  sourceWidth: number,
  sourceHeight: number,
  rawOffsetPercentX: number,
  half: "top" | "bottom",
): SplitScreenHalfLayout {
  const coverScale = computeVerticalCoverScale(sourceWidth, sourceHeight);
  const amplifiedOffset = amplifySpeakerOffsetPercentX(rawOffsetPercentX);

  return {
    offsetPercentX: amplifiedOffset,
    capcutTransformX: computeCapCutTransformX(amplifiedOffset, coverScale),
    capcutTransformY: half === "top" ? SPLIT_SCREEN_CAPCUT_TRANSFORM_Y : -SPLIT_SCREEN_CAPCUT_TRANSFORM_Y,
    coverScale,
    webTranslateXPercent: computeWebTranslateXPercent(amplifiedOffset, coverScale),
  };
}

export function computeSplitScreenTrackingLayout(
  sourceWidth: number,
  sourceHeight: number,
  leftOffsetPercentX: number,
  rightOffsetPercentX: number,
): SplitScreenTrackingLayout {
  const needsReframe = needsVerticalCropReframe(sourceWidth, sourceHeight);
  const coverScale = needsReframe ? computeVerticalCoverScale(sourceWidth, sourceHeight) : 1;

  return {
    layoutType: "split-screen",
    needsReframe,
    coverScale,
    topHalf: computeSplitScreenHalfLayout(sourceWidth, sourceHeight, leftOffsetPercentX, "top"),
    bottomHalf: computeSplitScreenHalfLayout(sourceWidth, sourceHeight, rightOffsetPercentX, "bottom"),
  };
}

export function buildSpeakerOffsetSegmentRanges(
  phraseStarts: number[],
  durationSeconds: number,
): Array<{ startSeconds: number; endSeconds: number }> {
  if (durationSeconds <= 0) {
    return [];
  }

  const sortedStarts = [...new Set(phraseStarts.filter((time) => time >= 0 && time < durationSeconds))].sort(
    (left, right) => left - right,
  );

  if (sortedStarts.length === 0 || sortedStarts[0] > 0) {
    sortedStarts.unshift(0);
  }

  const ranges: Array<{ startSeconds: number; endSeconds: number }> = [];
  for (let index = 0; index < sortedStarts.length; index += 1) {
    const startSeconds = sortedStarts[index];
    const endSeconds =
      index + 1 < sortedStarts.length ? sortedStarts[index + 1] : durationSeconds;

    if (endSeconds > startSeconds) {
      ranges.push({ startSeconds, endSeconds });
    }
  }

  return ranges;
}

export function createDefaultSpeakerOffsetSegment(
  startSeconds: number,
  endSeconds: number,
): SpeakerOffsetSegment {
  return {
    startSeconds,
    endSeconds,
    layoutType: "single",
    offsetPercentX: 0,
  };
}

export function normalizeSpeakerOffsetSegments(
  segments: SpeakerOffsetSegment[],
  durationSeconds: number,
): SpeakerOffsetSegment[] {
  if (durationSeconds <= 0 || segments.length === 0) {
    return [];
  }

  const sorted = [...segments]
    .filter(
      (segment) =>
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.endSeconds > segment.startSeconds,
    )
    .sort((left, right) => left.startSeconds - right.startSeconds);

  if (sorted.length === 0) {
    return [];
  }

  const normalized: SpeakerOffsetSegment[] = [];
  let cursor = 0;

  for (const segment of sorted) {
    const startSeconds = Math.max(cursor, Math.max(0, segment.startSeconds));
    const endSeconds = Math.min(durationSeconds, segment.endSeconds);

    if (endSeconds <= startSeconds) {
      continue;
    }

    normalized.push({ ...segment, startSeconds, endSeconds });
    cursor = endSeconds;
  }

  if (normalized.length === 0) {
    return [];
  }

  if (normalized[0].startSeconds > 0) {
    normalized.unshift(createDefaultSpeakerOffsetSegment(0, normalized[0].startSeconds));
  }

  const last = normalized[normalized.length - 1];
  if (last.endSeconds < durationSeconds) {
    normalized.push(createDefaultSpeakerOffsetSegment(last.endSeconds, durationSeconds));
  }

  return normalized;
}

export function resolveSpeakerSegmentAtTime(
  segments: SpeakerOffsetSegment[],
  timeSeconds: number,
): SpeakerOffsetSegment | null {
  if (segments.length === 0 || !Number.isFinite(timeSeconds)) {
    return null;
  }

  return (
    segments.find(
      (segment) => timeSeconds >= segment.startSeconds && timeSeconds < segment.endSeconds,
    ) ?? segments[segments.length - 1]
  );
}

/** @deprecated Use resolveSpeakerSegmentAtTime for layout-aware shot tracking. */
export function resolveSpeakerOffsetAtTime(
  segments: SpeakerOffsetSegment[],
  timeSeconds: number,
): number {
  const segment = resolveSpeakerSegmentAtTime(segments, timeSeconds);
  if (!segment || segment.layoutType === "split-screen") {
    return 0;
  }

  return segment.offsetPercentX;
}

function segmentIdentityKey(segment: SpeakerOffsetSegment): string {
  if (segment.layoutType === "split-screen") {
    return [
      "split",
      segment.leftOffsetPercentX ?? 0,
      segment.rightOffsetPercentX ?? 0,
    ].join(":");
  }

  return ["single", segment.offsetPercentX].join(":");
}

/** True when shot layout or single-speaker offset changes between segments. */
export function shotSegmentsNeedTimelineSplit(segments: SpeakerOffsetSegment[]): boolean {
  if (segments.length <= 1) {
    return false;
  }

  const baseline = segmentIdentityKey(segments[0]);
  return segments.some((segment) => segmentIdentityKey(segment) !== baseline);
}

/** @deprecated Use shotSegmentsNeedTimelineSplit. */
export function speakerOffsetSegmentsNeedSplitting(segments: SpeakerOffsetSegment[]): boolean {
  return shotSegmentsNeedTimelineSplit(segments);
}
