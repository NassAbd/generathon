"use client";

import { Check, Download, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  downloadBlob,
  exportProjectWithClientCanvas,
} from "@/lib/export/clientCanvasExporter";
import { CAPCUT_EXPORT_AUDIO } from "@/lib/capcut/presets";
import type { TranscriptData } from "@/types/transcript";
import type { ThemeId } from "@/types/theme";

export interface ExportMp4ButtonProps {
  projectId: string;
  themeId: ThemeId;
  videoUrl: string;
  transcript: TranscriptData;
  bgmUrl?: string | null;
}

type Status = "idle" | "exporting" | "done";

export function ExportMp4Button({
  projectId,
  themeId,
  videoUrl,
  transcript,
  bgmUrl,
}: ExportMp4ButtonProps): JSX.Element {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  async function handleExport(): Promise<void> {
    if (status === "exporting") return;

    setStatus("exporting");
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await exportProjectWithClientCanvas({
        videoUrl,
        bgmUrl: bgmUrl || CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL,
        transcript,
        theme: themeId,
        filenameStem: `motion-decorator-${projectId.slice(0, 8)}`,
        signal: controller.signal,
        onProgress: (value) => setProgress(Math.round(value * 100)),
      });

      downloadBlob(result.blob, result.filename);
      setProgress(100);
      setStatus("done");
      toast.success("MP4 exported successfully.");
    } catch (caughtError: unknown) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        toast.message("Export cancelled.");
        setStatus("idle");
      } else {
        toast.error(
          caughtError instanceof Error ? caughtError.message : "Client MP4 export failed.",
        );
        setStatus("idle");
      }
    } finally {
      abortRef.current = null;
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === "exporting" ? (
        <button
          type="button"
          onClick={() => abortRef.current?.abort()}
          className="inline-flex h-9 items-center rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={status === "exporting"}
        style={{ backgroundImage: "var(--gradient-export)" }}
        className="relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 disabled:cursor-progress"
      >
        {status === "exporting" ? (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 bg-background/25 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        ) : null}
        <span className="relative flex items-center gap-2">
          {status === "idle" && <Download className="size-4" />}
          {status === "exporting" && <Loader2 className="size-4 animate-spin" />}
          {status === "done" && <Check className="size-4" />}
          {status === "idle" && "Export MP4"}
          {status === "exporting" && `Exporting ${progress}%`}
          {status === "done" && "Exported"}
        </span>
      </button>
    </div>
  );
}
