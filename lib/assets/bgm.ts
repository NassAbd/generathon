import { getBgmUrl } from "@/lib/assets/catalog";
import { getSupabasePublicUrl, getSupabaseServerClient } from "@/lib/supabase/server";

const ASSETS_BUCKET = "assets";
const BGM_FOLDER = "bgm";

/**
 * Canonical 1-of-2 alternation order.
 * Index 0 → cartoon.mp3, Index 1 → lofi_relax.mp3
 * (`tracks[index % tracks.length]`).
 */
export const CANONICAL_BGM_FILENAMES = ["cartoon.mp3", "lofi_relax.mp3"] as const;

export interface BgmTrack {
  filename: string;
  url: string;
  /** Storage object created_at when available (ISO). */
  createdAt: string | null;
}

type StorageListEntry = {
  name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

function isAudioFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".m4a");
}

function canonicalFallbackTracks(): BgmTrack[] {
  return CANONICAL_BGM_FILENAMES.map((filename) => ({
    filename,
    url: getBgmUrl(filename),
    createdAt: null,
  }));
}

/**
 * Resolve the two canonical tracks in fixed order from Storage listings.
 * Prefers `assets/bgm/<file>`, then `assets/<file>`.
 */
function resolveCanonicalTracksFromListings(
  bgmFolderEntries: StorageListEntry[],
  rootEntries: StorageListEntry[],
): BgmTrack[] {
  const byName = new Map<string, { entry: StorageListEntry; folder: "" | "bgm" }>();

  for (const entry of bgmFolderEntries) {
    if (!entry.name || !isAudioFilename(entry.name)) continue;
    byName.set(entry.name.toLowerCase(), { entry, folder: "bgm" });
  }
  for (const entry of rootEntries) {
    if (!entry.name || !isAudioFilename(entry.name)) continue;
    const key = entry.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, { entry, folder: "" });
    }
  }

  return CANONICAL_BGM_FILENAMES.map((filename) => {
    const match = byName.get(filename.toLowerCase());
    if (!match) {
      return {
        filename,
        url: getBgmUrl(filename),
        createdAt: null,
      };
    }

    const storagePath =
      match.folder === "bgm" ? `${BGM_FOLDER}/${match.entry.name}` : match.entry.name;

    return {
      filename,
      url: getSupabasePublicUrl(ASSETS_BUCKET, storagePath),
      createdAt: match.entry.created_at ?? match.entry.updated_at ?? null,
    };
  });
}

/**
 * Lists the two BGM files in fixed alternation order:
 * [cartoon.mp3, lofi_relax.mp3] — independent of Storage `created_at`.
 */
export async function listBgmTracksOrdered(): Promise<BgmTrack[]> {
  const supabase = getSupabaseServerClient();

  const [bgmList, rootList] = await Promise.all([
    supabase.storage.from(ASSETS_BUCKET).list(BGM_FOLDER, {
      limit: 200,
      offset: 0,
      sortBy: { column: "created_at", order: "asc" },
    }),
    supabase.storage.from(ASSETS_BUCKET).list("", {
      limit: 200,
      offset: 0,
      sortBy: { column: "created_at", order: "asc" },
    }),
  ]);

  if (bgmList.error && rootList.error) {
    console.warn(
      "[BGM] Storage list failed; using canonical fallback catalog.",
      bgmList.error.message,
      rootList.error?.message,
    );
    return canonicalFallbackTracks();
  }

  const tracks = resolveCanonicalTracksFromListings(
    (bgmList.data ?? []) as StorageListEntry[],
    (rootList.data ?? []) as StorageListEntry[],
  );

  console.info(
    `[BGM] Canonical tracks: ${tracks.map((t, i) => `${i}=${t.filename}`).join(", ")}`,
  );

  return tracks;
}

/** Deterministic track pick — `tracks[index % tracks.length]`. */
export function selectBgmTrackByIndex(tracks: BgmTrack[], index: number): BgmTrack {
  const catalog = tracks.length > 0 ? tracks : canonicalFallbackTracks();
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return catalog[safeIndex % catalog.length];
}

/**
 * Option A — last hex nibble of a UUID / project id.
 * `parseInt(projectId.slice(-1), 16) % trackCount` (hyphens stripped first).
 *
 * Why the old charCode sum failed in practice: UUID strings have a large fixed
 * prefix contribution (hyphens + version nibble). Combined with skewed id
 * samples it often collapsed to the same parity; the trailing nibble varies.
 */
export function bgmIndexFromProjectIdTail(projectId: string, trackCount: number): number {
  const length = Math.max(1, Math.floor(trackCount) || 1);
  const compact = projectId.replace(/-/g, "");
  const lastHex = compact.slice(-1);
  const nibble = Number.parseInt(lastHex, 16);
  if (Number.isFinite(nibble)) {
    return nibble % length;
  }

  const lastDigit = Number.parseInt(projectId.slice(-1), 10);
  if (Number.isFinite(lastDigit)) {
    return lastDigit % length;
  }

  return 0;
}

/** @deprecated Use bgmIndexFromProjectIdTail — kept for call-site compatibility. */
export function hashProjectIdToBgmIndex(projectId: string, trackCount: number): number {
  return bgmIndexFromProjectIdTail(projectId, trackCount);
}

/**
 * Option B — created_at second parity when UUID tail is unavailable.
 */
export function bgmIndexFromCreatedAt(createdAt: string, trackCount: number): number {
  const length = Math.max(1, Math.floor(trackCount) || 1);
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms)) {
    return 0;
  }
  return Math.abs(Math.floor(ms / 1000)) % length;
}

/**
 * Robust BGM slot for single uploads:
 * 1) Count of projects created earlier → true consecutive alternation
 * 2) Else UUID last hex nibble (Option A)
 * 3) Else created_at seconds (Option B)
 */
export async function getProjectBgmAssignmentIndex(
  projectId: string,
  trackCount: number = CANONICAL_BGM_FILENAMES.length,
): Promise<number> {
  const length = Math.max(1, trackCount);
  const supabase = getSupabaseServerClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (!projectError && project?.created_at) {
    const { count, error: countError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .lt("created_at", project.created_at);

    if (!countError && typeof count === "number") {
      // 0th project → cartoon, 1st → lofi, 2nd → cartoon, …
      return count % length;
    }

    console.warn(
      "[BGM] Earlier-project count unavailable; using created_at parity.",
      countError?.message,
    );
    return bgmIndexFromCreatedAt(project.created_at, length);
  }

  console.warn(
    "[BGM] Project created_at unavailable; using UUID last-hex nibble.",
    projectError?.message,
  );
  return bgmIndexFromProjectIdTail(projectId, length);
}

/** Fetch ordered tracks and assign one for the given project / batch index. */
export async function resolveBgmTrackForIndex(index: number): Promise<BgmTrack> {
  const tracks = await listBgmTracksOrdered();
  return selectBgmTrackByIndex(tracks, index);
}

/**
 * Compute a BGM assignment (does NOT persist). Prefer
 * `getOrAssignProjectBgmTrack` so preview/export share one stored choice.
 */
export async function resolveBgmTrackForProject(projectId: string): Promise<BgmTrack> {
  const tracks = await listBgmTracksOrdered();
  const index = await getProjectBgmAssignmentIndex(projectId, tracks.length);
  const track = selectBgmTrackByIndex(tracks, index);
  console.log(
    `[BGM Selection] Project ID: ${projectId} -> Selected Index: ${index} -> Track: ${track.filename}`,
  );
  return track;
}

/** Build a track from DB columns already attached to the project. */
export function bgmTrackFromStoredFields(
  selectedBgmTrack: string | null | undefined,
  selectedBgmUrl: string | null | undefined,
): BgmTrack | null {
  const filename = selectedBgmTrack?.trim();
  if (!filename) {
    return null;
  }

  return {
    filename,
    url: selectedBgmUrl?.trim() || getBgmUrl(filename),
    createdAt: null,
  };
}

/**
 * Read the project's persisted BGM. Does not recompute assignment.
 * Returns null when the column has not been set yet (legacy rows).
 */
export async function getStoredProjectBgmTrack(projectId: string): Promise<BgmTrack | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("selected_bgm_track, selected_bgm_url")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[BGM] Failed to read stored BGM for project.", error?.message);
    return null;
  }

  return bgmTrackFromStoredFields(data.selected_bgm_track, data.selected_bgm_url);
}

/**
 * Persist a BGM choice on the project (idempotent write of filename + URL).
 */
export async function persistProjectBgmTrack(
  projectId: string,
  track: BgmTrack,
): Promise<BgmTrack> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({
      selected_bgm_track: track.filename,
      selected_bgm_url: track.url,
    })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to persist selected BGM: ${error.message}`);
  }

  console.log(
    `[BGM Selection] Project ID: ${projectId} -> Selected Index: stored -> Track: ${track.filename}`,
  );
  return track;
}

/**
 * Return the BGM already stored on the project; if missing (legacy), assign once,
 * write `selected_bgm_track` / `selected_bgm_url`, then return that same track.
 * Export/preview must both go through this (or stored fields) — never re-roll.
 */
export async function getOrAssignProjectBgmTrack(projectId: string): Promise<BgmTrack> {
  const stored = await getStoredProjectBgmTrack(projectId);
  if (stored) {
    console.log(
      `[BGM Selection] Project ID: ${projectId} -> Selected Index: stored -> Track: ${stored.filename}`,
    );
    return stored;
  }

  const assigned = await resolveBgmTrackForProject(projectId);
  return persistProjectBgmTrack(projectId, assigned);
}

/**
 * Batch helper: assign BGM without duplicates until the catalog wraps.
 * `const selectedTrack = tracks[index % tracks.length]`
 */
export function assignBgmTracksByModulo<T>(
  items: T[],
  tracks: BgmTrack[],
): Array<{ item: T; index: number; track: BgmTrack }> {
  return items.map((item, index) => ({
    item,
    index,
    track: selectBgmTrackByIndex(tracks, index),
  }));
}
