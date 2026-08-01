import type { LlmDecoration, WhisperWord } from "@/types/transcript";

/** Minimum word gap between keyword anchors (entity spans count as one anchor). */
export const MIN_WORDS_BETWEEN_KEYWORDS = 4;

/** Max highlights ≈ one per this many words. */
export const KEYWORD_DENSITY_WINDOW = 5;

export const KEYWORD_BLACKLIST = new Set([
  "say",
  "says",
  "said",
  "think",
  "thinks",
  "thought",
  "know",
  "knows",
  "knew",
  "actually",
  "this",
  "that",
  "well",
  "just",
  "like",
  "get",
  "gets",
  "got",
  "have",
  "has",
  "had",
  "did",
  "do",
  "does",
  "done",
  "really",
  "very",
  "maybe",
  "okay",
  "ok",
  "yeah",
  "yes",
  "no",
  "so",
  "then",
  "now",
  "here",
  "there",
  "when",
  "where",
  "what",
  "why",
  "how",
  "who",
  "which",
  "would",
  "could",
  "should",
  "can",
  "will",
  "is",
  "are",
  "was",
  "were",
  "am",
  "be",
  "been",
  "being",
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "because",
  "with",
  "for",
  "from",
  "into",
  "about",
  "you",
  "your",
  "i",
  "me",
  "my",
  "we",
  "our",
  "they",
  "them",
  "their",
  "he",
  "she",
  "it",
  "his",
  "her",
  "its",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "up",
  "out",
  "over",
  "under",
  "again",
  "also",
  "even",
  "still",
  "already",
  "always",
  "never",
  "ever",
  "too",
  "more",
  "most",
  "some",
  "any",
  "all",
  "each",
  "every",
  "both",
  "few",
  "many",
  "much",
  "such",
  "only",
  "own",
  "same",
  "other",
  "another",
  "way",
  "thing",
  "things",
  "something",
  "anything",
  "everything",
  "nothing",
  "people",
  "person",
  "time",
  "times",
  "day",
  "days",
  "year",
  "years",
  "make",
  "makes",
  "made",
  "making",
  "go",
  "goes",
  "went",
  "going",
  "come",
  "comes",
  "came",
  "coming",
  "take",
  "takes",
  "took",
  "taking",
  "see",
  "sees",
  "saw",
  "seeing",
  "look",
  "looks",
  "looked",
  "looking",
  "want",
  "wants",
  "wanted",
  "need",
  "needs",
  "needed",
  "try",
  "tries",
  "tried",
  "tell",
  "tells",
  "told",
  "talk",
  "talks",
  "talked",
  "talking",
  "speak",
  "speaks",
  "spoke",
  "speaking",
  "mean",
  "means",
  "meant",
  "feel",
  "feels",
  "felt",
  "seem",
  "seems",
  "seemed",
  "become",
  "becomes",
  "became",
  "keep",
  "keeps",
  "kept",
  "let",
  "lets",
  "put",
  "puts",
  "use",
  "uses",
  "used",
  "using",
  "find",
  "finds",
  "found",
  "give",
  "gives",
  "gave",
  "given",
  "work",
  "works",
  "worked",
  "working",
  "call",
  "calls",
  "called",
  "calling",
  "ask",
  "asks",
  "asked",
  "asking",
  "show",
  "shows",
  "showed",
  "showing",
  "start",
  "starts",
  "started",
  "starting",
  "stop",
  "stops",
  "stopped",
  "stopping",
  "run",
  "runs",
  "ran",
  "running",
  "move",
  "moves",
  "moved",
  "moving",
  "live",
  "lives",
  "lived",
  "living",
  "believe",
  "believes",
  "believed",
  "remember",
  "remembers",
  "remembered",
  "forget",
  "forgets",
  "forgot",
  "understand",
  "understands",
  "understood",
  "guess",
  "guesses",
  "guessed",
  "suppose",
  "supposes",
  "supposed",
  "kind",
  "sort",
  "type",
  "lot",
  "lots",
  "bit",
  "little",
  "pretty",
  "basically",
  "literally",
  "obviously",
  "honestly",
  "seriously",
  "anyway",
  "anyways",
  "right",
  "um",
  "uh",
  "ah",
  "oh",
  "hmm",
]);

const HIGH_IMPACT_EMOTIONAL_WORDS = new Set([
  "huge",
  "insane",
  "impossible",
  "brilliant",
  "incredible",
  "amazing",
  "crazy",
  "wild",
  "massive",
  "epic",
  "legendary",
  "unbelievable",
  "shocking",
  "devastating",
  "terrifying",
  "horrific",
  "beautiful",
  "gorgeous",
  "stunning",
  "powerful",
  "dangerous",
  "deadly",
  "fatal",
  "critical",
  "urgent",
  "secret",
  "hidden",
  "broken",
  "destroyed",
  "crushed",
  "exploded",
  "collapsed",
  "vanished",
  "disappeared",
  "survived",
  "escaped",
  "won",
  "lost",
  "failed",
  "succeeded",
  "dominated",
  "revolutionary",
  "genius",
  "million",
  "billions",
  "trillion",
  "viral",
  "famous",
]);

const HIGH_IMPACT_ACTION_VERBS = new Set([
  "build",
  "built",
  "building",
  "create",
  "created",
  "creating",
  "destroy",
  "destroyed",
  "destroying",
  "attack",
  "attacked",
  "attacking",
  "fight",
  "fought",
  "fighting",
  "win",
  "won",
  "winning",
  "lose",
  "lost",
  "losing",
  "kill",
  "killed",
  "killing",
  "save",
  "saved",
  "saving",
  "steal",
  "stole",
  "stolen",
  "stealing",
  "break",
  "broke",
  "broken",
  "breaking",
  "crash",
  "crashed",
  "crashing",
  "explode",
  "exploded",
  "exploding",
  "launch",
  "launched",
  "launching",
  "discover",
  "discovered",
  "discovering",
  "invent",
  "invented",
  "inventing",
  "betray",
  "betrayed",
  "betraying",
  "conquer",
  "conquered",
  "conquering",
  "escape",
  "escaped",
  "escaping",
  "survive",
  "survived",
  "surviving",
  "dominate",
  "dominated",
  "dominating",
]);

export interface NamedEntitySpan {
  startIndex: number;
  endIndex: number;
}

export function stripWordPunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export function normalizeToken(word: string): string {
  return stripWordPunctuation(word).toLowerCase();
}

export function isBlacklistedKeyword(word: string): boolean {
  const token = normalizeToken(word);
  if (token.length === 0) {
    return true;
  }
  return KEYWORD_BLACKLIST.has(token);
}

function isCapitalizedToken(word: string): boolean {
  const core = stripWordPunctuation(word);
  if (core.length === 0) {
    return false;
  }
  return /^[A-Z][a-z]+(?:[''][a-z]+)?$/.test(core);
}

function isAcronymToken(word: string): boolean {
  const core = stripWordPunctuation(word);
  return /^[A-Z0-9]{2,}$/.test(core);
}

function containsNumber(word: string): boolean {
  return /\d/.test(word);
}

export function findNamedEntitySpans(words: WhisperWord[]): NamedEntitySpan[] {
  const spans: NamedEntitySpan[] = [];
  let index = 0;

  while (index < words.length) {
    const token = stripWordPunctuation(words[index].word);
    const isEntityStart = isCapitalizedToken(words[index].word) || isAcronymToken(words[index].word);

    if (!isEntityStart || token.length === 0) {
      index += 1;
      continue;
    }

    let endIndex = index;
    while (endIndex + 1 < words.length) {
      const nextToken = stripWordPunctuation(words[endIndex + 1].word);
      if (nextToken.length === 0) {
        endIndex += 1;
        continue;
      }
      if (isCapitalizedToken(words[endIndex + 1].word) || isAcronymToken(words[endIndex + 1].word)) {
        endIndex += 1;
        continue;
      }
      break;
    }

    if (endIndex > index) {
      spans.push({ startIndex: index, endIndex });
    }

    index = endIndex + 1;
  }

  return spans;
}

function findEntitySpanForIndex(spans: NamedEntitySpan[], wordIndex: number): NamedEntitySpan | null {
  for (const span of spans) {
    if (wordIndex >= span.startIndex && wordIndex <= span.endIndex) {
      return span;
    }
  }
  return null;
}

export function scoreKeywordCandidate(words: WhisperWord[], index: number): number {
  const entry = words[index];
  if (!entry) {
    return -1;
  }

  if (isBlacklistedKeyword(entry.word)) {
    return -1;
  }

  const token = normalizeToken(entry.word);
  if (token.length < 2) {
    return -1;
  }

  let score = token.length;

  if (containsNumber(entry.word)) {
    score += 18;
  }

  if (HIGH_IMPACT_EMOTIONAL_WORDS.has(token)) {
    score += 16;
  }

  if (HIGH_IMPACT_ACTION_VERBS.has(token)) {
    score += 14;
  }

  if (isCapitalizedToken(entry.word)) {
    score += 12;
  }

  if (isAcronymToken(entry.word)) {
    score += 10;
  }

  const entitySpan = findEntitySpanForIndex(findNamedEntitySpans(words), index);
  if (entitySpan) {
    score += 20 + (entitySpan.endIndex - entitySpan.startIndex) * 4;
  }

  if (token.length >= 8) {
    score += 4;
  }

  return score;
}

function anchorDistance(a: number, b: number, words: WhisperWord[]): number {
  const entitySpans = findNamedEntitySpans(words);
  const spanA = findEntitySpanForIndex(entitySpans, a);
  const spanB = findEntitySpanForIndex(entitySpans, b);
  const anchorA = spanA?.startIndex ?? a;
  const anchorB = spanB?.startIndex ?? b;
  return Math.abs(anchorA - anchorB);
}

function isTooCloseToSelected(
  candidateIndex: number,
  selectedAnchorIndices: number[],
  words: WhisperWord[],
): boolean {
  const entitySpans = findNamedEntitySpans(words);
  const candidateSpan = findEntitySpanForIndex(entitySpans, candidateIndex);
  const candidateAnchor = candidateSpan?.startIndex ?? candidateIndex;

  for (const anchor of selectedAnchorIndices) {
    if (anchorDistance(candidateAnchor, anchor, words) < MIN_WORDS_BETWEEN_KEYWORDS) {
      return true;
    }
  }

  return false;
}

export function expandNamedEntityDecorations(
  decorations: LlmDecoration[],
  words: WhisperWord[],
): LlmDecoration[] {
  const byIndex = new Map<number, LlmDecoration>();
  for (const decoration of decorations) {
    byIndex.set(decoration.index, decoration);
  }

  const entitySpans = findNamedEntitySpans(words);

  for (const span of entitySpans) {
    let template: LlmDecoration | undefined;
    for (let index = span.startIndex; index <= span.endIndex; index += 1) {
      const existing = byIndex.get(index);
      if (existing) {
        template = existing;
        break;
      }
    }

    if (!template) {
      continue;
    }

    for (let index = span.startIndex; index <= span.endIndex; index += 1) {
      if (isBlacklistedKeyword(words[index].word)) {
        continue;
      }
      if (!byIndex.has(index)) {
        byIndex.set(index, { ...template, index });
      }
    }
  }

  return [...byIndex.values()].sort((left, right) => left.index - right.index);
}

export function filterBlacklistedDecorations(
  decorations: LlmDecoration[],
  words: WhisperWord[],
): LlmDecoration[] {
  return decorations.filter(
    (decoration) =>
      decoration.index >= 0 &&
      decoration.index < words.length &&
      !isBlacklistedKeyword(words[decoration.index].word),
  );
}

export function applyKeywordDensityFilter(
  decorations: LlmDecoration[],
  words: WhisperWord[],
  maxHighlights?: number,
): LlmDecoration[] {
  const cap = maxHighlights ?? Math.max(1, Math.ceil(words.length / KEYWORD_DENSITY_WINDOW));

  const ranked = decorations
    .map((decoration) => ({
      decoration,
      score: scoreKeywordCandidate(words, decoration.index),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.decoration.index - right.decoration.index;
    });

  const selected: LlmDecoration[] = [];
  const selectedAnchors: number[] = [];
  const entitySpans = findNamedEntitySpans(words);

  for (const { decoration } of ranked) {
    if (selected.length >= cap) {
      break;
    }

    if (isTooCloseToSelected(decoration.index, selectedAnchors, words)) {
      continue;
    }

    selected.push(decoration);
    const span = findEntitySpanForIndex(entitySpans, decoration.index);
    selectedAnchors.push(span?.startIndex ?? decoration.index);
  }

  return selected.sort((left, right) => left.index - right.index);
}

export function refineKeywordDecorations(
  decorations: LlmDecoration[],
  words: WhisperWord[],
): LlmDecoration[] {
  const withoutBlacklist = filterBlacklistedDecorations(decorations, words);
  const densityFiltered = applyKeywordDensityFilter(withoutBlacklist, words);
  return expandNamedEntityDecorations(densityFiltered, words);
}

export function buildHeuristicDecorations(words: WhisperWord[]): LlmDecoration[] {
  const effects = ["bounce", "shake", "glow"] as const;
  const assets = ["fire.png", "rocket.png", "star.png", "lightning.png", "brain.png"] as const;
  const sfx = ["whoosh.mp3", "shocking.mp3", "fah.mp3", "ding.mp3"] as const;

  const candidates: LlmDecoration[] = words
    .map((entry, index) => ({ index, score: scoreKeywordCandidate(words, index) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score)
    .map((entry, rank) => ({
      index: entry.index,
      effect: effects[rank % effects.length],
      asset: assets[rank % assets.length],
      sfx: sfx[rank % sfx.length],
    }));

  return refineKeywordDecorations(candidates, words);
}

export function buildKeywordFilterPromptRules(): string {
  return [
    "NEVER highlight blacklisted filler/functional words:",
    '[say, says, said, think, thinks, know, knows, actually, this, that, well, just, like, get, got, have, had, did, do].',
    "PRIORITIZE: proper nouns (people, places, brands), numbers/amounts, high-emotion adjectives",
    "(huge, insane, impossible, brilliant), and strong action verbs.",
    "For multi-word named entities (e.g. Christian Bale), include EVERY index in that entity span.",
    `Spacing: at most 1 keyword anchor every ${MIN_WORDS_BETWEEN_KEYWORDS} words (~1 per ${KEYWORD_DENSITY_WINDOW}-word window).`,
    "If multiple candidates cluster together, keep only the highest-impact one unless they form a named entity.",
  ].join("\n");
}
