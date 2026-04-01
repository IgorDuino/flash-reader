/**
 * Timing utilities for RSVP playback.
 *
 * Converts WPM to millisecond delays, applies per-token adjustments for
 * punctuation and long words, and provides a "ramp-up" easing curve so
 * the reader isn't immediately hit with full speed at the start.
 */

import type { Token } from './tokenizer';

/** Per-punctuation-type multiplier overrides. */
export interface PunctuationMultipliers {
  /** Multiplier for sentence-ending punctuation (. ! ?). */
  period: number;
  /** Multiplier for commas. */
  comma: number;
  /** Multiplier for semicolons and colons. */
  semicolon: number;
  /** Multiplier for em-dashes and ellipses. */
  dash: number;
}

/** Configuration for per-word delay adjustments. */
export interface TimingSettings {
  /** Whether to apply extra delay for long words. */
  longWordDelay: boolean;
  /** Character count above which a word is considered "long". */
  longWordThreshold: number;
  /** Whether to honour punctuation-based pauses. */
  punctuationPauses: boolean;
  /** Fine-grained punctuation multipliers. */
  punctuationMultipliers: PunctuationMultipliers;
}

/**
 * Convert a words-per-minute value to milliseconds per word.
 *
 * @param wpm - Target reading speed in words per minute.
 * @returns Milliseconds each word should be displayed.
 */
export function wpmToMs(wpm: number): number {
  if (wpm <= 0) {
    return 0;
  }
  return 60_000 / wpm;
}

/**
 * Calculate the actual display duration for a single token.
 *
 * @param baseMs - Base milliseconds per word (from {@link wpmToMs}).
 * @param token - The token being displayed.
 * @param settings - User-configurable timing adjustments.
 * @returns Adjusted delay in milliseconds.
 */
export function getWordDelay(
  baseMs: number,
  token: Token,
  settings: TimingSettings,
): number {
  let delay = baseMs;

  // Punctuation pauses.
  if (settings.punctuationPauses) {
    delay *= token.pauseMultiplier;
  }

  // Long-word delay.
  if (settings.longWordDelay && token.word.length > settings.longWordThreshold) {
    const extra = 1 + (token.word.length - settings.longWordThreshold) * 0.1;
    delay *= Math.min(extra, 2.0);
  }

  return delay;
}

/**
 * Compute a ramped-up (slower → faster) delay for the first few words.
 *
 * The first word is displayed at twice the target duration.  Over the
 * next {@link rampWords} words the delay linearly decreases to the
 * target value.
 *
 * @param targetMs - The steady-state delay in milliseconds.
 * @param wordIndex - Zero-based index of the current word.
 * @param rampWords - Number of words over which to ramp up (default 5).
 * @returns The delay in milliseconds for the given word index.
 */
export function getRampUpSpeed(
  targetMs: number,
  wordIndex: number,
  rampWords = 5,
): number {
  if (wordIndex >= rampWords) {
    return targetMs;
  }

  // Linear interpolation: 2× at index 0, 1× at index rampWords.
  const progress = wordIndex / rampWords;
  return targetMs * (2 - progress);
}
