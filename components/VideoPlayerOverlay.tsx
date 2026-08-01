"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from "react";

import { preloadBgmAudio } from "@/lib/player/preloadAssets";
import {
  applyBgmVolume,
  pauseBgm,
  playBgmWithVideo,
  syncBgmCurrentTime,
  syncBgmMutedState,
} from "@/lib/player/bgmSync";
import { findActiveWordIndex, normalizeTranscript } from "@/lib/player/transcriptIndex";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";
import {
  CAPCUT_EXPORT_AUDIO,
  getPhraseBlockStartIndex,
  getPhraseWordsForIndex,
  getSubtitlePreset,
  getWebSubtitleWordStyle,
  formatPhraseDisplayWord,
} from "@/lib/capcut/presets";
import {
  computeSpeakerTrackingLayout,
  needsVerticalCropReframe,
  type SpeakerOffsetSegment,
} from "@/lib/capcut/video-effects";

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export interface VideoSourceDimensions {
  width: number;
  height: number;
}

export interface VideoPlayerOverlayHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getVideoDimensions: () => VideoSourceDimensions | null;
}

export interface VideoPlayerOverlayProps {
  videoUrl: string;
  transcript: TranscriptData;
  theme: ThemeId;
  onActiveWordChange?: (index: number) => void;
  onVideoDimensionsChange?: (width: number, height: number) => void;
  onSpeakerOffsetChange?: (offsetPercentX: number) => void;
  onSpeakerOffsetSegmentsChange?: (segments: SpeakerOffsetSegment[]) => void;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

const DEFAULT_REFRAME = {
  needsReframe: false,
  coverScale: 1,
};

export const VideoPlayerOverlay = forwardRef<VideoPlayerOverlayHandle, VideoPlayerOverlayProps>(
  function VideoPlayerOverlay(
    {
      videoUrl,
      transcript,
      theme,
      onActiveWordChange,
      onVideoDimensionsChange,
      onSpeakerOffsetChange,
      onSpeakerOffsetSegmentsChange,
      onTimeUpdate,
      className,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const bgmRef = useRef<HTMLAudioElement>(null);
    const activeIndexRef = useRef(-1);
    const videoDimensionsRef = useRef<VideoSourceDimensions | null>(null);
    const faceDetectionStartedRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number | null>(null);
    const trajectorySegmentsRef = useRef<SpeakerOffsetSegment[]>([]);
    const gimbalStateRef = useRef({ position: 0, velocity: 0 });
    const publishedPanRef = useRef(0);
    const needsReframeRef = useRef(false);
    const onActiveWordChangeRef = useRef(onActiveWordChange);
    const onVideoDimensionsChangeRef = useRef(onVideoDimensionsChange);
    const onSpeakerOffsetChangeRef = useRef(onSpeakerOffsetChange);
    const onSpeakerOffsetSegmentsChangeRef = useRef(onSpeakerOffsetSegmentsChange);
    const onTimeUpdateRef = useRef(onTimeUpdate);

    const normalizedTranscript = useMemo(() => normalizeTranscript(transcript), [transcript]);
    const subtitlePreset = getSubtitlePreset(theme);

    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [reframeState, setReframeState] = useState(DEFAULT_REFRAME);
    needsReframeRef.current = reframeState.needsReframe;
    const [activePanOffsetX, setActivePanOffsetX] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);

    const phrase = getPhraseWordsForIndex(normalizedTranscript, activeWordIndex, subtitlePreset);
    const phraseBlockStart = getPhraseBlockStartIndex(activeWordIndex, subtitlePreset.phraseBlockSize);

    const syncVideoAudioMix = useCallback((video: HTMLVideoElement) => {
      const bgm = bgmRef.current;
      if (bgm) {
        syncBgmMutedState(video, bgm);
      }
    }, []);

    const applyActiveIndex = useCallback((nextIndex: number) => {
      if (nextIndex === activeIndexRef.current) return;

      activeIndexRef.current = nextIndex;
      setActiveWordIndex(nextIndex);
      onActiveWordChangeRef.current?.(nextIndex);
    }, []);

    const syncToVideoTime = useCallback(
      (timeSeconds: number) => {
        applyActiveIndex(findActiveWordIndex(normalizedTranscript, timeSeconds));
      },
      [applyActiveIndex, normalizedTranscript],
    );

    const resetAudioForSeek = useCallback((_seconds: number) => {
      const video = videoRef.current;
      const bgm = bgmRef.current;
      if (video && bgm) {
        syncBgmCurrentTime(video, bgm);
      }
    }, []);

    const applyReframeBase = useCallback((width: number, height: number) => {
      const layout = computeSpeakerTrackingLayout(width, height, 0);
      setReframeState({
        needsReframe: layout.needsReframe,
        coverScale: layout.coverScale,
      });
    }, []);

    const publishPanOffset = useCallback((offsetPercentX: number) => {
      gimbalStateRef.current.position = offsetPercentX;
      publishedPanRef.current = offsetPercentX;
      setActivePanOffsetX(offsetPercentX);
      onSpeakerOffsetChangeRef.current?.(offsetPercentX);
    }, []);

    const publishPlaybackTime = useCallback((timeSeconds: number) => {
      setCurrentTime(timeSeconds);
      onTimeUpdateRef.current?.(timeSeconds);
    }, []);

    const snapGimbalToTime = useCallback(
      async (timeSeconds: number) => {
        const { resolveTrajectoryOffsetAtTime } = await import("@/lib/capcut/face-tracker");
        const target = resolveTrajectoryOffsetAtTime(trajectorySegmentsRef.current, timeSeconds);
        gimbalStateRef.current = { position: target, velocity: 0 };
        publishPanOffset(target);
      },
      [publishPanOffset],
    );

    const phraseBoundaryStarts = useMemo(() => {
      const blockSize = subtitlePreset.phraseBlockSize;
      const starts: number[] = [];

      for (let index = 0; index < normalizedTranscript.length; index += blockSize) {
        starts.push(normalizedTranscript[index].start);
      }

      return starts;
    }, [normalizedTranscript, subtitlePreset.phraseBlockSize]);

    const runOfflineSegmentDetection = useCallback(
      async (video: HTMLVideoElement, width: number, height: number) => {
        if (typeof window === "undefined") {
          return;
        }

        if (!needsVerticalCropReframe(width, height) || faceDetectionStartedRef.current) {
          return;
        }

        faceDetectionStartedRef.current = true;

        try {
          const { coerceSegmentsToSingleLayout, detectSpeakerOffsetSegments } = await import(
            "@/lib/capcut/face-tracker"
          );
          const detection = await detectSpeakerOffsetSegments(video, {
            phraseStarts: phraseBoundaryStarts,
            durationSeconds: video.duration,
          });

          const singleSegments = coerceSegmentsToSingleLayout(detection.segments);
          trajectorySegmentsRef.current = singleSegments;
          applyReframeBase(width, height);
          onSpeakerOffsetSegmentsChangeRef.current?.(singleSegments);
          await snapGimbalToTime(video.currentTime);
        } catch (error: unknown) {
          console.warn("[VideoPlayerOverlay] Face tracking failed; using centered crop.", error);
          trajectorySegmentsRef.current = [];
          applyReframeBase(width, height);
          gimbalStateRef.current = { position: 0, velocity: 0 };
          publishPanOffset(0);
          onSpeakerOffsetSegmentsChangeRef.current?.([]);
        }
      },
      [applyReframeBase, phraseBoundaryStarts, publishPanOffset, snapGimbalToTime],
    );

    const captureVideoDimensions = useCallback(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }

      const nextDimensions: VideoSourceDimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      const previousDimensions = videoDimensionsRef.current;
      const dimensionsChanged =
        !previousDimensions ||
        previousDimensions.width !== nextDimensions.width ||
        previousDimensions.height !== nextDimensions.height;

      if (!dimensionsChanged) {
        return;
      }

      videoDimensionsRef.current = nextDimensions;
      trajectorySegmentsRef.current = [];
      gimbalStateRef.current = { position: 0, velocity: 0 };
      publishPanOffset(0);
      applyReframeBase(nextDimensions.width, nextDimensions.height);
      onVideoDimensionsChangeRef.current?.(nextDimensions.width, nextDimensions.height);
      void runOfflineSegmentDetection(video, nextDimensions.width, nextDimensions.height);
    }, [applyReframeBase, publishPanOffset, runOfflineSegmentDetection]);

    const togglePlayback = useCallback(() => {
      const video = videoRef.current;
      const bgm = bgmRef.current;
      if (!video) {
        return;
      }

      if (video.paused) {
        void video.play().catch(() => undefined);
        if (bgm) {
          void playBgmWithVideo(video, bgm);
        }
      } else {
        video.pause();
        if (bgm) {
          pauseBgm(bgm);
        }
      }
    }, []);

    const handleSeek = useCallback(
      (nextTime: number) => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(nextTime)) {
          return;
        }

        video.currentTime = nextTime;
        resetAudioForSeek(nextTime);
        publishPlaybackTime(nextTime);
        syncToVideoTime(nextTime);
        void snapGimbalToTime(nextTime);
      },
      [publishPlaybackTime, resetAudioForSeek, snapGimbalToTime, syncToVideoTime],
    );

    useImperativeHandle(
      ref,
      () => ({
        seekTo(seconds: number) {
          const video = videoRef.current;
          if (!video) return;
          video.currentTime = seconds;
          resetAudioForSeek(seconds);
          activeIndexRef.current = -1;
          publishPlaybackTime(seconds);
          syncToVideoTime(seconds);
          void snapGimbalToTime(seconds);
        },
        getCurrentTime() {
          return videoRef.current?.currentTime ?? 0;
        },
        getVideoDimensions() {
          return videoDimensionsRef.current;
        },
      }),
      [publishPlaybackTime, resetAudioForSeek, snapGimbalToTime, syncToVideoTime],
    );

    useEffect(() => {
      onActiveWordChangeRef.current = onActiveWordChange;
    }, [onActiveWordChange]);

    useEffect(() => {
      onVideoDimensionsChangeRef.current = onVideoDimensionsChange;
    }, [onVideoDimensionsChange]);

    useEffect(() => {
      onSpeakerOffsetChangeRef.current = onSpeakerOffsetChange;
    }, [onSpeakerOffsetChange]);

    useEffect(() => {
      onSpeakerOffsetSegmentsChangeRef.current = onSpeakerOffsetSegmentsChange;
    }, [onSpeakerOffsetSegmentsChange]);

    useEffect(() => {
      onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    useEffect(() => {
      faceDetectionStartedRef.current = false;
      trajectorySegmentsRef.current = [];
      gimbalStateRef.current = { position: 0, velocity: 0 };
      lastFrameTimeRef.current = null;
      publishPanOffset(0);
    }, [publishPanOffset, videoUrl]);

    useEffect(() => {
      const bgm = bgmRef.current;
      if (bgm) {
        applyBgmVolume(bgm);
      }
    }, []);

    useEffect(() => {
      void preloadBgmAudio();
    }, []);

    useEffect(() => {
      const video = videoRef.current;
      const bgm = bgmRef.current;
      if (!video || !bgm) return;

      let gimbalModule:
        | {
            resolveTrajectoryOffsetAtTime: (
              segments: SpeakerOffsetSegment[],
              timeSeconds: number,
            ) => number;
            stepGimbalPanTowardTarget: (
              state: { position: number; velocity: number },
              targetOffsetPercentX: number,
              dtSeconds: number,
            ) => { position: number; velocity: number };
          }
        | null = null;

      void import("@/lib/capcut/face-tracker").then((module) => {
        gimbalModule = module;
      });

      const tick = (frameTimeMs: number): void => {
        const timeSeconds = video.currentTime;
        publishPlaybackTime(timeSeconds);
        syncToVideoTime(timeSeconds);

        if (needsReframeRef.current && gimbalModule) {
          const previousFrameMs = lastFrameTimeRef.current;
          lastFrameTimeRef.current = frameTimeMs;
          const dtSeconds =
            previousFrameMs === null
              ? 1 / 60
              : Math.max(0, Math.min(0.05, (frameTimeMs - previousFrameMs) / 1000));

          const target = gimbalModule.resolveTrajectoryOffsetAtTime(
            trajectorySegmentsRef.current,
            timeSeconds,
          );

          // Seek / large discontinuities: retarget without zigzag overshoot.
          if (Math.abs(target - gimbalStateRef.current.position) > 28) {
            gimbalStateRef.current = { position: target, velocity: 0 };
            publishPanOffset(target);
          } else {
            const nextState = gimbalModule.stepGimbalPanTowardTarget(
              gimbalStateRef.current,
              target,
              video.paused ? Math.min(dtSeconds, 1 / 60) : dtSeconds,
            );
            gimbalStateRef.current = nextState;
            if (Math.abs(nextState.position - publishedPanRef.current) > 0.04) {
              publishPanOffset(nextState.position);
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      const handleTimeUpdate = (): void => {
        const timeSeconds = video.currentTime;
        publishPlaybackTime(timeSeconds);
        syncToVideoTime(timeSeconds);
      };

      const handleLoadedMetadata = (): void => {
        setDuration(video.duration);
        captureVideoDimensions();
      };

      const handleDurationChange = (): void => {
        if (Number.isFinite(video.duration)) {
          setDuration(video.duration);
        }
      };

      const handlePlay = (): void => {
        setIsPlaying(true);
        lastFrameTimeRef.current = null;
        void playBgmWithVideo(video, bgm);
      };

      const handlePause = (): void => {
        setIsPlaying(false);
        pauseBgm(bgm);
        lastFrameTimeRef.current = null;
      };

      const handleSeeked = (): void => {
        const timeSeconds = video.currentTime;
        publishPlaybackTime(timeSeconds);
        resetAudioForSeek(timeSeconds);
        syncToVideoTime(timeSeconds);
        lastFrameTimeRef.current = null;
        void snapGimbalToTime(timeSeconds);
        if (!video.paused) {
          void playBgmWithVideo(video, bgm);
        }
      };

      const handleVolumeChange = (): void => {
        syncVideoAudioMix(video);
      };

      syncVideoAudioMix(video);
      setIsPlaying(!video.paused);
      publishPlaybackTime(video.currentTime);
      if (Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
      syncToVideoTime(video.currentTime);
      rafRef.current = requestAnimationFrame(tick);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("seeked", handleSeeked);
      video.addEventListener("volumechange", handleVolumeChange);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("durationchange", handleDurationChange);

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleLoadedMetadata();
      }

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("volumechange", handleVolumeChange);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("durationchange", handleDurationChange);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        pauseBgm(bgm);
      };
    }, [
      captureVideoDimensions,
      publishPanOffset,
      publishPlaybackTime,
      resetAudioForSeek,
      snapGimbalToTime,
      syncToVideoTime,
      syncVideoAudioMix,
    ]);

    const singleVideoTransformStyle: CSSProperties | undefined = reframeState.needsReframe
      ? {
          transform: `scale(${reframeState.coverScale}) translateX(${activePanOffsetX}%)`,
          transformOrigin: "center center",
        }
      : undefined;

    return (
      <div
        data-theme={theme}
        className={[
          "relative isolate mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glow",
          subtitlePreset.overlayShellClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="group relative aspect-[9/16] h-full w-full overflow-hidden"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onClick={togglePlayback}
        >
          <video
            ref={videoRef}
            className="relative z-10 h-full w-full bg-black object-contain"
            style={singleVideoTransformStyle}
            src={videoUrl}
            crossOrigin="anonymous"
            playsInline
            preload="auto"
          />

          <div
            className={[
              "pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-200",
              showControls || !isPlaying ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            <button
              type="button"
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
              onClick={(event) => {
                event.stopPropagation();
                togglePlayback();
              }}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden>
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-current" aria-hidden>
                  <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l11.04-6.86a1 1 0 0 0 0-1.7L9.54 4.3A1 1 0 0 0 8 5.14Z" />
                </svg>
              )}
            </button>
          </div>

          <div
            className={[
              "pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-8 transition-opacity duration-200",
              showControls || !isPlaying ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.05}
              value={Math.min(currentTime, duration || 0)}
              aria-label="Seek video"
              className="pointer-events-auto h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
              onChange={(event) => {
                handleSeek(Number(event.target.value));
              }}
              onClick={(event) => event.stopPropagation()}
            />
            <div className="pointer-events-none mt-1.5 flex items-center justify-between text-[11px] font-medium tabular-nums text-white/90">
              <span>{formatPlaybackTime(currentTime)}</span>
              <span>{formatPlaybackTime(duration)}</span>
            </div>
          </div>
        </div>

        <audio
          ref={bgmRef}
          src={CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL}
          loop
          preload="auto"
          className="hidden"
          aria-hidden
        />

        {phrase.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div
              className="absolute inset-x-0 flex justify-center"
              style={{
                top: `${subtitlePreset.webSubtitleTop * 100}%`,
                transform: "translateY(-50%)",
              }}
            >
              <div
                key={`${theme}-chunk-${phraseBlockStart}`}
                className="inline-flex max-w-[92%] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2"
              >
                {phrase.map((entry) => {
                  const isActive = entry.index === activeWordIndex;
                  const transcriptWord = normalizedTranscript[entry.index];

                  return (
                    <span
                      key={entry.index}
                      className="inline-block"
                      style={{
                        ...getWebSubtitleWordStyle(
                          subtitlePreset,
                          isActive,
                          transcriptWord.highlight === true,
                        ),
                        fontSize: `${subtitlePreset.webFontSizePx}px`,
                      }}
                    >
                      {formatPhraseDisplayWord(entry.word, subtitlePreset)}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);
