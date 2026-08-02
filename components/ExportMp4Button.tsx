"use client";

import { useRef, useState } from "react";

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

export function ExportMp4Button({
  projectId,
  themeId,
  videoUrl,
  transcript,
  bgmUrl,
}: ExportMp4ButtonProps): JSX.Element {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleExport(): Promise<void> {
    if (isExporting) return;

    setIsExporting(true);
    setError(null);
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
        onProgress: (value) => setProgress(value),
      });

      downloadBlob(result.blob, result.filename);
      setProgress(1);
    } catch (caughtError: unknown) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        setError("Export cancelled.");
      } else {
        setError(caughtError instanceof Error ? caughtError.message : "Client MP4 export failed.");
      }
    } finally {
      abortRef.current = null;
      setIsExporting(false);
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
  }

  const percent = Math.round(progress * 100);

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:border-[#FFE600]/45 hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-70"
        >
          {isExporting ? `Rendering… ${percent}%` : "Export MP4"}
        </button>
        {isExporting ? (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-white/10 px-3 py-3 text-xs font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {isExporting ? (
        <div className="w-56 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className="h-1.5 rounded-full bg-[#FFE600] transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}

      {error && <p className="max-w-sm text-xs text-rose-400">{error}</p>}
    </div>
  );
}
