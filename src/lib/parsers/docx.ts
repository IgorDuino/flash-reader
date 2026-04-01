import mammoth from 'mammoth';
import type { ParsedBook } from './types';
import { splitIntoChapters } from './txt';

export async function parseDocx(
  data: ArrayBuffer,
  filename?: string,
): Promise<ParsedBook> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: data });

    const text = result.value;
    if (!text.trim()) {
      throw new Error('The DOCX file appears to be empty or contains no extractable text.');
    }

    const title = filename ? stripExtension(filename) : 'Untitled Document';
    const chapters = splitIntoChapters(text);

    return {
      title,
      author: 'Unknown',
      chapters,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse DOCX: ${error.message}`);
    }
    throw new Error('Failed to parse DOCX: Unknown error');
  }
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || filename;
}
