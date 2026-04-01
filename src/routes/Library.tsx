import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import BookCard from '../components/BookCard';
import FileImport from '../components/FileImport';
import { t, useLanguage } from '../i18n';

const Library: React.FC = () => {
  useLanguage();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  const books = useLibraryStore((s) => s.books);
  const searchQuery = useLibraryStore((s) => s.searchQuery);
  const setSearchQuery = useLibraryStore((s) => s.setSearchQuery);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const getFilteredBooks = useLibraryStore((s) => s.getFilteredBooks);
  const deleteBook = useLibraryStore((s) => s.deleteBook);

  const viewMode = useSettingsStore((s) => s.viewMode);
  const theme = useSettingsStore((s) => s.theme);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  // Initialize stores on mount
  useEffect(() => {
    useSettingsStore.getState().init();
    useLibraryStore.getState().loadBooks();
  }, []);

  const filteredBooks = useMemo(() => getFilteredBooks(), [getFilteredBooks, books, searchQuery]);
  const hasBooks = books.length > 0;

  const handleReadBook = useCallback(
    (bookId: number) => {
      navigate(`/reader/${bookId}`);
    },
    [navigate],
  );

  const handleDeleteBook = useCallback(
    (bookId: number) => {
      deleteBook(bookId);
    },
    [deleteBook],
  );

  const handleImportComplete = useCallback(
    (bookId: number) => {
      setImportOpen(false);
      navigate(`/reader/${bookId}`);
    },
    [navigate],
  );

  const toggleViewMode = useCallback(() => {
    updateSetting('viewMode', viewMode === 'grid' ? 'list' : 'grid');
  }, [viewMode, updateSetting]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]" data-theme={theme}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)] sm:text-2xl">
            {t('app.name')}
          </h1>

          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            {hasBooks && (
              <button
                type="button"
                onClick={toggleViewMode}
                className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                aria-label={viewMode === 'grid' ? t('library.list') : t('library.grid')}
                title={viewMode === 'grid' ? t('library.list') : t('library.grid')}
              >
                {viewMode === 'grid' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                )}
              </button>
            )}

            {/* Settings gear */}
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              aria-label={t('settings.title')}
              title={t('settings.title')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search bar -- only shown if there are books */}
        {hasBooks && (
          <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('library.search')}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <svg className="h-8 w-8 animate-spin text-[var(--color-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !hasBooks && (
          <div className="flex flex-col items-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mb-4 h-16 w-16 text-[var(--color-text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="mb-8 text-center text-lg text-[var(--color-text-secondary)]">
              {t('library.empty')}
            </p>
            <div className="w-full max-w-lg">
              <FileImport onImportComplete={handleImportComplete} />
            </div>
          </div>
        )}

        {/* Library content with import section */}
        {!isLoading && hasBooks && (
          <>
            {/* Collapsible import section */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setImportOpen(!importOpen)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition-transform ${importOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {t('library.import')}
              </button>

              {importOpen && (
                <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <FileImport onImportComplete={handleImportComplete} />
                </div>
              )}
            </div>

            {/* Book grid/list */}
            {filteredBooks.length === 0 ? (
              <p className="py-12 text-center text-[var(--color-text-secondary)]">
                No books match your search.
              </p>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    viewMode="grid"
                    onRead={handleReadBook}
                    onDelete={handleDeleteBook}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredBooks.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    viewMode="list"
                    onRead={handleReadBook}
                    onDelete={handleDeleteBook}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Library;
