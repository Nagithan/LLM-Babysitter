import * as vscode from 'vscode';
import { TRANSLATIONS, TranslationKey, Language } from './translations.js';

export class LocaleManager {
  private static getLanguage(): Language {
    const lang = vscode.env.language;
    if (lang.startsWith('fr')) {
      return 'fr';
    }
    return 'en';
  }

  public static getTranslation(key: TranslationKey): string {
    const lang = this.getLanguage();
    return TRANSLATIONS[lang][key] || TRANSLATIONS.en[key] || key;
  }

  public static getTranslations(): Record<string, string> {
    const lang = this.getLanguage();
    return TRANSLATIONS[lang];
  }
}
