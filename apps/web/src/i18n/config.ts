import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslation from '@mkelectric/shared/locales/en/translation.json';
import neTranslation from '@mkelectric/shared/locales/ne/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      ne: { translation: neTranslation },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ne'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mkelectric_lang',
    },
  });

export default i18n;
