"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from "react";

import { collectCapCutSfxUrls, preloadBgmAudio } from "@/lib/player/preloadAssets";
import {
  applyBgmVolume,
  pauseBgm,
  playBgmWithVideo,
  syncBgmCurrentTime,
  syncBgmMutedState,
} from "@/lib/player/bgmSync";
import {
  rebuildTriggeredKeywordSfx,
  syncKeywordSfxAtTime,
} from "@/lib/player/keywordSfxSync";
import { SfxManager } from "@/lib/player/sfxManager";
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
  computeSplitScreenTrackingLayout,
  mapNormalizedFaceCenterXToOffsetPercentX,
  needsVerticalCropReframe,
  resolveSpeakerSegmentAtTime,
  SPLIT_SCREEN_DEFAULT_LEFT_CENTER_X,
  SPLIT_SCREEN_DEFAULT_RIGHT_CENTER_X,
  type ShotLayoutType,
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

function segmentShotKey(segment: SpeakerOffsetSegment): string {
  if (segment.layoutType === "split-screen") {
    return [
      segment.startSeconds,
      segment.endSeconds,
      "split",
      segment.leftOffsetPercentX ?? 0,
      segment.rightOffsetPercentX ?? 0,
    ].join(":");
  }

  return [segment.startSeconds, segment.endSeconds, "single", segment.offsetPercentX].join(":");
}

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
    const splitTopVideoRef = useRef<HTMLVideoElement>(null);
    const splitBottomVideoRef = useRef<HTMLVideoElement>(null);
    const bgmRef = useRef<HTMLAudioElement>(null);
    const sfxManagerRef = useRef(new SfxManager());
    const activeIndexRef = useRef(-1);
    const videoDimensionsRef = useRef<VideoSourceDimensions | null>(null);
    const faceDetectionStartedRef = useRef(false);
    const triggeredKeywordSfxRef = useRef<Set<number>>(new Set());
    const rafRef = useRef<number | null>(null);
    const onActiveWordChangeRef = useRef(onActiveWordChange);
    const onVideoDimensionsChangeRef = useRef(onVideoDimensionsChange);
    const onSpeakerOffsetChangeRef = useRef(onSpeakerOffsetChange);
    const onSpeakerOffsetSegmentsChangeRef = useRef(onSpeakerOffsetSegmentsChange);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const speakerSegmentsRef = useRef<SpeakerOffsetSegment[]>([]);
    const activeSegmentKeyRef = useRef("");
    const layoutModeRef = useRef<ShotLayoutType>("single");

    const normalizedTranscript = useMemo(() => normalizeTranscript(transcript), [transcript]);
    const subtitlePreset = getSubtitlePreset(theme);

    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [reframeState, setReframeState] = useState(DEFAULT_REFRAME);
    const [layoutMode, setLayoutMode] = useState<ShotLayoutType>("single");
    layoutModeRef.current = layoutMode;
    const [activePanOffsetX, setActivePanOffsetX] = useState(0);
    const [topPanOffsetX, setTopPanOffsetX] = useState(0);
    const [bottomPanOffsetX, setBottomPanOffsetX] = useState(0);
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
      sfxManagerRef.current.setMuted(video.muted);
    }, []);

    const triggerKeywordSfx = useCallback((wordIndex: number, url: string) => {
      void sfxManagerRef.current.unlock().then(() => {
        sfxManagerRef.current.play(url, wordIndex);
      });
    }, []);

    const syncPlaybackAudio = useCallback(
      (currentTime: number) => {
        syncKeywordSfxAtTime(
          normalizedTranscript,
          currentTime,
          triggeredKeywordSfxRef.current,
          triggerKeywordSfx,
        );
      },
      [normalizedTranscript, triggerKeywordSfx],
    );

    const applyActiveIndex = useCallback(
      (nextIndex: number) => {
        if (nextIndex === activeIndexRef.current) return;

        activeIndexRef.current = nextIndex;
        setActiveWordIndex(nextIndex);
        onActiveWordChangeRef.current?.(nextIndex);
      },
      [],
    );

    const syncToVideoTime = useCallback(
      (currentTime: number) => {
        syncPlaybackAudio(currentTime);
        applyActiveIndex(findActiveWordIndex(normalizedTranscript, currentTime));
      },
      [applyActiveIndex, normalizedTranscript, syncPlaybackAudio],
    );

    const resetAudioForSeek = useCallback((seconds: number) => {
      sfxManagerRef.current.reset();
      triggeredKeywordSfxRef.current = rebuildTriggeredKeywordSfx(normalizedTranscript, seconds);

      const video = videoRef.current;
      const bgm = bgmRef.current;
      if (video && bgm) {
        syncBgmCurrentTime(video, bgm);
      }
    }, [normalizedTranscript]);

    const applyReframeBase = useCallback((width: number, height: number) => {
      const layout = computeSpeakerTrackingLayout(width, height, 0);
      setReframeState({
        needsReframe: layout.needsReframe,
        coverScale: layout.coverScale,
      });
    }, []);

    const syncSplitMirrorVideos = useCallback((masterVideo: HTMLVideoElement) => {
      const topVideo = splitTopVideoRef.current;
      const bottomVideo = splitBottomVideoRef.current;
      if (!topVideo || !bottomVideo) {
        return;
      }

      const masterTime = masterVideo.currentTime;

      if (Math.abs(topVideo.currentTime - masterTime) > 0.05) {
        topVideo.currentTime = masterTime;
      }
      if (Math.abs(bottomVideo.currentTime - masterTime) > 0.05) {
        bottomVideo.currentTime = masterTime;
      }

      if (masterVideo.paused) {
        if (!topVideo.paused) {
          topVideo.pause();
        }
        if (!bottomVideo.paused) {
          bottomVideo.pause();
        }
        return;
      }

      if (topVideo.paused) {
        void topVideo.play().catch(() => undefined);
      }
      if (bottomVideo.paused) {
        void bottomVideo.play().catch(() => undefined);
      }
    }, []);

    const publishPlaybackTime = useCallback((timeSeconds: number) => {
      setCurrentTime(timeSeconds);
      onTimeUpdateRef.current?.(timeSeconds);
    }, []);

    const syncShotLayoutForTime = useCallback((timeSeconds: number) => {
      const segment = resolveSpeakerSegmentAtTime(speakerSegmentsRef.current, timeSeconds);
      const dimensions = videoDimensionsRef.current;
      if (!segment || !dimensions) {
        return;
      }

      const segmentKey = segmentShotKey(segment);
      if (segmentKey === activeSegmentKeyRef.current) {
        return;
      }

      activeSegmentKeyRef.current = segmentKey;

      if (segment.layoutType === "split-screen") {
        const leftRaw =
          segment.leftOffsetPercentX ??
          mapNormalizedFaceCenterXToOffsetPercentX(SPLIT_SCREEN_DEFAULT_LEFT_CENTER_X);
        const rightRaw =
          segment.rightOffsetPercentX ??
          mapNormalizedFaceCenterXToOffsetPercentX(SPLIT_SCREEN_DEFAULT_RIGHT_CENTER_X);
        const splitLayout = computeSplitScreenTrackingLayout(
          dimensions.width,
          dimensions.height,
          leftRaw,
          rightRaw,
        );

        setLayoutMode("split-screen");
        setReframeState({
          needsReframe: splitLayout.needsReframe,
          coverScale: splitLayout.coverScale,
        });
        setTopPanOffsetX(splitLayout.topHalf.offsetPercentX);
        setBottomPanOffsetX(splitLayout.bottomHalf.offsetPercentX);
        setActivePanOffsetX(0);
        return;
      }

      const singleLayout = computeSpeakerTrackingLayout(
        dimensions.width,
        dimensions.height,
        segment.offsetPercentX,
      );

      setLayoutMode("single");
      setReframeState({
        needsReframe: singleLayout.needsReframe,
        coverScale: singleLayout.coverScale,
      });
      setActivePanOffsetX(singleLayout.offsetPercentX);
      setTopPanOffsetX(0);
      setBottomPanOffsetX(0);
    }, []);

    const phraseBoundaryStarts = useMemo(() => {
      const blockSize = subtitlePreset.phraseBlockSize;
      const starts: number[] = [];

      for (let index = 0; index < normalizedTranscript.length; index += blockSize) {
        starts.push(normalizedTranscript[index].start);
      }

      return starts;
    }, [normalizedTranscript, subtitlePreset.phraseBlockSize]);

    const runFaceTracking = useCallback(async (video: HTMLVideoElement, width: number, height: number) => {
      if (typeof window === "undefined") {
        return;
      }

      if (!needsVerticalCropReframe(width, height) || faceDetectionStartedRef.current) {
        return;
      }

      faceDetectionStartedRef.current = true;

      try {
        const { detectSpeakerOffsetSegments } = await import("@/lib/capcut/face-tracker");
        const detection = await detectSpeakerOffsetSegments(video, {
          phraseStarts: phraseBoundaryStarts,
          durationSeconds: video.duration,
        });

        speakerSegmentsRef.current = detection.segments;
        activeSegmentKeyRef.current = "";
        applyReframeBase(width, height);
        syncShotLayoutForTime(video.currentTime);
        onSpeakerOffsetChangeRef.current?.(detection.offsetPercentX);
        onSpeakerOffsetSegmentsChangeRef.current?.(detection.segments);
      } catch (error: unknown) {
        console.warn("[VideoPlayerOverlay] Face tracking failed; using centered crop.", error);
        console.info("[FaceTracker] Result offset: 0% (overlay fallback)");
        speakerSegmentsRef.current = [];
        activeSegmentKeyRef.current = "";
        setLayoutMode("single");
        setActivePanOffsetX(0);
        setTopPanOffsetX(0);
        setBottomPanOffsetX(0);
        applyReframeBase(width, height);
        onSpeakerOffsetChangeRef.current?.(0);
        onSpeakerOffsetSegmentsChangeRef.current?.([]);
      }
    }, [applyReframeBase, phraseBoundaryStarts, syncShotLayoutForTime]);

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
      speakerSegmentsRef.current = [];
      activeSegmentKeyRef.current = "";
      setLayoutMode("single");
      setActivePanOffsetX(0);
      setTopPanOffsetX(0);
      setBottomPanOffsetX(0);
      applyReframeBase(nextDimensions.width, nextDimensions.height);
      onVideoDimensionsChangeRef.current?.(nextDimensions.width, nextDimensions.height);
      void runFaceTracking(video, nextDimensions.width, nextDimensions.height);
    }, [applyReframeBase, runFaceTracking]);

    const togglePlayback = useCallback(() => {
      const video = videoRef.current;
      const bgm = bgmRef.current;
      if (!video) {
        return;
      }

      if (video.paused) {
        void sfxManagerRef.current.unlock();
        void video.play().then(() => {
          if (layoutModeRef.current === "split-screen") {
            syncSplitMirrorVideos(video);
          }
        }).catch(() => undefined);
        if (bgm) {
          void playBgmWithVideo(video, bgm);
        }
      } else {
        video.pause();
        splitTopVideoRef.current?.pause();
        splitBottomVideoRef.current?.pause();
        if (bgm) {
          pauseBgm(bgm);
        }
      }
    }, [syncSplitMirrorVideos]);

    const handleSeek = useCallback(
      (nextTime: number) => {
        const video = videoRef.current;
        if (!video || !Number.isFinite(nextTime)) {
          return;
        }

        video.currentTime = nextTime;
        resetAudioForSeek(nextTime);
        publishPlaybackTime(nextTime);
        syncShotLayoutForTime(nextTime);
        if (layoutModeRef.current === "split-screen") {
          syncSplitMirrorVideos(video);
        }
        syncToVideoTime(nextTime);
      },
      [publishPlaybackTime, resetAudioForSeek, syncShotLayoutForTime, syncSplitMirrorVideos, syncToVideoTime],
    );
    useImperativeHandle(ref, () => ({
      seekTo(seconds: number) {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        resetAudioForSeek(seconds);
        activeIndexRef.current = -1;
        publishPlaybackTime(seconds);
        syncShotLayoutForTime(seconds);
        if (layoutModeRef.current === "split-screen" && video) {
          syncSplitMirrorVideos(video);
        }
        syncToVideoTime(seconds);
      },
      getCurrentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
      getVideoDimensions() {
        return videoDimensionsRef.current;
      },
    }), [publishPlaybackTime, resetAudioForSeek, syncShotLayoutForTime, syncSplitMirrorVideos, syncToVideoTime]);

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
      const masterVideo = videoRef.current;
      if (!masterVideo || layoutMode !== "split-screen") {
        return;
      }

      syncSplitMirrorVideos(masterVideo);
    }, [layoutMode, syncSplitMirrorVideos, topPanOffsetX, bottomPanOffsetX]);

    useEffect(() => {
      faceDetectionStartedRef.current = false;
      speakerSegmentsRef.current = [];
      activeSegmentKeyRef.current = "";
      setLayoutMode("single");
      setActivePanOffsetX(0);
      setTopPanOffsetX(0);
      setBottomPanOffsetX(0);
    }, [videoUrl]);

    useEffect(() => {
      sfxManagerRef.current.setVolume(CAPCUT_EXPORT_AUDIO.sfxVolume);
    }, []);

    useEffect(() => {
      const bgm = bgmRef.current;
      if (bgm) {
        applyBgmVolume(bgm);
      }
    }, []);

    useEffect(() => {
      void preloadBgmAudio();
      void sfxManagerRef.current.preload(collectCapCutSfxUrls(normalizedTranscript));
    }, [normalizedTranscript]);

    useEffect(() => {
      const video = videoRef.current;
      const bgm = bgmRef.current;
      if (!video || !bgm) return;

      const tick = (): void => {
        const timeSeconds = video.currentTime;
        publishPlaybackTime(timeSeconds);
        syncShotLayoutForTime(timeSeconds);
        if (layoutModeRef.current === "split-screen") {
          syncSplitMirrorVideos(video);
        }
        syncToVideoTime(timeSeconds);
        rafRef.current = requestAnimationFrame(tick);
      };

      const handleTimeUpdate = (): void => {
        const timeSeconds = video.currentTime;
        publishPlaybackTime(timeSeconds);
        syncShotLayoutForTime(timeSeconds);
        if (layoutModeRef.current === "split-screen") {
          syncSplitMirrorVideos(video);
        }
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
        void sfxManagerRef.current.unlock();
        void playBgmWithVideo(video, bgm);
        if (layoutModeRef.current === "split-screen") {
          syncSplitMirrorVideos(video);
        }
      };

      const handlePause = (): void => {
        setIsPlaying(false);
        pauseBgm(bgm);
        splitTopVideoRef.current?.pause();
        splitBottomVideoRef.current?.pause();
      };

      const handleSeeked = (): void => {
        const timeSeconds = video.currentTime;
        publishPlaybackTime(timeSeconds);
        syncShotLayoutForTime(timeSeconds);
        if (layoutModeRef.current === "split-screen") {
          syncSplitMirrorVideos(video);
        }
        resetAudioForSeek(timeSeconds);
        syncToVideoTime(timeSeconds);
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
        sfxManagerRef.current.reset();
      };
    }, [
      captureVideoDimensions,
      resetAudioForSeek,
      syncToVideoTime,
      syncVideoAudioMix,
      syncShotLayoutForTime,
      syncSplitMirrorVideos,
      publishPlaybackTime,
    ]);

    const halfTransform = (offsetX: number): CSSProperties | undefined =>
      reframeState.needsReframe
        ? {
            transform: `scale(${reframeState.coverScale}) translateX(${offsetX}%)`,
            transformOrigin: "center center",
          }
        : undefined;

    const singleVideoTransformStyle = halfTransform(activePanOffsetX);

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
            className={
              layoutMode === "split-screen" && reframeState.needsReframe
                ? "hidden"
                : "relative z-10 h-full w-full bg-black object-contain"
            }
            style={layoutMode === "single" ? singleVideoTransformStyle : undefined}
            src={videoUrl}
            crossOrigin="anonymous"
            playsInline
            preload="auto"
          />
          {layoutMode === "split-screen" && reframeState.needsReframe ? (
            <>
              <div className="absolute inset-x-0 top-0 z-10 h-1/2 overflow-hidden bg-black">
                <video
                  ref={splitTopVideoRef}
                  className="h-full w-full bg-black object-contain"
                  style={halfTransform(topPanOffsetX)}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  muted
                  playsInline
                  preload="auto"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 z-10 h-1/2 overflow-hidden border-t border-white/10 bg-black">
                <video
                  ref={splitBottomVideoRef}
                  className="h-full w-full bg-black object-contain"
                  style={halfTransform(bottomPanOffsetX)}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  muted
                  playsInline
                  preload="auto"
                />
              </div>
            </>
          ) : null}

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
              {phrase.length === 0 ? (
                <span
                  className="text-sm"
                  style={getWebSubtitleWordStyle(subtitlePreset, false)}
                >
                  Press play to preview subtitles
                </span>
              ) : (
                phrase.map((entry) => {
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
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
