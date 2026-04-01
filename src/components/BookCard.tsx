import React, { useCallback, useMemo } from 'react';
import type { ReadingProgress } from '../db/dexie';
import type { ServerBookMeta } from '../lib/api';
import { t, useLanguage } from '../i18n';

interface BookCardProps {
  book: ServerBookMeta & { progress?: ReadingProgress };
  viewMode: 'grid' | 'list';
  onRead: (bookId: string) => void;
  onDelete: (bookId: string) => void;
}

/** Generate a deterministic hue from the book title for the placeholder color. */
function titleHue(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

const BookCard: React.FC<BookCardProps> = ({ book, viewMode, onRead, onDelete }) => {
  useLanguage();
  const bookId = book.id;
  const percent = book.progress?.percentComplete ?? 0;
  const hasStarted = percent > 0;
  const hue = useMemo(() => titleHue(book.title), [book.title]);
  const initial = book.title.charAt(0).toUpperCase() || '?';

  const handleRead = useCallback(() => onRead(bookId), [onRead, bookId]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const confirmed = window.confirm(
        `${t('library.deleteConfirm')}\n${t('library.deleteConfirmText')}`,
      );
      if (confirmed) {
        onDelete(bookId);
      }
    },
    [onDelete, bookId],
  );

  const coverElement = book.coverImage ? (
    <img
      src={book.coverImage}
      alt={book.title}
      className={`object-cover ${viewMode === 'grid' ? 'h-40 w-full rounded-t-lg' : 'h-16 w-12 rounded'}`}
    />
  ) : (
    <div
      className={`flex items-center justify-center font-bold text-white ${
        viewMode === 'grid' ? 'h-40 w-full rounded-t-lg text-4xl' : 'h-16 w-12 rounded text-lg'
      }`}
      style={{ backgroundColor: `hsl(${hue}, 55%, 45%)` }}
    >
      {initial}
    </div>
  );

  const progressBar = (
    <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]">
      <div
        className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={handleDelete}
      className="
        rounded p-1 text-[var(--color-text-secondary)] transition-colors
        hover:bg-red-500/15 hover:text-red-400
      "
      aria-label="Delete book"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    </button>
  );

  // ---- Grid Mode ----
  if (viewMode === 'grid') {
    return (
      <div
        className="
          group flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]
          bg-[var(--color-surface)] transition-shadow hover:shadow-lg cursor-pointer
        "
        onClick={handleRead}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRead();
          }
        }}
      >
        <div className="relative shrink-0">
          {coverElement}
          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
            {deleteButton}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-[var(--color-text)]">{book.title}</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">{book.author}</p>

          <div className="mt-auto space-y-2 pt-2">
            {progressBar}
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t('library.progress', { percent: Math.round(percent) })}
              </span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t('library.words', { count: book.totalWords })}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRead();
              }}
              className="
                w-full rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold
                text-white transition-opacity hover:opacity-90
              "
            >
              {hasStarted ? t('library.resume') : t('library.startReading')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- List Mode ----
  return (
    <div
      className="
        group flex items-center gap-4 rounded-lg border border-[var(--color-border)]
        bg-[var(--color-surface)] p-3 transition-shadow hover:shadow-lg cursor-pointer
      "
      onClick={handleRead}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRead();
        }
      }}
    >
      <div className="shrink-0">{coverElement}</div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{book.title}</h3>
        <p className="truncate text-xs text-[var(--color-text-secondary)]">{book.author}</p>
        <div className="mt-1 max-w-xs">{progressBar}</div>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {t('library.progress', { percent: Math.round(percent) })}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRead();
          }}
          className="
            rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold
            text-white transition-opacity hover:opacity-90
          "
        >
          {hasStarted ? t('library.resume') : t('library.startReading')}
        </button>
        {deleteButton}
      </div>
    </div>
  );
};

export default React.memo(BookCard);
