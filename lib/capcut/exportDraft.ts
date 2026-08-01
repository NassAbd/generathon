import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

const MICROSECONDS = 1_000_000;

export interface CapCutExportInput {
  projectId: string;
  projectName: string;
  videoUrl: string;
  transcript: TranscriptData;
  durationSeconds: number;
  theme: ThemeId;
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
  canvas_config: {
    width: number;
    height: number;
    ratio: string;
  };
  platform: {
    app_source: "cc";
    app_version: string;
    os: string;
  };
  tracks: CapCutTrack[];
  materials: CapCutMaterials;
  extra_info: Record<string, never>;
  free_render_index_mode_on: false;
}

interface CapCutTrack {
  id: string;
  type: "video" | "text" | "audio";
  name: string;
  segments: CapCutSegment[];
}

interface CapCutSegment {
  id: string;
  material_id: string;
  target_timerange: { start: number; duration: number };
  source_timerange: { start: number; duration: number };
  extra_material_refs: string[];
  clip: CapCutClip | null;
  speed: number;
  volume: number;
  visible: boolean;
  render_index: number;
}

interface CapCutClip {
  rotation: number;
  alpha: number;
  scale: { x: number; y: number };
  transform: { x: number; y: number };
  flip: { horizontal: boolean; vertical: boolean };
}

interface CapCutMaterials {
  videos: CapCutVideoMaterial[];
  texts: CapCutTextMaterial[];
  audios: CapCutAudioMaterial[];
}

interface CapCutVideoMaterial {
  id: string;
  type: "video" | "photo";
  path: string;
  duration: number;
  width: number;
  height: number;
  material_name: string;
}

interface CapCutTextMaterial {
  id: string;
  type: "text";
  content: string;
  font_name: string;
  font_size: number;
  text_color: string;
  border_color: string;
  border_width: number;
  has_shadow: boolean;
  shadow_color: string;
  shadow_distance: number;
  background_color: string;
  text_alignment: number;
  vertical: boolean;
}

interface CapCutAudioMaterial {
  id: string;
  type: "extract_music";
  path: string;
  duration: number;
  material_name: string;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function toMicroseconds(seconds: number): number {
  return Math.max(0, Math.round(seconds * MICROSECONDS));
}

function themeTextColor(theme: ThemeId): string {
  switch (theme) {
    case "cyberpunk":
      return "#67E8F9FF";
    case "minimal_tech":
      return "#F8FAFCFF";
    default:
      return "#FFFFFFFF";
  }
}

function themeHighlightColor(theme: ThemeId): string {
  switch (theme) {
    case "cyberpunk":
      return "#F472B6FF";
    case "minimal_tech":
      return "#E2E8F0FF";
    default:
      return "#FDE047FF";
  }
}

function buildTextContent(text: string, highlight: boolean, theme: ThemeId): string {
  const byteLength = text.length * 2;
  const styles = [
    {
      range: [0, byteLength],
      fill: {
        content: {
          solid: {
            color: highlight ? hexToRgbFloat(themeHighlightColor(theme)) : hexToRgbFloat(themeTextColor(theme)),
          },
        },
      },
      size: highlight ? 20 : 16,
      bold: highlight,
      italic: false,
    },
  ];

  return JSON.stringify({
    text,
    styles,
    layer_weight: 1,
    effect: [],
  });
}

function hexToRgbFloat(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").slice(0, 6);
  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function defaultClip(): CapCutClip {
  return {
    rotation: 0,
    alpha: 1,
    scale: { x: 1, y: 1 },
    transform: { x: 0, y: 0 },
    flip: { horizontal: false, vertical: false },
  };
}

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url).pathname;
    const basename = pathname.split("/").pop();
    return basename && basename.length > 0 ? basename : fallback;
  } catch {
    return fallback;
  }
}

export function buildCapCutDraft(input: CapCutExportInput): CapCutDraftBundle {
  const draftId = createId("draft");
  const durationMicros = toMicroseconds(input.durationSeconds);
  const videoMaterialId = createId("video-mat");
  const videoTrackId = createId("track-video");
  const textTrackId = createId("track-text");
  const audioTrackId = createId("track-audio");
  const videoFilename = filenameFromUrl(input.videoUrl, "source-video.mp4");

  const videoMaterial: CapCutVideoMaterial = {
    id: videoMaterialId,
    type: "video",
    path: input.videoUrl,
    duration: durationMicros,
    width: 1080,
    height: 1920,
    material_name: videoFilename,
  };

  const videoSegment: CapCutSegment = {
    id: createId("video-seg"),
    material_id: videoMaterialId,
    target_timerange: { start: 0, duration: durationMicros },
    source_timerange: { start: 0, duration: durationMicros },
    extra_material_refs: [],
    clip: defaultClip(),
    speed: 1,
    volume: 1,
    visible: true,
    render_index: 0,
  };

  const textMaterials: CapCutTextMaterial[] = [];
  const textSegments: CapCutSegment[] = [];
  const audioMaterials: CapCutAudioMaterial[] = [];
  const audioSegments: CapCutSegment[] = [];

  input.transcript.forEach((entry) => {
    const textMaterialId = createId("text-mat");
    const startMicros = toMicroseconds(entry.start);
    const duration = Math.max(toMicroseconds(entry.end - entry.start), 80_000);

    textMaterials.push({
      id: textMaterialId,
      type: "text",
      content: buildTextContent(entry.word, entry.highlight, input.theme),
      font_name: "",
      font_size: entry.highlight ? 10 : 8,
      text_color: entry.highlight ? themeHighlightColor(input.theme) : themeTextColor(input.theme),
      border_color: "#000000FF",
      border_width: entry.highlight ? 0.08 : 0.04,
      has_shadow: true,
      shadow_color: "#000000AA",
      shadow_distance: 6,
      background_color: "#00000000",
      text_alignment: 1,
      vertical: false,
    });

    textSegments.push({
      id: createId("text-seg"),
      material_id: textMaterialId,
      target_timerange: { start: startMicros, duration },
      source_timerange: { start: 0, duration },
      extra_material_refs: [],
      clip: {
        ...defaultClip(),
        transform: { x: 0, y: 0.72 },
        scale: entry.highlight ? { x: 1.15, y: 1.15 } : { x: 1, y: 1 },
      },
      speed: 1,
      volume: 1,
      visible: true,
      render_index: 0,
    });

    if (entry.highlight && entry.sfx_url) {
      const audioMaterialId = createId("audio-mat");
      const sfxFilename = filenameFromUrl(entry.sfx_url, "sfx.mp3");
      const sfxDuration = Math.min(duration, 500_000);

      audioMaterials.push({
        id: audioMaterialId,
        type: "extract_music",
        path: entry.sfx_url,
        duration: sfxDuration,
        material_name: sfxFilename,
      });

      audioSegments.push({
        id: createId("audio-seg"),
        material_id: audioMaterialId,
        target_timerange: { start: startMicros, duration: sfxDuration },
        source_timerange: { start: 0, duration: sfxDuration },
        extra_material_refs: [],
        clip: null,
        speed: 1,
        volume: 0.85,
        visible: true,
        render_index: 0,
      });
    }
  });

  const draftContent: CapCutDraftContent = {
    id: draftId,
    name: input.projectName,
    duration: durationMicros,
    fps: 30,
    canvas_config: {
      width: 1080,
      height: 1920,
      ratio: "9:16",
    },
    platform: {
      app_source: "cc",
      app_version: "9.0.0",
      os: "mac",
    },
    tracks: [
      { id: videoTrackId, type: "video", name: "Main Video", segments: [videoSegment] },
      { id: textTrackId, type: "text", name: "Kinetic Subtitles", segments: textSegments },
      { id: audioTrackId, type: "audio", name: "Keyword SFX", segments: audioSegments },
    ],
    materials: {
      videos: [videoMaterial],
      texts: textMaterials,
      audios: audioMaterials,
    },
    extra_info: {},
    free_render_index_mode_on: false,
  };

  const readme = [
    "Motion Decorator CapCut Draft Export",
    "",
    `Project: ${input.projectName}`,
    `Draft ID: ${draftId}`,
    "",
    "Import instructions:",
    "1. Unzip this folder.",
    "2. Copy draft_content.json into a new CapCut Desktop draft folder.",
    "3. Relink the source video and SFX paths if CapCut prompts for missing media.",
    "",
    "Generated by Dynamic Subtitle & Motion Decorator.",
  ].join("\n");

  return { draftContent, readme };
}
