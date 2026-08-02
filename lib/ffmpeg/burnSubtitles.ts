import { spawn } from "node:child_process";
import { access, copyFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  buildCapCutSubtitleSegmentPlans,
  buildPhraseTextWithLineBreak,
  getSubtitlePreset,
  SHARED_SUBTITLE_TOKENS,
} from "@/lib/capcut/presets";
import { configureFfmpegBinary } from "@/lib/ffmpeg/mixWithSidechainDucking";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runFfmpeg(args: string[], cwd: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    void configureFfmpegBinary().then((configured) => {
      if (!configured) {
        reject(new Error("FFmpeg binary not found."));
        return;
      }

      console.info(`[FFmpeg] ${label}:`, configured, args.join(" "), `(cwd=${cwd})`);

      const child = spawn(configured, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `FFmpeg ${label} failed (code ${code}): ${stderr.trim().split("\n").slice(-10).join(" | ")}`,
          ),
        );
      });
    });
  });
}

function formatSrtTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = Math.floor(clamped % 60);
  const millis = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/** Build a plain SRT track from timed caption cues (soft-sub fallback). */
export function buildSrtFromCues(cues: DrawtextCue[]): string {
  return cues
    .map((cue, index) => {
      const start = formatSrtTimestamp(cue.startSeconds);
      const end = formatSrtTimestamp(Math.max(cue.endSeconds, cue.startSeconds + 0.05));
      return `${index + 1}\n${start} --> ${end}\n${cue.text}\n`;
    })
    .join("\n");
}

/**
 * Mux an SRT as a soft `mov_text` subtitle stream (no video filters / freetype).
 * Players that support text tracks can toggle captions; video pixels stay untouched.
 */
export async function muxSoftSubtitlesMovText(options: {
  videoPath: string;
  srtPath: string;
  outputPath: string;
  workDir: string;
}): Promise<string> {
  const relVideo = "softsub_input.mp4";
  const relSrt = "captions.srt";
  const relOutput = "export.mp4";
  const absVideo = path.join(options.workDir, relVideo);
  const absSrt = path.join(options.workDir, relSrt);
  const absOutput = path.join(options.workDir, relOutput);

  if (path.resolve(options.videoPath) !== path.resolve(absVideo)) {
    await copyFile(options.videoPath, absVideo);
  }
  if (path.resolve(options.srtPath) !== path.resolve(absSrt)) {
    await copyFile(options.srtPath, absSrt);
  }

  await runFfmpeg(
    [
      "-hide_banner",
      "-i",
      relVideo,
      "-i",
      relSrt,
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-map",
      "1:0",
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-c:s",
      "mov_text",
      "-metadata:s:s:0",
      "language=eng",
      "-movflags",
      "+faststart",
      "-y",
      relOutput,
    ],
    options.workDir,
    "soft subtitle mux (mov_text)",
  );

  if (path.resolve(options.outputPath) !== path.resolve(absOutput)) {
    await copyFile(absOutput, options.outputPath);
  }

  return options.outputPath;
}

/** Prefer a bold system font that ffmpeg-static drawtext can open. */
export function resolveDrawtextFontFile(): string | null {
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function escapeDrawtextPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function microsToSeconds(micros: number): number {
  return Math.max(0, micros / 1_000_000);
}

export interface DrawtextCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
  /** Hex fill for the cue (white / accent). */
  fontColor: string;
}

/** Build timed caption cues for native drawtext burn-in (no libass). */
export function buildDrawtextCues(options: {
  transcript: TranscriptData;
  theme: ThemeId;
}): DrawtextCue[] {
  const preset = getSubtitlePreset(options.theme);
  const toMicroseconds = (seconds: number) => Math.round(Math.max(0, seconds) * 1_000_000);
  const plans = buildCapCutSubtitleSegmentPlans(options.transcript, preset, toMicroseconds);

  return plans.map((plan) => {
    const { fullText, displayWords } = buildPhraseTextWithLineBreak(plan.phraseWords, preset);
    const active = displayWords.find((entry) => entry.isActive);
    const fontColor = active ? preset.activeColor : preset.inactiveColor;

    return {
      startSeconds: microsToSeconds(plan.startMicros),
      endSeconds: microsToSeconds(plan.startMicros + plan.durationMicros),
      text: fullText,
      fontColor,
    };
  });
}

/**
 * Chunk cues so each FFmpeg pass stays within a safe filter-graph size.
 * Karaoke exports can produce hundreds of segments.
 */
const DRAWTEXT_CHUNK_SIZE = 40;

function buildDrawtextFilterForChunk(
  cues: DrawtextCue[],
  cueOffset: number,
  fontFile: string | null,
): string {
  const fontOpt = fontFile ? `fontfile=${escapeDrawtextPath(fontFile)}:` : "";
  const fontsize = Math.round(SHARED_SUBTITLE_TOKENS.webFontSizePx * 1.85);
  const borderw = 4;
  const yExpr = "h*0.72";

  return cues
    .map((cue, index) => {
      const cueIndex = cueOffset + index;
      const textfile = `cue_${cueIndex}.txt`;
      const start = cue.startSeconds.toFixed(3);
      const end = cue.endSeconds.toFixed(3);
      const color = cue.fontColor.replace("#", "");
      // Native drawtext — works without libass / subtitles filter.
      return [
        `drawtext=${fontOpt}`,
        `textfile=${textfile}:`,
        `reload=0:`,
        `fontsize=${fontsize}:`,
        `fontcolor=0x${color}:`,
        `borderw=${borderw}:`,
        `bordercolor=black:`,
        `box=1:`,
        `boxcolor=black@${SHARED_SUBTITLE_TOKENS.backgroundAlpha}:`,
        `boxborderw=18:`,
        `line_spacing=12:`,
        `x=(w-text_w)/2:`,
        `y=${yExpr}:`,
        `enable='between(t\\,${start}\\,${end})'`,
      ].join("");
    })
    .join(",");
}

/**
 * Burns captions with FFmpeg `drawtext` (no `ass` / `subtitles` / libass dependency).
 */
export async function burnSubtitlesWithDrawtext(options: {
  videoPath: string;
  outputPath: string;
  workDir: string;
  transcript: TranscriptData;
  theme: ThemeId;
}): Promise<string> {
  if (!(await pathExists(options.videoPath))) {
    throw new Error(`Video not found for subtitle burn-in: ${options.videoPath}`);
  }

  const ffmpegBinary = await configureFfmpegBinary();
  if (!ffmpegBinary) {
    throw new Error(
      "FFmpeg binary not found. Install ffmpeg on PATH or keep the ffmpeg-static dependency.",
    );
  }

  const workDir = options.workDir;
  const relInput = "burn_input.mp4";
  const relOutput = "export.mp4";
  const absInput = path.join(workDir, relInput);
  const absOutput = path.join(workDir, relOutput);

  if (path.resolve(options.videoPath) !== path.resolve(absInput)) {
    await copyFile(options.videoPath, absInput);
  }

  const cues = buildDrawtextCues({
    transcript: options.transcript,
    theme: options.theme,
  });

  if (cues.length === 0) {
    await copyFile(absInput, absOutput);
    if (path.resolve(options.outputPath) !== path.resolve(absOutput)) {
      await copyFile(absOutput, options.outputPath);
    }
    return options.outputPath;
  }

  // One UTF-8 text file per cue — avoids drawtext escaping issues with accents / newlines.
  await Promise.all(
    cues.map(async (cue, index) => {
      await writeFile(path.join(workDir, `cue_${index}.txt`), cue.text, "utf8");
    }),
  );

  const fontFile = resolveDrawtextFontFile();
  let currentInput = relInput;

  for (let offset = 0; offset < cues.length; offset += DRAWTEXT_CHUNK_SIZE) {
    const chunk = cues.slice(offset, offset + DRAWTEXT_CHUNK_SIZE);
    const isLast = offset + DRAWTEXT_CHUNK_SIZE >= cues.length;
    const chunkOutput = isLast ? relOutput : `burn_chunk_${offset}.mp4`;
    const filter = buildDrawtextFilterForChunk(chunk, offset, fontFile);

    await runFfmpeg(
      [
        "-hide_banner",
        "-i",
        currentInput,
        "-vf",
        filter,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        "-y",
        chunkOutput,
      ],
      workDir,
      `drawtext burn-in cues ${offset}-${offset + chunk.length - 1}`,
    );

    currentInput = chunkOutput;
  }

  if (path.resolve(options.outputPath) !== path.resolve(absOutput)) {
    await copyFile(absOutput, options.outputPath);
  }

  return options.outputPath;
}

/** @deprecated Use burnSubtitlesWithDrawtext — kept for import compatibility. */
export async function burnAssSubtitlesOntoVideo(options: {
  videoPath: string;
  assPath: string;
  outputPath: string;
  workDir: string;
  transcript?: TranscriptData;
  theme?: ThemeId;
}): Promise<string> {
  if (!options.transcript || !options.theme) {
    throw new Error(
      "ASS/libass burn-in is unavailable in this FFmpeg build. Pass transcript+theme for drawtext burn-in.",
    );
  }

  return burnSubtitlesWithDrawtext({
    videoPath: options.videoPath,
    outputPath: options.outputPath,
    workDir: options.workDir,
    transcript: options.transcript,
    theme: options.theme,
  });
}
