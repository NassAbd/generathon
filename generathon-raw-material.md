# Subtitler Studio: Technical Context & Raw Material

## Project Overview & Core Purpose
Subtitler Studio is a single-viewport web application designed to streamline the adaptation of raw talking-head clips into export-ready short-form vertical video. Its primary problem domain is automating the tedious manual synchronization of word-level "karaoke" captions and background music leveling. It provides a one-click generation pipeline that mixes dialogue, motion caption themes, and ducked background audio.

**Tech Stack:**
*   **Frontend Framework:** Next.js 14 (App Router), React 18
*   **Design System:** Tailwind CSS 3.4, Lucide Icons, Framer Motion
*   **Web Media APIs:** HTML5 Canvas API, Web Audio API (`AudioContext`, `GainNode`), `MediaRecorder` API
*   **Database & Storage:** Supabase (PostgreSQL + Auth + Storage)
*   **Backend Orchestration:** Next.js Route Handlers
*   **AI/Transcription Pipeline:** Groq Whisper for word-level timestamps (falling back to server-side LLM decoration)
*   **Media Processing:** FFmpeg (`fluent-ffmpeg`, `ffmpeg-static`)
*   **Editor Integration:** Custom native CapCut local project JSON generator
*   **Linters/Typing:** TypeScript 5.8 (`npm run typecheck`), ESLint
*   **Package Manager:** npm

## System Architecture & Media Pipeline Data Flow
The core architecture embraces a **Single-Viewport App** model with a **Client-side Media Engine** and **Serverless API orchestration**.

### Primary Data Models & Types
*   **Transcript Timestamp:** The core domain primitive is `TranscriptData` representing an array of `TranscriptWord` models. Each entry includes `word` (string), `start` and `end` (timestamps in seconds), `highlight` (boolean for styling), and optional `effect` or SFX/Asset references.
*   **Theme Presets:** Encapsulated in `ThemeId` (`Impact Yellow`, `Cyberpunk Green`, `Editorial Clean`).
*   **CapCut Schema:** Deep JSON representations corresponding to CapCut's `.json` project schema. Tracks text materials, audio segments, transform nodes (for re-framing), and sidechain configurations.

### End-to-End Data Flow
1.  **Video Ingestion:** Users upload raw video clips directly via a dropzone (`components/studio/upload/Dropzone.tsx`) pushing to a Supabase Storage bucket.
2.  **AI Transcription & Timestamping:** A Next.js API route passes the URL to Groq Whisper, extracting precise word boundaries. Subsequent stages may augment the transcript for visual effects.
3.  **Real-time Canvas Player Sync:** The `VideoStage` component hosts the HTML5 video tag, overlaid and styled dynamically as the `<video>` timeline progresses.
4.  **Export Path A (Canvas + Web Audio API):** Generates an MP4 directly within the browser without server rendering. HTML5 `<video>` and `<audio>` tags are fed into a Web Audio API graph. A `<canvas>` writes visuals at 60 FPS. `MediaRecorder` muxes the audio graph destination and the canvas stream.
5.  **Export Path B (CapCut Draft Generation):** A pure JSON payload and directory structure (`draft_content.json`, `draft_info.json`) is generated locally (`lib/capcut/exportDraft.ts`), linking assets so it natively opens in the desktop application.

## Key Technical Challenges & Code Highlights

### 1. In-Browser Video Rendering (Zero-Server Client-Side MP4 Export)
The codebase elegantly skirts expensive cloud rendering using the browser's native `MediaRecorder` API to capture frames drawn on an offscreen `<canvas>`. Audio tracks are similarly composed using the Web Audio API, which creates a highly deterministic mixed asset natively outputting MP4/WebM.

**Reference snippet (`lib/export/clientCanvasExporter.ts`):**
```typescript
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d");

  // Web Audio Context definition
  const audioContext = new AudioContext();
  const mixedDestination = audioContext.createMediaStreamDestination();

  // Combining video frame stream and audio tracks
  const canvasStream = canvas.captureStream(EXPORT_FPS);
  const audioTracks = mixedDestination.stream.getAudioTracks();

  const outputStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioTracks,
  ]);

  const recorder = new MediaRecorder(outputStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 192_000,
  });
```

### 2. Web Audio Sidechain Ducking
Audio ducking ensures background music automatically attenuates (lowers in volume) when dialogue is active. The engine employs `sidechaincompress` via FFmpeg on the server/desktop path, and precise Web Audio `GainNode` scaling on the browser path.

**Reference snippet (FFmpeg path: `lib/ffmpeg/mixWithSidechainDucking.ts`):**
```typescript
export const SPEECH_LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11" as const;

export function buildSidechainFilterComplex(options: {
  musicVolume: number;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
}): string {
  const { musicVolume, threshold, ratio, attack, release } = options;
  // Normalize quiet dialog first so sidechaincompress triggers reliably.
  return [
    `[0:a]${SPEECH_LOUDNORM}[norm_speech]`,
    `[1:a]volume=${musicVolume}[bg_music]`,
    `[norm_speech][bg_music]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[out_audio]`,
  ].join(";");
}
```

**Reference snippet (Web Audio Client path: `lib/export/clientCanvasExporter.ts`):**
```typescript
    // Dialog → destination @ 1.0
    const videoSource = audioContext.createMediaElementSource(video);
    const dialogGain = audioContext.createGain();
    dialogGain.gain.value = CLIENT_EXPORT_DIALOG_GAIN;
    videoSource.connect(dialogGain);
    dialogGain.connect(mixedDestination);

    // BGM → destination @ 0.25 (0.2–0.3 band; element volume stays at 1 to avoid double attenuation)
    if (hasBgm) {
      const bgmSource = audioContext.createMediaElementSource(bgm);
      const bgmGain = audioContext.createGain();
      bgmGain.gain.value = CLIENT_EXPORT_BGM_GAIN;
      bgmSource.connect(bgmGain);
      bgmGain.connect(mixedDestination);
    }
```

### 3. Native CapCut Draft Injection
CapCut drafts are structurally standard JSON formats. By programmatically generating the `draft_content.json` structure from the internal transcription and theme timeline, the application bridges the web directly into desktop editing workflows.

**Reference snippet (`lib/capcut/exportDraft.ts`):**
```typescript
  const { draftContent } = buildCapCutDraft({
    projectId,
    projectName: projectData.projectName,
    videoUrl: projectData.videoUrl,
    transcript: projectData.transcript,
    durationSeconds: projectData.durationSeconds,
    theme: projectData.theme,
    sourceVideoWidth: projectData.sourceVideoWidth,
    sourceVideoHeight: projectData.sourceVideoHeight,
    speakerOffsetPercentX: projectData.speakerOffsetPercentX,
    speakerOffsetSegments: projectData.speakerOffsetSegments,
    bgmUrl,
    applySidechainDucking: false,
  });

  const envelope = await loadDraftEnvelope(draftFolderPath, capCutRoot);
  const mergedDraftInfo = mergeGeneratedIntoDraftInfoEnvelope(envelope, draftContent);
  const mergedJson = JSON.stringify(mergedDraftInfo, null, 2);

  await writeFile(draftInfoPath, mergedJson, "utf8");
  await writeFile(draftContentPath, JSON.stringify(draftContent, null, 2), "utf8");
```

## UI/UX Architecture & Developer Experience
*   **Viewport Strategy:** The UI embraces a strict single-viewport model (100dvh). This `overflow-hidden` app-style paradigm minimizes scrolling. `components/studio/editor/VideoStage.tsx` controls the 9:16 aspect ratio workspace.
*   **State Machine Transitions:** State maps from Idle → Uploading → Processing (Transcription) → Editor cleanly within single pages. A `HomeWorkflow` wrapper governs these state jumps asynchronously.
*   **Toast Notifications:** Layout shifts are actively suppressed during processing queues utilizing the `sonner` toast library, offering non-blocking feedback.
*   **Type Safety:** Strict TS compilation flags (`tsc --noEmit` on `npm run typecheck`) ensure strong adherence to the `TranscriptData` schema.
*   **Styling System:** Styled using standard utility-first Tailwind conventions anchored heavily by global font declarations (DM Sans, Inter, Space Grotesk) defined in `app/layout.tsx`.
