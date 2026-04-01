import { put, list, del } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = { api: { bodyParser: false } };

/** Shape of the metadata stored per book in the index blob. */
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
  fileUrl: string; // Vercel Blob URL for the raw file
}

// ─── helpers ────────────────────────────────────────────────────────────────

const INDEX_PATH = '_library/index.json';

async function readIndex(): Promise<ServerBookMeta[]> {
  const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
  if (blobs.length === 0) return [];
  const res = await fetch(blobs[0].url);
  if (!res.ok) return [];
  return (await res.json()) as ServerBookMeta[];
}

async function writeIndex(books: ServerBookMeta[]): Promise<void> {
  // Overwrite the index blob (addRandomSuffix false keeps the path stable)
  await put(INDEX_PATH, JSON.stringify(books), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
}

// ─── handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const books = await readIndex();
      return res.status(200).json(books);
    }

    if (req.method === 'POST') {
      // Expect multipart form: file + metadata JSON string
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const body = Buffer.concat(chunks);

      const contentType = req.headers['content-type'] ?? '';

      if (contentType.includes('multipart/form-data')) {
        // Parse multipart manually (lightweight, no dep)
        const boundary = contentType.split('boundary=')[1];
        if (!boundary) return res.status(400).json({ error: 'Missing boundary' });

        const parts = parseMultipart(body, boundary);
        const metaPart = parts.find((p) => p.name === 'metadata');
        const filePart = parts.find((p) => p.name === 'file');

        if (!metaPart || !filePart) {
          return res.status(400).json({ error: 'Missing metadata or file part' });
        }

        const meta = JSON.parse(metaPart.data.toString('utf-8')) as Omit<ServerBookMeta, 'fileUrl'>;

        // Upload the raw book file to Vercel Blob
        const ext = meta.format || 'bin';
        const blobPath = `books/${meta.id}.${ext}`;
        const { url: fileUrl } = await put(blobPath, filePart.data, {
          access: 'public',
          addRandomSuffix: false,
          contentType: filePart.contentType || 'application/octet-stream',
        });

        const bookEntry: ServerBookMeta = { ...meta, fileUrl };

        // Update library index
        const books = await readIndex();
        books.push(bookEntry);
        await writeIndex(books);

        return res.status(201).json(bookEntry);
      }

      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/books error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── tiny multipart parser ──────────────────────────────────────────────────

interface Part {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): Part[] {
  const parts: Part[] = [];
  const sep = Buffer.from(`--${boundary}`);
  const end = Buffer.from(`--${boundary}--`);

  let start = indexOf(body, sep, 0);
  if (start === -1) return parts;
  start += sep.length;

  while (true) {
    // skip CRLF after boundary
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

    const nextBoundary = indexOf(body, sep, start);
    if (nextBoundary === -1) break;

    const partData = body.subarray(start, nextBoundary);
    // Split headers from body at \r\n\r\n
    const headerEnd = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
    if (headerEnd === -1) { start = nextBoundary + sep.length; continue; }

    const headerStr = partData.subarray(0, headerEnd).toString('utf-8');
    let data = partData.subarray(headerEnd + 4);
    // Remove trailing \r\n before boundary
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
    // Check for end boundary
    if (indexOf(body, end, nextBoundary) === nextBoundary) break;
  }

  return parts;
}

function indexOf(buf: Buffer, search: Buffer, fromIndex: number): number {
  for (let i = fromIndex; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}
