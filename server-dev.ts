/**
 * Local dev API server.
 * Mirrors the Vercel serverless functions in api/books/ but runs as plain Express.
 * Uses the same @vercel/blob SDK — talks to the real Vercel Blob store via BLOB_READ_WRITE_TOKEN in .env.local.
 *
 * Usage:  npx tsx server-dev.ts
 *         (Vite proxies /api → http://localhost:3001)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // also load .env if exists
import express from 'express';
import { put, list, del } from '@vercel/blob';

const app = express();
const PORT = 3001;

// ─── index helpers ──────────────────────────────────────────────────────────

interface ServerBookMeta {
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

// ─── routes ─────────────────────────────────────────────────────────────────

// GET /api/books — list all books
app.get('/api/books', async (_req, res) => {
  try {
    const books = await readIndex();
    res.json(books);
  } catch (err) {
    console.error('GET /api/books error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/books — upload a book (multipart: metadata + file)
app.post('/api/books', express.raw({ type: '*/*', limit: '200mb' }), async (req, res) => {
  try {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Missing boundary' });

    const body = req.body as Buffer;
    const parts = parseMultipart(body, boundary);
    const metaPart = parts.find((p) => p.name === 'metadata');
    const filePart = parts.find((p) => p.name === 'file');

    if (!metaPart || !filePart) {
      return res.status(400).json({ error: 'Missing metadata or file part' });
    }

    const meta = JSON.parse(metaPart.data.toString('utf-8')) as Omit<ServerBookMeta, 'fileUrl'>;

    const ext = meta.format || 'bin';
    const blobPath = `books/${meta.id}.${ext}`;
    const { url: fileUrl } = await put(blobPath, filePart.data, {
      access: 'public',
      addRandomSuffix: false,
      contentType: filePart.contentType || 'application/octet-stream',
    });

    const bookEntry: ServerBookMeta = { ...meta, fileUrl };
    const books = await readIndex();
    books.push(bookEntry);
    await writeIndex(books);

    res.status(201).json(bookEntry);
  } catch (err) {
    console.error('POST /api/books error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/books/:id — return the blob file URL
app.get('/api/books/:id', async (req, res) => {
  try {
    const books = await readIndex();
    const book = books.find((b) => b.id === req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ fileUrl: book.fileUrl });
  } catch (err) {
    console.error(`GET /api/books/${req.params.id} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/books/:id
app.delete('/api/books/:id', async (req, res) => {
  try {
    const books = await readIndex();
    const idx = books.findIndex((b) => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Book not found' });

    const book = books[idx];
    try { await del(book.fileUrl); } catch { /* blob may be gone */ }

    books.splice(idx, 1);
    await writeIndex(books);
    res.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/books/${req.params.id} error:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── multipart parser (same as Vercel function) ────────────────────────────

interface Part { name: string; filename?: string; contentType?: string; data: Buffer; }

function parseMultipart(body: Buffer, boundary: string): Part[] {
  const parts: Part[] = [];
  const sep = Buffer.from(`--${boundary}`);
  const endMark = Buffer.from(`--${boundary}--`);

  let start = bufIndexOf(body, sep, 0);
  if (start === -1) return parts;
  start += sep.length;

  while (true) {
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

    const nextBoundary = bufIndexOf(body, sep, start);
    if (nextBoundary === -1) break;

    const partData = body.subarray(start, nextBoundary);
    const headerEnd = bufIndexOf(partData, Buffer.from('\r\n\r\n'), 0);
    if (headerEnd === -1) { start = nextBoundary + sep.length; continue; }

    const headerStr = partData.subarray(0, headerEnd).toString('utf-8');
    let data = partData.subarray(headerEnd + 4);
    if (data.length >= 2 && data[data.length - 2] === 0x0d && data[data.length - 1] === 0x0a) {
      data = data.subarray(0, data.length - 2);
    }

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1],
        contentType: ctMatch?.[1]?.trim(),
        data,
      });
    }

    start = nextBoundary + sep.length;
    if (bufIndexOf(body, endMark, nextBoundary) === nextBoundary) break;
  }
  return parts;
}

function bufIndexOf(buf: Buffer, search: Buffer, from: number): number {
  for (let i = from; i <= buf.length - search.length; i++) {
    let ok = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

// ─── start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  📚 FlashRead API dev server running at http://localhost:${PORT}\n`);
});
