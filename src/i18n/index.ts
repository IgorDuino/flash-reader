import { useSyncExternalStore } from 'react';
import en from './translations/en.json';
import es from './translations/es.json';
import fr from './translations/fr.json';
import de from './translations/de.json';
import ru from './translations/ru.json';
import zh from './translations/zh.json';
import ja from './translations/ja.json';
import ko from './translations/ko.json';
import ar from './translations/ar.json';
import pt from './translations/pt.json';

const translations: Record<string, any> = { en, es, fr, de, ru, zh, ja, ko, ar, pt };

let currentLanguage = 'en';
let version = 0;
const listeners = new Set<() => void>();

function emitChange() {
  version++;
  listeners.forEach((l) => l());
}

export function setLanguage(lang: string): void {
  if (translations[lang] && lang !== currentLanguage) {
    currentLanguage = lang;
    emitChange();
  }
}

export function getLanguage(): string {
  return currentLanguage;
}

/** React hook — re-renders the component when the UI language changes. */
export function useLanguage(): string {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => `${currentLanguage}:${version}`,
  );
}

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[currentLanguage];

  for (const k of keys) {
    if (value == null || typeof value !== 'object') {
      value = undefined;
      break;
    }
    value = value[k];
  }

  // Fallback to English if key not found in current language
  if (value === undefined && currentLanguage !== 'en') {
    value = translations.en;
    for (const k of keys) {
      if (value == null || typeof value !== 'object') {
        value = undefined;
        break;
      }
      value = value[k];
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Replace {{param}} placeholders
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_: string, paramKey: string) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
    });
  }

  return value;
}

export function getTranslations(lang: string) {
  return translations[lang] || translations.en;
}

export function getAvailableLanguages(): string[] {
  return Object.keys(translations);
}
