"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { CopyShareLinkButton } from "@/components/CopyShareLinkButton";
import { ExportCapCutLocalButton } from "@/components/ExportCapCutLocalButton";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TranscriptSidebar } from "@/components/TranscriptSidebar";
import { VideoPlayerOverlay, type VideoPlayerOverlayHandle } from "@/components/VideoPlayerOverlay";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProjectRecord } from "@/lib/projects/fetchProject";
import { THEME_PRESETS, type ThemeId } from "@/types/theme";

export interface ProjectViewProps {
  project: ProjectRecord;
}

export function ProjectView({ project }: ProjectViewProps): JSX.Element {
  const router = useRouter();
  const playerRef = useRef<VideoPlayerOverlayHandle>(null);
  const [theme, setTheme] = useState<ThemeId>(project.theme);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);

  const transcript = project.transcript_data ?? [];
  const themePreset = THEME_PRESETS[theme];

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
    <div className="mx-auto flex h-screen max-h-screen w-full max-w-7xl flex-col overflow-hidden p-4 md:p-6">
      <header className="flex shrink-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className={`text-sm font-semibold uppercase tracking-[0.22em] ${themePreset.accentLabelClass}`}>
            Pitch Preview
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">Synchronized overlay playback</h1>
          <p className="mt-1 truncate text-sm text-slate-400">
            {themePreset.label} theme · {transcript.length} words · project {project.id.slice(0, 8)}…
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:border-violet-400/40 hover:bg-white/[0.07]"
          >
            + Transcribe Other
          </button>
          <ExportCapCutLocalButton projectId={project.id} themeId={theme} />
          <CopyShareLinkButton projectId={project.id} />
        </div>
      </header>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-12 md:gap-6">
        <div className="flex min-h-0 flex-col gap-3 md:col-span-7">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <VideoPlayerOverlay
              ref={playerRef}
              videoUrl={project.video_url}
              transcript={transcript}
              theme={theme}
              onActiveWordChange={setActiveWordIndex}
              className="h-full max-h-[calc(100vh-11rem)] w-auto"
            />
          </div>
          <div className="shrink-0">
            <ThemeSelector value={theme} onChange={(nextTheme) => void handleThemeChange(nextTheme)} />
          </div>
        </div>

        <div className="min-h-0 md:col-span-5">
          <TranscriptSidebar
            transcript={transcript}
            activeWordIndex={activeWordIndex}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
  );
}
