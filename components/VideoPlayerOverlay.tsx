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
import type { ThemeId } from "@/types/theme";
import {
  getSubtitlePreset,
  getWebSubtitleWordStyle,
  formatPhraseDisplayWord,
} from "@/lib/capcut/presets";

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
  sizePx: number;
}

function AssetBadge({ assetUrl, effect, word, glowClass, sizePx }: AssetBadgeProps): JSX.Element {
  const resolvedUrl = normalizeAssetUrl(assetUrl);
  const emojiFallback = getAssetEmojiFallback(resolvedUrl ?? assetUrl, effect);
  const [useEmoji, setUseEmoji] = useState(!resolvedUrl);

  useEffect(() => {
    setUseEmoji(!resolvedUrl);
  }, [resolvedUrl, word]);

  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-white/20 bg-black/45 p-2 backdrop-blur-md transition-all duration-200 ${glowClass}`}
      style={{ width: sizePx, height: sizePx }}
    >
      {useEmoji ? (
        <span
          className="select-none leading-none"
          style={{ fontSize: Math.round(sizePx * 0.58) }}
          role="img"
          aria-label={word}
        >
          {emojiFallback}
        </span>
      ) : (
        <img
          src={resolvedUrl}
          alt={word}
          className="h-full w-full object-contain"
          onError={() => setUseEmoji(true)}
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

export const VideoPlayerOverlay = forwardRef<VideoPlayerOverlayHandle, VideoPlayerOverlayProps>(
  function VideoPlayerOverlay({ videoUrl, transcript, theme, onActiveWordChange }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const sfxManagerRef = useRef(new SfxManager());
    const activeIndexRef = useRef(-1);
    const rafRef = useRef<number | null>(null);
    const onActiveWordChangeRef = useRef(onActiveWordChange);

    const normalizedTranscript = useMemo(() => normalizeTranscript(transcript), [transcript]);
    const subtitlePreset = getSubtitlePreset(theme);

    const [activeWordIndex, setActiveWordIndex] = useState(-1);
    const activeWord = activeWordIndex >= 0 ? normalizedTranscript[activeWordIndex] : null;
    const phrase = getPhraseWindow(normalizedTranscript, activeWordIndex, subtitlePreset.phraseRadius);

    const applyActiveIndex = useCallback(
      (nextIndex: number) => {
        if (nextIndex === activeIndexRef.current) return;

        activeIndexRef.current = nextIndex;
        setActiveWordIndex(nextIndex);
        onActiveWordChangeRef.current?.(nextIndex);

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
        applyActiveIndex(findActiveWordIndex(normalizedTranscript, currentTime));
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
      <div
        data-theme={theme}
        className={`relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black shadow-glow transition-all duration-200 ${subtitlePreset.overlayShellClass}`}
      >
        <video
          ref={videoRef}
          className="relative z-0 aspect-[9/16] w-full bg-black object-contain"
          src={videoUrl}
          controls
          playsInline
          preload="auto"
        />

        <div className="pointer-events-none absolute inset-0 z-20">
          <div
            className="absolute inset-x-0 flex justify-center"
            style={{
              top: `${subtitlePreset.webAssetTop * 100}%`,
              transform: "translateY(-50%)",
            }}
          >
            <AnimatePresence mode="wait">
              {activeWord?.highlight && (
                <motion.div
                  key={`${activeWordIndex}-${activeWord.word}-${theme}`}
                  initial={{ opacity: 0, scale: 0.35, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.65, y: -10 }}
                  transition={{ type: "spring", stiffness: 460, damping: 20 }}
                >
                  <AssetBadge
                    assetUrl={activeWord.asset_url}
                    effect={activeWord.effect}
                    word={activeWord.word}
                    glowClass={subtitlePreset.assetGlowClass}
                    sizePx={subtitlePreset.webAssetSizePx}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className="absolute inset-x-0 flex justify-center"
            style={{
              top: `${subtitlePreset.webSubtitleTop * 100}%`,
              transform: "translateY(-50%)",
            }}
          >
            <div
              key={theme}
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
                  const fontSizePx = isActive
                    ? subtitlePreset.webFontSizePx * subtitlePreset.activeWordScale
                    : subtitlePreset.webFontSizePx;

                  return (
                    <span
                      key={entry.index}
                      className={[
                        "inline-block origin-center transition-all duration-150",
                        isActive && entry.effect ? effectClass(entry.effect as TranscriptWord["effect"], theme) : "",
                        isActive ? "scale-110" : "scale-100",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        ...getWebSubtitleWordStyle(subtitlePreset, isActive),
                        fontSize: `${fontSizePx}px`,
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
