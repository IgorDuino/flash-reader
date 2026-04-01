import Dexie, { type Table } from 'dexie';

export interface BookRecord {
  id?: number;
  title: string;
  author: string;
  format: 'epub' | 'pdf' | 'txt' | 'md' | 'docx' | 'fb2' | 'mobi';
  fileData: ArrayBuffer; // raw file for re-parsing
  coverImage?: string; // base64 data URL
  totalWords: number;
  chapters: Chapter[];
  language: string;
  addedAt: number; // timestamp
}

export interface Chapter {
  index: number;
  title: string;
  words: string[]; // pre-tokenized words
  startWordIndex: number; // global word index offset
}

export interface ReadingProgress {
  id?: number;
  bookId: number;
  currentWordIndex: number;
  currentChapter: number;
  wpm: number;
  lastReadAt: number;
  percentComplete: number;
}

export interface AppSettings {
  id?: number;
  key: string;
  value: any;
}

class FlashReadDB extends Dexie {
  books!: Table<BookRecord>;
  progress!: Table<ReadingProgress>;
  settings!: Table<AppSettings>;

  constructor() {
    super('flashread');
    this.version(1).stores({
      books: '++id, title, author, format, addedAt',
      progress: '++id, bookId, lastReadAt',
      settings: '++id, &key',
    });
  }
}

export const db = new FlashReadDB();
