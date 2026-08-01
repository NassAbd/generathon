"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowserClient, type ProjectStatus } from "@/lib/supabase/client";
import type { TranscriptData } from "@/types/transcript";

export interface ProjectSnapshot {
  id: string;
  status: ProjectStatus;
  video_url: string;
  transcript_data: TranscriptData | null;
  duration_seconds: number | null;
}

export interface UseProjectStatusResult {
  project: ProjectSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

export function useProjectStatus(projectId: string | null): UseProjectStatusResult {
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isActive = true;
    const supabase = getSupabaseBrowserClient();
    const activeProjectId = projectId;

    async function hydrateProject(): Promise<void> {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("projects")
        .select("id, status, video_url, transcript_data, duration_seconds")
        .eq("id", activeProjectId)
        .single();

      if (!isActive) return;

      if (fetchError) {
        setError(fetchError.message);
        setProject(null);
      } else {
        setProject(data);
      }

      setIsLoading(false);
    }

    void hydrateProject();

    const channel = supabase
      .channel(`project-status:${activeProjectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "projects",
          filter: `id=eq.${activeProjectId}`,
        },
        (payload) => {
          const next = payload.new as ProjectSnapshot;
          setProject(next);
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [projectId]);

  return { project, isLoading, error };
}
