import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en/common.json';
import mr from './mr/common.json';
import { environment } from '../config/environment';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    mr: { translation: mr }
  },
  lng: localStorage.getItem('locale') || environment.defaultLocale,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
});

export default i18n;
