"use client";

import { Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

  async function handleExport(): Promise<void> {
    setIsExporting(true);

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

      toast.success(
        payload.message ?? "Project injected into CapCut! Re-open your latest project in CapCut.",
      );
    } catch (caughtError: unknown) {
      toast.error(
        caughtError instanceof Error ? caughtError.message : "Local CapCut export failed.",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
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
  );
}
