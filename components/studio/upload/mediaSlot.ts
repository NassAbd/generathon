/**
 * Shared landing media-slot shell.
 * BeforeAfterCard and ProcessingLoader must use the same height so the
 * idle → processing swap never shifts the 100dvh layout.
 */
export const MEDIA_SLOT_SHELL_CLASS =
  "flex h-[min(26rem,44dvh)] w-full flex-col overflow-hidden rounded-3xl border border-border bg-card/60 p-4 sm:p-5";

/** Preview frame height inside BeforeAfterCard (RAW + AI share this). */
export const MEDIA_FRAME_HEIGHT_CLASS =
  "h-56 max-h-[32dvh] sm:h-64 sm:max-h-[34dvh] lg:h-72 lg:max-h-[36dvh]";
