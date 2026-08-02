import { bgmTrackFromStoredFields, getOrAssignProjectBgmTrack } from "@/lib/assets/bgm";
import { CAPCUT_EXPORT_AUDIO } from "@/lib/capcut/presets";
import { renderProjectMp4 } from "@/lib/ffmpeg/renderProjectMp4";
import { fetchProjectById } from "@/lib/projects/fetchProject";
import { resolveExportThemeId } from "@/types/theme";

export const runtime = "nodejs";
export const maxDuration = 300;

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { projectId?: string; themeId?: string };
    if (!body.projectId) {
      return errorResponse("Expected { projectId }.", 400);
    }

    const project = await fetchProjectById(body.projectId);
    if (!project) {
      return errorResponse("Project not found.", 404);
    }

    if (!project.video_url) {
      return errorResponse("Project has no video URL.", 400);
    }

    if (!project.transcript_data?.length) {
      return errorResponse("Project transcript is not ready for subtitle burn-in.", 400);
    }

    const theme = resolveExportThemeId(body.themeId, project.theme);
    const bgmTrack =
      bgmTrackFromStoredFields(project.selected_bgm_track, project.selected_bgm_url) ??
      (await getOrAssignProjectBgmTrack(project.id));

    const rendered = await renderProjectMp4({
      videoUrl: project.video_url,
      bgmUrl: bgmTrack.url || CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL,
      transcript: project.transcript_data,
      theme,
      filenameStem: `motion-decorator-${project.id.slice(0, 8)}`,
    });

    return new Response(new Uint8Array(rendered.buffer), {
      headers: {
        "Content-Type": rendered.contentType,
        "Content-Disposition": `attachment; filename="${rendered.filename}"`,
        "Cache-Control": "no-store",
        "X-Subtitle-Mode": rendered.subtitleMode,
        ...(rendered.warning ? { "X-Export-Warning": rendered.warning } : {}),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "MP4 export failed.";
    return errorResponse(message, 500);
  }
}
