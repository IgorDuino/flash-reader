/**
 * Optimal Recognition Point (ORP) calculator for RSVP speed reading.
 *
 * The ORP is the character within a word that the eye naturally fixates on.
 * Highlighting it in red helps the reader lock onto each word faster,
 * reducing saccade time and improving comprehension at high speeds.
 */

/** Supported script classification for ORP calculation. */
export type ScriptType =
  | 'latin'
  | 'cyrillic'
  | 'cjk'
  | 'arabic'
  | 'hebrew'
  | 'korean'
  | 'default';

/**
 * Calculate the Optimal Recognition Point for a given word.
 *
 * @param word - The word to analyse.
 * @param script - The script/writing system the word belongs to.
 * @returns The zero-based character index that should be highlighted.
 */
export function calculateORP(word: string, script: ScriptType): number {
  if (word.length === 0) {
    return 0;
  }

  switch (script) {
    case 'cjk':
      // CJK ideographs: always fixate on the first character.
      return 0;

    case 'korean':
      // Korean syllable blocks: fixate on the centre character.
      return Math.floor(word.length / 2);

    case 'arabic':
    case 'hebrew':
      // RTL scripts: 30 % from the RIGHT end of the word.
      return word.length - 1 - Math.floor(word.length * 0.3);

    case 'latin':
    case 'cyrillic':
    case 'default':
    default: {
      // Latin / Cyrillic: ~30 % into the word with small-word overrides.
      if (word.length <= 2) {
        return 0;
      }
      if (word.length === 3) {
        return 1;
      }
      return Math.floor(word.length * 0.3);
    }
  }
}
