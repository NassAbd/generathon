import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface VideoStageProps {
  children: ReactNode;
  className?: string;
}

/**
 * 9:16 studio stage chrome. Drop the real HTML5 player + overlay inside —
 * do not reimplement karaoke/BGM here.
 */
export function VideoStage({ children, className }: VideoStageProps): JSX.Element {
  return (
    <div className={cn("relative flex min-h-0 flex-1 items-center justify-center", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative flex h-full max-h-full min-h-0 flex-col justify-center">
        <div className="relative mx-auto flex h-full max-h-full min-h-0 rounded-[2rem] border border-border bg-surface-raised p-2 shadow-stage">
          <div className="relative aspect-[9/16] h-full min-h-0 overflow-hidden rounded-[1.6rem] bg-black">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
