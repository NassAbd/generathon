# Technical Constraints — Lovable UI Redesign

> **Audience:** Lovable (or any frontend-only agent) refactoring the UI layer.  
> **Goal:** Restyle layout, typography, and chrome **without** changing audio/video engines, export pipelines, shared subtitle tokens, or theme ID contracts.

If a UI change would require editing a protected file, **stop** and surface the dependency instead of rewriting engine code.

---

## 1. Protected Files & Directories (DO NOT TOUCH / READ-ONLY)

Treat these as **black boxes**. You may **import** their public APIs from UI components. Do **not** edit, move, rename, or “simplify” them.

### 1.1 Hard-protected (engines)

| Path | Role |
|------|------|
| `lib/export/clientCanvasExporter.ts` | Client MP4/WebM recording: canvas frames + `AudioContext` dialog/BGM mix + `MediaRecorder` |
| `lib/capcut/` | CapCut draft JSON generator, subtitle presets, karaoke segment planning, face/reframe helpers |
| `lib/ffmpeg/` | Server-side mix/ducking, ASS/drawtext helpers (fallback / CapCut local tooling) |

Notable files inside those trees (also read-only):

- `lib/capcut/presets.ts` — **`SHARED_SUBTITLE_TOKENS`**, `SUBTITLE_STYLE_PRESETS`, karaoke phrase builders, CapCut text material props, `CAPCUT_EXPORT_AUDIO`
- `lib/capcut/exportDraft.ts` — CapCut project/draft writer
- `lib/capcut/video-effects.ts` / `lib/capcut/face-tracker.ts` — speaker reframe / offset segments used by CapCut local export
- `lib/ffmpeg/mixWithSidechainDucking.ts` — dialog + BGM sidechain ducking
- `lib/ffmpeg/renderProjectMp4.ts`, `burnSubtitles.ts`, `buildAssSubtitles.ts`

### 1.2 Shared token system (DO NOT CHANGE VALUES OR KEYS)

**Canonical definitions live in** `lib/capcut/presets.ts` → `SHARED_SUBTITLE_TOKENS`.

| Token | Value | Used by theme |
|-------|--------|----------------|
| `textWhite` | `#FFFFFF` | All (inactive karaoke words) |
| `accentYellow` | `#FFE600` | `impact_yellow` |
| `accentGreen` | `#10B981` | `cyberpunk` |
| `accentCyan` | `#06B6D4` | `editorial_clean` |
| `strokeColor` | `#000000` | All |
| `backgroundAlpha` | `0.6` | Soft dark caption box |

Theme → accent mapping (must stay aligned with `types/theme.ts` + `SUBTITLE_STYLE_PRESETS`):

| Theme ID | UI title | Karaoke accent |
|----------|----------|----------------|
| `impact_yellow` | Impact Yellow | `#FFE600` |
| `cyberpunk` | Cyberpunk Green | `#10B981` |
| `editorial_clean` | Editorial Clean | `#06B6D4` |

**Rules:**

- Do **not** invent new theme IDs in the UI without updating `types/theme.ts` **and** `SUBTITLE_STYLE_PRESETS` (that update is out of scope for Lovable UI-only work).
- Do **not** hardcode alternate accent hexes in overlay/export paths; consume `getSubtitlePreset(theme)` / `THEME_PRESETS[theme]`.
- Karaoke behavior: the **currently spoken word** uses `activeColor`; other words stay white. Do not reintroduce static “keyword-only” subtitle coloring in the player.

### 1.3 Also treat as contract-critical (prefer read-only)

UI redesign may restyle these components’ **markup/classes**, but must preserve **props, callbacks, and engine calls**:

| Path | Why |
|------|-----|
| `types/theme.ts` | `ThemeId`, `THEME_PRESETS`, `parseThemeId`, `resolveExportThemeId` |
| `types/transcript.ts` | `TranscriptWord` / `TranscriptData` shape |
| `lib/player/transcriptIndex.ts` | Active-word index from timestamps |
| `lib/player/bgmSync.ts` | Preview BGM sync with video |
| `lib/assets/bgm.ts` | Persisted BGM selection |
| `app/api/export-capcut-local/route.ts` | “Open in CapCut” backend |
| `app/api/export-capcut/route.ts` | CapCut ZIP export |
| `app/api/export-mp4/route.ts` | Deprecated server burn-in (client export is canonical) |

**Allowed for Lovable:** `app/**` page shells, `components/**` visual layout (with preserved contracts below), Tailwind/CSS, marketing copy, spacing, fonts **as long as** engine wiring stays intact.

---

## 2. State & Prop Interfaces (must keep wiring)

### 2.1 Transcript word shape (`types/transcript.ts`)

```ts
interface TranscriptWord {
  word: string;
  start: number;   // seconds
  end: number;     // seconds
  highlight: boolean;
  effect?: "bounce" | "shake" | "glow";
  asset_url?: string;
  sfx_url?: string;
}

type TranscriptData = TranscriptWord[];
```

Active word index is derived from `video.currentTime` via `findActiveWordIndex(transcript, currentTime)` — **not** from React render loops that rewrite timestamps.

### 2.2 Theme IDs (`types/theme.ts`)

```ts
type ThemeId = "impact_yellow" | "cyberpunk" | "editorial_clean";
```

Legacy DB values (must keep parsing):

| Stored legacy | Resolves to |
|---------------|-------------|
| `pop_3d` | `impact_yellow` |
| `minimal_tech` | `editorial_clean` |

Always use `parseThemeId()` when reading from Supabase and `resolveExportThemeId(requestThemeId, projectTheme)` on export routes.

### 2.3 `VideoPlayerOverlay` — required props & handle

**File:** `components/VideoPlayerOverlay.tsx`

```ts
interface VideoPlayerOverlayProps {
  videoUrl: string;
  transcript: TranscriptData;
  theme: ThemeId;
  bgmUrl?: string;                          // project.selected_bgm_url
  onActiveWordChange?: (index: number) => void;
  onVideoDimensionsChange?: (width: number, height: number) => void;
  onSpeakerOffsetChange?: (offsetPercentX: number) => void;
  onSpeakerOffsetSegmentsChange?: (segments: SpeakerOffsetSegment[]) => void;
  onTimeUpdate?: (currentTime: number) => void;
  className?: string;
}

interface VideoPlayerOverlayHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getVideoDimensions: () => { width: number; height: number } | null;
}
```

**Internal / derived state Lovable must not break:**

| Concern | Source of truth |
|---------|-----------------|
| `activeWordIndex` | RAF / timeupdate → `findActiveWordIndex` |
| Phrase block | `getPhraseWordsForIndex` + `getSubtitlePreset(theme)` |
| Word styles | `getWebSubtitleWordStyle(preset, isActive)` |
| BGM preview | Hidden `<audio>` + `lib/player/bgmSync` helpers |
| Karaoke accent | Theme preset `activeColor` on the **active** word only |

**Performance rule (from `.cursorrules`):** keep overlay styling decoupled from heavy React state so 60FPS sync is preserved. Prefer refs + rAF for time-driven subtitle updates; do not re-render the whole page on every frame.

### 2.4 Project shell state (`ProjectView`)

`components/ProjectView.tsx` currently owns:

| State | Type | Wired to |
|-------|------|----------|
| `theme` | `ThemeId` | `ThemeSelector`, player, exports; persisted via Supabase `projects.theme` |
| `activeWordIndex` | `number` | Player `onActiveWordChange` → `TranscriptSidebar` |
| `sourceVideoWidth` / `sourceVideoHeight` | `number \| undefined` | CapCut local export |
| `speakerOffsetPercentX` | `number \| undefined` | CapCut local export |
| `speakerOffsetSegments` | `SpeakerOffsetSegment[] \| undefined` | CapCut local export |

Sidebar seek contract:

```ts
onSeek: (seconds: number, wordIndex: number) => void
// → playerRef.seekTo(seconds) + setActiveWordIndex(wordIndex)
```

### 2.5 Theme selector

```ts
interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}
```

UI may restyle cards, but option values **must** remain the three `ThemeId` keys above. Labels/descriptions should stay consistent with `THEME_PRESETS`.

---

## 3. Core Workflow Dependencies

### 3.1 Theme selection → engines

```
ThemeSelector.onChange(themeId)
  → setTheme(themeId)
  → supabase.projects.update({ theme: themeId })
  → VideoPlayerOverlay theme={themeId}          // preview karaoke tokens
  → ExportMp4Button themeId={themeId}           // client canvas export
  → ExportCapCutLocalButton themeId={themeId}   // CapCut draft
```

Export APIs must receive the **live UI theme** (not a stale label). Server routes call `resolveExportThemeId(body.themeId, project.theme)`.

### 3.2 Export MP4 (client canvas) — required trigger contract

**UI:** `components/ExportMp4Button.tsx`  
**Engine:** `exportProjectWithClientCanvas` / `downloadBlob` from `lib/export/clientCanvasExporter.ts`

Required props:

```ts
interface ExportMp4ButtonProps {
  projectId: string;
  themeId: ThemeId;
  videoUrl: string;
  transcript: TranscriptData;
  bgmUrl?: string | null;   // project.selected_bgm_url; falls back to DEFAULT_BGM_URL
}
```

On click, the button **must**:

1. Create `AbortController` (cancel support).
2. Set local recording state: `isExporting = true`, `progress = 0`, clear error.
3. Call:

```ts
exportProjectWithClientCanvas({
  videoUrl,
  bgmUrl: bgmUrl || CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL,
  transcript,
  theme: themeId,
  filenameStem: `motion-decorator-${projectId.slice(0, 8)}`,
  signal: controller.signal,
  onProgress: (value) => setProgress(value), // 0..1
});
```

4. On success: `downloadBlob(result.blob, result.filename)` and `progress = 1`.
5. On abort: show cancelled state; on other errors: show message.
6. Always clear `isExporting` in `finally`.

**UI may change** button chrome / progress bar styling.  
**UI must not** reimplement canvas/`MediaRecorder`/`AudioContext` mixing in a new file.

Progress bar binding: `percent = Math.round(progress * 100)`.

### 3.3 Open in CapCut (local inject) — required trigger contract

**UI:** `components/ExportCapCutLocalButton.tsx` (“Open Directly in CapCut”)  
**API:** `POST /api/export-capcut-local`

Required props:

```ts
interface ExportCapCutLocalButtonProps {
  projectId: string;
  themeId: ThemeId;
  sourceVideoWidth?: number;
  sourceVideoHeight?: number;
  speakerOffsetPercentX?: number;
  speakerOffsetSegments?: SpeakerOffsetSegment[];
}
```

On click, POST JSON body:

```json
{
  "projectId": "<uuid>",
  "themeId": "impact_yellow | cyberpunk | editorial_clean",
  "sourceVideoWidth": 1080,
  "sourceVideoHeight": 1920,
  "speakerOffsetPercentX": 0,
  "speakerOffsetSegments": []
}
```

Optional dimension/offset fields are passed through from `VideoPlayerOverlay` callbacks — do not drop them if the player still emits them.

Show busy state while exporting; surface `payload.message` on success and `payload.error` on failure.

### 3.4 CapCut ZIP export (secondary)

**UI:** `components/ExportCapCutButton.tsx`  
**API:** `GET /api/export-capcut?projectId=...&themeId=...` → download `.zip`

Keep `themeId` query param in sync with the live selector.

### 3.5 BGM parity

- Preview and exports must use **`project.selected_bgm_url`** (fallback: `CAPCUT_EXPORT_AUDIO.DEFAULT_BGM_URL`).
- Do not invent a second BGM picker in the UI without wiring persistence in `lib/assets/bgm.ts` / process-video (out of Lovable scope).

---

## 4. Safe vs Unsafe Change Checklist

### Safe (Lovable)

- [ ] Restyle `ProjectView` layout, headers, spacing, fonts, backgrounds
- [ ] Restyle `ThemeSelector` / export buttons / sidebar chrome (same props)
- [ ] Visual-only changes to `VideoPlayerOverlay` controls (play bar chrome) **without** changing rAF / active-word / BGM sync logic
- [ ] Copy/microcopy (avoid “keyword” language for karaoke themes)

### Unsafe (do not do)

- [ ] Edit `lib/export/`, `lib/capcut/`, `lib/ffmpeg/`
- [ ] Change `SHARED_SUBTITLE_TOKENS` hex values or CapCut font_size / `lineMaxWidth`
- [ ] Rename theme IDs or drop `parseThemeId` legacy aliases
- [ ] Drive subtitle color from CSS classes that ignore `getWebSubtitleWordStyle` / preset `activeColor`
- [ ] Replace client MP4 export with a new recorder that omits BGM `MediaStream` mix
- [ ] Call deprecated server `/api/export-mp4` as the primary MP4 path
- [ ] Remove CapCut local body fields used for speaker reframe

---

## 5. Verification After UI Refactor

Run from repo root:

```bash
npm run typecheck
```

Manual smoke:

1. Select each theme (`impact_yellow`, `cyberpunk`, `editorial_clean`) — preview karaoke accent matches table in §1.2.
2. Reload a project that still has DB theme `pop_3d` / `minimal_tech` — UI resolves via legacy parse.
3. **Export MP4** — progress updates; file has dialog **and** BGM; subtitles match theme.
4. **Open Directly in CapCut** — succeeds with current `themeId` + optional speaker offsets.
5. Play preview — active word tracks timestamps; sidebar seek still calls `seekTo`.

---

## 6. Quick import map for UI authors

```ts
// Themes
import { THEME_PRESETS, parseThemeId, type ThemeId } from "@/types/theme";

// Transcript
import type { TranscriptData } from "@/types/transcript";

// Preview player
import { VideoPlayerOverlay, type VideoPlayerOverlayHandle } from "@/components/VideoPlayerOverlay";

// Exports (keep these wrappers; restyle only)
import { ExportMp4Button } from "@/components/ExportMp4Button";
import { ExportCapCutLocalButton } from "@/components/ExportCapCutLocalButton";

// Engine APIs — import only, never fork
import { exportProjectWithClientCanvas, downloadBlob } from "@/lib/export/clientCanvasExporter";
import { getSubtitlePreset, CAPCUT_EXPORT_AUDIO } from "@/lib/capcut/presets";
```

**Bottom line:** Lovable owns pixels. Engines, tokens, theme IDs, and export callbacks stay owned by this repository’s `lib/` contracts.
