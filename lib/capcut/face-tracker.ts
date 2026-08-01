import {
  amplifySpeakerOffsetPercentX,
  buildSpeakerOffsetSegmentRanges,
  createDefaultSpeakerOffsetSegment,
  mapNormalizedFaceCenterXToOffsetPercentX,
  normalizeSpeakerOffsetSegments,
  SPLIT_SCREEN_DEFAULT_LEFT_CENTER_X,
  SPLIT_SCREEN_DEFAULT_RIGHT_CENTER_X,
  type ShotLayoutType,
  type SpeakerOffsetSegment,
} from "@/lib/capcut/video-effects";

const FACE_API_MODEL_BASE_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
const MAX_SAMPLE_COUNT = 10;
const MIN_SAMPLE_COUNT = 8;
const ZONE_COUNT = 5;

/** Multi-scale TinyFaceDetector passes — higher resolution first, then lower threshold. */
const FACE_DETECTOR_SCALES = [
  { inputSize: 608, scoreThreshold: 0.25 },
  { inputSize: 512, scoreThreshold: 0.22 },
  { inputSize: 416, scoreThreshold: 0.2 },
] as const;

const WIDE_SHOT_MIN_SEPARATION = 0.28;
const WIDE_SHOT_LEFT_EDGE_MAX = 0.38;
const WIDE_SHOT_RIGHT_EDGE_MIN = 0.62;

/** Max raw offset difference (%) to treat consecutive single-speaker segments as one shot. */
const SINGLE_OFFSET_MERGE_THRESHOLD = 5;

/** Max raw offset difference (%) to treat consecutive split-screen segments as one shot. */
const SPLIT_OFFSET_MERGE_THRESHOLD = 5;

/** Middle segments shorter than this (seconds) may be absorbed into surrounding layout. */
const LAYOUT_JITTER_MAX_DURATION_SECONDS = 2;

export type SpeakerDetectionSource = "face" | "subject-fallback" | "none";

export interface FaceDetectionResult {
  normalizedCenterX: number;
  offsetPercentX: number;
  confidence: number;
  sampledFrameCount: number;
  detectionsFound: number;
  detectionSource: SpeakerDetectionSource;
  segments: SpeakerOffsetSegment[];
}

export interface SpeakerOffsetDetectionResult {
  segments: SpeakerOffsetSegment[];
  /** Legacy single offset — meaningful only when all segments share the same pan. */
  offsetPercentX: number;
  sampledSegmentCount: number;
  detectionsFound: number;
}

type FaceApiModule = typeof import("@vladmandic/face-api");

interface ZoneMetrics {
  zoneIndex: number;
  skinMass: number;
  edgeEnergy: number;
  luminanceSum: number;
  luminanceSqSum: number;
  pixelCount: number;
  score: number;
}

interface SubjectRegion {
  normalizedCenterX: number;
  score: number;
  zoneIndices: number[];
}

interface SubjectAnalysisResult {
  normalizedCenterX: number;
  wideDualSubject: boolean;
}

interface FrameDetectionSample {
  normalizedCenterX: number;
  source: SpeakerDetectionSource;
  wideDualSubject: boolean;
}

let faceApiModule: FaceApiModule | null = null;
let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function createCenterCropFallback(
  sampledFrameCount = 0,
  detectionSource: SpeakerDetectionSource = "none",
  durationSeconds = 0,
): FaceDetectionResult {
  const segments =
    durationSeconds > 0
      ? [createDefaultSpeakerOffsetSegment(0, durationSeconds)]
      : [];

  return {
    normalizedCenterX: 0.5,
    offsetPercentX: 0,
    confidence: 0,
    sampledFrameCount,
    detectionsFound: 0,
    detectionSource,
    segments,
  };
}

function isCanvasSecurityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "SecurityError" ||
    message.includes("tainted") ||
    message.includes("cross-origin") ||
    message.includes("cors") ||
    message.includes("webgl")
  );
}

function logCanvasSecurityFallback(error: unknown): void {
  console.warn(
    "[FaceTracker] CORS issue drawing video to canvas, falling back to center crop.",
    error instanceof Error ? error.message : error,
  );
}

function isSkinLikePixel(red: number, green: number, blue: number): boolean {
  return (
    red > 55 &&
    green > 35 &&
    blue > 18 &&
    red > green &&
    red > blue &&
    red - green > 8 &&
    red - blue > 12 &&
    Math.max(red, green, blue) - Math.min(red, green, blue) > 15
  );
}

async function loadFaceApiModule(): Promise<FaceApiModule> {
  if (faceApiModule) {
    return faceApiModule;
  }

  faceApiModule = await import("@vladmandic/face-api");
  return faceApiModule;
}

async function ensureFaceModelsLoaded(): Promise<FaceApiModule> {
  const faceapi = await loadFaceApiModule();

  if (modelsLoaded) {
    return faceapi;
  }

  if (!modelsLoading) {
    modelsLoading = faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_BASE_URL).then(() => {
      modelsLoaded = true;
    });
  }

  await modelsLoading;
  return faceapi;
}

/** Builds 8–10 evenly spaced sample times, optionally anchored to phrase starts. */
export function buildFaceSampleTimes(
  durationSeconds: number,
  phraseStarts: number[] = [],
): number[] {
  if (durationSeconds <= 0) {
    return [0];
  }

  const sampleTimes = new Set<number>([
    0.15,
    0.35,
    durationSeconds * 0.5,
    durationSeconds * 0.65,
    Math.max(0, durationSeconds - 0.35),
    Math.max(0, durationSeconds - 0.15),
  ]);

  for (const phraseStart of phraseStarts) {
    if (phraseStart >= 0 && phraseStart < durationSeconds) {
      sampleTimes.add(phraseStart);
    }
  }

  const targetEvenCount = Math.max(
    MIN_SAMPLE_COUNT,
    MAX_SAMPLE_COUNT - Math.min(phraseStarts.length, 3),
  );

  for (let index = 0; index < targetEvenCount; index += 1) {
    const fraction = (index + 1) / (targetEvenCount + 1);
    sampleTimes.add(durationSeconds * fraction);
  }

  return [...sampleTimes]
    .filter((time) => time >= 0 && time < durationSeconds)
    .sort((left, right) => left - right)
    .slice(0, MAX_SAMPLE_COUNT);
}

function waitForVideoSeek(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    const handleSeeked = (): void => {
      video.removeEventListener("seeked", handleSeeked);
      resolve();
    };

    video.addEventListener("seeked", handleSeeked);
    video.currentTime = targetTime;

    if (Math.abs(video.currentTime - targetTime) < 0.01 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.removeEventListener("seeked", handleSeeked);
      resolve();
    }
  });
}

function captureVideoFrameCanvas(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Unable to acquire 2D canvas context for face sampling.");
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function detectFacesMultiScale(
  faceapi: FaceApiModule,
  frameCanvas: HTMLCanvasElement,
): Promise<Array<{ box: { x: number; y: number; width: number; height: number; area: number } }>> {
  for (const scale of FACE_DETECTOR_SCALES) {
    const detections = await faceapi.detectAllFaces(
      frameCanvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: scale.inputSize,
        scoreThreshold: scale.scoreThreshold,
      }),
    );

    if (detections.length > 0) {
      return detections;
    }
  }

  return [];
}

async function detectPrimaryFaceCenterXFromCanvas(
  faceapi: FaceApiModule,
  frameCanvas: HTMLCanvasElement,
  frameWidth: number,
): Promise<number | null> {
  if (frameWidth <= 0 || frameCanvas.height <= 0) {
    return null;
  }

  try {
    const detections = await detectFacesMultiScale(faceapi, frameCanvas);

    if (detections.length === 0) {
      return null;
    }

    const primaryFace = detections.reduce((largest, candidate) =>
      candidate.box.area > largest.box.area ? candidate : largest,
    );

    return (primaryFace.box.x + primaryFace.box.width / 2) / frameWidth;
  } catch (error: unknown) {
    if (isCanvasSecurityError(error)) {
      throw error;
    }

    console.warn("[FaceTracker] Face detection failed for sampled frame.", error);
    return null;
  }
}

function clusterAdjacentZones(activeZones: ZoneMetrics[], frameWidth: number): SubjectRegion[] {
  if (activeZones.length === 0) {
    return [];
  }

  const sorted = [...activeZones].sort((left, right) => left.zoneIndex - right.zoneIndex);
  const regions: SubjectRegion[] = [];
  const zoneWidth = frameWidth / ZONE_COUNT;

  let currentRegion: SubjectRegion = {
    normalizedCenterX: 0,
    score: 0,
    zoneIndices: [sorted[0].zoneIndex],
  };
  currentRegion.score += sorted[0].score;

  for (let index = 1; index < sorted.length; index += 1) {
    const zone = sorted[index];

    if (zone.zoneIndex === sorted[index - 1].zoneIndex + 1) {
      currentRegion.zoneIndices.push(zone.zoneIndex);
      currentRegion.score += zone.score;
      continue;
    }

    const centerZone =
      currentRegion.zoneIndices.reduce((sum, zoneIndex) => sum + zoneIndex, 0) /
      currentRegion.zoneIndices.length;
    currentRegion.normalizedCenterX = (centerZone + 0.5) * (zoneWidth / frameWidth);
    regions.push(currentRegion);

    currentRegion = {
      normalizedCenterX: 0,
      score: zone.score,
      zoneIndices: [zone.zoneIndex],
    };
  }

  const centerZone =
    currentRegion.zoneIndices.reduce((sum, zoneIndex) => sum + zoneIndex, 0) /
    currentRegion.zoneIndices.length;
  currentRegion.normalizedCenterX = (centerZone + 0.5) * (zoneWidth / frameWidth);
  regions.push(currentRegion);

  return regions;
}

function isWideDualSubjectLayout(
  primary: SubjectRegion,
  secondary: SubjectRegion,
): boolean {
  const separation = Math.abs(primary.normalizedCenterX - secondary.normalizedCenterX);
  if (separation < WIDE_SHOT_MIN_SEPARATION) {
    return false;
  }

  const leftSubject =
    primary.normalizedCenterX <= WIDE_SHOT_LEFT_EDGE_MAX &&
    secondary.normalizedCenterX >= WIDE_SHOT_RIGHT_EDGE_MIN;
  const rightSubject =
    primary.normalizedCenterX >= WIDE_SHOT_RIGHT_EDGE_MIN &&
    secondary.normalizedCenterX <= WIDE_SHOT_LEFT_EDGE_MAX;

  return leftSubject || rightSubject;
}

/**
 * Color/luminance subject heuristic when faces are not detected.
 * Handles wide podcast shots with two distant speakers by framing the primary active region.
 */
export function analyzeSubjectRegions(frameCanvas: HTMLCanvasElement): SubjectAnalysisResult | null {
  const sampleWidth = 240;
  const sampleHeight = Math.max(1, Math.round(frameCanvas.height * (sampleWidth / frameCanvas.width)));

  const scratch = document.createElement("canvas");
  scratch.width = sampleWidth;
  scratch.height = sampleHeight;

  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(frameCanvas, 0, 0, sampleWidth, sampleHeight);
  const imageData = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const { data, width, height } = imageData;
  const bodyHeight = Math.floor(height * 0.72);
  const zoneWidth = width / ZONE_COUNT;

  const zoneMetrics: ZoneMetrics[] = Array.from({ length: ZONE_COUNT }, (_, zoneIndex) => ({
    zoneIndex,
    skinMass: 0,
    edgeEnergy: 0,
    luminanceSum: 0,
    luminanceSqSum: 0,
    pixelCount: 0,
    score: 0,
  }));

  const luminanceGrid = new Float32Array(width * bodyHeight);

  for (let y = 0; y < bodyHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const red = data[pixelIndex];
      const green = data[pixelIndex + 1];
      const blue = data[pixelIndex + 2];
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      luminanceGrid[y * width + x] = luminance;

      const zone = Math.min(ZONE_COUNT - 1, Math.floor(x / zoneWidth));
      const metrics = zoneMetrics[zone];
      metrics.pixelCount += 1;
      metrics.luminanceSum += luminance;
      metrics.luminanceSqSum += luminance * luminance;

      if (isSkinLikePixel(red, green, blue)) {
        metrics.skinMass += 1;
      }
    }
  }

  for (let y = 1; y < bodyHeight; y += 1) {
    for (let x = 1; x < width; x += 1) {
      const luminance = luminanceGrid[y * width + x];
      const gradientX = Math.abs(luminance - luminanceGrid[y * width + (x - 1)]);
      const gradientY = Math.abs(luminance - luminanceGrid[(y - 1) * width + x]);
      const zone = Math.min(ZONE_COUNT - 1, Math.floor(x / zoneWidth));
      zoneMetrics[zone].edgeEnergy += gradientX + gradientY;
    }
  }

  for (const metrics of zoneMetrics) {
    if (metrics.pixelCount === 0) {
      continue;
    }

    const meanLuminance = metrics.luminanceSum / metrics.pixelCount;
    const luminanceVariance = metrics.luminanceSqSum / metrics.pixelCount - meanLuminance * meanLuminance;
    metrics.score =
      metrics.skinMass * 3.5 +
      metrics.edgeEnergy * 0.12 +
      Math.max(0, luminanceVariance) * 0.1;
  }

  const maxScore = Math.max(...zoneMetrics.map((metrics) => metrics.score));
  if (maxScore <= 0) {
    return null;
  }

  const activeZones = zoneMetrics.filter((metrics) => metrics.score >= maxScore * 0.22);
  const regions = clusterAdjacentZones(activeZones, width);

  if (regions.length >= 2) {
    const rankedRegions = [...regions].sort((left, right) => right.score - left.score);
    const [primaryRegion, secondaryRegion] = rankedRegions;

    if (isWideDualSubjectLayout(primaryRegion, secondaryRegion)) {
      console.info(
        `[FaceTracker] Wide shot: dual subjects detected, framing primary at ${(primaryRegion.normalizedCenterX * 100).toFixed(0)}%`,
      );
      return {
        normalizedCenterX: primaryRegion.normalizedCenterX,
        wideDualSubject: true,
      };
    }
  }

  if (regions.length >= 1) {
    const totalScore = regions.reduce((sum, region) => sum + region.score, 0);
    const weightedCenter =
      regions.reduce((sum, region) => sum + region.normalizedCenterX * region.score, 0) / totalScore;

    return {
      normalizedCenterX: weightedCenter,
      wideDualSubject: false,
    };
  }

  const leftScore = zoneMetrics.slice(0, 2).reduce((sum, metrics) => sum + metrics.score, 0);
  const centerScore = zoneMetrics[2]?.score ?? 0;
  const rightScore = zoneMetrics.slice(3).reduce((sum, metrics) => sum + metrics.score, 0);

  if (centerScore < leftScore * 0.45 && centerScore < rightScore * 0.45) {
    const biasCenter = leftScore > rightScore ? 0.28 : 0.72;
    console.info(
      `[FaceTracker] Subject fallback: empty center, biasing to ${leftScore > rightScore ? "left" : "right"}`,
    );
    return {
      normalizedCenterX: biasCenter,
      wideDualSubject: true,
    };
  }

  return null;
}

async function detectFrameSpeakerSample(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
): Promise<FrameDetectionSample | null> {
  const frameCanvas = captureVideoFrameCanvas(video);
  const frameWidth = video.videoWidth;

  const faceCenterX = await detectPrimaryFaceCenterXFromCanvas(faceapi, frameCanvas, frameWidth);
  if (faceCenterX !== null) {
    return {
      normalizedCenterX: faceCenterX,
      source: "face",
      wideDualSubject: false,
    };
  }

  const subjectAnalysis = analyzeSubjectRegions(frameCanvas);
  if (subjectAnalysis !== null) {
    return {
      normalizedCenterX: subjectAnalysis.normalizedCenterX,
      source: "subject-fallback",
      wideDualSubject: subjectAnalysis.wideDualSubject,
    };
  }

  return null;
}

interface SegmentLayoutDetection {
  layoutType: ShotLayoutType;
  offsetPercentX: number;
  leftOffsetPercentX?: number;
  rightOffsetPercentX?: number;
}

function detectWideDualFaceLayout(
  detections: Array<{ box: { x: number; y: number; width: number; height: number } }>,
  frameWidth: number,
): { leftCenterX: number; rightCenterX: number } | null {
  if (detections.length < 2 || frameWidth <= 0) {
    return null;
  }

  const centers = detections
    .map((detection) => (detection.box.x + detection.box.width / 2) / frameWidth)
    .sort((left, right) => left - right);

  const leftCenterX = centers[0];
  const rightCenterX = centers[centers.length - 1];

  if (rightCenterX - leftCenterX < WIDE_SHOT_MIN_SEPARATION) {
    return null;
  }

  if (
    leftCenterX <= WIDE_SHOT_LEFT_EDGE_MAX &&
    rightCenterX >= WIDE_SHOT_RIGHT_EDGE_MIN
  ) {
    return { leftCenterX, rightCenterX };
  }

  return null;
}

function detectWideDualSubjectLayout(
  frameCanvas: HTMLCanvasElement,
): { leftCenterX: number; rightCenterX: number } | null {
  const sampleWidth = 240;
  const sampleHeight = Math.max(1, Math.round(frameCanvas.height * (sampleWidth / frameCanvas.width)));

  const scratch = document.createElement("canvas");
  scratch.width = sampleWidth;
  scratch.height = sampleHeight;

  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(frameCanvas, 0, 0, sampleWidth, sampleHeight);
  const imageData = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const { data, width, height } = imageData;
  const bodyHeight = Math.floor(height * 0.72);
  const zoneWidth = width / ZONE_COUNT;

  const zoneMetrics: ZoneMetrics[] = Array.from({ length: ZONE_COUNT }, (_, zoneIndex) => ({
    zoneIndex,
    skinMass: 0,
    edgeEnergy: 0,
    luminanceSum: 0,
    luminanceSqSum: 0,
    pixelCount: 0,
    score: 0,
  }));

  for (let y = 0; y < bodyHeight; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = (y * width + x) * 4;
      const red = data[pixelIndex];
      const green = data[pixelIndex + 1];
      const blue = data[pixelIndex + 2];

      const zone = Math.min(ZONE_COUNT - 1, Math.floor(x / zoneWidth));
      const metrics = zoneMetrics[zone];
      metrics.pixelCount += 1;

      if (isSkinLikePixel(red, green, blue)) {
        metrics.skinMass += 1;
      }
    }
  }

  for (const metrics of zoneMetrics) {
    metrics.score = metrics.skinMass;
  }

  const activeZones = zoneMetrics.filter((metrics) => metrics.score > 0);
  const regions = clusterAdjacentZones(activeZones, width);

  if (regions.length < 2) {
    return null;
  }

  const rankedRegions = [...regions].sort((left, right) => left.normalizedCenterX - right.normalizedCenterX);
  const leftRegion = rankedRegions[0];
  const rightRegion = rankedRegions[rankedRegions.length - 1];

  if (!isWideDualSubjectLayout(leftRegion, rightRegion)) {
    return null;
  }

  return {
    leftCenterX: leftRegion.normalizedCenterX,
    rightCenterX: rightRegion.normalizedCenterX,
  };
}

async function detectSegmentLayout(
  faceapi: FaceApiModule,
  video: HTMLVideoElement,
  sampleTime: number,
): Promise<SegmentLayoutDetection> {
  await waitForVideoSeek(video, sampleTime);

  const frameCanvas = captureVideoFrameCanvas(video);
  const frameWidth = video.videoWidth;
  const detections = await detectFacesMultiScale(faceapi, frameCanvas);

  const dualFaceLayout = detectWideDualFaceLayout(detections, frameWidth);
  if (dualFaceLayout !== null) {
    console.info("[FaceTracker] Wide shot → split-screen layout");
    return {
      layoutType: "split-screen",
      offsetPercentX: 0,
      leftOffsetPercentX: mapNormalizedFaceCenterXToOffsetPercentX(dualFaceLayout.leftCenterX),
      rightOffsetPercentX: mapNormalizedFaceCenterXToOffsetPercentX(dualFaceLayout.rightCenterX),
    };
  }

  if (detections.length === 1 && frameWidth > 0) {
    const normalizedCenterX =
      (detections[0].box.x + detections[0].box.width / 2) / frameWidth;

    return {
      layoutType: "single",
      offsetPercentX: mapNormalizedFaceCenterXToOffsetPercentX(normalizedCenterX),
    };
  }

  const dualSubjectLayout = detectWideDualSubjectLayout(frameCanvas);
  if (dualSubjectLayout !== null) {
    console.info("[FaceTracker] Wide shot (subject heuristic) → split-screen layout");
    return {
      layoutType: "split-screen",
      offsetPercentX: 0,
      leftOffsetPercentX: mapNormalizedFaceCenterXToOffsetPercentX(dualSubjectLayout.leftCenterX),
      rightOffsetPercentX: mapNormalizedFaceCenterXToOffsetPercentX(dualSubjectLayout.rightCenterX),
    };
  }

  return {
    layoutType: "single",
    offsetPercentX: 0,
  };
}

function segmentDurationSeconds(segment: SpeakerOffsetSegment): number {
  return segment.endSeconds - segment.startSeconds;
}

function resolveSplitLeftOffset(segment: SpeakerOffsetSegment): number {
  return (
    segment.leftOffsetPercentX ??
    mapNormalizedFaceCenterXToOffsetPercentX(SPLIT_SCREEN_DEFAULT_LEFT_CENTER_X)
  );
}

function resolveSplitRightOffset(segment: SpeakerOffsetSegment): number {
  return (
    segment.rightOffsetPercentX ??
    mapNormalizedFaceCenterXToOffsetPercentX(SPLIT_SCREEN_DEFAULT_RIGHT_CENTER_X)
  );
}

function singleOffsetsAreSimilar(leftOffset: number, rightOffset: number): boolean {
  return Math.abs(leftOffset - rightOffset) < SINGLE_OFFSET_MERGE_THRESHOLD;
}

function splitOffsetsAreSimilar(
  leftSegment: SpeakerOffsetSegment,
  rightSegment: SpeakerOffsetSegment,
): boolean {
  return (
    singleOffsetsAreSimilar(resolveSplitLeftOffset(leftSegment), resolveSplitLeftOffset(rightSegment)) &&
    singleOffsetsAreSimilar(resolveSplitRightOffset(leftSegment), resolveSplitRightOffset(rightSegment))
  );
}

function segmentsHaveSimilarFraming(
  leftSegment: SpeakerOffsetSegment,
  rightSegment: SpeakerOffsetSegment,
): boolean {
  if (leftSegment.layoutType !== rightSegment.layoutType) {
    return false;
  }

  if (leftSegment.layoutType === "single") {
    return singleOffsetsAreSimilar(leftSegment.offsetPercentX, rightSegment.offsetPercentX);
  }

  return splitOffsetsAreSimilar(leftSegment, rightSegment);
}

function blendScalarByDuration(
  leftValue: number,
  leftDuration: number,
  rightValue: number,
  rightDuration: number,
): number {
  const totalDuration = leftDuration + rightDuration;
  if (totalDuration <= 0) {
    return leftValue;
  }

  return (leftValue * leftDuration + rightValue * rightDuration) / totalDuration;
}

function mergeSegmentFramingValues(
  targetSegment: SpeakerOffsetSegment,
  sourceSegment: SpeakerOffsetSegment,
): Pick<
  SpeakerOffsetSegment,
  "layoutType" | "offsetPercentX" | "leftOffsetPercentX" | "rightOffsetPercentX"
> {
  const targetDuration = segmentDurationSeconds(targetSegment);
  const sourceDuration = segmentDurationSeconds(sourceSegment);

  if (targetSegment.layoutType === "single" && sourceSegment.layoutType === "single") {
    return {
      layoutType: "single",
      offsetPercentX: blendScalarByDuration(
        targetSegment.offsetPercentX,
        targetDuration,
        sourceSegment.offsetPercentX,
        sourceDuration,
      ),
    };
  }

  if (targetSegment.layoutType === "split-screen" && sourceSegment.layoutType === "split-screen") {
    return {
      layoutType: "split-screen",
      offsetPercentX: 0,
      leftOffsetPercentX: blendScalarByDuration(
        resolveSplitLeftOffset(targetSegment),
        targetDuration,
        resolveSplitLeftOffset(sourceSegment),
        sourceDuration,
      ),
      rightOffsetPercentX: blendScalarByDuration(
        resolveSplitRightOffset(targetSegment),
        targetDuration,
        resolveSplitRightOffset(sourceSegment),
        sourceDuration,
      ),
    };
  }

  return {
    layoutType: targetSegment.layoutType,
    offsetPercentX: targetSegment.offsetPercentX,
    leftOffsetPercentX: targetSegment.leftOffsetPercentX,
    rightOffsetPercentX: targetSegment.rightOffsetPercentX,
  };
}

function appendMergedSegment(
  mergedSegments: SpeakerOffsetSegment[],
  segment: SpeakerOffsetSegment,
): void {
  if (mergedSegments.length === 0) {
    mergedSegments.push(segment);
    return;
  }

  const previousSegment = mergedSegments[mergedSegments.length - 1];

  if (!segmentsHaveSimilarFraming(previousSegment, segment)) {
    mergedSegments.push(segment);
    return;
  }

  mergedSegments[mergedSegments.length - 1] = {
    startSeconds: previousSegment.startSeconds,
    endSeconds: segment.endSeconds,
    ...mergeSegmentFramingValues(previousSegment, segment),
  };
}

/** Merges consecutive segments that share the same camera framing. */
export function mergeSimilarContinuousSegments(
  segments: SpeakerOffsetSegment[],
): SpeakerOffsetSegment[] {
  if (segments.length <= 1) {
    return segments;
  }

  const mergedSegments: SpeakerOffsetSegment[] = [];

  for (const segment of segments) {
    appendMergedSegment(mergedSegments, segment);
  }

  return mergedSegments;
}

function shouldAbsorbJitterMiddleSegment(
  previousSegment: SpeakerOffsetSegment,
  middleSegment: SpeakerOffsetSegment,
  nextSegment: SpeakerOffsetSegment,
): boolean {
  if (segmentDurationSeconds(middleSegment) >= LAYOUT_JITTER_MAX_DURATION_SECONDS) {
    return false;
  }

  if (
    previousSegment.layoutType === "split-screen" &&
    middleSegment.layoutType === "single" &&
    nextSegment.layoutType === "split-screen"
  ) {
    return splitOffsetsAreSimilar(previousSegment, nextSegment);
  }

  if (
    previousSegment.layoutType === "single" &&
    middleSegment.layoutType === "split-screen" &&
    nextSegment.layoutType === "single"
  ) {
    return segmentsHaveSimilarFraming(previousSegment, nextSegment);
  }

  return false;
}

function buildJitterMergedSegment(
  previousSegment: SpeakerOffsetSegment,
  middleSegment: SpeakerOffsetSegment,
  nextSegment: SpeakerOffsetSegment,
): SpeakerOffsetSegment {
  const previousDuration = segmentDurationSeconds(previousSegment);
  const middleDuration = segmentDurationSeconds(middleSegment);
  const nextDuration = segmentDurationSeconds(nextSegment);
  const leadingDuration = previousDuration + middleDuration;

  if (previousSegment.layoutType === "split-screen" && nextSegment.layoutType === "split-screen") {
    return {
      startSeconds: previousSegment.startSeconds,
      endSeconds: nextSegment.endSeconds,
      layoutType: "split-screen",
      offsetPercentX: 0,
      leftOffsetPercentX: blendScalarByDuration(
        resolveSplitLeftOffset(previousSegment),
        previousDuration,
        resolveSplitLeftOffset(nextSegment),
        nextDuration,
      ),
      rightOffsetPercentX: blendScalarByDuration(
        resolveSplitRightOffset(previousSegment),
        previousDuration,
        resolveSplitRightOffset(nextSegment),
        nextDuration,
      ),
    };
  }

  return {
    startSeconds: previousSegment.startSeconds,
    endSeconds: nextSegment.endSeconds,
    layoutType: "single",
    offsetPercentX: blendScalarByDuration(
      previousSegment.offsetPercentX,
      leadingDuration,
      nextSegment.offsetPercentX,
      nextDuration,
    ),
  };
}

/** Absorbs brief split ↔ single toggles into the surrounding continuous shot. */
export function smoothLayoutJitter(segments: SpeakerOffsetSegment[]): SpeakerOffsetSegment[] {
  if (segments.length < 3) {
    return segments;
  }

  const smoothedSegments: SpeakerOffsetSegment[] = [];
  let index = 0;

  while (index < segments.length) {
    if (index + 2 < segments.length) {
      const previousSegment = segments[index];
      const middleSegment = segments[index + 1];
      const nextSegment = segments[index + 2];

      if (shouldAbsorbJitterMiddleSegment(previousSegment, middleSegment, nextSegment)) {
        smoothedSegments.push(buildJitterMergedSegment(previousSegment, middleSegment, nextSegment));
        index += 3;
        continue;
      }
    }

    smoothedSegments.push(segments[index]);
    index += 1;
  }

  return smoothedSegments;
}

/**
 * Collapses per-phrase detections into continuous camera-shot segments.
 * 1. Merge visually similar neighbors.
 * 2. Absorb brief layout jitter.
 * 3. Merge again after jitter cleanup.
 */
export function mergeSpeakerOffsetSegments(segments: SpeakerOffsetSegment[]): SpeakerOffsetSegment[] {
  if (segments.length <= 1) {
    return segments;
  }

  const rawCount = segments.length;
  const afterSimilarityMerge = mergeSimilarContinuousSegments(segments);
  const afterJitterSmooth = smoothLayoutJitter(afterSimilarityMerge);
  const mergedSegments = mergeSimilarContinuousSegments(afterJitterSmooth);

  if (mergedSegments.length < rawCount) {
    console.info(
      `[FaceTracker] Merge pass: ${rawCount} raw phrase segments → ${mergedSegments.length} continuous shot segments`,
    );
  }

  return mergedSegments;
}

function deriveLegacyOffsetPercentX(segments: SpeakerOffsetSegment[]): number {
  const singleSegments = segments.filter((segment) => segment.layoutType === "single");
  if (singleSegments.length === 0) {
    return 0;
  }

  const amplifiedOffsets = singleSegments.map((segment) =>
    amplifySpeakerOffsetPercentX(segment.offsetPercentX),
  );
  const baseline = amplifiedOffsets[0];

  if (amplifiedOffsets.every((offset) => Math.abs(offset - baseline) <= 0.5)) {
    return singleSegments[0].offsetPercentX;
  }

  return 0;
}

function formatSegmentLog(segment: SpeakerOffsetSegment): string {
  if (segment.layoutType === "split-screen") {
    const leftRaw = segment.leftOffsetPercentX ?? mapNormalizedFaceCenterXToOffsetPercentX(SPLIT_SCREEN_DEFAULT_LEFT_CENTER_X);
    const rightRaw = segment.rightOffsetPercentX ?? mapNormalizedFaceCenterXToOffsetPercentX(SPLIT_SCREEN_DEFAULT_RIGHT_CENTER_X);
    return (
      `split-screen top=${amplifySpeakerOffsetPercentX(leftRaw)}% ` +
      `bottom=${amplifySpeakerOffsetPercentX(rightRaw)}%`
    );
  }

  return `single ${segment.offsetPercentX}% raw (${amplifySpeakerOffsetPercentX(segment.offsetPercentX)}% amplified)`;
}

function buildSpeakerOffsetDetectionResult(
  segments: SpeakerOffsetSegment[],
  durationSeconds: number,
): SpeakerOffsetDetectionResult {
  const normalizedSegments = normalizeSpeakerOffsetSegments(segments, durationSeconds);
  const detectionsFound = normalizedSegments.filter(
    (segment) =>
      segment.layoutType === "split-screen" ||
      segment.offsetPercentX !== 0,
  ).length;

  for (const segment of normalizedSegments) {
    console.info(
      `[FaceTracker] Segment ${segment.startSeconds.toFixed(1)}s–${segment.endSeconds.toFixed(1)}s → ${formatSegmentLog(segment)}`,
    );
  }

  const legacyOffset = deriveLegacyOffsetPercentX(normalizedSegments);
  console.info(
    `[FaceTracker] Per-segment tracking complete: ${detectionsFound}/${normalizedSegments.length} segments with pan`,
  );

  return {
    segments: normalizedSegments,
    offsetPercentX: legacyOffset,
    sampledSegmentCount: normalizedSegments.length,
    detectionsFound,
  };
}

/**
 * Samples each phrase/shot segment and returns per-interval horizontal pan offsets.
 * Segments without a clear single face default to center (0%) to avoid clipping wide shots.
 */
export async function detectSpeakerOffsetSegments(
  video: HTMLVideoElement,
  options?: {
    phraseStarts?: number[];
    durationSeconds?: number;
  },
): Promise<SpeakerOffsetDetectionResult> {
  const emptyResult = (durationSeconds: number): SpeakerOffsetDetectionResult => ({
    segments:
      durationSeconds > 0
        ? [createDefaultSpeakerOffsetSegment(0, durationSeconds)]
        : [],
    offsetPercentX: 0,
    sampledSegmentCount: 0,
    detectionsFound: 0,
  });

  if (!isBrowserEnvironment()) {
    return emptyResult(0);
  }

  const durationSeconds = options?.durationSeconds ?? video.duration;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return emptyResult(0);
  }

  console.info("[FaceTracker] Detecting face per segment...");

  let faceapi: FaceApiModule;
  try {
    faceapi = await ensureFaceModelsLoaded();
  } catch (error: unknown) {
    console.warn("[FaceTracker] Unable to load face detection models; using center crop.", error);
    return emptyResult(durationSeconds);
  }

  const segmentRanges = buildSpeakerOffsetSegmentRanges(options?.phraseStarts ?? [], durationSeconds);
  const originalTime = video.currentTime;
  const wasPaused = video.paused;
  const segments: SpeakerOffsetSegment[] = [];

  try {
    if (!wasPaused) {
      video.pause();
    }

    for (const range of segmentRanges) {
      const sampleTime =
        range.startSeconds + Math.max(0.05, (range.endSeconds - range.startSeconds) * 0.35);

      try {
        const layout = await detectSegmentLayout(faceapi, video, sampleTime);
        segments.push({
          startSeconds: range.startSeconds,
          endSeconds: range.endSeconds,
          layoutType: layout.layoutType,
          offsetPercentX: layout.offsetPercentX,
          leftOffsetPercentX: layout.leftOffsetPercentX,
          rightOffsetPercentX: layout.rightOffsetPercentX,
        });
      } catch (error: unknown) {
        if (isCanvasSecurityError(error)) {
          logCanvasSecurityFallback(error);
          console.info("[FaceTracker] Result offset: 0% (CORS fallback)");
          return emptyResult(durationSeconds);
        }

        console.warn("[FaceTracker] Segment sampling failed; using center for segment.", error);
        segments.push(createDefaultSpeakerOffsetSegment(range.startSeconds, range.endSeconds));
      }
    }
  } finally {
    await waitForVideoSeek(video, originalTime);
    if (!wasPaused) {
      void video.play().catch(() => undefined);
    }
  }

  if (segments.length === 0) {
    console.info("[FaceTracker] Result offset: 0% (no segments)");
    return emptyResult(durationSeconds);
  }

  const mergedSegments = mergeSpeakerOffsetSegments(segments);
  return buildSpeakerOffsetDetectionResult(mergedSegments, durationSeconds);
}

/**
 * @deprecated Prefer `detectSpeakerOffsetSegments` for per-phrase pan tracking.
 * Returns a legacy single-offset result derived from segment analysis.
 */
export async function detectSpeakerOffsetPercentX(
  video: HTMLVideoElement,
  options?: {
    phraseStarts?: number[];
    durationSeconds?: number;
  },
): Promise<FaceDetectionResult> {
  const fallback = createCenterCropFallback();

  if (!isBrowserEnvironment()) {
    return fallback;
  }

  const durationSeconds = options?.durationSeconds ?? video.duration;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return fallback;
  }

  const segmentResult = await detectSpeakerOffsetSegments(video, options);
  const faceSegments = segmentResult.segments.filter(
    (segment) => segment.layoutType === "single" && segment.offsetPercentX !== 0,
  );

  if (faceSegments.length === 0) {
    return createCenterCropFallback(segmentResult.sampledSegmentCount, "none", durationSeconds);
  }

  const normalizedCenterX =
    faceSegments.reduce((sum, segment) => {
      const rawCenter = 0.5 - segment.offsetPercentX / 100;
      return sum + rawCenter;
    }, 0) / faceSegments.length;

  return {
    normalizedCenterX: Number(normalizedCenterX.toFixed(4)),
    offsetPercentX: segmentResult.offsetPercentX,
    confidence: Number((faceSegments.length / segmentResult.sampledSegmentCount).toFixed(2)),
    sampledFrameCount: segmentResult.sampledSegmentCount,
    detectionsFound: segmentResult.detectionsFound,
    detectionSource: "face",
    segments: segmentResult.segments,
  };
}
