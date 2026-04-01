import { create } from 'zustand';
import { db, type Chapter } from '../db/dexie';
import { useSettingsStore } from './useSettingsStore';
import { downloadBookFile, fetchBooks } from '../lib/api';
import { tokenize } from '../lib/tokenizer';
import { detectLanguage } from '../lib/languageDetect';

interface ReaderState {
  isPlaying: boolean;
  currentWordIndex: number;
  currentChapter: number;
  wpm: number;
  wordsPerFlash: 1 | 2 | 3;
  words: string[]; // current chapter's words
  totalWords: number; // total across all chapters
  chapters: Chapter[];
  bookId: string | null;
  bookFormat: string | null;
  rampUpCounter: number;
  controlsVisible: boolean;
  paragraphBoundaries: number[];

  play: () => void;
  pause: () => void;
  toggle: () => void;
  setWpm: (n: number) => void;
  setWordIndex: (n: number) => void;
  nextWord: () => void;
  skipSentence: (forward: boolean) => void;
  skipParagraph: (forward: boolean) => void;
  setChapter: (n: number) => void;
  loadBook: (bookId: string) => Promise<void>;
  setWordsPerFlash: (n: 1 | 2 | 3) => void;
  toggleControls: () => void;
}

const SENTENCE_ENDINGS = /[.!?]/;

function findParagraphBoundaries(words: string[]): number[] {
  const boundaries: number[] = [0];
  for (let i = 0; i < words.length; i++) {
    if (words[i].includes('\n\n') || words[i] === '\u00B6') {
      if (i + 1 < words.length) {
        boundaries.push(i + 1);
      }
    }
  }
  return boundaries;
}

/**
 * Parse an ArrayBuffer into chapters with tokenized words.
 * Uses the same parsers as FileImport, but called at read-time.
 */
async function parseBookFile(
  data: ArrayBuffer,
  format: string,
): Promise<{ chapters: Chapter[]; totalWords: number }> {
  // Dynamically import the correct parser
  let parsed;
  switch (format) {
    case 'epub': {
      const { parseEpub } = await import('../lib/parsers/epub');
      parsed = await parseEpub(data);
      break;
    }
    case 'pdf': {
      const { parsePdf } = await import('../lib/parsers/pdf');
      parsed = await parsePdf(data);
      break;
    }
    case 'docx': {
      const { parseDocx } = await import('../lib/parsers/docx');
      parsed = await parseDocx(data);
      break;
    }
    case 'fb2': {
      const { parseFb2 } = await import('../lib/parsers/fb2');
      parsed = await parseFb2(data);
      break;
    }
    case 'txt':
    case 'md':
    default: {
      const { parseTxt } = await import('../lib/parsers/txt');
      parsed = await parseTxt(data, `book.${format}`);
      break;
    }
  }

  const langInfo = detectLanguage(
    parsed.chapters.map((c) => c.content).join(' ').slice(0, 2000),
  );

  const chapters: Chapter[] = [];
  let globalWordIndex = 0;

  for (let i = 0; i < parsed.chapters.length; i++) {
    const ch = parsed.chapters[i];
    const tokens = tokenize(ch.content, langInfo);
    const words = tokens.map((tok) => tok.word);
    chapters.push({
      index: i,
      title: ch.title || `Chapter ${i + 1}`,
      words,
      startWordIndex: globalWordIndex,
    });
    globalWordIndex += words.length;
  }

  return { chapters, totalWords: globalWordIndex };
}

export const useReaderStore = create<ReaderState>()((set, get) => ({
  isPlaying: false,
  currentWordIndex: 0,
  currentChapter: 0,
  wpm: 300,
  wordsPerFlash: 1,
  words: [],
  totalWords: 0,
  chapters: [],
  bookId: null,
  bookFormat: null,
  rampUpCounter: 0,
  controlsVisible: true,
  paragraphBoundaries: [],

  play: () => {
    set({ isPlaying: true, rampUpCounter: 0 });
  },

  pause: () => {
    set({ isPlaying: false });
  },

  toggle: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      get().pause();
    } else {
      get().play();
    }
  },

  setWpm: (n: number) => {
    const clamped = Math.max(50, Math.min(1500, n));
    set({ wpm: clamped });
  },

  setWordIndex: (n: number) => {
    const { words } = get();
    const clamped = Math.max(0, Math.min(n, words.length - 1));
    set({ currentWordIndex: clamped });
  },

  nextWord: () => {
    const { currentWordIndex, words, wordsPerFlash, rampUpCounter } = get();
    const nextIndex = currentWordIndex + wordsPerFlash;
    if (nextIndex >= words.length) {
      const { currentChapter, chapters } = get();
      if (currentChapter < chapters.length - 1) {
        get().setChapter(currentChapter + 1);
      } else {
        set({ isPlaying: false });
      }
      return;
    }
    set({
      currentWordIndex: nextIndex,
      rampUpCounter: rampUpCounter + 1,
    });
  },

  skipSentence: (forward: boolean) => {
    const { currentWordIndex, words } = get();
    if (forward) {
      for (let i = currentWordIndex + 1; i < words.length; i++) {
        if (SENTENCE_ENDINGS.test(words[i])) {
          const target = Math.min(i + 1, words.length - 1);
          set({ currentWordIndex: target });
          return;
        }
      }
      set({ currentWordIndex: words.length - 1 });
    } else {
      for (let i = currentWordIndex - 2; i >= 0; i--) {
        if (SENTENCE_ENDINGS.test(words[i])) {
          set({ currentWordIndex: i + 1 });
          return;
        }
      }
      set({ currentWordIndex: 0 });
    }
  },

  skipParagraph: (forward: boolean) => {
    const { currentWordIndex, paragraphBoundaries } = get();
    if (forward) {
      const next = paragraphBoundaries.find((b) => b > currentWordIndex);
      if (next != null) {
        set({ currentWordIndex: next });
      } else {
        const { words } = get();
        set({ currentWordIndex: words.length - 1 });
      }
    } else {
      let prev = 0;
      for (const b of paragraphBoundaries) {
        if (b >= currentWordIndex) break;
        prev = b;
      }
      set({ currentWordIndex: prev });
    }
  },

  setChapter: (n: number) => {
    const { chapters } = get();
    if (n < 0 || n >= chapters.length) return;
    const chapter = chapters[n];
    const boundaries = findParagraphBoundaries(chapter.words);
    set({
      currentChapter: n,
      currentWordIndex: 0,
      words: chapter.words,
      paragraphBoundaries: boundaries,
    });
  },

  loadBook: async (bookId: string) => {
    // 1. Get the book metadata from server to know its format
    const allBooks = await fetchBooks();
    const bookMeta = allBooks.find((b) => b.id === bookId);
    if (!bookMeta) {
      console.error(`Book with id ${bookId} not found on server`);
      return;
    }

    // 2. Download the raw file
    const fileData = await downloadBookFile(bookId);

    // 3. Parse and tokenize client-side
    const { chapters, totalWords } = await parseBookFile(fileData, bookMeta.format);

    // 4. Load saved progress from local IndexedDB
    const progress = await db.progress
      .where('bookId')
      .equals(bookId)
      .first();

    // 5. Inherit settings
    const settings = useSettingsStore.getState();

    const chapterIndex = progress?.currentChapter ?? 0;
    const wordIndex = progress?.currentWordIndex ?? 0;
    const chapter = chapters[chapterIndex] ?? chapters[0];
    const boundaries = findParagraphBoundaries(chapter?.words ?? []);

    set({
      bookId,
      bookFormat: bookMeta.format,
      chapters,
      totalWords,
      currentChapter: chapterIndex,
      currentWordIndex: wordIndex,
      words: chapter?.words ?? [],
      wpm: progress?.wpm ?? settings.wpm,
      wordsPerFlash: settings.wordsPerFlash,
      isPlaying: false,
      rampUpCounter: 0,
      controlsVisible: true,
      paragraphBoundaries: boundaries,
    });
  },

  setWordsPerFlash: (n: 1 | 2 | 3) => {
    set({ wordsPerFlash: n });
  },

  toggleControls: () => {
    set((state) => ({ controlsVisible: !state.controlsVisible }));
  },
}));
