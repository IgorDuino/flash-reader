import React, { useCallback, useEffect, useRef } from 'react';
import { t, useLanguage } from '../i18n';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  key: string;
  labelKey: string;
}

const KEYBOARD_SHORTCUTS: ShortcutRow[] = [
  { key: 'Space', labelKey: 'shortcuts.playPause' },
  { key: '\u2190', labelKey: 'shortcuts.skipSentenceBack' },
  { key: '\u2192', labelKey: 'shortcuts.skipSentenceForward' },
  { key: '\u2191', labelKey: 'shortcuts.increaseSpeed' },
  { key: '\u2193', labelKey: 'shortcuts.decreaseSpeed' },
  { key: 'V', labelKey: 'shortcuts.showContext' },
  { key: 'Enter', labelKey: 'shortcuts.holdContext' },
  { key: 'S', labelKey: 'shortcuts.openSettings' },
  { key: 'Esc', labelKey: 'shortcuts.backToLibrary' },
  { key: 'F', labelKey: 'shortcuts.toggleFullscreen' },
  { key: '?', labelKey: 'shortcuts.showShortcuts' },
];

const TOUCH_GESTURES: { labelKey: string }[] = [
  { labelKey: 'gestures.tap' },
  { labelKey: 'gestures.swipeLeft' },
  { labelKey: 'gestures.swipeRight' },
  { labelKey: 'gestures.swipeUp' },
  { labelKey: 'gestures.swipeDown' },
];

const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ isOpen, onClose }) => {
  useLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on click outside the modal content
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="
        fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm
        animate-[fadeIn_150ms_ease-out]
      "
      role="dialog"
      aria-modal="true"
      aria-label={t('shortcuts.title')}
    >
      <div
        className="
          relative mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl
          border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl
          animate-[fadeIn_150ms_ease-out]
        "
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="
            absolute right-4 top-4 rounded p-1 text-[var(--color-text-secondary)]
            transition-colors hover:text-[var(--color-text)]
          "
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Keyboard Shortcuts */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">{t('shortcuts.title')}</h2>
          <div className="space-y-2">
            {KEYBOARD_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-[var(--color-text-secondary)]">{t(shortcut.labelKey)}</span>
                <kbd
                  className="
                    inline-flex min-w-[2.5rem] items-center justify-center rounded-md border
                    border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-xs
                    font-mono font-semibold text-[var(--color-text)]
                  "
                >
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <hr className="mb-6 border-[var(--color-border)]" />

        {/* Touch Gestures */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-[var(--color-text)]">{t('gestures.title')}</h2>
          <div className="space-y-2">
            {TOUCH_GESTURES.map((gesture) => (
              <div key={gesture.labelKey} className="py-1">
                <span className="text-sm text-[var(--color-text-secondary)]">{t(gesture.labelKey)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default React.memo(ShortcutOverlay);
