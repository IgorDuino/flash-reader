import { create } from 'zustand';
import { db, type ReadingProgress } from '../db/dexie';
import {
  fetchBooks,
  uploadBook,
  deleteBookFromServer,
  type ServerBookMeta,
  type UploadBookMetadata,
} from '../lib/api';

export type BookWithProgress = ServerBookMeta & { progress?: ReadingProgress };

interface LibraryState {
  books: BookWithProgress[];
  searchQuery: string;
  isLoading: boolean;

  init: () => Promise<void>;
  loadBooks: () => Promise<void>;
  addBook: (file: File | Blob, metadata: UploadBookMetadata) => Promise<string>;
  deleteBook: (id: string) => Promise<void>;
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
      // Fetch book metadata from the server
      const serverBooks = await fetchBooks();

      // Read progress from local IndexedDB
      const allProgress = await db.progress.toArray();
      const progressByBookId = new Map<string, ReadingProgress>();
      for (const p of allProgress) {
        const existing = progressByBookId.get(p.bookId);
        if (!existing || p.lastReadAt > existing.lastReadAt) {
          progressByBookId.set(p.bookId, p);
        }
      }

      const booksWithProgress: BookWithProgress[] = serverBooks.map((book) => ({
        ...book,
        progress: progressByBookId.get(book.id),
      }));

      set({ books: booksWithProgress, isLoading: false });
    } catch (error) {
      console.error('Failed to load books:', error);
      set({ isLoading: false });
    }
  },

  addBook: async (file: File | Blob, metadata: UploadBookMetadata): Promise<string> => {
    const created = await uploadBook(file, metadata);
    await get().loadBooks();
    return created.id;
  },

  deleteBook: async (id: string) => {
    await deleteBookFromServer(id);
    // Also remove local progress records for this book
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
        book.author.toLowerCase().includes(query),
    );
  },
}));
