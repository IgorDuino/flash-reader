import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedBook, ParsedChapter } from './types';

// Configure the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

const PAGES_PER_CHAPTER = 50;

export async function parsePdf(data: ArrayBuffer): Promise<ParsedBook> {
  try {
    const doc = await pdfjsLib.getDocument({ data }).promise;

    // Extract metadata
    const metadata = await doc.getMetadata();
    const info = metadata.info as PdfInfo | null;
    const title = info?.Title || 'Untitled PDF';
    const author = info?.Author || 'Unknown';
    const language = (info as Record<string, unknown>)?.Language as
      | string
      | undefined;

    const totalPages = doc.numPages;
    const chapters: ParsedChapter[] = [];

    // Process pages in batches to form chapters
    for (
      let startPage = 1;
      startPage <= totalPages;
      startPage += PAGES_PER_CHAPTER
    ) {
      const endPage = Math.min(startPage + PAGES_PER_CHAPTER - 1, totalPages);
      const pageTexts: string[] = [];

      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        try {
          const page = await doc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .filter(isTextItem)
            .map((item) => item.str)
            .join(' ');

          if (pageText.trim()) {
            pageTexts.push(pageText.trim());
          }
        } catch {
          // Skip pages that fail to load
        }
      }

      if (pageTexts.length > 0) {
        const chapterTitle =
          totalPages <= PAGES_PER_CHAPTER
            ? title
            : `Pages ${startPage}–${endPage}`;

        chapters.push({
          title: chapterTitle,
          content: pageTexts.join('\n\n'),
        });
      }
    }

    if (chapters.length === 0) {
      throw new Error(
        'Could not extract any text from the PDF. The file may be image-based or corrupted.',
      );
    }

    doc.destroy();

    return { title, author, chapters, language };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
    throw new Error('Failed to parse PDF: Unknown error');
  }
}

interface PdfInfo {
  Title?: string;
  Author?: string;
}

interface PdfTextItem {
  str: string;
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object' && item !== null && 'str' in item;
}
