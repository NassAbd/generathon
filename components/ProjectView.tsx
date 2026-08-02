"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { ExportCapCutLocalButton } from "@/components/ExportCapCutLocalButton";
import { ExportMp4Button } from "@/components/ExportMp4Button";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TranscriptSidebar } from "@/components/TranscriptSidebar";
import { VideoPlayerOverlay, type VideoPlayerOverlayHandle } from "@/components/VideoPlayerOverlay";
import { AppHeader } from "@/components/studio/AppHeader";
import { EditorHeader } from "@/components/studio/editor/EditorHeader";
import { VideoStage } from "@/components/studio/editor/VideoStage";
import type { SpeakerOffsetSegment } from "@/lib/capcut/video-effects";
import type { ProjectRecord } from "@/lib/projects/fetchProject";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { THEME_PRESETS, type ThemeId } from "@/types/theme";

export interface ProjectViewProps {
  project: ProjectRecord;
}

export function ProjectView({ project }: ProjectViewProps): JSX.Element {
  const router = useRouter();
  const playerRef = useRef<VideoPlayerOverlayHandle>(null);
  const [theme, setTheme] = useState<ThemeId>(project.theme);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [sourceVideoWidth, setSourceVideoWidth] = useState<number | undefined>(undefined);
  const [sourceVideoHeight, setSourceVideoHeight] = useState<number | undefined>(undefined);
  const [speakerOffsetPercentX, setSpeakerOffsetPercentX] = useState<number | undefined>(undefined);
  const [speakerOffsetSegments, setSpeakerOffsetSegments] = useState<SpeakerOffsetSegment[] | undefined>(
    undefined,
  );

  const transcript = project.transcript_data ?? [];
  const themePreset = THEME_PRESETS[theme];

  const handleThemeChange = useCallback(
    async (nextTheme: ThemeId) => {
      setTheme(nextTheme);
      const supabase = getSupabaseBrowserClient();
      await supabase.from("projects").update({ theme: nextTheme }).eq("id", project.id);
    },
    [project.id],
  );

  const handleSeek = useCallback((seconds: number, wordIndex: number) => {
    playerRef.current?.seekTo(seconds);
    setActiveWordIndex(wordIndex);
  }, []);

  return (
    <div className="flex h-screen max-h-screen w-full flex-col overflow-hidden">
      <AppHeader>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          + New upload
        </button>
      </AppHeader>

      <EditorHeader
        title="Synchronized overlay playback"
        subtitle={`${themePreset.label} theme · ${transcript.length} words · project ${project.id.slice(0, 8)}…`}
        actions={
          <>
            <ExportCapCutLocalButton
              projectId={project.id}
              themeId={theme}
              sourceVideoWidth={sourceVideoWidth}
              sourceVideoHeight={sourceVideoHeight}
              speakerOffsetPercentX={speakerOffsetPercentX}
              speakerOffsetSegments={speakerOffsetSegments}
            />
            <ExportMp4Button
              projectId={project.id}
              themeId={theme}
              videoUrl={project.video_url}
              transcript={transcript}
              bgmUrl={project.selected_bgm_url}
            />
          </>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 px-5 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:px-8">
        <div className="flex min-h-0 flex-col gap-3">
          <VideoStage>
            <VideoPlayerOverlay
              ref={playerRef}
              videoUrl={project.video_url}
              transcript={transcript}
              theme={theme}
              bgmUrl={project.selected_bgm_url ?? undefined}
              onActiveWordChange={setActiveWordIndex}
              onVideoDimensionsChange={(width, height) => {
                setSourceVideoWidth(width);
                setSourceVideoHeight(height);
              }}
              onSpeakerOffsetChange={setSpeakerOffsetPercentX}
              onSpeakerOffsetSegmentsChange={setSpeakerOffsetSegments}
              className="h-full w-full rounded-none border-0 shadow-none"
            />
          </VideoStage>
          <ThemeSelector value={theme} onChange={(nextTheme) => void handleThemeChange(nextTheme)} />
        </div>

        <TranscriptSidebar
          transcript={transcript}
          activeWordIndex={activeWordIndex}
          theme={theme}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
