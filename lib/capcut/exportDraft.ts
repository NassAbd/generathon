import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildCapCutSubtitleSegmentPlans,
  CAPCUT_EXPORT_AUDIO,
  getCapCutTextMaterialProps,
  getSubtitlePreset,
  sanitizeCapCutSubtitleSegmentPlans,
  type CapCutSubtitleSegmentPlan,
  type SubtitleStylePreset,
} from "@/lib/capcut/presets";
import {
  CAPCUT_CANVAS_HEIGHT,
  CAPCUT_CANVAS_RATIO,
  CAPCUT_CANVAS_WIDTH,
  computeSpeakerTrackingLayout,
  needsVerticalCropReframe,
  normalizeSpeakerOffsetSegments,
  type SpeakerOffsetSegment,
  type SpeakerTrackingLayout,
} from "@/lib/capcut/video-effects";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

const MICROSECONDS = 1_000_000;

type DraftRecord = Record<string, unknown>;
type Timerange = { start: number; duration: number };

export interface CapCutExportInput {
  projectId: string;
  projectName: string;
  videoUrl: string;
  transcript: TranscriptData;
  durationSeconds: number;
  theme: ThemeId;
  /** Source pixel width; defaults to 1080 (vertical-first). */
  sourceVideoWidth?: number;
  /** Source pixel height; defaults to 1920 (vertical-first). */
  sourceVideoHeight?: number;
  /** Face-tracked horizontal pan (-50 … +50) for vertical crop reframing. */
  speakerOffsetPercentX?: number;
  /** Per-phrase/shot pan segments; splits the main video track when offsets differ. */
  speakerOffsetSegments?: SpeakerOffsetSegment[];
  /** Deterministically assigned BGM URL (modulo catalog). Falls back to default. */
  bgmUrl?: string;
  /**
   * When true (default for local write), mix video+BGM with FFmpeg sidechain ducking
   * and omit the separate CapCut BGM track to avoid double music.
   */
  applySidechainDucking?: boolean;
}

export interface CapCutDraftBundle {
  draftContent: CapCutDraftContent;
  readme: string;
}

export interface CapCutDraftContent {
  id: string;
  name: string;
  duration: number;
  fps: number;
  version: number;
  create_time: number;
  update_time: number;
  canvas_config: {
    width: number;
    height: number;
    ratio: string;
  };
  ratio: string;
  platform: {
    app_source: "cc";
    app_version: string;
    os: string;
  };
  tracks: DraftRecord[];
  materials: DraftRecord;
  extra_info: DraftRecord;
  free_render_index_mode_on: false;
}

interface CompanionBundle {
  ids: string[];
  materials: Array<{ bucket: string; data: DraftRecord }>;
}

function uuid(): string {
  return crypto.randomUUID();
}

function toMicroseconds(seconds: number): number {
  return Math.max(0, Math.round(seconds * MICROSECONDS));
}

function nowMicroseconds(): number {
  return Math.round(Date.now() * 1000);
}

function createEmptyMaterials(): DraftRecord {
  return {
    videos: [],
    audios: [],
    texts: [],
    stickers: [],
    video_effects: [],
    material_animations: [],
    transitions: [],
    chromas: [],
    audio_fades: [],
    audio_effects: [],
    canvases: [],
    speeds: [],
    sound_channel_mappings: [],
    vocal_separations: [],
    placeholder_infos: [],
    material_colors: [],
    smart_crops: [],
    manual_deformations: [],
  };
}

function createTrack(type: "video" | "text" | "audio", name: string): DraftRecord {
  return {
    id: uuid(),
    type,
    name,
    attribute: 0,
    flag: 0,
    is_default_name: false,
    segments: [],
  };
}

function createCompanionMaterials(
  trackType: "text" | "video" | "audio",
  options?: { canvasBlur?: number },
): CompanionBundle {
  const speed: DraftRecord = { id: uuid(), type: "speed", speed: 1, mode: 0, curve_speed: null };
  const placeholder: DraftRecord = {
    id: uuid(),
    type: "placeholder_info",
    error_path: "",
    error_text: "",
    meta_type: "none",
    res_path: "",
    res_text: "",
  };
  const scm: DraftRecord = {
    id: uuid(),
    type: "none",
    audio_channel_mapping: 0,
    is_config_open: false,
  };
  const vocal: DraftRecord = {
    id: uuid(),
    type: "vocal_separation",
    choice: 0,
    enter_from: "",
    final_algorithm: "",
    production_path: "",
    removed_sounds: [],
    time_range: null,
  };

  const bundle: CompanionBundle = {
    ids: [String(speed.id), String(placeholder.id), String(scm.id), String(vocal.id)],
    materials: [
      { bucket: "speeds", data: speed },
      { bucket: "placeholder_infos", data: placeholder },
      { bucket: "sound_channel_mappings", data: scm },
      { bucket: "vocal_separations", data: vocal },
    ],
  };

  if (trackType === "video") {
    const canvas: DraftRecord = {
      id: uuid(),
      type: "canvas_color",
      blur: options?.canvasBlur ?? 0,
      color: "#000000",
      image: "",
      image_id: "",
      image_name: "",
      source_platform: 0,
      team_id: "",
    };
    const materialColor: DraftRecord = {
      id: uuid(),
      type: "material_color",
      gradient_angle: 90,
      gradient_colors: [],
      gradient_percents: [],
      height: 0,
      is_color_clip: false,
      is_gradient: false,
      solid_color: "",
      width: 0,
    };
    bundle.ids.push(String(canvas.id), String(materialColor.id));
    bundle.materials.push(
      { bucket: "canvases", data: canvas },
      { bucket: "material_colors", data: materialColor },
    );
  }

  return bundle;
}

function registerCompanions(materials: DraftRecord, companions: CompanionBundle): void {
  for (const entry of companions.materials) {
    const bucket = materials[entry.bucket];
    if (!Array.isArray(bucket)) {
      materials[entry.bucket] = [];
    }
    (materials[entry.bucket] as DraftRecord[]).push(entry.data);
  }
}

function baseSegment(
  segmentId: string,
  materialId: string,
  trackId: string,
  timerange: Timerange,
  companionIds: string[],
  renderIndex: number,
): DraftRecord {
  return {
    id: segmentId,
    material_id: materialId,
    raw_segment_id: trackId,
    target_timerange: { ...timerange },
    source_timerange: { start: 0, duration: timerange.duration },
    speed: 1,
    volume: 1,
    visible: true,
    reverse: false,
    clip: {
      alpha: 1,
      rotation: 0,
      scale: { x: 1, y: 1 },
      transform: { x: 0, y: 0 },
      flip: { horizontal: false, vertical: false },
    },
    render_index: renderIndex,
    render_uniform_index: -1,
    track_render_index: 0,
    track_attribute: 0,
    extra_material_refs: companionIds,
    common_keyframes: [],
    keyframe_refs: [],
    uniform_scale: { on: true, value: 1 },
    group_id: "",
  };
}

function applyTextSegmentLayout(textSegment: DraftRecord, preset: SubtitleStylePreset): void {
  const textClip = textSegment.clip as DraftRecord;
  textClip.scale = { x: preset.textScale, y: preset.textScale };
  // Lower-center on 9:16 canvas (short-form karaoke default).
  textClip.transform = { x: 0.0, y: preset.subtitleY };
  textClip.rotation = 0.0;
  textSegment.uniform_scale = { on: true, value: preset.textScale };
}

/**
 * Places every subtitle on ONE text track with non-overlapping timeranges.
 * Shared track_render_index / track_attribute prevent CapCut from auto-stacking.
 */
function appendSubtitleSegmentsToSingleTrack(
  textTrack: DraftRecord,
  materials: DraftRecord,
  plans: CapCutSubtitleSegmentPlan[],
  preset: SubtitleStylePreset,
): void {
  const trackId = String(textTrack.id);
  textTrack.type = "text";
  textTrack.attribute = 0;
  textTrack.flag = 0;
  textTrack.segments = [];

  const TEXT_TRACK_RENDER_INDEX = 0;
  const TEXT_SEGMENT_RENDER_INDEX = 15000;

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index];
    const startMicros = plan.startMicros;
    let durationMicros = plan.durationMicros;

    if (index + 1 < plans.length) {
      const nextStart = plans[index + 1].startMicros;
      if (startMicros + durationMicros > nextStart) {
        durationMicros = Math.max(0, nextStart - startMicros);
      }
    }

    if (durationMicros <= 0) {
      continue;
    }

    const textMaterialId = uuid();
    pushMaterial(materials, "texts", {
      id: textMaterialId,
      ...getCapCutTextMaterialProps(plan.phraseWords, preset),
    });

    const textCompanions = createCompanionMaterials("text");
    registerCompanions(materials, textCompanions);
    const textSegment = baseSegment(
      uuid(),
      textMaterialId,
      trackId,
      { start: startMicros, duration: durationMicros },
      textCompanions.ids,
      TEXT_SEGMENT_RENDER_INDEX,
    );
    textSegment.target_timerange = { start: startMicros, duration: durationMicros };
    textSegment.source_timerange = { start: 0, duration: durationMicros };
    textSegment.track_render_index = TEXT_TRACK_RENDER_INDEX;
    textSegment.track_attribute = 0;
    textSegment.raw_segment_id = trackId;
    applyTextSegmentLayout(textSegment, preset);
    (textTrack.segments as DraftRecord[]).push(textSegment);
  }
}

function logTextSegmentScaleSample(draft: CapCutDraftContent): void {
  const textTrack = draft.tracks.find((track) => track.type === "text");
  if (!textTrack || !Array.isArray(textTrack.segments) || textTrack.segments.length === 0) {
    return;
  }

  const sampleSegment = textTrack.segments[0] as DraftRecord;
  const materialId = sampleSegment.material_id;
  const textMaterials = draft.materials.texts;
  const sampleMaterial =
    Array.isArray(textMaterials) && typeof materialId === "string"
      ? (textMaterials as DraftRecord[]).find((material) => material.id === materialId)
      : undefined;

  const clip = sampleSegment.clip as DraftRecord | undefined;
  const clipScale = clip?.scale as DraftRecord | undefined;

  console.warn("[CapCut export] Text segment scale sample:", {
    font_size: sampleMaterial?.font_size,
    clip_scale_x: clipScale?.x,
    clip_scale_y: clipScale?.y,
    uniform_scale: sampleSegment.uniform_scale,
    segment_count: textTrack.segments.length,
  });
}

interface TimedVideoSegmentOptions {
  sourceStartMicros?: number;
  volume?: number;
  renderIndex?: number;
}

/** CapCut export uses single-track framing; wide/split shots fall back to center crop. */
function resolveExportOffsetPercentX(segment: SpeakerOffsetSegment): number {
  if (segment.layoutType === "split-screen") {
    return 0;
  }

  return segment.offsetPercentX;
}

function applyMainVideoClipLayout(
  videoSegment: DraftRecord,
  layout: SpeakerTrackingLayout,
): void {
  const mainVideoClip = videoSegment.clip as DraftRecord;
  mainVideoClip.alpha = 1;
  mainVideoClip.transform = {
    x: layout.capcutTransformX,
    y: 0,
  };
  mainVideoClip.scale = {
    x: layout.coverScale,
    y: layout.coverScale,
  };
  videoSegment.visible = true;
  videoSegment.volume = 1;
  videoSegment.uniform_scale = { on: true, value: layout.coverScale };
}

function appendTimedVideoSegment(
  videoTrack: DraftRecord,
  materials: DraftRecord,
  videoMaterialId: string,
  startMicros: number,
  segmentDurationMicros: number,
  applyLayout: (segment: DraftRecord) => void,
  options: TimedVideoSegmentOptions = {},
): void {
  const sourceStartMicros = options.sourceStartMicros ?? startMicros;
  const renderIndex = options.renderIndex ?? 14000;

  const videoCompanions = createCompanionMaterials("video");
  registerCompanions(materials, videoCompanions);

  const companionIds = [...videoCompanions.ids];
  const videoSegment = baseSegment(
    uuid(),
    videoMaterialId,
    String(videoTrack.id),
    { start: startMicros, duration: segmentDurationMicros },
    companionIds,
    renderIndex,
  );
  videoSegment.target_timerange = { start: startMicros, duration: segmentDurationMicros };
  videoSegment.source_timerange = { start: sourceStartMicros, duration: segmentDurationMicros };
  if (options.volume !== undefined) {
    videoSegment.volume = options.volume;
  }
  applyLayout(videoSegment);
  (videoTrack.segments as DraftRecord[]).push(videoSegment);
}

function appendMainVideoSegments(
  mainVideoTrack: DraftRecord,
  materials: DraftRecord,
  videoMaterialId: string,
  sourceVideoWidth: number,
  sourceVideoHeight: number,
  durationSeconds: number,
  durationMicros: number,
  speakerOffsetSegments: SpeakerOffsetSegment[] | undefined,
  legacySpeakerOffsetPercentX: number | undefined,
): SpeakerTrackingLayout {
  const normalizedSegments = normalizeSpeakerOffsetSegments(speakerOffsetSegments ?? [], durationSeconds);
  const needsReframe = needsVerticalCropReframe(sourceVideoWidth, sourceVideoHeight);

  if (!needsReframe || normalizedSegments.length === 0) {
    const layout = computeSpeakerTrackingLayout(
      sourceVideoWidth,
      sourceVideoHeight,
      legacySpeakerOffsetPercentX ?? 0,
    );
    appendTimedVideoSegment(
      mainVideoTrack,
      materials,
      videoMaterialId,
      0,
      durationMicros,
      (segment) => applyMainVideoClipLayout(segment, layout),
    );
    return layout;
  }

  let referenceLayout = computeSpeakerTrackingLayout(sourceVideoWidth, sourceVideoHeight, 0);

  for (const segment of normalizedSegments) {
    const startMicros = toMicroseconds(segment.startSeconds);
    const segmentDurationMicros = toMicroseconds(segment.endSeconds - segment.startSeconds);
    const layout = computeSpeakerTrackingLayout(
      sourceVideoWidth,
      sourceVideoHeight,
      resolveExportOffsetPercentX(segment),
    );
    referenceLayout = layout;

    appendTimedVideoSegment(
      mainVideoTrack,
      materials,
      videoMaterialId,
      startMicros,
      segmentDurationMicros,
      (videoSegment) => applyMainVideoClipLayout(videoSegment, layout),
    );
  }

  return referenceLayout;
}

function defaultCrop(): DraftRecord {
  return {
    lower_left_x: 0,
    lower_left_y: 1,
    lower_right_x: 1,
    lower_right_y: 1,
    upper_left_x: 0,
    upper_left_y: 0,
    upper_right_x: 1,
    upper_right_y: 0,
  };
}

function assetRelativePath(url: string, kind: "video" | "audio"): string {
  try {
    const filename = new URL(url).pathname.split("/").pop() ?? `${kind}.bin`;
    return `assets/${kind}/${filename}`;
  } catch {
    return `assets/${kind}/media.bin`;
  }
}

function absoluteAssetPath(draftFolderPath: string, kind: "video" | "audio", filename: string): string {
  return path.join(draftFolderPath, "assets", kind, filename);
}

interface MediaDownloadItem {
  url: string;
  kind: "video" | "audio";
  filename: string;
  critical: boolean;
}

export interface MediaDownloadSkip {
  url: string;
  filename: string;
  kind: "video" | "audio";
  reason: string;
}

export interface MediaDownloadSummary {
  downloadedCount: number;
  skipped: MediaDownloadSkip[];
}

function pushAudioMaterial(
  materials: DraftRecord,
  options: {
    url: string;
    filename: string;
    durationMicros: number;
  },
): string {
  const audioMaterialId = uuid();
  pushMaterial(materials, "audios", {
    id: audioMaterialId,
    path: assetRelativePath(options.url, "audio"),
    name: options.filename,
    duration: options.durationMicros,
    type: "sound",
    category_id: "",
    category_name: "local",
    check_flag: 1,
    music_id: "",
    request_id: "",
    source_platform: 0,
    team_id: "",
    text_id: "",
    tone_category_id: "",
    tone_category_name: "",
    tone_effect_id: "",
    tone_effect_name: "",
    tone_platform: "",
    tone_second_category_id: "",
    tone_second_category_name: "",
    tone_speaker: "",
    tone_type: "",
    wave_points: [],
  });
  return audioMaterialId;
}

function appendAudioSegment(
  materials: DraftRecord,
  audioTrack: DraftRecord,
  options: {
    url: string;
    startMicros: number;
    durationMicros: number;
    materialDurationMicros: number;
    volume: number;
    renderIndex: number;
    filenameFallback?: string;
  },
): void {
  const filename = filenameFromUrl(options.url, options.filenameFallback ?? "audio.mp3");
  const audioMaterialId = pushAudioMaterial(materials, {
    url: options.url,
    filename,
    durationMicros: options.materialDurationMicros,
  });

  const audioCompanions = createCompanionMaterials("audio");
  registerCompanions(materials, audioCompanions);
  const audioSegment = baseSegment(
    uuid(),
    audioMaterialId,
    String(audioTrack.id),
    { start: options.startMicros, duration: options.durationMicros },
    audioCompanions.ids,
    options.renderIndex,
  );
  audioSegment.target_timerange = {
    start: options.startMicros,
    duration: options.durationMicros,
  };
  audioSegment.source_timerange = { start: 0, duration: options.durationMicros };
  audioSegment.clip = null;
  // CapCut reads segment.volume (0–1 linear). Also set last_nonzero_volume so the
  // UI slider opens at ~12–15% instead of snapping back to 100%.
  audioSegment.volume = options.volume;
  audioSegment.last_nonzero_volume = options.volume;
  (audioTrack.segments as DraftRecord[]).push(audioSegment);
}

function collectMediaDownloadItems(projectData: CapCutProjectData): MediaDownloadItem[] {
  const seenUrls = new Set<string>();
  const items: MediaDownloadItem[] = [];

  const addItem = (url: string | undefined, kind: "video" | "audio", critical = false): void => {
    if (!url || seenUrls.has(url)) {
      return;
    }

    seenUrls.add(url);
    items.push({
      url,
      kind,
      filename: filenameFromUrl(url, kind === "video" ? "media.bin" : "sfx.mp3"),
      critical,
    });
  };

  addItem(projectData.videoUrl, "video", true);
  addItem(projectData.bgmUrl ?? CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL, "audio");

  return items;
}

async function downloadUrlToFile(url: string, destPath: string): Promise<void> {
  if (await pathExists(destPath)) {
    return;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
}

async function downloadDraftMedia(
  draftFolderPath: string,
  projectData: CapCutProjectData,
): Promise<MediaDownloadSummary> {
  const items = collectMediaDownloadItems(projectData);
  const skipped: MediaDownloadSkip[] = [];
  let downloadedCount = 0;

  await Promise.all(
    items.map(async (item) => {
      const destDir = path.join(draftFolderPath, "assets", item.kind);
      const destPath = path.join(destDir, item.filename);

      try {
        await mkdir(destDir, { recursive: true });
        await downloadUrlToFile(item.url, destPath);
        downloadedCount += 1;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Unknown download error";
        console.warn(
          `[CapCut export] Skipped media download (${item.kind}/${item.filename}): ${reason} — ${item.url}`,
        );
        skipped.push({
          url: item.url,
          filename: item.filename,
          kind: item.kind,
          reason,
        });

        if (item.critical) {
          throw new Error(
            `Critical media download failed for source video "${item.filename}" (${reason}). URL: ${item.url}`,
          );
        }
      }
    }),
  );

  return { downloadedCount, skipped };
}

async function applyAbsoluteMediaPaths(
  draft: CapCutDraftContent,
  draftFolderPath: string,
): Promise<void> {
  const materials = draft.materials;

  const videos = materials.videos;
  if (Array.isArray(videos)) {
    for (const material of videos as DraftRecord[]) {
      const filename = getVideoMaterialFilename(material);

      if (!filename) {
        continue;
      }

      const absolutePath = absoluteAssetPath(draftFolderPath, "video", filename);
      if (await pathExists(absolutePath)) {
        material.path = absolutePath;
        material.media_path = absolutePath;
      }
    }
  }

  const audios = materials.audios;
  if (Array.isArray(audios)) {
    for (const material of audios as DraftRecord[]) {
      const filename = getAudioMaterialFilename(material);

      if (!filename) {
        continue;
      }

      const absolutePath = absoluteAssetPath(draftFolderPath, "audio", filename);
      if (await pathExists(absolutePath)) {
        material.path = absolutePath;
      }
    }
  }
}

function getVideoMaterialFilename(material: DraftRecord): string | null {
  if (typeof material.material_name === "string" && material.material_name.length > 0) {
    return material.material_name;
  }

  if (typeof material.path === "string" && material.path.length > 0) {
    return path.basename(material.path);
  }

  return null;
}

function getAudioMaterialFilename(material: DraftRecord): string | null {
  if (typeof material.name === "string" && material.name.length > 0) {
    return material.name;
  }

  if (typeof material.path === "string" && material.path.length > 0) {
    return path.basename(material.path);
  }

  return null;
}

async function mediaMaterialExistsOnDisk(
  draftFolderPath: string,
  kind: "video" | "audio",
  material: DraftRecord,
): Promise<boolean> {
  const filename = kind === "video" ? getVideoMaterialFilename(material) : getAudioMaterialFilename(material);
  if (!filename) {
    return false;
  }

  return pathExists(absoluteAssetPath(draftFolderPath, kind, filename));
}

async function filterDraftToExistingMedia(
  draft: CapCutDraftContent,
  draftFolderPath: string,
): Promise<{ removedSegmentCount: number; removedMaterialCount: number }> {
  const removedMaterialIds = new Set<string>();
  let removedSegmentCount = 0;

  const videos = draft.materials.videos;
  if (Array.isArray(videos)) {
    for (const material of videos as DraftRecord[]) {
      if (typeof material.id !== "string") {
        continue;
      }

      if (!(await mediaMaterialExistsOnDisk(draftFolderPath, "video", material))) {
        removedMaterialIds.add(material.id);
      }
    }
  }

  const audios = draft.materials.audios;
  if (Array.isArray(audios)) {
    for (const material of audios as DraftRecord[]) {
      if (typeof material.id !== "string") {
        continue;
      }

      if (!(await mediaMaterialExistsOnDisk(draftFolderPath, "audio", material))) {
        removedMaterialIds.add(material.id);
      }
    }
  }

  for (const track of draft.tracks as DraftRecord[]) {
    if (!Array.isArray(track.segments)) {
      continue;
    }

    const keptSegments: DraftRecord[] = [];
    for (const segment of track.segments as DraftRecord[]) {
      const materialId = segment.material_id;
      if (typeof materialId === "string" && removedMaterialIds.has(materialId)) {
        removedSegmentCount += 1;
        continue;
      }

      keptSegments.push(segment);
    }

    track.segments = keptSegments;
  }

  const referencedMaterialIds = new Set<string>();
  for (const track of draft.tracks as DraftRecord[]) {
    if (!Array.isArray(track.segments)) {
      continue;
    }

    for (const segment of track.segments as DraftRecord[]) {
      const materialId = segment.material_id;
      if (typeof materialId === "string") {
        referencedMaterialIds.add(materialId);
      }

      const refs = segment.extra_material_refs;
      if (Array.isArray(refs)) {
        for (const ref of refs) {
          if (typeof ref === "string") {
            referencedMaterialIds.add(ref);
          }
        }
      }
    }
  }

  let removedMaterialCount = 0;
  for (const [bucket, items] of Object.entries(draft.materials)) {
    if (!Array.isArray(items)) {
      continue;
    }

    const keptItems = (items as DraftRecord[]).filter((material) => {
      if (typeof material.id !== "string") {
        return true;
      }

      const keep = referencedMaterialIds.has(material.id);
      if (!keep) {
        removedMaterialCount += 1;
      }

      return keep;
    });

    draft.materials[bucket] = keptItems;
  }

  draft.tracks = (draft.tracks as DraftRecord[]).filter((track) => {
    if (track.type === "text") {
      return true;
    }

    return Array.isArray(track.segments) && track.segments.length > 0;
  });

  if (removedSegmentCount > 0) {
    console.warn(
      `[CapCut export] Removed ${removedSegmentCount} segment(s) and ${removedMaterialCount} material(s) referencing missing media files.`,
    );
  }

  validateDraftReferences(draft);

  return { removedSegmentCount, removedMaterialCount };
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const basename = new URL(url).pathname.split("/").pop();
    return basename && basename.length > 0 ? basename : fallback;
  } catch {
    return fallback;
  }
}

function pushMaterial(materials: DraftRecord, bucket: string, material: DraftRecord): void {
  if (!Array.isArray(materials[bucket])) {
    materials[bucket] = [];
  }
  (materials[bucket] as DraftRecord[]).push(material);
}

function collectMaterialIdsByBucket(materials: DraftRecord): Map<string, Set<string>> {
  const buckets = new Map<string, Set<string>>();

  for (const bucket of ["videos", "audios", "texts", "stickers", "video_effects"] as const) {
    const items = materials[bucket];
    if (!Array.isArray(items)) {
      continue;
    }

    buckets.set(
      bucket,
      new Set(
        (items as DraftRecord[])
          .map((material) => material.id)
          .filter((id): id is string => typeof id === "string"),
      ),
    );
  }

  return buckets;
}

function validateAudioTrackIsolation(draft: CapCutDraftContent): void {
  const materialIdsByBucket = collectMaterialIdsByBucket(draft.materials);
  const audioMaterialIds = materialIdsByBucket.get("audios") ?? new Set<string>();
  const videoMaterialIds = materialIdsByBucket.get("videos") ?? new Set<string>();
  const textMaterialIds = materialIdsByBucket.get("texts") ?? new Set<string>();

  for (const track of draft.tracks as DraftRecord[]) {
    const trackType = String(track.type ?? "");
    const segments = Array.isArray(track.segments) ? (track.segments as DraftRecord[]) : [];

    for (const segment of segments) {
      const materialId = segment.material_id;
      if (typeof materialId !== "string") {
        continue;
      }

      if (trackType === "audio" && !audioMaterialIds.has(materialId)) {
        throw new Error(
          `Draft validation failed: audio track segment references non-audio material ${materialId}`,
        );
      }

      if (trackType === "video" && audioMaterialIds.has(materialId)) {
        throw new Error(
          `Draft validation failed: video track segment references audio material ${materialId}`,
        );
      }

      if (trackType === "video" && !videoMaterialIds.has(materialId)) {
        throw new Error(
          `Draft validation failed: video track segment references non-video material ${materialId}`,
        );
      }

      if (trackType === "text" && !textMaterialIds.has(materialId)) {
        throw new Error(
          `Draft validation failed: text track segment references non-text material ${materialId}`,
        );
      }

      if (trackType !== "audio" && trackType !== "video" && trackType !== "text") {
        if (audioMaterialIds.has(materialId)) {
          throw new Error(
            `Draft validation failed: ${trackType} track segment references audio material ${materialId}`,
          );
        }
      }
    }
  }
}

function validateDraftReferences(draft: CapCutDraftContent): void {
  const materialIds = new Set<string>();

  for (const bucket of Object.values(draft.materials)) {
    if (!Array.isArray(bucket)) continue;
    for (const material of bucket as DraftRecord[]) {
      if (typeof material.id === "string") {
        materialIds.add(material.id);
      }
    }
  }

  for (const track of draft.tracks) {
    const segments = track.segments;
    if (!Array.isArray(segments)) continue;

    for (const segment of segments as DraftRecord[]) {
      const materialId = segment.material_id;
      if (typeof materialId !== "string" || !materialIds.has(materialId)) {
        throw new Error(`Draft validation failed: segment references missing material_id ${String(materialId)}`);
      }

      const refs = segment.extra_material_refs;
      if (Array.isArray(refs)) {
        for (const ref of refs) {
          if (typeof ref === "string" && !materialIds.has(ref)) {
            throw new Error(`Draft validation failed: segment references missing companion id ${ref}`);
          }
        }
      }
    }
  }

  validateAudioTrackIsolation(draft);
}

export function buildCapCutDraft(input: CapCutExportInput): CapCutDraftBundle {
  const draftId = uuid();
  const durationMicros = toMicroseconds(input.durationSeconds);
  const timestamp = nowMicroseconds();

  const materials = createEmptyMaterials();
  const sourceVideoWidth = input.sourceVideoWidth ?? 1080;
  const sourceVideoHeight = input.sourceVideoHeight ?? 1920;

  const videoTrack = createTrack("video", "Main Video");
  const textTrack = createTrack("text", "Kinetic Subtitles");
  const sfxTrack = createTrack("audio", "SFX");
  const bgmTrack = createTrack("audio", "Background Music");

  const videoMaterialId = uuid();
  const videoFilename = filenameFromUrl(input.videoUrl, "source-video.mp4");
  pushMaterial(materials, "videos", {
    id: videoMaterialId,
    type: "video",
    path: assetRelativePath(input.videoUrl, "video"),
    material_name: videoFilename,
    duration: durationMicros,
    width: sourceVideoWidth,
    height: sourceVideoHeight,
    category_id: "",
    category_name: "local",
    check_flag: 7,
    crop: defaultCrop(),
    has_audio: true,
    extra_type_option: 0,
    formula_id: "",
    freeze: null,
    intensifies_audio_path: "",
    intensifies_path: "",
    is_ai_generate_content: false,
    is_copyright: false,
    is_text_edit_overdub: false,
    is_unified_beauty_mode: false,
    local_id: "",
    local_material_id: "",
    material_url: input.videoUrl,
    media_path: "",
    object_locked: null,
    origin_material_id: "",
    request_id: "",
    reverse_path: "",
    source_platform: 0,
    team_id: "",
    stable: { matrix_path: "", stable_level: 0, time_range: { duration: 0, start: 0 } },
    video_algorithm: {
      algorithms: [],
      deflicker: null,
      motion_blur_config: null,
      noise_reduction: null,
      path: "",
      quality_enhance: null,
      time_range: null,
    },
  });

  const speakerLayout = appendMainVideoSegments(
    videoTrack,
    materials,
    videoMaterialId,
    sourceVideoWidth,
    sourceVideoHeight,
    input.durationSeconds,
    durationMicros,
    input.speakerOffsetSegments,
    input.speakerOffsetPercentX,
  );

  const subtitlePreset = getSubtitlePreset(input.theme);
  const subtitleSegmentPlans = sanitizeCapCutSubtitleSegmentPlans(
    buildCapCutSubtitleSegmentPlans(input.transcript, subtitlePreset, toMicroseconds),
  );

  appendSubtitleSegmentsToSingleTrack(
    textTrack,
    materials,
    subtitleSegmentPlans,
    subtitlePreset,
  );

  // SFX track intentionally left empty — export focuses on framing + subtitles.

  const bgmUrl = input.bgmUrl ?? CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL;

  // Always expose BGM as its own CapCut timeline audio track so users can see
  // and adjust it in the editor (do not omit when FFmpeg ducking was used).
  appendAudioSegment(materials, bgmTrack, {
    url: bgmUrl,
    startMicros: 0,
    durationMicros: durationMicros,
    materialDurationMicros: durationMicros,
    volume: CAPCUT_EXPORT_AUDIO.bgmVolume,
    renderIndex: 10500,
    filenameFallback: filenameFromUrl(bgmUrl, "cartoon.mp3"),
  });

  const tracks = [videoTrack, textTrack, sfxTrack, bgmTrack];

  const draftContent: CapCutDraftContent = {
    id: draftId,
    name: input.projectName,
    duration: durationMicros,
    fps: 30.0,
    version: 360000,
    create_time: timestamp,
    update_time: timestamp,
    canvas_config: {
      width: CAPCUT_CANVAS_WIDTH,
      height: CAPCUT_CANVAS_HEIGHT,
      ratio: CAPCUT_CANVAS_RATIO,
    },
    ratio: CAPCUT_CANVAS_RATIO,
    platform: {
      app_source: "cc",
      app_version: "9.0.0",
      os: "mac",
    },
    tracks,
    materials,
    extra_info: {
      created_via: "motion-decorator",
      project_id: input.projectId,
      theme: input.theme,
      bgm_url: bgmUrl,
      sidechain_ducking: input.applySidechainDucking === true,
      separate_bgm_track: true,
    },
    free_render_index_mode_on: false,
  };

  validateDraftReferences(draftContent);

  const readme = [
    "Motion Decorator — CapCut Draft Export",
    "",
    `Project: ${input.projectName}`,
    `Draft ID: ${draftId}`,
    `Theme: ${input.theme}`,
    "",
    "Import instructions (CapCut Desktop):",
    "1. Unzip this folder.",
    "2. Create a new draft in CapCut Desktop and close CapCut.",
    "3. On macOS, replace draft_info.json (and draft_content.json) with this export.",
    "4. Copy media into assets/video and assets/audio using the relative paths in the JSON.",
    "5. Reopen CapCut and relink any missing media if prompted.",
    "",
    "Timeline units: microseconds (1 second = 1,000,000).",
    "Timeline tracks: Main Video, Kinetic Subtitles, Background Music (SFX disabled).",
    speakerLayout.needsReframe
      ? "Video framing: single-track 9:16 crop; wide/split shots export centered (offset 0%)."
      : "Video framing: single-track, native aspect.",
    "Audio mix: separate CapCut BGM track (~12% volume) on its own timeline layer. Keyword SFX generation is disabled.",
    `Assigned BGM: ${bgmUrl}`,
    "Canvas: 1080 x 1920 (9:16).",
  ].join("\n");

  return { draftContent, readme };
}

export interface CapCutProjectData {
  projectId: string;
  projectName: string;
  videoUrl: string;
  transcript: TranscriptData;
  durationSeconds: number;
  theme: ThemeId;
  sourceVideoWidth?: number;
  sourceVideoHeight?: number;
  speakerOffsetPercentX?: number;
  speakerOffsetSegments?: SpeakerOffsetSegment[];
  bgmUrl?: string;
  applySidechainDucking?: boolean;
}

export interface CapCutDirectWriteResult {
  draftId: string;
  draftFolderPath: string;
  draftContentPath: string;
  draftInfoPath: string;
  timelineDraftInfoPath: string | null;
  draftMetaInfoPath: string;
  usedExistingFolder: boolean;
  draftFolderName: string;
  downloadedMediaCount: number;
  skippedMediaDownloads: MediaDownloadSkip[];
  removedMissingMediaSegments: number;
  removedMissingMediaMaterials: number;
  bgmUrl: string;
  sidechainDuckingApplied: boolean;
}

const GENERATED_MATERIAL_BUCKETS = [
  "videos",
  "audios",
  "texts",
  "stickers",
  "video_effects",
  "material_animations",
  "transitions",
  "chromas",
  "audio_fades",
  "audio_effects",
  "canvases",
  "speeds",
  "sound_channel_mappings",
  "vocal_separations",
  "placeholder_infos",
  "material_colors",
  "smart_crops",
  "manual_deformations",
] as const;

const DRAFT_INFO_SEGMENT_BASE: DraftRecord = {
  render_timerange: { start: 0, duration: 0 },
  desc: "",
  state: 0,
  is_loop: false,
  is_tone_modify: false,
  intensifies_audio: false,
  cartoon: false,
  last_nonzero_volume: 1.0,
  keyframe_refs: [],
  group_id: "",
  enable_color_curves: true,
  enable_hsl_curves: true,
  track_render_index: 0,
  hdr_settings: null,
  enable_color_wheels: true,
  track_attribute: 0,
  is_placeholder: false,
  template_id: "",
  enable_smart_color_adjust: false,
  template_scene: "default",
  common_keyframes: [],
  caption_info: null,
  responsive_layout: {
    enable: false,
    target_follow: "",
    size_layout: 0,
    horizontal_pos_layout: 0,
    vertical_pos_layout: 0,
  },
  enable_color_match_adjust: false,
  enable_color_correct_adjust: false,
  lyric_keyframes: null,
  enable_video_mask: true,
  digital_human_template_group_id: "",
  color_correct_alg_result: "",
  source: "segmentsourcenormal",
  enable_mask_stroke: false,
  enable_mask_shadow: false,
  enable_color_adjust_pro: false,
  segment_color_tag: "",
};

function enrichClipForDraftInfo(clip: unknown): DraftRecord | null {
  if (clip === null || clip === undefined) {
    return null;
  }

  const source = typeof clip === "object" ? (clip as DraftRecord) : {};
  const scale = typeof source.scale === "object" && source.scale ? (source.scale as DraftRecord) : {};
  const transform =
    typeof source.transform === "object" && source.transform ? (source.transform as DraftRecord) : {};
  const flip = typeof source.flip === "object" && source.flip ? (source.flip as DraftRecord) : {};

  return {
    alpha: 1.0,
    rotation: 0.0,
    scale: { x: 1.0, y: 1.0, ...scale },
    transform: { x: 0.0, y: 0.0, ...transform },
    flip: { horizontal: false, vertical: false, ...flip },
    ...source,
  };
}

function enrichSegmentForDraftInfo(segment: DraftRecord, trackType: string): DraftRecord {
  const isAudio = trackType === "audio";
  const enrichedClip = enrichClipForDraftInfo(isAudio ? null : segment.clip);
  const volume = typeof segment.volume === "number" ? segment.volume : 1.0;
  const lastNonzeroVolume =
    typeof segment.last_nonzero_volume === "number"
      ? segment.last_nonzero_volume
      : volume > 0
        ? volume
        : 1.0;

  return {
    ...DRAFT_INFO_SEGMENT_BASE,
    ...segment,
    speed: typeof segment.speed === "number" ? segment.speed : 1.0,
    reverse: Boolean(segment.reverse),
    visible: segment.visible !== false,
    volume,
    last_nonzero_volume: lastNonzeroVolume,
    enable_lut: !isAudio,
    enable_adjust: !isAudio,
    enable_hsl: !isAudio,
    enable_adjust_mask: !isAudio,
    uniform_scale:
      isAudio
        ? null
        : typeof segment.uniform_scale === "object" && segment.uniform_scale !== null
          ? segment.uniform_scale
          : { on: true, value: 1.0 },
    clip: enrichedClip,
    raw_segment_id: isAudio ? "" : String(segment.raw_segment_id ?? ""),
    render_index: typeof segment.render_index === "number" ? segment.render_index : 0,
    target_timerange:
      typeof segment.target_timerange === "object" && segment.target_timerange
        ? segment.target_timerange
        : { start: 0, duration: 0 },
    source_timerange:
      typeof segment.source_timerange === "object" && segment.source_timerange
        ? segment.source_timerange
        : { start: 0, duration: 0 },
    extra_material_refs: Array.isArray(segment.extra_material_refs) ? segment.extra_material_refs : [],
  };
}

function enrichVideoMaterialForDraftInfo(material: DraftRecord): DraftRecord {
  const crop = typeof material.crop === "object" && material.crop ? material.crop : defaultCrop();
  const isPhoto = material.type === "photo";

  return {
    unique_id: "",
    local_id: "",
    reverse_intensifies_path: "",
    cartoon_path: "",
    material_id: "",
    crop_ratio: "free",
    crop_scale: 1.0,
    audio_fade: null,
    matting: {
      flag: 0,
      path: "",
      interactiveTime: [],
      has_use_quick_brush: false,
      strokes: [],
      has_use_quick_eraser: false,
      expansion: 0,
      feather: 0,
      reverse: false,
      custom_matting_id: "",
      enable_matting_stroke: false,
      is_clould: false,
      mask_video_path: "",
      cloud_product_fps: 0.0,
    },
    source: 0,
    picture_from: isPhoto ? "none" : "none",
    picture_set_category_id: "",
    picture_set_category_name: "",
    has_sound_separated: false,
    is_set_beauty_mode: false,
    local_material_from: "",
    aigc_type: "none",
    aigc_history_id: "",
    aigc_item_id: "",
    smart_match_info: null,
    smart_motion: null,
    multi_camera_info: null,
    ...material,
    crop,
    duration: typeof material.duration === "number" ? material.duration : 0,
    width: typeof material.width === "number" ? material.width : 1080,
    height: typeof material.height === "number" ? material.height : 1920,
    media_path:
      typeof material.media_path === "string" && material.media_path.length > 0
        ? material.media_path
        : typeof material.path === "string"
          ? material.path
          : "",
  };
}

function enrichAudioMaterialForDraftInfo(material: DraftRecord): DraftRecord {
  return {
    unique_id: "",
    app_id: 0,
    video_id: "",
    effect_id: "",
    resource_id: "",
    third_resource_id: "",
    intensifies_path: "",
    mock_tone_speaker: "",
    cloned_model_type: "",
    tone_emotion_name_key: "",
    tone_emotion_style: "",
    tone_emotion_role: "",
    tone_emotion_selection: "",
    tone_emotion_scale: 0.0,
    moyin_emotion: "",
    query: "",
    search_id: "",
    sound_separate_type: "",
    is_ugc: false,
    is_ai_clone_tone: false,
    is_ai_clone_tone_post: false,
    source_from: "",
    copyright_limit_type: "none",
    aigc_history_id: "",
    aigc_item_id: "",
    music_source: "",
    pgc_id: "",
    pgc_name: "",
    similiar_music_info: {
      original_song_id: "",
      original_song_name: "",
    },
    ai_music_type: 0,
    ai_music_enter_from: "",
    lyric_type: 0,
    tts_task_id: "",
    ...material,
    type: "sound",
    duration: typeof material.duration === "number" ? material.duration : 0,
    wave_points: Array.isArray(material.wave_points) ? material.wave_points : [],
  };
}

function enrichTextMaterialForDraftInfo(material: DraftRecord): DraftRecord {
  return {
    recognize_task_id: "",
    name: "",
    recognize_text: "",
    recognize_model: "",
    punc_model: "",
    base_content: "",
    words: { start_time: [], end_time: [], text: [] },
    current_words: { start_time: [], end_time: [], text: [] },
    global_alpha: 1.0,
    combo_info: { text_templates: [] },
    caption_template_info: {
      resource_id: "",
      third_resource_id: "",
      resource_name: "",
      category_id: "",
      category_name: "",
      effect_id: "",
      request_id: "",
      path: "",
      is_new: false,
      source_platform: 0,
    },
    layer_weight: 0,
    text_curve: null,
    text_loop_on_path: false,
    offset_on_path: 0.0,
    enable_path_typesetting: false,
    text_exceeds_path_process_type: 0,
    text_typesetting_paths: null,
    text_typesetting_paths_file: "",
    text_typesetting_path_index: 0,
    shadow_point: { x: 0.0, y: 0.0 },
    shadow_thickness_projection_enable: false,
    shadow_thickness_projection_angle: 0.0,
    shadow_thickness_projection_distance: 0.0,
    border_mode: 0,
    style_name: "",
    font_title: "none",
    font_path: "",
    font_id: "",
    font_resource_id: "",
    initial_scale: 0.0,
    font_url: "",
    alignment: typeof material.alignment === "number" ? material.alignment : 1,
    ...material,
    font_size: typeof material.font_size === "number" ? material.font_size : 6.8,
    letter_spacing: typeof material.letter_spacing === "number" ? material.letter_spacing : 0.0,
    line_spacing: typeof material.line_spacing === "number" ? material.line_spacing : 0.02,
    border_width:
      typeof material.border_width === "number"
        ? material.border_width
        : typeof material.stroke_width === "number"
          ? material.stroke_width
          : 0.07,
    background_style:
      typeof material.background_style === "number" ? material.background_style : 0,
    background_alpha:
      typeof material.background_alpha === "number"
        ? material.background_alpha
        : typeof material.surface_alpha === "number"
          ? material.surface_alpha
          : typeof material.bg_alpha === "number"
            ? material.bg_alpha
            : 0,
    background_color:
      typeof material.background_color === "string"
        ? material.background_color
        : typeof material.surface_color === "string"
          ? material.surface_color
          : "#00000000",
    use_surface: Boolean(material.use_surface ?? material.background_style === 1),
    surface_alpha:
      typeof material.surface_alpha === "number"
        ? material.surface_alpha
        : typeof material.background_alpha === "number"
          ? material.background_alpha
          : 0,
  };
}

function enrichMaterialForDraftInfo(material: DraftRecord, bucket: string): DraftRecord {
  switch (bucket) {
    case "videos":
      return enrichVideoMaterialForDraftInfo(material);
    case "audios":
      return enrichAudioMaterialForDraftInfo(material);
    case "texts":
      return enrichTextMaterialForDraftInfo(material);
    default:
      return material;
  }
}

function mergeMaterialsIntoEnvelope(
  envelopeMaterials: DraftRecord,
  generatedMaterials: DraftRecord,
): DraftRecord {
  const merged: DraftRecord = { ...envelopeMaterials };

  for (const bucket of GENERATED_MATERIAL_BUCKETS) {
    const generatedItems = generatedMaterials[bucket];
    if (!Array.isArray(generatedItems)) {
      continue;
    }

    merged[bucket] = (generatedItems as DraftRecord[]).map((material) =>
      enrichMaterialForDraftInfo(material, bucket),
    );
  }

  return merged;
}

function mergeGeneratedIntoDraftInfoEnvelope(
  envelope: DraftRecord,
  generated: CapCutDraftContent,
): DraftRecord {
  const merged: DraftRecord = { ...envelope };

  merged.duration = generated.duration;
  merged.fps = 30.0;
  merged.name = generated.name;
  merged.update_time = nowMicroseconds();
  merged.ratio = CAPCUT_CANVAS_RATIO;
  merged.canvas_config = {
    width: CAPCUT_CANVAS_WIDTH,
    height: CAPCUT_CANVAS_HEIGHT,
    ratio: CAPCUT_CANVAS_RATIO,
  };
  merged.tracks = (generated.tracks as DraftRecord[]).map((track) => ({
    ...track,
    segments: Array.isArray(track.segments)
      ? (track.segments as DraftRecord[]).map((segment) =>
          enrichSegmentForDraftInfo(segment, String(track.type)),
        )
      : [],
  }));
  merged.materials = mergeMaterialsIntoEnvelope(
    typeof merged.materials === "object" && merged.materials ? (merged.materials as DraftRecord) : {},
    generated.materials,
  );

  return merged;
}

function resetEnvelopeTimeline(envelope: DraftRecord): DraftRecord {
  const reset: DraftRecord = { ...envelope, duration: 0, tracks: [] };
  const materials =
    typeof reset.materials === "object" && reset.materials ? (reset.materials as DraftRecord) : {};

  for (const [key, value] of Object.entries(materials)) {
    if (Array.isArray(value)) {
      materials[key] = [];
    }
  }

  reset.materials = materials;
  return reset;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findSeedDraftEnvelope(
  capCutRoot: string,
  excludeFolderPath: string,
): Promise<DraftRecord | null> {
  let entries: string[] = [];

  try {
    entries = await readdir(capCutRoot);
  } catch {
    return null;
  }

  const candidates: Array<{ mtimeMs: number; fullPath: string }> = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(capCutRoot, entry);
    if (fullPath === excludeFolderPath) {
      continue;
    }

    const draftInfoPath = path.join(fullPath, "draft_info.json");
    if (!(await pathExists(draftInfoPath))) {
      continue;
    }

    const info = await stat(fullPath);
    if (info.isDirectory()) {
      candidates.push({ mtimeMs: info.mtimeMs, fullPath: draftInfoPath });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const raw = await readFile(candidates[0].fullPath, "utf8");
  return resetEnvelopeTimeline(JSON.parse(raw) as DraftRecord);
}

async function loadDraftEnvelope(
  draftFolderPath: string,
  capCutRoot: string,
): Promise<DraftRecord> {
  const draftInfoPath = path.join(draftFolderPath, "draft_info.json");

  if (await pathExists(draftInfoPath)) {
    const raw = await readFile(draftInfoPath, "utf8");
    return JSON.parse(raw) as DraftRecord;
  }

  const seeded = await findSeedDraftEnvelope(capCutRoot, draftFolderPath);
  if (seeded) {
    return seeded;
  }

  throw new Error(
    "No draft_info.json found in the target CapCut folder. Create a new empty project in CapCut first, then retry export.",
  );
}

const DEFAULT_CAPCUT_DRAFTS_ROOT =
  "/Users/abdallahnassur/Movies/CapCut/User Data/Projects/com.lveditor.draft";
const FALLBACK_DRAFT_FOLDER_NAME = "MotionDecorator_Project";

function getCapCutDraftsRoot(): string {
  return process.env.CAPCUT_DRAFTS_ROOT ?? DEFAULT_CAPCUT_DRAFTS_ROOT;
}

async function resolveCapCutDraftFolder(capCutRoot: string): Promise<{ folderPath: string; usedExistingFolder: boolean }> {
  let entries: string[] = [];

  try {
    entries = await readdir(capCutRoot);
  } catch {
    const folderPath = path.join(capCutRoot, FALLBACK_DRAFT_FOLDER_NAME);
    await mkdir(folderPath, { recursive: true });
    return { folderPath, usedExistingFolder: false };
  }

  const folders: Array<{ name: string; mtimeMs: number }> = [];

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;

    const fullPath = path.join(capCutRoot, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      folders.push({ name: entry, mtimeMs: info.mtimeMs });
    }
  }

  if (folders.length === 0) {
    const folderPath = path.join(capCutRoot, FALLBACK_DRAFT_FOLDER_NAME);
    await mkdir(folderPath, { recursive: true });
    return { folderPath, usedExistingFolder: false };
  }

  folders.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return {
    folderPath: path.join(capCutRoot, folders[0].name),
    usedExistingFolder: true,
  };
}

/**
 * CapCut timeline exports keep BGM as a separate editable audio layer.
 * Baking FFmpeg sidechain into the video would either hide that layer or
 * double the music — so local CapCut write skips burn-in by default.
 */
async function tryApplySidechainDuckingToDraftFolder(
  draftFolderPath: string,
  projectData: CapCutProjectData,
): Promise<{ applied: boolean; duckedVideoPath: string | null }> {
  // Opt-in only: CapCut path wants a dedicated BGM track, not baked audio.
  const wantDucking = projectData.applySidechainDucking === true;
  if (!wantDucking) {
    return { applied: false, duckedVideoPath: null };
  }

  const videoFilename = filenameFromUrl(projectData.videoUrl, "source-video.mp4");
  const bgmUrl = projectData.bgmUrl ?? CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL;
  const bgmFilename = filenameFromUrl(bgmUrl, "cartoon.mp3");
  const videoPath = absoluteAssetPath(draftFolderPath, "video", videoFilename);
  const bgmPath = absoluteAssetPath(draftFolderPath, "audio", bgmFilename);

  if (!(await pathExists(videoPath)) || !(await pathExists(bgmPath))) {
    console.warn("[FFmpeg] Skipping sidechain ducking — video or BGM file missing locally.");
    return { applied: false, duckedVideoPath: null };
  }

  try {
    const { defaultDuckedOutputPath, mixVideoWithSidechainDucking } = await import(
      "@/lib/ffmpeg/mixWithSidechainDucking"
    );
    const duckedVideoPath = defaultDuckedOutputPath(videoPath);
    await mixVideoWithSidechainDucking({
      videoPath,
      bgmPath,
      outputPath: duckedVideoPath,
      musicVolume: CAPCUT_EXPORT_AUDIO.sidechainMusicVolume,
      threshold: 0.05,
      ratio: 4,
      attack: 15,
      release: 350,
      copyVideo: true,
    });

    // Replace the source video with the ducked mix (opt-in baked path only).
    await copyFile(duckedVideoPath, videoPath);
    return { applied: true, duckedVideoPath };
  } catch (error: unknown) {
    console.warn(
      "[FFmpeg] Sidechain ducking unavailable; CapCut BGM track remains on the timeline.",
      error instanceof Error ? error.message : error,
    );
    return { applied: false, duckedVideoPath: null };
  }
}

export async function writeDirectToCapCut(
  projectId: string,
  projectData: CapCutProjectData,
): Promise<CapCutDirectWriteResult> {
  const bgmUrl = projectData.bgmUrl ?? CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL;
  const projectDataWithBgm: CapCutProjectData = {
    ...projectData,
    bgmUrl,
    // CapCut draft must keep an explicit BGM timeline layer.
    applySidechainDucking: false,
  };

  const capCutRoot = getCapCutDraftsRoot();
  const { folderPath: draftFolderPath, usedExistingFolder } = await resolveCapCutDraftFolder(capCutRoot);
  const draftContentPath = path.join(draftFolderPath, "draft_content.json");
  const draftInfoPath = path.join(draftFolderPath, "draft_info.json");
  const draftMetaInfoPath = path.join(draftFolderPath, "draft_meta_info.json");

  await mkdir(path.join(draftFolderPath, "assets", "video"), { recursive: true });
  await mkdir(path.join(draftFolderPath, "assets", "audio"), { recursive: true });

  const mediaDownload = await downloadDraftMedia(draftFolderPath, projectDataWithBgm);
  // Still invoked for opt-in callers; CapCut local path forces ducking off above.
  const ducking = await tryApplySidechainDuckingToDraftFolder(draftFolderPath, projectDataWithBgm);

  const { draftContent } = buildCapCutDraft({
    projectId,
    projectName: projectData.projectName,
    videoUrl: projectData.videoUrl,
    transcript: projectData.transcript,
    durationSeconds: projectData.durationSeconds,
    theme: projectData.theme,
    sourceVideoWidth: projectData.sourceVideoWidth,
    sourceVideoHeight: projectData.sourceVideoHeight,
    speakerOffsetPercentX: projectData.speakerOffsetPercentX,
    speakerOffsetSegments: projectData.speakerOffsetSegments,
    bgmUrl,
    applySidechainDucking: false,
  });
  logTextSegmentScaleSample(draftContent);

  await applyAbsoluteMediaPaths(draftContent, draftFolderPath);
  const mediaFilter = await filterDraftToExistingMedia(draftContent, draftFolderPath);

  const envelope = await loadDraftEnvelope(draftFolderPath, capCutRoot);
  const mergedDraftInfo = mergeGeneratedIntoDraftInfoEnvelope(envelope, draftContent);
  const mergedJson = JSON.stringify(mergedDraftInfo, null, 2);

  await writeFile(draftInfoPath, mergedJson, "utf8");
  await writeFile(draftContentPath, JSON.stringify(draftContent, null, 2), "utf8");

  let timelineDraftInfoPath: string | null = null;
  const timelineDraftId = mergedDraftInfo.id;
  if (typeof timelineDraftId === "string" && timelineDraftId.length > 0) {
    timelineDraftInfoPath = path.join(draftFolderPath, "Timelines", timelineDraftId, "draft_info.json");
    await mkdir(path.dirname(timelineDraftInfoPath), { recursive: true });
    await writeFile(timelineDraftInfoPath, mergedJson, "utf8");
  }

  console.log(
    `[BGM Selection] CapCut draft includes separate BGM track → ${filenameFromUrl(bgmUrl, "cartoon.mp3")} @ volume ${CAPCUT_EXPORT_AUDIO.bgmVolume}`,
  );

  return {
    draftId: typeof mergedDraftInfo.id === "string" ? mergedDraftInfo.id : draftContent.id,
    draftFolderPath,
    draftContentPath,
    draftInfoPath,
    timelineDraftInfoPath,
    draftMetaInfoPath,
    usedExistingFolder,
    draftFolderName: path.basename(draftFolderPath),
    downloadedMediaCount: mediaDownload.downloadedCount,
    skippedMediaDownloads: mediaDownload.skipped,
    removedMissingMediaSegments: mediaFilter.removedSegmentCount,
    removedMissingMediaMaterials: mediaFilter.removedMaterialCount,
    bgmUrl,
    sidechainDuckingApplied: ducking.applied,
  };
}
