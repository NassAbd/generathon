import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CAPCUT_EXPORT_AUDIO } from "@/lib/capcut/presets";
import {
  buildDrawtextCues,
  buildSrtFromCues,
  burnSubtitlesWithDrawtext,
  muxSoftSubtitlesMovText,
} from "@/lib/ffmpeg/burnSubtitles";
import {
  configureFfmpegBinary,
  mixVideoWithSidechainDucking,
  probeFfmpegCaptionFilters,
} from "@/lib/ffmpeg/mixWithSidechainDucking";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

export interface RenderProjectMp4Input {
  videoUrl: string;
  bgmUrl: string;
  transcript: TranscriptData;
  theme: ThemeId;
  filenameStem?: string;
}

export type Mp4SubtitleMode = "burned_drawtext" | "soft_mov_text" | "audio_only";

export interface RenderProjectMp4Result {
  buffer: Buffer;
  filename: string;
  contentType: "video/mp4";
  subtitleMode: Mp4SubtitleMode;
  warning?: string;
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download media (${response.status}): ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, bytes);
}

/**
 * Full MP4 render: ducked BGM mix + best-effort captions.
 * Falls back when FFmpeg lacks freetype/libass video filters.
 */
export async function renderProjectMp4(
  input: RenderProjectMp4Input,
): Promise<RenderProjectMp4Result> {
  const ffmpegBinary = await configureFfmpegBinary();
  if (!ffmpegBinary) {
    throw new Error(
      "FFmpeg binary not found. Install ffmpeg on PATH or keep the ffmpeg-static dependency.",
    );
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "motion-decorator-mp4-"));
  const videoPath = path.join(workDir, "source.mp4");
  const bgmPath = path.join(workDir, "bgm.mp3");
  const duckedPath = path.join(workDir, "ducked.mp4");
  const outputPath = path.join(workDir, "export.mp4");
  const srtPath = path.join(workDir, "captions.srt");

  try {
    await downloadToFile(input.videoUrl, videoPath);
    await downloadToFile(input.bgmUrl, bgmPath);

    // 1) Mix dialog + BGM (video stream copied — no caption filters needed).
    await mixVideoWithSidechainDucking({
      videoPath,
      bgmPath,
      outputPath: duckedPath,
      musicVolume: CAPCUT_EXPORT_AUDIO.sidechainMusicVolume,
      threshold: 0.05,
      ratio: 4,
      attack: 15,
      release: 350,
      copyVideo: true,
    });

    const filters = await probeFfmpegCaptionFilters();
    const cues = buildDrawtextCues({
      transcript: input.transcript,
      theme: input.theme,
    });
    await writeFile(srtPath, buildSrtFromCues(cues), "utf8");

    let subtitleMode: Mp4SubtitleMode = "audio_only";
    let warning: string | undefined;

    // 2a) Prefer burned-in captions when drawtext exists.
    if (filters.drawtext && cues.length > 0) {
      try {
        await burnSubtitlesWithDrawtext({
          videoPath: duckedPath,
          outputPath,
          workDir,
          transcript: input.transcript,
          theme: input.theme,
        });
        subtitleMode = "burned_drawtext";
      } catch (burnError: unknown) {
        console.warn(
          "[MP4] drawtext burn-in failed; falling back to soft subs / audio-only.",
          burnError instanceof Error ? burnError.message : burnError,
        );
      }
    }

    // 2b) Soft mov_text track (no video filters / freetype).
    if (subtitleMode === "audio_only" && cues.length > 0) {
      try {
        await muxSoftSubtitlesMovText({
          videoPath: duckedPath,
          srtPath,
          outputPath,
          workDir,
        });
        subtitleMode = "soft_mov_text";
        warning =
          "Burned-in captions require FFmpeg with freetype/drawtext. " +
          "Exported video+ducked BGM with a soft subtitle track instead. " +
          "For styled burned captions matching the web preview, use CapCut export.";
      } catch (softError: unknown) {
        console.warn(
          "[MP4] Soft subtitle mux failed; exporting audio-mixed video only.",
          softError instanceof Error ? softError.message : softError,
        );
      }
    }

    // 2c) Last resort: clean audio mix, no subtitle stream.
    if (subtitleMode === "audio_only") {
      await copyFile(duckedPath, outputPath);
      warning =
        "This FFmpeg build cannot burn captions (missing drawtext/freetype). " +
        "Exported video + ducked BGM only. Use CapCut export for styled subtitles.";
    }

    const buffer = await readFile(outputPath);
    const stem = (input.filenameStem ?? "motion-decorator").replace(/[^\w.-]+/g, "-");
    return {
      buffer,
      filename: `${stem}.mp4`,
      contentType: "video/mp4",
      subtitleMode,
      warning,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
