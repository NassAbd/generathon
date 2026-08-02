import { Clapperboard } from "lucide-react";
import type { ReactNode } from "react";

export function AppHeader({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 md:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Clapperboard className="size-4" />
        </span>
        <span className="truncate font-display text-lg font-bold tracking-tight">
          Subtitler<span className="text-primary">.</span>
        </span>
      </div>
      {children}
    </header>
  );
}
