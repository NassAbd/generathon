"use client";

import { useState } from "react";

import type { ThemeId } from "@/types/theme";

export interface ExportCapCutButtonProps {
  projectId: string;
  themeId: ThemeId;
}

export function ExportCapCutButton({ projectId, themeId }: ExportCapCutButtonProps): JSX.Element {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/export-capcut?projectId=${encodeURIComponent(projectId)}&themeId=${encodeURIComponent(themeId)}`,
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "CapCut export failed.");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `motion-decorator-${projectId.slice(0, 8)}.zip`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "CapCut export failed.");
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
        className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.35)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
      >
        {isExporting ? "Building CapCut Draft…" : "Export CapCut Draft (.zip)"}
      </button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
