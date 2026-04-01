import ePub from 'epubjs';
import type { ParsedBook, ParsedChapter } from './types';

export async function parseEpub(data: ArrayBuffer): Promise<ParsedBook> {
  try {
    const book = ePub(data);

    const metadata = await book.loaded.metadata;
    const navigation = await book.loaded.navigation;
    await book.loaded.spine;

    const title = metadata.title || 'Untitled';
    const author = metadata.creator || 'Unknown';
    const language = metadata.language || undefined;

    // Try to get cover image
    let coverImage: string | undefined;
    try {
      const coverUrl = await book.coverUrl();
      if (coverUrl) {
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        coverImage = await blobToBase64(blob);
      }
    } catch {
      // Cover extraction is best-effort
    }

    // Build a map of href -> toc title for chapter naming
    const tocTitles = new Map<string, string>();
    if (navigation.toc) {
      for (const item of navigation.toc) {
        // Navigation hrefs may include fragment identifiers; strip them for matching
        const href = item.href.split('#')[0];
        tocTitles.set(href, item.label.trim());
      }
    }

    // Extract chapters from spine
    const chapters: ParsedChapter[] = [];
    const spine = book.spine as unknown as { items: SpineItem[] };

    for (let i = 0; i < spine.items.length; i++) {
      const item = spine.items[i];
      try {
        const section = book.section(item.href);
        if (!section) continue;

        const contents: unknown = await section.load(book.load.bind(book));

        // epub.js section.load() can return different types depending on version:
        // - A Document
        // - An Element (HTMLElement / HTMLHtmlElement)
        // - A string of HTML
        // We must handle all cases to extract plain text.
        let text = '';
        if (contents instanceof Document) {
          text = extractTextFromNode(contents);
        } else if (contents instanceof Element) {
          text = extractTextFromNode(contents);
        } else if (typeof contents === 'string') {
          const doc = new DOMParser().parseFromString(contents, 'text/html');
          text = extractTextFromNode(doc);
        } else {
          // Last resort: try to get textContent if it's some DOM-like object
          text = (contents as { textContent?: string })?.textContent || '';
        }
        if (!text.trim()) continue;

        // Determine chapter title: prefer TOC title, fall back to index
        const bareHref = item.href.split('#')[0];
        const chapterTitle =
          tocTitles.get(bareHref) ||
          tocTitles.get(item.href) ||
          `Chapter ${chapters.length + 1}`;

        chapters.push({ title: chapterTitle, content: text.trim() });
      } catch {
        // Skip sections that fail to load
      }
    }

    if (chapters.length === 0) {
      throw new Error(
        'Could not extract any text content from the EPUB file. The file may be DRM-protected or corrupted.',
      );
    }

    book.destroy();

    return { title, author, coverImage, chapters, language };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse EPUB: ${error.message}`);
    }
    throw new Error('Failed to parse EPUB: Unknown error');
  }
}

interface SpineItem {
  href: string;
  index: number;
}

function extractTextFromNode(node: Document | Element): string {
  // Work on a clone so we don't mutate the original
  const clone = node.cloneNode(true) as Document | Element;

  // Remove script and style elements
  const unwanted = clone.querySelectorAll('script, style');
  unwanted.forEach((el) => el.remove());

  // For a Document, prefer body content; for an Element, use it directly
  if (clone instanceof Document) {
    return clone.body?.textContent || clone.documentElement?.textContent || '';
  }
  return clone.textContent || '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
