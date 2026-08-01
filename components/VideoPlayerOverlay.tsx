"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  getAssetEmojiFallback,
  normalizeAssetUrl,
} from "@/lib/assets/catalog";
import { collectSfxUrls, preloadImageAssets } from "@/lib/player/preloadAssets";
import { SfxManager } from "@/lib/player/sfxManager";
import { findActiveWordIndex, getPhraseWindow, normalizeTranscript } from "@/lib/player/transcriptIndex";
import type { TranscriptData, TranscriptWord } from "@/types/transcript";
import { THEME_PRESETS, type ThemeId } from "@/types/theme";

const OVERLAY_DEBUG = process.env.NODE_ENV === "development";

export interface VideoPlayerOverlayHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

export interface VideoPlayerOverlayProps {
  videoUrl: string;
  transcript: TranscriptData;
  theme: ThemeId;
  onActiveWordChange?: (index: number) => void;
}

interface AssetBadgeProps {
  assetUrl?: string;
  effect?: TranscriptWord["effect"];
  word: string;
  glowClass: string;
}

function AssetBadge({ assetUrl, effect, word, glowClass }: AssetBadgeProps): JSX.Element {
  const resolvedUrl = normalizeAssetUrl(assetUrl);
  const emojiFallback = getAssetEmojiFallback(resolvedUrl ?? assetUrl, effect);
  const [useEmoji, setUseEmoji] = useState(!resolvedUrl);

  useEffect(() => {
    setUseEmoji(!resolvedUrl);
  }, [resolvedUrl, word]);

  return (
    <div
      className={`flex h-24 w-24 items-center justify-center rounded-2xl border border-white/20 bg-black/45 p-2 backdrop-blur-md ${glowClass}`}
    >
      {useEmoji ? (
        <span className="select-none text-6xl leading-none" role="img" aria-label={word}>
          {emojiFallback}
        </span>
      ) : (
        <img
          src={resolvedUrl}
          alt={word}
          className="h-full w-full object-contain"
          onError={() => {
            console.warn("[VideoPlayerOverlay] Asset image failed, using emoji fallback:", resolvedUrl);
            setUseEmoji(true);
          }}
        />
      )}
    </div>
  );
}

function effectClass(effect: TranscriptWord["effect"] | undefined, theme: ThemeId): string {
  if (!effect) return "";
  if (theme === "cyberpunk" && effect === "glow") return "animate-glitch";
  if (effect === "bounce") return "animate-bounce-word";
  if (effect === "shake") return "animate-shake-word";
  if (effect === "glow") return "animate-glow-word";
  return "";
}

function logSyncDebug(currentTime: number, index: number, transcript: TranscriptData): void {
  if (!OVERLAY_DEBUG || index < 0) return;
  const word = transcript[index];
  console.log("[VideoPlayerOverlay] sync", {
    currentTime: Number(currentTime.toFixed(3)),
    activeWord: word.word,
    highlight: word.highlight,
    asset_url: word.asset_url ?? null,
    range: `${word.start.toFixed(2)}–${word.end.toFixed(2)}`,
  });
}

export const VideoPlayerOverlay = forwardRef<VideoPlayerOverlayHandle, VideoPlayerOverlayProps>(
  function VideoPlayerOverlay({ videoUrl, transcript, theme, onActiveWordChange }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sfxManagerRef = useRef(new SfxManager());
    const activeIndexRef = useRef(-1);
    const rafRef = useRef<number | null>(null);
    const onActiveWordChangeRef = useRef(onActiveWordChange);

    const normalizedTranscript = useMemo(() => normalizeTranscript(transcript), [transcript]);

    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const themePreset = THEME_PRESETS[theme];
    const activeWord = activeWordIndex >= 0 ? normalizedTranscript[activeWordIndex] : null;
    const phrase = getPhraseWindow(normalizedTranscript, activeWordIndex, 2);

    const applyActiveIndex = useCallback(
      (nextIndex: number, currentTime: number) => {
        if (nextIndex === activeIndexRef.current) return;

        activeIndexRef.current = nextIndex;
        setActiveWordIndex(nextIndex);
        onActiveWordChangeRef.current?.(nextIndex);
        logSyncDebug(currentTime, nextIndex, normalizedTranscript);

        const word = nextIndex >= 0 ? normalizedTranscript[nextIndex] : null;
        if (word?.highlight && word.sfx_url) {
          void sfxManagerRef.current.unlock().then(() => {
            sfxManagerRef.current.play(word.sfx_url, nextIndex);
          });
        }
      },
      [normalizedTranscript],
    );

    const syncToVideoTime = useCallback(
      (currentTime: number) => {
        applyActiveIndex(findActiveWordIndex(normalizedTranscript, currentTime), currentTime);
      },
      [applyActiveIndex, normalizedTranscript],
    );

    useImperativeHandle(ref, () => ({
      seekTo(seconds: number) {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        sfxManagerRef.current.reset();
        activeIndexRef.current = -1;
        syncToVideoTime(seconds);
      },
      getCurrentTime() {
        return videoRef.current?.currentTime ?? 0;
      },
    }), [syncToVideoTime]);

    useEffect(() => {
      onActiveWordChangeRef.current = onActiveWordChange;
    }, [onActiveWordChange]);

    useEffect(() => {
      void preloadImageAssets(normalizedTranscript);
      void sfxManagerRef.current.preload(collectSfxUrls(normalizedTranscript));
    }, [normalizedTranscript]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const tick = (): void => {
        syncToVideoTime(video.currentTime);
        rafRef.current = requestAnimationFrame(tick);
      };

      const handleTimeUpdate = (): void => {
        syncToVideoTime(video.currentTime);
      };

      const handlePlay = (): void => {
        void sfxManagerRef.current.unlock();
      };

      rafRef.current = requestAnimationFrame(tick);
      video.addEventListener("timeupdate", handleTimeUpdate);
      video.addEventListener("play", handlePlay);
      video.addEventListener("seeked", handleTimeUpdate);

      return () => {
        video.removeEventListener("timeupdate", handleTimeUpdate);
        video.removeEventListener("play", handlePlay);
        video.removeEventListener("seeked", handleTimeUpdate);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        sfxManagerRef.current.reset();
      };
    }, [syncToVideoTime]);

    return (
      <div className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glow">
        <video
          ref={videoRef}
          className="relative z-0 aspect-[9/16] w-full bg-black object-contain"
          src={videoUrl}
          controls
          playsInline
          preload="auto"
        />

        <div className="pointer-events-none absolute inset-0 z-20">
          <div className="absolute inset-x-0 bottom-0 flex justify-center p-6">
            <div
              className={`inline-flex max-w-[92%] flex-wrap items-center justify-center gap-2 rounded-full px-5 py-3 ${themePreset.pillClass}`}
            >
              {phrase.length === 0 ? (
                <span className={`text-sm ${themePreset.subtitleClass}`}>Press play to preview subtitles</span>
              ) : (
                phrase.map((entry) => {
                  const isActive = entry.index === activeWordIndex;
                  return (
                    <span
                      key={entry.index}
                      className={[
                        "inline-block px-1 transition-transform duration-150",
                        themePreset.subtitleClass,
                        entry.highlight ? themePreset.highlightClass : "",
                        isActive && entry.effect
                          ? effectClass(entry.effect as TranscriptWord["effect"], theme)
                          : "",
                        isActive ? "opacity-100" : "opacity-70",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {entry.word}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="absolute right-6 top-6">
            <AnimatePresence mode="wait">
              {activeWord?.highlight && (
                <motion.div
                  key={`${activeWordIndex}-${activeWord.word}`}
                  initial={{ opacity: 0, scale: 0.35, y: 28, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.65, y: -16, rotate: 6 }}
                  transition={{ type: "spring", stiffness: 460, damping: 20 }}
                >
                  <AssetBadge
                    assetUrl={activeWord.asset_url}
                    effect={activeWord.effect}
                    word={activeWord.word}
                    glowClass={themePreset.assetGlowClass}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  },
);
