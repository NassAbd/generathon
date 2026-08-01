"use client";

import { useCallback, useRef, useState } from "react";

import { ExportCapCutButton } from "@/components/ExportCapCutButton";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TranscriptSidebar } from "@/components/TranscriptSidebar";
import { VideoPlayerOverlay, type VideoPlayerOverlayHandle } from "@/components/VideoPlayerOverlay";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProjectRecord } from "@/lib/projects/fetchProject";
import type { ThemeId } from "@/types/theme";

export interface ProjectViewProps {
  project: ProjectRecord;
}

export function ProjectView({ project }: ProjectViewProps): JSX.Element {
  const playerRef = useRef<VideoPlayerOverlayHandle>(null);
  const [theme, setTheme] = useState<ThemeId>(project.theme);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  const transcript = project.transcript_data ?? [];

  const handleThemeChange = useCallback(async (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    const supabase = getSupabaseBrowserClient();
    await supabase.from("projects").update({ theme: nextTheme }).eq("id", project.id);
  }, [project.id]);

  const handleSeek = useCallback((seconds: number, wordIndex: number) => {
    playerRef.current?.seekTo(seconds);
    setActiveWordIndex(wordIndex);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-300">Project Preview</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Synchronized overlay playback</h1>
          <p className="mt-2 text-sm text-slate-400">Project {project.id.slice(0, 8)}… · {transcript.length} words</p>
        </div>
        <ExportCapCutButton projectId={project.id} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div className="space-y-4">
          <VideoPlayerOverlay
            ref={playerRef}
            videoUrl={project.video_url}
            transcript={transcript}
            theme={theme}
            onActiveWordChange={setActiveWordIndex}
          />
          <ThemeSelector value={theme} onChange={(nextTheme) => void handleThemeChange(nextTheme)} />
        </div>

        <TranscriptSidebar
          transcript={transcript}
          activeWordIndex={activeWordIndex}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
