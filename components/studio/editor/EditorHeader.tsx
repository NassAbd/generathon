import type { ReactNode } from "react";

export interface EditorHeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export function EditorHeader({ title, subtitle, actions }: EditorHeaderProps): JSX.Element {
  return (
    <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 pb-4 md:px-8">
      <div className="min-w-0">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Pitch preview
        </p>
        <h1 className="truncate font-display text-xl font-bold md:text-2xl">{title}</h1>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}
