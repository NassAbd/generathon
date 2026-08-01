"use client";

import { useState } from "react";

import type { ThemeId } from "@/types/theme";

export interface ExportCapCutLocalButtonProps {
  projectId: string;
  themeId: ThemeId;
  sourceVideoWidth?: number;
  sourceVideoHeight?: number;
}

export function ExportCapCutLocalButton({
  projectId,
  themeId,
  sourceVideoWidth,
  sourceVideoHeight,
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
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(34,211,238,0.28)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
      >
        {isExporting ? "Writing to CapCut folder…" : "🚀 Open Directly in CapCut"}
      </button>

      {toast && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">
          {toast}
        </p>
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
