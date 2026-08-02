"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProcessingLoader } from "@/components/ProcessingLoader";
import { AppHeader } from "@/components/studio/AppHeader";
import { UploadHero } from "@/components/studio/upload/UploadHero";
import { useProjectStatus } from "@/hooks/useProjectStatus";
import { uploadVideoFile, type UploadResult } from "@/lib/upload/uploadVideo";
import type { TranscriptData } from "@/types/transcript";

async function startVideoProcessing(projectId: string, videoUrl: string): Promise<void> {
  const response = await fetch("/api/process-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, videoUrl }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Video processing failed to start.");
  }
}

function countHighlights(transcript: TranscriptData | null | undefined): number {
  return transcript?.filter((entry) => entry.highlight).length ?? 0;
}

export function HomeWorkflow(): JSX.Element {
  const router = useRouter();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const { project } = useProjectStatus(activeProjectId);

  useEffect(() => {
    if (project?.status === "completed" && project.id) {
      router.push(`/project/${project.id}`);
    }
  }, [project?.id, project?.status, router]);

  const handleUploadComplete = useCallback(async (result: UploadResult): Promise<void> => {
    setProcessingError(null);
    setActiveProjectId(result.project_id);

    try {
      await startVideoProcessing(result.project_id, result.video_url);
    } catch (error: unknown) {
      setProcessingError(error instanceof Error ? error.message : "Could not start video processing.");
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || isUploading) return;
      setIsUploading(true);
      setProcessingError(null);
      try {
        const result = await uploadVideoFile(file);
        await handleUploadComplete(result);
      } catch (error: unknown) {
        setProcessingError(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [handleUploadComplete, isUploading],
  );

  const showLoader = Boolean(activeProjectId);
  const highlightCount = useMemo(
    () => countHighlights(project?.transcript_data),
    [project?.transcript_data],
  );

  return (
    <main className="flex min-h-dvh flex-col md:h-dvh md:overflow-hidden">
      <AppHeader />
      <UploadHero
        onFile={(file) => void handleFile(file)}
        onSample={() => {
          // Sample CTA opens the same upload path (no mock project in production).
          const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="video"]');
          input?.click();
        }}
        disabled={isUploading || showLoader}
        busyLabel={isUploading ? "Uploading your footage…" : "Processing your video…"}
        footer={
          <>
            {processingError ? (
              <p className="text-sm text-destructive" role="alert">
                {processingError}
              </p>
            ) : null}
            {showLoader ? (
              <div className="w-full">
                <ProcessingLoader
                  status={project?.status ?? "transcribing"}
                  highlightCount={highlightCount}
                  wordCount={project?.transcript_data?.length}
                />
              </div>
            ) : null}
          </>
        }
      />
    </main>
  );
}
