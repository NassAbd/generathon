import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

import ffmpeg from "fluent-ffmpeg";

/** EBU R128 loudnorm applied to speech before sidechain sensing. */
export const SPEECH_LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11" as const;

export interface SidechainDuckingOptions {
  /** Source video with speech/dialog on its audio track. */
  videoPath: string;
  /** Background music file (mp3/wav/…). */
  bgmPath: string;
  /** Output mixed video path. */
  outputPath: string;
  /** Base music gain before ducking (default 0.15). */
  musicVolume?: number;
  /** sidechaincompress threshold (default 0.05). */
  threshold?: number;
  /** sidechaincompress ratio (default 4). */
  ratio?: number;
  /** Attack ms (default 15). */
  attack?: number;
  /** Release ms (default 350). */
  release?: number;
  /** Copy video stream without re-encode when possible (default true). */
  copyVideo?: boolean;
}

export interface SidechainDuckingResult {
  outputPath: string;
  filterComplex: string;
}

let ffmpegPathConfigured = false;

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Prefer bundled ffmpeg-static; fall back to system PATH. */
export async function configureFfmpegBinary(): Promise<string | null> {
  if (ffmpegPathConfigured) {
    return "configured";
  }

  try {
    // Dynamic import keeps client bundles from pulling the native binary.
    const ffmpegStatic = (await import("ffmpeg-static")).default;
    if (typeof ffmpegStatic === "string" && (await pathExists(ffmpegStatic))) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
      ffmpegPathConfigured = true;
      return ffmpegStatic;
    }
  } catch {
    // Optional dependency resolution failure — try system ffmpeg.
  }

  const systemPath = await resolveSystemFfmpegPath();
  if (systemPath) {
    ffmpeg.setFfmpegPath(systemPath);
    ffmpegPathConfigured = true;
    return systemPath;
  }

  return null;
}

async function resolveSystemFfmpegPath(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("which", ["ffmpeg"], { stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      const found = stdout.trim();
      resolve(code === 0 && found.length > 0 ? found : null);
    });
    child.on("error", () => resolve(null));
  });
}

export function buildSidechainFilterComplex(options: {
  musicVolume: number;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}): string {
  const { musicVolume, threshold, ratio, attack, release } = options;
  // Normalize quiet dialog first so sidechaincompress triggers reliably.
  return [
    `[0:a]${SPEECH_LOUDNORM}[norm_speech]`,
    `[1:a]volume=${musicVolume}[bg_music]`,
    `[norm_speech][bg_music]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[out_audio]`,
  ].join(";");
}

/**
 * Mixes video dialog with BGM using FFmpeg sidechain compression:
 * speech is loudnorm'd, then music ducks when speech is present.
 */
export async function mixVideoWithSidechainDucking(
  options: SidechainDuckingOptions,
): Promise<SidechainDuckingResult> {
  const musicVolume = options.musicVolume ?? 0.15;
  const threshold = options.threshold ?? 0.05;
  const ratio = options.ratio ?? 4;
  const attack = options.attack ?? 15;
  const release = options.release ?? 350;
  const copyVideo = options.copyVideo !== false;

  if (!(await pathExists(options.videoPath))) {
    throw new Error(`Video not found for ducking mix: ${options.videoPath}`);
  }
  if (!(await pathExists(options.bgmPath))) {
    throw new Error(`BGM not found for ducking mix: ${options.bgmPath}`);
  }

  const ffmpegBinary = await configureFfmpegBinary();
  if (!ffmpegBinary) {
    throw new Error(
      "FFmpeg binary not found. Install ffmpeg on PATH or keep the ffmpeg-static dependency.",
    );
  }

  const filterComplex = buildSidechainFilterComplex({
    musicVolume,
    threshold,
    ratio,
    attack,
    release,
  });

  await new Promise<void>((resolve, reject) => {
    const command = ffmpeg()
      .input(options.videoPath)
      .input(options.bgmPath)
      .complexFilter(filterComplex)
      .outputOptions([
        "-map",
        "0:v",
        "-map",
        "[out_audio]",
        ...(copyVideo ? ["-c:v", "copy"] : ["-c:v", "libx264", "-preset", "veryfast"]),
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-y",
      ])
      .output(options.outputPath);

    command
      .on("start", (cmdLine: string) => {
        console.info("[FFmpeg] Sidechain ducking:", cmdLine);
      })
      .on("error", (error: Error) => {
        reject(new Error(`Sidechain ducking failed: ${error.message}`));
      })
      .on("end", () => resolve())
      .run();
  });

  return {
    outputPath: options.outputPath,
    filterComplex,
  };
}

/** Convenience: ducked output next to the source video. */
export function defaultDuckedOutputPath(videoPath: string): string {
  const parsed = path.parse(videoPath);
  return path.join(parsed.dir, `${parsed.name}.ducked${parsed.ext || ".mp4"}`);
}
