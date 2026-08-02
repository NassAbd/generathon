import { ArrowRight } from "lucide-react";

import {
  MEDIA_FRAME_HEIGHT_CLASS,
  MEDIA_SLOT_SHELL_CLASS,
} from "@/components/studio/upload/mediaSlot";
import { cn } from "@/lib/utils";

function Pill({ label, tone }: { label: string; tone: "muted" | "accent" }): JSX.Element {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground sm:text-[11px]"
          : "rounded-full bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm sm:text-[11px]"
      }
    >
      {label}
    </span>
  );
}

/**
 * Marketing before/after strip.
 * RAW FOOTAGE is width-constrained so it reads less wide while sharing
 * the same height as the 9:16 AI ENHANCED card.
 * Shell height matches ProcessingLoader via MEDIA_SLOT_SHELL_CLASS.
 */
export function BeforeAfterCard(): JSX.Element {
  return (
    <div className={MEDIA_SLOT_SHELL_CLASS}>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-4 sm:gap-6">
        <figure
          className={cn(
            "relative w-[min(100%,340px)] shrink-0 overflow-hidden rounded-2xl border border-border aspect-[4/3]",
            MEDIA_FRAME_HEIGHT_CLASS,
          )}
        >
          <img
            src="/studio/before-raw-wide.jpg"
            alt="Raw unedited horizontal footage of a creator talking to camera"
            width={1280}
            height={720}
            loading="lazy"
            className="h-full w-full object-cover opacity-70 grayscale-[35%]"
          />
          <figcaption className="absolute left-2 top-2 sm:left-3 sm:top-3">
            <Pill label="Raw footage" tone="muted" />
          </figcaption>
        </figure>

        <ArrowRight className="size-5 shrink-0 text-primary sm:size-6" aria-hidden />

        <figure
          className={cn(
            "relative shrink-0 overflow-hidden rounded-2xl border border-primary/40 shadow-stage aspect-[9/16]",
            MEDIA_FRAME_HEIGHT_CLASS,
          )}
        >
          <img
            src="/studio/after-enhanced.jpg"
            alt="AI enhanced vertical short with burned-in captions"
            width={576}
            height={1024}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute left-2 top-2 sm:left-3 sm:top-3">
            <Pill label="AI enhanced" tone="accent" />
          </figcaption>
          <div className="absolute inset-x-2 bottom-2 rounded-lg bg-black/75 px-2 py-1.5 text-center backdrop-blur-sm sm:inset-x-2.5 sm:bottom-2.5">
            <p className="font-display text-[10px] font-bold uppercase leading-tight tracking-tight text-white sm:text-xs">
              THIS CHANGED <span style={{ color: "#FFE600" }}>EVERYTHING</span>
            </p>
          </div>
        </figure>
      </div>

      <div className="mt-3 shrink-0 text-center sm:mt-4">
        <p className="font-display text-sm font-semibold sm:text-base">From raw take to viral short</p>
        <p className="mx-auto mt-1 max-w-xl text-balance text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Word-level transcription, karaoke captions and a themed overlay — generated in one pass,
          ready to export or open in CapCut.
        </p>
      </div>
    </div>
  );
}
