import React, { useCallback, useRef, useState } from 'react';
import { parseFile } from '../lib/parsers/index';
import { tokenize } from '../lib/tokenizer';
import { detectLanguage } from '../lib/languageDetect';
import { useLibraryStore } from '../store/useLibraryStore';
import { t, useLanguage } from '../i18n';
import type { BookRecord, Chapter } from '../db/dexie';
import type { ParsedBook } from '../lib/parsers/types';

interface FileImportProps {
  onImportComplete?: (bookId: number) => void;
}

const ACCEPTED_EXTENSIONS = '.epub,.pdf,.txt,.md,.docx,.fb2,.mobi';

function buildBookRecord(parsed: ParsedBook, fileData: ArrayBuffer, format: BookRecord['format']): BookRecord {
  const langInfo = detectLanguage(
    parsed.chapters.map((c) => c.content).join(' ').slice(0, 2000),
  );

  const chapters: Chapter[] = [];
  let globalWordIndex = 0;

  for (let i = 0; i < parsed.chapters.length; i++) {
    const ch = parsed.chapters[i];
    const tokens = tokenize(ch.content, langInfo);
    const words = tokens.map((tok) => tok.word);

    chapters.push({
      index: i,
      title: ch.title || `Chapter ${i + 1}`,
      words,
      startWordIndex: globalWordIndex,
    });

    globalWordIndex += words.length;
  }

  return {
    title: parsed.title || 'Untitled',
    author: parsed.author || 'Unknown',
    format,
    fileData,
    coverImage: parsed.coverImage,
    totalWords: globalWordIndex,
    chapters,
    language: parsed.language || langInfo.language,
    addedAt: Date.now(),
  };
}

function getFormat(filename: string): BookRecord['format'] {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'txt';
  const valid: BookRecord['format'][] = ['epub', 'pdf', 'txt', 'md', 'docx', 'fb2', 'mobi'];
  return (valid.includes(ext as BookRecord['format']) ? ext : 'txt') as BookRecord['format'];
}

const FileImport: React.FC<FileImportProps> = ({ onImportComplete }) => {
  useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addBook = useLibraryStore((s) => s.addBook);

  const clearStatus = useCallback(() => {
    setTimeout(() => setStatusMessage(null), 4000);
  }, []);

  const handleImportFile = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setStatusMessage(null);

      try {
        const parsed: ParsedBook = await parseFile(file);
        const arrayBuffer = await file.arrayBuffer();
        const format = getFormat(file.name);
        const record = buildBookRecord(parsed, arrayBuffer, format);
        const bookId = await addBook(record);

        setStatusMessage({ type: 'success', text: `"${record.title}" imported successfully` });
        clearStatus();
        onImportComplete?.(bookId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import file';
        setStatusMessage({ type: 'error', text: message });
        clearStatus();
      } finally {
        setIsLoading(false);
      }
    },
    [addBook, onImportComplete, clearStatus],
  );

  const handleImportText = useCallback(async () => {
    if (!pasteText.trim()) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const langInfo = detectLanguage(pasteText.slice(0, 2000));
      const tokens = tokenize(pasteText, langInfo);
      const words = tokens.map((tok) => tok.word);

      const title = pasteText.slice(0, 40).trim().replace(/\s+/g, ' ') || 'Pasted Text';
      const record: BookRecord = {
        title,
        author: 'Unknown',
        format: 'txt',
        fileData: new TextEncoder().encode(pasteText).buffer as ArrayBuffer,
        totalWords: words.length,
        chapters: [
          {
            index: 0,
            title: 'Full Text',
            words,
            startWordIndex: 0,
          },
        ],
        language: langInfo.language,
        addedAt: Date.now(),
      };

      const bookId = await addBook(record);
      setPasteText('');
      setStatusMessage({ type: 'success', text: `"${title}" imported successfully` });
      clearStatus();
      onImportComplete?.(bookId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import text';
      setStatusMessage({ type: 'error', text: message });
      clearStatus();
    } finally {
      setIsLoading(false);
    }
  }, [pasteText, addBook, onImportComplete, clearStatus]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleImportFile(file);
      }
    },
    [handleImportFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImportFile(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [handleImportFile],
  );

  return (
    <div className="space-y-6">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
          px-6 py-12 transition-colors duration-200 cursor-pointer
          ${
            isDragOver
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-secondary)]'
          }
          ${isLoading ? 'pointer-events-none opacity-60' : ''}
        `}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label={t('library.dragDrop')}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <svg
              className="h-10 w-10 animate-spin text-[var(--color-accent)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm text-[var(--color-text-secondary)]">Importing...</span>
          </div>
        ) : (
          <>
            {/* File icon */}
            <svg
              className="h-12 w-12 text-[var(--color-text-secondary)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="text-base font-medium text-[var(--color-text)]">{t('library.dragDrop')}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t('library.supportedFormats')}</p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Import File Button (separate from drop zone for clarity) */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="
          w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold
          text-white transition-opacity hover:opacity-90 disabled:opacity-50
        "
      >
        {t('library.import')}
      </button>

      {/* Paste Text Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t('library.pasteText')}</p>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste your text here..."
          rows={5}
          disabled={isLoading}
          className="
            w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]
            px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]
            focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]
            disabled:opacity-50
          "
        />
        <button
          type="button"
          onClick={handleImportText}
          disabled={isLoading || !pasteText.trim()}
          className="
            rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold
            text-white transition-opacity hover:opacity-90 disabled:opacity-50
          "
        >
          Import Text
        </button>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400'
          }`}
          role="status"
        >
          {statusMessage.text}
        </div>
      )}
    </div>
  );
};

export default React.memo(FileImport);
