"use client";

import { Rocket } from "lucide-react";
import { useState } from "react";

import type { SpeakerOffsetSegment } from "@/lib/capcut/video-effects";
import type { ThemeId } from "@/types/theme";

export interface ExportCapCutLocalButtonProps {
  projectId: string;
  themeId: ThemeId;
  sourceVideoWidth?: number;
  sourceVideoHeight?: number;
  speakerOffsetPercentX?: number;
  speakerOffsetSegments?: SpeakerOffsetSegment[];
}

export function ExportCapCutLocalButton({
  projectId,
  themeId,
  sourceVideoWidth,
  sourceVideoHeight,
  speakerOffsetPercentX,
  speakerOffsetSegments,
}: ExportCapCutLocalButtonProps): JSX.Element {
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    setError(null);
    setToast(null);

    try {
      const response = await fetch("/api/export-capcut-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          themeId,
          ...(sourceVideoWidth !== undefined ? { sourceVideoWidth } : {}),
          ...(sourceVideoHeight !== undefined ? { sourceVideoHeight } : {}),
          ...(speakerOffsetPercentX !== undefined ? { speakerOffsetPercentX } : {}),
          ...(speakerOffsetSegments !== undefined ? { speakerOffsetSegments } : {}),
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Local CapCut export failed.");
      }

      setToast(payload.message ?? "Project injected into CapCut! Re-open your latest project in CapCut.");
      window.setTimeout(() => setToast(null), 4000);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "Local CapCut export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-accent disabled:cursor-wait disabled:opacity-70"
      >
        <Rocket className="size-4" />
        <span className="hidden sm:inline">
          {isExporting ? "Writing to CapCut…" : "Open in CapCut"}
        </span>
      </button>

      {toast ? (
        <p
          className="max-w-xs rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-right text-xs text-primary"
          role="status"
        >
          {toast}
        </p>
      ) : null}

      {error ? <p className="max-w-xs text-right text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
