import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { db } from '../db/dexie';

export interface PunctuationMultipliers {
  period: number;
  comma: number;
  semicolon: number;
  dash: number;
}

export interface Settings {
  wpm: number;
  wordsPerFlash: 1 | 2 | 3;
  fontFamily: string;
  fontSize: number;
  longWordDelay: boolean;
  longWordThreshold: number;
  punctuationPauses: boolean;
  punctuationMultipliers: PunctuationMultipliers;
  smoothRampUp: boolean;
  contextLineCount: number;
  theme: 'dark' | 'light' | 'oled' | 'sepia';
  showCrosshair: boolean;
  showWpmCounter: boolean;
  showProgressBar: boolean;
  uiLanguage: string;
  contentLanguageOverride: string | null;
  viewMode: 'grid' | 'list';
}

const DEFAULT_SETTINGS: Settings = {
  wpm: 300,
  wordsPerFlash: 1,
  fontFamily: 'serif',
  fontSize: 56,
  longWordDelay: true,
  longWordThreshold: 8,
  punctuationPauses: true,
  punctuationMultipliers: { period: 1.5, comma: 1.2, semicolon: 1.2, dash: 1.3 },
  smoothRampUp: true,
  contextLineCount: 5,
  theme: 'dark',
  showCrosshair: true,
  showWpmCounter: true,
  showProgressBar: true,
  uiLanguage: 'en',
  contentLanguageOverride: null,
  viewMode: 'grid',
};

interface SettingsState extends Settings {
  _initialized: boolean;
  init: () => Promise<void>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetToDefaults: () => void;
  exportSettings: () => Settings;
  importSettings: (json: string) => void;
}

async function persistAllSettings(settings: Settings): Promise<void> {
  const entries = Object.entries(settings) as [keyof Settings, any][];
  await Promise.all(
    entries.map(([key, value]) =>
      db.settings.put({ key, value }, undefined)
    )
  );
}

async function persistSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing?.id != null) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.put({ key, value });
  }
}

async function loadSettingsFromDB(): Promise<Partial<Settings>> {
  const rows = await db.settings.toArray();
  const result: Record<string, any> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result as Partial<Settings>;
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_SETTINGS,
    _initialized: false,

    init: async () => {
      const saved = await loadSettingsFromDB();
      set({ ...DEFAULT_SETTINGS, ...saved, _initialized: true });
    },

    updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => {
      set({ [key]: value } as Pick<Settings, K>);
      persistSetting(key, value);
    },

    resetToDefaults: () => {
      set({ ...DEFAULT_SETTINGS });
      persistAllSettings(DEFAULT_SETTINGS);
    },

    exportSettings: (): Settings => {
      const state = get();
      const exported: Record<string, any> = {};
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
        exported[key] = state[key];
      }
      return exported as Settings;
    },

    importSettings: (json: string) => {
      try {
        const parsed = JSON.parse(json) as Partial<Settings>;
        const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed };
        set(merged);
        persistAllSettings(merged);
      } catch {
        console.error('Failed to import settings: invalid JSON');
      }
    },
  }))
);

// Auto-persist on every change after initialization
useSettingsStore.subscribe(
  (state) => state._initialized,
  (initialized) => {
    if (!initialized) return;
    // Once initialized, subscribe to all setting changes
    const settingKeys = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];
    for (const key of settingKeys) {
      useSettingsStore.subscribe(
        (state) => state[key],
        (value) => {
          if (useSettingsStore.getState()._initialized) {
            persistSetting(key, value as Settings[typeof key]);
          }
        }
      );
    }
  }
);
