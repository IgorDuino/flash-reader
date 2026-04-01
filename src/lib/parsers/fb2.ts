import type { ParsedBook, ParsedChapter } from './types';

export async function parseFb2(data: ArrayBuffer): Promise<ParsedBook> {
  try {
    const decoder = new TextDecoder('utf-8');
    const xml = decoder.decode(data);

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Check for XML parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid FB2 file: XML parsing failed.');
    }

    const title = extractTitle(doc);
    const author = extractAuthor(doc);
    const language = extractLanguage(doc);
    const chapters = extractChapters(doc);

    if (chapters.length === 0) {
      throw new Error(
        'Could not extract any content from the FB2 file. The file may be corrupted.',
      );
    }

    return { title, author, chapters, language };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse FB2: ${error.message}`);
    }
    throw new Error('Failed to parse FB2: Unknown error');
  }
}

function extractTitle(doc: Document): string {
  // Try <book-title> inside <title-info>
  const bookTitle = doc.querySelector('title-info book-title');
  if (bookTitle?.textContent?.trim()) {
    return bookTitle.textContent.trim();
  }
  return 'Untitled';
}

function extractAuthor(doc: Document): string {
  const authorEl = doc.querySelector('title-info author');
  if (!authorEl) return 'Unknown';

  const firstName = authorEl.querySelector('first-name')?.textContent?.trim() || '';
  const middleName = authorEl.querySelector('middle-name')?.textContent?.trim() || '';
  const lastName = authorEl.querySelector('last-name')?.textContent?.trim() || '';

  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Unknown';
}

function extractLanguage(doc: Document): string | undefined {
  const lang = doc.querySelector('title-info lang');
  return lang?.textContent?.trim() || undefined;
}

function extractChapters(doc: Document): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  const body = doc.querySelector('body');
  if (!body) return chapters;

  const sections = body.querySelectorAll(':scope > section');

  if (sections.length === 0) {
    // No sections — treat entire body as one chapter
    const text = extractSectionText(body);
    if (text.trim()) {
      chapters.push({ title: 'Full Text', content: text.trim() });
    }
    return chapters;
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionTitle = extractSectionTitle(section) || `Chapter ${i + 1}`;
    const content = extractSectionText(section);

    if (content.trim()) {
      chapters.push({ title: sectionTitle, content: content.trim() });
    }
  }

  return chapters;
}

function extractSectionTitle(section: Element): string | null {
  const titleEl = section.querySelector(':scope > title');
  if (!titleEl) return null;
  const text = titleEl.textContent?.trim();
  return text || null;
}

function extractSectionText(element: Element): string {
  const paragraphs: string[] = [];

  // Collect text from <p> elements
  const pElements = element.querySelectorAll('p');
  for (const p of pElements) {
    const text = p.textContent?.trim();
    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs.join('\n\n');
}
