"use client";

import { useEffect, useRef } from "react";

import type { TranscriptData } from "@/types/transcript";

export interface TranscriptSidebarProps {
  transcript: TranscriptData;
  activeWordIndex: number;
  onSeek: (seconds: number, wordIndex: number) => void;
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function isElementVisibleInContainer(element: HTMLElement, container: HTMLElement): boolean {
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
}

export function TranscriptSidebar({ transcript, activeWordIndex, onSeek }: TranscriptSidebarProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const previousActiveIndexRef = useRef(-1);

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
    <aside className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Transcript</p>
        <p className="mt-1 text-sm text-slate-400">{transcript.length} words · click to seek</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-1">
          {transcript.map((entry, index) => {
            const isActive = index === activeWordIndex;
            return (
              <li key={`${index}-${entry.start}`}>
                <button
                  ref={isActive ? activeItemRef : null}
                  type="button"
                  onClick={() => onSeek(entry.start, index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                    isActive
                      ? "bg-violet-500/20 ring-1 ring-violet-400/40"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="w-14 shrink-0 font-mono text-xs text-slate-500">
                    {formatTimestamp(entry.start)}
                  </span>
                  <span
                    className={`flex-1 text-sm ${
                      entry.highlight ? "font-semibold text-yellow-300" : "text-slate-200"
                    } ${isActive ? "text-white" : ""}`}
                  >
                    {entry.word}
                  </span>
                  {entry.highlight && (
                    <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fuchsia-200">
                      {entry.effect ?? "fx"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
