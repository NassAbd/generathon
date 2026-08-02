import { ArrowRight } from "lucide-react";

function Pill({ label, tone }: { label: string; tone: "muted" | "accent" }): JSX.Element {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground"
          : "rounded-full bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm"
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
 */
export function BeforeAfterCard(): JSX.Element {
  return (
    <div className="w-full rounded-3xl border border-border bg-card/60 p-3 sm:p-4">
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        <figure className="relative h-52 w-[min(100%,280px)] shrink-0 overflow-hidden rounded-2xl border border-border aspect-[4/3] sm:h-56">
          <img
            src="/studio/before-raw-wide.jpg"
            alt="Raw unedited horizontal footage of a creator talking to camera"
            width={1280}
            height={720}
            loading="lazy"
            className="h-full w-full object-cover opacity-70 grayscale-[35%]"
          />
          <figcaption className="absolute left-2 top-2">
            <Pill label="Raw footage" tone="muted" />
          </figcaption>
        </figure>

        <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden />

        <figure className="relative h-52 shrink-0 overflow-hidden rounded-2xl border border-primary/40 shadow-stage aspect-[9/16] sm:h-56">
          <img
            src="/studio/after-enhanced.jpg"
            alt="AI enhanced vertical short with burned-in captions"
            width={576}
            height={1024}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute left-2 top-2">
            <Pill label="AI enhanced" tone="accent" />
          </figcaption>
          <div className="absolute inset-x-1.5 bottom-2 rounded-lg bg-black/75 px-1.5 py-1 text-center backdrop-blur-sm">
            <p className="font-display text-[9px] font-bold uppercase leading-tight tracking-tight text-white sm:text-[10px]">
              THIS CHANGED <span style={{ color: "#FFE600" }}>EVERYTHING</span>
            </p>
          </div>
        </figure>
      </div>

      <div className="mt-3 text-center">
        <p className="font-display text-sm font-semibold">From raw take to viral short</p>
        <p className="mx-auto mt-1 max-w-md text-balance text-xs leading-relaxed text-muted-foreground">
          Word-level transcription, karaoke captions and a themed overlay — generated in one pass,
          ready to export or open in CapCut.
        </p>
      </div>
    </div>
  );
}
