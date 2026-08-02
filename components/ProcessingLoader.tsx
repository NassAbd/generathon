"use client";

import { MEDIA_SLOT_SHELL_CLASS } from "@/components/studio/upload/mediaSlot";
import type { ProjectStatus } from "@/lib/supabase/client";

const STATUS_STEPS: Array<{ key: ProjectStatus; label: string; description: string }> = [
  { key: "uploading", label: "Uploading", description: "Sending your clip to storage" },
  { key: "transcribing", label: "Transcribing", description: "Extracting word-level timestamps" },
  { key: "decorating", label: "Decorating", description: "Mapping punchy words to motion assets" },
  { key: "completed", label: "Ready", description: "Transcript enriched and synced" },
];

function getStepIndex(status: ProjectStatus): number {
  if (status === "failed") return -1;
  const index = STATUS_STEPS.findIndex((step) => step.key === status);
  return index === -1 ? 0 : index;
}

export interface ProcessingLoaderProps {
  status: ProjectStatus;
  highlightCount?: number;
  wordCount?: number;
}

/** Occupies the same landing-page slot (and height) as BeforeAfterCard during processing. */
export function ProcessingLoader({ status, highlightCount, wordCount }: ProcessingLoaderProps): JSX.Element {
  const activeIndex = getStepIndex(status);
  const progressPercent =
    status === "completed"
      ? 100
      : status === "failed"
        ? 0
        : Math.max(8, ((activeIndex + 1) / STATUS_STEPS.length) * 100);

  return (
    <section className={`${MEDIA_SLOT_SHELL_CLASS} text-left`}>
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
            Processing
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold sm:text-xl">
            {status === "failed"
              ? "Processing failed"
              : STATUS_STEPS[Math.max(activeIndex, 0)]?.label ?? "Working"}
          </h2>
        </div>
        {status !== "failed" ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Live
          </span>
        ) : null}
      </div>

      <div className="mt-4 h-2 shrink-0 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {STATUS_STEPS.map((step, index) => {
          const isDone = status === "completed" || (activeIndex > index && status !== "failed");
          const isActive = activeIndex === index && status !== "completed" && status !== "failed";
          return (
            <li
              key={step.key}
              className={`rounded-xl px-3 py-2 text-sm sm:px-4 sm:py-2.5 sm:text-base ${
                isActive ? "bg-accent text-foreground" : "text-muted-foreground"
              }`}
            >
              <p className="font-medium">
                {isDone ? "✓ " : isActive ? "→ " : ""}
                {step.label}
              </p>
              <p className="text-xs opacity-80 sm:text-sm">{step.description}</p>
            </li>
          );
        })}
      </ol>

      {status === "completed" && wordCount !== undefined ? (
        <p className="mt-3 shrink-0 text-sm text-primary sm:text-base">
          {wordCount} words transcribed · {highlightCount ?? 0} accents decorated
        </p>
      ) : null}

      {status === "failed" ? (
        <p className="mt-3 shrink-0 text-sm text-destructive">
          Something went wrong while processing this clip. Try uploading again.
        </p>
      ) : null}
    </section>
  );
}
