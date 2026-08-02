"use client";

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

export function ProcessingLoader({ status, highlightCount, wordCount }: ProcessingLoaderProps): JSX.Element {
  const activeIndex = getStepIndex(status);
  const progressPercent =
    status === "completed"
      ? 100
      : status === "failed"
        ? 0
        : Math.max(8, ((activeIndex + 1) / STATUS_STEPS.length) * 100);

  return (
    <section className="mt-8 w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">Processing</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {status === "failed" ? "Processing failed" : STATUS_STEPS[Math.max(activeIndex, 0)]?.label ?? "Working"}
          </h2>
        </div>
        {status !== "failed" && (
          <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
            Live
          </span>
        )}
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === "failed" ? "bg-rose-500" : "bg-gradient-to-r from-violet-500 to-fuchsia-500"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="mt-6 space-y-3">
        {STATUS_STEPS.map((step, index) => {
          const isComplete = status === "completed" || index < activeIndex;
          const isCurrent = index === activeIndex && status !== "completed" && status !== "failed";

          return (
            <li
              key={step.key}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                isCurrent
                  ? "border-violet-400/40 bg-violet-500/10"
                  : isComplete
                    ? "border-emerald-400/20 bg-emerald-500/5"
                    : "border-white/5 bg-transparent"
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isComplete
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-violet-500 text-white"
                      : "bg-white/10 text-slate-400"
                }`}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{step.label}</p>
                <p className="text-xs text-slate-400">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {status === "completed" && wordCount !== undefined && (
        <p className="mt-5 text-sm text-emerald-400">
          {wordCount} words transcribed · {highlightCount ?? 0} accents decorated
        </p>
      )}

      {status === "failed" && (
        <p className="mt-5 text-sm text-rose-400">
          Something went wrong while processing this clip. Try uploading again.
        </p>
      )}
    </section>
  );
}
