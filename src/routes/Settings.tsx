import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { t, useLanguage } from '../i18n';
import SettingsPanel from '../components/SettingsPanel';

const Settings: React.FC = () => {
  useLanguage();
  const navigate = useNavigate();
  const theme = useSettingsStore((s) => s.theme);

  // Initialize settings on mount
  useEffect(() => {
    useSettingsStore.getState().init();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)]" data-theme={theme}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
            aria-label="Back to library"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {t('settings.title')}
          </h1>
        </div>
      </header>

      {/* Settings content */}
      <main className="mx-auto max-w-2xl px-4 py-6 pb-20 sm:px-6">
        <SettingsPanel compact={false} />
      </main>
    </div>
  );
};

export default Settings;
