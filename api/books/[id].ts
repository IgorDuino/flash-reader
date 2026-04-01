import { del, list, put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ServerBookMeta } from './index';

const INDEX_PATH = '_library/index.json';

async function readIndex(): Promise<ServerBookMeta[]> {
  const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
  if (blobs.length === 0) return [];
  const res = await fetch(blobs[0].url);
  if (!res.ok) return [];
  return (await res.json()) as ServerBookMeta[];
}

async function writeIndex(books: ServerBookMeta[]): Promise<void> {
  await put(INDEX_PATH, JSON.stringify(books), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing book id' });
  }

  try {
    if (req.method === 'GET') {
      // Return the blob URL so the client can fetch it directly from CDN
      const books = await readIndex();
      const book = books.find((b) => b.id === id);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      return res.status(200).json({ fileUrl: book.fileUrl });
    }

    if (req.method === 'DELETE') {
      const books = await readIndex();
      const bookIndex = books.findIndex((b) => b.id === id);
      if (bookIndex === -1) return res.status(404).json({ error: 'Book not found' });

      const book = books[bookIndex];

      // Delete the file blob
      try {
        await del(book.fileUrl);
      } catch {
        // Blob may already be gone, ignore
      }

      // Remove from index and save
      books.splice(bookIndex, 1);
      await writeIndex(books);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`API /api/books/${id} error:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
