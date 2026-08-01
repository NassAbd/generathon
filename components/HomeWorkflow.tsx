"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ProcessingLoader } from "@/components/ProcessingLoader";
import { VideoUploader, type UploadResult } from "@/components/VideoUploader";
import { useProjectStatus } from "@/hooks/useProjectStatus";
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

  const showLoader = Boolean(activeProjectId);
  const highlightCount = useMemo(() => countHighlights(project?.transcript_data), [project?.transcript_data]);

  return (
    <>
      <VideoUploader onUploadComplete={(result) => void handleUploadComplete(result)} />

      {processingError && (
        <p className="mt-4 text-sm text-rose-400" role="alert">
          {processingError}
        </p>
      )}

      {showLoader && (
        <ProcessingLoader
          status={project?.status ?? "transcribing"}
          highlightCount={highlightCount}
          wordCount={project?.transcript_data?.length}
        />
      )}
    </>
  );
}
