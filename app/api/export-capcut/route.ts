import JSZip from "jszip";

import { buildCapCutDraft } from "@/lib/capcut/exportDraft";
import { fetchProjectById } from "@/lib/projects/fetchProject";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { parseThemeId } from "@/types/theme";

export const runtime = "nodejs";

interface ExportCapCutRequest {
  projectId: string;
}

function isValidRequest(body: unknown): body is ExportCapCutRequest {
  return typeof body === "object" && body !== null && typeof (body as ExportCapCutRequest).projectId === "string";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json();
    if (!isValidRequest(body)) {
      return Response.json({ error: "Expected { projectId }." }, { status: 400 });
    }

    const project = await fetchProjectById(body.projectId);
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }

    if (!project.transcript_data?.length) {
      return Response.json({ error: "Project transcript is not ready." }, { status: 400 });
    }

    const durationSeconds =
      project.duration_seconds ??
      project.transcript_data.reduce((maxEnd, entry) => Math.max(maxEnd, entry.end), 0);

    const { draftContent, readme } = buildCapCutDraft({
      projectId: project.id,
      projectName: `Motion Decorator ${project.id.slice(0, 8)}`,
      videoUrl: project.video_url,
      transcript: project.transcript_data,
      durationSeconds,
      theme: parseThemeId(project.theme),
    });

    const zip = new JSZip();
    zip.file("draft_content.json", JSON.stringify(draftContent, null, 2));
    zip.file("README.txt", readme);
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    const supabase = getSupabaseServerClient();
    await supabase
      .from("projects")
      .update({ capcut_draft_url: `local-export:${project.id}` })
      .eq("id", project.id);

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="motion-decorator-${project.id.slice(0, 8)}.zip"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "CapCut export failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
