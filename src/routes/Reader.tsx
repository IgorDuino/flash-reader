import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReaderStore } from '../store/useReaderStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { wpmToMs, getWordDelay, getRampUpSpeed, type TimingSettings } from '../lib/timing';
import type { Token } from '../lib/tokenizer';
import { detectLanguage, type LanguageInfo } from '../lib/languageDetect';
import { db } from '../db/dexie';
import WordDisplay from '../components/WordDisplay';
import ReaderControls from '../components/ReaderControls';
import ShortcutOverlay from '../components/ShortcutOverlay';
import SettingsPanel from '../components/SettingsPanel';
import { t, useLanguage } from '../i18n';

const SAVE_EVERY_N_WORDS = 10;

const Reader: React.FC = () => {
  useLanguage();
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId: string }>();

  // Reader store
  const isPlaying = useReaderStore((s) => s.isPlaying);
  const currentWordIndex = useReaderStore((s) => s.currentWordIndex);
  const currentChapter = useReaderStore((s) => s.currentChapter);
  const wpm = useReaderStore((s) => s.wpm);
  const wordsPerFlash = useReaderStore((s) => s.wordsPerFlash);
  const words = useReaderStore((s) => s.words);
  const totalWords = useReaderStore((s) => s.totalWords);
  const chapters = useReaderStore((s) => s.chapters);
  const controlsVisible = useReaderStore((s) => s.controlsVisible);

  const toggle = useReaderStore((s) => s.toggle);
  const pause = useReaderStore((s) => s.pause);
  const nextWord = useReaderStore((s) => s.nextWord);
  const setWpm = useReaderStore((s) => s.setWpm);
  const skipSentence = useReaderStore((s) => s.skipSentence);
  const setChapter = useReaderStore((s) => s.setChapter);
  const toggleControls = useReaderStore((s) => s.toggleControls);
  const loadBook = useReaderStore((s) => s.loadBook);

  // Settings store
  const theme = useSettingsStore((s) => s.theme);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const showCrosshair = useSettingsStore((s) => s.showCrosshair);
  const showWpmCounter = useSettingsStore((s) => s.showWpmCounter);
  const showProgressBar = useSettingsStore((s) => s.showProgressBar);
  const smoothRampUp = useSettingsStore((s) => s.smoothRampUp);
  const longWordDelay = useSettingsStore((s) => s.longWordDelay);
  const longWordThreshold = useSettingsStore((s) => s.longWordThreshold);
  const punctuationPauses = useSettingsStore((s) => s.punctuationPauses);
  const punctuationMultipliers = useSettingsStore((s) => s.punctuationMultipliers);
  const contentLanguageOverride = useSettingsStore((s) => s.contentLanguageOverride);
  const contextLineCount = useSettingsStore((s) => s.contextLineCount);
  const showContextHints = useSettingsStore((s) => s.showContextHints);

  // Local state
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for the timer loop
  const timerRef = useRef<number | null>(null);
  const wordsSinceSaveRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  // Pre-compute tokens for the current chapter
  const tokens = useMemo<Token[]>(() => {
    if (words.length === 0) return [];
    // We already have pre-tokenized words, so build Token objects from them
    return words.map((w, i) => ({
      word: w,
      index: i,
      isPunctuation: /^[\p{P}\p{S}]+$/u.test(w),
      pauseMultiplier: computeQuickPauseMultiplier(w),
    }));
  }, [words]);

  // Detect language info for the current content
  const languageInfo = useMemo<LanguageInfo>(() => {
    if (contentLanguageOverride) {
      // Map override language names to script info
      return detectLanguage(contentLanguageOverride);
    }
    if (words.length === 0) {
      return { script: 'latin' as const, direction: 'ltr' as const, language: 'English' };
    }
    return detectLanguage(words.slice(0, 100).join(' '));
  }, [words, contentLanguageOverride]);

  // Timing settings object
  const timingSettings = useMemo<TimingSettings>(() => ({
    longWordDelay,
    longWordThreshold,
    punctuationPauses,
    punctuationMultipliers,
  }), [longWordDelay, longWordThreshold, punctuationPauses, punctuationMultipliers]);

  // Build context paragraph around the current word for "peek" mode (V key / Enter held).
  // contextLineCount controls how many sentences to show (split roughly evenly before/after).
  const contextParagraph = useMemo(() => {
    if (words.length === 0) return { before: '', highlight: '', after: '' };

    const isSentenceEnd = (w: string) => /[.!?]$/.test(w);

    // Collect sentence boundary indices (word indices right after a sentence-ender)
    // before the current word, walking backwards.
    const sentencesBefore: number[] = []; // each entry = start-of-sentence word index
    for (let i = currentWordIndex - 1; i >= 0; i--) {
      if (isSentenceEnd(words[i]) && currentWordIndex - i > 1) {
        sentencesBefore.push(i + 1);
      }
      if (i === 0 && !isSentenceEnd(words[i])) {
        sentencesBefore.push(0);
      }
    }

    // Collect sentence boundary indices after the current word, walking forwards.
    const sentencesAfter: number[] = []; // each entry = end-of-sentence word index (inclusive)
    for (let i = currentWordIndex; i < words.length; i++) {
      if (isSentenceEnd(words[i]) && i >= currentWordIndex) {
        sentencesAfter.push(i);
      }
    }
    // Always include the very last word as a potential boundary
    if (sentencesAfter.length === 0 || sentencesAfter[sentencesAfter.length - 1] !== words.length - 1) {
      sentencesAfter.push(words.length - 1);
    }

    // Distribute contextLineCount sentences: ~half before, ~half after (at least 1 after)
    const halfBefore = Math.floor(contextLineCount / 2);
    const halfAfter = contextLineCount - halfBefore;

    // Determine start: pick the sentence boundary `halfBefore` sentences back
    let start = currentWordIndex;
    if (sentencesBefore.length > 0) {
      const pick = Math.min(halfBefore, sentencesBefore.length);
      start = sentencesBefore[pick - 1] ?? 0;
    }

    // Determine end: pick the sentence boundary `halfAfter` sentences forward
    let end = currentWordIndex;
    if (sentencesAfter.length > 0) {
      const pick = Math.min(halfAfter, sentencesAfter.length);
      end = sentencesAfter[pick - 1] ?? words.length - 1;
    }

    const highlightEnd = Math.min(currentWordIndex + wordsPerFlash, words.length);
    const before = words.slice(start, currentWordIndex).join(' ');
    const highlight = words.slice(currentWordIndex, highlightEnd).join(' ');
    const after = words.slice(highlightEnd, end + 1).join(' ');

    return { before, highlight, after };
  }, [words, currentWordIndex, wordsPerFlash, contextLineCount]);

  // Current word(s) to display
  const currentWords = useMemo(() => {
    if (words.length === 0) return [];
    const end = Math.min(currentWordIndex + wordsPerFlash, words.length);
    return words.slice(currentWordIndex, end);
  }, [words, currentWordIndex, wordsPerFlash]);

  // Progress percentage (across the whole book)
  const globalProgress = useMemo(() => {
    if (totalWords === 0 || chapters.length === 0) return 0;
    let wordsBefore = 0;
    for (let i = 0; i < currentChapter; i++) {
      wordsBefore += chapters[i].words.length;
    }
    return ((wordsBefore + currentWordIndex) / totalWords) * 100;
  }, [totalWords, chapters, currentChapter, currentWordIndex]);

  // ---- Load book on mount ----
  useEffect(() => {
    if (!bookId) {
      navigate('/');
      return;
    }
    const id = Number(bookId);
    if (Number.isNaN(id)) {
      navigate('/');
      return;
    }
    loadBook(id).then(() => setIsLoaded(true));
  }, [bookId, loadBook, navigate]);

  // ---- Save progress helper ----
  const saveProgress = useCallback(async () => {
    const state = useReaderStore.getState();
    if (state.bookId == null) return;
    const progress = await db.progress
      .where('bookId')
      .equals(state.bookId)
      .first();

    let wordsBefore = 0;
    for (let i = 0; i < state.currentChapter; i++) {
      wordsBefore += state.chapters[i].words.length;
    }
    const pct = state.totalWords > 0
      ? ((wordsBefore + state.currentWordIndex) / state.totalWords) * 100
      : 0;

    const data = {
      bookId: state.bookId,
      currentWordIndex: state.currentWordIndex,
      currentChapter: state.currentChapter,
      wpm: state.wpm,
      lastReadAt: Date.now(),
      percentComplete: Math.round(pct * 10) / 10,
    };

    if (progress?.id != null) {
      await db.progress.update(progress.id, data);
    } else {
      await db.progress.add(data);
    }
  }, []);

  // ---- Precise playback timer with drift correction ----
  useEffect(() => {
    if (!isPlaying || tokens.length === 0) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let lastTickTime = performance.now();

    function scheduleNext() {
      if (cancelled) return;

      const state = useReaderStore.getState();
      if (!state.isPlaying) return;

      const idx = state.currentWordIndex;
      if (idx >= tokens.length) return;

      const token = tokens[idx];
      const baseMs = wpmToMs(state.wpm);
      const delay = getWordDelay(baseMs, token, timingSettings);
      const actualDelay = smoothRampUp
        ? getRampUpSpeed(delay, state.rampUpCounter, 5)
        : delay;

      // Drift correction: how much late we were from the last tick
      const now = performance.now();
      const drift = now - lastTickTime;
      const corrected = Math.max(1, actualDelay - (drift - actualDelay));

      timerRef.current = window.setTimeout(() => {
        if (cancelled) return;
        lastTickTime = performance.now();

        nextWord();
        wordsSinceSaveRef.current++;

        // Auto-save every N words
        if (wordsSinceSaveRef.current >= SAVE_EVERY_N_WORDS) {
          wordsSinceSaveRef.current = 0;
          saveProgress();
        }

        scheduleNext();
      }, idx === state.currentWordIndex ? actualDelay : corrected);
    }

    // Kick off the loop
    lastTickTime = performance.now();
    scheduleNext();

    return () => {
      cancelled = true;
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, tokens, timingSettings, smoothRampUp, nextWord, saveProgress]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Use e.code for layout-independent shortcuts (works on any keyboard language)
      const code = e.code;

      switch (code) {
        case 'Space':
          e.preventDefault();
          toggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipSentence(false);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipSentence(true);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setWpm(wpm + 50);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setWpm(wpm - 50);
          break;
        case 'Escape':
          if (shortcutsOpen) {
            setShortcutsOpen(false);
          } else if (settingsOpen) {
            setSettingsOpen(false);
          } else {
            pause();
            saveProgress();
            navigate('/');
          }
          break;
        case 'KeyF':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            document.documentElement.requestFullscreen().catch(() => {});
          }
          break;
        case 'Slash': // ? is Shift+Slash on most layouts
          if (e.shiftKey) {
            e.preventDefault();
            setShortcutsOpen((prev) => !prev);
          }
          break;
        case 'KeyS':
          e.preventDefault();
          pause();
          setSettingsOpen((prev) => !prev);
          break;
        case 'KeyV':
          e.preventDefault();
          pause();
          setContextVisible((prev) => !prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (!contextVisible) {
            pause();
            setContextVisible(true);
          }
          break;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Enter') {
        setContextVisible(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggle, skipSentence, setWpm, wpm, pause, saveProgress, navigate, shortcutsOpen, settingsOpen, contextVisible]);

  // ---- Touch gesture handling ----
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const elapsed = Date.now() - touchStartRef.current.t;
      touchStartRef.current = null;

      // Ignore very slow gestures (>800ms)
      if (elapsed > 800) return;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Determine if swipe or tap
      if (absDx < 20 && absDy < 20) {
        // Tap -- toggle play/pause
        toggle();
        return;
      }

      if (absDx > absDy) {
        // Horizontal swipe
        if (dx < -50) {
          // Swipe left: next chapter
          setChapter(currentChapter + 1);
        } else if (dx > 50) {
          // Swipe right: prev chapter
          setChapter(currentChapter - 1);
        }
      } else {
        // Vertical swipe
        if (dy < -50) {
          // Swipe up: increase WPM
          setWpm(wpm + 50);
        } else if (dy > 50) {
          // Swipe down: decrease WPM
          setWpm(wpm - 50);
        }
      }
    },
    [toggle, setChapter, currentChapter, setWpm, wpm],
  );

  // ---- Save progress and pause on unmount ----
  useEffect(() => {
    return () => {
      useReaderStore.getState().pause();
      // Save progress on unmount
      const state = useReaderStore.getState();
      if (state.bookId != null) {
        saveProgress();
      }
    };
  }, [saveProgress]);

  // ---- Auto-hide controls after 3s of mouse inactivity ----
  useEffect(() => {
    const IDLE_TIMEOUT = 3000;

    function resetIdleTimer() {
      if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current);
      // Show controls on any mouse movement
      const state = useReaderStore.getState();
      if (!state.controlsVisible) {
        toggleControls();
      }
      idleTimerRef.current = window.setTimeout(() => {
        const s = useReaderStore.getState();
        if (s.controlsVisible && s.isPlaying) {
          toggleControls();
        }
      }, IDLE_TIMEOUT);
    }

    window.addEventListener('mousemove', resetIdleTimer);
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      if (idleTimerRef.current != null) clearTimeout(idleTimerRef.current);
    };
  }, [toggleControls]);

  // ---- Resolve font family to actual CSS value ----
  const resolvedFontFamily = useMemo(() => {
    switch (fontFamily) {
      case 'serif':
        return "'reading-serif', Georgia, 'Noto Serif', serif";
      case 'sans-serif':
        return "'reading-sans', 'Helvetica Neue', 'Noto Sans', sans-serif";
      case 'monospace':
        return "ui-monospace, Consolas, 'Courier New', monospace";
      case 'system':
      default:
        return "system-ui, -apple-system, 'Segoe UI', sans-serif";
    }
  }, [fontFamily]);

  // ---- Loading state ----
  if (!isLoaded) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center bg-[var(--color-bg)]"
        data-theme={theme}
      >
        <svg className="h-10 w-10 animate-spin text-[var(--color-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // ---- No words (book not found or empty) ----
  if (words.length === 0 && isLoaded) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)]"
        data-theme={theme}
      >
        <p className="text-lg text-[var(--color-text-secondary)]">Book not found or has no content.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative h-screen w-screen select-none overflow-hidden bg-[var(--color-bg)]"
      data-theme={theme}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Reading area -- full screen, click/tap toggles controls */}
      <div
        className="flex h-full w-full cursor-pointer items-center justify-center"
        onClick={(e) => {
          // Only toggle controls on direct click (not from child controls)
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-reading-area]')) {
            toggleControls();
          }
        }}
        data-reading-area
      >
        {contextVisible ? (
          /* ── Inline context paragraph — renders right on the reading canvas ── */
          <div
            className="relative flex h-full w-full select-none items-center justify-center overflow-hidden"
            style={{ direction: languageInfo.direction, backgroundColor: 'var(--color-reader-bg)' }}
          >
            {/* Same crosshair guides as WordDisplay for visual consistency */}
            {showCrosshair && (
              <>
                <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ backgroundColor: 'var(--color-crosshair)' }} />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ backgroundColor: 'var(--color-crosshair)' }} />
              </>
            )}

            <div
              className="max-w-3xl px-8"
              style={{ fontFamily: resolvedFontFamily }}
            >
              <p
                className="text-center leading-relaxed"
                style={{ fontSize: `${Math.max(fontSize * 0.38, 16)}px` }}
              >
                {contextParagraph.before && (
                  <span style={{ color: 'var(--color-context-dim)' }}>{contextParagraph.before} </span>
                )}
                <span
                  className="font-bold"
                  style={{
                    color: 'var(--color-orp)',
                    textDecoration: 'underline',
                    textDecorationColor: 'var(--color-orp-bg)',
                    textUnderlineOffset: '4px',
                    textDecorationThickness: '2px',
                  }}
                >
                  {contextParagraph.highlight}
                </span>
                {contextParagraph.after && (
                  <span style={{ color: 'var(--color-context-dim)' }}> {contextParagraph.after}</span>
                )}
              </p>

              {showContextHints && (
                <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-context-hint)' }}>
                  V — {t('reader.toggleContext') || 'toggle'} · Enter — {t('reader.holdToShow') || 'hold to show'}
                </p>
              )}
            </div>
          </div>
        ) : (
          <WordDisplay
            words={currentWords}
            script={languageInfo.script}
            direction={languageInfo.direction}
            showCrosshair={showCrosshair}
            fontFamily={resolvedFontFamily}
            fontSize={fontSize}
          />
        )}
      </div>

      {/* WPM counter overlay -- top right */}
      {showWpmCounter && (
        <div className="pointer-events-none absolute right-4 top-4 z-20 tabular-nums text-sm font-semibold text-[var(--color-text-secondary)]">
          {wpm} wpm
        </div>
      )}

      {/* Progress bar -- top of screen */}
      {showProgressBar && (
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-[var(--color-border)]">
          <div
            className="h-full bg-[var(--color-accent)] transition-[width] duration-150 ease-linear"
            style={{ width: `${globalProgress}%` }}
          />
        </div>
      )}

      {/* Reader controls overlay */}
      <ReaderControls
        visible={controlsVisible}
        onToggle={toggleControls}
        onOpenSettings={() => { pause(); setSettingsOpen(true); }}
      />

      {/* Settings popup overlay */}
      {settingsOpen && (
        <div
          className="absolute inset-0 z-50 flex items-start justify-center overflow-y-auto backdrop-blur-sm"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg) 85%, transparent)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div
            className="relative mx-4 my-8 w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl"
            data-theme={theme}
            style={{ animation: 'fadeIn 0.2s ease-out' }}
          >
            {/* Close button */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--color-text)]">{t('settings.title')}</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <SettingsPanel compact />
          </div>
        </div>
      )}

      {/* Shortcut overlay */}
      <ShortcutOverlay
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
};

/**
 * Quick pause multiplier computation for pre-tokenized words.
 * Mirrors the logic in tokenizer.ts but works on already-split words.
 */
function computeQuickPauseMultiplier(word: string): number {
  let multiplier = 1.0;
  if (/[.!?]$/.test(word)) {
    multiplier *= 1.5;
  } else if (/[,;:]$/.test(word)) {
    multiplier *= 1.2;
  } else if (/(\u2014|\.{3})$/.test(word)) {
    multiplier *= 1.3;
  }
  if (word.length > 8) {
    multiplier *= Math.min(1 + (word.length - 8) * 0.1, 2.0);
  }
  return multiplier;
}

export default Reader;
