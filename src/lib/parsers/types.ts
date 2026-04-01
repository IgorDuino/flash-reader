export interface ParsedBook {
  title: string;
  author: string;
  coverImage?: string; // base64 data URL
  chapters: ParsedChapter[];
  language?: string;
}

export interface ParsedChapter {
  title: string;
  content: string; // raw text content
}
