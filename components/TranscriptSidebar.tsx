"use client";

import { useEffect, useRef } from "react";

import { getSubtitlePreset } from "@/lib/capcut/presets";
import { cn } from "@/lib/utils";
import type { ThemeId } from "@/types/theme";
import type { TranscriptData } from "@/types/transcript";

export interface TranscriptSidebarProps {
  transcript: TranscriptData;
  activeWordIndex: number;
  theme: ThemeId;
  onSeek: (seconds: number, wordIndex: number) => void;
}

function formatTimecode(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const whole = Math.floor(remainder);
  const centiseconds = Math.round((remainder - whole) * 100);
  return `${minutes}:${String(whole).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function isElementVisibleInContainer(element: HTMLElement, container: HTMLElement): boolean {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
}

export function TranscriptSidebar({
  transcript,
  activeWordIndex,
  theme,
  onSeek,
}: TranscriptSidebarProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const previousActiveIndexRef = useRef(-1);
  const accent = getSubtitlePreset(theme).activeColor;

  useEffect(() => {
    const container = listRef.current;
    const activeItem = activeItemRef.current;

    if (!container || !activeItem || activeWordIndex < 0) return;
    if (activeWordIndex === previousActiveIndexRef.current) return;

    previousActiveIndexRef.current = activeWordIndex;

    if (!isElementVisibleInContainer(activeItem, container)) {
      activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeWordIndex]);

  return (
    <aside className="flex min-h-0 flex-col rounded-2xl border border-border bg-card/60">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.18em]">Transcript</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {transcript.length} words · click to seek
        </p>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {transcript.map((word, index) => {
          const isActive = index === activeWordIndex;
          return (
            <button
              key={`${word.start}-${index}`}
              ref={isActive ? activeItemRef : undefined}
              type="button"
              onClick={() => onSeek(word.start, index)}
              className={cn(
                "flex w-full items-center gap-4 rounded-lg px-3 py-1.5 text-left text-sm transition-colors",
                isActive ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                {formatTimecode(word.start)}
              </span>
              <span
                className="min-w-0 truncate"
                style={isActive ? { color: accent } : undefined}
              >
                {word.word}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
