"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const ACCEPTED_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface UploadResult {
  project_id: string;
  video_url: string;
}

export interface VideoUploaderProps {
  onUploadComplete?: (result: UploadResult) => void;
}

function isSupportedVideo(file: File): boolean {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.includes(extension);
}

function getFileExtension(file: File): string {
  const extension = file.name.toLowerCase().split(".").pop();
  return extension === "mov" ? "mov" : "mp4";
}

export function VideoUploader({ onUploadComplete }: VideoUploaderProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function uploadFile(file: File): Promise<void> {
    setError(null);
    setResult(null);

    if (!isSupportedVideo(file)) {
      setError("Choose an MP4 or MOV video file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("The video must be 50 MB or smaller.");
      return;
    }

    setIsUploading(true);
    const storagePath = `uploads/${crypto.randomUUID()}.${getFileExtension(file)}`;
    const supabase = getSupabaseBrowserClient();

    try {
      const { error: storageError } = await supabase.storage.from("videos").upload(storagePath, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });

      if (storageError) {
        throw new Error(`Video upload failed: ${storageError.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from("videos").getPublicUrl(storagePath);
      const videoUrl = publicUrlData.publicUrl;

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({ status: "uploading", video_url: videoUrl })
        .select("id")
        .single();

      if (projectError) {
        await supabase.storage.from("videos").remove([storagePath]);
        throw new Error(`Could not create the project: ${projectError.message}`);
      }

      const uploadResult = { project_id: project.id, video_url: videoUrl };
      setResult(uploadResult);
      onUploadComplete?.(uploadResult);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const [file] = Array.from(event.target.files ?? []);
    if (file) void uploadFile(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    const [file] = Array.from(event.dataTransfer.files);
    if (file) void uploadFile(file);
  }

  return (
    <section className="w-full max-w-xl" aria-label="Video upload">
      <div
        className={`rounded-2xl border border-dashed p-8 text-center transition sm:p-12 ${
          isDragging ? "border-violet-400 bg-violet-400/10" : "border-white/15 bg-white/[0.03] hover:border-violet-400/60"
        } ${isUploading ? "cursor-wait opacity-75" : "cursor-pointer"}`}
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !isUploading) inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="video/mp4,video/quicktime,.mp4,.mov"
          disabled={isUploading}
          onChange={handleInputChange}
        />
        <p className="text-base font-semibold text-white">{isUploading ? "Uploading your footage…" : "Drop your video here"}</p>
        <p className="mt-2 text-sm text-slate-400">MP4 or MOV · up to 50 MB · or click to browse</p>
      </div>

      {error && <p className="mt-3 text-sm text-rose-400" role="alert">{error}</p>}
      {result && <p className="mt-3 text-sm text-emerald-400">Upload complete — project {result.project_id}</p>}
    </section>
  );
}
