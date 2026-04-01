/**
 * Multi-language text tokenizer for RSVP display.
 *
 * Splits input text into {@link Token} objects that carry metadata the
 * timing engine needs: punctuation flags, pause multipliers, and
 * positional indices.
 */

import type { LanguageInfo } from './languageDetect';

/** A single display unit produced by the tokenizer. */
export interface Token {
  /** The text content to display. */
  word: string;
  /** Zero-based position in the token stream. */
  index: number;
  /** Whether the token consists entirely of punctuation. */
  isPunctuation: boolean;
  /**
   * Multiplicative factor applied to the base display duration.
   * Values > 1.0 cause the word to linger longer on screen.
   */
  pauseMultiplier: number;
}

/** Japanese particle pattern used to split Japanese text. */
const JP_PARTICLE_RE = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+?(?:は|が|を|に|で|と|も|の|へ|か|な|よ|ね))/;

/**
 * Tokenize text according to the detected language.
 *
 * @param text - The full input text.
 * @param languageInfo - Result of {@link detectLanguage}.
 * @returns An ordered array of tokens.
 */
export function tokenize(text: string, languageInfo: LanguageInfo): Token[] {
  let rawChunks: string[];

  switch (languageInfo.script) {
    case 'cjk': {
      if (languageInfo.language === 'Japanese') {
        rawChunks = splitJapanese(text);
      } else {
        rawChunks = splitChinese(text);
      }
      break;
    }
    case 'korean':
    case 'latin':
    case 'cyrillic':
    case 'arabic':
    case 'hebrew':
    case 'default':
    default:
      rawChunks = splitOnWhitespace(text);
      break;
  }

  return rawChunks.map((word, idx) => buildToken(word, idx));
}

// ---------------------------------------------------------------------------
// Splitting strategies
// ---------------------------------------------------------------------------

/** Split text on whitespace, discarding empty segments. */
function splitOnWhitespace(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * Split Chinese text into 2-character chunks (the default chunk size).
 * Whitespace-separated segments are respected first, then each segment
 * is broken into fixed-width chunks.
 */
function splitChinese(text: string, chunkSize = 2): string[] {
  const segments = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  for (const seg of segments) {
    for (let i = 0; i < seg.length; i += chunkSize) {
      const chunk = seg.slice(i, i + chunkSize);
      if (chunk) {
        chunks.push(chunk);
      }
    }
  }

  return chunks;
}

/**
 * Split Japanese text on particles and whitespace.
 * Particles are kept attached to the preceding content.
 */
function splitJapanese(text: string): string[] {
  // First split on whitespace, then apply particle splitting to each segment.
  const wsSegments = text.split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const seg of wsSegments) {
    const parts = seg.split(JP_PARTICLE_RE).filter(Boolean);
    result.push(...parts);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Token construction
// ---------------------------------------------------------------------------

/** Punctuation-only pattern. */
const PUNCT_ONLY_RE = /^[\p{P}\p{S}]+$/u;

/**
 * Build a {@link Token} from raw text, computing pause multipliers.
 */
function buildToken(word: string, index: number): Token {
  const isPunctuation = PUNCT_ONLY_RE.test(word);
  const pauseMultiplier = computePauseMultiplier(word);

  return { word, index, isPunctuation, pauseMultiplier };
}

/**
 * Compute the combined pause multiplier for a word.
 *
 * Multiple factors are multiplied together:
 * - Sentence-ending punctuation (. ! ?) → 1.5
 * - Clause-separating punctuation (, ; :) → 1.2
 * - Dashes / ellipses (— ...) → 1.3
 * - Long words (> 8 chars) → 1 + (length - 8) * 0.1, capped at 2.0
 */
function computePauseMultiplier(word: string): number {
  let multiplier = 1.0;

  // Punctuation pauses (check the last character / last few characters).
  if (/[.!?]$/.test(word)) {
    multiplier *= 1.5;
  } else if (/[,;:]$/.test(word)) {
    multiplier *= 1.2;
  } else if (/(\u2014|\.{3})$/.test(word)) {
    // em-dash (—) or ellipsis (...)
    multiplier *= 1.3;
  }

  // Long-word factor.
  if (word.length > 8) {
    const longFactor = Math.min(1 + (word.length - 8) * 0.1, 2.0);
    multiplier *= longFactor;
  }

  return multiplier;
}
