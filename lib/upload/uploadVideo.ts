import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const ACCEPTED_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const ACCEPTED_EXTENSIONS = [".mp4", ".mov", ".webm"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface UploadResult {
  project_id: string;
  video_url: string;
}

function isSupportedVideo(file: File): boolean {
  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  return ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.includes(extension);
}

function getFileExtension(file: File): string {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "mov") return "mov";
  if (extension === "webm") return "webm";
  return "mp4";
}

/** Upload a video to Supabase Storage and create a project row. */
export async function uploadVideoFile(file: File): Promise<UploadResult> {
  if (!isSupportedVideo(file)) {
    throw new Error("Choose an MP4, MOV, or WebM video file.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("The video must be 50 MB or smaller.");
  }

  const storagePath = `uploads/${crypto.randomUUID()}.${getFileExtension(file)}`;
  const supabase = getSupabaseBrowserClient();

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

  return { project_id: project.id, video_url: videoUrl };
}
