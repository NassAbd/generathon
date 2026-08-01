"use client";

import { useState } from "react";

export interface CopyShareLinkButtonProps {
  projectId: string;
}

export function CopyShareLinkButton({ projectId }: CopyShareLinkButtonProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    const shareUrl = `${window.location.origin}/project/${projectId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this share link:", shareUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white transition hover:border-violet-400/40 hover:bg-violet-500/10"
    >
      {copied ? "Link copied!" : "Copy Share Link"}
    </button>
  );
}
