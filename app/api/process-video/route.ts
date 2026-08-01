import { countHighlights, decorateTranscript } from "@/lib/ai/decorate-transcript";
import { transcribeVideoUrl } from "@/lib/groq/transcribe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProcessVideoRequest, ProcessVideoResponse, TranscriptData } from "@/types/transcript";

export const runtime = "nodejs";
export const maxDuration = 300;

async function updateProjectStatus(
  projectId: string,
  status: "transcribing" | "decorating" | "completed" | "failed",
  extra?: {
    transcript_data?: TranscriptData;
    duration_seconds?: number | null;
  },
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({ status, ...extra })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to update project status (${status}): ${error.message}`);
  }
}

function isValidRequest(body: unknown): body is ProcessVideoRequest {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Partial<ProcessVideoRequest>;
  return typeof candidate.projectId === "string" && typeof candidate.videoUrl === "string";
}

export async function POST(request: Request): Promise<Response> {
  let projectId: string | null = null;

  try {
    const body: unknown = await request.json();
    if (!isValidRequest(body)) {
      return Response.json({ error: "Expected { projectId, videoUrl }." }, { status: 400 });
    }

    projectId = body.projectId;
    const { videoUrl } = body;

    await updateProjectStatus(projectId, "transcribing");

    const { words, durationSeconds } = await transcribeVideoUrl(videoUrl);

    await updateProjectStatus(projectId, "decorating");

    const transcriptData = await decorateTranscript(words);

    await updateProjectStatus(projectId, "completed", {
      transcript_data: transcriptData,
      duration_seconds: durationSeconds,
    });

    const response: ProcessVideoResponse = {
      projectId,
      status: "completed",
      wordCount: transcriptData.length,
      highlightCount: countHighlights(transcriptData),
    };

    return Response.json(response);
  } catch (error: unknown) {
    if (projectId) {
      try {
        await updateProjectStatus(projectId, "failed");
      } catch {
        // Best-effort failure marker; original error takes precedence.
      }
    }

    const message = error instanceof Error ? error.message : "Video processing failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
