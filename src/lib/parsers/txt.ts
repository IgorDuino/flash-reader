import type { ParsedBook, ParsedChapter } from './types';

const CHAPTER_PATTERN = /^(chapter|part|section)\s+\d+/i;
const MARKDOWN_HEADING_PATTERN = /^#{1,3}\s+/;
const CHUNK_TARGET_SIZE = 5000;

export async function parseTxt(
  data: ArrayBuffer,
  filename: string,
): Promise<ParsedBook> {
  try {
    const text = decodeText(data);

    if (!text.trim()) {
      throw new Error('The file appears to be empty.');
    }

    const title = stripExtension(filename);
    const chapters = splitIntoChapters(text);

    return {
      title,
      author: 'Unknown',
      chapters,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse text file: ${error.message}`);
    }
    throw new Error('Failed to parse text file: Unknown error');
  }
}

function decodeText(data: ArrayBuffer): string {
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(data);
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || filename;
}

/**
 * Split text into chapters by detecting chapter markers or, failing that,
 * splitting into roughly equal chunks at paragraph boundaries.
 */
export function splitIntoChapters(text: string): ParsedChapter[] {
  const lines = text.split('\n');

  // First pass: find chapter marker lines
  const markerIndices: { index: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (CHAPTER_PATTERN.test(line)) {
      markerIndices.push({ index: i, title: line });
    } else if (MARKDOWN_HEADING_PATTERN.test(line)) {
      markerIndices.push({ index: i, title: line.replace(/^#+\s+/, '') });
    }
  }

  if (markerIndices.length >= 2) {
    return splitByMarkers(lines, markerIndices);
  }

  // No chapter markers found — split into chunks at paragraph boundaries
  return splitIntoChunks(text);
}

function splitByMarkers(
  lines: string[],
  markers: { index: number; title: string }[],
): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];

  // If there's content before the first marker, include it as a preamble
  if (markers[0].index > 0) {
    const preamble = lines.slice(0, markers[0].index).join('\n').trim();
    if (preamble) {
      chapters.push({ title: 'Preamble', content: preamble });
    }
  }

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : lines.length;
    const content = lines.slice(start + 1, end).join('\n').trim();

    if (content) {
      chapters.push({ title: markers[i].title, content });
    }
  }

  return chapters;
}

function splitIntoChunks(text: string): ParsedChapter[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chapters: ParsedChapter[] = [];
  let currentContent = '';
  let chapterIndex = 1;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (
      currentContent.length > 0 &&
      currentContent.length + trimmed.length > CHUNK_TARGET_SIZE
    ) {
      chapters.push({
        title: `Section ${chapterIndex}`,
        content: currentContent.trim(),
      });
      chapterIndex++;
      currentContent = trimmed;
    } else {
      currentContent += (currentContent ? '\n\n' : '') + trimmed;
    }
  }

  // Don't forget the last chunk
  if (currentContent.trim()) {
    chapters.push({
      title: chapters.length === 0 ? 'Full Text' : `Section ${chapterIndex}`,
      content: currentContent.trim(),
    });
  }

  return chapters;
}
