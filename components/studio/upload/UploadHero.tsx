"use client";

import { Star } from "lucide-react";
import type { ReactNode } from "react";

import { BeforeAfterCard } from "@/components/studio/upload/BeforeAfterCard";
import { Dropzone } from "@/components/studio/upload/Dropzone";

export interface UploadHeroProps {
  onFile: (file: File | null) => void;
  onSample?: () => void;
  disabled?: boolean;
  busyLabel?: string;
  footer?: ReactNode;
}

export function UploadHero({
  onFile,
  onSample,
  disabled,
  busyLabel,
  footer,
}: UploadHeroProps): JSX.Element {
  return (
    <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 pb-6 md:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative flex w-full max-w-2xl flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
          <Star className="size-3.5 fill-primary text-primary" />
          1500+ 5 star reviews
        </span>

        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold leading-[1.05] md:text-4xl">
            Edit shorts 10x faster with AI
          </h1>
          <p className="text-sm text-muted-foreground">
            Drop a raw take. Get word-perfect captions, a themed overlay and an export-ready short.
          </p>
        </div>

        <Dropzone onFile={onFile} disabled={disabled} busyLabel={busyLabel} />
        {onSample ? (
          <button
            type="button"
            onClick={onSample}
            disabled={disabled}
            className="-mt-2 text-xs font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary disabled:opacity-50"
          >
            Or explore a sample project
          </button>
        ) : null}
        {footer}
        <BeforeAfterCard />
      </div>
    </section>
  );
}
