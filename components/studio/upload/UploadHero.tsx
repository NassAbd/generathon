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
    <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 pb-6 md:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold leading-[1.05] md:text-4xl">
            Edit shorts 10x faster with AI
          </h1>
          <p className="text-sm text-muted-foreground">
            Drop a raw take. Get word-perfect captions, a themed overlay and an export-ready short.
          </p>
        </div>

        <Dropzone onFile={onFile} disabled={disabled} busyLabel={busyLabel} />

        <div className="w-full">{mediaSlot ?? <BeforeAfterCard />}</div>
      </div>
    </section>
  );
}
