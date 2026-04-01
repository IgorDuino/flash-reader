import { create } from 'zustand';
import { db, type Chapter } from '../db/dexie';
import { useSettingsStore } from './useSettingsStore';

interface ReaderState {
  isPlaying: boolean;
  currentWordIndex: number;
  currentChapter: number;
  wpm: number;
  wordsPerFlash: 1 | 2 | 3;
  words: string[]; // current chapter's words
  totalWords: number; // total across all chapters
  chapters: Chapter[];
  bookId: number | null;
  rampUpCounter: number;
  controlsVisible: boolean;
  paragraphBoundaries: number[]; // word indices where paragraphs start

  play: () => void;
  pause: () => void;
  toggle: () => void;
  setWpm: (n: number) => void;
  setWordIndex: (n: number) => void;
  nextWord: () => void;
  skipSentence: (forward: boolean) => void;
  skipParagraph: (forward: boolean) => void;
  setChapter: (n: number) => void;
  loadBook: (bookId: number) => Promise<void>;
  setWordsPerFlash: (n: 1 | 2 | 3) => void;
  toggleControls: () => void;
}

const SENTENCE_ENDINGS = /[.!?]/;

function findParagraphBoundaries(words: string[]): number[] {
  const boundaries: number[] = [0];
  for (let i = 0; i < words.length; i++) {
    // A paragraph boundary is indicated by a word that contains
    // a double newline or is a paragraph marker
    if (words[i].includes('\n\n') || words[i] === '\u00B6') {
      if (i + 1 < words.length) {
        boundaries.push(i + 1);
      }
    }
  }
  return boundaries;
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
      // Try to advance to the next chapter
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
      // No sentence end found; go to end of chapter
      set({ currentWordIndex: words.length - 1 });
    } else {
      // Scan backward for previous sentence ending, then position after it
      for (let i = currentWordIndex - 2; i >= 0; i--) {
        if (SENTENCE_ENDINGS.test(words[i])) {
          set({ currentWordIndex: i + 1 });
          return;
        }
      }
      // No sentence beginning found; go to start
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
      // Find the paragraph boundary before the current one
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

  loadBook: async (bookId: number) => {
    const book = await db.books.get(bookId);
    if (!book) {
      console.error(`Book with id ${bookId} not found`);
      return;
    }

    // Load saved progress
    const progress = await db.progress
      .where('bookId')
      .equals(bookId)
      .first();

    // Inherit settings from the settings store
    const settings = useSettingsStore.getState();

    const chapterIndex = progress?.currentChapter ?? 0;
    const wordIndex = progress?.currentWordIndex ?? 0;
    const chapter = book.chapters[chapterIndex] ?? book.chapters[0];
    const boundaries = findParagraphBoundaries(chapter?.words ?? []);

    set({
      bookId,
      chapters: book.chapters,
      totalWords: book.totalWords,
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
