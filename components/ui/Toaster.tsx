"use client";

import { Toaster as SonnerToaster } from "sonner";

/** Fixed bottom-right toasts — keeps header action buttons from shifting. */
export function Toaster(): JSX.Element {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-card text-foreground shadow-stage font-sans",
          title: "font-medium",
          description: "text-muted-foreground",
          success: "border-primary/40",
          error: "border-destructive/40",
        },
      }}
    />
  );
}
