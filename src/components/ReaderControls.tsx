import React, { useCallback } from 'react';
import { useReaderStore } from '../store/useReaderStore';
import { t, useLanguage } from '../i18n';

interface ReaderControlsProps {
  visible: boolean;
  onToggle: () => void;
  onOpenSettings?: () => void;
}

const WPM_PRESETS = [200, 300, 450, 600, 900] as const;
const WORDS_PER_FLASH_OPTIONS = [1, 2, 3] as const;

const ReaderControls: React.FC<ReaderControlsProps> = ({ visible, onToggle: _, onOpenSettings }) => {
  useLanguage(); // re-render on language change
  const isPlaying = useReaderStore((s) => s.isPlaying);
  const wpm = useReaderStore((s) => s.wpm);
  const currentWordIndex = useReaderStore((s) => s.currentWordIndex);
  const words = useReaderStore((s) => s.words);
  const chapters = useReaderStore((s) => s.chapters);
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const wordsPerFlash = useReaderStore((s) => s.wordsPerFlash);

  const toggle = useReaderStore((s) => s.toggle);
  const setWpm = useReaderStore((s) => s.setWpm);
  const setWordIndex = useReaderStore((s) => s.setWordIndex);
  const setChapter = useReaderStore((s) => s.setChapter);
  const skipSentence = useReaderStore((s) => s.skipSentence);
  const skipParagraph = useReaderStore((s) => s.skipParagraph);
  const setWordsPerFlash = useReaderStore((s) => s.setWordsPerFlash);

  const progressPercent = words.length > 0
    ? Math.round((currentWordIndex / (words.length - 1)) * 100)
    : 0;

  const chapterTitle = chapters[currentChapter]?.title ?? `${t('reader.chapter')} ${currentChapter + 1}`;

  const handleWpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWpm(Number(e.target.value)),
    [setWpm],
  );

  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setWordIndex(Number(e.target.value)),
    [setWordIndex],
  );

  const handleChapterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setChapter(Number(e.target.value)),
    [setChapter],
  );

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-40 transition-opacity duration-300 ${
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* Gradient backdrop — uses theme-aware CSS vars */}
      <div
        className="px-4 pb-5 pt-16"
        style={{
          background: `linear-gradient(to top, var(--color-controls-bg), var(--color-controls-via), transparent)`,
        }}
      >
        {/* Top row: back button + chapter info */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label={t('reader.backToLibrary')}
          >
            <span aria-hidden="true">&#x2190;</span>
            <span>{t('reader.backToLibrary')}</span>
          </button>

          <div className="text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{chapterTitle}</span>
            <span className="ml-2 tabular-nums">{progressPercent}%</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Chapter selector */}
            <select
              value={currentChapter}
              onChange={handleChapterChange}
              className="rounded-lg border px-2 py-1.5 text-sm outline-none"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
              }}
              aria-label={t('reader.selectChapter')}
            >
              {chapters.map((ch, i) => (
                <option key={i} value={i}>
                  {ch.title || `${t('reader.chapter')} ${i + 1}`}
                </option>
              ))}
            </select>

            {/* Settings gear button */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:opacity-80"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={t('settings.title')}
                title={t('settings.title')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Progress scrub bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={Math.max(words.length - 1, 0)}
            value={currentWordIndex}
            onChange={handleProgressChange}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[var(--color-accent)]"
            style={{ backgroundColor: 'var(--color-border)' }}
            aria-label={t('reader.progress')}
          />
        </div>

        {/* Main controls row */}
        <div className="mb-3 flex items-center justify-center gap-3">
          {/* |◀ Skip paragraph back */}
          <ControlButton onClick={() => skipParagraph(false)} label={t('reader.prevParagraph')} title={t('reader.prevParagraph')}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <rect x="3" y="5" width="2.5" height="14" rx="0.5" />
              <path d="M20 5v14l-10-7z" />
            </svg>
          </ControlButton>
          {/* ◀ Skip sentence back */}
          <ControlButton onClick={() => skipSentence(false)} label={t('reader.prevSentence')} title={t('reader.prevSentence')}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M20 5v14l-10-7z" />
              <path d="M11 5v14L1 12z" />
            </svg>
          </ControlButton>

          {/* ▶ Play / ⏸ Pause */}
          <button
            onClick={toggle}
            className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'var(--color-accent)' }}
            aria-label={isPlaying ? t('reader.pause') : t('reader.play')}
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                <rect x="6" y="5" width="3.5" height="14" rx="0.75" />
                <rect x="14.5" y="5" width="3.5" height="14" rx="0.75" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 ml-0.5">
                <path d="M6 4v16l14-8z" />
              </svg>
            )}
          </button>

          {/* ▶ Skip sentence forward */}
          <ControlButton onClick={() => skipSentence(true)} label={t('reader.nextSentence')} title={t('reader.nextSentence')}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M4 5v14l10-7z" />
              <path d="M13 5v14l10-7z" />
            </svg>
          </ControlButton>
          {/* ▶| Skip paragraph forward */}
          <ControlButton onClick={() => skipParagraph(true)} label={t('reader.nextParagraph')} title={t('reader.nextParagraph')}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M4 5v14l10-7z" />
              <rect x="18.5" y="5" width="2.5" height="14" rx="0.5" />
            </svg>
          </ControlButton>
        </div>

        {/* Speed controls */}
        <div className="mb-3 flex items-center gap-3">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            {t('reader.speed')}
          </span>

          <input
            type="range"
            min={100}
            max={1200}
            step={10}
            value={wpm}
            onChange={handleWpmChange}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-[var(--color-accent)]"
            style={{ backgroundColor: 'var(--color-border)' }}
            aria-label={t('reader.wpmSlider')}
          />

          <div className="flex gap-1">
            {WPM_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setWpm(preset)}
                className="rounded px-2 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: wpm === preset ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: wpm === preset ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom row: words-per-flash toggle + WPM display */}
        <div className="flex items-center justify-between">
          {/* Words per flash */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
              {t('reader.wordsPerFlash')}
            </span>
            <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              {WORDS_PER_FLASH_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setWordsPerFlash(n)}
                  className="px-3 py-1 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: wordsPerFlash === n ? 'var(--color-accent)' : 'var(--color-surface)',
                    color: wordsPerFlash === n ? '#fff' : 'var(--color-text-secondary)',
                  }}
                  aria-label={`${n} ${t('reader.wordsPerFlash')}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* WPM counter */}
          <div className="tabular-nums text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {wpm} <span className="text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>wpm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Small reusable control button                                       */
/* ------------------------------------------------------------------ */

interface ControlButtonProps {
  onClick: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}

const ControlButton: React.FC<ControlButtonProps> = React.memo(
  ({ onClick, label, title, children }) => (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full text-lg transition-colors hover:opacity-80"
      style={{ color: 'var(--color-text)' }}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  ),
);

ControlButton.displayName = 'ControlButton';

export default React.memo(ReaderControls);
