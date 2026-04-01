/**
 * Client-side API for the Vercel Blob-backed book storage.
 * Books are stored on the server; progress & settings stay in IndexedDB.
 */

export interface ServerBookMeta {
  id: string;
  title: string;
  author: string;
  format: string;
  coverImage?: string;
  totalWords: number;
  language: string;
  chapterTitles: string[];
  addedAt: number;
  fileUrl: string;
}

export interface UploadBookMetadata {
  id: string;
  title: string;
  author: string;
  format: string;
  coverImage?: string;
  totalWords: number;
  language: string;
  chapterTitles: string[];
  addedAt: number;
}

/** Fetch the list of all books on the server (metadata only). */
export async function fetchBooks(): Promise<ServerBookMeta[]> {
  const res = await fetch('/api/books');
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.status}`);
  return res.json();
}

/** Upload a book file + metadata to the server. Returns the created entry. */
export async function uploadBook(
  file: File | Blob,
  metadata: UploadBookMetadata,
): Promise<ServerBookMeta> {
  const form = new FormData();
  form.append('metadata', JSON.stringify(metadata));
  form.append('file', file);

  const res = await fetch('/api/books', { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Download the raw book file from the server. */
export async function downloadBookFile(bookId: string): Promise<ArrayBuffer> {
  const res = await fetch(`/api/books/${bookId}`);
  if (!res.ok) throw new Error(`Failed to download book: ${res.status}`);
  return res.arrayBuffer();
}

/** Delete a book from the server. */
export async function deleteBookFromServer(bookId: string): Promise<void> {
  const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete book: ${res.status}`);
}
