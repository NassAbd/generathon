"use client";

import { useState } from "react";

import type { ThemeId } from "@/types/theme";

export interface ExportMp4ButtonProps {
  projectId: string;
  themeId: ThemeId;
}

export function ExportMp4Button({ projectId, themeId }: ExportMp4ButtonProps): JSX.Element {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    setError(null);
    setWarning(null);

    try {
      const response = await fetch("/api/export-mp4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, themeId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "MP4 export failed.");
      }

      const exportWarning = response.headers.get("X-Export-Warning");
      if (exportWarning) {
        setWarning(exportWarning);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = /filename="([^"]+)"/i.exec(disposition);
      const filename = filenameMatch?.[1] ?? `motion-decorator-${projectId.slice(0, 8)}.mp4`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "MP4 export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:border-[#FFE600]/45 hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-70"
      >
        {isExporting ? "Rendering MP4…" : "Export MP4"}
      </button>
      {warning && (
        <p className="max-w-sm rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {warning}
        </p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
