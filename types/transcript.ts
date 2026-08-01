export type WordEffect = "bounce" | "shake" | "glow";

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  highlight: boolean;
  effect?: WordEffect;
  asset_url?: string;
  sfx_url?: string;
}

export type TranscriptData = TranscriptWord[];

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface LlmDecoration {
  index: number;
  effect: WordEffect;
  asset: string;
  sfx: string;
}

export interface ProcessVideoRequest {
  projectId: string;
  videoUrl: string;
}

export interface ProcessVideoResponse {
  projectId: string;
  status: "completed";
  wordCount: number;
  highlightCount: number;
}
