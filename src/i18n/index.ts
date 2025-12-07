import { en } from './locales/en';
import { zh } from './locales/zh';

export type Language = 'en' | 'zh';

export const languages: Record<Language, string> = {
  en: 'English',
  zh: '中文',
};

const translations = { en, zh };

export type TranslationKeys = typeof en;

export const getTranslation = (lang: Language): TranslationKeys => {
  return translations[lang] || translations.en;
};

export const getStoredLanguage = (): Language => {
  const stored = localStorage.getItem('language');
  if (stored === 'en' || stored === 'zh') {
    return stored;
  }
  // Auto-detect browser language
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
};

export const setStoredLanguage = (lang: Language): void => {
  localStorage.setItem('language', lang);
};
