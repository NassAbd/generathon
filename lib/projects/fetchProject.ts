import { getBgmUrl } from "@/lib/assets/catalog";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { TranscriptData } from "@/types/transcript";
import { parseThemeId, type ThemeId } from "@/types/theme";
import type { ProjectStatus } from "@/lib/supabase/client";

export interface ProjectRecord {
  id: string;
  video_url: string;
  status: ProjectStatus;
  theme: ThemeId;
  transcript_data: TranscriptData | null;
  duration_seconds: number | null;
  capcut_draft_url: string | null;
  created_at: string;
  /** Canonical BGM filename (e.g. cartoon.mp3), assigned once at transcription. */
  selected_bgm_track: string | null;
  /** Public URL for the selected BGM; used by preview + CapCut export. */
  selected_bgm_url: string | null;
}

export async function fetchProjectById(projectId: string): Promise<ProjectRecord | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, video_url, status, theme, transcript_data, duration_seconds, capcut_draft_url, created_at, selected_bgm_track, selected_bgm_url",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const selected_bgm_track = data.selected_bgm_track ?? null;
  const selected_bgm_url =
    data.selected_bgm_url ?? (selected_bgm_track ? getBgmUrl(selected_bgm_track) : null);

  return {
    ...data,
    theme: parseThemeId(data.theme),
    transcript_data: data.transcript_data,
    selected_bgm_track,
    selected_bgm_url,
  };
}
