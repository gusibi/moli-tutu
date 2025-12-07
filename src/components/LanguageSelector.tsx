import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language, languages } from '../i18n';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-semibold text-base-content flex items-center gap-2">
          <Globe className="w-4 h-4" />
          {t.sidebar.language}
        </span>
      </label>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="select select-bordered w-full"
      >
        {(Object.keys(languages) as Language[]).map((lang) => (
          <option key={lang} value={lang}>
            {languages[lang]}
          </option>
        ))}
      </select>
    </div>
  );
};
