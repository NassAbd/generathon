"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

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
  needsBackgroundBlurLayer,
} from "@/lib/capcut/video-effects";

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
  className?: string;
}

export const VideoPlayerOverlay = forwardRef<VideoPlayerOverlayHandle, VideoPlayerOverlayProps>(
  function VideoPlayerOverlay(
    { videoUrl, transcript, theme, onActiveWordChange, onVideoDimensionsChange, className },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const backgroundVideoRef = useRef<HTMLVideoElement>(null);
    const bgmRef = useRef<HTMLAudioElement>(null);
    const sfxManagerRef = useRef(new SfxManager());
    const activeIndexRef = useRef(-1);
    const videoDimensionsRef = useRef<VideoSourceDimensions | null>(null);
    const needsBackgroundBlurRef = useRef(false);
    const triggeredKeywordSfxRef = useRef<Set<number>>(new Set());
    const rafRef = useRef<number | null>(null);
    const onActiveWordChangeRef = useRef(onActiveWordChange);
    const onVideoDimensionsChangeRef = useRef(onVideoDimensionsChange);

    const normalizedTranscript = useMemo(() => normalizeTranscript(transcript), [transcript]);
    const subtitlePreset = getSubtitlePreset(theme);

    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const [needsBackgroundBlur, setNeedsBackgroundBlur] = useState(false);

    const phrase = getPhraseWordsForIndex(normalizedTranscript, activeWordIndex, subtitlePreset);
    const phraseBlockStart = getPhraseBlockStartIndex(activeWordIndex, subtitlePreset.phraseBlockSize);

    const syncBackgroundVideo = useCallback((video: HTMLVideoElement) => {
      const backgroundVideo = backgroundVideoRef.current;
      if (!backgroundVideo) {
        return;
      }

      if (Math.abs(backgroundVideo.currentTime - video.currentTime) > 0.05) {
        backgroundVideo.currentTime = video.currentTime;
      }

      if (video.paused) {
        backgroundVideo.pause();
      } else if (backgroundVideo.paused) {
        void backgroundVideo.play().catch(() => undefined);
      }
    }, []);

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

        const video = videoRef.current;
        if (video) {
          syncBackgroundVideo(video);
        }
      },
      [applyActiveIndex, normalizedTranscript, syncBackgroundVideo, syncPlaybackAudio],
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
      if (
        previousDimensions?.width === nextDimensions.width &&
        previousDimensions?.height === nextDimensions.height
      ) {
        return;
      }

      videoDimensionsRef.current = nextDimensions;

      const shouldBlur = needsBackgroundBlurLayer(nextDimensions.width, nextDimensions.height);
      needsBackgroundBlurRef.current = shouldBlur;
      setNeedsBackgroundBlur(shouldBlur);
      onVideoDimensionsChangeRef.current?.(nextDimensions.width, nextDimensions.height);
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo(seconds: number) {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        resetAudioForSeek(seconds);
        activeIndexRef.current = -1;
        syncToVideoTime(seconds);
      },
      getCurrentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
      getVideoDimensions() {
        return videoDimensionsRef.current;
      },
    }), [resetAudioForSeek, syncToVideoTime]);

    useEffect(() => {
      onActiveWordChangeRef.current = onActiveWordChange;
    }, [onActiveWordChange]);

    useEffect(() => {
      onVideoDimensionsChangeRef.current = onVideoDimensionsChange;
    }, [onVideoDimensionsChange]);

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
        syncToVideoTime(video.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };

      const handleTimeUpdate = (): void => {
        syncToVideoTime(video.currentTime);
      };

      const handlePlay = (): void => {
        void sfxManagerRef.current.unlock();
        void playBgmWithVideo(video, bgm);
        syncBackgroundVideo(video);
      };

      const handlePause = (): void => {
        pauseBgm(bgm);
        syncBackgroundVideo(video);
      };

      const handleSeeked = (): void => {
        resetAudioForSeek(video.currentTime);
        syncToVideoTime(video.currentTime);
        if (!video.paused) {
          void playBgmWithVideo(video, bgm);
        }
      };

      const handleVolumeChange = (): void => {
        syncVideoAudioMix(video);
      };

      syncVideoAudioMix(video);
      syncToVideoTime(video.currentTime);
      rafRef.current = requestAnimationFrame(tick);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("play", handlePlay);
      video.addEventListener("pause", handlePause);
      video.addEventListener("seeked", handleSeeked);
      video.addEventListener("volumechange", handleVolumeChange);
      video.addEventListener("loadedmetadata", captureVideoDimensions);

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        captureVideoDimensions();
      }

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("seeked", handleSeeked);
        video.removeEventListener("volumechange", handleVolumeChange);
        video.removeEventListener("loadedmetadata", captureVideoDimensions);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        pauseBgm(bgm);
        sfxManagerRef.current.reset();
      };
    }, [
      captureVideoDimensions,
      resetAudioForSeek,
      syncBackgroundVideo,
      syncToVideoTime,
      syncVideoAudioMix,
    ]);

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
        <video
          ref={backgroundVideoRef}
          aria-hidden
          className={[
            "pointer-events-none absolute inset-0 z-0 h-full w-full object-cover transition-opacity duration-150",
            needsBackgroundBlur || needsBackgroundBlurRef.current
              ? "scale-110 opacity-100 blur-[24px] brightness-[0.6]"
              : "opacity-0",
          ].join(" ")}
          src={videoUrl}
          muted
          playsInline
          preload="auto"
        />

        <video
          ref={videoRef}
          className="relative z-10 h-full max-h-full w-full bg-black object-contain aspect-[9/16]"
          src={videoUrl}
          controls
          playsInline
          preload="auto"
        />

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
