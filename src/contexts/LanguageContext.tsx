import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Language, 
  TranslationKeys, 
  getTranslation, 
  getStoredLanguage, 
  setStoredLanguage 
} from '../i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const [t, setT] = useState<TranslationKeys>(getTranslation(language));

  useEffect(() => {
    setT(getTranslation(language));
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
