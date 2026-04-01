import type { ParsedBook } from './types';

export type { ParsedBook, ParsedChapter } from './types';

export async function parseFile(file: File): Promise<ParsedBook> {
  const extension = getExtension(file.name);
  const data = await file.arrayBuffer();

  switch (extension) {
    case 'epub':
      return (await import('./epub')).parseEpub(data);

    case 'pdf':
      return (await import('./pdf')).parsePdf(data);

    case 'txt':
    case 'md':
      return (await import('./txt')).parseTxt(data, file.name);

    case 'docx':
      return (await import('./docx')).parseDocx(data, file.name);

    case 'fb2':
      return (await import('./fb2')).parseFb2(data);

    case 'mobi':
      throw new Error(
        'MOBI format is not supported. Please convert to EPUB using Calibre or similar tool.',
      );

    default:
      throw new Error(
        `Unsupported file format: .${extension}. Supported formats: EPUB, PDF, TXT, MD, DOCX, FB2.`,
      );
  }
}

function getExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}
