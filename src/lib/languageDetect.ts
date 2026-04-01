/**
 * Unicode-block-based language / script detection.
 *
 * Analyses the first 500 characters of a text sample and counts how many
 * code-points fall into each known Unicode block.  The block with the
 * highest count determines the result.
 */

import type { ScriptType } from './orp';

/** Direction of the detected writing system. */
export type TextDirection = 'ltr' | 'rtl';

/** Result of language detection. */
export interface LanguageInfo {
  /** Broad script classification used by other modules. */
  script: ScriptType;
  /** Text direction. */
  direction: TextDirection;
  /** Human-readable language / script label (e.g. "Chinese", "Arabic"). */
  language: string;
}

/** Internal bucket used while counting code-points. */
interface ScriptBucket {
  script: ScriptType;
  direction: TextDirection;
  language: string;
  count: number;
}

/**
 * Detect the dominant script / language of a text sample.
 *
 * @param text - Arbitrary input text.
 * @returns A {@link LanguageInfo} object describing the detected script.
 */
export function detectLanguage(text: string): LanguageInfo {
  const sample = text.slice(0, 500);

  const buckets: Record<string, ScriptBucket> = {
    chinese:  { script: 'cjk',      direction: 'ltr', language: 'Chinese',  count: 0 },
    japanese: { script: 'cjk',      direction: 'ltr', language: 'Japanese', count: 0 },
    korean:   { script: 'korean',   direction: 'ltr', language: 'Korean',   count: 0 },
    arabic:   { script: 'arabic',   direction: 'rtl', language: 'Arabic',   count: 0 },
    hebrew:   { script: 'hebrew',   direction: 'rtl', language: 'Hebrew',   count: 0 },
    cyrillic: { script: 'cyrillic', direction: 'ltr', language: 'Cyrillic', count: 0 },
  };

  for (const ch of sample) {
    const cp = ch.codePointAt(0)!;

    if (cp >= 0x4e00 && cp <= 0x9fff) {
      // CJK Unified Ideographs — could be Chinese or Japanese kanji.
      buckets.chinese.count++;
    } else if ((cp >= 0x3040 && cp <= 0x309f) || (cp >= 0x30a0 && cp <= 0x30ff)) {
      // Hiragana or Katakana → Japanese.
      buckets.japanese.count++;
    } else if ((cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0x1100 && cp <= 0x11ff)) {
      // Hangul syllables / Jamo → Korean.
      buckets.korean.count++;
    } else if (cp >= 0x0600 && cp <= 0x06ff) {
      buckets.arabic.count++;
    } else if (cp >= 0x0590 && cp <= 0x05ff) {
      buckets.hebrew.count++;
    } else if (cp >= 0x0400 && cp <= 0x04ff) {
      buckets.cyrillic.count++;
    }
  }

  // If Japanese kana is present alongside CJK ideographs, prefer Japanese.
  if (buckets.japanese.count > 0 && buckets.chinese.count > 0) {
    buckets.japanese.count += buckets.chinese.count;
    buckets.chinese.count = 0;
  }

  let winner: ScriptBucket | null = null;
  for (const bucket of Object.values(buckets)) {
    if (bucket.count > 0 && (winner === null || bucket.count > winner.count)) {
      winner = bucket;
    }
  }

  if (winner) {
    return {
      script: winner.script,
      direction: winner.direction,
      language: winner.language,
    };
  }

  // Default: Latin / English.
  return { script: 'latin', direction: 'ltr', language: 'English' };
}
