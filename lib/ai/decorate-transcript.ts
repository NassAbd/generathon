import {
  buildHeuristicDecorations,
  buildKeywordFilterPromptRules,
  refineKeywordDecorations,
} from "@/lib/ai/keyword-filter";
import {
  ASSET_FILES,
  buildAssetCatalogPrompt,
  getAssetUrl,
  getSfxUrl,
  isAllowedAssetFile,
  SFX_FILES,
} from "@/lib/assets/catalog";
import type { LlmDecoration, TranscriptData, WhisperWord, WordEffect } from "@/types/transcript";

const WORD_EFFECTS: WordEffect[] = ["bounce", "shake", "glow"];

interface LlmResponsePayload {
  decorations: LlmDecoration[];
}

function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}

function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? null;
}

function getHighlightTargetCount(wordCount: number): { min: number; max: number } {
  const max = Math.max(1, Math.ceil(wordCount / 5));
  const min = Math.max(1, Math.min(max, Math.floor(wordCount / 8)));
  return { min, max };
}

function buildSystemPrompt(minHighlights: number, maxHighlights: number): string {
  return [
    "You are a kinetic typography director for short-form social video.",
    `Select ${minHighlights}-${maxHighlights} high-impact keywords only — roughly 1 per 4-5 words, never filler.`,
    buildKeywordFilterPromptRules(),
    "For each selected word, assign:",
    "- effect: one of bounce, shake, glow",
    `- asset: MUST be exactly one of: ${ASSET_FILES.join(", ")}`,
    "- sfx: an SFX filename from the catalog",
    buildAssetCatalogPrompt(),
    'Return strict JSON: {"decorations":[{"index":0,"effect":"bounce","asset":"fire.png","sfx":"pop.mp3"}]}',
    "The asset field must match one allowed filename character-for-character. Reject any other asset name.",
    "Use zero-based index matching the input word list. Do not repeat indices.",
  ].join("\n");
}

function buildUserPrompt(words: WhisperWord[]): string {
  const indexedWords = words.map((entry, index) => ({
    index,
    word: entry.word,
    start: entry.start,
    end: entry.end,
  }));

  return JSON.stringify({ words: indexedWords }, null, 2);
}

function parseLlmJson(content: string): LlmResponsePayload {
  const trimmed = content.trim();
  const jsonText = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  const parsed = JSON.parse(jsonText) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("decorations" in parsed) ||
    !Array.isArray((parsed as LlmResponsePayload).decorations)
  ) {
    throw new Error("LLM response missing decorations array.");
  }

  return parsed as LlmResponsePayload;
}

function isWordEffect(value: string): value is WordEffect {
  return WORD_EFFECTS.includes(value as WordEffect);
}

function isSfxFile(value: string): boolean {
  return (SFX_FILES as readonly string[]).includes(value);
}

function validateDecorations(
  decorations: LlmDecoration[],
  wordCount: number,
): LlmDecoration[] {
  const seenIndices = new Set<number>();

  return decorations.filter((decoration) => {
    if (
      !Number.isInteger(decoration.index) ||
      decoration.index < 0 ||
      decoration.index >= wordCount ||
      seenIndices.has(decoration.index) ||
      !isWordEffect(decoration.effect) ||
      !isAllowedAssetFile(decoration.asset) ||
      !isSfxFile(decoration.sfx)
    ) {
      return false;
    }

    seenIndices.add(decoration.index);
    return true;
  });
}

function mergeTranscript(words: WhisperWord[], decorations: LlmDecoration[]): TranscriptData {
  const decorationByIndex = new Map(decorations.map((entry) => [entry.index, entry]));

  return words.map((entry, index) => {
    const decoration = decorationByIndex.get(index);
    if (!decoration) {
      return {
        word: entry.word,
        start: entry.start,
        end: entry.end,
        highlight: false,
      };
    }

    return {
      word: entry.word,
      start: entry.start,
      end: entry.end,
      highlight: true,
      effect: decoration.effect,
      asset_url: getAssetUrl(decoration.asset),
      sfx_url: getSfxUrl(decoration.sfx),
    };
  });
}

function fallbackDecorations(words: WhisperWord[]): LlmDecoration[] {
  return buildHeuristicDecorations(words);
}

function finalizeDecorations(decorations: LlmDecoration[], words: WhisperWord[]): LlmDecoration[] {
  const validated = validateDecorations(decorations, words.length);
  return refineKeywordDecorations(validated, words);
}

async function decorateWithOpenAi(words: WhisperWord[]): Promise<LlmDecoration[]> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const { min, max } = getHighlightTargetCount(words.length);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt(min, max) },
        { role: "user", content: buildUserPrompt(words) },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI decoration failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty decoration response.");
  }

  const parsed = parseLlmJson(content);
  return finalizeDecorations(parsed.decorations, words);
}

async function decorateWithGemini(words: WhisperWord[]): Promise<LlmDecoration[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const { min, max } = getHighlightTargetCount(words.length);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${buildSystemPrompt(min, max)}\n\n${buildUserPrompt(words)}` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini decoration failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Gemini returned an empty decoration response.");
  }

  const parsed = parseLlmJson(content);
  return finalizeDecorations(parsed.decorations, words);
}

export async function decorateTranscript(words: WhisperWord[]): Promise<TranscriptData> {
  let decorations: LlmDecoration[] = [];

  if (getOpenAiApiKey()) {
    decorations = await decorateWithOpenAi(words);
  } else if (getGeminiApiKey()) {
    decorations = await decorateWithGemini(words);
  } else {
    decorations = fallbackDecorations(words);
  }

  if (decorations.length === 0) {
    decorations = fallbackDecorations(words);
  }

  return mergeTranscript(words, decorations);
}

export function countHighlights(transcript: TranscriptData): number {
  return transcript.filter((entry) => entry.highlight).length;
}
