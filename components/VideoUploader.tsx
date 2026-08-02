"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Dropzone } from "@/components/studio/upload/Dropzone";
import { uploadVideoFile, type UploadResult } from "@/lib/upload/uploadVideo";

export type { UploadResult };

export interface VideoUploaderProps {
  onUploadComplete?: (result: UploadResult) => void;
}

/** Thin wrapper around the studio Dropzone + Supabase upload pipeline. */
export function VideoUploader({ onUploadComplete }: VideoUploaderProps): JSX.Element {
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File | null): Promise<void> {
    if (!file || isUploading) return;
    setIsUploading(true);
    try {
      const result = await uploadVideoFile(file);
      onUploadComplete?.(result);
    } catch (caughtError: unknown) {
      toast.error(
        caughtError instanceof Error ? caughtError.message : "An unexpected error occurred.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="w-full max-w-xl" aria-label="Video upload">
      <Dropzone onFile={(file) => void handleFile(file)} disabled={isUploading} />
    </section>
  );
}
