"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  const { project } = useProjectStatus(activeProjectId);

  useEffect(() => {
    if (project?.status === "completed" && project.id) {
      router.push(`/project/${project.id}`);
    }
  }, [project?.id, project?.status, router]);

  useEffect(() => {
    if (project?.status === "failed") {
      toast.error("Processing failed. Try uploading again.");
    }
  }, [project?.status]);

  const handleUploadComplete = useCallback(async (result: UploadResult): Promise<void> => {
    setActiveProjectId(result.project_id);

    try {
      await startVideoProcessing(result.project_id, result.video_url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not start video processing.");
      setActiveProjectId(null);
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || isUploading) return;
      setIsUploading(true);
      try {
        const result = await uploadVideoFile(file);
        await handleUploadComplete(result);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [handleUploadComplete, isUploading],
  );

  const isProcessing = Boolean(activeProjectId) && project?.status !== "completed";
  const highlightCount = useMemo(
    () => countHighlights(project?.transcript_data),
    [project?.transcript_data],
  );

  return (
    <main className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      <AppHeader />
      <UploadHero
        onFile={(file) => void handleFile(file)}
        disabled={isUploading || isProcessing}
        busyLabel={isUploading ? "Uploading your footage…" : "Processing your video…"}
        mediaSlot={
          isProcessing ? (
            <ProcessingLoader
              status={project?.status ?? "transcribing"}
              highlightCount={highlightCount}
              wordCount={project?.transcript_data?.length}
            />
          ) : undefined
        }
      />
    </main>
  );
}
