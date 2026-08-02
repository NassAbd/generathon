"use client";

import {
  CAPCUT_EXPORT_AUDIO,
  choosePhraseLineBreakIndex,
  formatPhraseDisplayWord,
  getPhraseWordsForIndex,
  getSubtitlePreset,
  SHARED_SUBTITLE_TOKENS,
  type PhraseWord,
  type SubtitleStylePreset,
} from "@/lib/capcut/presets";
import { findActiveWordIndex, normalizeTranscript } from "@/lib/player/transcriptIndex";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;
const EXPORT_FPS = 30;

export interface ClientCanvasExportInput {
  videoUrl: string;
  bgmUrl?: string;
  transcript: TranscriptData;
  theme: ThemeId;
  filenameStem?: string;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface ClientCanvasExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  extension: "webm" | "mp4";
}

function pickRecorderMimeType(): { mimeType: string; extension: "webm" | "mp4" } {
  const candidates: Array<{ mimeType: string; extension: "webm" | "mp4" }> = [
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: "video/webm", extension: "webm" };
}

function waitForEvent(target: EventTarget, eventName: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Export aborted.", "AbortError"));
      return;
    }

    const onAbort = () => {
      cleanup();
      reject(new DOMException("Export aborted.", "AbortError"));
    };

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      signal?.removeEventListener("abort", onAbort);
    };

    target.addEventListener(eventName, onEvent, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function loadMediaElement<T extends HTMLMediaElement>(
  element: T,
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  element.crossOrigin = "anonymous";
  element.preload = "auto";
  element.src = url;
  element.load();

  if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return element;
  }

  await Promise.race([
    waitForEvent(element, "loadedmetadata", signal),
    waitForEvent(element, "error", signal).then(() => {
      throw new Error(`Failed to load media: ${url}`);
    }),
  ]);

  return element;
}

function drawCoverVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const videoWidth = video.videoWidth || canvasWidth;
  const videoHeight = video.videoHeight || canvasHeight;
  const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const dx = (canvasWidth - drawWidth) / 2;
  const dy = (canvasHeight - drawHeight) / 2;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(video, dx, dy, drawWidth, drawHeight);
}

function measureWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  font: string,
): TextMetrics {
  ctx.font = font;
  return ctx.measureText(word);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function wordColor(entry: PhraseWord, preset: SubtitleStylePreset): string {
  // Karaoke: currently spoken word uses theme accent.
  if (entry.isActive) {
    return preset.activeColor;
  }
  return preset.inactiveColor;
}

function drawStyledSubtitles(
  ctx: CanvasRenderingContext2D,
  options: {
    transcript: TranscriptData;
    currentTime: number;
    preset: SubtitleStylePreset;
    canvasWidth: number;
    canvasHeight: number;
  },
): void {
  const { transcript, currentTime, preset, canvasWidth, canvasHeight } = options;
  const activeIndex = findActiveWordIndex(transcript, currentTime);
  if (activeIndex < 0) {
    return;
  }

  const phraseWords = getPhraseWordsForIndex(transcript, activeIndex, preset);
  if (phraseWords.length === 0) {
    return;
  }

  const displayWords = phraseWords.map((entry) => ({
    ...entry,
    display: formatPhraseDisplayWord(entry.word, preset),
  }));
  const displays = displayWords.map((entry) => entry.display);
  const breakAfter = choosePhraseLineBreakIndex(displays);

  const fontSize = Math.round(preset.webFontSizePx * (canvasWidth / 390));
  const fontWeight = 800;
  const font = `${fontWeight} ${fontSize}px ${preset.fontFamily}`;
  const gap = Math.round(fontSize * 0.28);
  const lineGap = Math.round(fontSize * 0.35);
  const strokeWidth = Math.max(2, preset.borderWidth * 40 * (canvasWidth / 1080));

  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  type LineWord = (typeof displayWords)[number] & { width: number };
  const lines: LineWord[][] = [[]];
  for (let index = 0; index < displayWords.length; index += 1) {
    const entry = displayWords[index];
    const width = measureWord(ctx, entry.display, font).width;
    lines[lines.length - 1].push({ ...entry, width });
    if (index + 1 === breakAfter && index < displayWords.length - 1) {
      lines.push([]);
    }
  }

  const lineWidths = lines.map((line) => {
    if (line.length === 0) return 0;
    return line.reduce((sum, word) => sum + word.width, 0) + gap * (line.length - 1);
  });
  const blockWidth = Math.max(...lineWidths, 0);
  const blockHeight = lines.length * fontSize + (lines.length - 1) * lineGap;
  const padX = Math.round(fontSize * 0.55);
  const padY = Math.round(fontSize * 0.35);
  const boxWidth = blockWidth + padX * 2;
  const boxHeight = blockHeight + padY * 2;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * preset.webSubtitleTop;
  const boxX = centerX - boxWidth / 2;
  const boxY = centerY - boxHeight / 2;

  if (preset.useBackgroundBox) {
    ctx.fillStyle = `rgba(0, 0, 0, ${preset.backgroundAlpha})`;
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, Math.round(fontSize * 0.35));
    ctx.fill();
  }

  let lineTop = boxY + padY + fontSize / 2;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    let cursorX = centerX - lineWidths[lineIndex] / 2;

    for (const word of line) {
      const color = wordColor(word, preset);
      const opacity = word.isActive ? 1 : preset.inactiveOpacity;
      ctx.globalAlpha = opacity;
      ctx.font = font;
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = SHARED_SUBTITLE_TOKENS.strokeColor;
      ctx.fillStyle = color;
      ctx.strokeText(word.display, cursorX, lineTop);
      ctx.fillText(word.display, cursorX, lineTop);
      cursorX += word.width + gap;
    }

    lineTop += fontSize + lineGap;
  }

  ctx.restore();
}

/**
 * Client-side short-form export: canvas frames + mixed audio via MediaRecorder.
 * Avoids server FFmpeg freetype/drawtext entirely.
 */
export async function exportProjectWithClientCanvas(
  input: ClientCanvasExportInput,
): Promise<ClientCanvasExportResult> {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("Client export requires a browser with MediaRecorder support.");
  }

  const preset = getSubtitlePreset(input.theme);
  const transcript = normalizeTranscript(input.transcript);
  const { mimeType, extension } = pickRecorderMimeType();

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas 2D context for export.");
  }

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = false;
  video.volume = 1;

  const bgm = document.createElement("audio");
  bgm.loop = true;
  bgm.volume = CAPCUT_EXPORT_AUDIO.bgmVolume;

  await loadMediaElement(video, input.videoUrl, input.signal);
  if (input.bgmUrl) {
    try {
      await loadMediaElement(bgm, input.bgmUrl, input.signal);
    } catch {
      console.warn("[ClientExport] BGM failed to load; exporting dialog audio only.");
    }
  }

  const duration =
    Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : transcript.reduce((max, entry) => Math.max(max, entry.end), 0);

  if (!(duration > 0)) {
    throw new Error("Video duration is unavailable for export.");
  }

  const audioContext = new AudioContext();
  const mixedDestination = audioContext.createMediaStreamDestination();

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const videoSource = audioContext.createMediaElementSource(video);
    videoSource.connect(mixedDestination);

    if (input.bgmUrl && bgm.src) {
      const bgmSource = audioContext.createMediaElementSource(bgm);
      const bgmGain = audioContext.createGain();
      bgmGain.gain.value = CAPCUT_EXPORT_AUDIO.bgmVolume;
      bgmSource.connect(bgmGain);
      bgmGain.connect(mixedDestination);
    }

    const canvasStream = canvas.captureStream(EXPORT_FPS);
    const outputStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...mixedDestination.stream.getAudioTracks(),
    ]);

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(outputStream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 192_000,
    });

    const recordingDone = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = () => reject(new Error("MediaRecorder failed during export."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start(250);

    video.currentTime = 0;
    bgm.currentTime = 0;

    await video.play();
    if (input.bgmUrl && bgm.src) {
      void bgm.play().catch(() => undefined);
    }

    await new Promise<void>((resolve, reject) => {
      let frameHandle = 0;
      let settled = false;

      const cleanup = () => {
        cancelAnimationFrame(frameHandle);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
        input.signal?.removeEventListener("abort", onAbort);
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const onEnded = () => finish();
      const onError = () => fail(new Error("Video playback failed during export."));
      const onAbort = () => fail(new DOMException("Export aborted.", "AbortError"));

      const drawFrame = () => {
        if (settled) return;
        drawCoverVideo(ctx, video, EXPORT_WIDTH, EXPORT_HEIGHT);
        drawStyledSubtitles(ctx, {
          transcript,
          currentTime: video.currentTime,
          preset,
          canvasWidth: EXPORT_WIDTH,
          canvasHeight: EXPORT_HEIGHT,
        });
        input.onProgress?.(Math.min(1, video.currentTime / duration));
        if (!video.ended && !video.paused) {
          frameHandle = requestAnimationFrame(drawFrame);
        }
      };

      video.addEventListener("ended", onEnded, { once: true });
      video.addEventListener("error", onError, { once: true });
      input.signal?.addEventListener("abort", onAbort, { once: true });
      frameHandle = requestAnimationFrame(drawFrame);

      // Safety timeout slightly past duration.
      window.setTimeout(
        () => {
          if (!settled) {
            finish();
          }
        },
        Math.ceil(duration * 1000) + 2500,
      );
    });

    video.pause();
    bgm.pause();
    input.onProgress?.(1);

    if (recorder.state === "recording") {
      recorder.stop();
    }

    canvasStream.getTracks().forEach((track) => track.stop());
    outputStream.getTracks().forEach((track) => track.stop());

    const blob = await recordingDone;
    const stem = (input.filenameStem ?? "motion-decorator").replace(/[^\w.-]+/g, "-");

    return {
      blob,
      filename: `${stem}.${extension}`,
      mimeType,
      extension,
    };
  } finally {
    video.pause();
    bgm.pause();
    video.removeAttribute("src");
    bgm.removeAttribute("src");
    video.load();
    bgm.load();
    void audioContext.close().catch(() => undefined);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
