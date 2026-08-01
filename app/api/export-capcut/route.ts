import JSZip from "jszip";
import { NextRequest } from "next/server";

import { buildCapCutDraft } from "@/lib/capcut/exportDraft";
import { fetchProjectById } from "@/lib/projects/fetchProject";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveExportThemeId, type ThemeId } from "@/types/theme";

export const runtime = "nodejs";

async function buildExportZip(
  projectId: string,
  requestThemeId?: string | null,
): Promise<{ buffer: Buffer; filename: string }> {
  const project = await fetchProjectById(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  if (!project.transcript_data?.length) {
    throw new Error("Project transcript is not ready.");
  }

  const durationSeconds =
    project.duration_seconds ??
    project.transcript_data.reduce((maxEnd, entry) => Math.max(maxEnd, entry.end), 0);

  const exportTheme: ThemeId = resolveExportThemeId(requestThemeId, project.theme);
  const { draftContent, readme } = buildCapCutDraft({
    projectId: project.id,
    projectName: `Motion Decorator ${project.id.slice(0, 8)}`,
    videoUrl: project.video_url,
    transcript: project.transcript_data,
    durationSeconds,
    theme: exportTheme,
  });

  const zip = new JSZip();
  zip.file("draft_content.json", JSON.stringify(draftContent, null, 2));
  zip.file("README.txt", readme);

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const filename = `motion-decorator-${project.id.slice(0, 8)}.zip`;

  const supabase = getSupabaseServerClient();
  await supabase
    .from("projects")
    .update({ capcut_draft_url: `local-export:${project.id}` })
    .eq("id", project.id);

  return { buffer, filename };
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return errorResponse("Missing projectId query parameter.", 400);
    }

    const themeId = request.nextUrl.searchParams.get("themeId");
    const { buffer, filename } = await buildExportZip(projectId, themeId);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CapCut export failed.";
    const status = message === "Project not found." ? 404 : 500;
    return errorResponse(message, status);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { projectId?: string; themeId?: string };
    if (!body.projectId) {
      return errorResponse("Expected { projectId }.", 400);
    }

    const { buffer, filename } = await buildExportZip(body.projectId, body.themeId);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CapCut export failed.";
    const status = message === "Project not found." ? 404 : 500;
    return errorResponse(message, status);
  }
}
