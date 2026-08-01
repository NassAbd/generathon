import { writeDirectToCapCut } from "@/lib/capcut/exportDraft";
import { fetchProjectById } from "@/lib/projects/fetchProject";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveExportThemeId } from "@/types/theme";

export const runtime = "nodejs";

interface ExportCapCutLocalRequest {
  projectId: string;
  themeId?: string;
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ExportCapCutLocalRequest;
    if (!body.projectId) {
      return errorResponse("Expected { projectId }.", 400);
    }

    const project = await fetchProjectById(body.projectId);
    if (!project) {
      return errorResponse("Project not found.", 404);
    }

    if (!project.transcript_data?.length) {
      return errorResponse("Project transcript is not ready.", 400);
    }

    const durationSeconds =
      project.duration_seconds ??
      project.transcript_data.reduce((maxEnd, entry) => Math.max(maxEnd, entry.end), 0);

    const exportTheme = resolveExportThemeId(body.themeId, project.theme);
    const projectName = "Motion Decorator Project";

    // Downloads keyword SFX + BGM into assets/audio/, then links absolute paths in draft_info.json.
    const result = await writeDirectToCapCut(project.id, {
      projectId: project.id,
      projectName,
      videoUrl: project.video_url,
      transcript: project.transcript_data,
      durationSeconds,
      theme: exportTheme,
    });

    const supabase = getSupabaseServerClient();
    await supabase
      .from("projects")
      .update({ capcut_draft_url: result.draftFolderPath })
      .eq("id", project.id);

    return Response.json({
      ok: true,
      message: "Project injected into CapCut! Re-open your latest project in CapCut.",
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Local CapCut export failed.";
    return errorResponse(message, 500);
  }
}
