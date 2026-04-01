import Dexie, { type Table } from 'dexie';

/**
 * Chapter shape — used at runtime after client-side parsing.
 * NOT stored in IndexedDB; derived on-the-fly when a book is opened.
 */
export interface Chapter {
  index: number;
  title: string;
  words: string[]; // pre-tokenized words
  startWordIndex: number; // global word index offset
}

/**
 * Reading progress — stored locally in IndexedDB.
 * bookId is a UUID string matching the server-side book ID.
 */
export interface ReadingProgress {
  id?: number;
  bookId: string;
  currentWordIndex: number;
  currentChapter: number;
  wpm: number;
  lastReadAt: number;
  percentComplete: number;
}

export interface AppSettings {
  id?: number;
  key: string;
  value: unknown;
}

class FlashReadDB extends Dexie {
  progress!: Table<ReadingProgress>;
  settings!: Table<AppSettings>;

  constructor() {
    super('flashread');

    // v1 had a books table — drop it in v2
    this.version(1).stores({
      books: '++id, title, author, format, addedAt',
      progress: '++id, bookId, lastReadAt',
      settings: '++id, &key',
    });

    this.version(2).stores({
      books: null, // delete the books table
      progress: '++id, bookId, lastReadAt',
      settings: '++id, &key',
    });
  }
}

export const db = new FlashReadDB();
