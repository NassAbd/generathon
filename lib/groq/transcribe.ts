import type { WhisperWord } from "@/types/transcript";

const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

interface GroqVerboseWord {
  word: string;
  start: number;
  end: number;
}

interface GroqVerboseResponse {
  words?: GroqVerboseWord[];
  duration?: number;
}

function getGroqApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable.");
  }
  return apiKey;
}

function inferMediaFilename(videoUrl: string): string {
  const pathname = new URL(videoUrl).pathname.toLowerCase();
  if (pathname.endsWith(".mov")) return "audio.mov";
  if (pathname.endsWith(".mp4")) return "audio.mp4";
  if (pathname.endsWith(".m4a")) return "audio.m4a";
  if (pathname.endsWith(".webm")) return "audio.webm";
  return "audio.mp4";
}

export interface TranscriptionResult {
  words: WhisperWord[];
  durationSeconds: number | null;
}

export async function transcribeVideoUrl(videoUrl: string): Promise<TranscriptionResult> {
  const mediaResponse = await fetch(videoUrl);
  if (!mediaResponse.ok) {
    throw new Error(`Failed to fetch video for transcription (${mediaResponse.status}).`);
  }

  const mediaBuffer = await mediaResponse.arrayBuffer();
  const formData = new FormData();
  formData.append("file", new Blob([mediaBuffer]), inferMediaFilename(videoUrl));
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const transcriptionResponse = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${getGroqApiKey()}` },
    body: formData,
  });

  if (!transcriptionResponse.ok) {
    const errorBody = await transcriptionResponse.text();
    throw new Error(`Groq transcription failed (${transcriptionResponse.status}): ${errorBody}`);
  }

  const payload = (await transcriptionResponse.json()) as GroqVerboseResponse;
  const words = (payload.words ?? []).map((entry) => ({
    word: entry.word.trim(),
    start: entry.start,
    end: entry.end,
  })).filter((entry) => entry.word.length > 0);

  if (words.length === 0) {
    throw new Error("Groq transcription returned no word-level timestamps.");
  }

  const durationSeconds =
    payload.duration ??
    words.reduce((maxEnd, word) => Math.max(maxEnd, word.end), 0);

  return { words, durationSeconds };
}
