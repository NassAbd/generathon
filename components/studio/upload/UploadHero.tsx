"use client";

import type { ReactNode } from "react";

import { BeforeAfterCard } from "@/components/studio/upload/BeforeAfterCard";
import { Dropzone } from "@/components/studio/upload/Dropzone";

export interface UploadHeroProps {
  onFile: (file: File | null) => void;
  disabled?: boolean;
  busyLabel?: string;
  /**
   * Replaces the Before/After card in-place (same slot) during processing.
   * Pass null/undefined to show BeforeAfterCard.
   */
  mediaSlot?: ReactNode;
}

export function UploadHero({
  onFile,
  disabled,
  busyLabel,
  mediaSlot,
}: UploadHeroProps): JSX.Element {
  return (
    <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 pb-5 md:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative flex w-full max-w-5xl flex-col items-center gap-4 text-center sm:gap-5">
        <div className="max-w-3xl space-y-2.5 sm:space-y-3">
          <h1 className="font-display text-3xl font-bold leading-[1.05] sm:text-4xl lg:text-5xl">
            Edit shorts 10x faster with AI
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            Drop a raw take. Get word-perfect captions, a themed overlay and an export-ready short.
          </p>
        </div>

        <Dropzone onFile={onFile} disabled={disabled} busyLabel={busyLabel} />

        <div className="w-full min-h-0">{mediaSlot ?? <BeforeAfterCard />}</div>
      </div>
    </section>
  );
}
