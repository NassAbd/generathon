"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface DropzoneProps {
  onFile: (file: File | null) => void;
  disabled?: boolean;
  busyLabel?: string;
}

export function Dropzone({
  onFile,
  disabled = false,
  busyLabel = "Uploading your footage…",
}: DropzoneProps): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        onFile(event.dataTransfer.files?.[0] ?? null);
      }}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && !disabled) {
          inputRef.current?.click();
        }
      }}
      className={cn(
        "group relative w-full rounded-3xl border-2 border-dashed border-border bg-card/60 px-8 py-7 text-center transition-all duration-300 sm:px-10 sm:py-9",
        !disabled && "cursor-pointer hover:border-primary/70 hover:bg-card",
        dragging && "border-primary bg-primary/5 shadow-stage",
        disabled && "cursor-wait opacity-75",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          onFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-2.5 sm:gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary transition-transform duration-300 group-hover:-translate-y-0.5 sm:size-14">
          <UploadCloud className="size-5 sm:size-6" />
        </span>
        <p className="font-display text-base font-semibold sm:text-lg">
          {disabled ? busyLabel : "Drop your video here"}
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">
          MP4, MOV or WebM · up to 50 MB
        </p>
      </div>
    </div>
  );
}
