import { create } from 'zustand';
import { db, type BookRecord, type ReadingProgress } from '../db/dexie';

export type BookWithProgress = BookRecord & { progress?: ReadingProgress };

interface LibraryState {
  books: BookWithProgress[];
  searchQuery: string;
  isLoading: boolean;

  init: () => Promise<void>;
  loadBooks: () => Promise<void>;
  addBook: (record: BookRecord) => Promise<number>;
  deleteBook: (id: number) => Promise<void>;
  setSearchQuery: (q: string) => void;
  getFilteredBooks: () => BookWithProgress[];
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  books: [],
  searchQuery: '',
  isLoading: false,

  init: async () => {
    await get().loadBooks();
  },

  loadBooks: async () => {
    set({ isLoading: true });
    try {
      const allBooks = await db.books.toArray();
      const allProgress = await db.progress.toArray();

      // Index progress by bookId (use the latest entry per book)
      const progressByBookId = new Map<number, ReadingProgress>();
      for (const p of allProgress) {
        const existing = progressByBookId.get(p.bookId);
        if (!existing || p.lastReadAt > existing.lastReadAt) {
          progressByBookId.set(p.bookId, p);
        }
      }

      const booksWithProgress: BookWithProgress[] = allBooks.map((book) => ({
        ...book,
        progress: book.id != null ? progressByBookId.get(book.id) : undefined,
      }));

      set({ books: booksWithProgress, isLoading: false });
    } catch (error) {
      console.error('Failed to load books:', error);
      set({ isLoading: false });
    }
  },

  addBook: async (record: BookRecord): Promise<number> => {
    const id = await db.books.add(record);
    await get().loadBooks();
    return id as number;
  },

  deleteBook: async (id: number) => {
    await db.books.delete(id);
    // Also remove all progress records for this book
    await db.progress.where('bookId').equals(id).delete();
    await get().loadBooks();
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
  },

  getFilteredBooks: (): BookWithProgress[] => {
    const { books, searchQuery } = get();
    if (!searchQuery.trim()) return books;

    const query = searchQuery.toLowerCase().trim();
    return books.filter(
      (book) =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
    );
  },
}));
