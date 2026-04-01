import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore, type Settings } from '../store/useSettingsStore';
import { t, useLanguage, getAvailableLanguages, setLanguage } from '../i18n';
import { db } from '../db/dexie';

const FONT_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'serif', labelKey: 'settings.serif' },
  { value: 'sans-serif', labelKey: 'settings.sansSerif' },
  { value: 'monospace', labelKey: 'settings.monospace' },
  { value: 'system', labelKey: 'settings.system' },
];

const THEME_OPTIONS: { value: Settings['theme']; labelKey: string; preview: string }[] = [
  { value: 'dark', labelKey: 'settings.themeDark', preview: 'bg-[#1a1a2e] text-[#F7FAFC]' },
  { value: 'light', labelKey: 'settings.themeLight', preview: 'bg-[#F7FAFC] text-[#1A202C]' },
  { value: 'oled', labelKey: 'settings.themeOled', preview: 'bg-black text-[#F7FAFC]' },
  { value: 'sepia', labelKey: 'settings.themeSepia', preview: 'bg-[#F5E6D3] text-[#3E2723]' },
];

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  pt: 'Português',
};

const CONTENT_LANGUAGES = [
  { value: '', label: 'settings.autoDetect' },
  { value: 'English', label: 'English' },
  { value: 'Chinese', label: '中文' },
  { value: 'Japanese', label: '日本語' },
  { value: 'Korean', label: '한국어' },
  { value: 'Arabic', label: 'العربية' },
  { value: 'Hebrew', label: 'עברית' },
  { value: 'Cyrillic', label: 'Кириллица' },
];

interface SettingsPanelProps {
  /** If true, hides the Data section (export/import/clear) — useful in the reader popup */
  compact?: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ compact = false }) => {
  useLanguage();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [clearConfirmStep, setClearConfirmStep] = useState(0);

  const {
    wpm,
    wordsPerFlash,
    fontFamily,
    fontSize,
    longWordDelay,
    longWordThreshold,
    punctuationPauses,
    smoothRampUp,
    contextLineCount,
    theme,
    showCrosshair,
    showWpmCounter,
    showProgressBar,
    uiLanguage,
    contentLanguageOverride,
    updateSetting,
    exportSettings,
    importSettings,
  } = useSettingsStore();

  // Sync i18n language
  useEffect(() => {
    setLanguage(uiLanguage);
  }, [uiLanguage]);

  const handleExport = useCallback(() => {
    const data = exportSettings();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashread-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportSettings]);

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          importSettings(reader.result);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importSettings],
  );

  const handleClearData = useCallback(async () => {
    if (clearConfirmStep === 0) {
      setClearConfirmStep(1);
      return;
    }
    if (clearConfirmStep === 1) {
      setClearConfirmStep(2);
      return;
    }
    // Step 2: actually clear
    await db.books.clear();
    await db.progress.clear();
    await db.settings.clear();
    useSettingsStore.getState().resetToDefaults();
    setClearConfirmStep(0);
  }, [clearConfirmStep]);

  // Reset clear confirmation if user clicks away
  useEffect(() => {
    if (clearConfirmStep > 0) {
      const timer = setTimeout(() => setClearConfirmStep(0), 5000);
      return () => clearTimeout(timer);
    }
  }, [clearConfirmStep]);

  return (
    <div className="space-y-8">
      {/* ---- Reading Preferences ---- */}
      <Section title={t('settings.reading')}>
        {/* WPM */}
        <SettingRow label={t('settings.defaultWpm')} hint={`${wpm}`}>
          <input
            type="range"
            min={100}
            max={1200}
            step={10}
            value={wpm}
            onChange={(e) => updateSetting('wpm', Number(e.target.value))}
            className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
          />
        </SettingRow>

        {/* Words per flash */}
        <SettingRow label={t('settings.wordsPerFlash')}>
          <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)]">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => updateSetting('wordsPerFlash', n)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  wordsPerFlash === n
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </SettingRow>

        {/* Font family */}
        <SettingRow label={t('settings.fontFamily')}>
          <select
            value={fontFamily}
            onChange={(e) => updateSetting('fontFamily', e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </SettingRow>

        {/* Font size */}
        <SettingRow label={t('settings.fontSize')} hint={`${fontSize}px`}>
          <input
            type="range"
            min={32}
            max={96}
            step={2}
            value={fontSize}
            onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
            className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
          />
        </SettingRow>

        {/* Long word delay */}
        <SettingRow label={t('settings.longWordDelay')}>
          <Toggle
            checked={longWordDelay}
            onChange={(v) => updateSetting('longWordDelay', v)}
          />
        </SettingRow>

        {/* Long word threshold */}
        {longWordDelay && (
          <SettingRow label={t('settings.longWordThreshold')} hint={`${longWordThreshold} chars`}>
            <input
              type="range"
              min={4}
              max={16}
              step={1}
              value={longWordThreshold}
              onChange={(e) => updateSetting('longWordThreshold', Number(e.target.value))}
              className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
            />
          </SettingRow>
        )}

        {/* Punctuation pauses */}
        <SettingRow label={t('settings.punctuationPauses')}>
          <Toggle
            checked={punctuationPauses}
            onChange={(v) => updateSetting('punctuationPauses', v)}
          />
        </SettingRow>

        {/* Smooth ramp-up */}
        <SettingRow label={t('settings.smoothRampUp')}>
          <Toggle
            checked={smoothRampUp}
            onChange={(v) => updateSetting('smoothRampUp', v)}
          />
        </SettingRow>

        {/* Context paragraph lines */}
        <SettingRow label={t('settings.contextLines')} hint={`${contextLineCount}`}>
          <input
            type="range"
            min={1}
            max={15}
            step={1}
            value={contextLineCount}
            onChange={(e) => updateSetting('contextLineCount', Number(e.target.value))}
            className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-accent)]"
          />
        </SettingRow>
      </Section>

      {/* ---- Display ---- */}
      <Section title={t('settings.display')}>
        {/* Theme */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--color-text)]">
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => updateSetting('theme', opt.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                  theme === opt.value
                    ? 'border-[var(--color-accent)] shadow-md'
                    : 'border-[var(--color-border)] hover:border-[var(--color-text-secondary)]'
                }`}
              >
                <div className={`h-10 w-full rounded-lg ${opt.preview} flex items-center justify-center text-xs font-semibold`}>
                  Aa
                </div>
                <span className="text-xs font-medium text-[var(--color-text)]">
                  {t(opt.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Crosshair */}
        <SettingRow label={t('settings.showCrosshair')}>
          <Toggle
            checked={showCrosshair}
            onChange={(v) => updateSetting('showCrosshair', v)}
          />
        </SettingRow>

        {/* WPM counter */}
        <SettingRow label={t('settings.showWpm')}>
          <Toggle
            checked={showWpmCounter}
            onChange={(v) => updateSetting('showWpmCounter', v)}
          />
        </SettingRow>

        {/* Progress bar */}
        <SettingRow label={t('settings.showProgress')}>
          <Toggle
            checked={showProgressBar}
            onChange={(v) => updateSetting('showProgressBar', v)}
          />
        </SettingRow>
      </Section>

      {/* ---- Language ---- */}
      <Section title={t('settings.language')}>
        {/* UI Language */}
        <SettingRow label={t('settings.uiLanguage')}>
          <select
            value={uiLanguage}
            onChange={(e) => updateSetting('uiLanguage', e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {getAvailableLanguages().map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang] ?? lang}
              </option>
            ))}
          </select>
        </SettingRow>

        {/* Content language override */}
        <SettingRow label={t('settings.contentLanguage')}>
          <select
            value={contentLanguageOverride ?? ''}
            onChange={(e) => updateSetting('contentLanguageOverride', e.target.value || null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            {CONTENT_LANGUAGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === '' ? t(opt.label) : opt.label}
              </option>
            ))}
          </select>
        </SettingRow>
      </Section>

      {/* ---- Data (hidden in compact/popup mode) ---- */}
      {!compact && (
        <Section title={t('settings.data')}>
          <div className="flex flex-wrap gap-3">
            {/* Export */}
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {t('settings.exportData')}
            </button>

            {/* Import */}
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {t('settings.importData')}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
              aria-hidden="true"
            />

            {/* Clear all data */}
            <button
              type="button"
              onClick={handleClearData}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                clearConfirmStep === 0
                  ? 'border-red-500/30 text-red-400 hover:border-red-500 hover:bg-red-500/10'
                  : clearConfirmStep === 1
                    ? 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-red-600 bg-red-600 text-white'
              }`}
            >
              {clearConfirmStep === 0
                ? t('settings.clearData')
                : clearConfirmStep === 1
                  ? t('settings.clearConfirm')
                  : t('settings.clearConfirmText')}
            </button>
          </div>
        </Section>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Reusable sub-components                                             */
/* ------------------------------------------------------------------ */

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <section>
    <h2 className="mb-4 border-b border-[var(--color-border)] pb-2 text-base font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
      {title}
    </h2>
    <div className="space-y-5">{children}</div>
  </section>
);

interface SettingRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, hint, children }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
      {hint && (
        <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">{hint}</span>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
      checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

export default React.memo(SettingsPanel);
