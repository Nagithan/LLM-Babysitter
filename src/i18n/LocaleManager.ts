import { TRANSLATIONS, TranslationKey } from './translations.js';

export class LocaleManager {
  public static getTranslation(key: TranslationKey): string {
    return TRANSLATIONS[key] || key;
  }

  public static getTranslations(): Record<string, string> {
    return { ...TRANSLATIONS };
  }
}
